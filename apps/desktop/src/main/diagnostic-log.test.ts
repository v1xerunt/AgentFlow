import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import { DiagnosticLog } from './diagnostic-log'
import { diagnosticHandler } from './diagnostic-ipc'
import { redactDiagnostic } from '../shared/diagnostics'

const roots: string[] = []
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'agentflow-diagnostics-test-'))
  roots.push(root)
  return root
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('agentflow-diagnostics-test-')) throw new Error('Unexpected cleanup target')
    await rm(root, { recursive: true, force: true })
  }
})

describe('diagnostic privacy and persistence', () => {
  it('redacts nested credentials, known arbitrary keys, URLs and home paths while preserving the error stack and error code', () => {
    const error = Object.assign(new Error('Failed for my-custom-key at C:\\Users\\Alice\\project: https://user:pass@api.example.com/test?key=opaque#code'), { code: 'ENOENT' })
    const value = redactDiagnostic({ error, apiKey: 'nested-key', config: { messages: ['private prompt'], Authorization: 'token', cookie: 'session=private' }, text: 'Bearer secret-bearer sk-abcdefghijklmnop password="password with spaces"' }, [], ['my-custom-key'])
    const json = JSON.stringify(value)
    for (const secret of ['Alice', 'my-custom-key', 'user:pass', 'opaque', 'nested-key', 'private prompt', 'secret-bearer', 'sk-abcdefghijklmnop', 'password with spaces', 'session=private']) expect(json).not.toContain(secret)
    expect(json).toContain('ENOENT')
    expect(json).toContain('stack')
    expect(json).toContain('api.example.com/test')
  })

  it('handles circular values and bounds large strings', () => {
    const value: Record<string, unknown> = { text: 'a'.repeat(100_000) }
    value.self = value
    const text = JSON.stringify(redactDiagnostic(value))
    expect(text.length).toBeLessThan(6200)
    expect(text).toContain('[circular]')
    expect(text).toContain('[truncated]')
  })

  it('persists redacted errors before export and includes earlier launches', async () => {
    const root = await fixture()
    const first = new DiagnosticLog(root, { version: '1.0' }, ['D:\\private'])
    first.protectSecret('unusual-provider-key')
    first.record({ level: 'error', event: 'provider.failed', details: { error: new Error('rejected unusual-provider-key at D:\\private\\file') } })
    await first.flush()
    expect(await readFile(join(root, 'agentflow.log'), 'utf8')).not.toContain('unusual-provider-key')
    const second = new DiagnosticLog(root, { version: '1.1' })
    second.record({ level: 'info', event: 'app.start' })
    const report = JSON.parse(await second.report())
    expect(report.environment.version).toBe('1.1')
    expect(report.entries).toHaveLength(2)
    expect(report.entries[0].sessionId).toBe(first.sessionId)
    expect(report.entries[1].sessionId).toBe(second.sessionId)
    expect(report.directory).toBeUndefined()
    expect(JSON.stringify(report)).not.toContain('D:\\private')
  })

  it('rotates files within the limit and does not resurrect expired records from memory', async () => {
    const root = await fixture()
    const log = new DiagnosticLog(root, {}, [], { maxFileBytes: 1200, maxFiles: 3 })
    for (let index = 0; index < 60; index++) log.record({ level: 'info', event: `operation.${index}`, details: { text: 'x'.repeat(220) } })
    await log.flush()
    const files = await readdir(root)
    expect(files).toHaveLength(3)
    for (const file of files) expect((await stat(join(root, file))).size).toBeLessThanOrEqual(1200)
    const snapshot = await log.snapshot()
    expect(snapshot.entries.at(-1)?.event).toBe('operation.59')
    expect(snapshot.entries.some(entry => entry.event === 'operation.0')).toBe(false)
  })

  it('exports readable records around an interrupted line and a synchronously captured crash', async () => {
    const root = await fixture()
    const log = new DiagnosticLog(root, {})
    log.record({ level: 'info', event: 'before-crash' })
    await log.flush()
    await writeFile(join(root, 'agentflow.1.log'), '{incomplete\n', 'utf8')
    log.recordFatal(new Error('crash password=hidden'), 'uncaughtException')
    const report = await log.report()
    expect(report).toContain('before-crash')
    expect(report).toContain('process.uncaught-exception')
    expect(report).not.toContain('hidden')
  })

  it('keeps errors exportable when the log directory cannot be created', async () => {
    const root = await fixture()
    const blocked = join(root, 'blocked')
    await writeFile(blocked, 'file instead of directory')
    const log = new DiagnosticLog(blocked, {})
    log.record({ level: 'error', event: 'important-error' })
    const snapshot = await log.snapshot()
    expect(snapshot.storageError).toBeTruthy()
    expect(snapshot.entries.map(entry => entry.event)).toEqual(['important-error'])
    expect(await log.report()).toContain('important-error')
  })

  it('limits a burst of diagnostics without an unbounded write queue', async () => {
    const log = new DiagnosticLog(await fixture(), {})
    for (let index = 0; index < 900; index++) log.record({ level: 'warn', event: 'repeating-error' })
    const snapshot = await log.snapshot()
    expect(snapshot.entries).toHaveLength(501)
    expect(snapshot.entries.at(-1)?.details).toEqual({ dropped: 400 })
  })

  it('does not fail the application when an error object cannot be serialized', async () => {
    const log = new DiagnosticLog(await fixture(), {})
    const details = Object.defineProperty({}, 'message', { enumerable: true, get() { throw new Error('unreadable error field') } })
    expect(() => log.record({ level: 'error', event: 'original-error', details })).not.toThrow()
    expect((await log.snapshot()).entries[0]?.event).toBe('logging.serialization-failed')
  })

  it('logs IPC failures with the operation and duration while preserving results, thrown errors, and argument privacy', async () => {
    const log = new DiagnosticLog(await fixture(), {})
    const error = new Error('Connection failed')
    const event = {} as IpcMainInvokeEvent
    const failing = diagnosticHandler(log, 'provider:test', (_event, _payload: unknown) => { throw error })
    await expect(failing(event, { prompt: 'private argument' })).rejects.toBe(error)
    const result = { content: 'private response' }
    await expect(diagnosticHandler(log, 'provider:invoke', () => result)(event)).resolves.toBe(result)
    const report = await log.report()
    expect(report).toContain('provider:test')
    expect(report).toContain('durationMs')
    expect(report).toContain('Connection failed')
    expect(report).not.toContain('private argument')
    expect(report).not.toContain('private response')
  })
})
