import { localizeLabel, localizeAppMessage, runtimeStatusLabel } from '@agentflow/core/localization'
import { useLanguage } from './language'
import { t, getLocale } from '@agentflow/core/localization'
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  useUpdateNodeInternals,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes
} from '@xyflow/react'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  FileOutput,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  GitFork,
  GitMerge,
  ExternalLink,
  Link2,
  Lock,
  LoaderCircle,
  Square,
  MessageSquarePlus,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Ungroup,
  Unlock,
  Upload,
  X,
  Workflow
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction
} from 'react'
import { createPortal } from 'react-dom'
import { MessageCopyButton } from './MessageCopyButton'
import { modelAttachmentIssue, resultFiles, resultFileState, visibleInputItems, type Artifact, type NodeRuntimeStatus, type RuntimeEvent } from '@agentflow/core'
import { NodeFileList, type NodeFileRow } from './NodeFileList'
import { InputFilesEditor as InputFields } from './InputFilesEditor'
import './node-files.css'
import type { NodeFilesDrag } from './node-files'
import {
  linkSourceIds,
  validateLinkCandidate,
  type AgentNodeDefinition,
  type AgentPromptDefinition,
  type GraphDefinition,
  type GraphNodeDefinition,
  type InputNodeDefinition,
  type LinkCandidateError,
  type LinkDefinition,
  type LinkRelation,
  type OutputNodeDefinition,
  type SingleLinkRelation,
  type ProjectDefinition,
  type WorkspaceBinding
} from '@agentflow/schema'
import type { AgentSession, PersistedChatMessage, StoredArtifact, StoredGraph, StoredRun, WorkspaceMergeResult, WorkspaceState } from '../../shared/workspace'
import { attachFreshTemporaryProject, createAgentSession, createId, duplicateFlow, reconcileWorkspaceState } from './workspace-store'
import { workspaceLabel } from './App'
import { classifyInputFile } from './input-files'
import { isMarkdownOutput } from '../../shared/flow-project'
import { removeWorkspaceProjects } from './workspace-store'
import { FLOW_GOAL_PLACEHOLDER, updateLinkTypeWithPromptDefaultsDetailed } from './prompt-autofill'
import { fallbackCatalog, providerModelsFromCatalog, type ProviderModelOptions } from './llm-catalog'
import { MenuSelect } from './MenuSelect'
import { ModelParametersEditor, ModelReasoningControl } from './ModelParametersEditor'
import { useAgentLibrary } from './AgentLibraryContext'
import { ModelSelect, ProviderSelect } from './ConnectionSelect'
import { MarkdownContent, ResponseReasoning } from './DocumentSurface'
import type { AgentOutput } from '../../shared/flow-project'
import { ModelLogo } from './ModelLogo'
import type { FlowRunPlan, PromptAutofillMode, PromptAutofillPlan, PromptFieldKind } from './flow-analysis'
import type { FlowGenerationInputSummary, FlowGenerationMode, FlowGenerationPreview } from './flow-generation'
import { ownedOutputEntry, reconcileAgentToolOutput } from './agent-outputs'
import { messageCandidates, visibleChatMessages } from './chat-history'

export type Surface = 'graph' | 'chat' | 'document'
export type NoticeTone = 'neutral' | 'success' | 'error'

export interface RuntimeNodeState {
  status: NodeRuntimeStatus
  artifactVersion?: number
  fileNames?: string[]
}

interface NodeData extends Record<string, unknown> {
  fileRows?: NodeFileRow[]
  fileDrag?: Omit<NodeFilesDrag, 'ids'>
  filesLocked?: boolean
  onToggleFile?: (id: string) => void
  onOpenFile?: (id: string) => void
  onRevealFile?: (id: string) => void
  name: string
  kind: 'input' | 'agent' | 'output'
  provider?: string
  model?: string
  status: NodeRuntimeStatus
  artifactVersion?: number
  itemCount?: number
  attachmentCount?: number
  fileNames?: string[]
  ownsOutput?: boolean
  outputBelow?: boolean
  localTool?: boolean
  onSave?: () => void
  onOpenOutput?: () => void
  onRevealOutput?: () => void
  onUpdate: (patch: { name?: string; nameCustomized?: boolean; provider?: string; model?: string }) => void
  includeCurrentModels?: boolean; providerModels: ProviderModelOptions[]
}

type AppNode = Node<NodeData, 'agentflow'>

interface GroupData extends Record<string, unknown> {
  groupId: string
  name: string
  count: number
  onRename: (name: string) => void
  onUngroup: () => void
}

interface EdgeData extends Record<string, unknown> {
  linkId: string
  label: string
  relation?: LinkRelation
  synthetic?: boolean
  allowedRelations: SingleLinkRelation[]
  onTypeChange: (type: SingleLinkRelation) => void
  attachmentIssue?: string
}

type GroupNode = Node<GroupData, 'agentflow-group'>
type CanvasNode = AppNode | GroupNode
type AppEdge = Edge<EdgeData, 'agentflow-edge'>

const relationLabels: Record<LinkRelation, string> = {
  get input() { return t('Input') },
  get pass() { return t('Pass') },
  get review() { return t('Review') },
  get revise() { return t('Revise') },
  get merge() { return t('Merge') }
}

export const nodeTypes: NodeTypes = { agentflow: FlowNodeCard, 'agentflow-group': FlowGroupCard }
export const edgeTypes: EdgeTypes = { 'agentflow-edge': FlowEdge }

export const providerModels = providerModelsFromCatalog(fallbackCatalog)

interface CanvasActions {
  graphId?: string
  artifacts?: Record<string, Artifact>
  filesLocked?: boolean
  onToggleFile?: (nodeId: string, id: string) => void
  onEditInput?: (nodeId: string, itemId: string) => void
  onUpdateNode: (nodeId: string, patch: { name?: string; nameCustomized?: boolean; provider?: string; model?: string }) => void
  onSaveAgent: (nodeId: string) => void
  onOpenOutput?: (nodeId: string, filePath?: string) => void
  onRevealOutput?: (nodeId: string, filePath?: string) => void
  outputNodeIds?: ReadonlySet<string>
  onRenameGroup: (groupId: string, name: string) => void
  onUngroup: (groupId: string) => void
  includeCurrentModels?: boolean; providerModels: ProviderModelOptions[]
}

function outputIsBelow(graph: GraphDefinition, agentId: string) {
  const agent = graph.nodes[agentId]?.position
  const output = ownedOutputEntry(graph, agentId)?.[1].position
  return Boolean(agent && output && output.y - agent.y >= 220 && Math.abs(output.x - agent.x) < 144)
}

export function buildFlowNodes(
  graph: GraphDefinition,
  runtime: Record<string, RuntimeNodeState>,
  selectedNodeIds: ReadonlySet<string>,
  actions: CanvasActions
): CanvasNode[] {
  const groupNodes: GroupNode[] = (graph.groups ?? []).flatMap((group) => {
    const positions = group.nodeIds.map((nodeId) => graph.nodes[nodeId]?.position).filter((position): position is { x: number; y: number } => Boolean(position))
    if (!positions.length) return []
    const left = Math.min(...positions.map((position) => position.x))
    const top = Math.min(...positions.map((position) => position.y))
    const right = Math.max(...positions.map((position) => position.x))
    const bottom = Math.max(...positions.map((position) => position.y))
    return [{
      id: `group:${group.id}`,
      type: 'agentflow-group',
      position: { x: left - 26, y: top - 50 },
      data: {
        groupId: group.id,
        name: group.name,
        count: group.nodeIds.length,
        onRename: (name) => actions.onRenameGroup(group.id, name),
        onUngroup: () => actions.onUngroup(group.id)
      },
      style: { width: right - left + 336, height: bottom - top + 224 },
      draggable: true,
      selectable: false,
      connectable: false,
      deletable: false,
      zIndex: -1
    }]
  })
  const nodes: AppNode[] = Object.entries(graph.nodes).map(([id, node]) => ({
    id,
    type: 'agentflow',
    position: node.position ?? { x: 0, y: 0 },
    selected: selectedNodeIds.has(id),
    data: {
      fileRows: node.type === 'input' ? node.items.map(item => ({ id: item.id, name: item.name, hidden: item.hidden }))
        : node.type === 'output' && actions.artifacts?.[id]?.files !== undefined ? resultFiles(node, actions.artifacts[id]).map(file => ({ id: file.relativePath, name: file.name, hidden: resultFileState(node, actions.artifacts![id]!, file.relativePath) === 'hidden' })) : undefined,
      fileDrag: { graphId: actions.graphId ?? '', nodeId: id, artifactId: node.type === 'output' ? actions.artifacts?.[id]?.id : undefined },
      filesLocked: actions.filesLocked,
      onToggleFile: fileId => actions.onToggleFile?.(id, fileId),
      onOpenFile: node.type === 'input' ? itemId => actions.onEditInput?.(id, itemId) : filePath => actions.onOpenOutput?.(id, filePath),
      onRevealFile: node.type === 'output' ? filePath => actions.onRevealOutput?.(id, filePath) : undefined,
      name: node.name,
      kind: node.type,
      provider: node.type === 'agent' ? node.provider : undefined,
      model: node.type === 'agent' ? node.model : undefined,
      status: runtime[id]?.status ?? 'idle',
      artifactVersion: runtime[id]?.artifactVersion,
      itemCount: node.type === 'input' ? visibleInputItems(node).length : undefined,
      attachmentCount: node.type === 'input' ? visibleInputItems(node).filter((item) => item.mode === 'attachment').length : undefined,
      fileNames: node.type === 'output' ? actions.artifacts?.[id]?.files !== undefined ? resultFiles(node, actions.artifacts[id]).map(file => file.name) : runtime[id]?.fileNames : undefined,
      ownsOutput: node.type === 'agent' ? Boolean(ownedOutputEntry(graph, id)) : undefined,
      outputBelow: outputIsBelow(graph, node.type === 'output' ? node.ownerAgentId : id),
      localTool: node.type === 'agent' ? node.provider.startsWith('agent-tool:') : undefined,
      onSave: node.type === 'agent' ? () => actions.onSaveAgent(id) : undefined,
      onOpenOutput: node.type === 'output' && actions.outputNodeIds?.has(id) && actions.onOpenOutput ? () => actions.onOpenOutput?.(id) : undefined,
      onRevealOutput: node.type !== 'input' && actions.outputNodeIds?.has(node.type === 'agent' ? ownedOutputEntry(graph, id)?.[0] ?? id : id) && actions.onRevealOutput ? () => actions.onRevealOutput?.(id) : undefined,
      onUpdate: (patch) => actions.onUpdateNode(id, patch),
      includeCurrentModels: actions.includeCurrentModels,
      providerModels: actions.providerModels
    }
  }))
  return [...groupNodes, ...nodes]
}

export function buildFlowEdges(
  graph: GraphDefinition,
  targets: Record<string, NodeRuntimeStatus>,
  selectedLinkIds: ReadonlySet<string>,
  onTypeChange: (linkId: string, type: SingleLinkRelation) => void
): AppEdge[] {
  const links: AppEdge[] = graph.links.flatMap((link) => linkSourceIds(link).map((sourceId) => {
    const status = targets[link.targetId]
    const selected = selectedLinkIds.has(link.id)
    const color = selected || status === 'running' ? '#2563eb' : status === 'completed' ? '#7d9a86' : '#aaa9a3'
    const source = graph.nodes[sourceId]
    const target = graph.nodes[link.targetId]
    const attachmentIssue = source?.type === 'input' && target?.type === 'agent'
      ? visibleInputItems(source).filter((item) => item.mode === 'attachment' && !(target.provider.startsWith('agent-tool:') && item.workspacePath)).map((item) => item.mimeType ? modelAttachmentIssue(target.provider, target.model, item.mimeType) : t("Unknown attachment format")).find(Boolean)
      : undefined
    const edgeColor = attachmentIssue ? '#c2413b' : color
    return {
      id: link.type === 'merge' ? `${link.id}::${sourceId}` : link.id,
      source: sourceId,
      target: link.targetId,
      type: 'agentflow-edge' as const,
      selected,
      animated: status === 'running',
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: edgeColor },
      style: { stroke: edgeColor, strokeWidth: selected || status === 'running' || attachmentIssue ? 2.2 : 1.6, strokeDasharray: attachmentIssue ? '6 4' : undefined },
      data: {
        linkId: link.id,
        label: relationLabels[link.type],
        relation: link.type,
        allowedRelations: graph.nodes[sourceId]?.type === 'input' || graph.nodes[sourceId]?.type === 'output' ? ['input'] : ['pass', 'review', 'revise'],
        onTypeChange: (type: SingleLinkRelation) => onTypeChange(link.id, type),
        attachmentIssue
      }
    }
  }))
  const outputs: AppEdge[] = Object.entries(graph.nodes).flatMap(([outputId, node]) => node.type === 'output'
    ? [{
        id: `agent-output-edge::${node.ownerAgentId}::${outputId}`,
        source: node.ownerAgentId,
        sourceHandle: 'specified-output',
        target: outputId,
        targetHandle: 'owner',
        type: 'agentflow-edge' as const,
        selectable: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#aaa9a3' },
        style: { stroke: '#aaa9a3', strokeWidth: 1.5 },
        data: { linkId: '', label: t("Output"), synthetic: true, allowedRelations: [], onTypeChange: () => undefined }
      }]
    : [])
  return [...links, ...outputs]
}

