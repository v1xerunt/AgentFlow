const assert = require('node:assert/strict')
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

const temporaryRoot = resolve(tmpdir())
if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-node-files-'))
  try {
    const child = spawnSync(require('electron'), [__filename, userData], { stdio: 'inherit', timeout: 60000, windowsHide: true })
    if (child.error) throw child.error
    process.exitCode = child.status ?? 1
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-node-files-')) rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
} else void run()

async function run() {
  const { app, BrowserWindow, ipcMain } = require('electron')
  app.setPath('userData', process.argv[2])
  const now = new Date().toISOString()
  const agent = (name, x, y) => ({ type: 'agent', name, provider: 'openai', model: 'gpt-5', prompts: Object.fromEntries(['system', 'input', 'output'].map(key => [key, { content: '', customized: false, locked: false }])), position: { x, y } })
  const definition = { version: 1, name: '文件操作', goal: '', nodes: {
    owner: { ...agent('Owner', 0, 0), provider: 'agent-tool:codex' },
    result: { type: 'output', name: 'Result', ownerAgentId: 'owner', directory: '.flow/agent-results/owner', note: '', extractText: true, position: { x: 300, y: 0 } },
    target: agent('下游', 610, 0),
    input: { type: 'input', name: '输入材料', items: [{ id: 'input-a', name: 'first.md', kind: 'file', mode: 'text', content: 'first' }, { id: 'input-b', name: 'second.md', kind: 'file', mode: 'text', content: 'second' }], position: { x: 0, y: 300 } }
  }, links: [{ id: 'result-target', type: 'input', sourceId: 'result', targetId: 'target' }] }
  const artifact = { id: 'result-v1', runId: 'previous-run', nodeId: 'result', version: 1, content: 'report.md\nnotes.md\nchart.png', parentArtifacts: [], sourceInputs: [], createdAt: now, projectId: 'files-project', graphId: 'files-flow', origin: 'run', files: [
    { name: 'report.md', relativePath: 'report.md', mode: 'text', mimeType: 'text/markdown', size: 20, content: '# Report\nPublic report' },
    { name: 'notes.md', relativePath: 'notes.md', mode: 'text', mimeType: 'text/markdown', size: 20, content: '# Notes\nPrivate notes' },
    { name: 'chart.png', relativePath: 'chart.png', mode: 'attachment', mimeType: 'image/png', size: 1, dataBase64: 'AA==' }
  ] }
  let saved = { schemaVersion: 1, projects: [{ id: 'files-project', name: '文件测试', workspace: { mode: 'directory', rootPath: join(process.argv[2], 'project') }, createdAt: now, updatedAt: now }], graphs: [{ id: 'files-flow', projectId: 'files-project', definition, revision: 1, createdAt: now, updatedAt: now }], artifacts: [artifact], workingArtifactIds: { 'files-flow': { result: artifact.id } }, tutorial: { version: 2, status: 'skipped', step: 0, graphId: '', tool: 'codex' } }
  const snapshot = { providers: [], agentTools: [], subscriptions: [], catalog: [{ id: 'openai', name: 'OpenAI', connector: 'model', configured: true, models: [{ providerId: 'openai', providerName: 'OpenAI', modelId: 'gpt-5', modelName: 'gpt-5', connector: 'model', configured: true, parameters: {} }] }], promptAutofill: { providerId: '', model: '' }, flowGeneration: { providerId: '', model: '' }, chatHistoryMaxChars: 200000 }
  const errors = [], requests = []
  let window
  const timeout = setTimeout(() => { console.error('Node files smoke timed out'); window?.destroy(); app.exit(1) }, 55000)
  try {
    await app.whenReady()
    ipcMain.handle('agentflow:language:get', () => ({ preference: 'zh', systemLanguages: ['zh-CN'] }))
    ipcMain.handle('agentflow:workspace:load', () => saved)
    ipcMain.handle('agentflow:workspace:save', (_event, value) => { saved = value })
    for (const channel of ['agentflow:workspace:ensure-temporary', 'agentflow:workspace:save-project-files', 'agentflow:workspace:discard-temporary', 'agentflow:workspace:open-file', 'agentflow:workspace:reveal-file']) ipcMain.handle(channel, () => undefined)
    ipcMain.handle('agentflow:library:load', () => null)
    for (const channel of ['agentflow:llm:settings:load', 'agentflow:llm:tools:detect', 'agentflow:llm:subscriptions:refresh']) ipcMain.handle(channel, () => snapshot)
    ipcMain.handle('agentflow:llm:invoke', (_event, request) => { requests.push(request); return { content: 'Downstream response', model: 'gpt-5', providerId: 'openai' } })
    window = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { preload: join(__dirname, '../out/preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: true } })
    window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message) })
    window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }))
    const evaluate = code => window.webContents.executeJavaScript(code)
    const pause = (ms = 350) => new Promise(resolve => setTimeout(resolve, ms))
    const waitFor = async code => { for (let i = 0; i < 120; i++) { if (await evaluate(code)) return; await pause(40) } throw new Error(`Timed out: ${code}`) }
    const click = async (selector, shift = false) => {
      await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: ${shift} }))`)
      await pause(60)
    }
    const clickText = async (selector, text) => {
      const query = `[...document.querySelectorAll(${JSON.stringify(selector)})].find(el => el.textContent.trim() === ${JSON.stringify(text)})`
      await waitFor(`Boolean(${query})`); await evaluate(`${query}.click()`); await pause(60)
    }
    const node = id => `.react-flow__node[data-id="${id}"]`
    const row = (id, scope = '.inspector') => `${scope} [data-node-file="${id}"]`
    const savedGraph = () => saved.graphs.find(graph => graph.id === 'files-flow').definition
    const drag = async (selector, ids, drop = true) => {
      const payload = await evaluate(`(() => {
        const source = document.querySelector(${JSON.stringify(selector)});
        const dt = new DataTransfer(); source.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true }));
        const data = dt.getData('application/x-agentflow-node-files');
        if (${drop}) {
          const canvas = document.querySelector('.canvas-frame'); const r = canvas.getBoundingClientRect();
          canvas.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
          canvas.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.right-80, clientY: r.bottom-150 }));
        }
        source.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
        return JSON.parse(data);
      })()`)
      assert.deepEqual(payload.ids, ids)
      await pause(700)
    }
    await window.loadFile(join(__dirname, '../out/renderer/index.html'))
    await clickText('.project-row__main', '文件测试')
    await clickText('.graph-row__main', '文件操作')
    await click(node('result'))
    await click(row('report.md'))
    assert.equal(await evaluate("Boolean(document.querySelector('.document-surface'))"), false, 'Markdown row click selects')
    await click(row('notes.md'), true)
    assert.equal(await evaluate("document.querySelectorAll('.inspector .node-file-row.is-selected').length"), 2)
    await drag(row('report.md'), ['report.md', 'notes.md'], false)
    assert.equal(Object.keys(savedGraph().nodes).length, 4, 'Cancelled drag leaves graph unchanged')
    await click(`${row('report.md')} [data-output-open]`)
    await waitFor("document.querySelector('.document-reading')?.textContent.includes('Public report')")
    await click('[aria-label="返回 Flow"]')
    await click(node('result'))
    for (const name of ['report.md', 'notes.md', 'chart.png']) await click(`.inspector [aria-label="隐藏 ${name}"]`)
    await click(node('target'))
    assert.equal(await evaluate("document.querySelector('.agent-primary-actions .section-action').disabled"), true, 'All hidden Result is empty')
    await click(node('result'))
    await click('.inspector [aria-label="显示 report.md"]')
    await click(node('target'))
    await clickText('.agent-primary-actions button', '单独运行')
    await waitFor("document.querySelector('.inspector')?.textContent.includes('Downstream response')")
    assert.equal(requests.length, 1)
    assert.match(JSON.stringify(requests[0].messages), /Public report/)
    assert.doesNotMatch(JSON.stringify(requests[0].messages), /Private notes|notes.md|chart.png|AA==/)
    await click(node('result'))
    await click(row('report.md')); await click(row('notes.md'), true)
    await drag(row('report.md'), ['report.md', 'notes.md'])
    const moved = Object.entries(savedGraph().nodes).find(([id, value]) => id !== 'input' && value.type === 'input')
    assert.equal(moved[1].items.length, 2)
    assert.equal(moved[1].items.some(item => item.hidden), false)
    assert.deepEqual(savedGraph().nodes.result.fileStates[artifact.id], { 'report.md': 'detached', 'notes.md': 'detached', 'chart.png': 'hidden' })
    await click(node('result'))
    await click(row('chart.png')); await drag(row('chart.png'), ['chart.png'])
    await click(node('target'))
    assert.equal(await evaluate("document.querySelector('.agent-primary-actions .section-action').disabled"), true, 'All detached Result is empty')
    await click(node('input'))
    await click('.inspector [aria-label="隐藏 first.md"]')
    await click('.inspector [aria-label="选择 first.md"]'); await click('.inspector [aria-label="选择 second.md"]', true)
    await drag(row('input-a'), ['input-a', 'input-b'])
    assert.equal(savedGraph().nodes.input.items.length, 0)
    assert.equal(saved.artifacts.find(value => value.id === artifact.id).files.length, 3)
    // Reload through the real preload to validate persistence of selections and moved files.
    window.webContents.reload(); await pause(500)
    await clickText('.project-row__main', '文件测试'); await clickText('.graph-row__main', '文件操作')
    await click(node('result'))
    await waitFor("document.querySelector('.inspector .node-files-empty')?.textContent === '暂无文件'")
    await click(node(moved[0]))
    for (const [width, height] of [[1440, 900], [1040, 720]]) {
      window.setSize(width, height); await pause()
      assert.equal(await evaluate("(() => { const inspector = document.querySelector('.inspector').getBoundingClientRect(); return [...document.querySelectorAll('.inspector .input-item__file-actions')].every(el => el.getBoundingClientRect().right <= inspector.right); })()"), true)
      writeFileSync(join(__dirname, `../out/node-files-${width}.png`), (await window.webContents.capturePage()).toPNG())
    }
    assert.deepEqual(errors, [])
    console.log('Node files smoke passed: explicit Markdown open, Shift selection, cancelled drag, Result/Input moves, empty inputs, filtered model request, persistence, and 1440/1040px windows.')
    clearTimeout(timeout); window.destroy(); app.exit(0)
  } catch (error) { console.error(error); clearTimeout(timeout); window?.destroy(); app.exit(1) }
}
