import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { useEffect, useState, type DragEvent, type MouseEvent } from 'react'
import { Eye, EyeOff, ExternalLink, FileText, FolderOpen, GripVertical } from 'lucide-react'
import { NODE_FILES_DRAG_TYPE, type NodeFilesDrag } from './node-files'

export interface NodeFileRow {
  id: string
  name: string
  hidden?: boolean
  description?: string
  preview?: string
}

export function useNodeFileSelection(ids: string[], drag: Omit<NodeFilesDrag, 'ids'>) {
  const [selected, setSelected] = useState<string[]>([])
  const identity = `${drag.graphId}/${drag.nodeId}/${drag.artifactId ?? ''}`
  useEffect(() => setSelected([]), [identity])
  const active = selected.filter(id => ids.includes(id))
  const select = (id: string, event: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>) => {
    setSelected(event.shiftKey || event.ctrlKey || event.metaKey ? active.includes(id) ? active.filter(value => value !== id) : [...active, id] : [id])
  }
  const startDrag = (event: DragEvent, id: string) => {
    event.stopPropagation()
    const chosen = active.includes(id) ? active : [id]
    setSelected(chosen)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(NODE_FILES_DRAG_TYPE, JSON.stringify({ ...drag, ids: chosen }))
    return chosen
  }
  return { selected: active, select, startDrag }
}

export function NodeFileList({ items, drag, disabled, compact = false, onToggle, onOpen, onReveal }: {
  items: NodeFileRow[]
  drag: Omit<NodeFilesDrag, 'ids'>
  disabled: boolean
  compact?: boolean
  onToggle: (id: string) => void
  onOpen?: (id: string) => void
  onReveal?: (id: string) => void
}) {
  const language = useLanguage()

  const selection = useNodeFileSelection(items.map(item => item.id), drag)
  return <div className={`node-file-list nodrag nopan nowheel${compact ? ' is-compact' : ''}`} aria-label={t("Node files")} onDoubleClick={event => event.stopPropagation()}>
    {items.length ? items.map(item => <div key={item.id} data-node-file={item.id} className={`node-file-row${item.hidden ? ' is-hidden' : ''}${selection.selected.includes(item.id) ? ' is-selected' : ''}`} draggable={!disabled}
      onDragStart={event => selection.startDrag(event, item.id)} onClick={event => { event.stopPropagation(); selection.select(item.id, event) }}>
      <div className="node-file-row__heading">
        <button type="button" className="node-file-row__select" aria-label={t("Select {0}", [item.name])} aria-pressed={selection.selected.includes(item.id)} onClick={event => { event.stopPropagation(); selection.select(item.id, event) }}>
          <GripVertical size={13} aria-hidden="true" /><FileText size={14} aria-hidden="true" /><span>{item.name}</span>
        </button>
        <div className="node-file-row__actions" onClick={event => event.stopPropagation()}>
          <button type="button" disabled={disabled} aria-label={`${item.hidden ? t("Showing") : t("Hidden")} ${item.name}`} title={item.hidden ? t("Show and send downstream") : t("Hide from downstream input")} aria-pressed={!item.hidden} onClick={() => onToggle(item.id)}>{item.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          {onOpen ? <button type="button" data-output-open aria-label={t("Open {0}", [item.name])} title={t("Open {0}", [item.name])} onClick={() => onOpen(item.id)}><ExternalLink size={14} /></button> : null}
          {onReveal && !compact ? <button type="button" aria-label={t("Open {0} in file manager", [item.name])} title={t("Open in file manager")} onClick={() => onReveal(item.id)}><FolderOpen size={14} /></button> : null}
        </div>
      </div>
      {!compact && item.description ? <small>{item.description}{item.hidden ? t(" · Hidden from downstream input") : ''}</small> : null}
      {!compact && item.preview ? <p className="node-file-row__preview">{item.preview.slice(0, 180)}</p> : null}
    </div>) : <p className="node-files-empty">{t("No files yet")}</p>}
    {!compact && items.length ? <p className="node-files-hint">{t("Shift-click to select multiple files, then drag onto the canvas to create an input.")}</p> : null}
  </div>
}