function FlowGroupCard({ data }: NodeProps<GroupNode>) {
  const language = useLanguage()

  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(data.name)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => setName(data.name), [data.name])
  useEffect(() => {
    if (!menuPosition) return
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) setMenuPosition(null)
    }
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setMenuPosition(null) }
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', escape) }
  }, [menuPosition])
  const commit = () => {
    const next = name.trim()
    if (next && next !== data.name) data.onRename(next)
    setRenaming(false)
    setMenuPosition(null)
  }
  return <div className="flow-group">
    <div className="flow-group__heading">{renaming ? <input className="nodrag nopan" autoFocus value={name} onChange={(event) => setName(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') { setName(data.name); setRenaming(false) } }} /> : <div><strong>{data.name}</strong><span>{data.count} {t("nodes · Drag to move together")}</span></div>}<button ref={menuButtonRef} className="nodrag nopan" type="button" aria-label={t("{0} group menu", [data.name])} onClick={(event) => { if (menuPosition) { setMenuPosition(null); return } const bounds = event.currentTarget.getBoundingClientRect(); setMenuPosition({ x: Math.max(8, bounds.right - 128), y: bounds.bottom + 4 }) }}><MoreHorizontal size={15} /></button></div>
    {menuPosition && !renaming ? createPortal(<div ref={menuRef} className="flow-group__menu" role="menu" aria-label={t("{0} group actions", [data.name])} style={{ left: menuPosition.x, top: menuPosition.y }}><button type="button" role="menuitem" onClick={() => { setMenuPosition(null); setRenaming(true) }}><Pencil size={13} />{t("Rename")}</button><button type="button" role="menuitem" onClick={() => { setMenuPosition(null); data.onUngroup() }}><Ungroup size={13} />{t("Ungroup")}</button></div>, document.body) : null}
  </div>
}

function FlowEdge({ id, data, markerEnd, selected, style, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps<AppEdge>) {
  const language = useLanguage()

  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return <><BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={data?.synthetic ? 12 : 28} /><EdgeLabelRenderer><div data-link-id={data?.linkId ?? id} className={`flow-edge-label nodrag nopan ${selected ? 'is-selected' : ''} ${data?.attachmentIssue ? 'has-attachment-issue' : ''} ${data?.synthetic ? 'is-output' : ''}`} title={data?.attachmentIssue} style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>{data?.synthetic || data?.relation === 'merge' ? <span>{data.label}</span> : <MenuSelect ariaLabel={t("Link type")} value={data?.relation} options={(data?.allowedRelations ?? []).map((relation) => ({ value: relation, label: relationLabels[relation] }))} onChange={(value) => data?.onTypeChange(value as SingleLinkRelation)} />}{data?.attachmentIssue ? <AlertTriangle size={13} aria-label={data.attachmentIssue} /> : null}</div></EdgeLabelRenderer></>
}

function FlowNodeCard({ id, data, selected }: NodeProps<AppNode>) {
  const language = useLanguage()

  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => updateNodeInternals(id), [id, data.outputBelow, data.fileRows?.length, updateNodeInternals])
  const availableProviders = data.providerModels
  const currentProvider = availableProviders.find((item) => item.provider === data.provider)
  const fileList = data.fileRows && data.fileDrag ? <NodeFileList items={data.fileRows} drag={data.fileDrag} disabled={Boolean(data.filesLocked)} compact onToggle={id => data.onToggleFile?.(id)} onOpen={data.onOpenFile} /> : null
  if (data.kind === 'output') return <div className={`flow-node flow-output-node ${selected ? 'is-selected' : ''} is-${data.status}`} data-flow-node-id={id} data-flow-node-kind="output" aria-label={`${data.name} · ${t("Result")}`}><Handle id="owner" type="target" position={data.outputBelow ? Position.Top : Position.Left} className="node-handle node-handle--owner" isConnectable={false} /><div className="flow-output-node__icon"><FolderOpen size={16} /></div><div className="flow-output-node__text"><strong>{data.fileNames?.length === 1 ? data.fileNames[0] : data.fileNames?.length ? t("{0} output files", [data.fileNames.length]) : data.name}</strong>{data.fileNames?.length ? <span>{data.fileNames.join(' · ')}</span> : data.artifactVersion ? <span>{data.fileRows ? t("No files yet") : t("Markdown output")} · v{data.artifactVersion}</span> : <span>{t("Waiting to run")}</span>}</div><div className="flow-output-node__actions">{data.onOpenOutput ? <button className="flow-node__quick-save nodrag nopan" type="button" aria-label={t("Open {0}", [data.name])} title={t("Open output")} onClick={(event) => { event.stopPropagation(); data.onOpenOutput?.() }}><FileText size={14} /></button> : null}{data.onRevealOutput ? <RevealOutputButton name={data.name} onReveal={data.onRevealOutput} /> : null}<StatusMark status={data.status} /></div>{fileList}<Handle type="source" position={Position.Right} className="node-handle" /></div>
  return <div className={`flow-node ${selected ? 'is-selected' : ''} is-${data.status}`} data-flow-node-id={id} data-flow-node-kind={data.kind} aria-label={`${data.name} · ${data.kind === "agent" ? "Agent" : t("Input")} · ${runtimeStatusLabel(data.status)}`}>
    {data.kind === 'agent' ? <Handle type="target" position={Position.Left} className="node-handle" /> : null}
    <div className="flow-node__topline">{data.kind === 'agent' ? <ModelLogo providerId={data.provider ?? 'fake'} modelId={data.model} name={currentProvider?.label ?? data.name} size={27} /> : <span className="node-kind node-kind--input"><FileText size={14} /></span>}<div className="flow-node__top-actions">{data.onRevealOutput ? <RevealOutputButton name={data.name} onReveal={data.onRevealOutput} /> : null}{data.onSave ? <button className="flow-node__quick-save nodrag nopan" type="button" aria-label={t("Quick-save {0}", [data.name])} title={t("Save to Agent library")} onClick={(event) => { event.stopPropagation(); data.onSave?.() }}><Save size={14} /></button> : null}<StatusMark status={data.status} /></div></div>
    <CardNameField value={data.name} onCommit={(name) => data.onUpdate({ name, nameCustomized: true })} />
    {data.kind === 'agent' ? <div className="flow-node__model nodrag nopan"><ProviderSelect ariaLabel={t('{0} provider', [data.name])} value={data.provider} leadingIcon={<ModelLogo providerId={data.provider ?? 'fake'} modelId={data.model} size={16} />} options={availableProviders.map((item) => ({ value: item.provider, label: `${item.label}${item.configured ? '' : t(" · Not configured")}`, icon: <ModelLogo providerId={item.provider} modelId={item.models[0]} name={item.label} size={18} /> }))} onChange={(provider) => { const model = availableProviders.find((item) => item.provider === provider)?.models[0] ?? data.model; data.onUpdate({ provider, model }) }} /><ModelSelect providerId={data.provider ?? ''} providerName={currentProvider?.label} ariaLabel={t('{0} model', [data.name])} value={data.model} leadingIcon={<ModelLogo providerId={data.provider ?? 'fake'} modelId={data.model} size={16} />} options={modelOptions(data.provider, data.model, availableProviders, data.includeCurrentModels).map((model) => ({ value: model, label: model === '@tool-default' ? t("Tool default model") : model, icon: <ModelLogo providerId={data.provider ?? 'fake'} modelId={model} size={18} /> }))} onChange={(model) => data.onUpdate({ model })} /></div> : <div className="flow-node__meta">{data.itemCount} {t("input items")}{data.attachmentCount ? t(" · {0} attachments", [data.attachmentCount]) : ''}</div>}
    {data.kind === 'input' ? fileList : null}
    <div className="flow-node__foot"><span>{data.kind === 'agent' ? t("Open chat") : t("Drag to connect")}</span>{data.artifactVersion ? <span>v{data.artifactVersion}</span> : null}</div>
    {data.ownsOutput
      ? <Handle id="specified-output" type="source" position={data.outputBelow ? Position.Bottom : Position.Right} className="node-handle node-handle--output" isConnectable={false} />
      : !data.localTool ? <Handle type="source" position={Position.Right} className="node-handle" /> : null}
  </div>
}

function RevealOutputButton({ name, onReveal }: { name: string; onReveal: () => void }) {
  const language = useLanguage()

  return <button className="flow-node__quick-save nodrag nopan" type="button" aria-label={t("Open {0} output in file manager", [name])} title={t("Open output in file manager")} onClick={(event) => { event.stopPropagation(); onReveal() }}><FolderOpen size={14} /></button>
}

function CardNameField({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const language = useLanguage()

  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => { const next = draft.trim(); if (!next) setDraft(value); else if (next !== value) onCommit(next) }
  return <input className="flow-node__name nodrag nopan" aria-label={t("Node name")} value={draft} onChange={(event) => { const text = event.target.value; setDraft(text); if (text.trim()) onCommit(text) }} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { commit(); event.currentTarget.blur() } }} />
}

function modelOptions(provider: string | undefined, current: string | undefined, catalog = providerModels, includeCurrent = true) {
  const models = catalog.find((item) => item.provider === provider)?.models ?? []
  return includeCurrent && current && !models.includes(current) ? [current, ...models] : models
}

function StatusMark({ status }: { status: NodeRuntimeStatus }) {
  const language = useLanguage()

  if (status === 'running') return <LoaderCircle className="status-icon is-running spin" aria-label={t("Running")} />
  if (status === 'completed') return <Check className="status-icon is-complete" aria-label={t("Completed")} />
  return <Circle className="status-icon" aria-label={status === 'cancelled' ? t("Stopped") : status === 'paused' ? t("Paused") : status === 'failed' ? t("Run failed") : status === 'waiting' ? t("Waiting") : t("Not run")} />
}

interface SidebarProps {
  workspace: WorkspaceState
  project: ProjectDefinition
  activeGraphId: string
  onOpenProjectGraph: (projectId: string, graphId: string) => void
  onCreateGraph: (projectId: string) => void
  onCreateTemporaryProject: () => void
  onOpenSession: (nodeId: string) => void
  onSessionDeleted: (nodeId: string) => void
  onOpenSettings: () => void
  onResizeSidebar: (width: number) => void
  setWorkspace: Dispatch<SetStateAction<WorkspaceState | null>>
  setNotice: (notice: { message: string; tone: NoticeTone }) => void
}

export function Sidebar(props: SidebarProps) {
  const language = useLanguage()

  const { workspace, project, activeGraphId, onOpenProjectGraph, onCreateGraph, onCreateTemporaryProject, onOpenSession, onSessionDeleted, onOpenSettings, onResizeSidebar, setWorkspace, setNotice } = props
  const [openProjects, setOpenProjects] = useState(() => new Set([project.id]))
  const [resourceMenu, setResourceMenu] = useState<{ kind: 'project' | 'graph'; id: string; projectId: string; x: number; y: number } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [sessionMenu, setSessionMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [sessionRenameValue, setSessionRenameValue] = useState('')
  const [sessionRenaming, setSessionRenaming] = useState(false)
  const [sessionConfirmingDelete, setSessionConfirmingDelete] = useState(false)
  const [sessionPanelHeight, setSessionPanelHeight] = useState(() => Number(window.localStorage.getItem('agentflow.sidebar.sessions.height')) || 188)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const sessionMenuRef = useRef<HTMLDivElement | null>(null)
  const pinnedProjectIds = new Set(workspace.pinnedProjectIds)
  const pinnedGraphIds = new Set(workspace.pinnedGraphIds)
  const visibleProjects = workspace.projects
    .filter((candidate) => candidate.workspace.mode === 'directory' && !workspace.archivedProjectIds.includes(candidate.id))
    .sort((left, right) => Number(pinnedProjectIds.has(right.id)) - Number(pinnedProjectIds.has(left.id)))
  const temporaryProjects = workspace.projects.filter((candidate) => candidate.workspace.mode === 'temporary')
  const menuProject = resourceMenu ? workspace.projects.find((candidate) => candidate.id === resourceMenu.projectId) : undefined
  const menuGraph = resourceMenu?.kind === 'graph' ? workspace.graphs.find((candidate) => candidate.id === resourceMenu.id) : undefined
  const activeStoredGraph = workspace.graphs.find((candidate) => candidate.id === activeGraphId)
  const graphSessions = workspace.sessions
    .filter((session) => session.graphId === activeGraphId)
    .sort((left, right) => Number(right.isActive) - Number(left.isActive) || right.updatedAt.localeCompare(left.updatedAt))
  const selectedSession = sessionMenu ? workspace.sessions.find((session) => session.id === sessionMenu.id) : undefined

  useEffect(() => {
    setOpenProjects((current) => new Set([...current, project.id]))
  }, [project.id])

  useEffect(() => {
    window.localStorage.setItem('agentflow.sidebar.sessions.height', String(Math.round(sessionPanelHeight)))
  }, [sessionPanelHeight])

  useEffect(() => {
    if (!resourceMenu) return
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as HTMLElement) && !(event.target as HTMLElement | null)?.closest('.resource-more')) setResourceMenu(null)
    }
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setResourceMenu(null) }
    const closeForLayout = () => setResourceMenu(null)
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', escape)
    window.addEventListener('resize', closeForLayout)
    document.addEventListener('scroll', closeForLayout, true)
    return () => { document.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', escape); window.removeEventListener('resize', closeForLayout); document.removeEventListener('scroll', closeForLayout, true) }
  }, [resourceMenu])

  useEffect(() => {
    if (!sessionMenu) return
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (!sessionMenuRef.current?.contains(target) && !target.closest('.session-row__more')) setSessionMenu(null)
    }
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setSessionMenu(null) }
    const closeForLayout = () => setSessionMenu(null)
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', escape)
    window.addEventListener('resize', closeForLayout)
    document.addEventListener('scroll', closeForLayout, true)
    return () => { document.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', escape); window.removeEventListener('resize', closeForLayout); document.removeEventListener('scroll', closeForLayout, true) }
  }, [sessionMenu])

  const updateProject = (projectId: string, transform: (project: ProjectDefinition) => ProjectDefinition) => {
    const now = new Date().toISOString()
    setWorkspace((current) => current ? { ...current, projects: current.projects.map((candidate) => candidate.id === projectId ? { ...transform(candidate), updatedAt: now } : candidate), updatedAt: now } : current)
  }

  const replaceWorkspace = (projectId: string, binding: WorkspaceBinding) => {
    const now = new Date().toISOString()
    setWorkspace((current) => {
      if (!current) return current
      const projectGraphs = current.graphs.filter((graph) => graph.projectId === projectId)
      const archived = current.sessions.map((session) => session.projectId === projectId && session.isActive ? { ...session, isActive: false, status: 'archived' as const, updatedAt: now } : session)
      const fresh = projectGraphs.flatMap((graph) => Object.entries(graph.definition.nodes).filter(([, node]) => node.type === 'agent').map(([nodeId]) => createAgentSession(projectId, graph.id, nodeId, binding)))
      return { ...current, projects: current.projects.map((candidate) => candidate.id === projectId ? { ...candidate, workspace: binding, updatedAt: now } : candidate), sessions: [...archived, ...fresh], updatedAt: now }
    })
  }

  const chooseDirectory = async (projectId: string) => {
    if (!window.agentflowDesktop) { setNotice({ message: t("Bind a local directory in the desktop app"), tone: 'neutral' }); return }
    const rootPath = await window.agentflowDesktop.chooseDirectory()
    if (!rootPath) return
    replaceWorkspace(projectId, { mode: 'directory', rootPath })
    setResourceMenu(null)
    setNotice({ message: t("Working directory updated and Agent sessions reset"), tone: 'success' })
  }

  const openWorkspace = async (binding: WorkspaceBinding) => {
    if (!window.agentflowDesktop) { setNotice({ message: t("Open the working directory in the desktop app"), tone: 'neutral' }); return }
    try { await window.agentflowDesktop.openWorkspace(binding) }
    catch { setNotice({ message: t("Could not open the working directory"), tone: 'error' }) }
  }

  const togglePinned = (kind: 'project' | 'graph', id: string) => {
    const key = kind === 'project' ? 'pinnedProjectIds' : 'pinnedGraphIds'
    setWorkspace((current) => {
      if (!current) return current
      const pinned = new Set(current[key])
      if (pinned.has(id)) pinned.delete(id); else pinned.add(id)
      return { ...current, [key]: [...pinned], updatedAt: new Date().toISOString() }
    })
    setResourceMenu(null)
  }

  const openResourceMenu = (event: React.MouseEvent<HTMLElement>, kind: 'project' | 'graph', id: string, projectId: string, name: string) => {
    const fromContextMenu = event.type === 'contextmenu'
    if (fromContextMenu) event.preventDefault()
    event.stopPropagation()
    if (!fromContextMenu && resourceMenu?.kind === kind && resourceMenu.id === id) { setResourceMenu(null); return }
    setSessionMenu(null)
    const rect = event.currentTarget.getBoundingClientRect()
    const width = 224
    const height = 244
    setRenameValue(name)
    setRenaming(false)
    setConfirmingDelete(false)
    setResourceMenu({
      kind,
      id,
      projectId,
      x: Math.max(10, Math.min(window.innerWidth - width - 10, fromContextMenu ? event.clientX : rect.right + 6)),
      y: Math.max(10, Math.min(window.innerHeight - height - 10, fromContextMenu ? event.clientY : rect.top - 8))
    })
  }

  const openSessionMenu = (event: React.MouseEvent<HTMLElement>, session: AgentSession, name: string) => {
    const fromContextMenu = event.type === 'contextmenu'
    if (fromContextMenu) event.preventDefault()
    event.stopPropagation()
    if (!fromContextMenu && sessionMenu?.id === session.id) { setSessionMenu(null); return }
    const rect = event.currentTarget.getBoundingClientRect()
    const width = 210
    const height = 176
    setResourceMenu(null)
    setSessionRenameValue(session.title ?? name)
    setSessionRenaming(false)
    setSessionConfirmingDelete(false)
    setSessionMenu({
      id: session.id,
      x: Math.max(10, Math.min(window.innerWidth - width - 10, fromContextMenu ? event.clientX : rect.right + 6)),
      y: Math.max(10, Math.min(window.innerHeight - height - 10, fromContextMenu ? event.clientY : rect.top - 8))
    })
  }

  const commitSessionRename = () => {
    if (!selectedSession || !sessionRenameValue.trim()) return
    const now = new Date().toISOString()
    const title = sessionRenameValue.trim()
    setWorkspace((current) => current ? {
      ...current,
      sessions: current.sessions.map((session) => session.id === selectedSession.id ? { ...session, title, updatedAt: now } : session),
      updatedAt: now
    } : current)
    setSessionMenu(null)
    setNotice({ message: t("Session renamed"), tone: 'success' })
  }

  const deleteSession = () => {
    if (!selectedSession) return
    const now = new Date().toISOString()
    const node = workspace.graphs.find((graph) => graph.id === selectedSession.graphId)?.definition.nodes[selectedSession.agentNodeId]
    setWorkspace((current) => {
      if (!current) return current
      const suppressed = new Set(current.suppressedSessionAgentIds ?? [])
      if (selectedSession.isActive && node?.type === 'agent') suppressed.add(selectedSession.agentNodeId)
      return {
        ...current,
        sessions: current.sessions.filter((session) => session.id !== selectedSession.id),
        suppressedSessionAgentIds: [...suppressed],
        updatedAt: now
      }
    })
    if (selectedSession.isActive) onSessionDeleted(selectedSession.agentNodeId)
    setSessionMenu(null)
    setNotice({ message: t("Session deleted. A new session will be created when you open the Agent"), tone: 'neutral' })
  }

  const commitRename = () => {
    if (!resourceMenu || !renameValue.trim()) return
    const name = renameValue.trim()
    if (resourceMenu.kind === 'project') updateProject(resourceMenu.id, (current) => ({ ...current, name }))
    else {
      const now = new Date().toISOString()
      setWorkspace((current) => current ? { ...current, graphs: current.graphs.map((graph) => graph.id === resourceMenu.id ? { ...graph, definition: { ...graph.definition, name }, revision: graph.revision + 1, updatedAt: now } : graph), updatedAt: now } : current)
    }
    setNotice({ message: t("{0} renamed", [name]), tone: 'success' })
    setResourceMenu(null)
  }

  const deleteProject = (projectId: string) => {
    setWorkspace((current) => {
      if (!current) return current
      const projectGraphs = current.graphs.filter((graph) => graph.projectId === projectId)
      const graphIds = new Set(projectGraphs.map((graph) => graph.id))
      const agentIds = new Set(projectGraphs.flatMap((graph) => Object.entries(graph.definition.nodes).filter(([, node]) => node.type === 'agent').map(([nodeId]) => nodeId)))
      const now = new Date().toISOString()
      let next: WorkspaceState = { ...removeWorkspaceProjects(current, [projectId]), suppressedSessionAgentIds: (current.suppressedSessionAgentIds ?? []).filter((id) => !agentIds.has(id)), updatedAt: now }
      if (current.activeProjectId === projectId) {
        const fallbackProject = next.projects.find((candidate) => candidate.workspace.mode === 'temporary') ?? next.projects[0]
        if (!fallbackProject) next = attachFreshTemporaryProject({ ...next, activeProjectId: '', activeGraphId: '' })
        else {
          const fallbackGraph = next.graphs.find((graph) => graph.projectId === fallbackProject.id)
          next = { ...next, activeProjectId: fallbackProject.id, activeGraphId: fallbackGraph?.id ?? '' }
        }
      }
      return reconcileWorkspaceState(next)
    })
    setNotice({ message: t("Project removed from the list"), tone: 'neutral' })
    setResourceMenu(null)
  }

  const deleteGraph = (graphId: string, projectId: string) => {
    const projectGraphs = workspace.graphs.filter((graph) => graph.projectId === projectId)
    if (projectGraphs.length <= 1) { setNotice({ message: t("A project must contain at least one Flow"), tone: 'error' }); return }
    setWorkspace((current) => {
      if (!current) return current
      const fallback = current.graphs.find((graph) => graph.projectId === projectId && graph.id !== graphId)
      const removedGraph = current.graphs.find((graph) => graph.id === graphId)
      const removedAgentIds = new Set(Object.entries(removedGraph?.definition.nodes ?? {}).filter(([, node]) => node.type === 'agent').map(([nodeId]) => nodeId))
      const now = new Date().toISOString()
      return reconcileWorkspaceState({
        ...current,
        tutorial: current.tutorial?.graphId === graphId ? { ...current.tutorial, status: 'skipped' } : current.tutorial,
        graphs: current.graphs.filter((graph) => graph.id !== graphId),
        sessions: current.sessions.filter((session) => session.graphId !== graphId),
        runs: current.runs.filter((run) => run.graphId !== graphId),
        pinnedGraphIds: current.pinnedGraphIds.filter((id) => id !== graphId),
        suppressedSessionAgentIds: (current.suppressedSessionAgentIds ?? []).filter((id) => !removedAgentIds.has(id)),
        activeGraphId: current.activeGraphId === graphId ? (fallback?.id ?? '') : current.activeGraphId,
        updatedAt: now
      })
    })
    setNotice({ message: t("Flow deleted"), tone: 'neutral' })
    setResourceMenu(null)
  }

  const duplicateGraph = (graphId: string) => {
    const source = workspace.graphs.find((graph) => graph.id === graphId)
    if (!source) return
    setWorkspace((current) => current ? duplicateFlow(current, graphId) : current)
    setResourceMenu(null)
    setNotice({ message: t("Created a copy of “{0}”", [source.definition.name]), tone: 'success' })
  }

  const beginResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 248
    const move = (moveEvent: MouseEvent) => onResizeSidebar(Math.max(208, Math.min(380, startWidth + moveEvent.clientX - startX)))
    const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }

  const beginSessionResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = sessionPanelHeight
    const sidebarHeight = event.currentTarget.parentElement?.getBoundingClientRect().height ?? window.innerHeight
    const move = (moveEvent: MouseEvent) => setSessionPanelHeight(Math.max(96, Math.min(sidebarHeight - 330, startHeight - (moveEvent.clientY - startY))))
    const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }

  const menuPinned = resourceMenu?.kind === 'project' ? pinnedProjectIds.has(resourceMenu.id) : resourceMenu ? pinnedGraphIds.has(resourceMenu.id) : false
  const menuName = resourceMenu?.kind === 'project' ? menuProject?.name : menuGraph?.definition.name
  const menu = resourceMenu && menuProject ? createPortal(<div ref={menuRef} className="resource-menu" role="menu" aria-label={t("{0} actions", [menuName])} style={{ left: resourceMenu.x, top: resourceMenu.y }}>
    <div className="resource-menu__title"><span>{resourceMenu.kind === 'project' ? <Folder size={15} /> : <GitBranch size={15} />}</span><strong>{menuName}</strong></div>
    {renaming ? <div className="resource-menu__rename"><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(); if (event.key === 'Escape') setRenaming(false) }} /><div><button type="button" onClick={() => setRenaming(false)}>{t("Cancel")}</button><button type="button" className="is-primary" onClick={commitRename} disabled={!renameValue.trim()}>{t("Save")}</button></div></div> : confirmingDelete ? <div className="resource-menu__confirm"><p>{resourceMenu.kind === 'project' ? t("Remove this project’s record from AgentFlow. Files in the working directory are retained.") : t("The Flow, sessions, and run history will be deleted from this project.")}</p><div><button type="button" onClick={() => setConfirmingDelete(false)}>{t("Cancel")}</button><button type="button" className="is-danger" onClick={() => resourceMenu.kind === 'project' ? deleteProject(resourceMenu.id) : deleteGraph(resourceMenu.id, resourceMenu.projectId)}>{t("Confirm deletion")}</button></div></div> : <>
      <button type="button" role="menuitem" onClick={() => togglePinned(resourceMenu.kind, resourceMenu.id)}>{menuPinned ? <PinOff size={15} /> : <Pin size={15} />}{menuPinned ? t("Unpin") : t("Pin")}</button>
      <button type="button" role="menuitem" onClick={() => setRenaming(true)}><Pencil size={15} />{t("Rename")}</button>
      {resourceMenu.kind === 'graph' ? <button type="button" role="menuitem" onClick={() => duplicateGraph(resourceMenu.id)}><Copy size={15} />{t("Duplicate")}</button> : null}
      <button type="button" role="menuitem" onClick={() => void openWorkspace(menuProject.workspace)}><ExternalLink size={15} />{t("Open in file manager")}</button>
      {resourceMenu.kind === 'project' ? <button type="button" role="menuitem" onClick={() => void chooseDirectory(menuProject.id)}><FolderOpen size={15} />{t("Change working directory")}</button> : null}
      <button type="button" role="menuitem" className="is-danger" onClick={() => setConfirmingDelete(true)}><Trash2 size={15} />{t("Delete")}{resourceMenu.kind === 'project' ? ' ' + t('Project') : ' Flow'}</button>
    </>}
  </div>, document.body) : null
  const sessionNode = selectedSession ? workspace.graphs.find((graph) => graph.id === selectedSession.graphId)?.definition.nodes[selectedSession.agentNodeId] : undefined
  const sessionName = selectedSession?.title ?? sessionNode?.name ?? selectedSession?.agentNodeId
  const sessionActions = sessionMenu && selectedSession ? createPortal(<div ref={sessionMenuRef} className="resource-menu session-menu" role="menu" aria-label={t("{0} session actions", [sessionName])} style={{ left: sessionMenu.x, top: sessionMenu.y }}>
    <div className="resource-menu__title"><span><MessageSquareText size={15} /></span><strong>{sessionName}</strong></div>
    {sessionRenaming ? <div className="resource-menu__rename"><input autoFocus value={sessionRenameValue} onChange={(event) => setSessionRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitSessionRename(); if (event.key === 'Escape') setSessionRenaming(false) }} /><div><button type="button" onClick={() => setSessionRenaming(false)}>{t("Cancel")}</button><button type="button" className="is-primary" onClick={commitSessionRename} disabled={!sessionRenameValue.trim()}>{t("Save")}</button></div></div> : sessionConfirmingDelete ? <div className="resource-menu__confirm"><p>{t("Delete this session’s conversation. Opening the Agent again will create a new session.")}</p><div><button type="button" onClick={() => setSessionConfirmingDelete(false)}>{t("Cancel")}</button><button type="button" className="is-danger" onClick={deleteSession}>{t("Confirm deletion")}</button></div></div> : <>
      <button type="button" role="menuitem" onClick={() => setSessionRenaming(true)}><Pencil size={15} />{t("Rename")}</button>
      <button type="button" role="menuitem" className="is-danger" onClick={() => setSessionConfirmingDelete(true)}><Trash2 size={15} />{t("Delete session")}</button>
    </>}
  </div>, document.body) : null

  const renderProjectItem = (candidate: ProjectDefinition, displayName = candidate.name) => {
    const isTemporary = candidate.workspace.mode === 'temporary'
    const isOpen = openProjects.has(candidate.id)
    const isActive = candidate.id === project.id
    const candidateGraphs = workspace.graphs
      .filter((graph) => graph.projectId === candidate.id)
      .sort((left, right) => Number(pinnedGraphIds.has(right.id)) - Number(pinnedGraphIds.has(left.id)))
    const toggleProject = () => {
      setOpenProjects((current) => {
        const next = new Set(current)
        if (next.has(candidate.id)) next.delete(candidate.id)
        else next.add(candidate.id)
        return next
      })
      if (!isActive && candidateGraphs[0]) onOpenProjectGraph(candidate.id, candidateGraphs[0].id)
    }

    return <div className="project-tree__project" key={candidate.id}>
      <div
        className={`project-row ${isTemporary ? 'temporary-project-heading' : ''} ${isActive ? 'is-active' : ''}`}
        onContextMenu={isTemporary ? undefined : (event) => openResourceMenu(event, 'project', candidate.id, candidate.id, candidate.name)}
      >
        <button type="button" className="project-row__main" onClick={toggleProject} aria-expanded={isOpen}>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {isTemporary ? <FilePlus2 size={16} /> : <Folder size={16} />}
          <span>{displayName}</span>
          {!isTemporary && pinnedProjectIds.has(candidate.id) ? <Pin className="resource-pin" size={11} /> : null}
        </button>
        {!isTemporary ? <button className="project-row__more resource-more" type="button" onClick={(event) => openResourceMenu(event, 'project', candidate.id, candidate.id, candidate.name)} aria-label={t("{0} menu", [candidate.name])} aria-haspopup="menu"><MoreHorizontal size={15} /></button> : null}
      </div>
      {isOpen ? <div className="project-graphs">
        {candidateGraphs.map((graph) => <div className={`graph-row ${graph.id === activeGraphId && isActive ? 'is-current' : ''}`} key={graph.id} onContextMenu={(event) => openResourceMenu(event, 'graph', graph.id, candidate.id, graph.definition.name)}>
          <button type="button" className="graph-row__main" onClick={() => onOpenProjectGraph(candidate.id, graph.id)}><GitBranch size={13} /><span>{graph.definition.name}</span>{pinnedGraphIds.has(graph.id) ? <Pin className="resource-pin" size={10} /> : null}</button>
          <button type="button" className="graph-row__more resource-more" onClick={(event) => openResourceMenu(event, 'graph', graph.id, candidate.id, graph.definition.name)} aria-label={t("{0} menu", [graph.definition.name])} aria-haspopup="menu"><MoreHorizontal size={14} /></button>
        </div>)}
        <button type="button" className="project-graph-add" onClick={() => onCreateGraph(candidate.id)}><Plus size={13} /><span>{t("New Flow")}</span></button>
      </div> : null}
    </div>
  }

  return <><aside className="sidebar" style={{ '--sessions-height': `${sessionPanelHeight}px` } as React.CSSProperties}>
    <button className="new-temporary-project" type="button" onClick={onCreateTemporaryProject}><FilePlus2 size={17} /><span>{t("New temporary project")}</span></button>
    {temporaryProjects.length ? <section className="sidebar-group temporary-project-group"><div className="section-heading"><span>{t("Temporary project")}</span></div><div className="temporary-project-list">{temporaryProjects.map((temporaryProject, index) => renderProjectItem(temporaryProject, localizeLabel(temporaryProject.name) === t("Untitled project") ? t("Temporary project {0}", [index + 1]) : temporaryProject.name))}</div></section> : null}
    <section className="sidebar-group project-tree"><div className="section-heading"><span>{t("Projects")}</span></div><div className="project-tree__scroll">{visibleProjects.length ? visibleProjects.map((candidate) => renderProjectItem(candidate)) : <p className="project-tree-empty">{t("No projects yet")}</p>}</div></section>
    <div className="sessions-resizer" role="separator" aria-label={t("Resize sessions area")} aria-orientation="horizontal" onMouseDown={beginSessionResize}><span /></div>
    <section className="sidebar-group graph-sessions"><div className="section-heading"><span>{t("Sessions")}</span><em>{graphSessions.length}</em></div><div className="graph-session-list">{graphSessions.length ? graphSessions.map((session) => { const node = activeStoredGraph?.definition.nodes[session.agentNodeId]; const name = session.title ?? node?.name ?? session.agentNodeId; return <div className="graph-session-row" key={session.id} onContextMenu={(event) => openSessionMenu(event, session, name)}><button className="graph-session-row__main" type="button" disabled={!session.isActive || node?.type !== 'agent'} onClick={() => onOpenSession(session.agentNodeId)}><span className={`session-dot is-${session.status}`} /><span><strong>{name}</strong><small>{session.isActive ? t('Active') : t('Archived')} · {session.messages.length} {t("messages")}</small></span></button><button className="session-row__more" type="button" aria-label={t("{0} session menu", [name])} aria-haspopup="menu" onClick={(event) => openSessionMenu(event, session, name)}><MoreHorizontal size={14} /></button></div> }) : <p>{t("This Flow has no Agent sessions yet.")}</p>}</div></section>
    <button className="sidebar-settings" type="button" onClick={onOpenSettings}><Settings size={16} /><span>{t("Settings")}</span></button>
    <div className="sidebar-resizer" role="separator" aria-label={t("Resize sidebar")} aria-orientation="vertical" onMouseDown={beginResize} />
  </aside>{menu}{sessionActions}</>
}

