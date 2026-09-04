import { configureLanguage, getLanguageSettings, isLanguagePreference, t, type LanguagePreference } from '@agentflow/core/localization'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { release } from 'node:os'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell } from 'electron'
import appIconPng from '../assets/app-icon.png?asset'
import appIconIco from '../assets/app-icon.ico?asset'
import type { MenuItemConstructorOptions } from 'electron'
import type { DesktopMenuAction, DesktopMenuCommand, DesktopMenuContext, WorkspaceBinding, WorkspaceMergeResult, WorkspaceState } from '../shared/workspace'
import type { DesktopModelInvocationRequest, LlmSettingsInput, RuntimeLoginProgress, SubscriptionConnectorConnectOptions, SubscriptionConnectorId } from '../shared/llm'
import { agentToolExitErrorMessage, invokeAgentToolWithRefresh } from './agent-tool-runner'
import { AntigravityLoginService, spawnAntigravityTerminal } from './antigravity-login'
import { ClaudeLoginService, spawnClaudeTerminal } from './claude-login'
import { LlmSettingsService } from './llm-settings'
import { invokeProvider } from './provider-client'
import { mergeWorkspaceDirectories, resolveWorkspaceFile } from './workspace-files'
import { readFlowProject, saveFlowProject } from './flow-project-files'
import { AgentLibraryStore } from './agent-library'
import { effectiveModelParameters } from '@agentflow/core'
import { modelParameterKey } from '../shared/agent-library'
import { createSubscriptionConnectorDependencies, isSubscriptionProviderId, SubscriptionConnectorService } from './subscription-connectors'
import { DeepSeekWebBridge } from './deepseek-web-bridge'
import { ensureTutorialWorkspace } from './tutorial-workspace'
import { DiagnosticLog } from './diagnostic-log'
import { diagnosticHandler } from './diagnostic-ipc'
import type { DiagnosticInput } from '../shared/diagnostics'
import { atomicWriteFile } from './atomic-file'
import { initializeRuntimeEnvironment, terminateManagedProcesses } from './platform-process'
import { initializeReleaseSmoke, runReleaseSmoke } from './release-smoke'

const releaseSmokeRoot = initializeReleaseSmoke()

const diagnosticLog = new DiagnosticLog(join(app.getPath('userData'), 'agentflow', 'logs'), {
  app: 'AgentFlow', version: app.getVersion(), platform: process.platform, arch: process.arch,
  osVersion: release(), electron: process.versions.electron, chrome: process.versions.chrome,
  node: process.versions.node, packaged: String(app.isPackaged)
}, [app.getPath('home'), app.getAppPath()])

process.on('uncaughtExceptionMonitor', (error, origin) => diagnosticLog.recordFatal(error, origin))
process.on('warning', error => diagnosticLog.record({ level: 'warn', event: 'process.warning', details: { error } }))
diagnosticLog.record({ level: 'info', event: 'app.start' })

function handle<T extends unknown[], R>(channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: T) => R) {
  ipcMain.handle(channel, diagnosticHandler(diagnosticLog, channel, handler))
}

let diagnosticsWindow: BrowserWindow | null = null
const appId = 'com.agentflow.desktop'
let taskbarIconPath = appIconIco

function updateTaskbarBranding(window: BrowserWindow) {
  if (process.platform !== 'win32') return
  window.setAppDetails({
    appId,
    appIconPath: taskbarIconPath,
    appIconIndex: 0,
    relaunchDisplayName: t('AgentFlow'),
    relaunchCommand: app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${app.getAppPath()}"`
  })
}

function synchronizeWindowLanguage() {
  installApplicationMenu()
  diagnosticsWindow?.setTitle(t('Logs and diagnostics · AgentFlow'))
  for (const window of BrowserWindow.getAllWindows()) {
    updateTaskbarBranding(window)
    window.webContents.send('agentflow:language:changed', getLanguageSettings())
  }
}

