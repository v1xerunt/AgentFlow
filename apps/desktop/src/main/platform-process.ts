import spawn from 'cross-spawn'
import type { ChildProcess, ChildProcessWithoutNullStreams } from 'node:child_process'
import { homedir } from 'node:os'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { t } from '@agentflow/core/localization'

const children = new Set<ChildProcess>()
const terminating = new WeakSet<ChildProcess>()
const terminatingUnixGroups = new Set<number>()
const terminationTimers = new WeakMap<ChildProcess, ReturnType<typeof setTimeout>[]>()

// Finder and Linux desktop launchers often inherit a much smaller PATH than terminals.
export function runtimeEnvironment(source: NodeJS.ProcessEnv = process.env, platform = process.platform): NodeJS.ProcessEnv {
  const env = { ...source }
  const pathKeys = Object.keys(env).filter(key => key.toLowerCase() === 'path')
  const separator = platform === 'win32' ? ';' : ':'
  const paths = pathKeys.flatMap(key => (env[key] ?? '').split(separator)).filter(Boolean)
  for (const key of pathKeys) delete env[key]
  const home = (platform === 'win32' ? env.USERPROFILE : env.HOME) || homedir()
  const extra = platform === 'win32'
    ? [env.APPDATA && join(env.APPDATA, 'npm'), join(home, '.local', 'bin')]
    : [join(home, '.local', 'bin'), join(home, '.cargo', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']
  env.PATH = [...new Set([...paths, ...extra.filter((path): path is string => Boolean(path))])].join(separator)
  // Electron development flags must never change the behavior of external tools.
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ASAR
  return env
}

export function spawnManaged(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }): ChildProcessWithoutNullStreams {
  const env = runtimeEnvironment(options.env)
  // A script's sibling executables (including node) must remain discoverable after realpath.
  if (/[\\/]/.test(command)) env.PATH = `${dirname(command)}${process.platform === 'win32' ? ';' : ':'}${env.PATH}`
  const launch = resolveCommandLaunch(command, args)
  const child = spawn(launch.command, launch.args, { ...options, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] }) as ChildProcessWithoutNullStreams
  children.add(child)
  child.once('close', () => {
    children.delete(child)
    if (process.platform !== 'win32') setImmediate(() => clearFinishedUnixTermination(child))
  })
  child.once('error', () => { if (!child.pid) children.delete(child) })
  // Tools may close stdin before the prompt has finished writing (e.g. an auth error).
  child.stdin.on('error', () => {})
  return child
}

