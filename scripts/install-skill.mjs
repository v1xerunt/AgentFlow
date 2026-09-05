import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

const { values } = parseArgs({ options: { host: { type: 'string', default: 'both' }, project: { type: 'string' }, user: { type: 'boolean' }, help: { type: 'boolean' } } })
if (values.help) {
  console.log('node scripts/install-skill.mjs --host codex|claude|both --project <directory>\nnode scripts/install-skill.mjs --host codex|claude|both --user\nRequires npm run skill:build. Existing skills are preserved; choose an empty destination.')
} else {
  const args = ['skill', 'install', '--host', values.host]
  if (values.project) args.push('--project', values.project)
  if (values.user) args.push('--user')
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../apps/cli/dist/index.js', import.meta.url)), ...args], { stdio: 'inherit', windowsHide: true })
  if (result.error) console.error(result.error.message)
  process.exitCode = result.status ?? 1
}
