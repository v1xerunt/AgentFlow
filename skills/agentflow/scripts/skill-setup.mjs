import { lstat, mkdir, readFile, writeFile, chmod, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { isRevision, readBundle } from './bundle-tools.mjs'

function launcher(executable, platform) {
  if (/[\r\n\0]/.test(executable)) throw new Error('Invalid Node executable path.')
  if (platform === 'win32') return `@echo off\r\nsetlocal DisableDelayedExpansion\r\n"${executable.replaceAll('%', '%%')}" "%~dp0agentflow.mjs" %*\r\nexit /b %errorlevel%\r\n`
  const quoted = `'${executable.replaceAll("'", "'\\''")}'`
  return `#!/bin/sh\nexec ${quoted} "\${0%/*}/agentflow.mjs" "$@"\n`
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch (error) { if (error.code === 'ENOENT') return {}; throw error }
}

export async function setupSkill(root, { revision } = {}) {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (process.versions.electron || major < 22 || major === 22 && minor < 13) throw new Error('Use Node.js 22.13+ to configure this Skill.')
  if (revision !== undefined && !isRevision(revision)) throw new Error('Use a full Skill commit SHA.')
  const { manifest, files } = await readBundle(root)
  const directory = join(root, '.agentflow')
  await mkdir(directory, { recursive: true })
  const configuration = await readJson(join(directory, 'config.json'))
  const previous = await readJson(join(directory, 'installation.json'))
  const distribution = await readJson(join(root, '.distribution.json'))
  revision ||= previous.revision || distribution.revision
  if (!revision) {
    // Raw GitHub folder installs lack a release stamp. Identify them only when
    // the complete content manifest matches the directory on main.
    try {
      const signal = AbortSignal.timeout(2000)
      const response = await fetch('https://api.github.com/repos/v1xerunt/AgentFlow/commits?sha=main&path=skills%2Fagentflow&per_page=1', { signal })
      if (!response.ok) throw new Error('Revision lookup unavailable')
      const sha = (await response.json())?.[0]?.sha
      if (isRevision(sha)) {
        const remote = await fetch(`https://raw.githubusercontent.com/v1xerunt/AgentFlow/${sha}/skills/agentflow/bundle.json`, { signal })
        if (remote.ok && (await remote.text()) === files.get('bundle.json').toString()) revision = sha
      }
    } catch { /* An offline installation remains usable. */ }
  }
  await writeFile(join(directory, 'config.json'), JSON.stringify({ ...configuration, node: process.execPath }, null, 2), { mode: 0o600 })
  await writeFile(join(directory, 'installation.json'), JSON.stringify({ revision: isRevision(revision) ? revision : null, cliBuild: manifest.cli.sha256 }), { mode: 0o600 })
  const command = join(root, 'scripts', process.platform === 'win32' ? 'agentflow.cmd' : 'agentflow')
  await writeFile(command, launcher(process.execPath, process.platform))
  if (process.platform !== 'win32') await chmod(command, 0o755)
  return { command, node: process.execPath, revision: isRevision(revision) ? revision : null, cliBuild: manifest.cli.sha256 }
}

export async function installSkill({ source, host, project, user, revision, home = homedir() }) {
  if (!['codex', 'claude', 'both'].includes(host)) throw new Error('--host must be codex, claude, or both.')
  if (Boolean(user) === Boolean(project)) throw new Error('Choose exactly one of --project <directory> or --user.')
  const { files, manifest } = await readBundle(source, { includeLocal: true })
  const base = user ? home : resolve(project)
  const targets = (host === 'both' ? ['codex', 'claude'] : [host]).map(name => join(name === 'claude' && user && process.env.CLAUDE_CONFIG_DIR || join(base, name === 'codex' ? '.agents' : '.claude'), 'skills', 'agentflow'))
  for (const target of targets) if (await lstat(target).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error })) throw new Error(`Skill already exists; use its skill update command: ${target}`)
  const created = []
  try {
    for (const target of targets) {
      await mkdir(dirname(target), { recursive: true })
      await mkdir(target)
      created.push(target)
      for (const name of ['bundle.json', ...Object.keys(manifest.files), ...(files.has('.distribution.json') ? ['.distribution.json'] : [])]) {
        await mkdir(dirname(join(target, name)), { recursive: true })
        await writeFile(join(target, name), files.get(name), { flag: 'wx' })
      }
      await setupSkill(target, { revision })
    }
  } catch (error) {
    for (const target of created) await rm(target, { recursive: true, force: true })
    throw error
  }
  return { installed: targets, runtime: 'node', executable: process.execPath }
}
