const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { execFileSync } = require('node:child_process')
const { releaseMetadata, repository } = require('./release-metadata.cjs')
const { checkAssets } = require('./package-release.cjs')

function assertDraft(release, commit) {
  if (!release.draft) throw new Error('The release is already published; it will not be changed')
  if (release.target_commitish !== commit) throw new Error('Existing draft targets a different commit')
}

async function publishDraft() {
  const { version, tag } = releaseMetadata()
  if (process.env.GITHUB_REF !== `refs/tags/${tag}`) throw new Error('A release draft requires a matching version tag')
  const repo = process.env.GITHUB_REPOSITORY
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8', windowsHide: true }).trim()
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Missing GitHub release context')
  const directory = join(repository, 'dist/release')
  const assets = checkAssets(directory, version)
  const info = JSON.parse(readFileSync(join(directory, 'BUILD_INFO.json'), 'utf8'))
  if (info.commit !== commit || info.version !== version) throw new Error('Release assets belong to another commit')
  const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  const endpoint = `https://api.github.com/repos/${repo}/releases`
  let response = await fetch(`${endpoint}/tags/${tag}`, { headers })
  let release
  if (response.status === 404) {
    response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ tag_name: tag, target_commitish: commit, name: `AgentFlow ${version}`, draft: true, prerelease: version.includes('-'), body: readFileSync(join(directory, 'RELEASE_NOTES.md'), 'utf8') }) })
    if (!response.ok) throw new Error(`Cannot create release draft: HTTP ${response.status}`)
    release = await response.json()
  } else {
    if (!response.ok) throw new Error(`Cannot read release: HTTP ${response.status}`)
    release = await response.json()
    assertDraft(release, commit)
    response = await fetch(`${endpoint}/${release.id}`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body: readFileSync(join(directory, 'RELEASE_NOTES.md'), 'utf8') }) })
    if (!response.ok) throw new Error(`Cannot update release draft notes: HTTP ${response.status}`)
  }
  assertDraft(release, commit)
  execFileSync('gh', ['release', 'upload', tag, ...[...assets, 'SHA256SUMS.txt', 'BUILD_INFO.json'].map(file => join(directory, file)), '--repo', repo, '--clobber'], { stdio: 'inherit', windowsHide: true })
  console.log(`Release draft ready: ${release.html_url}`)
}
if (require.main === module) publishDraft().catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { assertDraft }
