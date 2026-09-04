import { redactDiagnostic, type DiagnosticInput } from '../../shared/diagnostics'

export function recordDiagnostic(event: string, details?: unknown, level: DiagnosticInput['level'] = 'error') {
  try {
    window.agentflowDesktop?.recordDiagnostic(redactDiagnostic({ level, event, details }) as DiagnosticInput)
  } catch { /* Reporting must not cause another application error. */ }
}

export function installRendererDiagnostics() {
  const onError = (event: ErrorEvent) => recordDiagnostic('renderer.error', { error: event.error ?? event.message, file: event.filename, line: event.lineno, column: event.colno })
  const onRejection = (event: PromiseRejectionEvent) => recordDiagnostic('renderer.unhandled-rejection', { error: event.reason })
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  recordDiagnostic('renderer.ready', { surface: window.location.hash === '#diagnostics' ? 'diagnostics' : 'workspace' }, 'info')
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