export function FlowActionDock({ agentCount, autofilling, flowGenerating, running, versions, activeStateId, onSelectState, onRenameState, onForkVersion, onAutofill, onGenerateFlow, onRun, onStopFlow, onStopAutofill, onStopFlowGeneration }: {
  agentCount: number
  autofilling: boolean
  flowGenerating: boolean
  running: boolean
  versions: StoredRun[]
  activeStateId: string
  onSelectState: (stateId: string) => void
  onRenameState: (stateId: string, name: string) => void
  onForkVersion: (stateId: string) => void
  onAutofill: () => void
  onGenerateFlow: () => void
  onRun: () => void
  onStopFlow: () => void
  onStopAutofill: () => void
  onStopFlowGeneration: () => void
}) {
  const language = useLanguage()

  const [renamingStateId, setRenamingStateId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const runName = (run: StoredRun, index: number) => run.name ?? (run.batchId ? t("Batch {0}/{1}", [run.batchIndex ?? 1, run.batchSize ?? 1]) : t("Run {0}", [index + 1]))
  const beginRename = (run: StoredRun, index: number) => {
    setDraftName(runName(run, index))
    setRenamingStateId(run.id)
  }
  const options = [
    { value: 'working', label: t("Working State") },
    ...versions.map((run, index) => {
      const name = runName(run, index)
      return {
        value: run.id,
        label: `${name} · ${new Date(run.completedAt ?? run.createdAt).toLocaleString(getLocale())}`,
        actions: [
          { key: 'rename', ariaLabel: t("Rename {0}", [name]), title: t("Rename"), icon: <Pencil size={13} />, onSelect: () => beginRename(run, index) },
          { key: 'fork', ariaLabel: t("Fork a new Flow from {0}", [name]), title: t("Fork into new Flow"), icon: <GitFork size={14} />, onSelect: () => onForkVersion(run.id) }
        ]
      }
    })
  ]
  const commitRename = () => {
    const name = draftName.trim()
    if (!name || !renamingStateId) return
    onRenameState(renamingStateId, name)
    setRenamingStateId(null)
  }
  return <div className="flow-action-dock" role="toolbar" aria-label={t("Flow actions")}>
    <div className="flow-action-dock__group is-run">
      {renamingStateId ? <div className="flow-state-rename"><input autoFocus aria-label={t("Historical state name")} value={draftName} maxLength={80} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(); if (event.key === 'Escape') setRenamingStateId(null) }} /><button type="button" aria-label={t("Save state name")} onClick={commitRename} disabled={!draftName.trim()}><Check size={14} /></button><button type="button" aria-label={t("Cancel rename")} onClick={() => setRenamingStateId(null)}><X size={14} /></button></div> : <div className="flow-state-picker"><MenuSelect ariaLabel={t("Flow state")} className="flow-state-select" leadingIcon={<GitBranch size={14} />} value={activeStateId} disabled={running || autofilling || flowGenerating} menuWidth={400} options={options} onChange={onSelectState} /></div>}
      <button data-tutorial="run-flow" className="flow-action-dock__primary" type="button" onClick={running ? onStopFlow : onRun} disabled={!agentCount || autofilling || flowGenerating || activeStateId !== 'working'} title={activeStateId !== 'working' ? t("Fork this historical state before running a new Flow") : undefined}>
        {running ? <Square size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        <span>{running ? t("Stop Flow") : t("Run Flow")}</span>
      </button>
    </div>
    <span className="flow-action-dock__divider" aria-hidden="true" />
    <div className="flow-action-dock__group is-compose">
      <button type="button" data-tutorial="autofill" onClick={autofilling ? onStopAutofill : onAutofill} disabled={!agentCount || running || flowGenerating || activeStateId !== 'working'} title={activeStateId !== 'working' ? t("Fork the historical state before editing prompts") : autofilling ? t("Stop prompt autofill") : t("Autofill prompts")}>
        {autofilling ? <Square size={16} /> : <Sparkles size={16} />}
        <span>{autofilling ? t("Stop autofill") : t("Autofill prompts")}</span>
      </button>
      <button type="button" data-tutorial="generate-flow" onClick={flowGenerating ? onStopFlowGeneration : onGenerateFlow} disabled={running || autofilling || activeStateId !== 'working'} title={activeStateId !== 'working' ? t("Fork the historical state before generating a new Flow") : flowGenerating ? t("Stop Flow generation") : t("Generate Flow from description")}>
        {flowGenerating ? <Square size={15} /> : <MessageSquarePlus size={15} />}
        <span>{flowGenerating ? t("Stop generation") : t("Generate Flow from description")}</span>
      </button>
    </div>
  </div>
}

