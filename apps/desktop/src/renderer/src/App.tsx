import { localizeAppMessage } from '@agentflow/core/localization'
import { localizeWorkspaceDefaults } from './workspace-language'
import { flowAccessibilityLabels } from './flow-accessibility'
import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type OnConnectStartParams,
  type Node as FlowNode,
  type NodeChange
} from '@xyflow/react'
import { Check, CircleX, Copy, FilePlus2, Files, Group, Play, Save, Settings, Link2, MessageSquareText, Plus, Trash2, Undo2, Workflow, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type CSSProperties,
  type SetStateAction
} from 'react'
import { effectiveModelParameters, executeGraph, featureReasoningParameters, modelAttachmentIssue, resultFiles, visibleInputItems, type Artifact, type ModelMessage, type NodeRuntimeStatus, type RuntimeEvent } from '@agentflow/core'
import { detachNodeFiles, NODE_FILES_DRAG_TYPE, parseNodeFilesDrag, toggleNodeFile } from './node-files'
import {
  formatValidationError,
  graphDefinitionSchema,
  linkSourceIds,
  validateLinkCandidate,
  type AgentNodeDefinition,
  type GraphDefinition,
  type InputNodeDefinition,
  type InputItemDefinition,
  type LinkDefinition,
  type SingleLinkRelation,
  type WorkspaceBinding
} from '@agentflow/schema'
import type { AgentSession, DesktopEditAction, PersistedChatMessage, WorkspaceMergeResult, WorkspaceState } from '../../shared/workspace'
import type { FeatureModelSettings, LlmSettingsSnapshot } from '../../shared/llm'
import {
  ChatSurface,
  ExistingFlowGenerationDialog,
  FlowActionDock,
  FlowGenerationDialog,
  HistoricalFlowBranchDialog,
  IncomingLinkConflictDialog,
  MissingUpstreamDialog,
  PromptAutofillDialog,
  RunConfirmationDialog,
  UnsupportedFilesDialog,
  FileImportDialog,
  Inspector,
  SaveProjectDialog,
  Sidebar,
  buildFlowEdges,
  buildFlowNodes,
  edgeTypes,
  linkIssueMessage,
  nodeTypes,
  type NoticeTone,
  type RuntimeNodeState,
  type Surface
} from './EditorPanels'
import { SettingsSurface } from './SettingsSurface'
import { recordDiagnostic } from './diagnostics'
import { fallbackLlmSettings, providerModelsFromCatalog, registerLlmModelMetadata, type ProviderModelOptions } from './llm-catalog'
import {
  createAgentSession,
  createFlowInProject,
  createId,
  loadWorkspaceState,
  moveTemporaryIntoProject,
  openDirectoryProject,
  openOrCreateTemporaryProject,
  forkFlowFromRun,
  reconcileWorkspaceState,
  saveTemporaryAsNewProject,
  saveWorkspaceState
} from './workspace-store'
import { startTutorial } from './workspace-store'
import { TutorialSpotlight } from './TutorialSpotlight'
import { TutorialViewport } from './TutorialViewport'
import { advanceTutorial, configureTutorialReviewer, endTutorial, publishTutorialNode, runTutorialFixture, setTutorialStep, tutorialGraph, tutorialLinkProgress, TUTORIAL_DESCRIPTION, tutorialOutputs, tutorialProvidersFor, tutorialReviewerSource } from './tutorial-project'
import { playTutorialRun, tutorialDelay, tutorialRunOrder, type TutorialPlayback } from './tutorial-playback'
import { deleteGraphSelection, groupSelectedNodes, mergeAgentSourceIntoTarget, moveGraphGroup, renameGraphGroup, selectAllGraphElements, ungroupGraphNodes } from './graph-operations'
import { addLinkWithPromptDefaultsDetailed, applyPromptAutofill, buildPromptAutofillMessages, parsePromptAutofillResponse, syncAgentLinkPromptDefaults, updateLinkTypeWithPromptDefaultsDetailed } from './prompt-autofill'
import { classifyInputFile, importInputFile } from './input-files'
import { AppMenuBar } from './AppMenuBar'
import { AppIcon } from './AppIcon'
import { DocumentSurface } from './DocumentSurface'
import { artifactTextContent, inputAttachmentPath, inputTextPath, isMarkdownOutput, latestAgentOutput, outputFilePath, outputTextPath } from '../../shared/flow-project'
import { invokeDesktopModel } from './model-invocation'
import { AgentLibraryProvider, useAgentLibrary } from './AgentLibraryContext'
import { LIBRARY_DRAG_TYPE, NodeLibraryToolbar, type NodeLibraryChoice } from './NodeLibraryToolbar'
import { lockAgentTemplate } from '../../shared/agent-library'
import { FLOW_FIT_OPTIONS, FlowAutoFit } from './FlowAutoFit'
import { nextAgentName } from './agent-naming'
import { analyzeFlowRun, analyzePromptAutofill, graphForRun, planBatchRuns, type PromptAutofillMode } from './flow-analysis'
import { artifactNodeIdForAgent, cloneOwnedOutput, ownedOutputEntry, reconcileAgentToolOutput } from './agent-outputs'
import { appendChatMessage, buildChatModelMessages, deleteChatMessage, editChatMessageCandidate, selectMessageCandidate, visibleChatMessages } from './chat-history'
import { agentRunInputIssue, planAgentRun, type AgentRunScope } from './agent-run-plan'
import { buildFlowGenerationMessages, buildGeneratedFlow, flowGenerationInputSummary, parseFlowGenerationResponse, type FlowGenerationMode, type FlowGenerationPreview } from './flow-generation'

type SaveStatus = 'loading' | 'saving' | 'saved' | 'unsaved' | 'error'
type SaveRequest = 'manual' | null
type PendingIncomingLink = { sourceId: string; targetId: string; type: SingleLinkRelation }

export function App() {
  const language = useLanguage()

  return <AgentLibraryProvider><ReactFlowProvider><PersistedWorkspace /></ReactFlowProvider></AgentLibraryProvider>
}

