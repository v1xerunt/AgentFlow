import { cp, copyFile, lstat, mkdir, realpath, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
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
await cp(new URL('skills/agentflow/', root), output, { recursive: true })
await copyFile(new URL('apps/cli/dist/index.js', root), new URL('scripts/agentflow-runtime.mjs', output))
await cp(new URL('apps/cli/dist/licenses/', root), new URL('licenses/', output), { recursive: true })
for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) await copyFile(new URL(name, root), new URL(name, output))
console.log(`Standalone skill: ${fileURLToPath(output)}`)
