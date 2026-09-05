import { cp, readFile, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative, isAbsolute } from 'node:path'
import { readFiles, sha256, isLocalFile, verifyFiles } from '../skills/agentflow/scripts/bundle-tools.mjs'

const repository = fileURLToPath(new URL('../', import.meta.url))
const skill = join(repository, 'skills/agentflow')
const check = process.argv.includes('--check')
const compiled = await readFile(join(repository, 'apps/cli/dist/index.js'))
if (!check) {
  await writeFile(join(skill, 'scripts/agentflow-runtime.mjs'), compiled)
  const licenses = join(skill, 'licenses')
  const local = relative(skill, licenses)
  if (local !== 'licenses' || isAbsolute(local)) throw new Error('Invalid Skill licenses path')
  await rm(licenses, { recursive: true, force: true })
  await cp(join(repository, 'apps/cli/dist/licenses'), join(skill, 'licenses'), { recursive: true })
  for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) await cp(join(repository, name), join(skill, name))
}
const files = await readFiles(skill)
if (!files.get('scripts/agentflow-runtime.mjs')?.equals(compiled)) throw new Error('The committed Skill CLI is stale. Run npm run skill:sync and include its changes.')
const managed = [...files].filter(([name]) => name !== 'bundle.json' && !isLocalFile(name)).sort(([a], [b]) => a.localeCompare(b, 'en'))
// Git stores these text resources with LF; use the same bytes on every host.
for (const [name, bytes] of managed) {
  const text = /\.(?:md|mjs|js|json|ya?ml|txt)$/.test(name) || /(?:^|\/)(?:LICENSE|NOTICE)$/.test(name)
  const normalized = text ? Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n')) : bytes
  if (!bytes.equals(normalized) && !check) await writeFile(join(skill, name), normalized)
  files.set(name, normalized)
}
const hashes = Object.fromEntries(managed.map(([name]) => [name, sha256(files.get(name))]))
const manifest = { format: 1, cli: { file: 'scripts/agentflow-runtime.mjs', sha256: hashes['scripts/agentflow-runtime.mjs'] }, files: hashes }
const serialized = `${JSON.stringify(manifest, null, 2)}\n`
if (check) {
  if (files.get('bundle.json')?.toString().replaceAll('\r\n', '\n') !== serialized) throw new Error('Skill contents changed. Run npm run skill:sync and commit the updated bundle manifest.')
  verifyFiles(files)
} else await writeFile(join(skill, 'bundle.json'), serialized)
console.log(check ? 'Skill source, compiled CLI and manifest agree.' : 'Updated the self-contained Skill and its CLI build manifest.')
