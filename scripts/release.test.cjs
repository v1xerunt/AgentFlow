const test = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve, dirname, basename } = require('node:path')
const { releaseMetadata, workspaces } = require('./release-metadata.cjs')
const { installerNames, checkAssets } = require('./package-release.cjs')
const { assertDraft } = require('./publish-release.cjs')
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'agentflow-release-test-'))
  try { run(root) } finally { if (dirname(root) === resolve(tmpdir()) && basename(root).startsWith('agentflow-release-test-')) rmSync(root, { recursive: true, force: true }) }
}
function manifests(root) {
  const packages = {}
  for (const workspace of workspaces) {
    mkdirSync(join(root, workspace), { recursive: true })
    packages[workspace] = { version: '0.1.0', license: 'AGPL-3.0-only' }
    writeFileSync(join(root, workspace, 'package.json'), JSON.stringify(packages[workspace]))
  }
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '0.1.0', packages }))
}
test('release versions must agree across the tag, workspaces and lockfile', () => fixture(root => {
  manifests(root)
  assert.equal(releaseMetadata(root, 'refs/tags/v0.1.0').tag, 'v0.1.0')
  assert.throws(() => releaseMetadata(root, 'refs/tags/v0.2.0'), /tag/)
  const file = join(root, 'apps/cli/package.json')
  writeFileSync(file, readFileSync(file, 'utf8').replace('0.1.0', '0.2.0'))
  assert.throws(() => releaseMetadata(root, ''), /Version mismatch/)
}))
test('release assets must include every platform and corresponding source without stale binaries', () => fixture(root => {
  const files = [...['win32', 'darwin', 'linux'].flatMap(platform => installerNames('0.1.0', platform)), ...['cli', 'skill', 'source'].map(part => `AgentFlow-0.1.0-${part}.tar.gz`)]
  for (const file of files.slice(1)) writeFileSync(join(root, file), 'fixture')
  assert.throws(() => checkAssets(root, '0.1.0'))
  writeFileSync(join(root, files[0]), 'fixture')
  assert.equal(checkAssets(root, '0.1.0').length, 8)
  writeFileSync(join(root, 'AgentFlow-0.0.9-win-x64.exe'), 'stale')
  assert.throws(() => checkAssets(root, '0.1.0'), /stale/)
}))
test('publication preserves published releases and drafts targeting another commit', () => {
  assertDraft({ draft: true, target_commitish: 'abc' }, 'abc')
  assert.throws(() => assertDraft({ draft: false, target_commitish: 'abc' }, 'abc'), /already published/)
  assert.throws(() => assertDraft({ draft: true, target_commitish: 'def' }, 'abc'), /different commit/)
})