async function initializeLanguageSettings() {
  const file = join(app.getPath('userData'), 'agentflow', 'language.json')
  let preference: LanguagePreference = 'system'
  try {
    const saved: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (isLanguagePreference(saved)) preference = saved
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') diagnosticLog.record({ level: 'warn', event: 'language.load-failed', details: { error } })
  }
  configureLanguage({ preference, systemLanguages: app.getPreferredSystemLanguages() })
  let writes = Promise.resolve()
  handle('agentflow:language:get', () => {
    const previous = getLanguageSettings()
    configureLanguage({ ...getLanguageSettings(), systemLanguages: app.getPreferredSystemLanguages() })
    if (getLanguageSettings() !== previous) {
      synchronizeWindowLanguage()
    }
    return getLanguageSettings()
  })
  handle('agentflow:language:set', (_event, value: unknown) => {
    if (!isLanguagePreference(value)) throw new Error('Invalid language preference')
    const save = writes.catch(() => {}).then(async () => {
      await mkdir(join(app.getPath('userData'), 'agentflow'), { recursive: true })
      await atomicWriteFile(file, JSON.stringify(value))
      configureLanguage({ preference: value, systemLanguages: app.getPreferredSystemLanguages() })
      synchronizeWindowLanguage()
    })
    writes = save
    return save.then(() => getLanguageSettings())
  })
}

