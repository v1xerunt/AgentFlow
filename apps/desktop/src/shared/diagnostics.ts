export type LogLevel = 'info' | 'warn' | 'error'

export interface DiagnosticInput {
  level: LogLevel
  event: string
  details?: unknown
}

export interface DiagnosticEntry extends DiagnosticInput {
  timestamp: string
  sessionId: string
  source: 'main' | 'renderer'
}

export interface DiagnosticSnapshot {
  environment: Record<string, string>
  entries: DiagnosticEntry[]
  directory: string
  storageError?: string
  maxFileBytes: number
  maxFiles: number
}

export interface DesktopDiagnosticsApi {
  recordDiagnostic(entry: DiagnosticInput): void
  getDiagnostics(): Promise<DiagnosticSnapshot>
  exportDiagnostics(): Promise<string | null>
  openLogsDirectory(): Promise<void>
}

const privateField = /^(?:.*(?:password|secret|token|cookie|authorization|api.?key|credential).*|headers|body|requestBody|responseBody|messages|prompt|systemPrompt|inputPrompt|outputPrompt|content|attachments|env)$/i
const maxString = 6000

/** Sanitize before persistence as well as before export. Never pass request/response payloads here. */
export function redactDiagnostic(value: unknown, privatePaths: string[] = [], secrets: string[] = []): unknown {
  const seen = new WeakSet<object>()
  const cleanText = (input: string) => {
    let text = input
    for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
      for (const variant of new Set([secret, encodeURIComponent(secret)])) text = text.split(variant).join('[redacted]')
    }
    for (const path of privatePaths.filter(Boolean).sort((a, b) => b.length - a.length)) {
      for (const variant of new Set([path, path.replace(/\\/g, '/'), path.replace(/\\/g, '\\\\')])) {
        text = text.replace(new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '<local>')
      }
    }
    text = text
      .replace(/\b(?:Bearer|Basic)\s+[^\s,;"'<>]+/gi, '[redacted]')
      .replace(/\b(?:sk-[\w-]{8,}|AIza[\w-]{20,}|gh[pousr]_[\w]{15,}|eyJ[\w-]+\.[\w-]+\.[\w-]+)\b/g, '[redacted]')
      .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization|cookie|set-cookie)\s*["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, '$1[redacted]')
      .replace(/https?:\/\/[^\s<>"']+/gi, url => {
        try {
          const parsed = new URL(url)
          parsed.username = ''; parsed.password = ''
          if (parsed.search) parsed.search = '?redacted'
          if (parsed.hash) parsed.hash = '#redacted'
          return parsed.toString()
        } catch { return '[redacted URL]' }
      })
      .replace(/\b[A-Z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s"']+/gi, '<home>')
      .replace(/\/(?:Users|home)\/[^/\s"']+/g, '<home>')
      .replace(/data:[^\s,]+;base64,[a-z0-9+/=]+/gi, '[redacted attachment]')
    return text.length > maxString ? `${text.slice(0, maxString)}…[truncated]` : text
  }
  const visit = (item: unknown, depth: number): unknown => {
    if (typeof item === 'string') return cleanText(item)
    if (item == null || typeof item === 'number' || typeof item === 'boolean') return item
    if (typeof item !== 'object') return String(item)
    if (depth > 5) return '[truncated]'
    if (seen.has(item)) return '[circular]'
    seen.add(item)
    if (item instanceof Error) return visit({ name: item.name, message: item.message, stack: item.stack, cause: item.cause, code: (item as Error & { code?: unknown }).code }, depth + 1)
    if (Array.isArray(item)) return item.slice(0, 30).map(child => visit(child, depth + 1))
    return Object.fromEntries(Object.entries(item).slice(0, 30).map(([key, child]) => [cleanText(key), privateField.test(key) ? '[redacted]' : visit(child, depth + 1)]))
  }
  return visit(value, 0)
}