interface InspectorProps {
  status?: NodeRuntimeStatus
  onRunUpstream?: (nodeId: string) => void
  onRunDownstream?: (nodeId: string) => void
  onToggleFile?: (id: string) => void
  graph: StoredGraph
  nodeId: string | null
  node?: GraphNodeDefinition
  link?: LinkDefinition
  artifact?: Artifact
  artifactOptions: StoredArtifact[]
  selectedArtifactId?: string
  onSelectArtifact: (artifactId: string) => void
  events: RuntimeEvent[]
  output?: AgentOutput
  running: boolean
  historyViewing: boolean
  onUpdateGraph: (transform: (graph: GraphDefinition) => GraphDefinition, bumpRevision?: boolean) => void
  onRunAgent: (nodeId: string) => void
  onOpenChat: () => void
  onOpenOutput: (filePath?: string) => void
  onOpenSystemFile?: (filePath: string) => void
  onRevealOutput: (filePath?: string) => void
  runInputIssue?: string
  onEditInput: (itemId: string) => void
  onRequestFiles: (files: File[]) => void
  onDelete: () => void
  setNotice: (notice: { message: string; tone: NoticeTone }) => void
  includeCurrentModels?: boolean; providerModels: ProviderModelOptions[]
}

export function Inspector(props: InspectorProps) {
  const language = useLanguage()

  const library = useAgentLibrary()
  const { graph: storedGraph, nodeId, node, link, artifact, artifactOptions, selectedArtifactId, onSelectArtifact, events, output, running, historyViewing, onUpdateGraph, onRunAgent, onOpenChat, onOpenOutput, onOpenSystemFile, onRevealOutput, runInputIssue, onEditInput, onRequestFiles, onDelete, setNotice, providerModels: availableProviders, includeCurrentModels = true } = props
  const graph = storedGraph.definition
  const updateNode = (next: GraphNodeDefinition) => nodeId && onUpdateGraph((current) => {
    const updated = { ...current, nodes: { ...current.nodes, [nodeId]: next } }
    return next.type === 'agent' && node?.type === 'agent' && next.provider !== node.provider ? reconcileAgentToolOutput(updated, nodeId) : updated
  })

  if (link) {
    if (link.type === 'merge') {
      const target = graph.nodes[link.targetId]
      const sourceNames = link.sourceIds.map((sourceId) => graph.nodes[sourceId]?.name ?? sourceId)
      return <aside className="inspector"><InspectorTitle icon={<Link2 size={17} />} title={t("Merge")} subtitle={t("{0} upstream → {1}", [link.sourceIds.length, target?.name ?? link.targetId])} kind="link" /><button className="section-action run-linked-agent" type="button" disabled={running || historyViewing || target?.type !== 'agent'} onClick={() => onRunAgent(link.targetId)}><Play size={14} />{t("Run again")}</button><CollapsibleSection sectionKey="merge-sources" title={t("Source")}><div className="merge-summary">{sourceNames.map((name) => <span key={name}>{name}</span>)}<strong>→ {target?.name}</strong></div></CollapsibleSection><button className="danger-button" type="button" onClick={onDelete} disabled={running}><Trash2 size={14} />{t("Delete merge link")}</button></aside>
    }
    const source = graph.nodes[link.sourceId]
    const target = graph.nodes[link.targetId]
    const relations: SingleLinkRelation[] = source?.type === 'input' || source?.type === 'output' ? ['input'] : ['pass', 'review', 'revise']
    return <aside className="inspector"><InspectorTitle icon={<Link2 size={17} />} title={relationLabels[link.type]} subtitle={`${source?.name} → ${target?.name}`} kind="link" /><button className="section-action run-linked-agent" type="button" disabled={running || historyViewing || target?.type !== 'agent'} onClick={() => onRunAgent(link.targetId)}><Play size={14} />{t("Run again")}</button><CollapsibleSection sectionKey="link-relation" title={t("Relation")}><div className="link-endpoints"><span>{source?.name}</span><span>→</span><span>{target?.name}</span></div><div className="field"><span>{t("Type")}</span><MenuSelect ariaLabel={t("Link type")} value={link.type} disabled={running} options={relations.map((relation) => ({ value: relation, label: relationLabels[relation] }))} onChange={(value) => { const type = value as SingleLinkRelation; const issue = validateLinkCandidate(graph, { sourceId: link.sourceId, targetId: link.targetId, type }, link.id); if (issue) { setNotice({ message: linkIssueMessage(issue), tone: 'error' }); return } const result = updateLinkTypeWithPromptDefaultsDetailed(graph, link.id, type); onUpdateGraph(() => result.graph); setNotice({ message: result.promptDefaults === 'updated' ? t("Link type updated and default prompts synchronized for {0}", [target?.name ?? t("Downstream Agent")]) : result.promptDefaults === 'protected' ? t("Link type updated. Custom or locked prompts for {0} retained", [target?.name ?? t("Downstream Agent")]) : t("Link type updated"), tone: 'success' }) }} /></div></CollapsibleSection><button className="danger-button" type="button" onClick={onDelete} disabled={running}><Trash2 size={14} />{t("Delete link")}</button></aside>
  }

  if (!node || !nodeId) {
    return <aside className="inspector"><InspectorTitle icon={<GitBranch size={17} />} title={graph.name} subtitle={t('{0} nodes · {1} links', [Object.keys(graph.nodes).length, graph.links.length])} kind="graph" /><CollapsibleSection sectionKey="graph-settings" title={t("Flow settings")}><div className="inspector-form"><DraftField label={t("Name")} value={graph.name} required disabled={running} onCommit={(name) => onUpdateGraph((current) => ({ ...current, name }))} /><DraftField label={t("Goal")} value={graph.goal} placeholder={FLOW_GOAL_PLACEHOLDER()} multiline disabled={running} onCommit={(goal) => onUpdateGraph((current) => ({ ...current, goal }))} /></div></CollapsibleSection><div className="inspector-empty compact"><Workflow size={20} /><p>{t("Select a node or link to edit its settings")}</p></div></aside>
  }

  const nodeEvents = events.filter((event) => 'nodeId' in event && event.nodeId === nodeId)
  if (node.type === 'input') {
    return <aside className="inspector"><InspectorTitle icon={<FileText size={17} />} title={node.name} subtitle={t("{0} input items", [node.items.length])} kind="input" status={props.status ?? (artifact ? 'completed' : 'idle')} /><CollapsibleSection sectionKey="input-identity" title={t("Input")}><DraftField label={t("Name")} value={node.name} required disabled={running} onCommit={(name) => updateNode({ ...node, name })} /></CollapsibleSection><CollapsibleSection sectionKey="input-content" title={t("Input content")}><InputFields graphId={storedGraph.id} nodeId={nodeId} node={node} disabled={running || historyViewing} onChange={updateNode} onRequestFiles={onRequestFiles} onEditInput={onEditInput} /></CollapsibleSection><CollapsibleSection sectionKey="input-output" title={t("Current output")} defaultOpen={false}>{artifact ? <div className="artifact-row"><div><FileText size={15} /><span>{t("Artifact v")}{artifact.version}</span></div><span>{artifact.parentArtifacts.length} {t("parent")}</span></div> : <p className="muted-copy">{t("Artifacts will be saved here after running")}</p>}</CollapsibleSection><button className="danger-button" type="button" onClick={onDelete} disabled={running}><Trash2 size={14} />{t("Delete input")}</button></aside>
  }
  if (node.type === 'output') {
    const owner = graph.nodes[node.ownerAgentId]
    const files = resultFiles(node, artifact)
    return <aside className="inspector">
      <InspectorTitle icon={<FolderOpen size={17} />} title={files.length === 1 ? files[0]!.name : files.length ? files.length + t(" output files") : node.name} subtitle={owner?.name ?? t("Local Agent output")} kind="output" status={props.status ?? (artifact ? 'completed' : 'idle')} />
      <CollapsibleSection sectionKey="result-output" title={t("Output")}>
        {artifactOptions.length ? <label className="artifact-version-picker"><span>{t("Current artifact")}</span><select value={selectedArtifactId ?? artifactOptions[0]?.id} disabled={running || historyViewing} onChange={event => onSelectArtifact(event.target.value)}>{artifactOptions.map(candidate => <option key={candidate.id} value={candidate.id}>v{candidate.version}{candidate.label ? ' · ' + localizeAppMessage(candidate.label) : ''} · {new Date(candidate.createdAt).toLocaleString(getLocale())}</option>)}</select></label> : null}
        {output && artifact?.files === undefined ? <OutputPreview output={output} onOpen={onOpenOutput} onReveal={() => onRevealOutput()} selectOnly /> : !artifact ? <p className="muted-copy">{t("Run the owning Agent or set a chat reply as output to see it here.")}</p> : null}
      </CollapsibleSection>
      {artifact?.files !== undefined ? <CollapsibleSection sectionKey="output-files" title={t("File")}>
        <NodeFileList items={files.map(file => ({ id: file.relativePath, name: file.name, hidden: resultFileState(node, artifact, file.relativePath) === 'hidden', description: (file.mode === 'text' ? t("Text") : t("Attachments")) + ' · ' + formatBytes(file.size), preview: isMarkdownOutput(file) ? file.content : undefined }))}
          drag={{ graphId: storedGraph.id, nodeId, artifactId: artifact.id }} disabled={running || historyViewing}
          onToggle={id => props.onToggleFile?.(id)} onOpen={id => { const file = files.find(file => file.relativePath === id); if (file && isMarkdownOutput(file)) onOpenOutput(id); else onOpenSystemFile?.(id) }} onReveal={id => onRevealOutput(id)} />
      </CollapsibleSection> : null}
      <p className="output-owner-note">{t("Visible files in this version are sent downstream. Use the eye button to include or exclude a file.")}</p>
    </aside>
  }
  const providerOption = availableProviders.find((item) => item.provider === node.provider)
  const providerSubtitle = providerOption?.connector === 'agent-tool'
    ? t("{0} · Local Agent tool", [providerOption.label])
    : providerOption?.connector === 'subscription'
      ? t("{0} · Subscription account", [providerOption.label])
      : `${providerOption?.label ?? node.provider} · ${node.model}`
  return <aside className="inspector">
    <InspectorTitle icon={<ModelLogo providerId={node.provider} modelId={node.model} name={providerOption?.label ?? node.name} size={32} />} title={node.name} subtitle={providerSubtitle} kind="model" status={props.status ?? (artifact ? 'completed' : 'idle')} />
    <div className="agent-primary-actions"><button className="open-chat-button" type="button" disabled={historyViewing} onClick={onOpenChat}><MessageSquareText size={16} />{t("Open chat")}</button><button className="section-action" type="button" disabled={running || historyViewing || Boolean(runInputIssue)} title={runInputIssue} onClick={() => onRunAgent(nodeId)}><Play size={14} />{t("Run Agent")}</button>
    <div className="agent-range-actions">
      <button className="section-action" type="button" data-run-scope="upstream" disabled={running || historyViewing} title={t('Rerun all upstream dependencies, then this Agent')} onClick={() => props.onRunUpstream?.(nodeId)}><ArrowUp size={14} />{t('Run all upstream')}</button>
      <button className="section-action" type="button" data-run-scope="downstream" disabled={running || historyViewing} title={t('Rerun this Agent and every downstream node, reusing other upstream outputs')} onClick={() => props.onRunDownstream?.(nodeId)}><ArrowDown size={14} />{t('Run all downstream')}</button>
    </div>
    <button className="section-action" type="button" disabled={running || !library.ready} onClick={() => { void library.saveAgent(node).then(() => setNotice({ message: t("“{0}” saved to Agent library", [node.name]), tone: 'success' })).catch((error) => setNotice({ message: String(error), tone: 'error' })) }}><Save size={14} />{t("Save to Agent library")}</button></div>
    <CollapsibleSection sectionKey="agent-identity" title={t("Identity and model")}><AgentIdentityFields includeCurrentModels={includeCurrentModels} node={node} disabled={running} onChange={updateNode} providerModels={availableProviders} /></CollapsibleSection>
    <CollapsibleSection sectionKey="agent-prompts" title={t("Prompts")}><AgentPromptFields node={node} disabled={running} onChange={updateNode} /></CollapsibleSection>
    {providerOption?.connector === 'agent-tool' ? <CollapsibleSection sectionKey="agent-output-files" title={t("Specified output")}><AgentOutputFields outputEntry={ownedOutputEntry(graph, nodeId)} disabled={running} onUpdateGraph={onUpdateGraph} /></CollapsibleSection> : null}
    {providerOption?.connector === 'model' ? <CollapsibleSection sectionKey="agent-advanced" title={t("Advanced parameters")} defaultOpen={false}><AgentAdvancedFields key={nodeId} node={node} disabled={running} onChange={updateNode} /></CollapsibleSection> : null}
    {providerOption?.connector !== 'agent-tool' ? <CollapsibleSection sectionKey="agent-output" title={t("Output")}>{artifactOptions.length ? <label className="artifact-version-picker"><span>{t("Current artifact")}</span><select value={selectedArtifactId ?? artifactOptions[0]?.id} disabled={running || historyViewing} onChange={(event) => onSelectArtifact(event.target.value)}>{artifactOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>v{candidate.version}{candidate.label ? ` · ${localizeAppMessage(candidate.label)}` : ''} · {new Date(candidate.createdAt).toLocaleString(getLocale())}</option>)}</select></label> : null}{output ? <OutputPreview output={output} onOpen={onOpenOutput} onReveal={() => onRevealOutput()} /> : <p className="muted-copy">{t("Agent outputs are saved in artifact history after running.")}</p>}</CollapsibleSection> : null}
    <CollapsibleSection sectionKey="agent-activity" title={t("Activity")}>{nodeEvents.length ? <ol className="event-list">{nodeEvents.slice(0, 5).map((event, index) => <li key={`${event.at}-${index}`}><span className="event-dot" /><span>{localizeAppMessage(event.message)}</span><time>{event.at.slice(11, 19)}</time></li>)}</ol> : <p className="muted-copy">{t("No activity yet")}</p>}</CollapsibleSection>
    <button className="danger-button" type="button" onClick={onDelete} disabled={running}><Trash2 size={14} />{t("Delete Agent")}</button>
  </aside>
}