export function resolveCommandLaunch(command: string, args: string[]) {
  if (process.platform !== 'win32' || !/\.(cmd|bat)$/i.test(command)) return { command, args }
  // npm shims reparse %* in cmd.exe. Invoke their Node entry directly so prompts
  // keep their exact bytes, including newlines, quotes and shell metacharacters.
  const script = readFileSync(command, 'utf8')
  const entry = script.match(/(?:"%_prog%"|"[^"\r\n]*node(?:\.exe)?"|\bnode(?:\.exe)?)\s+"%(?:~dp0|dp0%)[\\/]?([^"\r\n]+)"\s+%\*/i)?.[1]
  if (entry) {
    const siblingNode = join(dirname(command), 'node.exe')
    const explicitNode = script.match(/"([^"\r\n]*[\\/]node\.exe)"\s+"%(?:~dp0|dp0%)/i)?.[1]
    return { command: existsSync(siblingNode) ? siblingNode : explicitNode && existsSync(explicitNode) ? explicitNode : 'node', args: [resolve(dirname(command), entry), ...args] }
  }
  if (args.some(arg => /[\r\n"%!^&|<>]/.test(arg))) throw new Error(t('This batch launcher cannot preserve these arguments. Configure its executable or Node entry point directly.'))
  return { command, args }
}

export function terminateProcessTree(child: ChildProcess, force = false) {
  if (!child.pid) { child.kill(); return }
  if (force && process.platform !== 'win32') {
    for (const timer of terminationTimers.get(child) ?? []) clearTimeout(timer)
    terminationTimers.delete(child)
    terminatingUnixGroups.delete(child.pid)
    signalUnixProcessGroup(child.pid, child, 'SIGKILL')
    return
  }
  if (terminating.has(child)) return
  terminating.add(child)
  if (process.platform === 'win32') {
    const taskkill = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe')
    const killer = spawn(taskkill, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    killer.once('error', () => child.kill())
    killer.once('exit', code => { if (code) child.kill() })
  } else {
    // Give Agent CLIs a chance to finish their current turn and persist session state.
    // Escalation still targets the whole process group, including descendants whose leader exited.
    const pid = child.pid
    terminatingUnixGroups.add(pid)
    signalUnixProcessGroup(pid, child, 'SIGINT')
    const timers = [
      setTimeout(() => signalUnixProcessGroup(pid, child, 'SIGTERM'), 1000),
      setTimeout(() => {
        signalUnixProcessGroup(pid, child, 'SIGKILL')
        terminatingUnixGroups.delete(pid)
        terminationTimers.delete(child)
      }, 3000)
    ]
    terminationTimers.set(child, timers)
  }
}

export function terminateManagedProcesses() {
  for (const child of children) terminateProcessTree(child, true)
  if (process.platform !== 'win32') {
    for (const pid of terminatingUnixGroups) signalUnixProcessGroup(pid, undefined, 'SIGKILL')
    terminatingUnixGroups.clear()
  }
}

function signalUnixProcessGroup(pid: number, child: ChildProcess | undefined, signal: NodeJS.Signals) {
  try { process.kill(-pid, signal) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') child?.kill(signal)
  }
}

function clearFinishedUnixTermination(child: ChildProcess) {
  if (!child.pid || !terminatingUnixGroups.has(child.pid)) return
  try { process.kill(-child.pid, 0) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return
    for (const timer of terminationTimers.get(child) ?? []) clearTimeout(timer)
    terminationTimers.delete(child)
    terminatingUnixGroups.delete(child.pid)
  }
}

export async function initializeRuntimeEnvironment() {
  if (process.platform !== 'win32') {
    const shell = process.env.SHELL || '/bin/sh'
    if (['bash', 'zsh', 'fish', 'sh'].includes(basename(shell))) {
      // Read only PATH; subscription credentials continue to use their isolated profiles.
      await new Promise<void>(resolve => {
        const child = spawnManaged(shell, [basename(shell) === 'sh' ? '-lc' : '-ilc', "/usr/bin/printf '\\0'; /usr/bin/printenv PATH"], { cwd: homedir() })
        let output = ''
        const timer = setTimeout(() => { terminateProcessTree(child); resolve() }, 3000)
        child.stdout.setEncoding('utf8')
        child.stdout.on('data', chunk => { output = `${output}${chunk}`.slice(-256_000) })
        child.once('error', () => { clearTimeout(timer); resolve() })
        child.once('close', code => {
          clearTimeout(timer)
          const path = output.includes('\0') ? output.split('\0').at(-1)?.replace(/\r?\n$/, '') : undefined
          if (code === 0 && path) process.env.PATH = path
          resolve()
        })
        child.stdin.end()
      })
    }
  }
  const env = runtimeEnvironment()
  for (const key of Object.keys(process.env)) if (key.toLowerCase() === 'path') delete process.env[key]
  process.env.PATH = env.PATH
}

export function terminalCommand(command: string, source: NodeJS.ProcessEnv, args: string[] = []) {
  const env = runtimeEnvironment(source)
  const launch = resolveCommandLaunch(command, args)
  if (launch.command !== command) return { ...launch, env }
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
    if (args.some(arg => !/^[A-Za-z0-9._-]+$/.test(arg))) {
      throw new Error(t('This batch launcher cannot preserve these arguments. Configure its executable or Node entry point directly.'))
    }
    // Expansion from an environment variable preserves spaces and metacharacters in the path.
    env.AGENTFLOW_TERMINAL_COMMAND = command
    const suffix = args.length ? ` ${args.join(' ')}` : ''
    return { command: env.ComSpec || join(env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe'), args: `/d /v:off /s /c ""%AGENTFLOW_TERMINAL_COMMAND%"${suffix}"`, env }
  }
  return { command, args, env }
}
