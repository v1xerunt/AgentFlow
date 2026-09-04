const assert = require('node:assert/strict')
const { mkdtempSync, rmSync, mkdirSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

const temporaryRoot = resolve(tmpdir())
if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-tutorial-test-'))
  try {
    const child = spawnSync(require('electron'), [__filename, userData], { stdio: 'inherit', timeout: 120000, windowsHide: true })
    if (child.error) throw child.error
    process.exitCode = child.status ?? 1
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-tutorial-test-')) rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
} else void run()

async function run() {
  const { app, BrowserWindow, ipcMain } = require('electron')
  app.setPath('userData', process.argv[2])
  let window
  let saved = null
  let invocationCalls = 0
  const opened = [], revealed = []
  const errors = []
  const catalog = [['fake', 'Fake (Demo)', 'agent-v1'], ['openai', 'Personal OpenAI', 'personal-gpt'], ['work', 'Work Provider', 'private-model']].map(([id, name, modelId]) => ({ id, name, connector: 'model', configured: true, models: [{ providerId: id, providerName: name, modelId, modelName: modelId, connector: 'model', configured: true, parameters: {} }] }))
  const snapshot = { providers: [], agentTools: [], subscriptions: [], catalog, promptAutofill: { providerId: '', model: '' }, flowGeneration: { providerId: '', model: '' }, chatHistoryMaxChars: 200000 }
  const timeout = setTimeout(() => { console.error('Tutorial UI smoke timed out'); window?.destroy(); app.exit(1) }, 105000)
  try {
    await app.whenReady()
    ipcMain.handle('agentflow:language:get', () => ({ preference: 'zh', systemLanguages: ['zh-CN'] }))
    ipcMain.handle('agentflow:workspace:load', () => saved)
    ipcMain.handle('agentflow:workspace:save', (_event, value) => { saved = value })
    ipcMain.handle('agentflow:workspace:ensure-temporary', () => undefined)
    ipcMain.handle('agentflow:workspace:ensure-tutorial', () => join(process.argv[2], 'example'))
    ipcMain.handle('agentflow:workspace:save-project-files', () => undefined)
    ipcMain.handle('agentflow:workspace:open-file', (_event, binding, path) => opened.push({ binding, path }))
    ipcMain.handle('agentflow:workspace:reveal-file', (_event, binding, path) => revealed.push({ binding, path }))
    ipcMain.handle('agentflow:workspace:discard-temporary', () => undefined)
    ipcMain.handle('agentflow:library:load', () => null)
    for (const channel of ['agentflow:llm:settings:load', 'agentflow:llm:tools:detect', 'agentflow:llm:subscriptions:refresh']) ipcMain.handle(channel, () => snapshot)
    ipcMain.handle('agentflow:llm:invoke', () => { invocationCalls += 1; throw new Error('Tutorial attempted a model invocation') })
    window = new BrowserWindow({ width: 1400, height: 900, show: false, webPreferences: { preload: join(__dirname, '../out/preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: true } })
    window.webContents.on('console-message', (event) => { if (event.level === 'error') errors.push(event.message) })
    window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }))
    const evaluate = (code) => window.webContents.executeJavaScript(code)
    const waitFor = async (code) => {
      for (let count = 0; count < 120; count += 1) {
        if (await evaluate(code)) return
        await new Promise((resolve) => setTimeout(resolve, 40))
      }
      throw new Error(`Timed out: ${code}`)
    }
    const click = async (selector) => {
      await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
    }
    const stage = (step) => waitFor(`document.querySelector('.tutorial-spotlight')?.dataset.guideStep === '${step}'`)
    const capture = async (name) => {
      if (!process.env.AGENTFLOW_CAPTURE_TUTORIAL) return
      await evaluate('document.fonts.ready')
      await new Promise((resolve) => setTimeout(resolve, 350))
      const directory = resolve(__dirname, '../../../artifacts/tutorial')
      mkdirSync(directory, { recursive: true })
      writeFileSync(join(directory, `${name}.png`), (await window.webContents.capturePage()).toPNG())
    }
    const pause = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms))
    const dragLink = async (from, to) => {
      await pause(500)
      const points = await evaluate(`(() => {
        const a = document.querySelector('[data-id="${from}"] .react-flow__handle.source').getBoundingClientRect();
        const b = document.querySelector('[data-id="${to}"] .react-flow__handle.target').getBoundingClientRect();
        return { a: { x: a.x+a.width/2, y: a.y+a.height/2 }, b: { x: b.x+b.width/2, y: b.y+b.height/2 } };
      })()`)
      const send = (type, point, extra = {}) => window.webContents.sendInputEvent({ type, x: Math.round(point.x), y: Math.round(point.y), ...extra })
      send('mouseMove', points.a)
      send('mouseDown', points.a, { button: 'left', clickCount: 1 })
      for (let i = 1; i <= 16; i++) { send('mouseMove', { x: points.a.x+(points.b.x-points.a.x)*i/16, y: points.a.y+(points.b.y-points.a.y)*i/16 }, { button: 'left' }); await pause(16) }
      send('mouseUp', points.b, { button: 'left', clickCount: 1 })
    }
    const action = (id) => waitFor(`document.querySelector('.tutorial-spotlight')?.dataset.guideAction === ${JSON.stringify(id)}`)
    const clickTarget = async () => {
      await waitFor("Boolean(document.querySelector('.tutorial-button-ring'))")
      const selector = await evaluate("document.querySelector('.tutorial-button-ring')?.getAttribute('data-guide-target')")
      assert.ok(selector, 'Guide must identify one actionable button')
      await click(selector)
    }
    const nativeClick = async (selector) => {
      const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2) }; })()`)
      window.webContents.sendInputEvent({ type: 'mouseMove', ...point })
      window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
      window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
    }
    await window.loadFile(join(__dirname, '../out/renderer/index.html'))
    let tutorialId, project
    for (const [index, query] of ['glm', 'Codex'].entries()) {
      if (index) { window.setSize(1040, 680); window.webContents.send('agentflow:menu:command', { type: 'tutorial' }) }
      await stage(0); await action('generate-flow')
      await evaluate("localStorage.setItem('agentflow.inspector.section.agent-prompts', 'closed')")
      if (!index) {
        await capture('first-run')
        await nativeClick('.sidebar-settings')
        await waitFor("Number(document.querySelector('.tutorial-spotlight')?.dataset.guideRetry) > 0")
        assert.equal(await evaluate("Boolean(document.querySelector('#settings-surface-title'))"), false)
        assert.equal(await evaluate("document.querySelectorAll('.tutorial-button-ring').length"), 1)
        assert.equal(await evaluate("document.body.textContent.includes('预置演练') || document.body.textContent.includes('无需连接')"), false)
        window.webContents.send('agentflow:menu:command', { type: 'new-project' })
        await evaluate("document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true, cancelable: true }))")
        await pause(100); await stage(0)
        assert.equal(await evaluate("Boolean(document.querySelector('#settings-surface-title'))"), false)
      }
      await clickTarget(); await action('preview-flow'); await clickTarget(); await action('building-flow')
      assert.equal(await evaluate("Boolean(document.querySelector('.flow-generation-preview'))"), false)
      await action('apply-flow')
      if (!index) await capture('generate-preview')
      await clickTarget(); await stage(1); await action('overview')
      await pause(500)
      assert.equal(await evaluate("(() => { const c = document.querySelector('.canvas-frame').getBoundingClientRect(); return [...document.querySelectorAll('.react-flow__node')].every(n => { const r=n.getBoundingClientRect(); return r.left>=c.left && r.right<=c.right && r.top>=c.top && r.bottom<=c.bottom; }); })()"), true)
      if (!index) await capture('generated-overview')
      await click('.tutorial-overview-done'); await action('open-models'); await clickTarget(); await action('choose-model')
      assert.equal(await evaluate("document.querySelector('.node-library-panel').textContent.includes('personal-gpt') || document.querySelector('.node-library-panel').textContent.includes('private-model')"), false)
      assert.equal(await evaluate("document.querySelectorAll('.node-library-item').length"), 5)
      await evaluate(`(() => { const input = document.querySelector('.library-search input'); input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(query)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
      await waitFor(`document.querySelector('.node-library-item')?.textContent.toLowerCase().includes(${JSON.stringify(query.toLowerCase())})`)
      await click('.node-library-item'); await stage(2); await action('connect-writer')
      await waitFor("document.querySelectorAll('.tutorial-point-ring').length === 2")
      assert.equal(await evaluate("Boolean(document.querySelector('animateMotion'))"), true)
      if (!index) {
        await capture('connect-reviewer')
        window.setSize(1040, 780); await capture('laptop'); window.setSize(1400, 900)
        await dragLink('writer', 'writer'); await stage(2)
        await waitFor("Number(document.querySelector('.tutorial-spotlight').dataset.guideRetry) > 0")
      }
      await dragLink('writer', 'reviewer'); await stage(3); await action('relation-review-trigger')
      await waitFor("Boolean(document.querySelector('.tutorial-link-trace'))")
      await clickTarget(); await action('relation-review-option')
      await nativeClick('.menu-select__option[data-value="revise"]'); await stage(3); await pause(500); await action('relation-review-option')
      if (!index) await capture('review-link')
      await clickTarget(); await stage(4)
      const reviewSource = index ? 'output_reviewer' : 'reviewer'
      await action(`connect-${reviewSource}`)
      if (index) await capture('tool-reviewer')
      await dragLink(reviewSource, 'reviser')
      if (!index) {
        await stage(5); await action('relation-revise-trigger'); await clickTarget(); await action('relation-revise-option'); await clickTarget()
      }
      await stage(6); await action('autofill'); await clickTarget(); await action('confirm-autofill'); await clickTarget()
      await action('building-prompts'); await stage(6)
      await stage(7)
      if (await evaluate("document.querySelector('[data-section-key=\"agent-prompts\"] .inspector-section__toggle')?.getAttribute('aria-expanded') === 'false'")) { await action('view-prompts'); await clickTarget() }
      await action('run-flow')
      assert.equal(await evaluate("[...document.querySelectorAll('[data-section-key=\"agent-prompts\"] textarea')].filter(el => el.value.trim()).length"), 3)
      if (!index) await capture('generated-prompts')
      await clickTarget(); await action('confirm-run'); await clickTarget()
      const runOrder = ['brief', 'analyst', 'writer', 'reviewer', ...(index ? ['output_reviewer'] : []), 'reviser', 'local', 'result']
      for (const id of runOrder) {
        await action(`running-${id}`)
        await waitFor(`document.querySelector('[data-id="${id}"] .flow-node')?.classList.contains('is-running')`)
        assert.equal(await evaluate("document.querySelectorAll('.flow-node.is-running').length"), 1)
        if (!index && id === 'local') await capture('running-flow')
      }
      await stage(8); await action('open-findings')
      if (!index) await capture('local-result')
      assert.equal(await evaluate("document.querySelector('.inspector').textContent.includes('打开完整内容')"), false)
      assert.equal(await evaluate("[...document.querySelectorAll('.output-preview-actions button, .node-file-row__actions button')].every(button => !button.textContent.trim() && button.querySelector('svg'))"), true)
      await click('[aria-label="打开 summary.csv"]')
      assert.equal(opened.length, index, 'Off-step system open is blocked')
      await clickTarget(); await stage(9); await action('return-to-flow')
      await waitFor("document.querySelector('.document-reading')?.textContent.includes('3.5')")
      if (!index) await capture('markdown-result')
      await clickTarget(); await action('connect-result'); await dragLink('result', 'delivery')
      await stage(10); await action('run-delivery'); await clickTarget(); await action('running-delivery'); await stage(11)
      if (await evaluate("document.querySelector('[data-section-key=\"agent-output\"] .inspector-section__toggle')?.getAttribute('aria-expanded') === 'false'")) { await action('expand-brief'); await clickTarget() }
      await action('open-brief'); await clickTarget(); await action('read-brief')
      await waitFor("document.querySelector('.document-reading')?.textContent.includes('下周行动')")
      if (!index) await capture('weekly-brief')
      await clickTarget(); await stage(12); await action('open-settings')
      await clickTarget()
      await waitFor("Boolean(document.querySelector('#settings-surface-title')) && !document.querySelector('.tutorial-spotlight')")
      if (!index) await capture('connections')
      await pause(600)
      assert.equal(saved.tutorial.status, 'completed')
      tutorialId = saved.tutorial.graphId
      const graph = saved.graphs.find(graph => graph.id === tutorialId)
      project = saved.projects.find(project => project.id === graph.projectId)
      assert.equal(project.workspace.mode, 'directory')
      assert.equal(Object.values(graph.definition.nodes).filter(node => node.type === 'agent').every(node => node.provider === 'fake' && node.model === 'agent-v1'), true)
      if (index) {
        assert.equal(graph.definition.links.find(link => link.targetId === 'reviser').sourceId, 'output_reviewer')
        assert.equal(saved.artifacts.find(artifact => artifact.nodeId === 'output_reviewer').files[0].name, 'review.md')
      }
      // Completion removes tutorial entries immediately in every model picker.
      await click('.settings-back')
      await waitFor("Boolean(document.querySelector('.canvas-frame')) && !document.querySelector('#settings-surface-title')")
      await click('[data-tutorial="models"]')
      assert.equal(await evaluate("document.querySelectorAll('.node-library-item').length"), 2)
      assert.equal(await evaluate("document.querySelector('.node-library-panel').textContent.includes('private-model')"), true)
      await click('[aria-label="关闭节点库"]')
      await click('[data-id="reviewer"] [aria-label="独立审核 模型"]')
      assert.equal(await evaluate("document.querySelectorAll('.menu-select__option').length"), 1)
      assert.equal(await evaluate("document.querySelector('.menu-select__option').dataset.value"), 'agent-v1')
      await evaluate("document.querySelector('.canvas-heading').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))")
      await click('[data-id="result"]')
      await click('[aria-label="打开 summary.csv"]'); await pause(100)
      assert.equal(opened.length, index + 1)
      assert.match(opened[index].path, /\.flow\/outputs\/.+\.csv$/)
    }
    window.webContents.send('agentflow:menu:command', { type: 'tutorial' })
    await stage(0); await action('generate-flow'); await clickTarget(); await action('preview-flow'); await clickTarget(); await action('building-flow')
    await click('[aria-label="跳过教程"]'); await pause(1500)
    assert.equal(await evaluate("Boolean(document.querySelector('.flow-generation-dialog'))"), false)
    await click('[data-tutorial="models"]')
    assert.equal(await evaluate("document.querySelectorAll('.node-library-item').length"), 2)
    await click('[aria-label="关闭节点库"]')
    assert.equal(saved.tutorial.status, 'skipped')
    assert.equal(saved.tutorial.step, 12)
    assert.equal(saved.projects.filter(item => item.id === project.id).length, 1)
    assert.equal(saved.graphs.filter(item => item.id === tutorialId).length, 1)
    const skippedGraph = saved.graphs.find(item => item.id === tutorialId).definition
    assert.equal(Object.keys(skippedGraph.nodes).length, 8)
    assert.equal(skippedGraph.links.length, 6)
    assert.equal(skippedGraph.links.find(link => link.id === 'result-input').targetId, 'delivery')
    assert.equal(Object.values(skippedGraph.nodes).filter(node => node.type === 'agent').every(node => node.provider === 'fake' && node.model === 'agent-v1' && Object.values(node.prompts).every(prompt => prompt.content.length > 0)), true)
    assert.equal(saved.artifacts.find(artifact => artifact.nodeId === 'result').files.length, 2)
    assert.ok(saved.artifacts.find(artifact => artifact.nodeId === 'delivery').content.startsWith('# 本周客户回访简报'))
    await waitFor("document.querySelector('.react-flow__node.selected')?.dataset.id === 'delivery'")
    assert.equal(await evaluate("document.querySelectorAll('.flow-node.is-running').length"), 0)
    await capture('skipped-complete')
    window.reload()
    await waitFor("Boolean(document.querySelector('.canvas-heading')) && !document.querySelector('.tutorial-spotlight')")
    await click('[aria-label="客户回访 · 周会简报教程菜单"]')
    await click('.resource-menu [role="menuitem"].is-danger'); await click('.resource-menu__confirm .is-danger'); await pause(600)
    assert.equal(saved.projects.some(item => item.id === project.id), false)
    assert.equal(invocationCalls, 0)
    assert.deepEqual(errors, [])
    console.log('Tutorial UI passed: tutorial-only catalog, delayed generation, prompt inspection, ordered node playback, final brief reading, Fake conversion with files preserved, icon actions, cancellation and replay; 0 model calls.')
  } catch (error) {
    console.error(error)
    console.error(errors)
    if (window) { const directory = resolve(__dirname, '../../../artifacts/tutorial'); mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, 'failure.png'), (await window.webContents.capturePage()).toPNG()); console.error(await window.webContents.executeJavaScript('document.body.innerText.slice(-6500)')); }
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
    window?.destroy()
    app.exit(process.exitCode ?? 0)
  }
}