function OutputPreview({ output, onOpen, onReveal, selectOnly = false }: { output: AgentOutput; onOpen: () => void; onReveal: () => void; selectOnly?: boolean }) {
  const language = useLanguage()

  const preview = <><span><FileText size={15} /><strong>{t("Markdown output")}</strong></span><p>{output.content.slice(0, 180) || t("Empty output")}</p></>
  return <div className="output-preview-block">{selectOnly ? <div className="output-preview">{preview}</div> : <button className="output-preview" type="button" onClick={onOpen}>{preview}</button>}<div className="output-preview-actions"><button className="icon-button" data-output-open type="button" title={t("Open Markdown output")} aria-label={t("Open Markdown output")} onClick={onOpen}><ExternalLink size={15} /></button><button className="icon-button" type="button" title={t("Open in file manager")} aria-label={t("Open Markdown output in file manager")} onClick={onReveal}><FolderOpen size={15} /></button></div></div>
}

function CollapsibleSection({ sectionKey, title, defaultOpen = true, children }: { sectionKey: string; title: string; defaultOpen?: boolean; children: ReactNode }) {
  const language = useLanguage()

  const storageKey = `agentflow.inspector.section.${sectionKey}`
  const [open, setOpen] = useState(() => {
    const saved = window.localStorage.getItem(storageKey)
    return saved === null ? defaultOpen : saved === 'open'
  })
  useEffect(() => window.localStorage.setItem(storageKey, open ? 'open' : 'closed'), [open, storageKey])
  return <section data-section-key={sectionKey} className={`inspector-section collapsible-section ${open ? 'is-open' : ''}`}><button className="inspector-section__toggle" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{title}</span>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>{open ? <div className="inspector-section__body">{children}</div> : null}</section>
}

function AgentIdentityFields({ node, disabled, onChange, providerModels: availableProviders, includeCurrentModels = true }: { node: AgentNodeDefinition; disabled: boolean; onChange: (node: AgentNodeDefinition) => void; includeCurrentModels?: boolean; providerModels: ProviderModelOptions[] }) {
  const language = useLanguage()

  const models = modelOptions(node.provider, node.model, availableProviders, includeCurrentModels)
  const currentProvider = availableProviders.find((item) => item.provider === node.provider)
  return <div className="inspector-form"><DraftField label={t("Name")} value={node.name} required disabled={disabled} onCommit={(name) => onChange({ ...node, name, nameCustomized: true })} /><div className="field-grid"><div className="field"><span>{currentProvider?.connector === 'agent-tool' ? t("Local Agent tools") : currentProvider?.connector === 'subscription' ? t("Subscription accounts") : 'Provider'}</span><ProviderSelect ariaLabel={t("Agent Provider")} value={node.provider} leadingIcon={<ModelLogo providerId={node.provider} modelId={node.model} size={18} />} disabled={disabled} options={availableProviders.map((item) => ({ value: item.provider, label: `${item.label}${item.configured ? '' : t(" · Not configured")}`, icon: <ModelLogo providerId={item.provider} modelId={item.models[0]} name={item.label} size={18} /> }))} onChange={(provider) => onChange({ ...node, provider, parameters: {}, model: availableProviders.find((item) => item.provider === provider)?.models[0] ?? node.model })} /></div><div className="field"><span>{t("Model")}</span><ModelSelect providerId={node.provider} providerName={currentProvider?.label} ariaLabel={t("Agent Model")} value={node.model} leadingIcon={<ModelLogo providerId={node.provider} modelId={node.model} size={18} />} disabled={disabled} options={models.map((model) => ({ value: model, label: model === '@tool-default' ? currentProvider?.connector === 'subscription' ? t("Subscription default model") : t("Tool default model") : model, icon: <ModelLogo providerId={node.provider} modelId={model} size={18} /> }))} onChange={(model) => onChange({ ...node, model, parameters: {} })} /></div></div>{currentProvider?.connector === 'agent-tool' ? <div className="agent-identity-reasoning"><ModelReasoningControl provider={node.provider} model={node.model} parameters={node.parameters} disabled={disabled} onChange={(parameters) => onChange({ ...node, parameters })} /></div> : null}</div>
}

function AgentAdvancedFields({ node, disabled, onChange }: { node: AgentNodeDefinition; disabled: boolean; onChange: (node: AgentNodeDefinition) => void }) {
  const language = useLanguage()

  return <ModelParametersEditor key={node.provider + node.model} provider={node.provider} model={node.model} parameters={node.parameters} disabled={disabled} onChange={(parameters) => onChange({ ...node, parameters })} />
}