function PersistedWorkspace() {
  const language = useLanguage()

  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null)
  useEffect(() => { setWorkspace(current => current ? localizeWorkspaceDefaults(current) : current) }, [language])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading')
  const [workspaceError, setWorkspaceError] = useState('')
  useEffect(() => { if (workspaceError) recordDiagnostic('workspace.error', { message: workspaceError }) }, [workspaceError])
  const [saveRequest, setSaveRequest] = useState<SaveRequest>(null)
  const [requestedChat, setRequestedChat] = useState<{ graphId: string; nodeId: string } | null>(null)
  const [llmSettings, setLlmSettings] = useState<LlmSettingsSnapshot>(fallbackLlmSettings)
  const applyLlmSettings = (settings: LlmSettingsSnapshot) => {
    registerLlmModelMetadata(settings)
    setLlmSettings(settings)
  }
  const loaded = useRef(false)
  const workspaceRef = useRef<WorkspaceState | null>(null)
  const finalizingDraft = useRef(false)
  const autosaveTimer = useRef<number | null>(null)
  const autosavePromise = useRef<Promise<void> | null>(null)

  useEffect(() => { workspaceRef.current = workspace }, [workspace])

  useEffect(() => {
    if (!window.agentflowDesktop) return
    let cancelled = false
    void window.agentflowDesktop.loadLlmSettings()
      .then(async (settings) => {
        if (cancelled) return
        applyLlmSettings(settings)
        const openrouter = settings.providers.find((provider) => provider.id === 'openrouter' && provider.enabled)
        if (openrouter?.discoveredModels.length && !openrouter.modelMetadata) {
          try {
            const refreshed = await window.agentflowDesktop?.refreshProviderModels('openrouter')
            if (!cancelled && refreshed) applyLlmSettings(refreshed)
          } catch { if (!cancelled) setWorkspaceError(t("Could not update OpenRouter model capabilities. Fetch models again in provider settings.")) }
        }
      })
      .then(() => window.agentflowDesktop?.detectAgentTools())
      .then((settings) => { if (!cancelled && settings) applyLlmSettings(settings) })
      .catch((error) => { if (!cancelled) setWorkspaceError(t("Could not load model settings: {0}", [error instanceof Error ? error.message : String(error)])) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    for (const project of workspace?.projects ?? []) if (project.workspace.mode === 'temporary') {
      void window.agentflowDesktop?.ensureTemporaryWorkspace(project.workspace.tempId)
    }
  }, [workspace?.projects])

  useEffect(() => {
    let cancelled = false
    void loadWorkspaceState().then((state) => {
      if (cancelled) return
      loaded.current = true
      setWorkspace(localizeWorkspaceDefaults(state))
      setSaveStatus('unsaved')
    }).catch(error => { recordDiagnostic('workspace.load-failed', { error }); setSaveStatus('error') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!workspace || !loaded.current) return
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      if (autosaveTimer.current === timer) autosaveTimer.current = null
      if (finalizingDraft.current) return
      const pending = (autosavePromise.current ?? Promise.resolve()).catch(() => undefined).then(() => saveWorkspaceState(workspace)).then(() => undefined)
      autosavePromise.current = pending
      void pending
        .then(() => { if (workspaceRef.current === workspace) setSaveStatus('saved') })
        .catch((error) => { setSaveStatus('error'); setWorkspaceError(error instanceof Error ? error.message : t("Autosave failed. Try again.")) })
        .finally(() => { if (autosavePromise.current === pending) autosavePromise.current = null })
    }, 420)
    autosaveTimer.current = timer
    return () => {
      window.clearTimeout(timer)
      if (autosaveTimer.current === timer) autosaveTimer.current = null
    }
  }, [workspace])

  const pauseAutosave = useCallback(async () => {
    finalizingDraft.current = true
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }
    await autosavePromise.current?.catch(() => undefined)
  }, [language])

  useEffect(() => {
    if (!window.agentflowDesktop) return
    return window.agentflowDesktop.onSaveBeforeClose(() => {
      void (async () => {
        await pauseAutosave()
        const current = workspaceRef.current
        try {
          if (current) {
            await saveWorkspaceState(current)
            const temporaryIds = current.projects.flatMap((project) => project.workspace.mode === 'temporary' ? [project.workspace.tempId] : [])
            await Promise.all(temporaryIds.map((tempId) => window.agentflowDesktop!.discardTemporaryWorkspace(tempId)))
          }
          window.agentflowDesktop?.completeCloseSave(true)
        } catch (error) {
          finalizingDraft.current = false
          setSaveStatus('error')
          setWorkspaceError(error instanceof Error ? error.message : t("Could not save. The window has been kept open."))
          window.agentflowDesktop?.completeCloseSave(false)
        }
      })()
    })
  }, [pauseAutosave])

  useEffect(() => {
    if ((saveStatus !== 'saving' && saveStatus !== 'error') || window.agentflowDesktop) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [saveStatus])

  const requestSave = useCallback(async () => {
    if (!workspace) return
    if (workspace.projects.find((project) => project.id === workspace.activeProjectId)?.workspace.mode === 'temporary') {
      setSaveRequest('manual')
      return
    }
    setSaveStatus('saving')
    try {
      await saveWorkspaceState(workspace)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [workspace, language])

  useEffect(() => {
    if (!window.agentflowDesktop) return
    return window.agentflowDesktop.onMenuCommand((command) => {
      if (workspaceRef.current?.tutorial?.status === 'active' && command.type !== 'tutorial') {
        window.dispatchEvent(new Event('agentflow:tutorial-refocus'))
        return
      }
      if (command.type === 'new-project') {
        setWorkspace((current) => {
          if (!current) return current
          return openOrCreateTemporaryProject(current)
        })
        return
      }
      if (command.type === 'open-project-directory') {
        void window.agentflowDesktop?.loadProjectDirectory(command.rootPath).then((saved) => {
          const current = workspaceRef.current
          if (current) setWorkspace(openDirectoryProject(current, command.rootPath, saved))
        }).catch((error) => setWorkspaceError(error instanceof Error ? error.message : t("Could not open the project directory")))
        return
      }
      if (command.type === 'open-current-directory') {
        const current = workspaceRef.current
        const project = current?.projects.find((candidate) => candidate.id === current.activeProjectId)
        if (project) void window.agentflowDesktop?.openWorkspace(project.workspace)
        return
      }
      if (command.type === 'save') void requestSave()
    })
  }, [requestSave])

  const completeSaveRequest = useCallback(() => { setSaveRequest(null) }, [language])

  const saveTemporaryAsNew = useCallback(async (name: string, rootPath: string) => {
    const current = workspaceRef.current
    if (!current?.activeTemporaryProjectId) return
    if (!window.agentflowDesktop) throw new Error(t("Choose a save directory in the desktop app"))
    if (await window.agentflowDesktop.loadProjectDirectory(rootPath)) throw new Error(t("This directory already contains a Flow project. Choose another directory or move into an existing project."))
    await pauseAutosave()
    setSaveStatus('saving')
    try {
      const temporaryProject = current.projects.find((project) => project.id === current.activeTemporaryProjectId)
      if (temporaryProject?.workspace.mode === 'temporary') {
        const merged = await window.agentflowDesktop.mergeTemporaryWorkspace(temporaryProject.workspace.tempId, { mode: 'directory', rootPath }, false)
        if (merged.conflicts.length) throw new Error(t("The destination contains files with the same names. Choose another location."))
      }
      const next = saveTemporaryAsNewProject(workspaceRef.current ?? current, name, rootPath)
      await saveWorkspaceState(next)
      setWorkspace(next)
      setSaveStatus('saved')
      finalizingDraft.current = false
      completeSaveRequest()
    } catch (error) {
      finalizingDraft.current = false
      setSaveStatus('error')
      throw error
    }
  }, [completeSaveRequest, pauseAutosave, language])

  const mergeTemporaryIntoExisting = useCallback(async (targetProjectId: string, overwriteConflicts: boolean): Promise<WorkspaceMergeResult> => {
    const current = workspaceRef.current
    const draft = current?.projects.find((project) => project.id === current.activeTemporaryProjectId)
    const target = current?.projects.find((project) => project.id === targetProjectId)
    if (!current || !draft || !target || draft.workspace.mode !== 'temporary') {
      throw new Error(t("The temporary or destination project is no longer available."))
    }
    await pauseAutosave()
    setSaveStatus('saving')
    let result: WorkspaceMergeResult
    try {
      result = window.agentflowDesktop
        ? await window.agentflowDesktop.mergeTemporaryWorkspace(draft.workspace.tempId, target.workspace, overwriteConflicts)
        : { copiedFiles: 0, identicalFiles: 0, conflicts: [] }
    } catch {
      finalizingDraft.current = false
      setSaveStatus('error')
      throw new Error(t("Could not check or copy files from the temporary directory."))
    }
    if (result.conflicts.length) {
      finalizingDraft.current = false
      setSaveStatus('unsaved')
      return result
    }
    try {
      const next = moveTemporaryIntoProject(current, targetProjectId)
      await saveWorkspaceState(next)
      setWorkspace(next)
      setSaveStatus('saved')
      if (window.agentflowDesktop) {
        await window.agentflowDesktop.discardTemporaryWorkspace(draft.workspace.tempId)
      }
      finalizingDraft.current = false
      completeSaveRequest()
      return result
    } catch {
      finalizingDraft.current = false
      setSaveStatus('error')
      throw new Error(t("Files were processed, but project metadata could not be saved. Try again."))
    }
  }, [completeSaveRequest, pauseAutosave, language])

  if (!workspace) {
    return <div className="loading-surface" role="status"><AppIcon /><span>{saveStatus === 'error' ? t("Could not read the local workspace") : t("Opening project")}</span>{saveStatus === 'error' && window.agentflowDesktop ? <button type="button" className="quiet-button" onClick={() => void window.agentflowDesktop?.invokeMenuAction('diagnostics')}>{t("Logs and diagnostics")}</button> : null}</div>
  }

  const temporaryProject = workspace.projects.find((project) => project.id === workspace.activeProjectId && project.workspace.mode === 'temporary')
  const savedProjects = workspace.projects.filter((project) => project.workspace.mode === 'directory' && !workspace.archivedProjectIds.includes(project.id))

  return <>
    {workspaceError ? <div className="notice notice--error" role="alert">{localizeAppMessage(workspaceError)}<button type="button" onClick={() => setWorkspaceError('')}>{t("Close")}</button></div> : null}
    <WorkspaceEditor workspace={workspace} setWorkspace={setWorkspace} saveStatus={saveStatus} onSaveNow={requestSave} requestedChat={requestedChat} onRequestChat={setRequestedChat} onChatRequestHandled={() => setRequestedChat(null)} llmSettings={llmSettings} onLlmSettingsChange={applyLlmSettings} />
    {saveRequest && temporaryProject ? <SaveProjectDialog temporaryProject={temporaryProject} savedProjects={savedProjects} onCancel={() => completeSaveRequest()} onSaveAsNew={saveTemporaryAsNew} onMergeIntoProject={mergeTemporaryIntoExisting} /> : null}
  </>
}

interface WorkspaceEditorProps {
  workspace: WorkspaceState
  setWorkspace: Dispatch<SetStateAction<WorkspaceState | null>>
  saveStatus: SaveStatus
  onSaveNow: () => Promise<void>
  requestedChat: { graphId: string; nodeId: string } | null
  onRequestChat: (request: { graphId: string; nodeId: string }) => void
  onChatRequestHandled: () => void
  llmSettings: LlmSettingsSnapshot
  onLlmSettingsChange: (settings: LlmSettingsSnapshot) => void
}

function WorkspaceEditor({ workspace, setWorkspace, saveStatus, onSaveNow, requestedChat, onRequestChat, onChatRequestHandled, llmSettings, onLlmSettingsChange }: WorkspaceEditorProps) {
  const language = useLanguage()

  const { screenToFlowPosition } = useReactFlow()
  const agentLibrary = useAgentLibrary()
  const [libraryOpen, setLibraryOpen] = useState(false)
  const projects = workspace.projects.filter((project) => !workspace.archivedProjectIds.includes(project.id))
  const project = projects.find((candidate) => candidate.id === workspace.activeProjectId) ?? projects[0]!
  const projectGraphs = workspace.graphs.filter((graph) => graph.projectId === project.id)
  const storedGraph = projectGraphs.find((graph) => graph.id === workspace.activeGraphId) ?? projectGraphs[0]!
  const activeHistoryRunId = workspace.activeHistoryRunIds[storedGraph.id]
  const activeHistoryRun = activeHistoryRunId ? workspace.runs.find((run) => run.id === activeHistoryRunId && run.graphId === storedGraph.id && run.graphSnapshot) : undefined
  const graph = activeHistoryRun?.graphSnapshot ?? storedGraph.definition
  const displayedStoredGraph = activeHistoryRun ? { ...storedGraph, definition: graph } : storedGraph
  const historyViewing = Boolean(activeHistoryRun)
  const tutorialMode = graph.executionMode === 'tutorial'
  const tutorial = workspace.tutorial?.graphId === storedGraph.id && workspace.tutorial.status === 'active' ? workspace.tutorial : undefined
  const tutorialActive = Boolean(tutorial)
  const tutorialOverview = tutorial?.step === 1 && !tutorial.overviewSeen
  const isTemporaryProject = project.workspace.mode === 'temporary'
  const initialChatNodeId = requestedChat?.graphId === storedGraph.id && graph.nodes[requestedChat.nodeId]?.type === 'agent' ? requestedChat.nodeId : null

  const [surface, setSurface] = useState<Surface>(initialChatNodeId ? 'chat' : 'graph')
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(() => new Set())
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(() => new Set())
  const [activeChatNodeId, setActiveChatNodeId] = useState<string | null>(initialChatNodeId)
  const [runtimeNodes, setRuntimeNodes] = useState<Record<string, RuntimeNodeState>>({})
  const [edgeTargets, setEdgeTargets] = useState<Record<string, NodeRuntimeStatus>>({})
  const [artifacts, setArtifacts] = useState<Record<string, Artifact>>({})
  const [events, setEvents] = useState<RuntimeEvent[]>([])
  const [running, setRunning] = useState(false)
  const [tutorialPlayback, setTutorialPlayback] = useState<TutorialPlayback>()
  const [runId, setRunId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null)
  const [composerValue, setComposerValue] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [replying, setReplying] = useState(false)
  const [streamingReply, setStreamingReply] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tutorialConnectionPage, setTutorialConnectionPage] = useState<'providers' | 'tools' | undefined>()
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null)
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [nodeMeasurements, setNodeMeasurements] = useState<Record<string, { width: number; height: number }>>({})
  const [sidebarHidden, setSidebarHidden] = useState(() => window.innerWidth <= 640)
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(window.localStorage.getItem('agentflow.sidebar.width')) || 248)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kind: 'agent' | 'input' | 'output' | 'link' | 'pane'; id?: string } | null>(null)
  const [autofillDialogOpen, setAutofillDialogOpen] = useState(false)
  const [promptAutofillSelection, setPromptAutofillSelection] = useState<FeatureModelSettings>(() => llmSettings.promptAutofill)
  const [flowGenerationChoiceOpen, setFlowGenerationChoiceOpen] = useState(false)
  const [flowGenerationDialogOpen, setFlowGenerationDialogOpen] = useState(false)
  const [flowGenerationSelection, setFlowGenerationSelection] = useState<FeatureModelSettings>(() => llmSettings.flowGeneration)
  const [flowGenerationMode, setFlowGenerationMode] = useState<FlowGenerationMode>('replace')
  const [flowGenerationDescription, setFlowGenerationDescription] = useState('')
  const [flowGenerationPreview, setFlowGenerationPreview] = useState<FlowGenerationPreview | null>(null)
  const [runDialogOpen, setRunDialogOpen] = useState(false)
  const [historyBranchRequest, setHistoryBranchRequest] = useState<{ graphId: string; runId: string; flowName: string; stateName: string } | null>(null)
  const [unsupportedFiles, setUnsupportedFiles] = useState<{ nodeName: string; files: string[] } | null>(null)
  const [missingUpstreamRun, setMissingUpstreamRun] = useState<{ nodeId: string; missingIds: string[] } | null>(null)
  const [autofilling, setAutofilling] = useState(false)
  const [flowGenerating, setFlowGenerating] = useState(false)
  const [documentTarget, setDocumentTarget] = useState<{ nodeId: string; itemId?: string; filePath?: string; fileContent?: string; artifactId?: string } | null>(null)
  const runController = useRef<AbortController | null>(null)
  const pausedRun = useRef<{ graph: GraphDefinition; artifacts: Artifact[] } | null>(null)
  const autofillController = useRef<AbortController | null>(null)
  const flowGenerationController = useRef<AbortController | null>(null)
  const latestWorkspace = useRef(workspace)
  latestWorkspace.current = workspace
  useEffect(() => () => { runController.current?.abort(); autofillController.current?.abort(); flowGenerationController.current?.abort() }, [storedGraph.id])
  const [pendingFiles, setPendingFiles] = useState<{ files: File[]; targetNodeId?: string; position?: { x: number; y: number } } | null>(null)
  const [linkConflict, setLinkConflict] = useState<PendingIncomingLink | null>(null)
  const agentClipboard = useRef<AgentNodeDefinition | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const graphHistory = useRef<Record<string, GraphDefinition[]>>({})
  const graphRedoHistory = useRef<Record<string, GraphDefinition[]>>({})
  const connectionSource = useRef<string | null>(null)
  const connectionCompleted = useRef(false)
  const groupDrag = useRef<{
    groupId: string
    anchorStart: { x: number; y: number }
    memberStarts: Record<string, { x: number; y: number }>
    groupStart: { x: number; y: number }
  } | null>(null)

  const setSelectedNodeId = useCallback((nodeId: string | null) => setSelectedNodeIds(nodeId ? new Set([nodeId]) : new Set()), [language])
  const setSelectedLinkId = useCallback((linkId: string | null) => setSelectedLinkIds(linkId ? new Set([linkId]) : new Set()), [language])
  const selectedNodeId = selectedNodeIds.size === 1 ? ([...selectedNodeIds][0] ?? null) : null
  const selectedLinkId = selectedLinkIds.size === 1 ? ([...selectedLinkIds][0] ?? null) : null
  const selectionCount = selectedNodeIds.size + selectedLinkIds.size
  const selectedGroupPreview = useMemo(() => selectedNodeIds.size >= 2 ? groupSelectedNodes(graph, selectedNodeIds, 'group-preview', t("New group")) : null, [graph, selectedNodeIds, language])

  const selectedNode = selectedNodeId ? graph.nodes[selectedNodeId] : undefined
  const selectedLink = selectedLinkId ? graph.links.find((link) => link.id === selectedLinkId) : undefined
  const activeChatNode = activeChatNodeId ? graph.nodes[activeChatNodeId] : undefined
  const flowVersions = workspace.runs.filter((run) => run.graphId === storedGraph.id && run.status === 'completed').sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const displayedArtifactBindings = activeHistoryRun?.artifactBindings ?? (activeHistoryRun ? Object.fromEntries(activeHistoryRun.artifacts.map((artifact) => [artifact.nodeId, artifact.id])) : workspace.workingArtifactIds[storedGraph.id] ?? {})
  const displayedArtifacts = activeHistoryRun
    ? activeHistoryRun.artifacts.map((artifact) => workspace.artifacts.find((candidate) => candidate.id === artifact.id) ?? { ...artifact, projectId: project.id, graphId: storedGraph.id, origin: 'run' as const })
    : workspace.artifacts.filter((artifact) => artifact.graphId === storedGraph.id)
  const selectedArtifactOptions = selectedNodeId ? displayedArtifacts.filter((artifact) => artifact.nodeId === selectedNodeId).sort((left, right) => right.createdAt.localeCompare(left.createdAt)) : []
  const runInputArtifacts = Object.fromEntries(workspace.artifacts.filter(artifact => artifact.graphId === storedGraph.id && workspace.workingArtifactIds[storedGraph.id]?.[artifact.nodeId] === artifact.id).map(artifact => [artifact.nodeId, artifact]))
  const selectedArtifact = selectedNodeId ? displayedArtifacts.find((artifact) => artifact.id === displayedArtifactBindings[selectedNodeId]) : undefined
  const selectedOutput = selectedNodeId && selectedArtifact ? { id: selectedArtifact.id, content: artifactTextContent(selectedArtifact), createdAt: selectedArtifact.createdAt, relativePath: outputTextPath(storedGraph.id, selectedNodeId, selectedArtifact.id), parts: selectedArtifact.parts } : selectedNodeId ? latestAgentOutput(workspace, storedGraph.id, selectedNodeId) : undefined
  const documentNode = documentTarget ? graph.nodes[documentTarget.nodeId] : undefined
  const documentInput = documentNode?.type === 'input' ? documentNode.items.find((item) => item.id === documentTarget?.itemId) : undefined
  const documentArtifact = documentTarget && !documentInput ? displayedArtifacts.find((artifact) => artifact.id === (documentTarget.artifactId ?? displayedArtifactBindings[documentTarget.nodeId])) : undefined
  const documentFile = documentArtifact?.files?.find((file) => file.relativePath === documentTarget?.filePath)
  const documentOutput = documentTarget && !documentInput && documentArtifact ? { id: documentArtifact.id, content: artifactTextContent(documentArtifact), createdAt: documentArtifact.createdAt, relativePath: outputTextPath(storedGraph.id, documentTarget.nodeId, documentArtifact.id), parts: documentArtifact.parts } : documentTarget && !documentInput ? latestAgentOutput(workspace, storedGraph.id, documentTarget.nodeId) : undefined
  const activeSession = activeChatNodeId ? getActiveSession(workspace, storedGraph.id, activeChatNodeId) : undefined
  const activeChatArtifactNodeId = activeChatNodeId ? artifactNodeIdForAgent(graph, activeChatNodeId) : undefined
  const canvasRuntimeNodes = useMemo(() => {
    const next = { ...runtimeNodes }
    for (const [nodeId, artifactId] of Object.entries(displayedArtifactBindings)) {
      const artifact = displayedArtifacts.find((candidate) => candidate.id === artifactId)
      if (artifact) next[nodeId] = { status: next[nodeId]?.status ?? 'completed', artifactVersion: artifact.version, fileNames: artifact.files?.map((file) => file.name) }
      const node = graph.nodes[nodeId]
      if (tutorialMode && artifact && node?.type === 'output' && !next[node.ownerAgentId]?.status) next[node.ownerAgentId] = { status: 'completed' }
    }
    return next
  }, [displayedArtifactBindings, displayedArtifacts, runtimeNodes, graph.nodes, tutorialMode, language])
  const availableProviders = useMemo(() => tutorialProvidersFor(providerModelsFromCatalog(llmSettings.catalog), tutorialActive), [llmSettings.catalog, tutorialActive, language])
  const featureModelProviders = useMemo<ProviderModelOptions[]>(() => availableProviders.filter((group) => group.provider !== 'fake' && group.configured && (!tutorialActive || group.connector === 'model') && group.models.length > 0), [availableProviders, tutorialActive, language])
  const agentCount = useMemo(() => Object.values(graph.nodes).filter((node) => node.type === 'agent').length, [graph.nodes, language])
  const promptAutofillPlan = useMemo(() => analyzePromptAutofill(graph), [graph, language])
  const generationInputSummary = useMemo(() => flowGenerationInputSummary(graph), [graph, language])
  const flowRunPlan = useMemo(() => analyzeFlowRun(graph), [graph, language])
  const interactionLocked = running || flowGenerating
  const runConfigurationIssues = useMemo(() => {
    const issues: string[] = []
    for (const { id, name } of flowRunPlan.runnableAgents) {
      const node = graph.nodes[id]
      if (node?.type !== 'agent') continue
      const provider = availableProviders.find((candidate) => candidate.provider === node.provider)
      if (!provider?.configured) issues.push(t("{0} · Provider is not configured or enabled", [node.name]))
      else if (!provider.models.includes(node.model)) issues.push(t("{0} · Model {1} is not in the current model list", [node.name, node.model]))
      for (const link of graph.links.filter((candidate) => candidate.targetId === id)) {
        for (const sourceId of linkSourceIds(link)) {
          const source = graph.nodes[sourceId]
          if (source?.type !== 'input') continue
          for (const item of visibleInputItems(source).filter((candidate) => candidate.mode === 'attachment' && candidate.mimeType && !(node.provider.startsWith('agent-tool:') && candidate.workspacePath))) {
            const issue = modelAttachmentIssue(node.provider, node.model, item.mimeType!)
            if (issue) issues.push(`${name} · ${item.name}: ${issue}`)
          }
        }
      }
    }
    return [...new Set(issues)]
  }, [availableProviders, flowRunPlan.runnableAgents, graph.links, graph.nodes, language])
  const linkConflictDetails = useMemo(() => {
    if (!linkConflict) return null
    const target = graph.nodes[linkConflict.targetId]
    const source = graph.nodes[linkConflict.sourceId]
    if (target?.type !== 'agent' || !source) return null
    const incoming = graph.links.filter((link) =>
      link.targetId === linkConflict.targetId &&
      linkSourceIds(link).some((sourceId) => graph.nodes[sourceId]?.type === 'agent' || graph.nodes[sourceId]?.type === 'output')
    )
    const existingSourceNames = [...new Set(incoming.flatMap(linkSourceIds))]
      .map((sourceId) => graph.nodes[sourceId]?.name)
      .filter((name): name is string => Boolean(name))
    const mergePreview = mergeAgentSourceIntoTarget(graph, linkConflict.sourceId, linkConflict.targetId)
    return {
      targetName: target.name,
      incomingSourceName: source.name,
      existingSourceNames,
      mergePreview
    }
  }, [graph, linkConflict, language])

  useEffect(() => {
    window.localStorage.setItem('agentflow.sidebar.width', String(Math.round(sidebarWidth)))
  }, [sidebarWidth])

  const clearRun = useCallback(() => {
    setRuntimeNodes({})
    setEdgeTargets({})
    setEvents([])
    setRunId(null)
    setUnsupportedFiles(null)
  }, [language])

  const advanceGuide = (step: number) => setWorkspace((current) => current ? advanceTutorial(current, step) : current)

  const moveTutorial = (step: number) => {
    if (runController.current) return
    if (step === 5 && tutorialReviewerSource(graph) !== 'reviewer') step = 4
    setWorkspace((current) => current ? reconcileWorkspaceState(setTutorialStep(current, step)) : current)
    clearRun()
    setSelectedLinkId(null); setSurface('graph'); setLibraryOpen(false)
    setAutofillDialogOpen(false); setFlowGenerationDialogOpen(false); setFlowGenerationPreview(null); setRunDialogOpen(false)
  }

  const finishTutorial = (status: 'skipped' | 'completed', page?: 'providers' | 'tools') => {
    runController.current?.abort(); autofillController.current?.abort(); flowGenerationController.current?.abort()
    clearRun()
    delete graphHistory.current[storedGraph.id]; delete graphRedoHistory.current[storedGraph.id]
    setSelectedNodeId('delivery'); setSelectedLinkId(null); setSurface('graph'); setDocumentTarget(null)
    setLibraryOpen(false); setAutofillDialogOpen(false); setFlowGenerationDialogOpen(false); setFlowGenerationPreview(null); setRunDialogOpen(false)
    setPromptAutofillSelection(llmSettings.promptAutofill); setFlowGenerationSelection(llmSettings.flowGeneration)
    setWorkspace((current) => current ? endTutorial(current, status) : current)
    if (page) { setTutorialConnectionPage(page); setSettingsOpen(true) }
    else setNotice({ message: t("The complete example is ready. Open “Weekly brief” to view the result."), tone: 'success' })
  }

  const beginTutorial = async () => {
    if (running || replying || autofilling || flowGenerating) {
      setNotice({ message: t("Finish or stop the current task before opening the tutorial."), tone: 'neutral' })
      return
    }
    try {
      const root = await window.agentflowDesktop?.ensureTutorialWorkspace?.()
      setWorkspace((current) => current ? startTutorial(current, 0, root) : current)
      clearRun()
      setSelectedNodeId(null); setSelectedLinkId(null); setSurface('graph')
      setSettingsOpen(false); setTutorialConnectionPage(undefined); setContextMenu(null); setLibraryOpen(false)
      setAutofillDialogOpen(false); setFlowGenerationDialogOpen(false); setFlowGenerationChoiceOpen(false)
      setRunDialogOpen(false); setHistoryBranchRequest(null); setPendingFiles(null); setLinkConflict(null); setMissingUpstreamRun(null)
      setNotice(null)
    } catch (error) { setNotice({ message: error instanceof Error ? error.message : t("Could not open the tutorial project"), tone: 'error' }) }
  }

  const tutorialActionBlocked = (steps: number[]) => {
    if (!tutorialMode || (tutorial && steps.includes(tutorial.step))) return false
    setNotice({ message: tutorial ? t("Complete the highlighted action to continue.") : t("Replay this example from Help → Interactive tutorial."), tone: 'neutral' })
    return true
  }

  const runTutorial = async () => {
    if (runController.current || tutorialActionBlocked([7, 10]) || !tutorial) return
    const target = tutorial.step === 7 ? 'local' : 'delivery'
    const nextStep = target === 'local' ? 8 : 11
    const controller = new AbortController()
    runController.current = controller
    setRunDialogOpen(false); setRunning(true); clearRun()
    const order = tutorialRunOrder(graph, target)
    setRuntimeNodes(Object.fromEntries(order.map((id) => [id, { status: 'waiting' }])))
    if (target === 'local') setWorkspace((current) => current ? {
      ...current, artifacts: current.artifacts.filter((artifact) => artifact.graphId !== storedGraph.id),
      workingArtifactIds: { ...current.workingArtifactIds, [storedGraph.id]: {} }
    } : current)
    try {
      const completed = await playTutorialRun(graph, target, controller.signal, (playback, status) => {
        setRuntimeNodes((current) => ({ ...current, [playback.nodeId]: { status } }))
        setEdgeTargets((current) => ({ ...current, [playback.nodeId]: status }))
        if (status === 'running') { setTutorialPlayback(playback); setSelectedNodeId(playback.nodeId); setSelectedLinkId(null) }
        else setWorkspace((current) => current ? publishTutorialNode(current, playback.nodeId, nextStep) : current)
      })
      if (completed) {
        setWorkspace((current) => current?.tutorial?.status === 'active' ? runTutorialFixture(current, nextStep) : current)
        clearRun()
      } else setRuntimeNodes((current) => Object.fromEntries(Object.entries(current).map(([id, node]) => [id, node.status === 'running' ? { ...node, status: 'cancelled' } : node])))
    } finally {
      if (runController.current === controller) { runController.current = null; setRunning(false); setTutorialPlayback(undefined) }
    }
  }

  useEffect(() => window.agentflowDesktop?.onMenuCommand((command) => {
    if (command.type === 'tutorial') void beginTutorial()
  }), [beginTutorial])

  useEffect(() => {
    if (!tutorial) return
    const step = tutorialLinkProgress(graph, tutorial.step)
    if (step !== tutorial.step) advanceGuide(step)
  }, [graph.links, tutorial?.step])

  useEffect(() => {
    if (!tutorial) return
    const selected = ['brief', 'writer', 'reviewer', null, 'reviser', null, 'reviewer', 'reviewer', 'result', 'result', 'delivery', 'delivery', 'delivery'][tutorial.step] ?? null
    setNotice(null)
    const link = tutorial.step === 3 ? graph.links.find((link) => link.targetId === 'reviewer') : tutorial.step === 5 ? graph.links.find((link) => link.targetId === 'reviser') : undefined
    setSelectedNodeId(selected)
    setSelectedLinkId(link?.id ?? null)
  }, [tutorial?.graphId, tutorial?.step, setSelectedNodeId, setSelectedLinkId])

  useEffect(() => {
    const local = graph.nodes.local
    if (!tutorial || local?.type !== 'agent' || !['agent-tool:codex', 'agent-tool:claude-code'].includes(local.provider)) return
    const tool = local.provider === 'agent-tool:claude-code' ? 'claude-code' : 'codex'
    if (tool === tutorial.tool) return
    setWorkspace((current) => current?.tutorial ? {
      ...current, tutorial: { ...current.tutorial, tool },
      graphs: current.graphs.map((stored) => stored.id === current.tutorial!.graphId && [t("Codex data analysis"), t("Claude Code data analysis")].includes(local.name) ? { ...stored, definition: { ...stored.definition, nodes: { ...stored.definition.nodes, local: { ...local, name: tool === 'codex' ? t("Codex data analysis") : t("Claude Code data analysis") } } } } : stored)
    } : current)
  }, [tutorial?.tool, graph.nodes.local])

  const requestHistoryBranch = useCallback(() => {
    if (!activeHistoryRun) return false
    setHistoryBranchRequest((current) => current ?? {
      graphId: storedGraph.id,
      runId: activeHistoryRun.id,
      flowName: graph.name,
      stateName: activeHistoryRun.name ?? t("Historical state")
    })
    return true
  }, [activeHistoryRun, graph.name, storedGraph.id, language])

  const confirmHistoryBranch = useCallback(() => {
    if (!historyBranchRequest) return
    setWorkspace((current) => current ? forkFlowFromRun(current, historyBranchRequest.graphId, historyBranchRequest.runId) : current)
    setHistoryBranchRequest(null)
    setContextMenu(null)
    setLibraryOpen(false)
    setPendingFiles(null)
    setLinkConflict(null)
    setDocumentTarget(null)
    setSelectedNodeId(null)
    setSelectedLinkId(null)
    setSurface('graph')
    clearRun()
    setNotice({ message: t("Created a local branch from the historical Flow. You can edit it now."), tone: 'success' })
  }, [clearRun, historyBranchRequest, setSelectedLinkId, setSelectedNodeId, setWorkspace, language])

  const selectWorkingArtifact = useCallback((nodeId: string, artifactId: string) => {
    setWorkspace((current) => current ? {
      ...current,
      workingArtifactIds: { ...current.workingArtifactIds, [storedGraph.id]: { ...(current.workingArtifactIds[storedGraph.id] ?? {}), [nodeId]: artifactId } },
      updatedAt: new Date().toISOString()
    } : current)
    const artifact = workspace.artifacts.find((candidate) => candidate.id === artifactId)
    if (artifact) setArtifacts((current) => ({ ...current, [nodeId]: artifact }))
  }, [setWorkspace, storedGraph.id, workspace.artifacts, language])

  const selectFlowState = useCallback((stateId: string) => {
    const runId = stateId === 'working' ? undefined : stateId
    if (runId && !workspace.runs.some((run) => run.id === runId && run.graphId === storedGraph.id && run.graphSnapshot)) return
    const now = new Date().toISOString()
    setWorkspace((current) => current ? {
      ...current,
      activeHistoryRunIds: runId
        ? { ...current.activeHistoryRunIds, [storedGraph.id]: runId }
        : Object.fromEntries(Object.entries(current.activeHistoryRunIds).filter(([graphId]) => graphId !== storedGraph.id)),
      updatedAt: now
    } : current)
    setSelectedNodeId(null)
    setSelectedLinkId(null)
    setHistoryBranchRequest(null)
    clearRun()
    setNotice({ message: runId ? t("Viewing a read-only historical state. Fork it to edit and run.") : t("Returned to working state"), tone: 'neutral' })
  }, [clearRun, setWorkspace, storedGraph.id, workspace.runs, language])

  const renameFlowState = useCallback((runId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const now = new Date().toISOString()
    setWorkspace((current) => current ? {
      ...current,
      runs: current.runs.map((run) => run.id === runId && run.graphId === storedGraph.id ? { ...run, name: trimmed } : run),
      updatedAt: now
    } : current)
    setNotice({ message: t("State renamed"), tone: 'success' })
  }, [setWorkspace, storedGraph.id, language])

  const forkHistoryState = useCallback((runId: string) => {
    setWorkspace((current) => current ? forkFlowFromRun(current, storedGraph.id, runId) : current)
    setSelectedNodeId(null)
    setSelectedLinkId(null)
    setDocumentTarget(null)
    setSurface('graph')
    clearRun()
    setNotice({ message: t("Forked historical state into a new Flow"), tone: 'success' })
  }, [clearRun, setSelectedLinkId, setSelectedNodeId, setWorkspace, storedGraph.id, language])

  useEffect(() => {
    setArtifacts(Object.fromEntries(Object.entries(displayedArtifactBindings).flatMap(([nodeId, artifactId]) => {
      const artifact = displayedArtifacts.find((candidate) => candidate.id === artifactId)
      return artifact ? [[nodeId, artifact]] : []
    })))
  }, [activeHistoryRun?.id, storedGraph.id, workspace.artifacts, workspace.workingArtifactIds])

  const rememberGraph = useCallback(() => {
    const history = graphHistory.current[storedGraph.id] ?? []
    graphHistory.current[storedGraph.id] = [...history.slice(-39), graph]
    graphRedoHistory.current[storedGraph.id] = []
  }, [graph, storedGraph.id, language])

  const updateGraph = useCallback((transform: (graph: GraphDefinition) => GraphDefinition, bumpRevision = true) => {
    if (historyViewing) { requestHistoryBranch(); return }
    if (bumpRevision) rememberGraph()
    const now = new Date().toISOString()
    setWorkspace((current) => current ? {
      ...current,
      graphs: current.graphs.map((candidate) => candidate.id === storedGraph.id ? {
        ...candidate,
        revision: bumpRevision ? candidate.revision + 1 : candidate.revision,
        definition: transform(candidate.definition),
        updatedAt: now
      } : candidate),
      projects: current.projects.map((candidate) => candidate.id === project.id ? { ...candidate, updatedAt: now } : candidate),
      updatedAt: now
    } : current)
    if (bumpRevision) clearRun()
  }, [clearRun, historyViewing, project.id, rememberGraph, requestHistoryBranch, setWorkspace, storedGraph.id, language])

  const undoGraph = useCallback(() => {
    if (running || historyViewing) return
    const history = graphHistory.current[storedGraph.id] ?? []
    const previous = history.at(-1)
    if (!previous) { setNotice({ message: t("Nothing to undo"), tone: 'neutral' }); return }
    graphHistory.current[storedGraph.id] = history.slice(0, -1)
    const redoHistory = graphRedoHistory.current[storedGraph.id] ?? []
    graphRedoHistory.current[storedGraph.id] = [...redoHistory.slice(-39), graph]
    const now = new Date().toISOString()
    setWorkspace((current) => {
      if (!current) return current
      const next = { ...current, graphs: current.graphs.map((candidate) => candidate.id === storedGraph.id ? { ...candidate, definition: previous, revision: candidate.revision + 1, updatedAt: now } : candidate), updatedAt: now }
      return reconcileWorkspaceState(next)
    })
    setSelectedNodeId(null)
    setSelectedLinkId(null)
    clearRun()
    setNotice({ message: t("Undid the last Flow edit"), tone: 'success' })
  }, [clearRun, graph, historyViewing, project.id, running, setWorkspace, storedGraph.id, language])

  const redoGraph = useCallback(() => {
    if (running || historyViewing) return
    const redoHistory = graphRedoHistory.current[storedGraph.id] ?? []
    const next = redoHistory.at(-1)
    if (!next) { setNotice({ message: t("Nothing to redo"), tone: 'neutral' }); return }
    graphRedoHistory.current[storedGraph.id] = redoHistory.slice(0, -1)
    const history = graphHistory.current[storedGraph.id] ?? []
    graphHistory.current[storedGraph.id] = [...history.slice(-39), graph]
    const now = new Date().toISOString()
    setWorkspace((current) => {
      if (!current) return current
      const restored = { ...current, graphs: current.graphs.map((candidate) => candidate.id === storedGraph.id ? { ...candidate, definition: next, revision: candidate.revision + 1, updatedAt: now } : candidate), updatedAt: now }
      return reconcileWorkspaceState(restored)
    })
    setSelectedNodeId(null)
    setSelectedLinkId(null)
    clearRun()
    setNotice({ message: t("Redid the Flow edit"), tone: 'success' })
  }, [clearRun, graph, historyViewing, project.id, running, setWorkspace, storedGraph.id, language])

  const addAgent = useCallback((source: AgentNodeDefinition, position?: { x: number; y: number }) => {
    if (running) return
    if (historyViewing) { requestHistoryBranch(); return }
    rememberGraph()
    const id = createId('agent')
    const count = Object.keys(graph.nodes).length
    const node: AgentNodeDefinition = {
      ...structuredClone(source),
      position: position ?? { x: 300 + (count % 3) * 304, y: 120 + Math.floor(count / 3) * 210 }
    }
    const now = new Date().toISOString()
    setWorkspace((current) => {
      if (!current) return current
      const currentGraph = current.graphs.find((candidate) => candidate.id === storedGraph.id)
      if (!currentGraph) return current
      const definition = reconcileAgentToolOutput({ ...currentGraph.definition, nodes: { ...currentGraph.definition.nodes, [id]: node } }, id)
      return {
        ...current,
        graphs: current.graphs.map((candidate) => candidate.id === storedGraph.id ? { ...candidate, definition, revision: candidate.revision + 1, updatedAt: now } : candidate),
        sessions: [...current.sessions, createAgentSession(project.id, storedGraph.id, id, project.workspace)],
        updatedAt: now
      }
    })
    clearRun()
    setSelectedNodeId(id)
    setSelectedLinkId(null)
    setNotice({ message: t("{0} added", [node.name]), tone: 'success' })
  }, [clearRun, historyViewing, running, graph.nodes, project.id, project.workspace, rememberGraph, requestHistoryBranch, setWorkspace, storedGraph.id, language])

  const addLibraryNode = (choice: NodeLibraryChoice, position?: { x: number; y: number }) => {
    if (tutorial?.step === 1 && !tutorialOverview && choice.kind === 'model') {
      const reviewer = tutorialGraph(2).nodes.reviewer!
      updateGraph((current) => configureTutorialReviewer({ ...current, nodes: { ...current.nodes, reviewer }, links: current.links.filter((link) => !(linkSourceIds(link).includes('writer') && link.targetId === 'reviser')) }, choice))
      setWorkspace((current) => current?.tutorial ? { ...advanceTutorial(current, 2), tutorial: { ...current.tutorial, step: 2, reviewer: { provider: choice.provider, model: choice.model } } } : current)
      setLibraryOpen(false); return
    }
    if (choice.kind === 'agent') {
      const saved = agentLibrary.library.agents.find((item) => item.id === choice.id)
      if (saved) addAgent({ ...lockAgentTemplate(saved.node), nameCustomized: true }, position)
    } else {
      const provider = availableProviders.find((item) => item.provider === choice.provider && item.configured)
      if (!provider) {
        setNotice({ message: t("This connection is unavailable. Reconnect in settings before adding it."), tone: 'error' })
        return
      }
      if (!provider.models.includes(choice.model)) {
        setNotice({ message: t("{0} is no longer available from {1}. Choose another model.", [choice.model, provider.label]), tone: 'error' })
        return
      }
      addAgent({ type: 'agent', name: nextAgentName(graph), nameCustomized: false, provider: choice.provider, model: choice.model,
        parameters: effectiveModelParameters(choice.provider, choice.model, {}, agentLibrary.defaults(choice.provider, choice.model)), prompts: createDefaultPrompts() }, position)
    }
    setLibraryOpen(false)
  }

  const duplicateAgent = useCallback((source: AgentNodeDefinition) => {
    if (running) return
    if (historyViewing) { requestHistoryBranch(); return }
    rememberGraph()
    const id = createId('agent')
    const node: AgentNodeDefinition = {
      ...source,
      name: t('{0} copy', [source.name]),
      nameCustomized: true,
      parameters: source.parameters ? { ...source.parameters } : undefined,
      prompts: {
        system: { ...source.prompts.system },
        input: { ...source.prompts.input },
        output: { ...source.prompts.output }
      },
      position: { x: (source.position?.x ?? 260) + 42, y: (source.position?.y ?? 140) + 42 }
    }
    const sourceId = Object.entries(graph.nodes).find(([, candidate]) => candidate === source)?.[0]
    const now = new Date().toISOString()
    setWorkspace((current) => {
      if (!current) return current
      const currentGraph = current.graphs.find((candidate) => candidate.id === storedGraph.id)
      if (!currentGraph) return current
      const withNode = { ...currentGraph.definition, nodes: { ...currentGraph.definition.nodes, [id]: node } }
      const definition = sourceId ? cloneOwnedOutput(withNode, sourceId, id, node) : reconcileAgentToolOutput(withNode, id)
      return { ...current, graphs: current.graphs.map((candidate) => candidate.id === storedGraph.id ? { ...candidate, definition, revision: candidate.revision + 1, updatedAt: now } : candidate), sessions: [...current.sessions, createAgentSession(project.id, storedGraph.id, id, project.workspace)], updatedAt: now }
    })
    clearRun()
    setSelectedNodeId(id)
    setSelectedLinkId(null)
    setNotice({ message: t("{0} duplicated", [source.name]), tone: 'success' })
  }, [clearRun, graph.nodes, historyViewing, project.id, project.workspace, rememberGraph, requestHistoryBranch, running, setWorkspace, storedGraph.id, language])

  const copySelectedAgent = useCallback(() => {
    if (!selectedNodeId) return
    const node = graph.nodes[selectedNodeId]
    if (node?.type !== 'agent') return
    agentClipboard.current = {
      ...node,
      parameters: node.parameters ? { ...node.parameters } : undefined,
      prompts: {
        system: { ...node.prompts.system },
        input: { ...node.prompts.input },
        output: { ...node.prompts.output }
      },
      position: node.position ? { ...node.position } : undefined
    }
    setNotice({ message: t("{0} copied. Press Ctrl+V to paste", [node.name]), tone: 'success' })
  }, [graph.nodes, selectedNodeId, language])

  const pasteAgent = useCallback(() => {
    if (agentClipboard.current) duplicateAgent(agentClipboard.current)
  }, [duplicateAgent, language])

  const addInput = useCallback(() => {
    const id = createId('input')
    const count = Object.keys(graph.nodes).length
    const node: InputNodeDefinition = {
      type: 'input',
      name: t("Input {0}", [count + 1]),
      items: [{ id: createId('input-item'), name: t("Text input"), kind: 'text', mode: 'text', content: '' }],
      position: { x: 50, y: 90 + count * 78 }
    }
    updateGraph((current) => ({ ...current, nodes: { ...current.nodes, [id]: node } }))
    setSelectedNodeId(id)
    setSelectedLinkId(null)
  }, [graph.nodes, updateGraph, language])

  const deleteSelection = useCallback(() => {
    if (running) return
    if (historyViewing) { requestHistoryBranch(); return }
    if (!selectionCount) return
    const nodeIds = new Set([...selectedNodeIds].filter((id) => graph.nodes[id]?.type !== 'output'))
    for (const nodeId of [...nodeIds]) {
      const outputId = ownedOutputEntry(graph, nodeId)?.[0]
      if (outputId) nodeIds.add(outputId)
    }
    const linkIds = new Set(selectedLinkIds)
    if (!nodeIds.size && !linkIds.size) {
      setNotice({ message: t("The result node is required by its Agent. Delete the owning Agent to remove it"), tone: 'neutral' })
      return
    }
    updateGraph((current) => deleteGraphSelection(current, nodeIds, linkIds))
    setWorkspace((current) => current ? {
      ...current,
      sessions: current.sessions.map((session) => session.graphId === storedGraph.id && nodeIds.has(session.agentNodeId) ? { ...session, isActive: false, status: 'archived' as const } : session),
      suppressedSessionAgentIds: (current.suppressedSessionAgentIds ?? []).filter((id) => !nodeIds.has(id))
    } : current)
    setSelectedNodeId(null)
    setSelectedLinkId(null)
    setNotice({ message: t("Deleted {0} nodes and {1} selected links", [selectedNodeIds.size, selectedLinkIds.size]), tone: 'neutral' })
  }, [graph, historyViewing, requestHistoryBranch, running, selectedLinkIds, selectedNodeIds, selectionCount, setSelectedLinkId, setSelectedNodeId, setWorkspace, storedGraph.id, updateGraph, language])

  const createSelectionGroup = useCallback(() => {
    const result = groupSelectedNodes(graph, selectedNodeIds, createId('group'), t("Group {0}", [Object.keys(graph.groups ?? {}).length + 1]))
    if (result.issue) { setNotice({ message: graphOperationMessage(result.issue), tone: 'error' }); return }
    updateGraph(() => result.graph)
    setNotice({ message: t("Added {0} nodes to a new group", [selectedNodeIds.size]), tone: 'success' })
  }, [graph, selectedNodeIds, updateGraph, language])

  const selectAllElements = useCallback(() => {
    const selection = selectAllGraphElements(graph)
    setSelectedNodeIds(selection.nodeIds)
    setSelectedLinkIds(selection.linkIds)
    setContextMenu(null)
    const count = selection.nodeIds.size + selection.linkIds.size
    setNotice({ message: count ? t("Selected all {0} nodes and {1} links", [selection.nodeIds.size, selection.linkIds.size]) : t("This Flow has no elements to select"), tone: 'neutral' })
  }, [graph, language])

  const handleGraphEdit = useCallback((action: DesktopEditAction) => {
    if (action === 'undo') undoGraph()
    else if (action === 'redo') redoGraph()
    else if (action === 'copy') copySelectedAgent()
    else if (action === 'paste') pasteAgent()
    else if (action === 'select-all') selectAllElements()
  }, [copySelectedAgent, pasteAgent, redoGraph, selectAllElements, undoGraph, language])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing = Boolean(target?.closest('input,textarea,select,[contenteditable="true"]'))
      const command = event.metaKey || event.ctrlKey
      const graphCommandsActive = surface === 'graph' && !settingsOpen && !autofillDialogOpen && !flowGenerationChoiceOpen && !flowGenerationDialogOpen && !historyBranchRequest && !pendingFiles && !linkConflict
      const key = event.key.toLowerCase()
      if (command && event.key === ',') { event.preventDefault(); setSettingsOpen(true); return }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void onSaveNow(); return }
      if (!editing && command && key === 'a') { event.preventDefault(); if (graphCommandsActive) selectAllElements(); return }
      if (!editing && command && graphCommandsActive && key === 'c' && selectedNode?.type === 'agent') { event.preventDefault(); copySelectedAgent(); return }
      if (!editing && command && graphCommandsActive && key === 'v' && agentClipboard.current) { event.preventDefault(); pasteAgent(); return }
      if (!editing && command && graphCommandsActive && (key === 'y' || (key === 'z' && event.shiftKey))) { event.preventDefault(); redoGraph(); return }
      if (!editing && command && graphCommandsActive && key === 'z') { event.preventDefault(); undoGraph(); return }
      if (event.key === 'Escape') { if (linkConflict) { setLinkConflict(null); return } if (contextMenu) { setContextMenu(null); return } if (surface !== 'graph') { setSurface('graph'); return } }
      if (!editing && (event.key === 'Delete' || event.key === 'Backspace') && selectionCount) {
        event.preventDefault()
        deleteSelection()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [autofillDialogOpen, contextMenu, copySelectedAgent, deleteSelection, flowGenerationChoiceOpen, flowGenerationDialogOpen, historyBranchRequest, linkConflict, onSaveNow, pasteAgent, pendingFiles, redoGraph, selectAllElements, selectedNode, selectionCount, settingsOpen, surface, undoGraph])

  useEffect(() => {
    if (!notice) return
    if (notice.tone === 'error') { recordDiagnostic('workspace.operation-error', { message: notice.message }); return }
    const timer = window.setTimeout(() => setNotice(null), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!contextMenu) return
    const close = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setContextMenu(null) }
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', escape)
    }
  }, [contextMenu])

  useLayoutEffect(() => {
    setSelectedNodeId(null)
    setSelectedLinkId(null)
    setSurface('graph')
    setActiveChatNodeId(null)
    setDragPositions({})
    setNodeMeasurements({})
    setLinkConflict(null)
    setAutofillDialogOpen(false)
    setFlowGenerationChoiceOpen(false)
    setFlowGenerationDialogOpen(false)
    setRunDialogOpen(false)
    clearRun()
  }, [clearRun, storedGraph.id])

  useEffect(() => {
    if (requestedChat?.graphId !== storedGraph.id || storedGraph.definition.nodes[requestedChat.nodeId]?.type !== 'agent') return
    setActiveChatNodeId(requestedChat.nodeId)
    setSurface('chat')
    onChatRequestHandled()
  }, [onChatRequestHandled, requestedChat, storedGraph.definition.nodes, storedGraph.id])

  const updateCanvasNode = useCallback((nodeId: string, patch: { name?: string; nameCustomized?: boolean; provider?: string; model?: string }) => {
    updateGraph((current) => {
      const node = current.nodes[nodeId]
      if (!node) return current
      const patched = { ...node, ...patch, ...(node.type === 'agent' && (patch.model !== undefined || patch.provider !== undefined) ? { parameters: {} } : {}) }
      const updated = { ...current, nodes: { ...current.nodes, [nodeId]: patched } }
      return patched.type === 'agent' && node.type === 'agent' && patched.provider !== node.provider ? reconcileAgentToolOutput(updated, nodeId) : updated
    })
  }, [updateGraph, language])

  const renameGroup = useCallback((groupId: string, name: string) => {
    const result = renameGraphGroup(graph, groupId, name)
    if (result.graph) updateGraph(() => result.graph)
  }, [graph, updateGraph, language])

  const ungroup = useCallback((groupId: string) => {
    const result = ungroupGraphNodes(graph, groupId)
    if (!result.graph) return
    updateGraph(() => result.graph)
    setNotice({ message: t("Ungrouped nodes"), tone: 'success' })
  }, [graph, updateGraph, language])

  const saveCanvasAgent = useCallback((nodeId: string) => {
    const node = graph.nodes[nodeId]
    if (node?.type !== 'agent') return
    void agentLibrary.saveAgent(node)
      .then(() => setNotice({ message: t("“{0}” saved to Agent library", [node.name]), tone: 'success' }))
      .catch((error) => setNotice({ message: error instanceof Error ? error.message : t("Could not save Agent"), tone: 'error' }))
  }, [agentLibrary, graph.nodes, language])

  const changeLinkType = useCallback((linkId: string, type: SingleLinkRelation) => {
    const link = graph.links.find((candidate) => candidate.id === linkId)
    if (!link || link.type === 'merge') return
    const issue = validateLinkCandidate(graph, { sourceId: link.sourceId, targetId: link.targetId, type }, link.id)
    if (issue) { setNotice({ message: linkIssueMessage(issue), tone: 'error' }); return }
    const result = updateLinkTypeWithPromptDefaultsDetailed(graph, linkId, type)
    updateGraph(() => result.graph)
    const targetName = result.targetId ? graph.nodes[result.targetId]?.name : undefined
    setNotice({
      message: result.promptDefaults === 'updated'
        ? t("Link type updated and default prompts synchronized for {0}", [targetName ?? t("Downstream Agent")])
        : result.promptDefaults === 'protected'
          ? t("Link type updated. Custom or locked prompts for {0} retained", [targetName ?? t("Downstream Agent")])
          : t("Link type updated"),
      tone: 'success'
    })
  }, [graph, updateGraph, language])

  const outputArtifact = useCallback((nodeId: string) => {
    const artifactNodeId = graph.nodes[nodeId]?.type === 'agent' ? artifactNodeIdForAgent(graph, nodeId) : nodeId
    return displayedArtifacts.find(item => item.id === displayedArtifactBindings[artifactNodeId])
      ?? displayedArtifacts.filter(item => item.nodeId === artifactNodeId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  }, [displayedArtifactBindings, displayedArtifacts, graph, language])

  const accessOutputFile = useCallback(async (nodeId: string, filePath: string | undefined, action: 'open' | 'reveal') => {
    const desktop = window.agentflowDesktop
    if (!desktop) { setNotice({ message: t("Open output files in the desktop app."), tone: 'error' }); return }
    const artifact = outputArtifact(nodeId)
    if (!artifact) { setNotice({ message: t("This node has no output files yet."), tone: 'error' }); return }
    const index = filePath ? artifact.files?.findIndex(file => file.relativePath === filePath) ?? -1 : artifact.files?.length ? 0 : -1
    if (filePath && index < 0) return
    const path = index >= 0 ? outputFilePath(storedGraph.id, artifact, index) : outputTextPath(storedGraph.id, artifact.nodeId, artifact.id)
    try {
      await desktop.saveProjectFiles(latestWorkspace.current, project.id)
      if (action === 'open') await desktop.openWorkspaceFile(project.workspace, path)
      else await desktop.revealWorkspaceFile(project.workspace, path)
    } catch (error) { setNotice({ message: error instanceof Error ? error.message : t("Could not open the output file."), tone: 'error' }) }
  }, [outputArtifact, project.id, project.workspace, storedGraph.id, language])

  const revealOutput = useCallback((nodeId: string, filePath?: string) => accessOutputFile(nodeId, filePath, 'reveal'), [accessOutputFile, language])

  const openOutput = useCallback(async (nodeId: string, filePath?: string) => {
    const artifact = outputArtifact(nodeId)
    if (!artifact) return
    const outputNode = graph.nodes[artifact.nodeId]
    const files = outputNode?.type === 'output' ? resultFiles(outputNode, artifact) : artifact.files
    const file = filePath ? files?.find((file) => file.relativePath === filePath) : files?.find(isMarkdownOutput) ?? files?.[0]
    if (files !== undefined && !file) { setNotice({ message: t("This node has no files to open yet."), tone: 'neutral' }); return }
    if (file && !isMarkdownOutput(file)) { await accessOutputFile(nodeId, file.relativePath, 'open'); return }
    try {
      let fileContent = file?.content
      if (file && fileContent === undefined && window.agentflowDesktop) {
        await window.agentflowDesktop.saveProjectFiles(latestWorkspace.current, project.id)
        fileContent = await window.agentflowDesktop.readWorkspaceTextFile(project.workspace, outputFilePath(storedGraph.id, artifact, artifact.files!.indexOf(file)))
      }
      setDocumentTarget({ nodeId: artifact.nodeId, artifactId: artifact.id, filePath: file?.relativePath, fileContent }); setSurface('document')
      if (tutorial?.step === 8 && artifact.nodeId === 'result') advanceGuide(9)
    } catch (error) { setNotice({ message: error instanceof Error ? error.message : t("Could not read the Markdown file"), tone: 'error' }) }
  }, [outputArtifact, accessOutputFile, project.id, project.workspace, storedGraph.id, tutorial?.step, graph.nodes, language])
  const toggleFile = useCallback((nodeId: string, id: string) => {
    if (interactionLocked || autofilling || historyViewing || tutorialActive) return
    const artifact = outputArtifact(nodeId)
    updateGraph(current => toggleNodeFile(current, nodeId, id, artifact))
  }, [interactionLocked, autofilling, historyViewing, tutorialActive, outputArtifact, updateGraph, language])
  const openInputFile = useCallback(async (nodeId: string, itemId: string) => {
    const node = graph.nodes[nodeId]
    const item = node?.type === 'input' ? node.items.find(item => item.id === itemId) : undefined
    if (!item) return
    if (item.mode === 'text') { setDocumentTarget({ nodeId, itemId }); setSurface('document'); return }
    try {
      if (!window.agentflowDesktop) throw new Error(t("Open attachments in the desktop app."))
      await window.agentflowDesktop.saveProjectFiles(latestWorkspace.current, project.id)
      await window.agentflowDesktop.openWorkspaceFile(project.workspace, item.workspacePath ?? inputAttachmentPath(storedGraph.id, item.id, item.name))
    } catch (error) { setNotice({ message: error instanceof Error ? error.message : t("Could not open the attachment"), tone: 'error' }) }
  }, [graph.nodes, project.id, project.workspace, storedGraph.id, language])
  const canvasArtifacts = Object.fromEntries(Object.entries(displayedArtifactBindings).flatMap(([nodeId, artifactId]) => {
    const artifact = displayedArtifacts.find(candidate => candidate.id === artifactId)
    return artifact ? [[nodeId, artifact]] : []
  }))
  const outputNodeIds = new Set(displayedArtifacts.map(artifact => artifact.nodeId))
  const canvasActions = useMemo(() => ({ onUpdateNode: updateCanvasNode, onRenameGroup: renameGroup, onUngroup: ungroup, onSaveAgent: saveCanvasAgent, includeCurrentModels: !tutorialMode,
    graphId: storedGraph.id, artifacts: canvasArtifacts, filesLocked: interactionLocked || autofilling || historyViewing || tutorialActive,
    onToggleFile: toggleFile, onEditInput: (nodeId: string, id: string) => { void openInputFile(nodeId, id) },
    onOpenOutput: (nodeId: string, filePath?: string) => { void openOutput(nodeId, filePath) }, onRevealOutput: (nodeId: string, filePath?: string) => { void revealOutput(nodeId, filePath) }, outputNodeIds, providerModels: availableProviders
  }), [availableProviders, renameGroup, saveCanvasAgent, ungroup, updateCanvasNode, revealOutput, openOutput, tutorialMode, tutorialActive, storedGraph.id, canvasArtifacts, interactionLocked, autofilling, historyViewing, toggleFile, openInputFile, language])
  const flowNodes = useMemo(() => buildFlowNodes(graph, canvasRuntimeNodes, selectedNodeIds, canvasActions).map((node) => ({ ...node, position: dragPositions[node.id] ?? node.position, measured: nodeMeasurements[node.id] })), [canvasActions, canvasRuntimeNodes, dragPositions, graph, selectedNodeIds, nodeMeasurements, language])
  const flowEdges = useMemo(() => buildFlowEdges(graph, edgeTargets, selectedLinkIds, changeLinkType), [changeLinkType, edgeTargets, graph, selectedLinkIds, language])

  const requestLinkCreation = useCallback((sourceId: string, targetId: string, type: SingleLinkRelation) => {
    if (tutorial) {
      const expected = tutorial.step === 2 ? ['writer', 'reviewer'] : tutorial.step === 4 ? [tutorialReviewerSource(graph), 'reviser'] : tutorial.step === 9 ? ['result', 'delivery'] : null
      if (!expected || expected[0] !== sourceId || expected[1] !== targetId) { window.dispatchEvent(new Event('agentflow:tutorial-refocus')); return }
    }
    const candidate = { sourceId, targetId, type }
    const issue = validateLinkCandidate(graph, candidate)
    if (issue && issue !== 'duplicate-link') {
      setNotice({ message: linkIssueMessage(issue), tone: 'error' })
      return
    }
    const source = graph.nodes[sourceId]
    const hasWorkerIncomingLink = graph.links.some((link) =>
      link.targetId === targetId &&
      linkSourceIds(link).some((incomingSourceId) => {
        const incomingSource = graph.nodes[incomingSourceId]
        return incomingSource?.type === 'agent' || incomingSource?.type === 'output'
      })
    )
    if ((source?.type === 'agent' || source?.type === 'output') && hasWorkerIncomingLink) {
      setLinkConflict(candidate)
      return
    }
    if (issue) {
      setNotice({ message: linkIssueMessage(issue), tone: 'error' })
      return
    }
    const link: LinkDefinition = { id: createId('link'), ...candidate }
    const result = addLinkWithPromptDefaultsDetailed(graph, link)
    updateGraph(() => result.graph)
    setSelectedNodeId(null)
    setSelectedLinkId(link.id)
    setNotice({ message: result.promptDefaults === 'updated' ? t("Link created and downstream default prompts synchronized") : result.promptDefaults === 'protected' ? t("Link created. Downstream custom or locked prompts retained") : t("Link created"), tone: 'success' })
  }, [graph, tutorial?.step, setSelectedLinkId, setSelectedNodeId, updateGraph, language])

  const copyDownstreamForConflict = useCallback(() => {
    if (!linkConflict || running) return
    const target = graph.nodes[linkConflict.targetId]
    const source = graph.nodes[linkConflict.sourceId]
    if (target?.type !== 'agent' || !source) {
      setLinkConflict(null)
      setNotice({ message: t("A connection endpoint no longer exists"), tone: 'error' })
      return
    }
    rememberGraph()
    const nodeId = createId('agent')
    const node: AgentNodeDefinition = {
      ...target,
      name: nextAgentCopyName(graph, target.name),
      nameCustomized: true,
      parameters: target.parameters ? { ...target.parameters } : undefined,
      prompts: {
        system: { ...target.prompts.system },
        input: { ...target.prompts.input },
        output: { ...target.prompts.output }
      },
      position: { x: (target.position?.x ?? 260) + 42, y: (target.position?.y ?? 140) + 42 }
    }
    const link: LinkDefinition = { id: createId('link'), sourceId: linkConflict.sourceId, targetId: nodeId, type: linkConflict.type }
    const withNode = cloneOwnedOutput({ ...graph, nodes: { ...graph.nodes, [nodeId]: node } }, linkConflict.targetId, nodeId, node)
    const result = addLinkWithPromptDefaultsDetailed(withNode, link)
    const now = new Date().toISOString()
    setWorkspace((current) => current ? {
      ...current,
      graphs: current.graphs.map((candidate) => candidate.id === storedGraph.id ? { ...candidate, definition: result.graph, revision: candidate.revision + 1, updatedAt: now } : candidate),
      sessions: [...current.sessions, createAgentSession(project.id, storedGraph.id, nodeId, project.workspace)],
      projects: current.projects.map((candidate) => candidate.id === project.id ? { ...candidate, updatedAt: now } : candidate),
      updatedAt: now
    } : current)
    setLinkConflict(null)
    clearRun()
    setSelectedNodeId(null)
    setSelectedLinkId(link.id)
    setNotice({ message: t("{0} created and the new link connected to the copy", [node.name]), tone: 'success' })
  }, [clearRun, graph, linkConflict, project.id, project.workspace, rememberGraph, running, setSelectedLinkId, setSelectedNodeId, setWorkspace, storedGraph.id, language])

  const mergeIncomingForConflict = useCallback(() => {
    if (!linkConflict || running) return
    const result = mergeAgentSourceIntoTarget(graph, linkConflict.sourceId, linkConflict.targetId)
    if (result.issue) {
      setNotice({ message: graphOperationMessage(result.issue), tone: 'error' })
      return
    }
    const synced = syncAgentLinkPromptDefaults(result.graph, linkConflict.targetId)
    const mergeLink = synced.graph.links.find((link) => link.targetId === linkConflict.targetId)
    updateGraph(() => synced.graph)
    setLinkConflict(null)
    setSelectedNodeId(null)
    setSelectedLinkId(mergeLink?.id ?? null)
    setNotice({ message: synced.promptDefaults === 'updated' ? t("Upstream links merged and downstream default prompts synchronized") : t("Upstream links merged"), tone: 'success' })
  }, [graph, linkConflict, running, setSelectedLinkId, setSelectedNodeId, updateGraph, language])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Preserve React Flow's measurements so ordinary renders keep link controls mounted.
    if (changes.some((change) => change.type === 'dimensions')) setNodeMeasurements((current) => {
      let next = current
      for (const change of changes) {
        if (change.type !== 'dimensions' || !change.dimensions) continue
        if (current[change.id]?.width === change.dimensions.width && current[change.id]?.height === change.dimensions.height) continue
        if (next === current) next = { ...current }
        next[change.id] = change.dimensions
      }
      return next
    })
    if (groupDrag.current) return
    setDragPositions((current) => {
      let next = current
      for (const change of changes) {
        if (change.type !== 'position' || !change.position) continue
        if (next === current) next = { ...current }
        next[change.id] = change.position
      }
      return next
    })
  }, [language])

  const onNodeDragStart = useCallback((_: MouseEvent | TouchEvent, node: FlowNode) => {
    const group = node.id.startsWith('group:')
      ? (graph.groups ?? []).find((candidate) => `group:${candidate.id}` === node.id)
      : (graph.groups ?? []).find((candidate) => candidate.nodeIds.includes(node.id))
    if (!group) { groupDrag.current = null; return }
    const groupNode = flowNodes.find((candidate) => candidate.id === `group:${group.id}`)
    groupDrag.current = {
      groupId: group.id,
      anchorStart: { ...node.position },
      memberStarts: Object.fromEntries(group.nodeIds.map((nodeId) => [nodeId, { x: graph.nodes[nodeId]?.position?.x ?? 0, y: graph.nodes[nodeId]?.position?.y ?? 0 }])),
      groupStart: { x: groupNode?.position.x ?? 0, y: groupNode?.position.y ?? 0 }
    }
  }, [flowNodes, graph.groups, graph.nodes, language])

  const onNodeDrag = useCallback((_: MouseEvent | TouchEvent, node: FlowNode) => {
    const drag = groupDrag.current
    if (!drag) return
    const delta = { x: node.position.x - drag.anchorStart.x, y: node.position.y - drag.anchorStart.y }
    setDragPositions({
      ...Object.fromEntries(Object.entries(drag.memberStarts).map(([nodeId, start]) => [nodeId, { x: start.x + delta.x, y: start.y + delta.y }])),
      [`group:${drag.groupId}`]: { x: drag.groupStart.x + delta.x, y: drag.groupStart.y + delta.y }
    })
  }, [language])

  const onNodeDragStop = useCallback((_: MouseEvent | TouchEvent, node: FlowNode) => {
    const drag = groupDrag.current
    if (drag) {
      const delta = { x: node.position.x - drag.anchorStart.x, y: node.position.y - drag.anchorStart.y }
      const result = moveGraphGroup(graph, drag.groupId, delta)
      groupDrag.current = null
      setDragPositions({})
      if (result.graph) updateGraph(() => result.graph)
      return
    }
    updateGraph((current) => {
      const definition = current.nodes[node.id]
      if (!definition) return current
      return { ...current, nodes: { ...current.nodes, [node.id]: { ...definition, position: node.position } } }
    })
    setDragPositions((current) => { const next = { ...current }; delete next[node.id]; return next })
  }, [graph, updateGraph, language])

  const selectNode = useCallback((event: React.MouseEvent, nodeId: string) => {
    setContextMenu(null)
    if (!event.shiftKey) {
      setSelectedNodeId(nodeId)
      setSelectedLinkId(null)
      return
    }
    setSelectedNodeIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId)
      return next
    })
  }, [setSelectedLinkId, setSelectedNodeId, language])

  const selectLink = useCallback((event: React.MouseEvent, linkId: string) => {
    setContextMenu(null)
    if (!event.shiftKey) {
      setSelectedLinkId(linkId)
      setSelectedNodeId(null)
      return
    }
    setSelectedLinkIds((current) => {
      const next = new Set(current)
      if (next.has(linkId)) next.delete(linkId); else next.add(linkId)
      return next
    })
  }, [setSelectedLinkId, setSelectedNodeId, language])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    connectionCompleted.current = true
    const sourceType = graph.nodes[connection.source]?.type
    const type: SingleLinkRelation = sourceType === 'input' || sourceType === 'output' ? 'input' : 'pass'
    requestLinkCreation(connection.source, connection.target, type)
  }, [graph.nodes, requestLinkCreation, language])

  const onConnectStart = useCallback((_: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
    connectionCompleted.current = false
    connectionSource.current = params.handleType === 'source' ? params.nodeId : null
    setConnectingSourceId(connectionSource.current)
  }, [language])

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const sourceId = connectionSource.current
    const completed = connectionCompleted.current
    connectionSource.current = null
    connectionCompleted.current = false
    setConnectingSourceId(null)
    if (!sourceId || completed) return
    const element = connectEndElement(event)
    const targetId = connectEndAgentId(event, element)
    if (!targetId) return
    const sourceType = graph.nodes[sourceId]?.type
    const type: SingleLinkRelation = sourceType === 'input' || sourceType === 'output' ? 'input' : 'pass'
    requestLinkCreation(sourceId, targetId, type)
  }, [graph, requestLinkCreation, setSelectedLinkId, setSelectedNodeId, updateGraph, language])

  const applyEvent = useCallback(async (event: RuntimeEvent) => {
    setEvents((current) => [event, ...current].slice(0, 50))
    if (event.type === 'run.started') setRunId(event.runId)
    if (event.type === 'artifact.created') {
      setArtifacts((current) => ({ ...current, [event.nodeId]: event.artifact }))
      setRuntimeNodes((current) => ({ ...current, [event.nodeId]: { status: current[event.nodeId]?.status ?? 'running', artifactVersion: event.artifact.version, fileNames: event.artifact.files?.map((file) => file.name) } }))
    }
    if (event.type === 'node.status') {
      setRuntimeNodes((current) => ({ ...current, [event.nodeId]: { ...current[event.nodeId], status: event.status } }))
      setEdgeTargets((current) => ({ ...current, [event.nodeId]: event.status }))
    }
    setWorkspace((current) => {
      if (!current) return current
      if (event.type !== 'artifact.created') return { ...current, updatedAt: event.at }
      const storedArtifact = { ...event.artifact, projectId: project.id, graphId: storedGraph.id, origin: 'run' as const }
      return {
        ...current,
        artifacts: [...current.artifacts.filter((artifact) => artifact.id !== storedArtifact.id), storedArtifact],
        workingArtifactIds: {
          ...current.workingArtifactIds,
          [storedGraph.id]: { ...(current.workingArtifactIds[storedGraph.id] ?? {}), [event.nodeId]: event.artifact.id }
        },
        updatedAt: event.at
      }
    })
  }, [project.id, storedGraph.id, setWorkspace, language])

  const runGraph = async (skipUnsupportedFiles = false) => {
    if (tutorialMode) { await runTutorial(); return }
    if (historyViewing) { setNotice({ message: t("Historical states are read-only. Fork into a new Flow first"), tone: 'neutral' }); return }
    if (runController.current || autofillController.current || flowGenerationController.current) return
    const parsed = graphDefinitionSchema.safeParse(graphForRun(graph, flowRunPlan))
    if (!parsed.success) { setNotice({ message: formatValidationError(parsed.error), tone: 'error' }); return }
    const batch = skipUnsupportedFiles && pausedRun.current
      ? { graphs: [pausedRun.current.graph], batchSize: 1, issues: [] as string[] }
      : planBatchRuns(parsed.data)
    if (batch.issues.length) { setNotice({ message: batch.issues.join(t('; ')), tone: 'error' }); return }
    setRunDialogOpen(false)
    const controller = new AbortController()
    runController.current = controller
    setUnsupportedFiles(null)
    setRunning(true)
    if (!skipUnsupportedFiles) {
      clearRun(); pausedRun.current = null
      setRuntimeNodes(Object.fromEntries(Object.keys(graph.nodes).map(id => [id, { status: 'idle' }])))
    }
    try {
      const batchId = batch.batchSize > 1 ? createId('batch') : undefined
      const baseRunId = workspace.workingBaseRunIds[storedGraph.id]
      const versionCursor = Object.fromEntries(Object.keys(parsed.data.nodes).map((nodeId) => [nodeId, Math.max(0, ...workspace.artifacts.filter((artifact) => artifact.graphId === storedGraph.id && artifact.nodeId === nodeId).map((artifact) => artifact.version))]))
      for (const [batchIndex, runGraphSnapshot] of batch.graphs.entries()) {
        const artifactVersions = Object.fromEntries(Object.keys(runGraphSnapshot.nodes).map((nodeId) => [nodeId, (versionCursor[nodeId] ?? 0) + 1]))
        const result = await executeGraph(runGraphSnapshot, {
          delayMs: 0, signal: controller.signal, onEvent: applyEvent,
          resumeArtifacts: skipUnsupportedFiles ? pausedRun.current?.artifacts : undefined,
          artifactVersions,
          skipUnsupportedFiles,
          modelInvoker: async (request, onDelta, signal) => {
            if (!window.agentflowDesktop) throw new Error(t("Live providers can be called from the desktop app"))
            if (request.providerId.startsWith('agent-tool:')) await window.agentflowDesktop.saveProjectFiles(latestWorkspace.current, project.id)
            return invokeDesktopModel(window.agentflowDesktop, { ...request, workspace: project.workspace }, onDelta, signal)
          }
        })
        result.artifacts.forEach((artifact) => { versionCursor[artifact.nodeId] = Math.max(versionCursor[artifact.nodeId] ?? 0, artifact.version) })
        if (result.status === 'paused' && result.blocked) {
          pausedRun.current = { graph: runGraphSnapshot, artifacts: result.artifacts }
          setUnsupportedFiles({ nodeName: result.blocked.nodeName, files: result.blocked.files })
          setNotice({ message: t("Flow paused before {0}", [result.blocked.nodeName]), tone: 'neutral' })
          break
        }
        if (result.status === 'completed') {
          pausedRun.current = null
          const completedAt = new Date().toISOString()
          setWorkspace((current) => current ? {
            ...current,
            runs: [{ id: result.runId, projectId: project.id, graphId: storedGraph.id, graphRevision: storedGraph.revision,
              graphSnapshot: structuredClone(runGraphSnapshot), parentRunId: baseRunId,
              sessionBindings: Object.fromEntries(current.sessions.filter((session) => session.graphId === storedGraph.id && session.isActive).map((session) => [session.agentNodeId, session.id])),
              workspaceSnapshot: { ...project.workspace }, artifacts: result.artifacts, events: result.events, createdAt: result.events[0]?.at ?? completedAt,
              completedAt, status: 'completed', artifactBindings: Object.fromEntries(result.artifacts.map((artifact) => [artifact.nodeId, artifact.id])),
              batchId, batchIndex: batchId ? batchIndex : undefined, batchSize: batchId ? batch.batchSize : undefined }, ...current.runs],
            workingBaseRunIds: { ...current.workingBaseRunIds, [storedGraph.id]: result.runId },
            updatedAt: completedAt
          } : current)
        }
        if (result.status === 'cancelled') { setNotice({ message: t("Flow stopped. Completed Agent outputs are available."), tone: 'neutral' }); break }
      }
      if (!controller.signal.aborted && !pausedRun.current) setNotice({ message: batch.batchSize > 1 ? t("Batch run complete · {0} groups", [batch.batchSize]) : t("Flow complete."), tone: 'success' })
    } catch (error) {
      setNotice({ message: controller.signal.aborted ? t("Flow stopped") : error instanceof Error ? error.message : t("Run failed"), tone: controller.signal.aborted ? 'neutral' : 'error' })
    } finally { if (runController.current === controller) { runController.current = null; setRunning(false) } }
  }

  const runAgent = async (nodeId: string, scope: AgentRunScope = 'single') => {
    if (tutorialMode) { await runTutorial(); return }
    const node = graph.nodes[nodeId]
    if (historyViewing) { setNotice({ message: t("Historical states are read-only. Fork into a new Flow first"), tone: 'neutral' }); return }
    if (node?.type !== 'agent' || runController.current || autofillController.current || flowGenerationController.current) return
    const plan = planAgentRun(graph, nodeId, scope)
    const selectedArtifacts = plan.reuseNodeIds.flatMap((sourceId) => {
      const artifactId = workspace.workingArtifactIds[storedGraph.id]?.[sourceId]
      const artifact = artifactId ? workspace.artifacts.find((candidate) => candidate.id === artifactId) : undefined
      return artifact ? [artifact] : []
    })
    const missing = plan.reuseNodeIds.filter((sourceId) => !selectedArtifacts.some((artifact) => artifact.nodeId === sourceId))
    if (missing.length) {
      if (scope === 'single') setMissingUpstreamRun({ nodeId, missingIds: missing })
      else setNotice({ message: t('Missing reusable upstream output: {0}. Run those Agents first.', [missing.map(id => graph.nodes[id]?.name ?? id).join(' / ')]), tone: 'error' })
      return
    }
    const inputIssue = agentRunInputIssue(graph, nodeId, runInputArtifacts, scope === 'upstream')
    if (inputIssue) { setNotice({ message: inputIssue, tone: 'error' }); return }
    const included = plan.runNodeIds
    const artifactVersions = Object.fromEntries(included.map((id) => [id, Math.max(0, ...workspace.artifacts.filter((artifact) => artifact.graphId === storedGraph.id && artifact.nodeId === id).map((artifact) => artifact.version)) + 1]))
    const controller = new AbortController()
    runController.current = controller
    setRunning(true)
    setRuntimeNodes(current => ({ ...current, ...Object.fromEntries(included.map(id => [id, { status: 'waiting' as const }])) }))
    setEdgeTargets({})
    setEvents([])
    try {
      const result = await executeGraph(graph, {
        nodeIds: included,
        delayMs: 0,
        signal: controller.signal,
        onEvent: applyEvent,
        resumeArtifacts: selectedArtifacts,
        artifactVersions,
        modelInvoker: async (request, onDelta, signal) => {
          if (!window.agentflowDesktop) throw new Error(t("Live providers can be called from the desktop app"))
          if (request.providerId.startsWith('agent-tool:')) await window.agentflowDesktop.saveProjectFiles(latestWorkspace.current, project.id)
            return invokeDesktopModel(window.agentflowDesktop, { ...request, workspace: project.workspace }, onDelta, signal)
        }
      })
      setNotice({ message: result.status === 'completed' ? scope === 'upstream' ? t('Upstream run completed through {0}', [node.name]) : scope === 'downstream' ? t('Downstream run completed from {0}', [node.name]) : t("{0} generated a new artifact", [node.name]) : t("Run stopped. Completed artifacts are available."), tone: result.status === 'completed' ? 'success' : 'neutral' })
    } catch (error) {
      setNotice({ message: controller.signal.aborted ? t("Run stopped") : error instanceof Error ? error.message : t("Run failed"), tone: controller.signal.aborted ? 'neutral' : 'error' })
    } finally {
      if (runController.current === controller) { runController.current = null; setRunning(false) }
    }
  }

  const publishChatArtifact = (messageId: string, mode: 'reply' | 'transcript') => {
    if (!activeSession || !activeChatNodeId) return
    const path = visibleChatMessages(activeSession)
    const messageIndex = path.findIndex((message) => message.id === messageId)
    const message = path[messageIndex]
    if (message?.role !== 'assistant') return
    const content = mode === 'reply' ? message.content : path.slice(0, messageIndex + 1).map((item) => `### ${item.role === 'user' ? t("You") : activeChatNode?.name ?? 'Agent'}\n\n${item.content}`).join('\n\n')
    const artifactNodeId = artifactNodeIdForAgent(graph, activeChatNodeId)
    const version = Math.max(0, ...workspace.artifacts.filter((artifact) => artifact.graphId === storedGraph.id && artifact.nodeId === artifactNodeId).map((artifact) => artifact.version)) + 1
    const now = new Date().toISOString()
    const id = createId('artifact')
    const currentId = workspace.workingArtifactIds[storedGraph.id]?.[artifactNodeId]
    const current = currentId ? workspace.artifacts.find((artifact) => artifact.id === currentId) : undefined
    const artifact = { id, runId: createId('chat'), nodeId: artifactNodeId, version, content, parentArtifacts: currentId ? [currentId] : [], sourceInputs: current?.sourceInputs ?? [], createdAt: now, parts: mode === 'reply' ? message.parts : undefined, providerState: mode === 'reply' ? message.providerState : undefined, projectId: project.id, graphId: storedGraph.id, origin: mode === 'reply' ? 'chat-reply' as const : 'chat-transcript' as const, label: mode === 'reply' ? t("Chat reply") : t("Full conversation") }
    setWorkspace((state) => state ? { ...state, artifacts: [...state.artifacts, artifact], workingArtifactIds: { ...state.workingArtifactIds, [storedGraph.id]: { ...(state.workingArtifactIds[storedGraph.id] ?? {}), [artifactNodeId]: id } }, updatedAt: now } : state)
    setArtifacts((currentArtifacts) => ({ ...currentArtifacts, [artifactNodeId]: artifact }))
    setNotice({ message: mode === 'reply' ? t("Current reply set as result output") : t("Conversation up to this point set as result output"), tone: 'success' })
  }

  const resetSession = (nodeId: string) => {
    const now = new Date().toISOString()
    setWorkspace((current) => {
      if (!current) return current
      const artifactId = current.workingArtifactIds[storedGraph.id]?.[artifactNodeIdForAgent(graph, nodeId)]
      const artifact = artifactId ? current.artifacts.find((candidate) => candidate.id === artifactId) : undefined
      const fresh = seedSessionFromArtifact(createAgentSession(project.id, storedGraph.id, nodeId, project.workspace), artifact)
      return {
        ...current,
        sessions: [...current.sessions.map((session) => session.graphId === storedGraph.id && session.agentNodeId === nodeId && session.isActive ? { ...session, isActive: false, status: 'archived' as const, updatedAt: now } : session), fresh],
        suppressedSessionAgentIds: (current.suppressedSessionAgentIds ?? []).filter((id) => id !== nodeId),
        updatedAt: now
      }
    })
    setNotice({ message: t("New Agent session created"), tone: 'success' })
  }

  const sendMessage = async () => {
    const content = composerValue.trim()
    if (!content || !activeSession || activeChatNode?.type !== 'agent' || replying) return
    const sessionId = activeSession.id
    const editing = editingMessageId ? activeSession.messages.find((message) => message.id === editingMessageId) : undefined
    if (editing?.role === 'assistant') {
      const replacement = { id: createId('message'), role: 'assistant' as const, content, createdAt: new Date().toISOString(), manual: true }
      updateSession(setWorkspace, sessionId, (session) => editChatMessageCandidate(session, editing.id, replacement))
      setComposerValue(''); setEditingMessageId(null)
      return
    }
    const userMessage: PersistedChatMessage = { id: createId('message'), role: 'user', content, createdAt: new Date().toISOString() }
    const sessionWithUser = editing?.role === 'user'
      ? editChatMessageCandidate(activeSession, editing.id, userMessage)
      : appendChatMessage(activeSession, userMessage)
    setComposerValue('')
    setEditingMessageId(null)
    setReplying(true)
    setStreamingReply('')
    updateSession(setWorkspace, sessionId, () => ({ ...sessionWithUser, status: 'running' }))
    const messages = buildChatModelMessages(graph, activeChatNode, sessionWithUser, llmSettings.chatHistoryMaxChars)
    try {
      const result = tutorialMode
        ? { content: tutorialOutputs[activeChatNodeId === 'local' ? 'result' : activeChatNodeId ?? ''] ?? t("Return to Flow to continue."), providerId: activeChatNode.provider, model: activeChatNode.model }
        : activeChatNode.provider === 'fake'
        ? { content: t("Received: {0}\n\nThis is a local demo response. Configure a provider API key in settings to use a live model.", [content]), providerId: 'fake', model: activeChatNode.model }
        : window.agentflowDesktop
          ? await window.agentflowDesktop.invokeModel({
              providerId: activeChatNode.provider,
              model: activeChatNode.model,
              messages,
              externalSessionId: activeChatNode.provider === 'subscription:deepseek-web'
                ? visibleChatMessages(sessionWithUser).filter((message) => message.role === 'assistant').at(-1)?.externalSessionId
                : undefined,
              parameters: activeChatNode.parameters,
              workspace: project.workspace
            }, (delta) => setStreamingReply((current) => current + delta))
          : (() => { throw new Error(t("Live providers can be called from the desktop app")) })()
      updateSession(setWorkspace, sessionId, (session) => appendChatMessage({
        ...session,
        connector: activeChatNode.provider.startsWith('agent-tool:') ? 'agent-tool' : activeChatNode.provider.startsWith('subscription:') ? 'subscription' : 'model',
        externalSessionId: result.externalSessionId ?? session.externalSessionId,
        status: 'idle'
      }, { id: createId('message'), role: 'assistant', content: result.content, parts: result.parts, providerState: result.providerState, externalSessionId: result.externalSessionId, createdAt: new Date().toISOString() }, userMessage.id))
    } catch (error) {
      updateSession(setWorkspace, sessionId, (session) => ({ ...session, status: 'failed' }))
      setNotice({ message: error instanceof Error ? error.message : t("Model request failed"), tone: 'error' })
    } finally {
      setStreamingReply('')
      setReplying(false)
    }
  }

  const openProjectGraph = (projectId: string, graphId: string) => {
    setWorkspace((current) => current ? { ...current, activeProjectId: projectId, activeGraphId: graphId, ...(current.projects.find((candidate) => candidate.id === projectId)?.workspace.mode === 'temporary' ? { activeTemporaryProjectId: projectId } : {}), updatedAt: new Date().toISOString() } : current)
    setSurface('graph')
    if (window.innerWidth <= 640) setSidebarHidden(true)
  }
  const createGraph = (projectId: string) => {
    setWorkspace((current) => current ? createFlowInProject(current, projectId) : current)
    setSurface('graph')
    if (window.innerWidth <= 640) setSidebarHidden(true)
  }

  const createTemporaryProject = () => {
    setWorkspace((current) => current ? openOrCreateTemporaryProject(current) : current)
    setSurface('graph')
    if (window.innerWidth <= 640) setSidebarHidden(true)
  }

  const changeActiveChatModel = (provider: string, model: string) => {
    if (!activeChatNodeId) return
    updateGraph((current) => {
      const node = current.nodes[activeChatNodeId]
      if (node?.type !== 'agent') return current
      const updated = { ...current, nodes: { ...current.nodes, [activeChatNodeId]: { ...node, provider, model, parameters: {} } } }
      return provider !== node.provider ? reconcileAgentToolOutput(updated, activeChatNodeId) : updated
    })
    setNotice({ message: t("Model changed to {0} · {1}", [provider, model]), tone: 'success' })
  }

  const openChat = (nodeId: string) => {
    if (historyViewing) { setNotice({ message: t("Fork the historical state into a new Flow to start a session"), tone: 'neutral' }); return }
    if (graph.nodes[nodeId]?.type !== 'agent') return
    setWorkspace((current) => {
      if (!current) return current
      const artifactId = current.workingArtifactIds[storedGraph.id]?.[artifactNodeIdForAgent(graph, nodeId)]
      const artifact = artifactId ? current.artifacts.find((candidate) => candidate.id === artifactId) : undefined
      const active = getActiveSession(current, storedGraph.id, nodeId)
      if (active) {
        return { ...current, sessions: current.sessions.map((session) => session.id === active.id ? seedSessionFromArtifact(session, artifact) : session), updatedAt: new Date().toISOString() }
      }
      const nextSession = seedSessionFromArtifact(createAgentSession(project.id, storedGraph.id, nodeId, project.workspace), artifact)
      return {
        ...current,
        sessions: [...current.sessions, nextSession],
        suppressedSessionAgentIds: (current.suppressedSessionAgentIds ?? []).filter((id) => id !== nodeId),
        updatedAt: new Date().toISOString()
      }
    })
    setActiveChatNodeId(nodeId)
    setSurface('chat')
  }

  const openSession = (nodeId: string) => {
    openChat(nodeId)
    if (window.innerWidth <= 640) setSidebarHidden(true)
  }

  const sessionDeleted = (nodeId: string) => {
    if (activeChatNodeId !== nodeId) return
    setActiveChatNodeId(null)
    setSurface('graph')
  }

  const requestInputFiles = (files: File[], targetNodeId?: string, position?: { x: number; y: number }) => {
    if (historyViewing) { requestHistoryBranch(); return }
    if (!files.length) return
    setPendingFiles({ files, targetNodeId, position })
  }

  const confirmFileImport = async () => {
    if (!pendingFiles) return
    try {
      const rejected = pendingFiles.files.filter((file) => classifyInputFile(file) === 'unsupported')
      const accepted = pendingFiles.files.filter((file) => classifyInputFile(file) !== 'unsupported')
      const imported = await Promise.all(accepted.map((file) => importInputFile(file)))
      imported.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))
      if (!imported.length) throw new Error(t("No importable files"))
      const targetNodeId = pendingFiles.targetNodeId
      if (targetNodeId && graph.nodes[targetNodeId]?.type === 'input') {
        updateGraph((current) => {
          const node = current.nodes[targetNodeId]
          if (node?.type !== 'input') return current
          const items = node.orderMode === 'manual' ? [...node.items, ...imported] : [...node.items, ...imported].sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))
          return { ...current, nodes: { ...current.nodes, [targetNodeId]: { ...node, items, orderMode: node.orderMode ?? 'name', executionMode: imported.length > 1 || node.executionMode === 'for-each' ? 'for-each' : node.executionMode } } }
        })
        setSelectedNodeId(targetNodeId)
      } else {
        const id = createId('input')
        const node: InputNodeDefinition = {
          type: 'input',
          name: imported.length > 1 ? t("Input group · {0} items", [imported.length]) : imported[0]?.name ?? t("File input"),
          items: imported,
          executionMode: imported.length > 1 ? 'for-each' : 'all',
          orderMode: 'name',
          position: pendingFiles.position ?? { x: 70, y: 110 + Object.keys(graph.nodes).length * 44 }
        }
        updateGraph((current) => ({ ...current, nodes: { ...current.nodes, [id]: node } }))
        setSelectedNodeId(id)
      }
      setSelectedLinkId(null)
      setPendingFiles(null)
      setNotice({ message: rejected.length ? t("Imported {0} files; filtered {1} unsupported files", [imported.length, rejected.length]) : t("Imported {0} files", [imported.length]), tone: 'success' })
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : t("File processing failed"), tone: 'error' })
    }
  }

  const onCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes(NODE_FILES_DRAG_TYPE)) {
      event.preventDefault()
      if (interactionLocked || autofilling || historyViewing || tutorialActive || (event.target as HTMLElement).closest('.react-flow__node')) return
      try {
        const payload = parseNodeFilesDrag(event.dataTransfer.getData(NODE_FILES_DRAG_TYPE))
        if (payload.graphId !== storedGraph.id) throw new Error(t("Drop files onto the current Flow canvas."))
        const id = createId('input')
        const next = detachNodeFiles(graph, payload, id, screenToFlowPosition({ x: event.clientX, y: event.clientY }), outputArtifact(payload.nodeId))
        updateGraph(() => next)
        setSelectedNodeId(id); setSelectedLinkId(null)
        setNotice({ message: t("Moved {0} items into a new input", [payload.ids.length]), tone: 'success' })
      } catch (error) { setNotice({ message: error instanceof Error ? error.message : t("Could not move files. Try again."), tone: 'error' }) }
      return
    }
    if (event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) {
      event.preventDefault()
      if (running) return
      try { addLibraryNode(JSON.parse(event.dataTransfer.getData(LIBRARY_DRAG_TYPE)), screenToFlowPosition({ x: event.clientX, y: event.clientY })) }
      catch { setNotice({ message: t("Could not read the dropped node. Drag it again from the model or Agent library"), tone: 'error' }) }
      return
    }
    if (!event.dataTransfer.files.length) return
    event.preventDefault()
    requestInputFiles([...event.dataTransfer.files], undefined, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }

  const openPromptAutofill = () => {
    if (tutorialActionBlocked([6])) return
    if (!agentCount) {
      setNotice({ message: t("Add at least one Agent first"), tone: 'error' })
      return
    }
    const selection = tutorialMode ? { providerId: 'anthropic', model: 'claude-fable-5-1' } : resolveFeatureModelSelection(llmSettings.promptAutofill, featureModelProviders)
    if (!selection) {
      setNotice({ message: t("Connect a provider for prompt autofill in settings first"), tone: 'error' })
      setSettingsOpen(true)
      return
    }
    setPromptAutofillSelection(selection)
    setAutofillDialogOpen(true)
  }

  const openFlowGeneration = () => {
    if (tutorialActionBlocked([0])) return
    const selection = tutorialMode ? { providerId: 'anthropic', model: 'claude-fable-5-1' } : resolveFeatureModelSelection(llmSettings.flowGeneration, featureModelProviders)
    if (!selection) {
      setNotice({ message: t("Connect a provider for Flow generation in settings first"), tone: 'error' })
      setSettingsOpen(true)
      return
    }
    if (tutorialMode) setFlowGenerationDescription(TUTORIAL_DESCRIPTION())
    setFlowGenerationSelection(selection)
    setFlowGenerationPreview(null)
    if (agentCount) setFlowGenerationChoiceOpen(true)
    else {
      setFlowGenerationMode('replace')
      setFlowGenerationDialogOpen(true)
    }
  }

  const chooseFlowGenerationMode = (mode: FlowGenerationMode) => {
    setFlowGenerationMode(mode)
    setFlowGenerationChoiceOpen(false)
    setFlowGenerationPreview(null)
    setFlowGenerationDialogOpen(true)
  }

  const openRunConfirmation = () => {
    if (tutorialActionBlocked([7, 10])) return
    if (!agentCount) {
      setNotice({ message: t("Add at least one Agent first"), tone: 'error' })
      return
    }
    setRunDialogOpen(true)
  }

  const autofillPrompts = async (mode: PromptAutofillMode) => {
    if (tutorialMode) {
      if (autofillController.current || tutorialActionBlocked([6])) return
      const controller = new AbortController()
      autofillController.current = controller; setAutofilling(true)
      try {
        if (!await tutorialDelay(1100, controller.signal)) return
        const filled = tutorialGraph(7, tutorial?.tool, tutorial?.reviewer).nodes.reviewer as AgentNodeDefinition
        updateGraph((current) => {
          const reviewer = current.nodes.reviewer
          if (reviewer?.type !== 'agent') return current
          const prompts = { ...reviewer.prompts }
          for (const key of ['system', 'input', 'output'] as const) if (!prompts[key].locked) prompts[key] = filled.prompts[key]
          return { ...current, nodes: { ...current.nodes, reviewer: { ...reviewer, prompts } } }
        })
        setAutofillDialogOpen(false); advanceGuide(7)
      } finally {
        if (autofillController.current === controller) { autofillController.current = null; setAutofilling(false) }
      }
      return
    }
    if (autofillController.current || flowGenerationController.current || runController.current) return
    if (!window.agentflowDesktop) {
      setAutofillDialogOpen(false)
      setNotice({ message: t("Use the desktop app to autofill prompts with a live provider"), tone: 'error' })
      return
    }
    const { providerId, model } = promptAutofillSelection
    if (!isFeatureModelSelectionAvailable(promptAutofillSelection, featureModelProviders) || !providerId || !model) {
      setNotice({ message: t("Choose a connected provider and an available model"), tone: 'error' })
      return
    }
    const controller = new AbortController()
    autofillController.current = controller
    setAutofilling(true)
    try {
      const response = await invokeDesktopModel(window.agentflowDesktop, {
        providerId,
        model,
        messages: buildPromptAutofillMessages(graph, mode),
        responseMode: 'structured',
        parameters: featureReasoningParameters(providerId, model),
        workspace: project.workspace
      }, undefined, controller.signal)
      controller.signal.throwIfAborted()
      const latestGraph = latestWorkspace.current.graphs.find((candidate) => candidate.id === storedGraph.id)
      if (!latestGraph || latestGraph.revision !== storedGraph.revision) throw new Error(t("The Flow has changed. Start autofill again to use the current content."))
      const parsed = parsePromptAutofillResponse(response.content, graph, mode)
      const result = applyPromptAutofill(graph, parsed, mode)
      updateGraph(() => result.graph)
      const additions = [result.renamed ? t("{0} Agent names", [result.renamed]) : '', result.flowChanged ? t("{0} Flow details", [result.flowChanged]) : ''].filter(Boolean)
      setNotice({ message: t("Autofilled {0} prompts{1}; retained {2} locked prompts", [result.changed, additions.length ? t(" and updated {0}", [additions.join(' / ')]) : '', result.protectedLocked]), tone: 'success' })
    } catch (error) {
      setNotice({ message: controller.signal.aborted ? t("Autofill stopped.") : error instanceof Error ? error.message : t("Prompt autofill failed"), tone: controller.signal.aborted ? 'neutral' : 'error' })
    } finally {
      if (autofillController.current === controller) { autofillController.current = null; setAutofilling(false); setAutofillDialogOpen(false) }
    }
  }

  const generateFlowPreview = async () => {
    if (tutorialMode) {
      if (flowGenerationController.current || tutorialActionBlocked([0])) return
      const controller = new AbortController()
      flowGenerationController.current = controller; setFlowGenerating(true)
      try {
        if (!await tutorialDelay(1200, controller.signal)) return
        const generated = tutorialGraph(1)
        const agents = Object.values(generated.nodes).filter((node): node is AgentNodeDefinition => node.type === 'agent')
        setFlowGenerationPreview({ graph: generated, response: { flow: { name: generated.name, goal: generated.goal ?? '' }, agents: agents.map((node) => ({ name: node.name, system: node.prompts.system.content, input: node.prompts.input.content, output: node.prompts.output.content })), routes: [{ inputSources: [0], target: 0 }, { agentSources: [0], target: 1, relation: 'pass' }, { agentSources: [1], target: 2, relation: 'revise' }, { agentSources: [0, 2], target: 3 }] } })
      } finally {
        if (flowGenerationController.current === controller) { flowGenerationController.current = null; setFlowGenerating(false) }
      }
      return
    }
    if (flowGenerationController.current || autofillController.current || runController.current) return
    if (!window.agentflowDesktop) {
      setNotice({ message: t("Use the desktop app to generate a Flow with a live provider"), tone: 'error' })
      return
    }
    const { providerId, model } = flowGenerationSelection
    if (!isFeatureModelSelectionAvailable(flowGenerationSelection, featureModelProviders) || !providerId || !model) {
      setNotice({ message: t("Choose a connected provider and an available model"), tone: 'error' })
      return
    }
    if (!flowGenerationDescription.trim()) return
    const controller = new AbortController()
    flowGenerationController.current = controller
    setFlowGenerating(true)
    setFlowGenerationPreview(null)
    try {
      const response = await invokeDesktopModel(window.agentflowDesktop, {
        providerId,
        model,
        messages: buildFlowGenerationMessages(flowGenerationDescription, graph, flowGenerationMode),
        responseMode: 'structured',
        parameters: featureReasoningParameters(providerId, model),
        workspace: project.workspace
      }, undefined, controller.signal)
      controller.signal.throwIfAborted()
      const latestGraph = latestWorkspace.current.graphs.find((candidate) => candidate.id === storedGraph.id)
      if (!latestGraph || latestGraph.revision !== storedGraph.revision) throw new Error(t("The Flow has changed. Generate another preview using the current content."))
      const parsed = parseFlowGenerationResponse(response.content, graph, flowGenerationMode)
      const generated = buildGeneratedFlow(graph, parsed, llmSettings.catalog, createId, flowGenerationMode)
      setFlowGenerationPreview({ response: parsed, graph: generated })
    } catch (error) {
      setNotice({ message: controller.signal.aborted ? t("Generation stopped.") : error instanceof Error ? error.message : t("Flow generation failed"), tone: controller.signal.aborted ? 'neutral' : 'error' })
    } finally {
      if (flowGenerationController.current === controller) { flowGenerationController.current = null; setFlowGenerating(false) }
    }
  }

  const applyGeneratedFlow = () => {
    if (!flowGenerationPreview || historyViewing) return
    if (tutorialMode) {
      updateGraph(() => flowGenerationPreview.graph)
      setWorkspace((current) => current?.tutorial ? { ...advanceTutorial(current, 1), tutorial: { ...current.tutorial, step: 1, overviewSeen: false } } : current); setFlowGenerationDialogOpen(false); setFlowGenerationPreview(null); return
    }
    const latestGraph = latestWorkspace.current.graphs.find((candidate) => candidate.id === storedGraph.id)
    if (!latestGraph || latestGraph.revision !== storedGraph.revision) {
      setFlowGenerationPreview(null)
      setNotice({ message: t("The Flow has changed. Generate another preview."), tone: 'error' })
      return
    }
    rememberGraph()
    const now = new Date().toISOString()
    setWorkspace((current) => {
      if (!current) return current
      const next = {
        ...current,
        graphs: current.graphs.map((candidate) => candidate.id === storedGraph.id ? { ...candidate, revision: candidate.revision + 1, definition: flowGenerationPreview.graph, updatedAt: now } : candidate),
        projects: current.projects.map((candidate) => candidate.id === project.id ? { ...candidate, updatedAt: now } : candidate),
        workingArtifactIds: flowGenerationMode === 'replace' ? { ...current.workingArtifactIds, [storedGraph.id]: {} } : current.workingArtifactIds,
        workingBaseRunIds: flowGenerationMode === 'replace' ? Object.fromEntries(Object.entries(current.workingBaseRunIds).filter(([graphId]) => graphId !== storedGraph.id)) : current.workingBaseRunIds,
        updatedAt: now
      }
      return reconcileWorkspaceState(next)
    })
    setSelectedNodeId(null)
    setSelectedLinkId(null)
    clearRun()
    setFlowGenerationDialogOpen(false)
    setFlowGenerationPreview(null)
    setNotice({ message: flowGenerationMode === 'extend' ? t("New Agents added to the current Flow") : t("Working state replaced. Use Undo to restore the previous structure"), tone: 'success' })
  }

  const openNodeMenu = (event: React.MouseEvent, node: FlowNode) => {
    event.preventDefault()
    const definition = graph.nodes[node.id]
    if (!definition) return
    setSelectedNodeId(node.id)
    setSelectedLinkId(null)
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 210), kind: definition.type, id: node.id })
  }

  const openEdgeMenu = (event: React.MouseEvent, edge: { id: string; data?: Record<string, unknown> }) => {
    event.preventDefault()
    if (edge.data?.synthetic) return
    const linkId = typeof edge.data?.linkId === 'string' ? edge.data.linkId : edge.id
    setSelectedNodeId(null)
    setSelectedLinkId(linkId)
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 120), kind: 'link', id: linkId })
  }

  const openPaneMenu = (event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 150), kind: 'pane' })
  }

  const contextAgent = contextMenu?.kind === 'agent' && contextMenu.id ? graph.nodes[contextMenu.id] : undefined
  const contextLink = contextMenu?.kind === 'link' && contextMenu.id ? graph.links.find((link) => link.id === contextMenu.id) : undefined
  const shellStyle = { '--sidebar-width': `${sidebarWidth}px` } as CSSProperties

  return <div className={`app-shell ${sidebarHidden ? 'is-sidebar-hidden' : ''}`} style={shellStyle}>
    <AppMenuBar
      sidebarHidden={sidebarHidden}
      graphActive={surface === 'graph' && !settingsOpen && !autofillDialogOpen && !flowGenerationDialogOpen && !historyBranchRequest && !runDialogOpen && !pendingFiles && !linkConflict && !missingUpstreamRun}
      graphState={{
        canUndo: !interactionLocked && !historyViewing && Boolean(graphHistory.current[storedGraph.id]?.length),
        canRedo: !interactionLocked && !historyViewing && Boolean(graphRedoHistory.current[storedGraph.id]?.length),
        canCopy: selectedNode?.type === 'agent',
        canPaste: !interactionLocked && Boolean(agentClipboard.current),
        canSelectAll: Object.keys(graph.nodes).length + graph.links.length > 0
      }}
      onGraphEdit={handleGraphEdit}
      onToggleSidebar={() => setSidebarHidden((current) => !current)}
      onOpenSettings={() => tutorial ? finishTutorial('completed', 'providers') : setSettingsOpen(true)}
      onStartTutorial={beginTutorial}
    />
    <Sidebar workspace={workspace} project={project} activeGraphId={storedGraph.id} onOpenProjectGraph={openProjectGraph} onCreateGraph={createGraph} onCreateTemporaryProject={createTemporaryProject} onOpenSession={openSession} onSessionDeleted={sessionDeleted} onOpenSettings={() => tutorial ? finishTutorial('completed', 'providers') : setSettingsOpen(true)} onResizeSidebar={setSidebarWidth} setWorkspace={setWorkspace} setNotice={setNotice} />
    <main className="main-shell">
      {notice ? <div className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.tone === 'error' ? <CircleX size={15} /> : <Check size={14} />}<span>{localizeAppMessage(notice.message)}</span>{notice.tone === 'error' ? <button type="button" aria-label={t("Dismiss error")} onClick={() => setNotice(null)}><X size={13} /></button> : null}</div> : null}
      <div className="workspace-stage" key={surface}>{surface === 'graph' ? <div className="graph-layout" data-tutorial-step={tutorial?.step} data-tutorial-overview={tutorialOverview}>
        <section className="canvas-shell" aria-label={t("Flow canvas")}><div className="canvas-heading"><div><h1>{graph.name}</h1><p>{project.name} · {Object.keys(graph.nodes).length} {t("nodes ·")} {graph.links.length} {t("links")}{historyViewing ? t(" · Read-only history") : ''}</p></div><div className="canvas-heading__actions">{isTemporaryProject || saveStatus === 'error' ? <button className="quiet-button" type="button" onClick={() => void onSaveNow()} disabled={running || autofilling || flowGenerating}><Save size={14} />{isTemporaryProject ? t("Save project…") : t("Retry save")}</button> : null}</div></div>
          <div className="canvas-frame" onDragOver={(event) => { if (!interactionLocked && (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE) || event.dataTransfer.types.includes(NODE_FILES_DRAG_TYPE))) { event.preventDefault(); event.dataTransfer.dropEffect = event.dataTransfer.types.includes(NODE_FILES_DRAG_TYPE) ? 'move' : 'copy' } }} onDrop={onCanvasDrop}><NodeLibraryToolbar key={tutorialActive ? `tutorial-${storedGraph.id}` : storedGraph.id} providers={availableProviders} guided={tutorialActive} open={libraryOpen} onOpenChange={setLibraryOpen} onAdd={addLibraryNode} onInput={addInput} disabled={interactionLocked} />{selectionCount > 1 ? <div className="batch-toolbar" role="toolbar" aria-label={t("Batch actions")}><strong>{selectionCount} {t("selected")}</strong><span>{t("Shift-click to select more")}</span><button type="button" onClick={createSelectionGroup} title={selectedGroupPreview?.issue ? graphOperationMessage(selectedGroupPreview.issue) : undefined} disabled={interactionLocked || selectedLinkIds.size > 0 || !selectedGroupPreview?.graph}><Group size={14} />{t("Create group")}</button><button type="button" className="is-danger" onClick={deleteSelection} disabled={interactionLocked}><Trash2 size={14} />{t("Delete")}</button></div> : connectingSourceId ? <div className="connection-hint" role="status"><Link2 size={14} />{t("Drag to an Agent card to create a link")}</div> : null}<ReactFlow ariaLabelConfig={flowAccessibilityLabels()} className={connectingSourceId ? 'is-connecting' : undefined} key={`${storedGraph.id}:${activeHistoryRun?.id ?? 'working'}`} nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onNodeDragStart={onNodeDragStart} onNodeDrag={onNodeDrag} onNodeDragStop={onNodeDragStop} onConnect={onConnect} onConnectStart={onConnectStart} onConnectEnd={onConnectEnd} onNodeClick={(event, node) => selectNode(event, node.id)} onNodeDoubleClick={(_, node) => { if (graph.nodes[node.id]?.type === 'output') void openOutput(node.id); else openChat(node.id) }} onNodeContextMenu={openNodeMenu} onEdgeClick={(event, edge) => { if (edge.data?.synthetic) return; const linkId = typeof edge.data?.linkId === 'string' ? edge.data.linkId : edge.id; selectLink(event, linkId) }} onEdgeContextMenu={openEdgeMenu} onPaneClick={() => { setSelectedNodeId(null); setSelectedLinkId(null); setContextMenu(null) }} onPaneContextMenu={openPaneMenu} multiSelectionKeyCode="Shift" minZoom={0.1} maxZoom={1.6} nodesConnectable={!interactionLocked} nodesDraggable={!interactionLocked && !tutorialActive} panOnDrag={!tutorialActive} zoomOnScroll={!tutorialActive} zoomOnPinch={!tutorialActive} zoomOnDoubleClick={!tutorialActive} deleteKeyCode={null}>{tutorial ? <TutorialViewport playback={tutorialPlayback} overview={tutorialOverview} step={tutorial.step} graph={graph} selectedLinkId={selectedLinkId} /> : <FlowAutoFit nodes={graph.nodes} />}<Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d8d8d3" /><Controls fitViewOptions={FLOW_FIT_OPTIONS} showInteractive={false} position="bottom-left" /></ReactFlow><FlowActionDock agentCount={agentCount} autofilling={autofilling} flowGenerating={flowGenerating} running={running} versions={flowVersions} activeStateId={activeHistoryRun?.id ?? 'working'} onSelectState={selectFlowState} onRenameState={renameFlowState} onForkVersion={forkHistoryState} onAutofill={openPromptAutofill} onGenerateFlow={openFlowGeneration} onRun={openRunConfirmation} onStopFlow={() => runController.current?.abort()} onStopAutofill={() => autofillController.current?.abort()} onStopFlowGeneration={() => flowGenerationController.current?.abort()} />{!Object.keys(graph.nodes).length ? <div className="canvas-empty"><Workflow size={24} /><h2>{t("Start with the first node")}</h2><p>{t("Add input, drop text files, or create an Agent, then connect them.")}</p><div><button className="secondary-button" type="button" onClick={addInput} disabled={interactionLocked}>{t("Add input")}</button><button className="primary-button" type="button" onClick={() => setLibraryOpen(true)} disabled={interactionLocked}>{t("Choose model")}</button></div></div> : null}</div></section>
        <Inspector includeCurrentModels={!tutorialMode} graph={displayedStoredGraph} nodeId={selectedNodeId} node={selectedNode} link={selectedLink} artifact={selectedArtifact ?? (selectedNodeId ? artifacts[selectedNodeId] : undefined)} artifactOptions={selectedArtifactOptions} selectedArtifactId={selectedNodeId ? displayedArtifactBindings[selectedNodeId] : undefined} onToggleFile={id => { if (selectedNodeId) toggleFile(selectedNodeId, id) }} onSelectArtifact={(artifactId) => selectedNodeId && selectWorkingArtifact(selectedNodeId, artifactId)} events={events} output={selectedOutput} running={interactionLocked} historyViewing={historyViewing} onUpdateGraph={updateGraph} status={selectedNodeId ? canvasRuntimeNodes[selectedNodeId]?.status : undefined} onRunAgent={(nodeId) => void runAgent(nodeId)} onRunUpstream={(nodeId) => void runAgent(nodeId, 'upstream')} onRunDownstream={(nodeId) => void runAgent(nodeId, 'downstream')} onOpenChat={() => selectedNodeId && openChat(selectedNodeId)} runInputIssue={selectedNodeId ? agentRunInputIssue(graph, selectedNodeId, runInputArtifacts) : undefined} onRevealOutput={(filePath) => { if (selectedNodeId) void revealOutput(selectedNodeId, filePath) }} onOpenOutput={(filePath) => { if (selectedNodeId) void openOutput(selectedNodeId, filePath) }} onOpenSystemFile={(filePath) => { if (selectedNodeId) void accessOutputFile(selectedNodeId, filePath, 'open') }} onEditInput={(itemId) => { if (selectedNodeId) { setDocumentTarget({ nodeId: selectedNodeId, itemId }); setSurface('document') } }} onRequestFiles={(files) => selectedNodeId && requestInputFiles(files, selectedNodeId)} onDelete={deleteSelection} setNotice={setNotice} providerModels={availableProviders} />
      </div> : surface === 'chat' && activeChatNodeId && activeChatNode?.type === 'agent' && activeSession ? <ChatSurface includeCurrentModels={!tutorialMode} graphName={graph.name} nodeId={activeChatNodeId} node={activeChatNode} session={activeSession} artifact={activeChatArtifactNodeId ? artifacts[activeChatArtifactNodeId] : undefined} composerValue={composerValue} setComposerValue={setComposerValue} editingMessageId={editingMessageId} replying={replying} streamingReply={streamingReply} providerModels={availableProviders} onSend={() => void sendMessage()} onBack={() => setSurface('graph')} onReset={() => resetSession(activeChatNodeId)} onEditMessage={(message) => { setEditingMessageId(message.id); setComposerValue(message.content) }} onCancelEdit={() => { setEditingMessageId(null); setComposerValue('') }} onDeleteMessage={(messageId) => updateSession(setWorkspace, activeSession.id, (session) => deleteChatMessage(session, messageId))} onSelectCandidate={(messageId) => updateSession(setWorkspace, activeSession.id, (session) => selectMessageCandidate(session, messageId))} onPublishArtifact={publishChatArtifact} onModelChange={changeActiveChatModel} onParametersChange={(parameters) => updateGraph((current) => ({ ...current, nodes: { ...current.nodes, [activeChatNodeId]: { ...activeChatNode, parameters } } }))} /> : surface === 'document' && documentTarget && documentNode ? <DocumentSurface key={documentFile?.relativePath ?? documentInput?.id ?? documentOutput?.id ?? documentTarget.nodeId} title={documentFile?.name ?? documentInput?.name ?? t("{0} · Output", [documentNode.name])} content={documentTarget.fileContent ?? documentFile?.content ?? documentInput?.content ?? documentOutput?.content ?? ''} parts={documentInput || documentFile ? undefined : documentOutput?.parts} relativePath={documentFile && documentArtifact ? outputFilePath(storedGraph.id, documentArtifact, documentArtifact.files!.indexOf(documentFile)) : documentInput ? inputTextPath(storedGraph.id, documentTarget.nodeId, documentInput.id) : documentOutput?.relativePath ?? '.flow/outputs'} saveStatus={saveStatus} disabled={interactionLocked} onBack={() => { setSurface('graph'); if (tutorial?.step === 11 && documentTarget.nodeId === 'delivery') advanceGuide(12) }} onChange={documentInput ? (content) => updateGraph((current) => { const node = current.nodes[documentTarget.nodeId]; if (node?.type !== 'input') return current; return { ...current, nodes: { ...current.nodes, [documentTarget.nodeId]: { ...node, items: node.items.map((item) => item.id === documentInput.id ? { ...item, content } : item) } } } }) : undefined} /> : null}</div>
    </main>
    {contextMenu ? <div ref={contextMenuRef} className="context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}>{contextMenu.kind === 'agent' ? <><button type="button" role="menuitem" disabled={historyViewing} onClick={() => { if (contextMenu.id) openChat(contextMenu.id); setContextMenu(null) }}><MessageSquareText size={15} />{t("Open chat")}</button><button type="button" role="menuitem" onClick={() => { copySelectedAgent(); setContextMenu(null) }}><Copy size={15} />{t("Copy")}<span>Ctrl+C</span></button><button type="button" role="menuitem" disabled={interactionLocked} onClick={() => { if (contextAgent?.type === 'agent') duplicateAgent(contextAgent); setContextMenu(null) }}><Files size={15} />{t("Duplicate")}</button><button type="button" role="menuitem" className="is-danger" disabled={interactionLocked} onClick={() => { deleteSelection(); setContextMenu(null) }}><Trash2 size={15} />{t("Delete")}</button></> : contextMenu.kind === 'input' ? <button type="button" role="menuitem" className="is-danger" disabled={interactionLocked} onClick={() => { deleteSelection(); setContextMenu(null) }}><Trash2 size={15} />{t("Delete input")}</button> : contextMenu.kind === 'output' ? <button type="button" role="menuitem" onClick={() => { const output = contextMenu.id ? graph.nodes[contextMenu.id] : undefined; if (output?.type === 'output') setSelectedNodeId(output.ownerAgentId); setContextMenu(null) }}><Settings size={15} />{t("Open owning Agent settings")}</button> : contextMenu.kind === 'link' ? <><button type="button" role="menuitem" disabled={interactionLocked || historyViewing || !contextLink} onClick={() => { if (contextLink) void runAgent(contextLink.targetId); setContextMenu(null) }}><Play size={15} />{t("Run again")}</button><button type="button" role="menuitem" className="is-danger" disabled={interactionLocked} onClick={() => { deleteSelection(); setContextMenu(null) }}><Trash2 size={15} />{t("Delete link")}</button></> : <><button type="button" role="menuitem" disabled={interactionLocked} onClick={() => { setLibraryOpen(true); setContextMenu(null) }}><Plus size={15} />{t("Add from model library")}</button><button type="button" role="menuitem" disabled={interactionLocked} onClick={() => { addInput(); setContextMenu(null) }}><FilePlus2 size={15} />{t("Add input node")}</button><button type="button" role="menuitem" disabled={interactionLocked || !agentClipboard.current} onClick={() => { pasteAgent(); setContextMenu(null) }}><Files size={15} />{t("Paste Agent")}<span>Ctrl+V</span></button><button type="button" role="menuitem" disabled={interactionLocked || historyViewing} onClick={() => { undoGraph(); setContextMenu(null) }}><Undo2 size={15} />{t("Undo")}<span>Ctrl+Z</span></button></>}</div> : null}
    {autofillDialogOpen ? <PromptAutofillDialog plan={promptAutofillPlan} providers={featureModelProviders} providerId={promptAutofillSelection.providerId} model={promptAutofillSelection.model} busy={autofilling} onProviderChange={(providerId) => { const provider = featureModelProviders.find((candidate) => candidate.provider === providerId); setPromptAutofillSelection({ providerId, model: provider?.models[0] ?? '' }) }} onModelChange={(model) => setPromptAutofillSelection((current) => ({ ...current, model }))} onCancel={() => setAutofillDialogOpen(false)} onConfirm={(mode) => void autofillPrompts(mode)} onStop={() => autofillController.current?.abort()} /> : null}
    {flowGenerationChoiceOpen ? <ExistingFlowGenerationDialog agentCount={agentCount} onCancel={() => setFlowGenerationChoiceOpen(false)} onExtend={() => chooseFlowGenerationMode('extend')} onReplace={() => chooseFlowGenerationMode('replace')} /> : null}
    {flowGenerationDialogOpen ? <FlowGenerationDialog description={flowGenerationDescription} inputSummary={generationInputSummary} mode={flowGenerationMode} existingAgentCount={agentCount} providers={featureModelProviders} providerId={flowGenerationSelection.providerId} model={flowGenerationSelection.model} busy={flowGenerating} preview={flowGenerationPreview} onProviderChange={(providerId) => { const provider = featureModelProviders.find((candidate) => candidate.provider === providerId); setFlowGenerationSelection({ providerId, model: provider?.models[0] ?? '' }); setFlowGenerationPreview(null) }} onModelChange={(model) => { setFlowGenerationSelection((current) => ({ ...current, model })); setFlowGenerationPreview(null) }} onDescriptionChange={setFlowGenerationDescription} onCancel={() => { setFlowGenerationDialogOpen(false); setFlowGenerationPreview(null) }} onGenerate={() => void generateFlowPreview()} onApply={applyGeneratedFlow} onStop={() => flowGenerationController.current?.abort()} /> : null}
    {runDialogOpen ? <RunConfirmationDialog plan={flowRunPlan} configurationIssues={runConfigurationIssues} onCancel={() => setRunDialogOpen(false)} onConfirm={() => void runGraph()} /> : null}
    {historyBranchRequest ? <HistoricalFlowBranchDialog flowName={historyBranchRequest.flowName} stateName={historyBranchRequest.stateName} onCancel={() => { setHistoryBranchRequest(null); setNotice(null) }} onConfirm={confirmHistoryBranch} /> : null}
    {unsupportedFiles ? <UnsupportedFilesDialog nodeName={unsupportedFiles.nodeName} files={unsupportedFiles.files} onReset={() => { pausedRun.current = null; clearRun(); setNotice({ message: t("Paused run discarded"), tone: 'neutral' }) }} onCancel={() => setUnsupportedFiles(null)} onContinue={() => void runGraph(true)} /> : null}
    {missingUpstreamRun ? <MissingUpstreamDialog targetName={graph.nodes[missingUpstreamRun.nodeId]?.name ?? t("Downstream Agent")} upstreamNames={missingUpstreamRun.missingIds.map((id) => graph.nodes[id]?.name ?? id)} onCancel={() => setMissingUpstreamRun(null)} onRunFromStart={() => { const nodeId = missingUpstreamRun.nodeId; setMissingUpstreamRun(null); void runAgent(nodeId, 'upstream') }} /> : null}
    {pendingFiles ? <FileImportDialog files={pendingFiles.files} onCancel={() => setPendingFiles(null)} onConfirm={() => void confirmFileImport()} /> : null}
    {linkConflict && linkConflictDetails ? <IncomingLinkConflictDialog targetName={linkConflictDetails.targetName} incomingSourceName={linkConflictDetails.incomingSourceName} existingSourceNames={linkConflictDetails.existingSourceNames} canMerge={Boolean(linkConflictDetails.mergePreview.graph)} mergeDisabledReason={linkConflictDetails.mergePreview.issue ? graphOperationMessage(linkConflictDetails.mergePreview.issue) : undefined} onCopy={copyDownstreamForConflict} onMerge={mergeIncomingForConflict} onCancel={() => setLinkConflict(null)} /> : null}
    {tutorial && !settingsOpen ? <TutorialSpotlight building={flowGenerating ? 'flow' : autofilling ? 'prompts' : undefined} playback={tutorialPlayback} overview={tutorialOverview} onOverviewDone={() => setWorkspace((current) => current?.tutorial ? { ...current, tutorial: { ...current.tutorial, overviewSeen: true } } : current)} step={tutorial.step} graph={graph} surface={surface} onBack={() => moveTutorial(tutorial.step - 1)} onSkip={() => finishTutorial('skipped')} /> : null}
    {settingsOpen ? <SettingsSurface initialPage={tutorialConnectionPage} tutorialCompleted={Boolean(tutorialConnectionPage)} settings={llmSettings} onChange={onLlmSettingsChange} onClose={() => { setSettingsOpen(false); setTutorialConnectionPage(undefined) }} /> : null}
  </div>
}

