const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

const temporaryRoot = resolve(tmpdir())

if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-preload-smoke-'))
  try {
    const child = spawnSync(require('electron'), [__filename, userData], {
      stdio: 'inherit',
      timeout: 30_000,
      windowsHide: true
    })
    if (child.error) throw child.error
    process.exitCode = child.status ?? 1
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-preload-smoke-')) {
      rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    }
  }
} else {
  void runElectronSmoke()
}

async function runElectronSmoke() {
  const { app, BrowserWindow, ipcMain } = require('electron')
  const userData = process.argv[2]
  assert.ok(userData && dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-preload-smoke-'))
  app.setPath('userData', userData)

  const snapshot = { providers: [], agentTools: [], subscriptions: [], catalog: [], promptAutofill: { providerId: '', model: '' } }
  let testWindow
  let savedInput
  let savedLibrary = { version: 1, modelDefaults: {}, parameterPresets: [], agents: [] }
  const invocations = new Map()
  let closeSaveCompleted = false
  const preloadErrors = []
  const timeout = setTimeout(() => {
    console.error('Desktop bridge smoke test timed out')
    process.exitCode = 1
    testWindow?.destroy()
    app.quit()
  }, 20_000)

  app.on('quit', () => {
    clearTimeout(timeout)
  })

  await app.whenReady().then(async () => {
    ipcMain.handle('agentflow:language:get', () => ({ preference: 'zh', systemLanguages: ['zh-CN'] }))
    ipcMain.handle('agentflow:llm:settings:load', () => snapshot)
    ipcMain.handle('agentflow:library:load', () => savedLibrary)
    ipcMain.handle('agentflow:library:save', (_event, value) => { savedLibrary = value })
    ipcMain.handle('agentflow:llm:settings:save', (_event, input) => {
      savedInput = input
      return snapshot
    })
    ipcMain.handle('agentflow:llm:provider:test', (_event, id) => {
      if (id === 'smoke-error') throw new Error('Smoke connection rejected')
      assert.equal(id, 'smoke-success')
      return { ...snapshot, tested: true }
    })
    ipcMain.handle('agentflow:llm:subscriptions:refresh', () => snapshot)
    ipcMain.handle('agentflow:llm:subscriptions:connect', (event, connectorId, options) => {
      if (connectorId === 'subscription:deepseek-web') assert.deepEqual(options, { acceptExperimentalRisk: true })
      event.sender.send('agentflow:llm:subscriptions:progress', { connectorId, phase: 'connected', message: 'connected' })
      return snapshot
    })
    ipcMain.handle('agentflow:llm:subscriptions:disconnect', () => snapshot)
    ipcMain.handle('agentflow:workspace:load-project', (_event, root) => ({ openedRoot: root }))
    ipcMain.handle('agentflow:workspace:save-project-files', (_event, state, projectId) => {
      assert.equal(projectId, 'smoke-project')
      assert.deepEqual(state, { projects: [] })
    })
    ipcMain.handle('agentflow:workspace:reveal-file', (_event, binding, path) => {
      assert.deepEqual(binding, { mode: 'temporary', tempId: 'smoke' })
      assert.equal(path, '.flow/outputs/test.md')
    })
    ipcMain.handle('agentflow:llm:invoke', (event, request) => new Promise((resolve) => {
      invocations.set(request.requestId, resolve)
      event.sender.send('agentflow:llm:delta', { requestId: request.requestId, delta: 'started' })
    }))
    ipcMain.on('agentflow:llm:cancel', (_event, requestId) => {
      invocations.get(requestId)?.({ content: 'cancelled', providerId: 'smoke', model: 'smoke' })
      invocations.delete(requestId)
    })
    ipcMain.on('agentflow:window:save-listener-ready', (event, ready) => {
      if (ready) event.sender.send('agentflow:window:save-before-close')
    })
    ipcMain.on('agentflow:window:complete-close-save', (_event, success) => { closeSaveCompleted = success })

    testWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: join(__dirname, '../out/preload/index.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    testWindow.webContents.on('preload-error', (_event, _path, error) => preloadErrors.push(error.message))
    await testWindow.loadURL('data:text/html,<!doctype html><title>Desktop bridge smoke test</title>')

    const result = await testWindow.webContents.executeJavaScript(`(async () => {
      const api = window.agentflowDesktop
      if (!api) throw new Error('Desktop bridge is missing')
      const loaded = await api.loadLlmSettings()
      const library = await api.loadAgentLibrary()
      await api.saveAgentLibrary({ ...library, modelDefaults: { smoke: { maxTokens: 32768 } } })
      const reloadedLibrary = await api.loadAgentLibrary()
      const saved = await api.saveLlmSettings({ providers: [], agentTools: [], promptAutofill: { providerId: '', model: '' } })
      const tested = await api.testProvider('smoke-success')
      const refreshedSubscriptions = await api.refreshSubscriptionConnectors()
      let subscriptionProgress = false
      const unsubscribeProgress = api.onSubscriptionConnectorProgress((progress) => { subscriptionProgress = progress.phase === 'connected' })
      await api.connectSubscriptionConnector('subscription:codex')
      await api.connectSubscriptionConnector('subscription:deepseek-web', { acceptExperimentalRisk: true })
      unsubscribeProgress()
      await api.disconnectSubscriptionConnector('subscription:codex')
      let rejected = false
      try { await api.testProvider('smoke-error') }
      catch (error) { rejected = error.message.includes('Smoke connection rejected') }
      const opened = await api.loadProjectDirectory('smoke-project')
      await api.saveProjectFiles({ projects: [] }, 'smoke-project')
      await api.revealWorkspaceFile({ mode: 'temporary', tempId: 'smoke' }, '.flow/outputs/test.md')
      let receivedDelta = false
      const cancelled = await api.invokeModel({ requestId: 'smoke_cancel_123', providerId: 'smoke', model: 'smoke', messages: [], workspace: { mode: 'temporary', tempId: 'smoke' } }, () => {
        receivedDelta = true
        api.cancelModel('smoke_cancel_123')
      })
      const closeSaved = await new Promise((resolve) => {
        const unsubscribe = api.onSaveBeforeClose(() => {
          api.completeCloseSave(true)
          unsubscribe()
          resolve(true)
        })
      })
      return {
        loaded: Array.isArray(loaded.providers),
        library: reloadedLibrary.modelDefaults.smoke.maxTokens === 32768,
        saved: Array.isArray(saved.providers),
        tested: tested.tested === true,
        subscriptions: Array.isArray(refreshedSubscriptions.subscriptions) && subscriptionProgress,
        rejected,
        projectOpen: opened.openedRoot === 'smoke-project',
        cancellation: receivedDelta && cancelled.content === 'cancelled',
        closeSaved,
        nativeMethods: ['detectAgentTools', 'invokeModel', 'chooseDirectory', 'connectSubscriptionConnector', 'disconnectSubscriptionConnector'].every(name => typeof api[name] === 'function'),
        nodeIsolated: typeof window.require === 'undefined' && typeof window.process === 'undefined'
      }
    })()`)

    assert.deepEqual(preloadErrors, [])
    assert.deepEqual(result, { loaded: true, library: true, saved: true, tested: true, subscriptions: true, rejected: true, projectOpen: true, cancellation: true, closeSaved: true, nativeMethods: true, nodeIsolated: true })
    assert.equal(closeSaveCompleted, true)
    assert.deepEqual(savedInput, { providers: [], agentTools: [], promptAutofill: { providerId: '', model: '' } })
    console.log('Desktop bridge smoke passed: sandboxed preload, settings IPC, test success/error, project open, cancellation, isolated renderer.')
  }).catch((error) => {
    console.error(error.message, ...preloadErrors)
    process.exitCode = 1
  }).finally(() => {
    clearTimeout(timeout)
    testWindow?.destroy()
    app.quit()
  })
}
