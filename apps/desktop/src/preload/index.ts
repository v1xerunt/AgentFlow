import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopMenuAction, DesktopMenuCommand, DesktopMenuContext, WorkspaceBinding, WorkspaceMergeResult, WorkspaceState } from '../shared/workspace'
import type { DesktopModelInvocationRequest, LlmSettingsInput, ModelStreamDelta, RuntimeLoginProgress, SubscriptionConnectorConnectOptions, SubscriptionConnectorId, SubscriptionConnectorProgress } from '../shared/llm'
import type { DiagnosticInput } from '../shared/diagnostics'
import type { LanguagePreference, LanguageSettings } from '@agentflow/core/localization'

contextBridge.exposeInMainWorld('agentflowDesktop', {
  getLanguageSettings: () => ipcRenderer.invoke('agentflow:language:get'),
  setLanguagePreference: (preference: LanguagePreference) => ipcRenderer.invoke('agentflow:language:set', preference),
  onLanguageChanged: (callback: (settings: LanguageSettings) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: LanguageSettings) => callback(settings)
    ipcRenderer.on('agentflow:language:changed', listener)
    return () => ipcRenderer.removeListener('agentflow:language:changed', listener)
  },
  recordDiagnostic: (entry: DiagnosticInput) => ipcRenderer.send('agentflow:diagnostics:record', entry),
  getDiagnostics: () => ipcRenderer.invoke('agentflow:diagnostics:read'),
  exportDiagnostics: () => ipcRenderer.invoke('agentflow:diagnostics:export'),
  openLogsDirectory: () => ipcRenderer.invoke('agentflow:diagnostics:open-directory'),
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome
  },
  loadWorkspace: () => ipcRenderer.invoke('agentflow:workspace:load') as Promise<unknown>,
  ensureTutorialWorkspace: () => ipcRenderer.invoke('agentflow:workspace:ensure-tutorial'),
  openWorkspaceFile: (binding: WorkspaceBinding, relativePath: string) => ipcRenderer.invoke('agentflow:workspace:open-file', binding, relativePath),
  readWorkspaceTextFile: (binding: WorkspaceBinding, relativePath: string) => ipcRenderer.invoke('agentflow:workspace:read-text-file', binding, relativePath),
  loadAgentLibrary: () => ipcRenderer.invoke('agentflow:library:load'),
  saveAgentLibrary: (library: unknown) => ipcRenderer.invoke('agentflow:library:save', library),
  loadProjectDirectory: (rootPath: string) => ipcRenderer.invoke('agentflow:workspace:load-project', rootPath) as Promise<unknown>,
  saveWorkspace: (state: WorkspaceState) =>
    ipcRenderer.invoke('agentflow:workspace:save', state) as Promise<void>,
  saveProjectFiles: (state: WorkspaceState, projectId: string) =>
    ipcRenderer.invoke('agentflow:workspace:save-project-files', state, projectId) as Promise<void>,
  chooseDirectory: () =>
    ipcRenderer.invoke('agentflow:workspace:choose-directory') as Promise<string | null>,
  openWorkspace: (binding: WorkspaceBinding) =>
    ipcRenderer.invoke('agentflow:workspace:open-directory', binding) as Promise<void>,
  revealWorkspaceFile: (binding: WorkspaceBinding, relativePath: string) =>
    ipcRenderer.invoke('agentflow:workspace:reveal-file', binding, relativePath) as Promise<void>,
  ensureTemporaryWorkspace: (tempId: string) =>
    ipcRenderer.invoke('agentflow:workspace:ensure-temporary', tempId) as Promise<void>,
  mergeTemporaryWorkspace: (
    sourceTempId: string,
    target: WorkspaceBinding,
    overwriteConflicts: boolean
  ) => ipcRenderer.invoke(
    'agentflow:workspace:merge-temporary',
    sourceTempId,
    target,
    overwriteConflicts
  ) as Promise<WorkspaceMergeResult>,
  discardTemporaryWorkspace: (tempId: string) =>
    ipcRenderer.invoke('agentflow:workspace:discard-temporary', tempId) as Promise<void>,
  onSaveBeforeClose: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('agentflow:window:save-before-close', listener)
    ipcRenderer.send('agentflow:window:save-listener-ready', true)
    return () => {
      ipcRenderer.removeListener('agentflow:window:save-before-close', listener)
      ipcRenderer.send('agentflow:window:save-listener-ready', false)
    }
  },
  completeCloseSave: (success: boolean) =>
    ipcRenderer.send('agentflow:window:complete-close-save', success),
  onMenuCommand: (callback: (command: DesktopMenuCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: DesktopMenuCommand) => callback(command)
    ipcRenderer.on('agentflow:menu:command', listener)
    return () => ipcRenderer.removeListener('agentflow:menu:command', listener)
  },
  invokeMenuAction: (action: DesktopMenuAction, context?: DesktopMenuContext) =>
    ipcRenderer.invoke('agentflow:menu:invoke', action, context) as Promise<void>,
  loadLlmSettings: () =>
    ipcRenderer.invoke('agentflow:llm:settings:load'),
  saveLlmSettings: (input: LlmSettingsInput) =>
    ipcRenderer.invoke('agentflow:llm:settings:save', input),
  refreshProviderModels: (providerId?: string) =>
    ipcRenderer.invoke('agentflow:llm:models:refresh', providerId),
  testProvider: (providerId: string) =>
    ipcRenderer.invoke('agentflow:llm:provider:test', providerId),
  detectAgentTools: () =>
    ipcRenderer.invoke('agentflow:llm:tools:detect'),
  refreshSubscriptionConnectors: () =>
    ipcRenderer.invoke('agentflow:llm:subscriptions:refresh'),
  connectSubscriptionConnector: (connectorId: SubscriptionConnectorId, options?: SubscriptionConnectorConnectOptions) =>
    ipcRenderer.invoke('agentflow:llm:subscriptions:connect', connectorId, options),
  disconnectSubscriptionConnector: (connectorId: SubscriptionConnectorId) =>
    ipcRenderer.invoke('agentflow:llm:subscriptions:disconnect', connectorId),
  onSubscriptionConnectorProgress: (callback: (progress: SubscriptionConnectorProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: SubscriptionConnectorProgress) => callback(progress)
    ipcRenderer.on('agentflow:llm:subscriptions:progress', listener)
    return () => ipcRenderer.removeListener('agentflow:llm:subscriptions:progress', listener)
  },
  loginAgentTool: (toolId: string) => ipcRenderer.invoke('agentflow:llm:tools:login', toolId),
  submitRuntimeLoginCode: (requestId: string, code: string) => ipcRenderer.invoke('agentflow:llm:runtime-login:submit', requestId, code),
  cancelRuntimeLogin: (requestId: string) => ipcRenderer.invoke('agentflow:llm:runtime-login:cancel', requestId),
  onRuntimeLoginProgress: (callback: (progress: RuntimeLoginProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: RuntimeLoginProgress) => callback(progress)
    ipcRenderer.on('agentflow:llm:runtime-login:progress', listener)
    return () => ipcRenderer.removeListener('agentflow:llm:runtime-login:progress', listener)
  },
  invokeModel: (
    request: Omit<DesktopModelInvocationRequest, 'requestId'> & { requestId?: string },
    onDelta?: (delta: string) => void
  ) => {
    const requestId = request.requestId ?? `llm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    const listener = (_event: Electron.IpcRendererEvent, payload: ModelStreamDelta) => {
      if (payload.requestId === requestId) onDelta?.(payload.delta)
    }
    ipcRenderer.on('agentflow:llm:delta', listener)
    return ipcRenderer.invoke('agentflow:llm:invoke', { ...request, requestId })
      .finally(() => ipcRenderer.removeListener('agentflow:llm:delta', listener))
  },
  cancelModel: (requestId: string) => ipcRenderer.send('agentflow:llm:cancel', requestId)
})