function AgentPromptFields({ node, disabled, onChange }: { node: AgentNodeDefinition; disabled: boolean; onChange: (node: AgentNodeDefinition) => void }) {
  const language = useLanguage()

  const update = (kind: keyof AgentNodeDefinition['prompts'], prompt: AgentPromptDefinition) => onChange({ ...node, prompts: { ...node.prompts, [kind]: prompt } })
  return <div className="prompt-stack"><PromptField label={t("System prompt (optional)")} placeholder={t("Describe the Agent’s role, responsibilities, or task")} value={node.prompts.system} disabled={disabled} onChange={(prompt) => update('system', prompt)} /><PromptField label={t("Input prompt (optional)")} placeholder={t("Describe the input the Agent will receive")} value={node.prompts.input} disabled={disabled} onChange={(prompt) => update('input', prompt)} /><PromptField label={t("Output prompt (optional)")} placeholder={t("Describe the output the Agent should produce")} value={node.prompts.output} disabled={disabled} onChange={(prompt) => update('output', prompt)} /></div>
}

function AgentOutputFields({ outputEntry, disabled, onUpdateGraph }: { outputEntry?: [string, OutputNodeDefinition]; disabled: boolean; onUpdateGraph: (transform: (graph: GraphDefinition) => GraphDefinition, bumpRevision?: boolean) => void }) {
  const language = useLanguage()

  if (!outputEntry) return <p className="muted-copy">{t("The result node is being restored. Select this Agent again.")}</p>
  const [outputId, output] = outputEntry
  const update = (patch: Partial<OutputNodeDefinition>) => onUpdateGraph((graph) => ({ ...graph, nodes: { ...graph.nodes, [outputId]: { ...output, ...patch } } }))
  return <div className="agent-output-editor"><label className="field"><span>{t("Output notes (optional)")}</span><textarea rows={3} value={output.note} disabled={disabled} placeholder={t("Define the Agent tool’s output. Text answers are saved as Markdown in the result node.")} onChange={(event) => update({ note: event.target.value })} /></label><label className="agent-output-required"><input type="checkbox" checked={output.extractText} disabled={disabled} onChange={(event) => update({ extractText: event.target.checked })} /><span>{t("Extract file text for downstream input")}</span></label></div>
}

function PromptField({ label, placeholder, value, disabled, onChange }: { label: string; placeholder: string; value: AgentPromptDefinition; disabled: boolean; onChange: (value: AgentPromptDefinition) => void }) {
  const language = useLanguage()

  return <div className={`prompt-field ${value.locked ? 'is-locked' : ''}`}><div className="prompt-field__heading"><span>{label}</span><div><em>{value.customized ? t("Custom") : t("Default")}</em><button type="button" title={value.locked ? t("Allow autofill to modify") : t("Lock this prompt")} aria-label={`${value.locked ? t("Unlock") : t("Lock")} ${label}`} disabled={disabled} onClick={() => onChange({ ...value, locked: !value.locked })}>{value.locked ? <Lock size={13} /> : <Unlock size={13} />}</button></div></div><textarea value={value.content} placeholder={placeholder} disabled={disabled} rows={4} onChange={(event) => onChange({ ...value, content: event.target.value, customized: true })} /></div>
}

function formatBytes(size?: number) {
  if (size === undefined) return t("Unknown size")
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function InspectorTitle({ icon, title, subtitle, kind, status }: { icon: ReactNode; title: string; subtitle: string; kind: string; status?: NodeRuntimeStatus }) {
  const language = useLanguage()

  return <div className="inspector__title"><div className={`node-avatar node-avatar--${kind}`}>{icon}</div><div><h2>{title}</h2><p>{subtitle}</p></div>{status ? <StatusMark status={status} /> : null}</div>
}

interface DraftFieldProps { label: string; value: string; onCommit: (value: string) => void; placeholder?: string; multiline?: boolean; required?: boolean; disabled?: boolean; compact?: boolean }

function DraftField({ label, value, onCommit, placeholder, multiline, required, disabled, compact }: DraftFieldProps) {
  const language = useLanguage()

  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => { const next = required ? draft.trim() : draft; if (required && !next) { setDraft(value); return } if (next !== value) onCommit(next) }
  const shared = { value: draft, placeholder, disabled, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const text = event.target.value; setDraft(text); if (!required || text.trim()) onCommit(text) }, onBlur: commit, onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur() } } }
  return <label className={`field ${compact ? 'is-compact' : ''}`}><span>{label}</span>{multiline ? <textarea {...shared} rows={label.includes('Prompt') ? 5 : 3} /> : <input {...shared} />}</label>
}

interface ChatSessionView { id: string; status: 'idle' | 'running' | 'failed' | 'archived'; messages: AgentSession['messages']; activeLeafMessageId?: string }
interface ChatProps { graphName: string; nodeId: string; node: AgentNodeDefinition; session: ChatSessionView; artifact?: Artifact; composerValue: string; setComposerValue: (value: string) => void; editingMessageId?: string | null; replying: boolean; streamingReply?: string; includeCurrentModels?: boolean; providerModels: ProviderModelOptions[]; onSend: () => void; onBack: () => void; onReset: () => void; onEditMessage: (message: PersistedChatMessage) => void; onCancelEdit: () => void; onDeleteMessage: (messageId: string) => void; onSelectCandidate: (messageId: string) => void; onPublishArtifact: (messageId: string, mode: 'reply' | 'transcript') => void; onModelChange?: (provider: string, model: string) => void; onParametersChange: (parameters: NonNullable<AgentNodeDefinition['parameters']>) => void }

export function ChatSurface({ graphName, nodeId, node, session, artifact, composerValue, setComposerValue, editingMessageId, replying, streamingReply, providerModels: availableProviders, includeCurrentModels = true, onSend, onBack, onReset, onEditMessage, onCancelEdit, onDeleteMessage, onSelectCandidate, onPublishArtifact, onModelChange, onParametersChange }: ChatProps) {
  const language = useLanguage()

  const [parametersOpen, setParametersOpen] = useState(false)
  const selectedProvider = availableProviders.find((item) => item.provider === node.provider)
  const logo = <ModelLogo providerId={node.provider} modelId={node.model} name={selectedProvider?.label ?? node.name} size={28} />
  const visibleMessages = visibleChatMessages(session as AgentSession)
  return <section className="chat-surface">
    <div className="chat-context-strip">
      <button className="context-return" type="button" aria-label={t("Back to Flow")} title={t("Back to {0}", [graphName])} onClick={onBack}><ArrowLeft size={16} /><span>{t("Back to Flow")}</span></button>
      <span>/</span><span>{node.name}</span><span className="chat-context-spacer" />
      {onModelChange ? <div className="chat-model-select"><ProviderSelect ariaLabel={t("Chat provider")} value={node.provider} leadingIcon={<ModelLogo providerId={node.provider} size={17} />} disabled={replying} options={availableProviders.map((provider) => ({ value: provider.provider, label: provider.label, icon: <ModelLogo providerId={provider.provider} size={18} /> }))} onChange={(provider) => { const model = availableProviders.find((item) => item.provider === provider)?.models[0]; if (model) onModelChange(provider, model) }} /><ModelSelect ariaLabel={t("Chat model")} providerId={node.provider} providerName={selectedProvider?.label} value={node.model} leadingIcon={<ModelLogo providerId={node.provider} modelId={node.model} size={17} />} disabled={replying} options={modelOptions(node.provider, node.model, availableProviders, includeCurrentModels).map((model) => ({ value: model, label: model === '@tool-default' ? t("Tool default model") : model, icon: <ModelLogo providerId={node.provider} modelId={model} size={18} /> }))} onChange={(model) => onModelChange(node.provider, model)} /></div> : null}
      <button className="chat-parameters-toggle" type="button" aria-expanded={parametersOpen} aria-label={t("Chat model parameters")} onClick={() => setParametersOpen(!parametersOpen)}><Settings size={15} /><span>{t("Parameters")}</span></button>
      <button className="chat-reset" type="button" aria-label={t("Reset session")} onClick={onReset}><RotateCcw size={12} /><span className="chat-reset__label">{t("Reset session")}</span></button>
      <span className="chat-session-id">{artifact ? t('Artifact v{0}', [artifact.version]) : session.id.slice(0, 14)}</span>
    </div>
    <div className="chat-body"><div className="chat-scroll"><div className="chat-thread">
      <div className="chat-intro"><ModelLogo providerId={node.provider} modelId={node.model} name={selectedProvider?.label ?? node.name} size={48} className="chat-agent-logo" /><h1>{node.name}</h1><p>{selectedProvider?.label ?? node.provider}{selectedProvider?.connector === 'agent-tool' ? t(" · Local Agent tool") : selectedProvider?.connector === 'subscription' ? t(" · Subscription account") : ` · ${node.model}`}</p></div>
      {visibleMessages.map((message) => <ChatMessage key={message.id} message={message} session={session as AgentSession} logo={logo} onEdit={onEditMessage} onDelete={onDeleteMessage} onSelectCandidate={onSelectCandidate} onPublish={onPublishArtifact} />)}
      {replying ? <article className="message message--assistant"><div className="message__identity has-model-logo">{logo}</div>{streamingReply ? <div className="message__content">{streamingReply}</div> : <div className="typing-indicator"><i /><i /><i /></div>}</article> : null}
    </div></div>
    {parametersOpen ? <aside className="chat-parameters-panel" aria-label={t("Chat parameters")}><header><h2>{t("Model parameters")}</h2><button className="icon-button" type="button" aria-label={t("Close model parameters")} onClick={() => setParametersOpen(false)}><X size={16} /></button></header><ModelParametersEditor key={nodeId + node.provider + node.model} provider={node.provider} model={node.model} parameters={node.parameters} disabled={replying} customParametersEnabled={selectedProvider?.connector === 'model'} onChange={onParametersChange} /></aside> : null}</div>
    <div className="composer-wrap">{editingMessageId ? <div className="composer-editing"><Pencil size={13} /><span>{t("Creating an alternative response to this message")}</span><button type="button" onClick={onCancelEdit}>{t("Cancel")}</button></div> : null}<div className="composer"><textarea value={composerValue} onChange={(event) => setComposerValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() } }} placeholder={t("Send a message to {0}", [node.name])} rows={1} /><div className="composer__footer"><span><GitBranch size={13} />{t("Flow context ·")} {nodeId}</span><button className="send-button" type="button" aria-label={t("Send message")} onClick={onSend} disabled={!composerValue.trim() || replying}><Send size={15} /></button></div></div><p className="composer-hint">{t("Enter to send · Shift + Enter for a new line")}</p></div>
  </section>
}

function ChatMessage({ message, session, logo, onEdit, onDelete, onSelectCandidate, onPublish }: { message: PersistedChatMessage; session: AgentSession; logo: ReactNode; onEdit: (message: PersistedChatMessage) => void; onDelete: (messageId: string) => void; onSelectCandidate: (messageId: string) => void; onPublish: (messageId: string, mode: 'reply' | 'transcript') => void }) {
  const language = useLanguage()

  const candidates = messageCandidates(session, message.id)
  const candidateIndex = candidates.findIndex((candidate) => candidate.id === message.id)
  const selectOffset = (offset: number) => {
    const candidate = candidates[candidateIndex + offset]
    if (candidate) onSelectCandidate(candidate.id)
  }
  return <article className={`message message--${message.role}`}>
    <div className={`message__identity ${message.role === 'assistant' ? 'has-model-logo' : ''}`}>{message.role === 'assistant' ? logo : <span>{t("You")}</span>}</div>
    <div className="message__body">
      <div className="message__content">{message.role === 'assistant' ? <><ResponseReasoning parts={message.parts} /><MarkdownContent content={message.content} /></> : message.content}</div>
      <div className="message__meta">
        <div className="message__actions">
          <MessageCopyButton content={message.content} />
          <button type="button" aria-label={t("Edit message")} title={t("Edit message")} onClick={() => onEdit(message)}><Pencil size={12} /></button>
          <button type="button" aria-label={t("Delete message")} title={t("Delete message")} onClick={() => onDelete(message.id)}><Trash2 size={12} /></button>
          {message.role === 'assistant' ? <>
            <button type="button" aria-label={t("Set this reply as result output")} title={t("Set this reply as result output")} onClick={() => onPublish(message.id, 'reply')}><Check size={12} /></button>
            <button type="button" aria-label={t("Set the conversation up to this point as result output")} title={t("Set the conversation up to this point as result output")} onClick={() => onPublish(message.id, 'transcript')}><FileOutput size={12} /></button>
          </> : null}
        </div>
        {candidates.length > 1 ? <div className="message-candidates"><button type="button" aria-label={t("Previous response")} disabled={candidateIndex <= 0} onClick={() => selectOffset(-1)}><ChevronLeft size={13} /></button><span>{candidateIndex + 1} / {candidates.length}</span><button type="button" aria-label={t("Next response")} disabled={candidateIndex >= candidates.length - 1} onClick={() => selectOffset(1)}><ChevronRight size={13} /></button></div> : null}
      </div>
    </div>
  </article>
}

export function IncomingLinkConflictDialog({ targetName, incomingSourceName, existingSourceNames, canMerge, mergeDisabledReason, onCopy, onMerge, onCancel }: {
  targetName: string
  incomingSourceName: string
  existingSourceNames: string[]
  canMerge: boolean
  mergeDisabledReason?: string
  onCopy: () => void
  onMerge: () => void
  onCancel: () => void
}) {
  const language = useLanguage()

  return <div className="dialog-backdrop" role="presentation">
    <section className="incoming-link-dialog" role="dialog" aria-modal="true" aria-labelledby="incoming-link-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel() } }}>
      <div className="dialog-heading">
        <div className="dialog-icon dialog-icon--warning"><AlertTriangle size={17} /></div>
        <div><h2 id="incoming-link-title">{targetName} {t("An upstream Agent link already exists")}</h2><p>{t("Agent sources must share one incoming link. Multiple input links are supported.")}</p></div>
      </div>
      <div className="incoming-link-route" aria-label={t("New connection: {0} to {1}", [incomingSourceName, targetName])}><span>{incomingSourceName}</span><span>→</span><strong>{targetName}</strong></div>
      <p className="incoming-link-existing">{t("Current Agent sources:")}{existingSourceNames.join(t(', '))}</p>
      <p className="incoming-link-guidance">{t("Duplicate creates a downstream Agent copy for the new link. Merge combines the existing and new sources into one link.")}</p>
      {!canMerge && mergeDisabledReason ? <p className="incoming-link-disabled" role="status">{mergeDisabledReason}</p> : null}
      <div className="dialog-actions incoming-link-actions">
        <button className="quiet-button" type="button" onClick={onCancel}>{t("Cancel")}</button>
        <button className="secondary-button" type="button" autoFocus onClick={onCopy}><Copy size={14} />{t("Duplicate downstream Agent")}</button>
        <button className="primary-button" type="button" disabled={!canMerge} title={mergeDisabledReason} onClick={onMerge}><GitMerge size={14} />{t("Merge sources")}</button>
      </div>
    </section>
  </div>
}

