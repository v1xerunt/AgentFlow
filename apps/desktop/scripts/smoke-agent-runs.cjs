const assert = require('node:assert/strict')
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

const temporaryRoot = resolve(tmpdir())
if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-agent-runs-'))
  try {
    const child = spawnSync(require('electron'), [__filename, userData], { stdio: 'inherit', timeout: 60000, windowsHide: true })
    if (child.error) throw child.error
    process.exitCode = child.status ?? 1
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-agent-runs-')) rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
} else void run()

async function run() {
  const { app, BrowserWindow, ipcMain } = require('electron')
  app.setPath('userData', process.argv[2])
  const now = new Date().toISOString()
  const agent = (name, x) => ({ type: 'agent', name, provider: 'openai', model: 'gpt-5', prompts: Object.fromEntries(['system', 'input', 'output'].map(key => [key, { content: key === 'system' ? name : '', customized: false, locked: false }])), position: { x, y: 0 } })
  const definition = { version: 1, name: 'Review Flow', goal: 'Prepare a weekly brief', nodes: {
    input: { type: 'input', name: 'Brief', items: [{ id: 'brief', name: 'Brief', kind: 'text', mode: 'text', content: 'Weekly notes' }], position: { x: 0, y: 0 } },
    first: agent('First', 330), second: agent('Second', 660), third: agent('Third', 990)
  }, links: [
    { id: 'one', type: 'input', sourceId: 'input', targetId: 'first' },
    { id: 'two', type: 'pass', sourceId: 'first', targetId: 'second' },
    { id: 'three', type: 'pass', sourceId: 'second', targetId: 'third' }
  ] }
  const artifacts = Object.keys(definition.nodes).map(nodeId => ({ id: `${nodeId}-old`, runId: 'old-run', nodeId, version: 1, content: `Previous ${nodeId} output`, parentArtifacts: [], sourceInputs: ['input'], createdAt: now, projectId: 'run-project', graphId: 'run-flow', origin: 'run' }))
  let saved = { schemaVersion: 1, projects: [{ id: 'run-project', name: 'Run controls', workspace: { mode: 'directory', rootPath: join(process.argv[2], 'project') }, createdAt: now, updatedAt: now }], graphs: [{ id: 'run-flow', projectId: 'run-project', definition, revision: 1, createdAt: now, updatedAt: now }], artifacts, workingArtifactIds: { 'run-flow': Object.fromEntries(artifacts.map(a => [a.nodeId, a.id])) }, tutorial: { version: 2, status: 'skipped', step: 0, graphId: '', tool: 'codex' } }
  const snapshot = { providers: [], agentTools: [], subscriptions: [], catalog: [{ id: 'openai', name: 'OpenAI', connector: 'model', configured: true, models: [{ providerId: 'openai', providerName: 'OpenAI', modelId: 'gpt-5', modelName: 'gpt-5', connector: 'model', configured: true, parameters: {} }] }], promptAutofill: { providerId: '', model: '' }, flowGeneration: { providerId: '', model: '' }, chatHistoryMaxChars: 200000 }
  let window, language = 'zh'
  const requests = [], pending = [], errors = []
  const timeout = setTimeout(() => { console.error('Agent run smoke timed out'); window?.destroy(); app.exit(1) }, 55000)
  try {
    await app.whenReady()
    ipcMain.handle('agentflow:language:get', () => ({ preference: language, systemLanguages: ['zh-CN'] }))
    ipcMain.handle('agentflow:workspace:load', () => saved)
    ipcMain.handle('agentflow:workspace:save', (_event, value) => { saved = value })
    for (const channel of ['agentflow:workspace:ensure-temporary', 'agentflow:workspace:save-project-files', 'agentflow:workspace:discard-temporary', 'agentflow:llm:cancel']) ipcMain.handle(channel, () => undefined)
    ipcMain.handle('agentflow:library:load', () => null)
    for (const channel of ['agentflow:llm:settings:load', 'agentflow:llm:tools:detect', 'agentflow:llm:subscriptions:refresh']) ipcMain.handle(channel, () => snapshot)
    ipcMain.handle('agentflow:llm:invoke', (_event, request) => {
      requests.push(request.messages.find(message => message.role === 'system')?.content)
      return new Promise(resolve => pending.push(content => resolve({ content, model: request.model, providerId: request.providerId })))
    })
    window = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { preload: join(__dirname, '../out/preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: true } })
    window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message) })
    window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }))
    const evaluate = code => window.webContents.executeJavaScript(code)
    const pause = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms))
    const wait = async condition => { for (let i = 0; i < 150; i++) { if (await condition()) return; await pause(40) } throw new Error(`Timed out: ${condition}`) }
    const waitFor = code => wait(() => evaluate(code))
    const click = async selector => { await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`); await evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('click', { bubbles: true }))`); await pause() }
    const clickText = async (selector, text) => {
      const query = `[...document.querySelectorAll(${JSON.stringify(selector)})].find(el => el.textContent.trim() === ${JSON.stringify(text)})`
      await waitFor(`Boolean(${query})`); await evaluate(`${query}.click()`); await pause()
    }
    const node = id => `.react-flow__node[data-id="${id}"]`
    const status = id => evaluate(`document.querySelector('${node(id)} .status-icon')?.getAttribute('aria-label')`)
    const finish = async content => { await wait(() => pending.length > 0); pending.shift()(content); await pause() }
    const idle = () => waitFor("!document.querySelector('[data-run-scope=upstream]').disabled")
    const open = async () => { await clickText('.project-row__main', 'Run controls'); await clickText('.graph-row__main', 'Review Flow'); await click(node('second')) }
    await window.loadFile(join(__dirname, '../out/renderer/index.html'))
    await open()
    assert.equal(await evaluate("document.querySelectorAll('.react-flow__node .status-icon.is-complete').length"), 4)
    await click('[data-run-scope=upstream]')
    await finish('Fresh first'); await finish('Fresh second'); await idle()
    assert.deepEqual(requests.splice(0), ['First', 'Second'])
    assert.equal(await status('third'), '已完成')
    await click('[data-run-scope=downstream]')
    await finish('Revised second'); await finish('Revised third'); await idle()
    assert.deepEqual(requests.splice(0), ['Second', 'Third'])

    await clickText('button', '运行 Flow'); await click('.flow-run-confirm')
    await wait(() => pending.length > 0)
    assert.equal(await status('first'), '运行中')
    for (const id of ['second', 'third']) assert.equal(await status(id), '等待中')
    assert.equal(await evaluate("Boolean(document.querySelector('.inspector .status-icon.is-complete'))"), false)
    await finish('Current first'); await finish(' \n '); await idle()
    assert.deepEqual(requests.splice(0), ['First', 'Second'], 'Empty response must stop before Third')
    assert.equal(await status('second'), '运行失败')
    assert.equal(await status('third'), '已停止')
    await wait(() => saved.artifacts.some(a => a.content === 'Revised third'))
    assert.equal(saved.artifacts.some(a => a.nodeId === 'second' && !a.content.trim()), false)

    for (const locale of ['zh', 'en']) {
      if (locale !== language) { language = locale; await window.reload(); await pause(500); await open() }
      const labels = locale === 'zh' ? ['打开聊天', '单独运行', '运行全部上游', '运行全部下游', '保存到 Agent 库'] : ['Open chat', 'Run Agent', 'Run all upstream', 'Run all downstream', 'Save to Agent library']
      assert.deepEqual(await evaluate("[...document.querySelectorAll('.agent-primary-actions button')].map(el => el.textContent.trim())"), labels)
      for (const [width, height] of [[1440, 900], [1040, 720]]) {
        window.setSize(width, height); await pause(300)
        assert.equal(await evaluate("(() => { const panel = document.querySelector('.inspector').getBoundingClientRect(); const buttons = [...document.querySelectorAll('.agent-primary-actions button')]; return buttons.every(el => el.getBoundingClientRect().right <= panel.right && el.scrollWidth <= el.clientWidth) && buttons[4].getBoundingClientRect().top >= buttons[3].getBoundingClientRect().bottom; })()"), true, 'Actions fit; save follows both run buttons')
        writeFileSync(join(__dirname, `../out/agent-runs-${locale}-${width}.png`), (await window.webContents.capturePage()).toPNG())
      }
    }
    assert.deepEqual(errors, [])
    console.log('Agent runs smoke passed: upstream/downstream scopes, all-node status reset, empty-response interruption, artifact history, save button order, Chinese/English and 1440/1040px layouts.')
    clearTimeout(timeout); window.destroy(); app.exit(0)
  } catch (error) { console.error(error); clearTimeout(timeout); window?.destroy(); app.exit(1) }
}
