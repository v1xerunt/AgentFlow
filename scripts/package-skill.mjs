import { lstat, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readBundle } from '../skills/agentflow/scripts/bundle-tools.mjs'

const root = new URL('../', import.meta.url)
execFileSync(process.execPath, [fileURLToPath(new URL('scripts/sync-skill-runtime.mjs', root)), '--check'], { stdio: 'inherit' })
const output = new URL('dist/skills/agentflow/', root)
// This fixed generated directory is the only deletion target; never merge old package contents.
const previous = await lstat(output).catch(error => { if (error.code !== 'ENOENT') throw error })
if (previous?.isSymbolicLink()) throw new Error('Refusing to replace a linked skill build directory.')
if (previous) {
  const actual = resolve(await realpath(output))
  const expected = resolve(fileURLToPath(output))
  if ((process.platform === 'win32' ? actual.toLowerCase() : actual) !== (process.platform === 'win32' ? expected.toLowerCase() : expected)) throw new Error('Skill build directory resolves outside its fixed output location.')
  await rm(output, { recursive: true })
}
await mkdir(output, { recursive: true })
const { files } = await readBundle(fileURLToPath(new URL('skills/agentflow/', root)))
for (const [name, bytes] of files) {
  const target = join(fileURLToPath(output), name)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, bytes)
}
const git = args => execFileSync('git', args, { cwd: fileURLToPath(root), encoding: 'utf8', windowsHide: true }).trim()
const revision = git(['status', '--porcelain', '--', 'skills/agentflow']) ? null : git(['log', '-1', '--format=%H', '--', 'skills/agentflow'])
await writeFile(new URL('.distribution.json', output), JSON.stringify({ revision }))
console.log(`Standalone skill: ${fileURLToPath(output)}`)
