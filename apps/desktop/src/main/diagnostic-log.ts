import { t } from '@agentflow/core/localization'
import { appendFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { redactDiagnostic, type DiagnosticEntry, type DiagnosticInput, type DiagnosticSnapshot } from '../shared/diagnostics'

export class DiagnosticLog {
  readonly sessionId = randomUUID()
  readonly maxFileBytes: number
  readonly maxFiles: number
  private queue = Promise.resolve()
  private pending = 0
  private dropped = 0
  private storageError: string | undefined
  private readonly recent: DiagnosticEntry[] = []
  private readonly unsaved = new Set<DiagnosticEntry>()
  private readonly secrets = new Set<string>()

  constructor(readonly directory: string, private readonly environment: Record<string, string>, private readonly privatePaths: string[] = [], limits: { maxFileBytes?: number; maxFiles?: number } = {}) {
    this.maxFileBytes = limits.maxFileBytes ?? 2 * 1024 * 1024
    this.maxFiles = limits.maxFiles ?? 5
  }

  private file(index = 0) { return join(this.directory, index ? `agentflow.${index}.log` : 'agentflow.log') }

  protectSecret(secret: string) { if (secret) this.secrets.add(secret) }

  private entry(input: DiagnosticInput, source: DiagnosticEntry['source']): DiagnosticEntry {
    const clean = redactDiagnostic(input, this.privatePaths, [...this.secrets]) as DiagnosticInput
    clean.event = clean.event.slice(0, 120)
    if (Buffer.byteLength(JSON.stringify(clean)) > Math.min(60 * 1024, this.maxFileBytes - 200)) clean.details = '[entry exceeded size limit]'
    return { ...clean, timestamp: new Date().toISOString(), sessionId: this.sessionId, source }
  }

  record(input: DiagnosticInput, source: DiagnosticEntry['source'] = 'main') {
    // Bound both memory and disk work if a failing renderer repeatedly reports the same error.
    if (this.pending >= 500) { this.dropped++; return }
    let entry: DiagnosticEntry
    try { entry = this.entry(input, source) }
    catch {
      entry = { level: 'warn', event: 'logging.serialization-failed', timestamp: new Date().toISOString(), sessionId: this.sessionId, source }
    }
    this.recent.push(entry)
    if (this.recent.length > 500) this.unsaved.delete(this.recent.shift()!)
    this.pending++
    this.queue = this.queue.then(async () => {
      await mkdir(this.directory, { recursive: true })
      let line = JSON.stringify(entry) + '\n'
      if (Buffer.byteLength(line) > Math.min(64 * 1024, this.maxFileBytes)) {
        line = JSON.stringify({ ...entry, details: '[entry exceeded size limit]' }) + '\n'
      }
      const size = await stat(this.file()).then(result => result.size).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return 0
        throw error
      })
      if (size && size + Buffer.byteLength(line) > this.maxFileBytes) {
        await rm(this.file(this.maxFiles - 1), { force: true })
        for (let index = this.maxFiles - 2; index >= 0; index--) {
          await rename(this.file(index), this.file(index + 1)).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error })
        }
      }
      await appendFile(this.file(), line, { encoding: 'utf8', mode: 0o600 })
      if (!this.unsaved.size) this.storageError = undefined
    }).catch(() => {
      this.unsaved.add(entry)
      this.storageError = t("Could not write logs to disk. Check directory permissions and free space. The report includes recent records from this session.")
    })
      .finally(() => { this.pending-- })
  }

  /** The exception monitor must persist its record before Node's default fatal exit. */
  recordFatal(error: unknown, origin: string) {
    try {
      mkdirSync(this.directory, { recursive: true })
      const line = JSON.stringify(this.entry({ level: 'error', event: 'process.uncaught-exception', details: { origin, error } }, 'main')) + '\n'
      let size = 0
      try { size = statSync(this.file()).size } catch (failure) { if ((failure as NodeJS.ErrnoException).code !== 'ENOENT') throw failure }
      if (size && size + Buffer.byteLength(line) > this.maxFileBytes) {
        rmSync(this.file(this.maxFiles - 1), { force: true })
        for (let index = this.maxFiles - 2; index >= 0; index--) {
          try { renameSync(this.file(index), this.file(index + 1)) } catch (failure) { if ((failure as NodeJS.ErrnoException).code !== 'ENOENT') throw failure }
        }
      }
      appendFileSync(this.file(), line, { mode: 0o600 })
    } catch { /* A logging failure must not intercept the original crash. */ }
  }

  snapshot(): Promise<DiagnosticSnapshot> {
    const result = this.queue.then(() => this.readSnapshot())
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }

  private async readSnapshot(): Promise<DiagnosticSnapshot> {
    const entries: DiagnosticEntry[] = []
    for (let index = this.maxFiles - 1; index >= 0; index--) {
      try {
        for (const line of (await readFile(this.file(index), 'utf8')).split('\n')) {
          if (!line.trim()) continue
          try {
            const entry = JSON.parse(line) as DiagnosticEntry
            if (entry && ['info', 'warn', 'error'].includes(entry.level) && typeof entry.timestamp === 'string' && typeof entry.event === 'string') entries.push(entry)
          } catch { /* An interrupted final line must not hide preceding diagnostics. */ }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.storageError = t("Some logs could not be read. The report includes the available records.")
      }
    }
    // Include unwritten records when disk access failed, without duplicating saved records.
    const serialized = new Set(entries.map(entry => JSON.stringify(entry)))
    for (const entry of this.unsaved) if (!serialized.has(JSON.stringify(entry))) entries.push(entry)
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    if (this.dropped) entries.push(this.entry({ level: 'warn', event: 'logging.rate-limited', details: { dropped: this.dropped } }, 'main'))
    return {
      environment: redactDiagnostic({ ...this.environment, sessionId: this.sessionId }, this.privatePaths) as Record<string, string>,
      entries: entries.map(entry => redactDiagnostic(entry, this.privatePaths, [...this.secrets]) as DiagnosticEntry),
      directory: this.directory,
      storageError: this.storageError,
      maxFileBytes: this.maxFileBytes,
      maxFiles: this.maxFiles
    }
  }

  async report() {
    const snapshot = await this.snapshot()
    return JSON.stringify({
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      environment: snapshot.environment,
      storageError: snapshot.storageError,
      entries: snapshot.entries
    }, null, 2)
  }

  async flush() { await this.queue }
}
