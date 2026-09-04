import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runtimeEnvironment, spawnManaged, terminalCommand, terminateProcessTree } from './platform-process'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function directory() { const path = await mkdtemp(join(tmpdir(), 'agentflow 进程 & ')); roots.push(path); return path }
function capture(command: string, args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawnManaged(command, args, { cwd })
    let stdout = '', stderr = ''
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
    child.stdout.on('data', text => { stdout += text }); child.stderr.on('data', text => { stderr += text })
    child.once('error', reject)
    child.once('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr)))
    child.stdin.end()
  })
}

describe('platform processes', () => {
  it('keeps one PATH on Windows and supplies GUI launch paths on Unix', () => {
    const env = runtimeEnvironment({ Path: 'one', PATH: 'two', ELECTRON_RUN_AS_NODE: '1' }, 'win32')
    expect(Object.keys(env).filter(key => key.toLowerCase() === 'path')).toEqual(['PATH'])
    expect(env.PATH).toContain('one;two')
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(runtimeEnvironment({ PATH: '/custom' }, 'darwin').PATH).toContain('/opt/homebrew/bin')
  })

  it('preserves Unicode, spaces, newlines and shell characters in executable arguments', async () => {
    const args = ['中文 with spaces', '"quotes" & | < > %PATH% ! ^', 'line1\nline2', 'trailing\\']
    const stdout = await capture(process.execPath, ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))', ...args], await directory())
    expect(JSON.parse(stdout)).toEqual(args)
  })

  it.runIf(process.platform === 'win32')('runs npm-style cmd shims from a Unicode directory with spaces', async () => {
    const cwd = await directory()
    const script = join(cwd, 'echo.cjs')
    const command = join(cwd, 'tool.cmd')
    await writeFile(script, 'console.log(JSON.stringify(process.argv.slice(2)))')
    await writeFile(command, `@echo off\r\n"${process.execPath}" "%~dp0echo.cjs" %*\r\n`)
    const args = ['中文 with spaces', 'quote" & echo BAD', '%PATH% ! | >', 'line1\nline2', 'trailing\\']
    expect(JSON.parse(await capture(command, args, cwd))).toEqual(args)
  })

  it.runIf(process.platform === 'win32')('opens a batch login terminal in a path with spaces', async () => {
    const cwd = await directory()
    const command = join(cwd, 'login.cmd')
    await writeFile(command, '@echo off\r\necho TERMINAL_LAUNCH_OK\r\n')
    const launch = terminalCommand(command, process.env)
    const pty = await import('node-pty')
    const terminal = pty.spawn(launch.command, launch.args, { cwd, env: Object.fromEntries(Object.entries(launch.env).filter((entry): entry is [string, string] => entry[1] !== undefined)) })
    try {
      const output = await new Promise<string>((resolve, reject) => {
        let text = ''
        terminal.onData(chunk => { text += chunk })
        terminal.onExit(({ exitCode }) => exitCode === 0 ? resolve(text) : reject(new Error(text)))
      })
      expect(output).toContain('TERMINAL_LAUNCH_OK')
    } finally { terminal.kill() }
  })

  it('terminates a child and its background descendant', async () => {
    const cwd = await directory()
    const pidFile = join(cwd, 'descendant.pid')
    const source = `const {spawn}=require('node:child_process'); const fs=require('node:fs'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});fs.writeFileSync(process.argv[1],String(child.pid));setInterval(()=>{},1000)`
    const child = spawnManaged(process.execPath, ['-e', source, pidFile], { cwd })
    const closed = new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('close', () => resolve()) })
    try {
      await expect.poll(() => readFile(pidFile, 'utf8').catch(() => ''), { timeout: 5000 }).not.toBe('')
      const pid = Number(await readFile(pidFile, 'utf8'))
      terminateProcessTree(child)
      await closed
      await expect.poll(() => { try { process.kill(pid, 0); return true } catch { return false } }, { timeout: 5000 }).toBe(false)
    } finally { terminateProcessTree(child) }
  }, 15_000)
})
