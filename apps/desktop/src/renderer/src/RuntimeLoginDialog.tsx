import { localizeAppMessage } from '@agentflow/core/localization'
import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { useEffect, useRef, useState } from 'react'
import { CircleCheck, KeyRound, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { RuntimeLoginProgress } from '../../shared/llm'

export function RuntimeLoginDialog({ progress, onClose }: { progress: RuntimeLoginProgress; onClose: () => void }) {
  const language = useLanguage()

  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const done = ['connected', 'error', 'cancelled'].includes(progress.phase)
  const awaitingCode = progress.phase === 'awaiting-code'
  const isClaude = progress.provider === 'claude'
  const accountName = isClaude ? 'Claude' : 'Google'
  const runtimeName = isClaude ? 'Claude Code' : 'Antigravity'
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  useEffect(() => {
    if (awaitingCode) input.current?.focus()
    else setCode('')
    setError('')
  }, [progress.phase, awaitingCode])
  const cancel = async () => {
    if (done) { onClose(); return }
    if (cancelling) return
    setCancelling(true)
    try { await window.agentflowDesktop?.cancelRuntimeLogin(progress.requestId) }
    catch { setError(t("Could not cancel login. Try again.")) }
    finally { setCancelling(false) }
  }
  return <dialog ref={dialog} className="prompt-autofill-dialog runtime-login-dialog" aria-labelledby="runtime-login-title" aria-describedby="runtime-login-message" onCancel={event => { event.preventDefault(); event.stopPropagation(); void cancel() }}>
    <div className="dialog-heading">
      <span className="dialog-icon">{progress.phase === 'connected' ? <CircleCheck size={18} /> : progress.phase === 'error' ? <TriangleAlert size={18} /> : <KeyRound size={18} />}</span>
      <div><h2 id="runtime-login-title">{t("Sign in")} {accountName}</h2><p>{t("Connect your account through the official {0} runtime", [runtimeName])}</p></div>
    </div>
    {isClaude && !done ? <p className="runtime-login-notice">{t("Initialization uses default settings. Claude can make mistakes; check its output and use it only in trusted projects.")}</p> : null}
    <p id="runtime-login-message" className="runtime-login-message" role={progress.phase === 'error' ? 'alert' : 'status'}>{!done && !awaitingCode ? <LoaderCircle className="spin" size={14} aria-hidden="true" /> : null}{localizeAppMessage(progress.message)}</p>
    {!done && progress.authUrl ? <a className="runtime-login-link" href={progress.authUrl} target="_blank" rel="noreferrer">{t("Open {0} login page", [accountName])}</a> : null}
    <form onSubmit={event => {
      event.preventDefault()
      if (!awaitingCode || !code.trim() || submitting) return
      setSubmitting(true)
      setError('')
      void window.agentflowDesktop?.submitRuntimeLoginCode(progress.requestId, code).then(() => setCode('')).catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : t("Submission failed. Try again."))
      }).finally(() => setSubmitting(false))
    }}>
      {awaitingCode ? <label className="runtime-login-code"><span>{accountName} {t("Authorization code")}</span><input ref={input} type="password" value={code} maxLength={4096} autoComplete="off" spellCheck={false} placeholder={t("Paste the code shown on the {0} page", [runtimeName])} aria-describedby="runtime-login-code-hint" aria-invalid={Boolean(error)} disabled={submitting || cancelling} onChange={event => setCode(event.target.value)} /><small id="runtime-login-code-hint">{t("The code is sent only to this login process.")}{isClaude ? t("Claude Code saves login credentials in a dedicated configuration.") : t("Antigravity saves login credentials in the system credential store.")}</small></label> : null}
      {error ? <p className="provider-test-feedback is-error" role="alert">{error}</p> : null}
      <div className="dialog-actions">
        <button className="quiet-button" type="button" onClick={() => void cancel()} disabled={cancelling}>{done ? t("Close") : cancelling ? t("Cancelling…") : t("Cancel login")}</button>
        {awaitingCode ? <button className="primary-button" type="submit" disabled={!code.trim() || submitting || cancelling}>{submitting ? t("Submitting…") : t("Submit authorization code")}</button> : null}
      </div>
    </form>
  </dialog>
}
