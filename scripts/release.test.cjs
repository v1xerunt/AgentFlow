const test = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve, dirname, basename } = require('node:path')
const { releaseMetadata, workspaces } = require('./release-metadata.cjs')
const { installerNames, updateAssetNames, checkAssets } = require('./package-release.cjs')
const { createHash } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const { stringify } = require('yaml')
const { assertDraft } = require('./publish-release.cjs')
function inspectBuilder(environment = {}) {
  return spawnSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./apps/desktop/electron-builder.config.cjs')))"], {
    cwd: resolve(__dirname, '..'), encoding: 'utf8', windowsHide: true,
    env: { ...process.env, AGENTFLOW_REQUIRE_SIGNING: '0', CSC_LINK: '', CSC_NAME: '', CSC_KEY_PASSWORD: '', APPLE_ID: '', APPLE_APP_SPECIFIC_PASSWORD: '', APPLE_TEAM_ID: '', ...environment }
  })
}
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
  for (const platform of ['win32', 'darwin', 'linux']) {
    const [metadata, ...blockmaps] = updateAssetNames('0.1.0', platform)
    for (const name of blockmaps) writeFileSync(join(root, name), 'blockmap')
    writeFileSync(join(root, metadata), stringify({ version: '0.1.0', files: installerNames('0.1.0', platform).map(url => ({ url, sha512: createHash('sha512').update('fixture').digest('base64'), size: 7 })) }))
  }
  assert.equal(checkAssets(root, '0.1.0').length, 13)
  const updateFile = join(root, 'latest.yml')
  const original = readFileSync(updateFile, 'utf8')
  writeFileSync(updateFile, original.replace('size: 7', 'size: 8'))
  assert.throws(() => checkAssets(root, '0.1.0'), /checksum or size/)
  writeFileSync(updateFile, original.replace('url: AgentFlow', 'url: https://other.example/AgentFlow'))
  assert.throws(() => checkAssets(root, '0.1.0'), /primary|URL/)
  writeFileSync(updateFile, original)
  writeFileSync(join(root, 'AgentFlow-0.0.9-win-x64.exe'), 'stale')
  assert.throws(() => checkAssets(root, '0.1.0'), /stale/)
}))

test('installer names describe the platform and match builder naming', () => {
  const result = inspectBuilder()
  assert.equal(result.status, 0, result.error?.message || result.stderr)
  const config = JSON.parse(result.stdout)
  const name = (template, ext) => template.replace('${version}', '0.1.0').replace('${ext}', ext)
  assert.equal(name(config.win.artifactName, 'exe'), installerNames('0.1.0', 'win32')[0])
  assert.equal(name(config.mac.artifactName, 'dmg'), installerNames('0.1.0', 'darwin')[0])
  assert.equal(config.publish.repo, 'AgentFlow')
})

test('signed packaging requires its platform signing credentials', () => {
  const result = inspectBuilder({ AGENTFLOW_REQUIRE_SIGNING: '1' })
  if (process.platform === 'linux') {
    assert.equal(result.status, 0, result.error?.message || result.stderr)
    assert.equal(JSON.parse(result.stdout).forceCodeSigning, false)
  } else {
    assert.equal(result.status, 1)
    assert.match(result.stderr, /A signing certificate \(CSC_LINK\) is required/)
    if (process.platform === 'darwin') {
      const notarization = inspectBuilder({ AGENTFLOW_REQUIRE_SIGNING: '1', CSC_LINK: 'test-certificate.p12' })
      assert.equal(notarization.status, 1)
      assert.match(notarization.stderr, /Apple notarization credentials are required/)
    }
  }
})
test('publication preserves published releases and drafts targeting another commit', () => {
  assertDraft({ draft: true, target_commitish: 'abc' }, 'abc')
  assert.throws(() => assertDraft({ draft: false, target_commitish: 'abc' }, 'abc'), /already published/)
  assert.throws(() => assertDraft({ draft: true, target_commitish: 'def' }, 'abc'), /different commit/)
})
