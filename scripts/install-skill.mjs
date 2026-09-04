import { cp, lstat, mkdir, access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

const { values } = parseArgs({ options: { host: { type: 'string', default: 'both' }, project: { type: 'string' }, user: { type: 'boolean' }, help: { type: 'boolean' } } })
if (values.help) {
  console.log('node scripts/install-skill.mjs --host codex|claude|both --project <directory>\nnode scripts/install-skill.mjs --host codex|claude|both --user\nRequires npm run skill:build. Existing skills are preserved; choose an empty destination.')
} else {
  try {
    if (!['codex', 'claude', 'both'].includes(values.host)) throw new Error('--host must be codex, claude, or both.')
    if (Boolean(values.user) === Boolean(values.project)) throw new Error('Choose exactly one of --project <directory> or --user.')
    const source = fileURLToPath(new URL('../dist/skills/agentflow/', import.meta.url))
    await access(join(source, 'scripts', 'agentflow-runtime.mjs')).catch(() => { throw new Error('Build the standalone skill first: npm run skill:build') })
    const base = values.user ? homedir() : resolve(values.project)
    const hosts = values.host === 'both' ? ['codex', 'claude'] : [values.host]
    const targets = hosts.map(host => join(base, host === 'codex' ? '.agents' : '.claude', 'skills', 'agentflow'))
    for (const target of targets) {
      const exists = await lstat(target).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error })
      if (exists) throw new Error(`Skill already exists; preserve or move it before installing: ${target}`)
    }
    for (const target of targets) {
      await mkdir(dirname(target), { recursive: true })
      await mkdir(target)
      await cp(source, target, { recursive: true, force: false, errorOnExist: true })
      console.log(`Installed: ${target}`)
    }
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
