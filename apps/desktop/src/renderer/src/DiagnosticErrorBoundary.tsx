import { localizeAppMessage, t, subscribeLanguage } from '@agentflow/core/localization'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { recordDiagnostic } from './diagnostics'

export class DiagnosticErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; message: string; busy: boolean }> {
  state = { failed: false, message: '', busy: false }
  private unsubscribe?: () => void
  componentDidMount() { this.unsubscribe = subscribeLanguage(() => this.forceUpdate()) }
  componentWillUnmount() { this.unsubscribe?.() }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { recordDiagnostic('renderer.react-error', { error, componentStack: info.componentStack }) }
  private exportReport = async () => {
    this.setState({ busy: true, message: '' })
    try {
      const path = await window.agentflowDesktop?.exportDiagnostics()
      if (path) this.setState({ message: t("Diagnostic report exported: {0}", [path]) })
    } catch { this.setState({ message: t("Export failed. Open the log directory from the Help menu.") }) }
    finally { this.setState({ busy: false }) }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="diagnostics-recovery"><h1>{t("The interface encountered an error")}</h1><p>{t("Export a diagnostic report and describe what you did before the error in your issue report.")}</p><div>
      <button type="button" className="primary-button" disabled={!window.agentflowDesktop || this.state.busy} onClick={() => void this.exportReport()}>{t("Export diagnostic report")}</button>
      <button type="button" className="quiet-button" onClick={() => window.location.reload()}>{t("Reload")}</button>
    </div>{this.state.message ? <p role="status">{localizeAppMessage(this.state.message)}</p> : null}</main>
  }
}
