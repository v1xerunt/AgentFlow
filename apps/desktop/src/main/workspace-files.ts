import { t } from '@agentflow/core/localization'
import { copyFile, mkdir, readFile, readdir, realpath, stat } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import type { WorkspaceMergeResult } from '../shared/workspace'
import { isWithinDirectory, resolveWorkspaceTarget } from './workspace-paths'

export async function resolveWorkspaceFile(root: string, relativePath: string) {
  const target = await resolveWorkspaceTarget(root, relativePath)
  if (!(await stat(target)).isFile()) throw new Error(t("The output file does not exist or is not a file."))
  return target
}

async function collectWorkspaceFiles(root: string, relativePath = ''): Promise<string[]> {
  let entries
  try {
    entries = await readdir(join(root, relativePath), { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const files: string[] = []
  for (const entry of entries) {
    if (!relativePath && (entry.name === '.agentflow' || entry.name === '.flow')) continue
    const next = relativePath ? join(relativePath, entry.name) : entry.name
    if (entry.isDirectory()) files.push(...await collectWorkspaceFiles(root, next))
    else if (entry.isFile()) files.push(next)
    else throw new Error(t("Unsupported workspace entry: {0}", [next]))
  }
  return files
}

async function filesEqual(left: string, right: string) {
  try {
    const [leftStat, rightStat] = await Promise.all([stat(left), stat(right)])
    if (!leftStat.isFile() || !rightStat.isFile() || leftStat.size !== rightStat.size) return false
    const [leftBuffer, rightBuffer] = await Promise.all([readFile(left), readFile(right)])
    return leftBuffer.equals(rightBuffer)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function mergeWorkspaceDirectories(
  sourceRoot: string,
  targetRoot: string,
  overwriteConflicts: boolean
): Promise<WorkspaceMergeResult> {
  await mkdir(targetRoot, { recursive: true })
  const [sourceBase, targetBase] = await Promise.all([realpath(sourceRoot), realpath(targetRoot)])
  if (relative(sourceBase, targetBase) === '' || isWithinDirectory(sourceBase, targetBase) || isWithinDirectory(targetBase, sourceBase)) throw new Error(t('Invalid project file path'))
  const sourceFiles = await collectWorkspaceFiles(sourceRoot)
  const newFiles: string[] = []
  const identicalFiles: string[] = []
  const conflicts: string[] = []

  for (const relativePath of sourceFiles) {
    const source = join(sourceRoot, relativePath)
    const target = await resolveWorkspaceTarget(targetBase, relativePath)
    try {
      const targetStat = await stat(target)
      if (targetStat.isFile() && await filesEqual(source, target)) identicalFiles.push(relativePath)
      else conflicts.push(relativePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') newFiles.push(relativePath)
      else throw error
    }
  }

  if (conflicts.length && !overwriteConflicts) {
    return { copiedFiles: 0, identicalFiles: identicalFiles.length, conflicts }
  }

  await mkdir(targetRoot, { recursive: true })
  for (const relativePath of [...newFiles, ...(overwriteConflicts ? conflicts : [])]) {
    const source = await resolveWorkspaceTarget(sourceBase, relativePath)
    const target = await resolveWorkspaceTarget(targetBase, relativePath)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(source, target)
  }
  return {
    copiedFiles: newFiles.length + (overwriteConflicts ? conflicts.length : 0),
    identicalFiles: identicalFiles.length,
    conflicts: []
  }
}