export function PromptAutofillDialog({ plan, providers, providerId, model, busy, onProviderChange, onModelChange, onCancel, onConfirm, onStop }: {
  plan: PromptAutofillPlan
  providers: ProviderModelOptions[]
  providerId: string
  model: string
  busy: boolean
  onProviderChange: (providerId: string) => void
  onModelChange: (model: string) => void
  onCancel: () => void
  onConfirm: (mode: PromptAutofillMode) => void
  onStop: () => void
}) {
  const language = useLanguage()

  const blankCount = plan.agents.reduce((count, agent) => count + agent.blankFields.length, 0)
  const defaultCount = plan.agents.reduce((count, agent) => count + agent.defaultFields.length, 0)
  const existingCount = plan.agents.reduce((count, agent) => count + agent.existingFields.length, 0)
  const lockedCount = plan.agents.reduce((count, agent) => count + agent.lockedFields.length, 0)
  const selectionReady = providers.some((provider) => provider.provider === providerId && provider.models.includes(model))
  return <div className="dialog-backdrop" role="presentation"><section className="prompt-autofill-dialog" role="dialog" aria-modal="true" aria-labelledby="prompt-autofill-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); if (busy) onStop(); else onCancel() } }}>
    <div className="dialog-heading"><div className="dialog-icon"><Sparkles size={17} /></div><div><h2 id="prompt-autofill-title">{t("Confirm prompt autofill")}</h2><p>{t("Review the generation scope.")}</p></div></div>
    <FeatureModelPicker ariaPrefix={t("Autofill prompts")} providers={providers} providerId={providerId} model={model} disabled={busy} onProviderChange={onProviderChange} onModelChange={onModelChange} />
    <div className="prompt-autofill-summary"><strong>{blankCount + defaultCount}</strong><span>{t("blank or default prompts ·")} {plan.agents.length} {t("connected Agents")}</span></div>
    <p className="diagnostic-scope-label">{t("Prompts to update")}</p>
    <DiagnosticSection title={t("Blank prompts")} entries={plan.agents.filter((agent) => agent.blankFields.length).map((agent) => `${agent.name} · ${formatPromptFields(agent.blankFields)}`)} empty={t("No blank prompts")} />
    {defaultCount ? <DiagnosticSection title={t("Default prompts")} entries={plan.agents.filter((agent) => agent.defaultFields.length).map((agent) => `${agent.name} · ${formatPromptFields(agent.defaultFields)}`)} /> : null}
    {existingCount ? <><p className="diagnostic-scope-label">{t("Modified, unlocked prompts to overwrite")}</p><DiagnosticSection title={t("Modified, unlocked prompts")} tone="warning" entries={plan.agents.filter((agent) => agent.existingFields.length).map((agent) => `${agent.name} · ${formatPromptFields(agent.existingFields)}`)} /></> : null}
    {lockedCount ? <DiagnosticSection title={t("Keep locked")} tone="locked" entries={plan.agents.filter((agent) => agent.lockedFields.length).map((agent) => `${agent.name} · ${formatPromptFields(agent.lockedFields)}`)} /> : null}
    {plan.disconnectedAgents.length || plan.disconnectedInputs.length ? <DiagnosticSection title={t("Disconnected · Skipped")} tone="warning" entries={[...plan.disconnectedAgents.map((agent) => `Agent · ${agent.name}`), ...plan.disconnectedInputs.map((input) => `${t('Input')} · ${input.name}`)]} /> : null}
    {!plan.connectedInputCount ? <div className="diagnostic-warning" role="status"><AlertTriangle size={15} /><span>{t("No input is connected yet. Prompt inference may be less accurate.")}</span></div> : null}
    <div className="autofill-data-note"><small>{t("Input summaries use up to 12 lines and 1,600 characters per item, with 6,000 characters in total.")}</small></div>
    <div className="dialog-actions prompt-autofill-actions"><button className="quiet-button" type="button" onClick={onCancel} disabled={busy}>{t("Cancel")}</button>{busy ? <button className="primary-button" type="button" onClick={onStop}><Square size={14} />{t("Stop autofill")}</button> : existingCount ? <><button className="secondary-button" type="button" disabled={!selectionReady || (!blankCount && !defaultCount)} title={!blankCount && !defaultCount ? t("No blank or default prompts") : undefined} onClick={() => onConfirm('blank-and-default')}><Sparkles size={14} />{t("Fill blank and default prompts")}</button><button className="primary-button" type="button" disabled={!selectionReady} onClick={() => onConfirm('all-unlocked')}><RotateCcw size={14} />{t("Overwrite all")}</button></> : <button className="primary-button" type="button" disabled={!selectionReady || !plan.agents.length || (!blankCount && !defaultCount)} onClick={() => onConfirm('all-unlocked')}><Sparkles size={14} />{t("Confirm and autofill")}</button>}</div>
  </section></div>
}

export function ExistingFlowGenerationDialog({ agentCount, onExtend, onReplace, onCancel }: { agentCount: number; onExtend: () => void; onReplace: () => void; onCancel: () => void }) {
  const language = useLanguage()

  return <div className="dialog-backdrop" role="presentation"><section className="prompt-autofill-dialog existing-flow-generation-dialog" role="dialog" aria-modal="true" aria-labelledby="existing-flow-generation-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel() } }}>
    <div className="dialog-heading"><div className="dialog-icon dialog-icon--warning"><AlertTriangle size={17} /></div><div><h2 id="existing-flow-generation-title">{t("This Flow already has Agents")}</h2><p>{agentCount} {t("Agents already exist. Choose how to handle the current structure.")}</p></div></div>
    <div className="generation-mode-summary"><p><strong>{t("Extend")}</strong><span>{t("Add new Agents to the existing Agents, links, prompts, and outputs.")}</span></p><p><strong>{t("Replace current Flow")}</strong><span>{t("Keep inputs and replace current Agents, links, and output selections.")}</span></p></div>
    <div className="dialog-actions generation-mode-actions"><button className="quiet-button" type="button" onClick={onCancel}>{t("Cancel")}</button><button className="secondary-button" type="button" onClick={onReplace}>{t("Replace current Flow")}</button><button className="primary-button" type="button" autoFocus onClick={onExtend}><Plus size={14} />{t("Extend existing Flow")}</button></div>
  </section></div>
}

export function FlowGenerationDialog({ description, inputSummary, mode, existingAgentCount, providers, providerId, model, busy, preview, onProviderChange, onModelChange, onDescriptionChange, onCancel, onGenerate, onApply, onStop }: {
  description: string
  inputSummary: FlowGenerationInputSummary
  mode: FlowGenerationMode
  existingAgentCount: number
  providers: ProviderModelOptions[]
  providerId: string
  model: string
  busy: boolean
  preview: FlowGenerationPreview | null
  onProviderChange: (providerId: string) => void
  onModelChange: (model: string) => void
  onDescriptionChange: (value: string) => void
  onCancel: () => void
  onGenerate: () => void
  onApply: () => void
  onStop: () => void
}) {
  const language = useLanguage()

  const inputCopy = inputSummary.inputCount
    ? t("{0} inputs · {1} items used as summary context", [inputSummary.inputCount, inputSummary.itemCount])
    : t("No inputs · Build from description")
  const previewAgents = preview ? Object.values(preview.graph.nodes).filter((node) => node.type === 'agent') : []
  const previewInputs = preview ? Object.values(preview.graph.nodes).filter((node) => node.type === 'input') : []
  const generatedPreviewAgents = mode === 'extend' && preview ? previewAgents.slice(-preview.response.agents.length) : previewAgents
  const existingPreviewAgents = mode === 'extend' ? previewAgents.slice(0, Math.max(0, previewAgents.length - generatedPreviewAgents.length)) : []
  const selectionReady = providers.some((provider) => provider.provider === providerId && provider.models.includes(model))
  return <div className="dialog-backdrop" role="presentation"><section className="prompt-autofill-dialog flow-generation-dialog" role="dialog" aria-modal="true" aria-labelledby="flow-generation-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); if (busy) onStop(); else onCancel() } }}>
    <div className="dialog-heading"><div className="dialog-icon"><Workflow size={17} /></div><div><h2 id="flow-generation-title">{t("Generate Flow from description")}</h2></div></div>
    <FeatureModelPicker ariaPrefix={t("Generate Flow from description")} providers={providers} providerId={providerId} model={model} disabled={busy} onProviderChange={onProviderChange} onModelChange={onModelChange} />
    {mode === 'extend' ? <div className="flow-generation-mode"><GitBranch size={14} /><span>{t("Extend · Keep existing")} {existingAgentCount} {t("Agents")}</span></div> : existingAgentCount ? <div className="flow-generation-mode is-replace"><RotateCcw size={14} /><span>{t("Replace · Keep inputs and replace existing Agents")}</span></div> : null}
    <label className="flow-generation-prompt"><span>{t("How should this Flow work together?")}</span><textarea autoFocus={!preview} rows={5} maxLength={8000} disabled={busy} value={description} placeholder={t("For example: Read each interview, extract facts and themes, have a review Agent check the evidence, then generate a structured research summary.")} onChange={(event) => onDescriptionChange(event.target.value)} /><small>{description.length.toLocaleString(getLocale())} / 8,000</small></label>
    <div className="flow-generation-context"><strong>{inputSummary.inputCount}</strong><span>{inputCopy}</span></div>
    {inputSummary.inputCount ? <div className="autofill-data-note"><small>{t("Reads up to 12 lines and 1,600 characters per item, with 6,000 characters across all inputs")}{inputSummary.truncated ? t("; this summary was truncated") : ''}{t('.')}</small></div> : null}
    {preview ? <div className="flow-generation-preview">
      <div className="flow-generation-preview__heading"><span>{t("Generate preview")}</span><strong>{preview.graph.name}</strong><p>{preview.graph.goal}</p></div>
      <div className="flow-generation-preview__stats"><span><strong>{preview.response.agents.length}</strong> {mode === 'extend' ? t("New Agents") : t('Agents')}</span><span><strong>{mode === 'extend' ? preview.response.routes.length : preview.graph.links.length}</strong> {mode === 'extend' ? t("New links") : t('Links')}</span><span><strong>{Object.values(preview.graph.nodes).filter((node) => node.type === 'input').length}</strong> {t("Inputs")}</span></div>
      <DiagnosticSection title={mode === 'extend' ? t("New Agent") : 'Agent'} entries={generatedPreviewAgents.map((agent) => `${agent.name} · ${agent.provider} / ${agent.model}`)} />
      <DiagnosticSection title={t("Information flow")} entries={preview.response.routes.map((route) => {
        const sources = route.inputSources
          ? route.inputSources.map((index) => previewInputs[index]?.name ?? t('Input {0}', [index + 1]))
          : route.existingAgentSources
            ? route.existingAgentSources.map((index) => existingPreviewAgents[index]?.name ?? t("Existing Agent {0}", [index + 1]))
            : (route.agentSources ?? []).map((index) => generatedPreviewAgents[index]?.name ?? t("New Agent {0}", [index + 1]))
        const agentSourceCount = route.existingAgentSources?.length ?? route.agentSources?.length ?? 0
        const relation = route.inputSources ? 'input' : agentSourceCount > 1 ? 'merge' : route.relation
        return `${sources.join(' + ')} → ${generatedPreviewAgents[route.target]?.name ?? t("New Agent {0}", [route.target + 1])} · ${relation}`
      })} />
    </div> : null}
    <div className="dialog-actions flow-generation-actions"><button className="quiet-button" type="button" onClick={onCancel} disabled={busy}>{t("Cancel")}</button>{preview && !busy ? <button className="secondary-button" type="button" onClick={onGenerate} disabled={!selectionReady || !description.trim()}><RotateCcw size={14} />{t("Regenerate")}</button> : null}<button className="primary-button" type="button" onClick={busy ? onStop : preview ? onApply : onGenerate} disabled={!busy && (!selectionReady || (!preview && !description.trim()))}>{busy ? <><Square size={14} />{t("Stop generation")}</> : preview ? <><Check size={14} />{mode === 'extend' ? t("Add to Flow") : existingAgentCount ? t("Replace Flow") : t("Apply Flow")}</> : <><Workflow size={14} />{t("Generate preview")}</>}</button></div>
  </section></div>
}

function FeatureModelPicker({ ariaPrefix, providers, providerId, model, disabled, onProviderChange, onModelChange }: {
  ariaPrefix: string
  providers: ProviderModelOptions[]
  providerId: string
  model: string
  disabled: boolean
  onProviderChange: (providerId: string) => void
  onModelChange: (model: string) => void
}) {
  const language = useLanguage()

  const selectedProvider = providers.find((provider) => provider.provider === providerId)
  return <div className="feature-model-picker" aria-label={t("{0} generation model", [ariaPrefix])}>
    <ModelLogo providerId={providerId} modelId={model} name={selectedProvider?.label ?? providerId} size={28} />
    <div className="feature-model-picker__fields">
      <label><span>{t("Provider")}</span><ProviderSelect ariaLabel={t('{0} provider', [ariaPrefix])} value={providerId} placeholder={t("Choose a connected provider")} disabled={disabled || !providers.length} options={providers.map((provider) => ({ value: provider.provider, label: provider.label, icon: <ModelLogo providerId={provider.provider} name={provider.label} size={18} /> }))} onChange={onProviderChange} /></label>
      <label><span>{t("Model")}</span><ModelSelect providerId={providerId} providerName={selectedProvider?.label} ariaLabel={t("{0} model", [ariaPrefix])} value={model} placeholder={selectedProvider ? t("Choose model") : t("Choose a provider first")} disabled={disabled || !selectedProvider} options={(selectedProvider?.models ?? []).map((candidate) => ({ value: candidate, label: candidate === '@tool-default' ? t("Tool default model") : candidate, icon: <ModelLogo providerId={providerId} modelId={candidate} name={candidate} size={18} /> }))} onChange={onModelChange} /></label>
    </div>
  </div>
}

