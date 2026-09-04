import type { IpcMainInvokeEvent } from 'electron'
import type { DiagnosticLog } from './diagnostic-log'

/** Log operation names and duration, never IPC arguments or returned application data. */
export function diagnosticHandler<T extends unknown[], R>(log: DiagnosticLog, channel: string, handler: (event: IpcMainInvokeEvent, ...args: T) => R) {
  return async (event: IpcMainInvokeEvent, ...args: T): Promise<Awaited<R>> => {
    const started = Date.now()
    try {
      const result = await handler(event, ...args)
      log.record({ level: 'info', event: 'ipc.completed', details: { operation: channel, durationMs: Date.now() - started } })
      return result
    } catch (error) {
      log.record({ level: error instanceof Error && error.name === 'AbortError' ? 'info' : 'error', event: 'ipc.failed', details: { operation: channel, durationMs: Date.now() - started, error } })
      throw error
    }
  }
}
