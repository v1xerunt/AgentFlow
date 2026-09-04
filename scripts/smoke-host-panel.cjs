const assert = require('node:assert/strict')
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs')
const { join, resolve, dirname, basename } = require('node:path')
const { tmpdir } = require('node:os')
const { spawnSync } = require('node:child_process')
const root = resolve(__dirname, '..')
const output = join(root, 'artifacts/host-panel')
const screenshots = join(output, 'screenshots')
const captureScreenshots = process.env.AGENTFLOW_CAPTURE_SCREENSHOTS === '1'

if (!process.versions.electron) {
  const userData = mkdtempSync(join(tmpdir(), 'agentflow-host-panel-'))
  try {
    mkdirSync(output, { recursive: true })
    if (captureScreenshots) mkdirSync(screenshots, { recursive: true })
    const source = JSON.parse(readFileSync(join(root, 'skills/agentflow/assets/review-flow.json'), 'utf8'))
    source.nodes.writer.prompts.system.locked = true
    source.nodes.writer.prompts.system.content += '\n</script><script>globalThis.injected=true</script>'
    writeFileSync(join(output, 'source.json'), JSON.stringify(source))
    const generated = spawnSync(process.execPath, [join(root, 'apps/cli/dist/index.js'), 'host', 'panel', join(output, 'source.json'), '--out', join(userData, 'panel.html')], { cwd: root, encoding: 'utf8', windowsHide: true })
    assert.equal(generated.status, 0, generated.stderr)
    const cleanPanel = spawnSync(process.execPath, [join(root, 'apps/cli/dist/index.js'), 'host', 'panel', join(root, 'skills/agentflow/assets/review-flow.json'), '--out', join(userData, 'preview.html')], { cwd: root, encoding: 'utf8', windowsHide: true })
    assert.equal(cleanPanel.status, 0, cleanPanel.stderr)
    const result = spawnSync(require('electron'), [__filename, userData], { stdio: 'inherit', windowsHide: true, timeout: 40_000 })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
  } finally {
    if (dirname(userData) === resolve(tmpdir()) && basename(userData).startsWith('agentflow-host-panel-')) rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
} else run()

async function run() {
  const { app, BrowserWindow } = require('electron')
  app.disableHardwareAcceleration()
  app.setPath('userData', join(process.argv[2], 'browser'))
  let window
  const timeout = setTimeout(() => { console.error('Panel check timed out'); app.exit(1) }, 30_000)
  try {
    await app.whenReady()
    window = new BrowserWindow({ width: 1440, height: 940, show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false, offscreen: true } })
    const errors = []
    window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message) })
    const evaluate = code => window.webContents.executeJavaScript(code)
    await window.loadFile(join(process.argv[2], 'panel.html'))
    assert.deepEqual(errors, [])
    assert.equal(await evaluate('globalThis.injected'), undefined)
    assert.equal(await evaluate('document.querySelectorAll(".node").length'), 4)
    assert.equal(await evaluate('document.documentElement.lang'), 'zh-CN')
    assert.equal(await evaluate('document.querySelector("#inspector textarea").readOnly'), true)
    await evaluate('document.querySelector("[data-node-id=reviewer]").focus()')
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
    window.webContents.sendInputEvent({ type: 'char', keyCode: '\r' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
    await new Promise(done => setTimeout(done, 80))
    assert.equal(await evaluate('document.activeElement.dataset.nodeId'), 'reviewer')
    assert.equal(await evaluate('document.activeElement.getAttribute("aria-pressed")'), 'true')
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' })
    window.webContents.sendInputEvent({ type: 'char', keyCode: ' ' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' })
    await new Promise(done => setTimeout(done, 80))
    assert.equal(await evaluate('document.activeElement.dataset.nodeId'), 'reviewer')
    await evaluate('document.querySelector("#inspector input").focus(); document.activeElement.value="审阅"; document.activeElement.dispatchEvent(new Event("input"))')
    assert.equal(await evaluate('document.activeElement === document.querySelector("#inspector input")'), true)
    const downloads = new Promise((resolveDownload, reject) => window.webContents.session.once('will-download', (_event, item) => {
      item.setSavePath(join(output, 'exported.json'))
      item.once('done', (_event, state) => state === 'completed' ? resolveDownload() : reject(new Error(state)))
    }))
    await evaluate(`document.querySelector('#goal').value='编辑后的目标'; document.querySelector('#goal').dispatchEvent(new Event('input')); document.querySelector('#export').click()`)
    await downloads
    const exported = JSON.parse(readFileSync(join(output, 'exported.json'), 'utf8'))
    assert.equal(exported.goal, '编辑后的目标')
    assert.equal(exported.nodes.writer.prompts.system.locked, true)
    assert.deepEqual(exported.links, JSON.parse(readFileSync(join(output, 'source.json'), 'utf8')).links)
    await window.loadFile(join(process.argv[2], 'preview.html'))
    // Verify both the actual desktop and a narrow preview while retaining semantic controls.
    for (const [name, width, height] of [['desktop', 1440, 940], ['mobile', 390, 844]]) {
      window.setContentSize(width, height)
      await evaluate('document.fonts.ready')
      await new Promise(done => setTimeout(done, 160))
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Document must fit the viewport; only the canvas scrolls horizontally')
      if (captureScreenshots) writeFileSync(join(screenshots, `host-${name}.png`), (await window.webContents.capturePage()).toPNG())
    }
    assert.deepEqual(errors, [])
    console.log('Offline panel: safe text rendering, prompt locks, keyboard focus continuity, edit/export round trip, desktop/mobile layout passed.')
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally { clearTimeout(timeout); window?.destroy(); app.exit(process.exitCode || 0) }
}
