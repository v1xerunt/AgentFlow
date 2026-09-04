const { readFileSync, appendFileSync } = require('node:fs')
const { resolve, join } = require('node:path')

const repository = resolve(__dirname, '..')
const workspaces = ['', 'apps/desktop', 'apps/cli', 'packages/core', 'packages/schema']
function releaseMetadata(root = repository, ref = process.env.GITHUB_REF || '') {
  const read = file => JSON.parse(readFileSync(join(root, file), 'utf8'))
  const { version } = read('package.json')
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version)) throw new Error('Invalid release version')
  const lock = read('package-lock.json')
  if (lock.version !== version) throw new Error('Root lockfile version does not match')
  for (const workspace of workspaces) {
    const manifest = read(join(workspace, 'package.json'))
    if (manifest.version !== version || lock.packages[workspace]?.version !== version) throw new Error(`Version mismatch: ${workspace || 'root'}`)
    if (manifest.license !== 'AGPL-3.0-only') throw new Error(`Missing project license: ${workspace || 'root'}`)
  }
  const tag = `v${version}`
  if (ref.startsWith('refs/tags/') && ref !== `refs/tags/${tag}`) throw new Error(`Release tag must be ${tag}; received ${ref}`)
  return { version, tag }
}

if (require.main === module) {
  const metadata = releaseMetadata()
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${metadata.version}\ntag=${metadata.tag}\n`)
  console.log(JSON.stringify(metadata))
}
module.exports = { releaseMetadata, repository, workspaces }
