import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mergeWorkspaceDirectories, resolveWorkspaceFile } from './workspace-files'

const temporaryRoots: string[] = []

async function createDirectories() {
  const root = await mkdtemp(join(tmpdir(), 'agentflow-workspace-merge-'))
  temporaryRoots.push(root)
  const source = join(root, 'source')
  const target = join(root, 'target')
  await Promise.all([mkdir(source), mkdir(target)])
  return { source, target }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('mergeWorkspaceDirectories', () => {
  it('resolves an existing output file inside the project', async () => {
    const { source } = await createDirectories()
    await mkdir(join(source, 'outputs'))
    await writeFile(join(source, 'outputs', 'answer.md'), '# Answer')
    expect(await resolveWorkspaceFile(source, 'outputs/answer.md')).toBe(join(source, 'outputs', 'answer.md'))
    expect(await resolveWorkspaceFile(source, '.\\outputs\\answer.md')).toBe(join(source, 'outputs', 'answer.md'))
  })

  it('prevents a merge from writing through a target symlink or into a nested workspace', async () => {
    const { source, target } = await createDirectories()
    await mkdir(join(source, 'linked'))
    await writeFile(join(source, 'linked', 'file.txt'), 'new')
    const outside = join(source, 'outside')
    await mkdir(outside)
    await symlink(outside, join(target, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(mergeWorkspaceDirectories(source, target, true)).rejects.toThrow('符号链接')
    await expect(readFile(join(outside, 'file.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(mergeWorkspaceDirectories(source, join(source, 'nested'), true)).rejects.toThrow()
  })

  it('rejects escaped paths, directories, missing files and junctions', async () => {
    const { source, target } = await createDirectories()
    for (const path of ['../target', '..\\target', '/absolute', 'C:\\outside.md', '\\\\server\\share', 'file:stream', '']) {
      await expect(resolveWorkspaceFile(source, path)).rejects.toThrow('当前项目')
    }
    await mkdir(join(source, 'folder'))
    await expect(resolveWorkspaceFile(source, 'folder')).rejects.toThrow('不是文件')
    await expect(resolveWorkspaceFile(source, 'missing.md')).rejects.toMatchObject({ code: 'ENOENT' })
    await writeFile(join(target, 'outside.md'), 'outside')
    await symlink(target, join(source, 'link'), 'junction')
    await expect(resolveWorkspaceFile(source, 'link/outside.md')).rejects.toThrow('符号链接')
  })

  it('copies no files when preflight finds a different-content path conflict', async () => {
    const { source, target } = await createDirectories()
    await writeFile(join(source, 'new.txt'), 'new file')
    await writeFile(join(source, 'shared.txt'), 'source version')
    await writeFile(join(target, 'shared.txt'), 'target version')

    const result = await mergeWorkspaceDirectories(source, target, false)

    expect(result).toEqual({ copiedFiles: 0, identicalFiles: 0, conflicts: ['shared.txt'] })
    await expect(readFile(join(target, 'new.txt'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(target, 'shared.txt'), 'utf8')).resolves.toBe('target version')
  })

  it('copies new files and overwrites conflicts only after explicit confirmation', async () => {
    const { source, target } = await createDirectories()
    await mkdir(join(source, 'nested'))
    await writeFile(join(source, 'nested', 'new.txt'), 'new file')
    await writeFile(join(source, 'shared.txt'), 'source version')
    await writeFile(join(target, 'shared.txt'), 'target version')

    const result = await mergeWorkspaceDirectories(source, target, true)

    expect(result).toEqual({ copiedFiles: 2, identicalFiles: 0, conflicts: [] })
    await expect(readFile(join(target, 'nested', 'new.txt'), 'utf8')).resolves.toBe('new file')
    await expect(readFile(join(target, 'shared.txt'), 'utf8')).resolves.toBe('source version')
  })

  it('skips identical files and excludes project metadata directories', async () => {
    const { source, target } = await createDirectories()
    await mkdir(join(source, '.agentflow'))
    await writeFile(join(source, '.agentflow', 'draft-state.json'), '{"draft":true}')
    await mkdir(join(source, '.flow'))
    await writeFile(join(source, '.flow', 'project.json'), '{"project":true}')
    await writeFile(join(source, 'same.txt'), 'same')
    await writeFile(join(target, 'same.txt'), 'same')

    const result = await mergeWorkspaceDirectories(source, target, false)

    expect(result).toEqual({ copiedFiles: 0, identicalFiles: 1, conflicts: [] })
    await expect(readFile(join(target, '.agentflow', 'draft-state.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(target, '.flow', 'project.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