function showDiagnostics() {
  if (diagnosticsWindow && !diagnosticsWindow.isDestroyed()) { diagnosticsWindow.show(); diagnosticsWindow.focus(); return }
  const window = new BrowserWindow({
    width: 1000, height: 760, minWidth: 680, minHeight: 520, show: false, title: t("Logs and diagnostics · AgentFlow"), backgroundColor: '#fbfbfa',
    webPreferences: { preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  diagnosticsWindow = window
  window.once('ready-to-show', () => { if (!releaseSmokeRoot) window.show() })
  window.setMenu(null)
  window.on('closed', () => { diagnosticsWindow = null })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  observeWindowDiagnostics(window)
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  const loaded = rendererUrl ? window.loadURL(`${rendererUrl}#diagnostics`) : window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'diagnostics' })
  void loaded.catch(error => diagnosticLog.record({ level: 'error', event: 'diagnostics.load-failed', details: { error } }))
}

async function exportDiagnostics(window?: BrowserWindow | null) {
  const options: Electron.SaveDialogOptions = {
    title: t("Export diagnostic report"), buttonLabel: t("Export"),
    defaultPath: join(app.getPath('downloads'), `AgentFlow-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    filters: [{ name: t("Diagnostic report JSON"), extensions: ['json'] }]
  }
  const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, await diagnosticLog.report(), { encoding: 'utf8', mode: 0o600 })
  diagnosticLog.record({ level: 'info', event: 'diagnostics.exported' })
  return result.filePath
}

async function openLogsDirectory() {
  await mkdir(diagnosticLog.directory, { recursive: true })
  const error = await shell.openPath(diagnosticLog.directory)
  if (error) throw new Error(error)
}

function registerDiagnosticHandlers() {
  // Reading the viewer must not generate another log entry on each refresh.
  ipcMain.handle('agentflow:diagnostics:read', async () => {
    const snapshot = await diagnosticLog.snapshot()
    return { ...snapshot, entries: snapshot.entries.slice(-500) }
  })
  handle('agentflow:diagnostics:export', event => exportDiagnostics(BrowserWindow.fromWebContents(event.sender)))
  handle('agentflow:diagnostics:open-directory', () => openLogsDirectory())
  const rates = new Map<number, { since: number; count: number; warned?: boolean }>()
  ipcMain.on('agentflow:diagnostics:record', (event, input: DiagnosticInput) => {
    if (!input || !['info', 'warn', 'error'].includes(input.level) || typeof input.event !== 'string' || input.event.length > 120) return
    try { if (JSON.stringify(input).length > 32_000) return } catch { return }
    let rate = rates.get(event.sender.id)
    if (!rate) {
      rate = { since: Date.now(), count: 0 }
      rates.set(event.sender.id, rate)
      event.sender.once('destroyed', () => rates.delete(event.sender.id))
    }
    if (Date.now() - rate.since > 60_000) { rate.since = Date.now(); rate.count = 0; rate.warned = false }
    if (++rate.count > 120) {
      if (!rate.warned) diagnosticLog.record({ level: 'warn', event: 'renderer.rate-limited' })
      rate.warned = true
      return
    }
    diagnosticLog.record({ level: input.level, event: input.event, details: input.details }, 'renderer')
  })
}

function observeWindowDiagnostics(window: BrowserWindow) {
  let consoleWindowStart = Date.now()
  let consoleErrors = 0
  // This also captures script/module errors before the renderer's own listeners install.
  window.webContents.on('console-message', details => {
    if (details.level !== 'error') return
    if (Date.now() - consoleWindowStart > 60_000) { consoleWindowStart = Date.now(); consoleErrors = 0 }
    if (++consoleErrors > 120) {
      if (consoleErrors === 121) diagnosticLog.record({ level: 'warn', event: 'renderer.console-rate-limited' })
      return
    }
    diagnosticLog.record({ level: 'error', event: 'renderer.console-error', details: { message: details.message, source: details.sourceId, line: details.lineNumber } }, 'renderer')
  })
  window.webContents.on('preload-error', (_event, _path, error) => {
    diagnosticLog.record({ level: 'error', event: 'renderer.preload-error', details: { error } })
    window.setMenuBarVisibility(true)
  })
  window.webContents.on('render-process-gone', (_event, details) => {
    diagnosticLog.record({ level: 'error', event: 'renderer.process-gone', details })
    window.setMenuBarVisibility(true)
  })
  window.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (code === -3) return
    diagnosticLog.record({ level: 'error', event: 'renderer.load-failed', details: { code, description, isMainFrame } })
    if (isMainFrame) window.setMenuBarVisibility(true)
  })
  window.on('unresponsive', () => diagnosticLog.record({ level: 'warn', event: 'window.unresponsive' }))
  window.on('responsive', () => diagnosticLog.record({ level: 'info', event: 'window.responsive' }))
}

interface WindowCloseState {
  ready?: boolean
  allowClose?: boolean
  prompting?: boolean
}

const closeStates = new Map<number, WindowCloseState>()
const modelInvocations = new Map<string, AbortController>()
let workspaceWrites = Promise.resolve()

function sendMenuCommand(command: DesktopMenuCommand, targetWindow?: BrowserWindow | null) {
  const window = targetWindow ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (window && !window.isDestroyed()) window.webContents.send('agentflow:menu:command', command)
}

async function chooseProjectDirectoryFromMenu(targetWindow?: BrowserWindow | null) {
  const window = targetWindow ?? BrowserWindow.getFocusedWindow()
  const options: Electron.OpenDialogOptions = {
    title: t("Open project folder"),
    buttonLabel: t("Open folder"),
    properties: ['openDirectory']
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  const rootPath = result.filePaths[0]
  if (!result.canceled && rootPath) sendMenuCommand({ type: 'open-project-directory', rootPath }, window)
}

function showAboutDialog(targetWindow?: BrowserWindow | null) {
  const window = targetWindow ?? BrowserWindow.getFocusedWindow()
  const options: Electron.MessageBoxOptions = {
    type: 'info',
    title: t("About AgentFlow"),
    message: 'AgentFlow',
    icon: nativeImage.createFromPath(appIconPng),
    detail: t("Version {0}\nA local-first desktop app for multi-Agent workflows.", [app.getVersion()]),
    buttons: [t("OK")]
  }
  if (window) return dialog.showMessageBox(window, options).then(() => undefined)
  return dialog.showMessageBox(options).then(() => undefined)
}

const desktopEditActions = new Set<DesktopMenuAction>(['undo', 'redo', 'cut', 'copy', 'paste', 'select-all'])

async function invokeDesktopMenuAction(action: DesktopMenuAction, targetWindow?: BrowserWindow | null, context: DesktopMenuContext = 'app') {
  const window = targetWindow ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  switch (action) {
    case 'new-project': sendMenuCommand({ type: 'new-project' }, window); return
    case 'open-project-directory': await chooseProjectDirectoryFromMenu(window); return
    case 'open-current-directory': sendMenuCommand({ type: 'open-current-directory' }, window); return
    case 'save': sendMenuCommand({ type: 'save' }, window); return
    case 'quit': app.quit(); return
    case 'about': await showAboutDialog(window); return
    case 'diagnostics': showDiagnostics(); return
    case 'export-logs': await exportDiagnostics(window); return
    case 'open-logs': await openLogsDirectory(); return
  }
  if (!window || window.isDestroyed()) return
  if (desktopEditActions.has(action)) {
    if (context === 'text') {
      switch (action) {
        case 'undo': window.webContents.undo(); break
        case 'redo': window.webContents.redo(); break
        case 'cut': window.webContents.cut(); break
        case 'copy': window.webContents.copy(); break
        case 'paste': window.webContents.paste(); break
        case 'select-all': window.webContents.selectAll(); break
      }
    }
    return
  }
  switch (action) {
    case 'reload': window.reload(); return
    case 'toggle-dev-tools': window.webContents.toggleDevTools(); return
    case 'reset-zoom': window.webContents.setZoomLevel(0); return
    case 'zoom-in': window.webContents.setZoomLevel(Math.min(5, window.webContents.getZoomLevel() + 0.5)); return
    case 'zoom-out': window.webContents.setZoomLevel(Math.max(-5, window.webContents.getZoomLevel() - 0.5)); return
    case 'toggle-fullscreen': window.setFullScreen(!window.isFullScreen()); return
  }
}

function registerDesktopMenuHandlers() {
  handle('agentflow:menu:invoke', (event, action: DesktopMenuAction, context?: DesktopMenuContext) =>
    invokeDesktopMenuAction(action, BrowserWindow.fromWebContents(event.sender), context))
}

function installApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: t("File"),
      submenu: [
        { label: t("New temporary project"), accelerator: 'CmdOrCtrl+N', click: () => sendMenuCommand({ type: 'new-project' }) },
        { label: t("Open project folder…"), accelerator: 'CmdOrCtrl+O', click: () => void chooseProjectDirectoryFromMenu() },
        { label: t("Open current directory in file manager"), accelerator: 'CmdOrCtrl+Shift+O', click: () => sendMenuCommand({ type: 'open-current-directory' }) },
        { type: 'separator' },
        { label: t("Save"), accelerator: 'CmdOrCtrl+S', click: () => sendMenuCommand({ type: 'save' }) },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close', label: t("Close window") } : { role: 'quit', label: t("Quit AgentFlow") }
      ]
    },
    {
      label: t("View"),
      submenu: [
        { role: 'reload', label: t("Reload") },
        { role: 'toggleDevTools', label: t("Developer tools") },
        { type: 'separator' },
        { role: 'resetZoom', label: t("Actual size") },
        { role: 'zoomIn', label: t("Zoom in") },
        { role: 'zoomOut', label: t("Zoom out") },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t("Toggle full screen") }
      ]
    },
    {
      label: t("Help"),
      submenu: [
        { label: t("Interactive tutorial"), click: () => sendMenuCommand({ type: 'tutorial' }) },
        { label: t("Logs and diagnostics…"), click: () => showDiagnostics() },
        { label: t("Export diagnostic report…"), click: () => { void exportDiagnostics(BrowserWindow.getFocusedWindow()).catch(error => dialog.showErrorBox(t("Export failed"), String(error))) } },
        { label: t("Open log directory"), click: () => { void openLogsDirectory().catch(error => dialog.showErrorBox(t("Could not open log directory"), String(error))) } },
        { type: 'separator' },
        {
          label: t("About AgentFlow"),
          click: () => void showAboutDialog()
        }
      ]
    }
  ]
  if (process.platform === 'darwin') {
    template.unshift({ role: 'appMenu' })
    template.splice(2, 0, { role: 'editMenu' })
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function getStoreDirectory() {
  return join(app.getPath('userData'), 'agentflow')
}

function temporaryWorkspacePath(tempId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(tempId)) throw new Error(t("Invalid temporary workspace id"))
  return join(getStoreDirectory(), 'temp-workspaces', tempId)
}

function workspacePath(binding: WorkspaceBinding) {
  return binding.mode === 'directory' ? binding.rootPath : temporaryWorkspacePath(binding.tempId)
}

async function discardTemporaryWorkspace(tempId: string) {
  await rm(temporaryWorkspacePath(tempId), { recursive: true, force: true })
}

async function mergeTemporaryWorkspace(
  sourceTempId: string,
  targetBinding: WorkspaceBinding,
  overwriteConflicts: boolean
): Promise<WorkspaceMergeResult> {
  const sourceRoot = temporaryWorkspacePath(sourceTempId)
  const targetRoot = workspacePath(targetBinding)
  return mergeWorkspaceDirectories(sourceRoot, targetRoot, overwriteConflicts)
}

function registerWorkspaceHandlers() {
  handle('agentflow:workspace:ensure-tutorial', () => ensureTutorialWorkspace(getStoreDirectory()))
  handle('agentflow:workspace:open-file', async (_event, binding: WorkspaceBinding, relativePath: string) => {
    const target = await resolveWorkspaceFile(workspacePath(binding), relativePath)
    const error = await shell.openPath(target)
    if (error) throw new Error(error)
  })
  handle('agentflow:workspace:read-text-file', async (_event, binding: WorkspaceBinding, relativePath: string) => {
    const target = await resolveWorkspaceFile(workspacePath(binding), relativePath)
    return readFile(target, 'utf8')
  })
  handle('agentflow:workspace:load-project', async (_event, rootPath: string) => { await workspaceWrites.catch(() => undefined); return readFlowProject(rootPath) })
  handle('agentflow:workspace:load', async () => {
    try {
      return JSON.parse(
        await readFile(join(getStoreDirectory(), 'workspace-state.json'), 'utf8')
      ) as unknown
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  })

  handle(
    'agentflow:workspace:save',
    async (_event, state: WorkspaceState) => {
      const pending = workspaceWrites.catch(() => undefined).then(async () => {
      const storeDirectory = getStoreDirectory()
      await mkdir(storeDirectory, { recursive: true })
      for (const project of state.projects) {
        await saveFlowProject(workspacePath(project.workspace), state, project.id)
      }
      const target = join(storeDirectory, 'workspace-state.json')
      await atomicWriteFile(target, JSON.stringify(state, null, 2))
      })
      workspaceWrites = pending
      await pending
    }
  )

  handle('agentflow:workspace:choose-directory', async () => {
    const result = await dialog.showOpenDialog({
      title: t("Choose project working directory"),
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  handle('agentflow:workspace:open-directory', async (_event, binding: WorkspaceBinding) => {
    const root = workspacePath(binding)
    await mkdir(root, { recursive: true })
    const error = await shell.openPath(root)
    if (error) throw new Error(error)
  })

  handle('agentflow:workspace:ensure-temporary', async (_event, tempId: string) => {
    await mkdir(temporaryWorkspacePath(tempId), { recursive: true })
  })

  handle('agentflow:workspace:reveal-file', async (_event, binding: WorkspaceBinding, relativePath: string) => {
    const target = await resolveWorkspaceFile(workspacePath(binding), relativePath)
    shell.showItemInFolder(target)
  })

  handle('agentflow:workspace:save-project-files', async (_event, state: WorkspaceState, projectId: string) => {
    const project = state.projects.find(candidate => candidate.id === projectId)
    if (!project) throw new Error(t("Project does not exist."))
    await saveFlowProject(workspacePath(project.workspace), state, project.id)
  })

  handle(
    'agentflow:workspace:merge-temporary',
    async (_event, sourceTempId: string, target: WorkspaceBinding, overwriteConflicts: boolean) =>
      mergeTemporaryWorkspace(sourceTempId, target, overwriteConflicts)
  )

  handle('agentflow:workspace:discard-temporary', async (_event, tempId: string) => {
    await discardTemporaryWorkspace(tempId)
  })

  ipcMain.on('agentflow:window:save-listener-ready', (event, ready: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) closeStates.set(window.id, { ...closeStates.get(window.id), ready })
  })
  ipcMain.on('agentflow:window:complete-close-save', (event, success: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    const state = closeStates.get(window.id) ?? {}
    state.prompting = false
    if (!success) { closeStates.set(window.id, state); return }
    state.allowClose = true
    closeStates.set(window.id, state)
    window.close()
  })
}

function registerLlmHandlers() {
  const library = new AgentLibraryStore(getStoreDirectory())
  handle('agentflow:library:load', () => library.load())
  handle('agentflow:library:save', (_event, value: unknown) => library.save(value))
  const subscriptions: SubscriptionConnectorService = new SubscriptionConnectorService(
    getStoreDirectory(),
    {
      ...createSubscriptionConnectorDependencies((url) => shell.openExternal(url)),
      deepSeekWeb: new DeepSeekWebBridge(getStoreDirectory()),
      loginAntigravity: (command, options, report) => googleLogin.login({ ...options, command }, report),
      loginClaude: (command, options, report) => claudeLogin.login({ ...options, command }, report)
    }
  )
  const googleLogin: AntigravityLoginService = new AntigravityLoginService({
    spawn: spawnAntigravityTerminal,
    probe: options => subscriptions.isAntigravityAuthenticated(options.command, options.env),
    openExternal: url => shell.openExternal(url)
  })
  const claudeLogin = new ClaudeLoginService({ spawn: spawnClaudeTerminal, probe: async options => (await subscriptions.claudeAccount(options.command)).connected })
  const loginOwners = new Map<string, { senderId: number; service: AntigravityLoginService | ClaudeLoginService }>()
  const cancelLogin = (id?: string) => { googleLogin.cancel(id); claudeLogin.cancel(id) }
  const withLoginProgress = async <T>(event: Electron.IpcMainInvokeEvent, action: (report: (progress: RuntimeLoginProgress) => void) => Promise<T>) => {
    if (loginOwners.size) throw new Error(t("An account login is already in progress. Complete or cancel it first."))
    let requestId: string | undefined
    const cancel = () => { if (requestId) cancelLogin(requestId) }
    event.sender.once('destroyed', cancel)
    try {
      return await action(progress => {
        requestId = progress.requestId
        if (event.sender.isDestroyed()) { cancelLogin(requestId); return }
        loginOwners.set(requestId, { senderId: event.sender.id, service: progress.provider === 'claude' ? claudeLogin : googleLogin })
        event.sender.send('agentflow:llm:runtime-login:progress', progress)
      })
    } finally {
      event.sender.removeListener('destroyed', cancel)
      if (requestId) loginOwners.delete(requestId)
    }
  }
  app.on('before-quit', () => cancelLogin())
  const settings = new LlmSettingsService(getStoreDirectory(), subscriptions, secret => diagnosticLog.protectSecret(secret))
  handle('agentflow:llm:settings:load', async () => settings.snapshot())
  handle('agentflow:llm:settings:save', async (_event, input: LlmSettingsInput) => {
    for (const provider of input.providers ?? []) if (provider.apiKey) diagnosticLog.protectSecret(provider.apiKey.trim())
    return settings.save(input)
  })
  handle('agentflow:llm:models:refresh', async (_event, providerId?: string) => settings.refreshModels(providerId))
  handle('agentflow:llm:provider:test', async (_event, providerId: string) => settings.testProvider(providerId))
  handle('agentflow:llm:tools:detect', async () => settings.detectTools())
  handle('agentflow:llm:subscriptions:refresh', async () => settings.refreshSubscriptions())
  handle('agentflow:llm:subscriptions:connect', async (event, connectorId: SubscriptionConnectorId, options?: SubscriptionConnectorConnectOptions) => {
    await withLoginProgress(event, runtimeReport => subscriptions.connect(connectorId, (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('agentflow:llm:subscriptions:progress', progress)
    }, options, runtimeReport))
    return settings.snapshot()
  })
  handle('agentflow:llm:subscriptions:disconnect', async (_event, connectorId: SubscriptionConnectorId) => {
    await subscriptions.disconnect(connectorId)
    return settings.snapshot()
  })
  handle('agentflow:llm:tools:login', async (event, toolId: string) => {
    const command = await settings.agentToolLoginCommand(toolId)
    const options = await subscriptions.localAntigravityLoginOptions(command)
    await withLoginProgress(event, report => googleLogin.login(options, report))
  })
  handle('agentflow:llm:runtime-login:submit', (event, requestId: string, code: string) => {
    if (typeof code === 'string') diagnosticLog.protectSecret(code)
    const owner = loginOwners.get(requestId)
    if (owner?.senderId !== event.sender.id) throw new Error(t("This login session has ended. Sign in again."))
    owner.service.submit(requestId, code)
  })
  handle('agentflow:llm:runtime-login:cancel', (event, requestId: string) => {
    if (loginOwners.get(requestId)?.senderId === event.sender.id) cancelLogin(requestId)
  })
  handle('agentflow:llm:invoke', async (event, request: DesktopModelInvocationRequest) => {
    if (!/^[a-zA-Z0-9:_-]{8,100}$/.test(request.requestId)) throw new Error(t("Invalid model request id"))
    if (!request.providerId || !request.model || !Array.isArray(request.messages)) throw new Error(t("Invalid model request"))
    const controller = new AbortController()
    const started = Date.now()
    const context = { requestId: request.requestId, providerId: request.providerId, model: request.model }
    diagnosticLog.record({ level: 'info', event: 'model.started', details: context })
    let succeeded = true
    const onDestroyed = () => controller.abort()
    event.sender.once('destroyed', onDestroyed)
    modelInvocations.set(request.requestId, controller)
    const onDelta = (delta: string) => {
      if (!event.sender.isDestroyed()) event.sender.send('agentflow:llm:delta', { requestId: request.requestId, delta })
    }
    try {
      if (request.providerId === 'subscription:deepseek-web') {
        const defaults = (await library.load()).modelDefaults[modelParameterKey(request.providerId, request.model)]
        return await subscriptions.invokeWeb({ ...request, parameters: effectiveModelParameters(request.providerId, request.model, request.parameters, defaults) }, onDelta, controller.signal)
      }
      if (isSubscriptionProviderId(request.providerId)) {
        const prompt = request.messages.map((message) => `${message.role.toUpperCase()}:\n${typeof message.content === 'string' ? message.content : message.content.map((part) => part.type === 'text' ? part.text : `[Image: ${part.name} · ${part.mimeType}]`).join('\n')}`).join('\n\n')
        const invocationWorkspace = await subscriptions.createInvocationWorkspace(request.requestId)
        try {
          if (request.providerId === 'subscription:antigravity') {
            const runtime = await subscriptions.runtime(request.providerId)
            if (!await subscriptions.isAntigravityAuthenticated(runtime.command, runtime.env)) {
              throw new Error(agentToolExitErrorMessage(request.providerId, runtime.name, 1, '', 'Authentication required'))
            }
          }
          return await invokeAgentToolWithRefresh(() => subscriptions.runtime(request.providerId, request.model, request.parameters?.reasoningLevel), {
            providerId: request.providerId,
            model: request.model,
            prompt,
            workspacePath: invocationWorkspace,
            externalSessionId: request.externalSessionId,
            parameters: request.parameters
          }, onDelta, controller.signal)
        } finally {
          await subscriptions.removeInvocationWorkspace(invocationWorkspace)
        }
      }
      if (request.providerId.startsWith('agent-tool:')) {
        if (request.providerId === 'agent-tool:antigravity') {
          const runtime = await settings.agentTool(request.providerId)
          if (!await subscriptions.isAntigravityAuthenticated(runtime.command, process.env)) {
            throw new Error(agentToolExitErrorMessage(request.providerId, runtime.name, 1, '', 'Authentication required'))
          }
        }
        const prompt = request.messages.map((message) => `${message.role.toUpperCase()}:\n${typeof message.content === 'string' ? message.content : message.content.map((part) => part.type === 'text' ? part.text : `[Image: ${part.name} · ${part.mimeType}]`).join('\n')}`).join('\n\n')
        return await invokeAgentToolWithRefresh((refresh) => settings.agentTool(request.providerId, request.model, request.parameters?.reasoningLevel, refresh), {
          providerId: request.providerId,
          model: request.model,
          prompt,
          workspacePath: workspacePath(request.workspace),
          externalSessionId: request.externalSessionId,
          outputDirectory: request.outputDirectory,
          parameters: request.parameters
        }, onDelta, controller.signal)
      }
      const provider = await settings.resolvedProvider(request.providerId, request.model)
      const defaults = (await library.load()).modelDefaults[modelParameterKey(request.providerId, request.model)]
      controller.signal.throwIfAborted()
      return await invokeProvider(provider, { ...request, parameters: effectiveModelParameters(request.providerId, request.model, request.parameters, defaults) }, onDelta, controller.signal)
    } catch (error) {
      succeeded = false
      diagnosticLog.record({ level: controller.signal.aborted ? 'info' : 'error', event: controller.signal.aborted ? 'model.cancelled' : 'model.failed', details: { ...context, durationMs: Date.now() - started, error } })
      throw error
    } finally {
      if (succeeded) diagnosticLog.record({ level: 'info', event: controller.signal.aborted ? 'model.cancelled' : 'model.completed', details: { ...context, durationMs: Date.now() - started } })
      event.sender.removeListener('destroyed', onDestroyed)
      modelInvocations.delete(request.requestId)
    }
  })
  ipcMain.on('agentflow:llm:cancel', (_event, requestId: string) => {
    modelInvocations.get(requestId)?.abort()
  })
}

function registerWindowCloseGuard(window: BrowserWindow) {
  closeStates.set(window.id, {})
  window.on('close', (event) => {
    const state = closeStates.get(window.id) ?? {}
    if (state.allowClose || !state.ready || window.webContents.isDestroyed() || window.webContents.isCrashed()) return
    event.preventDefault()
    if (state.prompting) return
    state.prompting = true
    closeStates.set(window.id, state)
    window.webContents.send('agentflow:window:save-before-close')
  })
  window.on('closed', () => closeStates.delete(window.id))
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 680,
    title: t("AgentFlow"),
    backgroundColor: '#f7f7f5',
    show: false,
    autoHideMenuBar: false,
    ...(process.platform === 'win32' ? {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: {
        color: '#f4f4f1',
        symbolColor: '#565650',
        height: 44
      }
    } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.setMenuBarVisibility(false)

  registerWindowCloseGuard(window)
  observeWindowDiagnostics(window)

  window.once('ready-to-show', () => { if (!releaseSmokeRoot) window.show() })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  const loaded = rendererUrl ? window.loadURL(rendererUrl) : window.loadFile(join(__dirname, '../renderer/index.html'))
  void loaded.catch(error => diagnosticLog.record({ level: 'error', event: 'window.load-failed', details: { error } }))
}

app.whenReady().then(async () => {
  await initializeRuntimeEnvironment()
  await initializeLanguageSettings()
  if (process.platform === 'win32') {
    app.setAppUserModelId(appId)
    // Windows Shell needs a stable physical file, including when the app uses ASAR.
    const brandingDirectory = join(app.getPath('userData'), 'agentflow', 'brand')
    await mkdir(brandingDirectory, { recursive: true })
    taskbarIconPath = join(brandingDirectory, 'app-icon.ico')
    await writeFile(taskbarIconPath, await readFile(appIconIco))
  }
  if (process.platform === 'darwin') app.dock?.setIcon(appIconPng)
  app.on('browser-window-created', (_event, window) => {
    if (process.platform === 'darwin') return
    window.setIcon(process.platform === 'win32' ? appIconIco : appIconPng)
    updateTaskbarBranding(window)
  })
  registerWorkspaceHandlers()
  registerLlmHandlers()
  registerDesktopMenuHandlers()
  registerDiagnosticHandlers()
  installApplicationMenu()
  createWindow()
  if (releaseSmokeRoot) void runReleaseSmoke(releaseSmokeRoot)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch(error => {
  diagnosticLog.record({ level: 'error', event: 'app.start-failed', details: { error } })
  dialog.showErrorBox(t("AgentFlow failed to start"), t("Retrieve diagnostics from the log directory:\n") + diagnosticLog.directory)
})

app.on('child-process-gone', (_event, details) => diagnosticLog.record({ level: 'error', event: 'app.child-process-gone', details }))
let logsFlushedForQuit = false
app.on('will-quit', event => {
  if (logsFlushedForQuit) return
  event.preventDefault()
  for (const controller of modelInvocations.values()) controller.abort()
  terminateManagedProcesses()
  diagnosticLog.record({ level: 'info', event: 'app.quit' })
  void Promise.race([diagnosticLog.flush(), new Promise(resolve => setTimeout(resolve, 1500))]).finally(() => {
    logsFlushedForQuit = true
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
