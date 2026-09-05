import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { checkForUpdate, updateSkill, skillStatus } from '../skills/agentflow/scripts/skill-updates.mjs'
import { setupSkill } from '../skills/agentflow/scripts/skill-setup.mjs'
import { readBundle, sha256, gitBlobHash } from '../skills/agentflow/scripts/bundle-tools.mjs'

const run = promisify(execFile)
const oldRevision = 'a'.repeat(40)
const newRevision = 'b'.repeat(40)

async function installed(t) {
  const parent = await mkdtemp(join(tmpdir(), 'agentflow-skill-update-'))
  t.after(() => rm(parent, { recursive: true, force: true }))
  const root = join(parent, 'Skill with spaces 空格')
  await cp(resolve('skills/agentflow'), root, { recursive: true })
  await setupSkill(root, { revision: oldRevision })
  return root
}

function rewriteManifest(files) {
  const manifest = JSON.parse(files.get('bundle.json'))
  manifest.files = Object.fromEntries([...files].filter(([name]) => name !== 'bundle.json').map(([name, bytes]) => [name, sha256(bytes)]))
  manifest.cli.sha256 = manifest.files[manifest.cli.file]
  files.set('bundle.json', Buffer.from(JSON.stringify(manifest)))
  return files
}

async function newer(root) {
  const { files } = await readBundle(root)
  files.set('SKILL.md', Buffer.concat([files.get('SKILL.md'), Buffer.from('\nUpdated Skill fixture.\n')]))
  files.set('scripts/agentflow-runtime.mjs', Buffer.concat([files.get('scripts/agentflow-runtime.mjs'), Buffer.from('\n// Updated paired CLI fixture.\n')]))
  return rewriteManifest(files)
}

function remote(files, revision = newRevision) {
  const requests = []
  const fetcher = async url => {
    requests.push(url)
    const parsed = new URL(url)
    if (parsed.pathname.endsWith('/commits')) {
      assert.equal(parsed.searchParams.get('sha'), 'main')
      assert.equal(parsed.searchParams.get('path'), 'skills/agentflow')
      assert.equal(parsed.searchParams.get('per_page'), '1')
      return Response.json([{ sha: revision, irrelevant: 'API response stays inside the script' }])
    }
    if (parsed.pathname.includes('/git/trees/')) return Response.json({ tree: [...files].map(([name, bytes]) => ({ path: `skills/agentflow/${name}`, type: 'blob', mode: '100644', size: bytes.length, sha: gitBlobHash(bytes) })) })
    const name = decodeURIComponent(parsed.pathname.split('/skills/agentflow/')[1])
    return new Response(files.get(name), { status: files.has(name) ? 200 : 404 })
  }
  return { fetcher, requests }
}

test('one directory-scoped request per task; unchanged revisions stay silent', async t => {
  const root = await installed(t)
  const mock = remote((await readBundle(root)).files, oldRevision)
  assert.equal(await checkForUpdate(root, 'same-task', mock), null)
  assert.equal(await checkForUpdate(root, 'same-task', mock), null)
  assert.equal(mock.requests.length, 1)
  const result = await run(process.execPath, [join(root, 'scripts/agentflow.mjs'), 'skill', 'check-update', '--task', 'same-task'])
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
  await checkForUpdate(root, 'next-task', mock)
  assert.equal(mock.requests.length, 2)
})

test('a newer revision returns only a notice and pinned update entry', async t => {
  const root = await installed(t)
  const mock = remote(await newer(root))
  const result = await checkForUpdate(root, 'new-version', mock)
  assert.equal(result.revision, newRevision)
  assert.match(result.message, /AgentFlow Skill 有更新/)
  assert.ok(result.message.includes(`skill update --revision ${newRevision}`))
  assert.ok(!result.message.includes('irrelevant'))
  assert.equal(await checkForUpdate(root, 'new-version', mock), null)
})

test('offline, rate-limited and timed-out checks preserve local operation', async t => {
  const root = await installed(t)
  assert.equal(await checkForUpdate(root, 'offline', { fetcher: async () => { throw new Error('offline') } }), null)
  assert.equal(await checkForUpdate(root, 'limited', { fetcher: async () => new Response('', { status: 403 }) }), null)
  const fetcher = (_url, { signal }) => new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => resolvePromise(Response.json([])), 1000)
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  })
  assert.equal(await checkForUpdate(root, 'timeout', { fetcher, timeout: 15 }), null)
  const result = await run(process.execPath, [join(root, 'scripts/agentflow.mjs'), 'host', 'validate', join(root, 'assets/review-flow.json')])
  assert.equal(JSON.parse(result.stdout).valid, true)
})

test('updating replaces Skill and paired CLI together while retaining configuration', async t => {
  const root = await installed(t)
  const config = { node: process.execPath, userSetting: { preferredStyle: 'concise' } }
  await writeFile(join(root, '.agentflow/config.json'), JSON.stringify(config))
  await mkdir(join(root, 'user-notes'))
  await writeFile(join(root, 'user-notes/notes.txt'), 'User notes')
  const launcher = join(root, 'scripts', process.platform === 'win32' ? 'agentflow.cmd' : 'agentflow')
  const previousLauncher = await readFile(launcher)
  const files = await newer(root)
  const result = await updateSkill(root, { revision: newRevision, ...remote(files) })
  assert.equal(result.revision, newRevision)
  assert.deepEqual(await readFile(join(root, 'scripts/agentflow-runtime.mjs')), files.get('scripts/agentflow-runtime.mjs'))
  assert.deepEqual(JSON.parse(await readFile(join(root, '.agentflow/config.json'))), config)
  assert.equal(await readFile(join(root, 'user-notes/notes.txt'), 'utf8'), 'User notes')
  assert.deepEqual(await readFile(launcher), previousLauncher)
  assert.equal((await skillStatus(root)).cliBuild, sha256(files.get('scripts/agentflow-runtime.mjs')))
})

test('a corrupted download and a broken new CLI leave the installed version intact', async t => {
  const root = await installed(t)
  const before = await readFile(join(root, 'bundle.json'))
  const files = await newer(root)
  const mock = remote(files)
  await assert.rejects(updateSkill(root, { revision: newRevision, fetcher: url => url.endsWith('/SKILL.md') ? Promise.resolve(new Response('corrupt')) : mock.fetcher(url) }), /does not match/)
  files.set('scripts/agentflow-runtime.mjs', Buffer.from('throw new Error("broken CLI fixture")'))
  rewriteManifest(files)
  await assert.rejects(updateSkill(root, { revision: newRevision, ...remote(files) }), /broken CLI fixture/)
  assert.deepEqual(await readFile(join(root, 'bundle.json')), before)
  assert.equal((await skillStatus(root)).revision, oldRevision)
})

test('updates preserve edited files by refusing to overwrite them', async t => {
  const root = await installed(t)
  const files = await newer(root)
  await writeFile(join(root, 'SKILL.md'), 'User-edited instructions')
  await assert.rejects(updateSkill(root, { revision: newRevision, ...remote(files) }), /checksum mismatch/)
  assert.equal(await readFile(join(root, 'SKILL.md'), 'utf8'), 'User-edited instructions')
})

test('repository files cannot overwrite local configuration', async t => {
  const root = await installed(t)
  const files = await newer(root)
  files.set('.agentflow/config.json', Buffer.from('malicious configuration fixture'))
  rewriteManifest(files)
  await assert.rejects(updateSkill(root, { revision: newRevision, ...remote(files) }), /local configuration/)
  assert.equal((await skillStatus(root)).revision, oldRevision)
})
