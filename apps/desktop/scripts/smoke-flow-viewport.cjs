const assert = require('node:assert/strict')
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

const temporaryRoot = resolve(tmpdir())
if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-viewport-test-'))
  try {
    const child = spawnSync(require('electron'), [__filename, userData], { stdio: 'inherit', timeout: 45_000, windowsHide: true })
    if (child.error) throw child.error
    process.exitCode = child.status ?? 1
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-viewport-test-')) rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
} else void run()

async function run() {
  const { app, BrowserWindow, ipcMain } = require('electron')
  app.setPath('userData', process.argv[2])
  const now = new Date().toISOString()
  const input = { type: 'input', name: '输入材料', items: [{ id: 'brief', name: '任务说明', kind: 'text', mode: 'text', content: '整理材料，撰写并检查最终报告。' }], position: { x: -180, y: 80 } }
  const agent = (name, x, y) => ({ type: 'agent', name, provider: 'fake', model: 'agent-v1', prompts: Object.fromEntries(['system', 'input', 'output'].map(key => [key, { content: '', customized: false, locked: false }])), position: { x, y } })
  const definition = { version: 1, name: '完整 Flow', goal: '', nodes: {
    input, planner: agent('规划 Agent', 260, 80), writer: { ...agent('撰写 Agent', 730, 430), provider: 'agent-tool:claude-code', model: 'sonnet' },
    result: { type: 'output', name: 'Result', ownerAgentId: 'writer', directory: '.flow/agent-results/writer', note: '', extractText: true, position: { x: 1200, y: 430 } }
  }, links: [{ id: 'input-link', type: 'input', sourceId: 'input', targetId: 'planner' }, { id: 'pass-link', type: 'pass', sourceId: 'planner', targetId: 'writer' }] }
  const definitions = [definition, { ...definition, name: '单个输入', nodes: { input }, links: [] }, { ...definition, name: '空白 Flow', nodes: {}, links: [] }]
  let saved = { schemaVersion: 1, projects: [{ id: 'viewport-project', name: '画布缩放测试', workspace: { mode: 'directory', rootPath: join(process.argv[2], 'project') }, createdAt: now, updatedAt: now }], graphs: definitions.map((definition, i) => ({ id: `viewport-${i}`, projectId: 'viewport-project', definition, revision: 1, createdAt: now, updatedAt: now })) }
  const snapshot = { providers: [], agentTools: [], subscriptions: [], catalog: [{ id: 'fake', name: 'Fake (Demo)', connector: 'model', configured: true, models: [{ providerId: 'fake', providerName: 'Fake (Demo)', modelId: 'agent-v1', modelName: 'agent-v1', connector: 'model', configured: true, parameters: {} }] }], promptAutofill: { providerId: '', model: '' }, flowGeneration: { providerId: '', model: '' }, chatHistoryMaxChars: 200000 }
  let window
  const errors = []
  const timeout = setTimeout(() => { console.error('Flow viewport smoke timed out'); window?.destroy(); app.exit(1) }, 38_000)
  try {
    await app.whenReady()
    ipcMain.handle('agentflow:language:get', () => ({ preference: 'zh', systemLanguages: ['zh-CN'] }))
    ipcMain.handle('agentflow:workspace:load', () => saved)
    ipcMain.handle('agentflow:workspace:save', (_event, value) => { saved = value })
    for (const channel of ['agentflow:workspace:ensure-temporary', 'agentflow:workspace:save-project-files', 'agentflow:workspace:discard-temporary']) ipcMain.handle(channel, () => undefined)
    ipcMain.handle('agentflow:library:load', () => null)
    for (const channel of ['agentflow:llm:settings:load', 'agentflow:llm:tools:detect', 'agentflow:llm:subscriptions:refresh']) ipcMain.handle(channel, () => snapshot)
    ipcMain.handle('agentflow:llm:invoke', () => { throw new Error('Viewport tests must not invoke a model') })
    window = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { preload: join(__dirname, '../out/preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: true } })
    window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message) })
    window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }))
    const evaluate = code => window.webContents.executeJavaScript(code)
    const pause = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))
    const waitFor = async code => {
      for (let i = 0; i < 120; i++) { if (await evaluate(code)) return; await pause(35) }
      throw new Error(`Timed out: ${code}`)
    }
    const clickText = async (selector, text) => {
      const query = `[...document.querySelectorAll(${JSON.stringify(selector)})].find(element => element.textContent.trim() === ${JSON.stringify(text)})`
      await waitFor(`Boolean(${query})`)
      await evaluate(`${query}.click()`)
    }
    const viewport = () => evaluate(`(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform); return [m.a, m.e, m.f]; })()`)
    const assertFits = async count => {
      await waitFor(`(() => {
        const canvas = document.querySelector('.react-flow')?.getBoundingClientRect();
        const nodes = [...document.querySelectorAll('.react-flow__node')];
        return canvas && nodes.length === ${count} && nodes.every(node => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.left >= canvas.left && r.top >= canvas.top && r.right <= canvas.right && r.bottom <= canvas.bottom;
        });
      })()`)
      assert.ok((await viewport())[0] <= 1.201, 'Auto fit must not enlarge a single card excessively')
    }
    await window.loadFile(join(__dirname, '../out/renderer/index.html'))
    // Reproduce Input being measured before Agent/Result cards on every mount.
    await evaluate(`(() => {
      const NativeObserver = window.ResizeObserver;
      window.ResizeObserver = class extends NativeObserver {
        constructor(callback) {
          super((entries, observer) => {
            const later = entries.filter(entry => entry.target.classList.contains('react-flow__node') && entry.target.dataset.id !== 'input');
            const ready = entries.filter(entry => !later.includes(entry));
            if (ready.length) callback(ready, observer);
            if (later.length) setTimeout(() => callback(later.filter(entry => entry.target.isConnected), observer), 180);
          });
        }
      };
    })()`)
    console.log('Viewport smoke: opening saved Flow')
    await clickText('.project-row__main', '画布缩放测试')
    for (const [width, height] of [[1440, 900], [1040, 720]]) {
      console.log(`Viewport smoke: checking ${width}px window`)
      window.setSize(width, height)
      await clickText('.graph-row__main', '单个输入')
      await assertFits(1)
      await clickText('.graph-row__main', '完整 Flow')
      await assertFits(4)
      await evaluate('document.fonts.ready')
      await pause()
      const fitted = await viewport()
      await evaluate("document.querySelector('.react-flow__controls-fitview').click()")
      await pause()
      const manualFit = await viewport()
      fitted.forEach((value, i) => assert.ok(Math.abs(value - manualFit[i]) < 1, 'Entry and Fit View must use the same scale and position'))
      writeFileSync(join(__dirname, `../out/flow-viewport-${width}.png`), (await window.webContents.capturePage()).toPNG())
      await evaluate("document.querySelector('.react-flow__controls-zoomin').click()")
      await pause()
      const zoomed = await viewport()
      assert.ok(zoomed[0] > fitted[0], 'Manual zoom remains available')
      await evaluate("document.querySelector('.react-flow__node[data-id=planner]').dispatchEvent(new MouseEvent('click', { bubbles: true }))")
      await pause()
      assert.deepEqual(await viewport(), zoomed, 'Selecting a node must preserve manual zoom')
      await evaluate("document.querySelector('.react-flow__node[data-id=planner]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))")
      await clickText('button', '返回 Flow')
      await assertFits(4)
      await clickText('.graph-row__main', '空白 Flow')
      if (width === 1440) {
        await waitFor("Boolean(document.querySelector('.canvas-empty'))")
        await clickText('.node-library-toolbar button', '输入')
      }
      await assertFits(1)
      await clickText('.graph-row__main', '完整 Flow')
      await assertFits(4)
    }
    assert.deepEqual(errors, [], 'Renderer must remain error-free')
    console.log('Flow viewport smoke passed: delayed measurements, Flow switching, chat return, empty Flow, manual zoom, and 1440/1040px windows.')
    clearTimeout(timeout)
    window.destroy()
    app.exit(0)
  } catch (error) {
    console.error(error)
    clearTimeout(timeout)
    window?.destroy()
    app.exit(1)
  }
}
