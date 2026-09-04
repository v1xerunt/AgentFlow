import { lstat, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { t } from '@agentflow/core/localization'

export function isWithinDirectory(root: string, target: string) {
  const local = relative(root, target)
  return local !== '' && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local)
}

export async function resolveWorkspaceTarget(root: string, path: string) {
  // Project paths use forward slashes, including when imported from Windows.
  const parts = typeof path === 'string' ? path.split(/[\\/]/).filter(part => part !== '.') : []
  if (!parts.length || !path.trim() || /^[\\/]/.test(path) || path.includes(':') || parts.includes('..') || parts.some(part => /[\x00-\x1f<>"|?*]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part))) {
    throw new Error(t('The output path must be inside the current project.'))
  }
  const base = await realpath(root)
  const target = resolve(base, ...parts.filter(Boolean))
  if (!isWithinDirectory(base, target)) throw new Error(t('The output path must be inside the current project.'))
  let cursor = base
  for (const part of relative(base, target).split(sep)) {
    cursor = join(cursor, part)
    try {
      if ((await lstat(cursor)).isSymbolicLink()) throw new Error(t('The output path cannot pass through symbolic links or junctions.'))
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  return target
}
