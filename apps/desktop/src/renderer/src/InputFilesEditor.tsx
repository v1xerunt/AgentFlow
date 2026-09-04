import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { useState } from 'react'
import { Eye, EyeOff, FilePlus2, FileText, GripVertical, Maximize2, Plus, Upload, X } from 'lucide-react'
import type { InputNodeDefinition } from '@agentflow/schema'
import { INPUT_FILE_ACCEPT } from './input-files'
import { createId } from './workspace-store'
import { useNodeFileSelection } from './NodeFileList'

export function InputFilesEditor({ graphId, nodeId, node, disabled, onChange, onRequestFiles, onEditInput }: {
  graphId: string; nodeId: string; node: InputNodeDefinition; disabled: boolean
  onChange: (node: InputNodeDefinition) => void
  onRequestFiles: (files: File[]) => void
  onEditInput: (itemId: string) => void
}) {
  const language = useLanguage()

  const [dragged, setDragged] = useState<string[]>([])
  const selection = useNodeFileSelection(node.items.map(item => item.id), { graphId, nodeId })
  const updateItem = (id: string, patch: Partial<InputNodeDefinition['items'][number]>) => onChange({ ...node, items: node.items.map(item => item.id === id ? { ...item, ...patch } : item) })
  const moveItems = (targetId: string) => {
    if (disabled || dragged.includes(targetId)) return
    const moving = node.items.filter(item => dragged.includes(item.id))
    const remaining = node.items.filter(item => !dragged.includes(item.id))
    const target = remaining.findIndex(item => item.id === targetId)
    if (!moving.length || target < 0) return
    remaining.splice(target, 0, ...moving)
    onChange({ ...node, items: remaining, orderMode: 'manual' })
    setDragged([])
  }
  return <div className="input-editor" onDragOver={event => { if (!disabled && event.dataTransfer.types.includes('Files')) event.preventDefault() }} onDrop={event => {
    if (disabled || !event.dataTransfer.files.length) return
    event.preventDefault(); onRequestFiles([...event.dataTransfer.files])
  }}>
    <div className="input-editor__actions">
      <button type="button" disabled={disabled} onClick={() => onChange({ ...node, items: [...node.items, { id: createId('input-item'), name: t("Text {0}", [node.items.length + 1]), kind: 'text', mode: 'text', content: '' }] })}><Plus size={13} />{t("Add text")}</button>
      <label className={disabled ? 'is-disabled' : ''}><Upload size={13} />{t("Add files")}<input type="file" accept={INPUT_FILE_ACCEPT} multiple disabled={disabled} onChange={event => { if (event.target.files?.length) onRequestFiles([...event.target.files]); event.currentTarget.value = '' }} /></label>
    </div>
    {node.items.length > 1 ? <label className="input-batch-toggle"><input type="checkbox" checked={node.executionMode === 'for-each'} disabled={disabled} onChange={event => onChange({ ...node, executionMode: event.target.checked ? 'for-each' : 'all' })} /><span><strong>{t("Run each item")}</strong><small>{t("Run included input items in order")}</small></span></label> : null}
    {node.items.length ? <><div className="input-item-list">{node.items.map((item, index) => <div key={item.id} data-node-file={item.id} className={`input-item${dragged.includes(item.id) ? ' is-dragging' : ''}${selection.selected.includes(item.id) ? ' is-selected' : ''}${item.hidden ? ' is-hidden' : ''}`} draggable={!disabled}
      onClick={event => { if ((event.target as HTMLElement).closest('input,textarea,button')) return; selection.select(item.id, event) }}
      onDragStart={event => { if ((event.target as HTMLElement).closest('input,textarea')) { event.preventDefault(); return } setDragged(selection.startDrag(event, item.id)) }}
      onDragOver={event => { if (dragged.length) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }}
      onDrop={event => { if (!dragged.length) return; event.preventDefault(); event.stopPropagation(); moveItems(item.id) }} onDragEnd={() => setDragged([])}>
      <div className="input-item__heading">
        <input aria-label={t("Input item name")} title={item.name} value={item.name} disabled={disabled} onChange={event => updateItem(item.id, { name: event.target.value })} />
        <button className="input-item__grip" type="button" aria-label={t("Select {0}", [item.name])} aria-pressed={selection.selected.includes(item.id)} title={t("Select files; drag to reorder or move into a new input")} onClick={event => selection.select(item.id, event)}><GripVertical size={13} /></button>
        <span className="input-item__index">{index + 1}</span><span className={`input-item__kind is-${item.mode}`}>{item.mode === 'attachment' ? <Upload size={12} /> : <FileText size={12} />}</span>
        <em>{item.mode === 'attachment' ? t("Attachments") : item.kind === 'file' ? t("Text file") : t("Text")}</em>
        <div className="input-item__file-actions">
          <button type="button" aria-label={`${item.hidden ? t("Showing") : t("Hidden")} ${item.name}`} title={item.hidden ? t("Show and send downstream") : t("Hide from downstream input")} aria-pressed={!item.hidden} disabled={disabled} onClick={() => updateItem(item.id, { hidden: !item.hidden })}>{item.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          {item.mode === 'text' ? <button type="button" aria-label={t("Expand to edit {0}", [item.name])} onClick={() => onEditInput(item.id)}><Maximize2 size={14} /></button> : null}
          <button type="button" className="is-danger" aria-label={t("Delete {0}", [item.name])} disabled={disabled} onClick={() => onChange({ ...node, items: node.items.filter(candidate => candidate.id !== item.id) })}><X size={13} /></button>
        </div>
      </div>
      {item.hidden ? <small className="node-files-hint">{t("Hidden from downstream input")}</small> : null}
      {item.mode === 'text' ? <textarea value={item.content} disabled={disabled} placeholder={item.kind === 'file' ? t("No text was extracted from this file") : t("Enter text to send to the Agent")} rows={4} onChange={event => updateItem(item.id, { content: event.target.value })} /> : <p>{item.size ?? 0} B · {item.mimeType ?? t("Unknown type")}</p>}
    </div>)}</div><p className="node-files-hint">{t("Shift-click to select multiple files, then drag onto the canvas to create an input.")}</p></> : <div className="input-editor__empty"><FilePlus2 size={18} /><p>{t("Supports PDF, DOCX, text, and images.")}</p></div>}
  </div>
}
