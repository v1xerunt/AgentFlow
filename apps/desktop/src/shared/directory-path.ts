export function normalizeDirectoryPath(path: string) {
  if (/^[A-Za-z]:[\\/]?$/.test(path)) return `${path.slice(0, 2)}\\`
  if (/^\/+$/u.test(path)) return '/'
  return path.replace(/[\\/]+$/, '')
}

export function directoryPathIdentity(path: string) {
  const normalized = normalizeDirectoryPath(path)
  return /^[A-Za-z]:[\\/]|^\\\\/.test(normalized)
    ? normalized.replaceAll('\\', '/').toLowerCase()
    : normalized
}
