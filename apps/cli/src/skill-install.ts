import { cp, access, lstat, mkdir, readdir, readFile, writeFile, chmod, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Command } from 'commander'

// Resolve inside the running app each time, including an AppImage's new mount.
const bootstrap = "const p=require('node:path');const f=p.join(p.dirname(process.execPath),process.platform==='darwin'?'../Resources':'resources','agentflow/cli/index.js');process.argv.splice(1,0,f);import(require('node:url').pathToFileURL(f).href).catch(e=>{console.error(e);process.exitCode=1})"

export function skillLauncher(executable: string, platform: NodeJS.Platform, runtime: 'desktop' | 'node' = 'desktop') {
  if (/[\r\n\0]/.test(executable)) throw new Error('Invalid application path.')
  if (platform === 'win32') {
    const path = executable.replaceAll('%', '%%')
    const invocation = runtime === 'desktop' ? `set "ELECTRON_RUN_AS_NODE=1"\r\n"${path}" --eval "${bootstrap}" -- %*` : `"${path}" "%~dp0agentflow-runtime.mjs" %*`
    return `@echo off\r\nsetlocal DisableDelayedExpansion\r\nif not exist "${path}" (\r\n  echo AgentFlow runtime not found. Reinstall the Skill using an available runtime. 1>&2\r\n  exit /b 127\r\n)\r\n${invocation}\r\nexit /b %errorlevel%\r\n`
  }
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  const invocation = runtime === 'desktop' ? `export ELECTRON_RUN_AS_NODE=1\nexec ${quote(executable)} --eval ${quote(bootstrap)} -- "$@"` : `exec ${quote(executable)} "\${0%/*}/agentflow-runtime.mjs" "$@"`
  return `#!/bin/sh\nif [ ! -x ${quote(executable)} ]; then\n  echo 'AgentFlow runtime not found. Reinstall the Skill using an available runtime.' >&2\n  exit 127\nfi\n${invocation}\n`
}

export async function installSkill(options: {
  source: string; host: string; project?: string; user?: boolean; home?: string; claudeHome?: string
  executable?: string; platform?: NodeJS.Platform; runtime?: 'desktop' | 'node'
}) {
  if (!['codex', 'claude', 'both'].includes(options.host)) throw new Error('--host must be codex, claude, or both.')
  if (Boolean(options.user) === Boolean(options.project)) throw new Error('Choose exactly one of --project <directory> or --user.')
  await access(join(options.source, 'SKILL.md'))
  await access(join(options.source, 'scripts', 'agentflow-runtime.mjs'))
  const base = options.user ? options.home || homedir() : resolve(options.project!)
  const hosts = options.host === 'both' ? ['codex', 'claude'] : [options.host]
  const targets = hosts.map(host => join(host === 'claude' && options.user && options.claudeHome
    ? options.claudeHome : join(base, host === 'codex' ? '.agents' : '.claude'), 'skills', 'agentflow'))
  for (const target of targets) {
    const exists = await lstat(target).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error })
    if (exists) throw new Error(`Skill already exists; preserve or move it before installing: ${target}`)
  }
  const created: string[] = []
  try {
    for (const target of targets) {
      await mkdir(dirname(target), { recursive: true })
      await mkdir(target)
      created.push(target)
      for (const name of await readdir(options.source)) await cp(join(options.source, name), join(target, name), {
        recursive: true, force: false, errorOnExist: true, dereference: false,
        filter: source => !/[\\/]scripts[\\/]agentflow(?:\.cmd)?$/.test(source)
      })
      if (options.executable) {
        const platform = options.platform || process.platform
        const file = join(target, 'scripts', platform === 'win32' ? 'agentflow.cmd' : 'agentflow')
        await writeFile(file, skillLauncher(options.executable, platform, options.runtime), { flag: 'wx' })
        if (platform !== 'win32') await chmod(file, 0o755)
      }
    }
  } catch (error) {
    // Only directories exclusively created by this installation are removed.
    for (const target of created) await rm(target, { recursive: true, force: true })
    throw error
  }
  return { installed: targets, runtime: options.runtime || 'node', executable: options.executable }
}

export function registerSkillCommands(program: Command) {
  program.command('skill').description('Install the bundled AgentFlow Skill').command('install')
    .requiredOption('--host <host>', 'codex, claude, or both')
    .option('--project <directory>', 'install for one project')
    .option('--user', 'install for the current user')
    .action(async (options: { host: string; project?: string; user?: boolean }) => {
      try {
        const candidates = [new URL('../skill/', import.meta.url), new URL('../../../dist/skills/agentflow/', import.meta.url), new URL('../', import.meta.url)]
        let source: string | undefined
        for (const candidate of candidates) {
          if (await readFile(new URL('SKILL.md', candidate)).then(() => true, () => false)) { source = fileURLToPath(candidate); break }
        }
        if (!source) throw new Error('The complete Skill bundle is missing. Use the installed desktop CLI, or run npm run skill:build in the source checkout.')
        const runtime = process.versions.electron ? 'desktop' : 'node'
        const executable = runtime === 'desktop' && process.platform === 'linux' && process.env.APPIMAGE || process.execPath
        const result = await installSkill({ ...options, source, executable, runtime, claudeHome: process.env.CLAUDE_CONFIG_DIR })
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      } catch (error) {
        process.stderr.write(`${JSON.stringify({ error: String(error) })}\n`)
        process.exitCode = 1
      }
    })
}
