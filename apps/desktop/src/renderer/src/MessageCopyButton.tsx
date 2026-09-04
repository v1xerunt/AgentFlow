import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { ClipboardCheck, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function MessageCopyButton({ content }: { content: string }) {
  const language = useLanguage()

  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const revision = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    setState('idle')
    return () => { revision.current++; clearTimeout(timer.current) }
  }, [content])
  const copy = async () => {
    if (!content || state === 'copying') return
    const current = ++revision.current
    clearTimeout(timer.current)
    setState('copying')
    try {
      await navigator.clipboard.writeText(content)
      if (current !== revision.current) return
      setState('copied')
      timer.current = setTimeout(() => setState('idle'), 2000)
    } catch {
      if (current === revision.current) setState('error')
    }
  }
  const feedback = state === 'copied' ? t("Copied") : state === 'error' ? t("Copy failed. Try again") : ''
  return <>
    <button type="button" aria-label={t("Copy message")} title={feedback || t("Copy message")} disabled={!content || state === 'copying'} onClick={() => void copy()}>
      {state === 'copied' ? <ClipboardCheck size={12} /> : <Copy size={12} />}
    </button>
    <span className={`message-copy-feedback${state === 'error' ? ' is-error' : ''}`} role="status">{feedback}</span>
  </>
}
