import type { Artifact, ModelProviderState, ModelResponsePart, RuntimeEvent } from '@agentflow/core'
import type {
  GraphDefinition,
  ProjectDefinition,
  WorkspaceBinding
} from '@agentflow/schema'
import type { DesktopLlmApi } from './llm'
import type { DesktopDiagnosticsApi } from './diagnostics'

export type { WorkspaceBinding } from '@agentflow/schema'

export interface StoredGraph {
  id: string
  projectId: string
  revision: number
  definition: GraphDefinition
  createdAt: string
  updatedAt: string
}

export interface PersistedChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  parentId?: string
  parts?: ModelResponsePart[]
  providerState?: ModelProviderState
  externalSessionId?: string
  manual?: boolean
}

export interface AgentSession {
  id: string
  title?: string
  origin?: 'graph' | 'temporary-conversation'
  projectId: string
  graphId: string
  agentNodeId: string
  connector: 'model' | 'agent-tool' | 'subscription'
  externalSessionId?: string
  isActive: boolean
  status: 'idle' | 'running' | 'failed' | 'archived'
  workspaceSnapshot: WorkspaceBinding
  messages: PersistedChatMessage[]
  activeLeafMessageId?: string
  createdAt: string
  updatedAt: string
}

export interface StoredRun {
  id: string
  name?: string
  projectId: string
  graphId: string
  graphRevision: number
  sessionBindings: Record<string, string>
  workspaceSnapshot: WorkspaceBinding
  artifacts: Artifact[]
  events: RuntimeEvent[]
  createdAt: string
  completedAt?: string
  status?: 'completed'
  graphSnapshot?: GraphDefinition
  parentRunId?: string
  artifactBindings?: Record<string, string>
  batchId?: string
  batchIndex?: number
  batchSize?: number
}

export interface StoredArtifact extends Artifact {
  projectId: string
  graphId: string
  origin?: 'run' | 'chat-reply' | 'chat-transcript'
  label?: string
}

export interface WorkspaceState {
  tutorial?: { version: 2; status: 'active' | 'skipped' | 'completed'; step: number; graphId: string; tool: 'codex' | 'claude-code'; overviewSeen?: boolean; reviewer?: { provider: string; model: string } }
  schemaVersion: 1
  projects: ProjectDefinition[]
  graphs: StoredGraph[]
  sessions: AgentSession[]
  runs: StoredRun[]
  artifacts: StoredArtifact[]
  workingArtifactIds: Record<string, Record<string, string>>
  workingBaseRunIds: Record<string, string>
  activeHistoryRunIds: Record<string, string>
  archivedProjectIds: string[]
  pinnedProjectIds: string[]
  pinnedGraphIds: string[]
  activeProjectId: string
  activeGraphId: string
  updatedAt: string
  activeTemporaryProjectId?: string
  suppressedSessionAgentIds?: string[]
}

export interface WorkspaceMergeResult {
  copiedFiles: number
  identicalFiles: number
  conflicts: string[]
}

export type DesktopMenuCommand =
  | { type: 'tutorial' }
  | { type: 'new-project' }
  | { type: 'open-project-directory'; rootPath: string }
  | { type: 'open-current-directory' }
  | { type: 'save' }

export type DesktopEditAction = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'select-all'

export type DesktopMenuContext = 'graph' | 'text' | 'app'

export type DesktopMenuAction =
  | 'new-project'
  | 'open-project-directory'
  | 'open-current-directory'
  | 'save'
  | 'settings'
  | 'quit'
  | DesktopEditAction
  | 'reload'
  | 'toggle-dev-tools'
  | 'reset-zoom'
  | 'zoom-in'
  | 'zoom-out'
  | 'toggle-fullscreen'
  | 'about'
  | 'diagnostics'
  | 'export-logs'
  | 'open-logs'

export interface DesktopWorkspaceApi extends DesktopLlmApi, DesktopDiagnosticsApi {
  getLanguageSettings(): Promise<import('@agentflow/core/localization').LanguageSettings>
  setLanguagePreference(preference: import('@agentflow/core/localization').LanguagePreference): Promise<import('@agentflow/core/localization').LanguageSettings>
  onLanguageChanged(callback: (settings: import('@agentflow/core/localization').LanguageSettings) => void): () => void
  loadAgentLibrary(): Promise<import('./agent-library').AgentLibrary>
  saveAgentLibrary(library: import('./agent-library').AgentLibrary): Promise<void>
  loadWorkspace(): Promise<unknown>
  loadProjectDirectory(rootPath: string): Promise<unknown>
  saveWorkspace(state: WorkspaceState): Promise<void>
  saveProjectFiles(state: WorkspaceState, projectId: string): Promise<void>
  chooseDirectory(): Promise<string | null>
  openWorkspace(binding: WorkspaceBinding): Promise<void>
  revealWorkspaceFile(binding: WorkspaceBinding, relativePath: string): Promise<void>
  openWorkspaceFile(binding: WorkspaceBinding, relativePath: string): Promise<void>
  readWorkspaceTextFile(binding: WorkspaceBinding, relativePath: string): Promise<string>
  ensureTutorialWorkspace(): Promise<string>
  ensureTemporaryWorkspace(tempId: string): Promise<void>
  mergeTemporaryWorkspace(
    sourceTempId: string,
    target: WorkspaceBinding,
    overwriteConflicts: boolean
  ): Promise<WorkspaceMergeResult>
  discardTemporaryWorkspace(tempId: string): Promise<void>
  onSaveBeforeClose(callback: () => void): () => void
  completeCloseSave(success: boolean): void
  onMenuCommand(callback: (command: DesktopMenuCommand) => void): () => void
  invokeMenuAction(action: DesktopMenuAction, context?: DesktopMenuContext): Promise<void>
}
