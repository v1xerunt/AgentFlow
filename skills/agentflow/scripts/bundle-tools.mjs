import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export const sha256 = data => createHash('sha256').update(data).digest('hex')
export const gitBlobHash = data => createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
export const isRevision = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
export const isLocalFile = name => name === '.distribution.json' || name.startsWith('.agentflow/') || name === 'scripts/agentflow' || name === 'scripts/agentflow.cmd'

export function safeBundlePath(name) {
  if (typeof name !== 'string' || !name || name.length > 240 || /[\\:\0\r\n]/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..' || part === '.git')) throw new Error('Invalid Skill file path.')
  if (isLocalFile(name)) throw new Error('A Skill bundle cannot replace local configuration.')
  return name
}

export async function readFiles(root, prefix = '') {
  if (!(await lstat(root)).isDirectory() || (await lstat(root)).isSymbolicLink()) throw new Error('Skill files must use ordinary directories.')
  const files = new Map()
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isSymbolicLink()) throw new Error('Preserve or move linked files before updating this Skill.')
    if (entry.isDirectory()) for (const pair of await readFiles(join(root, entry.name), name)) files.set(...pair)
    else if (entry.isFile()) files.set(name, await readFile(join(root, entry.name)))
    else throw new Error('Unsupported Skill file type.')
  }
  return files
}

export function verifyFiles(files) {
  const manifest = JSON.parse(files.get('bundle.json')?.toString() || 'null')
  if (manifest?.format !== 1 || manifest.cli?.file !== 'scripts/agentflow-runtime.mjs' || !manifest.files || typeof manifest.files !== 'object') throw new Error('Invalid Skill bundle manifest.')
  const names = Object.keys(manifest.files)
  if (names.length < 3 || names.length > 200 || !names.includes('SKILL.md') || !names.includes(manifest.cli.file)) throw new Error('Incomplete Skill bundle.')
  for (const name of names) {
    safeBundlePath(name)
    if (name === 'bundle.json' || !/^[a-f0-9]{64}$/.test(manifest.files[name]) || !files.has(name) || sha256(files.get(name)) !== manifest.files[name]) throw new Error(`Skill file checksum mismatch: ${name}`)
  }
  if (manifest.cli.sha256 !== manifest.files[manifest.cli.file]) throw new Error('Skill and CLI build identifiers do not match.')
  return manifest
}

export async function readBundle(root, { includeLocal = false } = {}) {
  const bytes = await readFile(join(root, 'bundle.json'))
  const manifest = JSON.parse(bytes)
  const files = includeLocal ? await readFiles(root) : new Map([['bundle.json', bytes]])
  if (!includeLocal) for (const name of Object.keys(manifest.files || {})) {
    safeBundlePath(name)
    files.set(name, await readFile(join(root, name)))
  }
  return { files, manifest: verifyFiles(files) }
}
