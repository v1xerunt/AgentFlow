import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { ArrowLeft, Eye, FileCode2, FileText } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ModelResponsePart } from '@agentflow/core'

export function MarkdownContent({ content }: { content: string }) {
  const language = useLanguage()

  return <div className="markdown-content"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
    img: ({ alt }) => <span className="markdown-image-label">{t("[Image:")}{alt || t("Untitled")}]</span>
  }}>{content}</Markdown></div>
}

export function ResponseReasoning({ parts }: { parts?: ModelResponsePart[] }) {
  const language = useLanguage()

  const reasoning = parts?.filter((part) => part.type !== 'output_text' && part.text.trim()).map((part) => part.text).join('\n\n')
  return reasoning ? <details className="response-reasoning"><summary>{t("Reasoning summary")}</summary><MarkdownContent content={reasoning} /></details> : null
}

export function DocumentSurface({ title, content, parts, relativePath, saveStatus, onChange, onBack, disabled = false }: {
  title: string
  content: string
  parts?: ModelResponsePart[]
  relativePath: string
  saveStatus: string
  onChange?: (content: string) => void
  onBack: () => void
  disabled?: boolean
}) {
  const language = useLanguage()

  const [preview, setPreview] = useState(!onChange)
  const rendered = useDeferredValue(content)
  const status = saveStatus === 'error' ? t("Save failed. Try again") : saveStatus === 'saving' ? t("Saving…") : null
  return <section className="document-surface" aria-label={onChange ? t("Edit input text") : t("View Agent output")}>
    <header className="document-header">
      <button className="icon-button" type="button" onClick={onBack} data-return-flow aria-label={t("Back to Flow")}><ArrowLeft size={18} /></button>
      <div><h1><FileText size={18} />{title}</h1><p title={relativePath}>{relativePath}</p></div>
      {status ? <span className={`document-save-status is-${saveStatus}`} role="status">{status}</span> : null}
      {onChange ? <div className="document-view-switch" role="group" aria-label={t("Text view")}>
        <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}><FileCode2 size={15} />{t("Edit")}</button>
        <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}><Eye size={15} />{t("Preview")}</button>
      </div> : null}
    </header>
    <div className="document-body">{preview ? <article className="document-reading"><ResponseReasoning parts={parts} /><MarkdownContent content={rendered} />{!content ? <p className="muted-copy">{t("No content yet")}</p> : null}</article> : <textarea className="document-editor" aria-label={t("Input text content")} value={content} onChange={(event) => onChange?.(event.target.value)} placeholder={t("Enter text or Markdown")} disabled={disabled} spellCheck={false} />}</div>
  </section>
}
