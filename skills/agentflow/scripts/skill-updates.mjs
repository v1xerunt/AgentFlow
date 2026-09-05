import { mkdir, readFile, writeFile, rename, rm, open } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { gitBlobHash, isRevision, readBundle, safeBundlePath, sha256, verifyFiles } from './bundle-tools.mjs'

const api = 'https://api.github.com/repos/v1xerunt/AgentFlow'
const commitUrl = `${api}/commits?sha=main&path=skills%2Fagentflow&per_page=1`
const prefix = 'skills/agentflow/'

async function jsonFile(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch (error) { if (error.code === 'ENOENT') return fallback; throw error }
}

async function request(url, { fetcher = fetch, timeout = 1500 } = {}) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(timeout), headers: { Accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(`Skill download failed (${response.status}).`)
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > 10_000_000) throw new Error('Skill response exceeds the size limit.')
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function latestRevision(options) {
  const commits = JSON.parse((await request(commitUrl, options)).toString())
  if (!isRevision(commits?.[0]?.sha)) throw new Error('Invalid Skill revision response.')
  return commits[0].sha
}

export async function checkForUpdate(root, task, options = {}) {
  if (typeof task !== 'string' || !task || task.length > 200) throw new Error('Use one task ID for this Skill task.')
  try {
    const tasks = join(root, '.agentflow', 'tasks')
    await mkdir(tasks, { recursive: true })
    // Exclusive creation deduplicates retries and concurrent checks for a task.
    const claim = await open(join(tasks, sha256(task)), 'wx', 0o600).catch(error => { if (error.code !== 'EEXIST') throw error })
    if (!claim) return null
    await claim.close()
    const installed = await jsonFile(join(root, '.agentflow', 'installation.json'), {})
    const revision = await latestRevision(options)
    if (revision === installed.revision) return null
    return { revision, message: `AgentFlow Skill 有更新。更新入口：当前 Skill 命令加 skill update --revision ${revision}` }
  } catch { return null }
}

async function downloadBundle(revision, options) {
  const tree = JSON.parse((await request(`${api}/git/trees/${revision}?recursive=1`, options)).toString())
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete Skill file listing.')
  const entries = tree.tree.filter(entry => entry.path?.startsWith(prefix) && entry.type !== 'tree')
  if (entries.length < 4 || entries.length > 201) throw new Error('Invalid Skill bundle size.')
  const files = new Map()
  let size = 0
  for (const entry of entries) {
    const name = safeBundlePath(entry.path.slice(prefix.length))
    if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode) || !isRevision(entry.sha)) throw new Error('Unsupported Skill file in repository.')
    size += entry.size
    if (!Number.isFinite(size) || size > 10_000_000 || files.has(name)) throw new Error('Invalid Skill file listing.')
    const url = `https://raw.githubusercontent.com/v1xerunt/AgentFlow/${revision}/${prefix}${name.split('/').map(encodeURIComponent).join('/')}`
    const bytes = await request(url, options)
    if (bytes.length !== entry.size || gitBlobHash(bytes) !== entry.sha) throw new Error(`Downloaded Skill file does not match the commit: ${name}`)
    files.set(name, bytes)
  }
  const manifest = verifyFiles(files)
  if (files.size !== Object.keys(manifest.files).length + 1) throw new Error('The Skill manifest does not cover every downloaded file.')
  return { files, manifest }
}

async function validateCli(root) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(root, 'scripts/agentflow.mjs'), 'host', 'validate', join(root, 'assets/review-flow.json')], {
      cwd: dirname(root), env: { ...process.env, INIT_CWD: dirname(root) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000
    })
    let out = '', err = ''
    child.stdout.on('data', chunk => { out += chunk; if (out.length > 100_000) child.kill() })
    child.stderr.on('data', chunk => { err += chunk; if (err.length > 100_000) child.kill() })
    child.once('error', reject)
    child.once('close', code => {
      try { if (code !== 0 || JSON.parse(out).valid !== true) throw new Error(err || 'Skill CLI validation failed.'); resolvePromise() } catch (error) { reject(error) }
    })
  })
}

async function performUpdate(root, { revision, ...options } = {}) {
  root = resolve(root)
  if (revision !== undefined && !isRevision(revision)) throw new Error('Use a full Skill commit SHA.')
  const current = await readBundle(root, { includeLocal: true })
  revision ||= await latestRevision(options)
  const incoming = await downloadBundle(revision, { ...options, timeout: options.timeout || 15_000 })
  const staged = join(dirname(root), `.agentflow-update-${randomUUID()}`)
  const backup = join(dirname(root), `.agentflow-previous-${randomUUID()}`)
  await mkdir(staged)
  try {
    // Keep settings, recorded runtime, task checks, and additional user files.
    for (const [name, bytes] of current.files) {
      if (name === 'bundle.json' || name === '.distribution.json' || Object.hasOwn(current.manifest.files, name)) continue
      if (incoming.files.has(name)) throw new Error(`The update conflicts with a user file: ${name}`)
      incoming.files.set(name, bytes)
    }
    for (const [name, bytes] of incoming.files) {
      const file = join(staged, name)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, bytes, { mode: name === 'scripts/agentflow' ? 0o755 : 0o600 })
    }
    await mkdir(join(staged, '.agentflow'), { recursive: true })
    await writeFile(join(staged, '.agentflow', 'installation.json'), JSON.stringify({ revision, cliBuild: incoming.manifest.cli.sha256 }))
    await validateCli(staged)
    // The only directories replaced are this Skill and its sibling staging paths.
    await rename(root, backup)
    try { await rename(staged, root) } catch (error) { await rename(backup, root); throw error }
    await rm(backup, { recursive: true })
    return { revision, cliBuild: incoming.manifest.cli.sha256 }
  } finally { await rm(staged, { recursive: true, force: true }) }
}

export async function updateSkill(root, options = {}) {
  const file = `${resolve(root)}.update-lock`
  const lock = await open(file, 'wx', 0o600).catch(error => {
    if (error.code === 'EEXIST') throw new Error(`A Skill update is already running. If it was interrupted, verify the recorded process has exited before removing ${file}.`)
    throw error
  })
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }))
    return await performUpdate(root, options)
  } finally { await lock.close(); await rm(file, { force: true }) }
}

export async function skillStatus(root) {
  const { manifest } = await readBundle(root)
  return { ...(await jsonFile(join(root, '.agentflow', 'installation.json'), { revision: null })), cliBuild: manifest.cli.sha256 }
}

export const skillRoot = fileURLToPath(new URL('../', import.meta.url))