function getActiveSession(workspace: WorkspaceState, graphId: string, nodeId: string) {
  return workspace.sessions.find((session) => session.graphId === graphId && session.agentNodeId === nodeId && session.isActive)
}

function resolveFeatureModelSelection(preferred: FeatureModelSettings, providers: ProviderModelOptions[]): FeatureModelSettings | null {
  const preferredProvider = providers.find((provider) => provider.provider === preferred.providerId)
  if (preferredProvider?.models.includes(preferred.model)) return preferred
  const provider = preferredProvider ?? providers[0]
  const model = provider?.models[0]
  return provider && model ? { providerId: provider.provider, model } : null
}

function isFeatureModelSelectionAvailable(selection: FeatureModelSettings, providers: ProviderModelOptions[]) {
  return providers.some((provider) => provider.provider === selection.providerId && provider.models.includes(selection.model))
}

function seedSessionFromArtifact(session: AgentSession, artifact: Artifact | undefined): AgentSession {
  if (session.messages.length || !artifact) return session
  const body = artifactTextContent(artifact).trim()
  if (!body) return session
  const outputMessage: PersistedChatMessage = {
    id: createId('message'),
    role: 'assistant',
    content: body,
    parts: artifact.parts,
    manual: true,
    createdAt: new Date().toISOString()
  }
  return appendChatMessage(session, outputMessage, undefined)
}

