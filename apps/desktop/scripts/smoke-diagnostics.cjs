const assert = require('node:assert/strict')
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { spawnSync } = require('node:child_process')

const temporaryRoot = resolve(tmpdir())
if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-diagnostics-smoke-'))
  try {
    const child = spawnSync(require('electron'), [__filename, userData], { stdio: 'inherit', timeout: 60000, windowsHide: true })
    if (child.error) throw child.error
    process.exitCode = child.status ?? 1
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-diagnostics-smoke-')) rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
} else void run()

async function run() {
  const { app, BrowserWindow, dialog, Menu, shell } = require('electron')
  const userData = process.argv[2]
  assert.ok(userData && dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-diagnostics-smoke-'))
  app.setPath('userData', userData)
  // Exercise the production main process without displaying test windows or native dialogs.
  BrowserWindow.prototype.show = function () {}
  const exportPath = join(userData, 'diagnostic-report.json')
  let saveResult = { canceled: false, filePath: exportPath }
  const openedPaths = []
  dialog.showSaveDialog = async () => saveResult
  dialog.showErrorBox = (title, detail) => { throw new Error(`${title}: ${detail}`) }
  shell.openPath = async path => { openedPaths.push(path); return '' }
  const timeout = setTimeout(() => { console.error('Diagnostics smoke timed out'); app.exit(1) }, 45000)
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  const waitFor = async predicate => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await predicate()) return
      await pause(50)
    }
    throw new Error('Timed out waiting for diagnostics UI')
  }
  try {
    await import(pathToFileURL(resolve(__dirname, '../out/main/index.js')).href)
    await app.whenReady()
    await waitFor(() => BrowserWindow.getAllWindows().length > 0)
    const main = BrowserWindow.getAllWindows()[0]
    const evaluate = code => main.webContents.executeJavaScript(code)
    await waitFor(async () => await evaluate('Boolean(window.agentflowDesktop && document.querySelector(".app-titlebar"))'))
    const help = Menu.getApplicationMenu().items.find(item => item.label === '帮助')
    assert.ok(help.submenu.items.some(item => item.label === '日志与诊断…'))
    assert.ok(help.submenu.items.some(item => item.label === '导出诊断报告…'))

    await evaluate(`(async () => {
      const api = window.agentflowDesktop;
      api.recordDiagnostic({ level: 'error', event: 'smoke.renderer-error', details: { message: 'Cannot save file at C:\\Users\\Alice\\project; api_key=smoke-hidden-key', password: 'hidden-password' } });
      setTimeout(() => { throw new Error('smoke uncaught exception') }, 0);
      void Promise.reject(new Error('smoke unhandled rejection'));
      try { await api.invokeModel({ requestId: 'smoke_request_123', providerId: 'missing-smoke-provider', model: 'smoke-model', messages: [{ role: 'user', content: 'private-prompt-sentinel' }], workspace: { mode: 'temporary', tempId: 'smoke' } }) } catch {}
      await api.invokeMenuAction('diagnostics');
    })()`)
    await waitFor(() => BrowserWindow.getAllWindows().some(window => window.webContents.getURL().endsWith('#diagnostics')))
    const logs = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('#diagnostics'))
    const inspect = code => logs.webContents.executeJavaScript(code)
    await waitFor(async () => await inspect('Boolean(document.querySelector(".diagnostic-entry"))'))
    await inspect(`(async () => {
      const api = window.agentflowDesktop;
      await api.openLogsDirectory();
      await api.exportDiagnostics();
    })()`)
    const reportText = readFileSync(exportPath, 'utf8')
    const report = JSON.parse(reportText)
    for (const event of ['app.start', 'smoke.renderer-error', 'renderer.error', 'renderer.unhandled-rejection', 'model.started', 'model.failed', 'ipc.failed']) assert.ok(report.entries.some(entry => entry.event === event), `Missing ${event}`)
    for (const secret of ['smoke-hidden-key', 'hidden-password', 'private-prompt-sentinel']) assert.ok(!reportText.includes(secret), `Export leaked ${secret}`)
    assert.equal(report.environment.electron, process.versions.electron)
    assert.equal(openedPaths[0], join(userData, 'agentflow', 'logs'))
    const modelError = report.entries.find(entry => entry.event === 'model.failed')
    assert.equal(modelError.details.requestId, 'smoke_request_123')
    assert.equal(modelError.details.model, 'smoke-model')
    assert.ok(typeof modelError.details.durationMs === 'number')

    saveResult = { canceled: true }
    assert.equal(await inspect('window.agentflowDesktop.exportDiagnostics()'), null)
    const blockedPath = join(userData, 'blocked')
    writeFileSync(blockedPath, 'file instead of directory')
    saveResult = { canceled: false, filePath: join(blockedPath, 'report.json') }
    await inspect('document.querySelector(".diagnostics-heading button").click()')
    await waitFor(async () => await inspect('document.querySelector("[role=alert]")?.textContent.includes("报告导出失败")'))
    saveResult = { canceled: false, filePath: exportPath }
    await inspect('document.querySelector(".diagnostics-heading button").click()')
    await waitFor(async () => await inspect('document.querySelector("[role=status]")?.textContent.includes("报告已导出")'))

    await inspect(`(() => {
      const select = document.querySelector('[aria-label="日志级别"]');
      select.value = 'error'; select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`)
    await waitFor(async () => await inspect(`Array.from(document.querySelectorAll('.diagnostic-level')).every(element => element.textContent === '错误')`))
    await inspect(`document.querySelector('.diagnostic-entry').open = true; document.querySelector('.diagnostic-entry summary').focus()`)
    assert.equal(await inspect('document.activeElement.tagName'), 'SUMMARY')
    if (process.env.AGENTFLOW_CAPTURE_DIAGNOSTICS) {
      const directory = resolve(__dirname, '../../../artifacts/diagnostics')
      mkdirSync(directory, { recursive: true })
      for (const [width, name] of [[1000, 'diagnostics-desktop'], [680, 'diagnostics-compact']]) {
        logs.setContentSize(width, 760)
        await inspect('document.fonts.ready')
        await pause(250)
        assert.equal(await inspect('document.documentElement.scrollWidth <= window.innerWidth'), true)
        writeFileSync(join(directory, `${name}.png`), (await logs.webContents.capturePage()).toPNG())
      }
    }
    // A broken saved workspace still offers diagnostics before the editor mounts.
    const storage = join(userData, 'agentflow')
    writeFileSync(join(storage, 'workspace-state.json'), '{invalid')
    main.reload()
    await waitFor(async () => await evaluate('Boolean(Array.from(document.querySelectorAll("button")).find(button => button.textContent === "日志与诊断"))'))
    console.log('Diagnostics smoke passed: real main/preload/renderer, native Help menu, global errors, model failure correlation, sanitized export, cancel, export failure/retry, filters, keyboard access, workspace-load recovery.')
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
    for (const window of BrowserWindow.getAllWindows()) window.destroy()
    app.quit()
  }
}
