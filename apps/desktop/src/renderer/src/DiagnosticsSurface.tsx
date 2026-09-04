import { localizeAppMessage } from '@agentflow/core/localization'
import { useLanguage } from './language'
import { t, getLocale } from '@agentflow/core/localization'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Download, FileText, FolderOpen, RefreshCw, Search } from 'lucide-react'
import type { DiagnosticSnapshot, LogLevel } from '../../shared/diagnostics'
import './diagnostics.css'

const labels: Record<LogLevel, string> = { get info() { return t("Info") }, get warn() { return t("Warning") }, get error() { return t("Error") } }

export function DiagnosticsSurface() {
  const language = useLanguage()

  const [snapshot, setSnapshot] = useState<DiagnosticSnapshot | null>(null)
  const [level, setLevel] = useState<LogLevel | 'all'>('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null)
  const api = window.agentflowDesktop

  const refresh = useCallback(async () => {
    if (!api) return
    setBusy(true)
    setFeedback(null)
    try { setSnapshot(await api.getDiagnostics()) }
    catch { setFeedback({ text: t("Could not read logs. Try again or open the log directory."), error: true }) }
    finally { setBusy(false) }
  }, [api, language])
  useEffect(() => { void refresh() }, [refresh])

  const act = async (kind: 'export' | 'directory') => {
    if (!api || busy) return
    setBusy(true)
    setFeedback(null)
    try {
      if (kind === 'export') {
        const path = await api.exportDiagnostics()
        if (path) setFeedback({ text: t("Report exported to {0}. Attach it to your issue report with reproduction steps and the time of the problem.", [path]) })
      } else await api.openLogsDirectory()
    } catch { setFeedback({ text: kind === 'export' ? t("Could not export the report. Try again and choose a writable directory.") : t("Could not open the log directory. Open the path below manually."), error: true }) }
    finally { setBusy(false) }
  }

  const entries = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return (snapshot?.entries ?? []).filter(entry => (level === 'all' || entry.level === level) && (!term || `${entry.event} ${JSON.stringify(entry.details ?? '')}`.toLocaleLowerCase().includes(term))).slice().reverse()
  }, [snapshot, level, query, language])

  return <main className="diagnostics-surface">
    <header className="diagnostics-heading">
      <div><h1><FileText size={22} aria-hidden="true" />{t("Logs and diagnostics")}</h1><p>{t("When reporting a problem, export a diagnostic report and attach it to your issue.")}</p></div>
      <button type="button" className="primary-button" disabled={!api || busy} onClick={() => void act('export')}><Download size={15} />{t("Export diagnostic report")}</button>
    </header>
    {!api ? <p className="diagnostics-feedback" role="status">{t("Logs are stored in the desktop app. Open Help → Logs and diagnostics there to view and export them.")}</p> : <>
      <section className="diagnostics-context" aria-label={t("Diagnostic information")}>
        <p>{snapshot ? `AgentFlow ${snapshot.environment.version} · ${snapshot.environment.platform} ${snapshot.environment.arch} · Electron ${snapshot.environment.electron}` : t("Reading diagnostics…")}</p>
        <p>{t("Logs record runtime status and errors, with common credentials filtered out. Check error text and file paths before submitting the report.")}</p>
        {snapshot ? <p>{t("{0} log files, up to {1} MB each. Exports include all retained records.", [snapshot.maxFiles, Math.round(snapshot.maxFileBytes / 1024 / 1024)])}</p> : null}
        <div className="diagnostics-location"><code>{snapshot?.directory}</code><button type="button" className="quiet-button" disabled={busy} onClick={() => void act('directory')}><FolderOpen size={14} />{t("Open log directory")}</button></div>
      </section>
      {snapshot?.storageError ? <p className="diagnostics-feedback is-error" role="alert">{snapshot.storageError}</p> : null}
      {feedback ? <p className={`diagnostics-feedback${feedback.error ? ' is-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{localizeAppMessage(feedback.text)}</p> : null}
      <section className="diagnostics-records" aria-label={t("Recent logs")} aria-busy={busy}>
        <div className="diagnostics-toolbar">
          <label className="diagnostics-search"><Search size={15} aria-hidden="true" /><input aria-label={t("Search logs")} placeholder={t("Search events or errors")} value={query} onChange={event => setQuery(event.target.value)} /></label>
          <select aria-label={t("Log level")} value={level} onChange={event => setLevel(event.target.value as LogLevel | 'all')}><option value="all">{t("All levels")}</option><option value="error">{t("Error")}</option><option value="warn">{t("Warning")}</option><option value="info">{t("Info")}</option></select>
          <button type="button" className="quiet-button" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14} className={busy ? 'spin' : ''} />{t("Refresh")}</button>
        </div>
        <p className="diagnostics-count">{t("Showing {0} entries · Latest 500 records · Local time", [entries.length])}</p>
        <div className="diagnostics-list">
          {entries.map((entry, index) => <details className="diagnostic-entry" key={`${entry.sessionId}-${entry.timestamp}-${index}`}>
            <summary><ChevronRight className="diagnostic-disclosure" size={14} aria-hidden="true" /><time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString(getLocale())}</time><span className={`diagnostic-level is-${entry.level}`}>{labels[entry.level]}</span><span className="diagnostic-event">{entry.event}</span><span className="diagnostic-source">{entry.source === 'main' ? t("Main process") : t("Interface")}</span></summary>
            <pre>{JSON.stringify({ sessionId: entry.sessionId, ...typeof entry.details === 'object' && entry.details ? entry.details : { details: entry.details } }, null, 2)}</pre>
          </details>)}
          {!entries.length ? <p className="diagnostics-empty">{busy ? t("Reading logs…") : query || level !== 'all' ? t("No matching logs. Adjust the level or search terms.") : t("No logs yet. Reproduce the problem, then refresh.")}</p> : null}
        </div>
      </section>
    </>}
  </main>
}