function updateSession(setWorkspace: Dispatch<SetStateAction<WorkspaceState | null>>, sessionId: string, transform: (session: AgentSession) => AgentSession) {
  setWorkspace((current) => {
    if (!current) return current
    const target = current.sessions.find((session) => session.id === sessionId)
    const now = new Date().toISOString()
    return {
      ...current,
      sessions: current.sessions.map((session) => session.id === sessionId ? { ...transform(session), updatedAt: now } : session),
      updatedAt: now
    }
  })
}

function connectEndElement(event: MouseEvent | TouchEvent) {
  const point = connectEndPoint(event)
  return point ? document.elementFromPoint(point.x, point.y) : null
}

function connectEndPoint(event: MouseEvent | TouchEvent) {
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  return { x: event.clientX, y: event.clientY }
}

function connectEndAgentId(event: MouseEvent | TouchEvent, element: Element | null) {
  const direct = element?.closest<HTMLElement>('[data-flow-node-kind="agent"]')?.dataset.flowNodeId
  if (direct) return direct
  const point = connectEndPoint(event)
  if (!point) return undefined
  return [...document.querySelectorAll<HTMLElement>('[data-flow-node-kind="agent"]')]
    .reverse()
    .find((card) => {
      const bounds = card.getBoundingClientRect()
      return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom
    })
    ?.dataset.flowNodeId
}

function graphOperationMessage(issue: string) {
  const messages: Record<string, string> = {
    'group-needs-nodes': t("Select at least two nodes to create a group"),
    'group-node-already-used': t("Some selected nodes already belong to another group"),
    'group-missing': t("This group no longer exists")
  }
  return messages[issue] ?? linkIssueMessage(issue as Parameters<typeof linkIssueMessage>[0])
}

function createDefaultPrompts() {
  return {
    system: { content: '', customized: false, locked: false },
    input: { content: '', customized: false, locked: false },
    output: { content: '', customized: false, locked: false }
  }
}

function nextAgentCopyName(graph: GraphDefinition, sourceName: string) {
  const names = new Set(Object.values(graph.nodes).map((node) => node.name))
  const base = t('{0} copy', [sourceName])
  if (!names.has(base)) return base
  let index = 2
  while (names.has(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}

export function workspaceLabel(workspace: WorkspaceBinding) {
  if (workspace.mode === 'temporary') return t("Temporary working directory")
  const parts = workspace.rootPath.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.at(-1) ?? workspace.rootPath
}
