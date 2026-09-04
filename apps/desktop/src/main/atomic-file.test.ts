import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { atomicWriteFile } from './atomic-file'

it('replaces Unicode files atomically and leaves no temporary files after concurrent writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentflow-save-'))
  try {
    const target = join(root, '设置.json')
    await atomicWriteFile(target, '{}')
    await Promise.all(Array.from({ length: 12 }, (_, id) => atomicWriteFile(target, JSON.stringify({ id, content: '内容'.repeat(1000) }))))
    expect(JSON.parse(await readFile(target, 'utf8')).content).toBe('内容'.repeat(1000))
    expect(JSON.parse(await readFile(target, 'utf8')).id).toBe(11)
    expect(await readdir(root)).toEqual(['设置.json'])
  } finally { await rm(root, { recursive: true, force: true }) }
})