export function RunConfirmationDialog({ plan, configurationIssues, onCancel, onConfirm }: { plan: FlowRunPlan; configurationIssues: string[]; onCancel: () => void; onConfirm: () => void }) {
  const language = useLanguage()

  return <div className="dialog-backdrop" role="presentation"><section className="prompt-autofill-dialog run-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="run-confirmation-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel() } }}>
    <div className="dialog-heading"><div className="dialog-icon dialog-icon--run"><Play size={16} fill="currentColor" /></div><div><h2 id="run-confirmation-title">{t("Confirm Flow run")}</h2><p>{t("Review inputs and execution scope.")}</p></div></div>
    <div className="prompt-autofill-summary"><strong>{plan.runnableAgents.length}</strong><span>{t("Agents to run ·")} {plan.connectedInputs.length} {t("inputs")}</span></div>
    {plan.batchSize > 1 ? <div className="run-batch-summary"><strong>{plan.batchSize}</strong><span>{t("groups run sequentially · Multiple inputs are matched row by row in list order")}</span></div> : null}
    <DiagnosticSection title={t("Will run")} entries={plan.runnableAgents.map((agent) => agent.name)} empty={t("No runnable Agents")} />
    {plan.emptyPromptAgents.length ? <DiagnosticSection title={t("Blank prompts")} tone="warning" entries={plan.emptyPromptAgents.map((agent) => `${agent.name} · ${formatPromptFields(agent.fields)}`)} /> : null}
    {plan.defaultPromptAgents.length ? <DiagnosticSection title={t("Default prompt values")} tone="warning" entries={plan.defaultPromptAgents.map((agent) => `${agent.name} · ${formatPromptFields(agent.fields)}`)} /> : null}
    {plan.skippedAgents.length ? <DiagnosticSection title={t("Disconnected · Will not run")} tone="warning" entries={plan.skippedAgents.map((agent) => t("{0} · Unreachable from input", [agent.name]))} /> : null}
    {plan.emptyInputs.length ? <DiagnosticSection title={t("Empty inputs")} tone="warning" entries={plan.emptyInputs.map((input) => input.name)} /> : null}
    {configurationIssues.length ? <DiagnosticSection title={t("Resolve before running")} tone="warning" entries={configurationIssues} /> : null}
    {plan.batchIssues.length ? <DiagnosticSection title={t("Batch input issues")} tone="warning" entries={plan.batchIssues} /> : null}
    {!plan.connectedInputs.length ? <div className="diagnostic-warning is-blocking" role="alert"><AlertTriangle size={15} /><span>{t("Connect at least one input before running.")}</span></div> : null}
    <div className="dialog-actions"><button className="quiet-button" type="button" onClick={onCancel}>{t("Cancel")}</button><button className="flow-run-confirm" type="button" disabled={!plan.canRun || configurationIssues.length > 0} onClick={onConfirm}><Play size={14} fill="currentColor" />{t("Run Flow")}</button></div>
  </section></div>
}

export function HistoricalFlowBranchDialog({ flowName, stateName, onCancel, onConfirm }: { flowName: string; stateName: string; onCancel: () => void; onConfirm: () => void }) {
  const language = useLanguage()

  return <div className="dialog-backdrop" role="presentation"><section className="prompt-autofill-dialog run-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="historical-flow-branch-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel() } }}>
    <div className="dialog-heading"><div className="dialog-icon"><GitFork size={17} /></div><div><h2 id="historical-flow-branch-title">{t("Create a local branch?")}</h2><p>{t("Editing “{0}” at historical state “{1}”.", [flowName, stateName])}</p></div></div>
    <p className="dialog-copy">{t("Continue to create a new Flow in the current project.")}</p>
    <div className="dialog-actions"><button className="quiet-button" type="button" onClick={onCancel}>{t("Cancel")}</button><button className="primary-button" type="button" autoFocus onClick={onConfirm}><GitFork size={14} />{t("Create branch")}</button></div>
  </section></div>
}

export function UnsupportedFilesDialog({ nodeName, files, onCancel, onContinue, onReset }: { nodeName: string; files: string[]; onCancel: () => void; onContinue: () => void; onReset: () => void }) {
  const language = useLanguage()

  return <div className="dialog-backdrop" role="presentation"><section className="prompt-autofill-dialog run-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="unsupported-files-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel() } }}>
    <div className="dialog-heading"><div className="dialog-icon dialog-icon--warning"><AlertTriangle size={17} /></div><div><h2 id="unsupported-files-title">{t("Flow paused")}</h2><p>{t("{0} cannot receive the following files.", [nodeName])}</p></div></div>
    <DiagnosticSection title={t("Unsupported files")} tone="warning" entries={files} />
    <div className="dialog-actions"><button className="quiet-button" type="button" onClick={onReset}><RotateCcw size={14} />{t("Reset state")}</button><button className="quiet-button" type="button" onClick={onCancel}>{t("Handle later")}</button><button className="flow-run-confirm" type="button" onClick={onContinue}><Play size={14} fill="currentColor" />{t("Skip files and continue")}</button></div>
  </section></div>
}

export function MissingUpstreamDialog({ targetName, upstreamNames, onCancel, onRunFromStart }: { targetName: string; upstreamNames: string[]; onCancel: () => void; onRunFromStart: () => void }) {
  const language = useLanguage()

  return <div className="dialog-backdrop" role="presentation"><section className="prompt-autofill-dialog run-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="missing-upstream-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel() } }}>
    <div className="dialog-heading"><div className="dialog-icon"><AlertTriangle size={17} /></div><div><h2 id="missing-upstream-title">{t("Upstream output is missing")}</h2><p>{t("{0} is missing output from {1}.", [targetName, upstreamNames.join(" / ")])}</p></div></div>
    <p className="dialog-copy">{t('Rerun all dependencies from input through {0}.', [targetName])}</p>
    <div className="dialog-actions"><button className="quiet-button" type="button" onClick={onCancel}>{t("Cancel")}</button><button className="primary-button" type="button" onClick={onRunFromStart}><Play size={14} />{t("Run all upstream")}</button></div>
  </section></div>
}

function DiagnosticSection({ title, entries, empty, tone = 'default' }: { title: string; entries: string[]; empty?: string; tone?: 'default' | 'locked' | 'warning' }) {
  const language = useLanguage()

  return <section className={`diagnostic-section is-${tone}`}><h3>{title}</h3>{entries.length ? <ul>{entries.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ul> : empty ? <p>{empty}</p> : null}</section>
}

function formatPromptFields(fields: PromptFieldKind[]) {
  const labels: Record<PromptFieldKind, string> = { system: t('System'), input: t('Input'), output: t('Output') }
  return fields.map((field) => labels[field]).join(t(', '))
}

export function FileImportDialog({ files, onCancel, onConfirm }: { files: File[]; onCancel: () => void; onConfirm: () => void }) {
  const language = useLanguage()

  const entries = files.map((file) => ({ file, kind: classifyInputFile(file) }))
  const accepted = entries.filter((entry) => entry.kind !== 'unsupported').length
  return <div className="dialog-backdrop" role="presentation"><section className="file-import-dialog" role="dialog" aria-modal="true" aria-labelledby="file-import-title"><div className="dialog-heading"><div className="dialog-icon"><Upload size={17} /></div><div><h2 id="file-import-title">{t("Add files")}</h2><p>{accepted} {t("files ready")}</p></div></div><div className="import-file-list">{entries.map(({ file, kind }) => <div className={kind === 'unsupported' ? 'is-filtered' : ''} key={`${file.name}-${file.size}`}><FileText size={14} /><span>{file.name}</span><small>{kind === 'text' ? t("Extract text") : kind === 'image' ? t("Images") : t("Filtered")}</small></div>)}</div><div className="dialog-actions"><button className="quiet-button" type="button" onClick={onCancel}>{t("Cancel")}</button><button className="primary-button" type="button" disabled={!accepted} onClick={onConfirm}><Upload size={14} />{t("Add to input")}</button></div></section></div>
}

interface SaveProjectDialogProps {
  temporaryProject: ProjectDefinition
  savedProjects: ProjectDefinition[]
  onCancel: () => void
  onSaveAsNew: (name: string, rootPath: string) => Promise<void>
  onMergeIntoProject: (targetProjectId: string, overwriteConflicts: boolean) => Promise<WorkspaceMergeResult>
}

export function SaveProjectDialog({ temporaryProject, savedProjects, onCancel, onSaveAsNew, onMergeIntoProject }: SaveProjectDialogProps) {
  const language = useLanguage()

  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [name, setName] = useState(temporaryProject.name)
  const [rootPath, setRootPath] = useState('')
  const chooseLocation = async () => {
    if (!window.agentflowDesktop) { setError(t("Choose a project directory in the desktop app")); return }
    try { const path = await window.agentflowDesktop.chooseDirectory(); if (path) setRootPath(path) }
    catch (error) { setError(error instanceof Error ? error.message : t("Could not choose directory")) }
  }
  const [targetProjectId, setTargetProjectId] = useState(savedProjects[0]?.id ?? '')
  const [conflicts, setConflicts] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveAsNew = async () => {
    if (!name.trim() || !rootPath || busy) return
    setBusy(true)
    setError(null)
    try { await onSaveAsNew(name.trim(), rootPath) }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("Save failed. Try again.")); setBusy(false) }
  }

  const mergeIntoProject = async (overwriteConflicts: boolean) => {
    if (!targetProjectId || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await onMergeIntoProject(targetProjectId, overwriteConflicts)
      if (result.conflicts.length) {
        setConflicts(result.conflicts)
        setBusy(false)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("Could not move into the destination project."))
      setBusy(false)
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="save-project-dialog" role="dialog" aria-modal="true" aria-labelledby="save-project-title" onKeyDown={(event) => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onCancel() } }}><div className="save-dialog-heading"><div><h2 id="save-project-title">{t("Save temporary project")}</h2><p>{t("Choose where to save the project.")}</p></div></div><div className="save-mode-switch" role="tablist" aria-label={t("Save method")}><button type="button" role="tab" aria-selected={mode === 'new'} className={mode === 'new' ? 'is-active' : ''} onClick={() => { setMode('new'); setConflicts([]); setError(null) }}>{t("New project")}</button><button type="button" role="tab" aria-selected={mode === 'existing'} className={mode === 'existing' ? 'is-active' : ''} disabled={!savedProjects.length} onClick={() => { setMode('existing'); setConflicts([]); setError(null) }}>{t("Move into existing project")}</button></div>{mode === 'new' ? <div className="save-dialog-body"><label className="field"><span>{t("Project name")}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveAsNew() }} /></label><div className="field"><span>{t("Save location")}</span><div className="save-location"><input aria-label={t("Save location")} value={rootPath} readOnly placeholder={t("Choose the project folder")} /><button type="button" className="secondary-button" onClick={() => void chooseLocation()}><FolderOpen size={14} />{t("Choose directory")}</button></div></div><p className="save-explanation">{t("Project configuration, inputs, Markdown outputs, and attachments are saved in the selected directory’s .flow folder.")}</p></div> : <div className="save-dialog-body"><div className="field"><span>{t("Destination project")}</span><MenuSelect ariaLabel={t("Destination project")} value={targetProjectId} options={savedProjects.map((project) => ({ value: project.id, label: `${project.name} · ${workspaceLabel(project.workspace)}` }))} onChange={(value) => { setTargetProjectId(value); setConflicts([]) }} /></div><p className="save-explanation">{t("Flows are added to the destination project. Temporary files are copied using their relative paths, without merging file contents.")}</p>{conflicts.length ? <div className="file-conflicts" role="alert"><div><AlertTriangle size={16} /><strong>{t("Found")} {conflicts.length} {t("files with different contents at the same paths")}</strong></div><p>{t("No files have been copied yet. Overwriting will replace the destination files.")}</p><ul>{conflicts.slice(0, 5).map((path) => <li key={path}>{path}</li>)}</ul>{conflicts.length > 5 ? <small>{t("Plus")} {conflicts.length - 5} {t("conflicting files")}</small> : null}</div> : null}</div>}{error ? <p className="save-dialog-error" role="alert">{error}</p> : null}<div className="save-dialog-actions"><button className="quiet-button" type="button" onClick={onCancel} disabled={busy}>{t("Cancel")}</button>{mode === 'new' ? <button className="primary-button" type="button" onClick={() => void saveAsNew()} disabled={!name.trim() || !rootPath || busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Save size={14} />}{t("Save as new project")}</button> : conflicts.length ? <button className="danger-confirm-button" type="button" onClick={() => void mergeIntoProject(true)} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <AlertTriangle size={14} />}{t("Overwrite conflicts and move")}</button> : <button className="primary-button" type="button" onClick={() => void mergeIntoProject(false)} disabled={!targetProjectId || busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <FolderOpen size={14} />}{t("Check and move")}</button>}</div></section></div>
}

export function linkIssueMessage(issue: LinkCandidateError) {
  const messages: Record<LinkCandidateError, string> = {
    'missing-node': t("The link references a missing node"),
    'self-link': t("A node cannot connect to itself"),
    'invalid-target': t("The link target must be an Agent"),
    'invalid-input-relation': t("The relation type does not match the input and Agent"),
    'merge-needs-sources': t("A merge requires at least two upstream Agents or results"),
    'merge-source-must-be-agent': t("Merge sources must all be Agents or results"),
    'agent-output-required': t("Local Agent tools connect downstream through their result nodes"),
    'duplicate-link': t("A link already exists between these nodes"),
    cycle: t("This link would create a cycle. The current version supports DAGs")
  }
  return messages[issue]
}
