const assert = require('node:assert/strict')
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

const temporaryRoot = resolve(tmpdir())
if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-subscription-ui-'))
  try {
    const child = spawnSync(require('electron'), [__filename, userData], { stdio: 'inherit', timeout: 30_000, windowsHide: true })
    if (child.error) throw child.error
    process.exitCode = child.status ?? 1
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-subscription-ui-')) rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
} else {
  void run()
}

async function run() {
  const { app, BrowserWindow, ipcMain } = require('electron')
  const userData = process.argv[2]
  assert.ok(userData && dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-subscription-ui-'))
  app.setPath('userData', userData)
  let window
  let connectCalls = 0
  let providerTests = 0
  let savedWorkspace
  let invocationCalls = 0
  const revealed = []
  const tool = { id: 'agent-tool:claude-code', name: 'Claude Code', command: 'claude', installed: true, enabled: true, added: true, models: ['opus', 'sonnet', 'haiku', 'opus[1m]', 'sonnet[1m]'], disabledModels: [], reasoningEfforts: [], modelReasoningEfforts: { opus: ['low', 'medium', 'high'], sonnet: ['low', 'medium', 'high'], 'opus[1m]': ['low', 'medium', 'high'], 'sonnet[1m]': ['low', 'medium', 'high'] }, reasoningOverrideSupported: true }
  const modelLabels = { 'deepseek-chat': '快速模式', 'deepseek-reasoner': '专家模式' }
  const anthropic = { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', added: true, enabled: true, custom: false, hasApiKey: true, manualModels: [], discoveredModels: [] }
  const connector = {
    id: 'subscription:deepseek-web', name: 'DeepSeek（Web Bridge）', accountName: 'DeepSeek',
    description: '通过专用浏览器登录 DeepSeek 网页账户。', quotaDescription: '使用 DeepSeek 网页服务，无需 API 密钥。实验性连接可能因网页协议或账号风控变化而失效。',
    transport: 'web', experimental: true, riskAccepted: false, status: 'needs-login', installed: false, connected: false, systemToolInstalled: false, models: ['deepseek-chat', 'deepseek-reasoner']
  }
  const snapshot = { providers: [anthropic], agentTools: [tool], subscriptions: [connector], catalog: [], promptAutofill: { providerId: '', model: '' }, flowGeneration: { providerId: '', model: '' }, chatHistoryMaxChars: 200000 }
  const timeout = setTimeout(() => { console.error('Subscription UI smoke timed out'); window?.destroy(); app.exit(1) }, 20_000)
  try {
    await app.whenReady()
    ipcMain.handle('agentflow:language:get', () => ({ preference: 'zh', systemLanguages: ['zh-CN'] }))
    ipcMain.handle('agentflow:workspace:load', () => ({ schemaVersion: 1, projects: [], graphs: [] }))
    ipcMain.handle('agentflow:workspace:save', () => undefined)
    ipcMain.handle('agentflow:workspace:save-project-files', (_event, state, projectId) => {
      assert.ok(state.projects.some(project => project.id === projectId))
      savedWorkspace = state
    })
    ipcMain.handle('agentflow:workspace:reveal-file', (_event, binding, path) => {
      assert.ok(savedWorkspace?.artifacts.length, 'Output must be saved before reveal')
      assert.equal(binding.mode, 'temporary')
      assert.match(path, /^\.flow\//)
      revealed.push(path)
    })
    ipcMain.handle('agentflow:llm:invoke', (_event, request) => {
      invocationCalls += 1
      return { content: '# UI smoke output', providerId: request.providerId, model: request.model,
        ...(request.outputDirectory ? { files: [{ name: 'answer.md', relativePath: request.outputDirectory.path + '/answer.md', mode: 'text', content: '# Result', mimeType: 'text/markdown', size: 8 }] } : {}) }
    })
    ipcMain.handle('agentflow:workspace:ensure-temporary', () => undefined)
    ipcMain.handle('agentflow:library:load', () => null)
    ipcMain.handle('agentflow:llm:settings:load', () => snapshot)
    ipcMain.handle('agentflow:llm:settings:save', (_event, input) => {
      const provider = input.providers.find(provider => provider.id === 'anthropic')
      anthropic.anthropicWorkspaceId = provider?.anthropicWorkspaceId?.trim() || undefined
      anthropic.disabledModels = provider?.disabledModels ?? []
      const updatedTool = input.agentTools.find(candidate => candidate.id === tool.id)
      if (updatedTool) Object.assign(tool, updatedTool)
      return snapshot
    })
    const testProvider = (_event, id) => {
      assert.equal(id, 'anthropic')
      providerTests += 1
      if (!anthropic.anthropicWorkspaceId) throw new Error('Anthropic 请求失败 (400)：此 API 密钥需要指定工作区。请在此服务商的“Anthropic 工作区 ID”中填写 Claude 控制台的设置 → 工作区中的 ID（wrkspc_…），然后重新测试连接。')
      assert.equal(anthropic.anthropicWorkspaceId, 'wrkspc_test123')
      anthropic.discoveredModels = ['claude-sonnet-5', 'claude-opus-5']
      return snapshot
    }
    ipcMain.handle('agentflow:llm:provider:test', testProvider)
    ipcMain.handle('agentflow:llm:models:refresh', testProvider)
    ipcMain.handle('agentflow:llm:tools:detect', () => snapshot)
    ipcMain.handle('agentflow:llm:subscriptions:refresh', () => snapshot)
    ipcMain.handle('agentflow:llm:subscriptions:connect', (_event, id, options) => {
      assert.equal(id, connector.id)
      if (!connector.riskAccepted) assert.equal(options?.acceptExperimentalRisk, true)
      connectCalls += 1
      Object.assign(connector, { connected: true, riskAccepted: true, status: 'connected' })
      snapshot.catalog = [{
        id: connector.id, name: connector.name, connector: 'subscription', configured: true,
        models: connector.models.map(modelId => ({ providerId: connector.id, providerName: connector.name, modelId, modelName: modelLabels[modelId], connector: 'subscription', configured: true, parameters: {} }))
      }]
      return snapshot
    })
    ipcMain.handle('agentflow:llm:subscriptions:disconnect', () => {
      Object.assign(connector, { connected: false, status: 'needs-login' })
      snapshot.catalog = []
      return snapshot
    })
    window = new BrowserWindow({ width: 1200, height: 880, show: false, webPreferences: { preload: join(__dirname, '../out/preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: Boolean(process.env.AGENTFLOW_CAPTURE_PROVIDER_MODELS || process.env.AGENTFLOW_CAPTURE_CHAT_ACTIONS) } })
    if (process.env.AGENTFLOW_CAPTURE_CHAT_ACTIONS) window.webContents.on('paint', () => {})
    await window.loadFile(join(__dirname, '../out/renderer/index.html'))
    let browserStep = 0
    const evaluate = window.webContents.executeJavaScript.bind(window.webContents)
    window.webContents.executeJavaScript = async (...args) => {
      const step = ++browserStep
      try { return await evaluate(...args) } catch (error) { throw new Error(`Browser scenario ${step}: ${error.message}`) }
    }
    const riskState = await window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (read) => { for (let i = 0; i < 200; i++) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 25)); } throw new Error('UI did not become ready'); };
      (await waitFor(() => document.querySelector('.sidebar-settings'))).click();
      (await waitFor(() => [...document.querySelectorAll('.settings-navigation button')].find(button => button.querySelector('strong')?.textContent === '订阅账户'))).click();
      (await waitFor(() => [...document.querySelectorAll('.subscription-row button')].find(button => button.textContent === '登录 DeepSeek' && !button.disabled))).click();
      const dialog = await waitFor(() => document.querySelector('.subscription-risk-dialog[open]'));
      return { modal: dialog.matches(':modal'), copy: dialog.textContent, focus: document.activeElement?.textContent, overflow: dialog.scrollWidth > dialog.clientWidth };
    })()`)
    assert.equal(connectCalls, 0)
    assert.equal(riskState.modal, true)
    assert.equal(riskState.overflow, false)
    assert.equal(riskState.focus, '取消')
    assert.match(riskState.copy, /限流、账号限制或封禁/)
    if (!process.env.AGENTFLOW_CAPTURE_PROVIDER_MODELS) writeFileSync(join(__dirname, '../out/subscription-risk-smoke.png'), (await window.webContents.capturePage()).toPNG())
    await window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (read) => { for (let i = 0; i < 200; i++) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 25)); } throw new Error('UI did not settle'); };
      document.querySelector('.subscription-risk-dialog .quiet-button').click();
      await waitFor(() => !document.querySelector('.subscription-risk-dialog'));
      if (!document.querySelector('.settings-surface')) throw new Error('Cancel closed settings');
      [...document.querySelectorAll('.subscription-row button')].find(button => button.textContent === '登录 DeepSeek').click();
      (await waitFor(() => document.querySelector('.subscription-risk-dialog[open] .primary-button'))).click();
      (await waitFor(() => [...document.querySelectorAll('.subscription-row button')].find(button => button.textContent === '断开' && !button.disabled))).click();
      (await waitFor(() => [...document.querySelectorAll('.subscription-row button')].find(button => button.textContent === '登录 DeepSeek' && !button.disabled))).click();
      await waitFor(() => [...document.querySelectorAll('.subscription-row button')].some(button => button.textContent === '断开' && !button.disabled));
      if (document.querySelector('.subscription-risk-dialog')) throw new Error('Accepted risk was not reused');
    })()`)
    assert.equal(connectCalls, 2)
    const libraryState = await window.webContents.executeJavaScript(`(async () => {
      const modelLabels = ${JSON.stringify(modelLabels)};
      const waitFor = async (read, label) => { for (let i = 0; i < 200; i++) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 25)); } throw new Error('UI did not settle: ' + label); };
      document.querySelector('.settings-back').click();
      const openLibrary = async () => {
        (await waitFor(() => [...document.querySelectorAll('.node-library-toolbar button')].find(button => button.textContent === '模型'), 'model toolbar')).click();
        await waitFor(() => document.querySelector('.node-library-panel'), 'model library');
      };
      const findModel = model => [...document.querySelectorAll('.node-library-item')].find(button => button.querySelector('strong')?.textContent === modelLabels[model]);
      const nodes = () => [...document.querySelectorAll('[data-flow-node-kind="agent"]')];
      const checkAdded = async (count, model) => {
        await waitFor(() => nodes().length === count, 'added ' + model);
        await waitFor(() => nodes().some(node => node.querySelector('button[aria-label$=" 模型"]')?.textContent === modelLabels[model]), 'node model ' + model);
        await waitFor(() => !document.querySelector('.node-library-panel'), 'library closed');
      };
      const initialCount = nodes().length;
      await openLibrary();
      const labels = [...document.querySelectorAll('.node-library-item strong')].map(item => item.textContent);
      const panel = document.querySelector('.node-library-panel');
      const overflow = panel.scrollWidth > panel.clientWidth;
      (await waitFor(() => findModel('deepseek-chat'), 'chat entry')).click();
      await checkAdded(initialCount + 1, 'deepseek-chat');
      await openLibrary();
      (await waitFor(() => findModel('deepseek-reasoner'), 'reasoner entry')).click();
      await checkAdded(initialCount + 2, 'deepseek-reasoner');
      const payloads = [];
      for (const [index, model] of ['deepseek-chat', 'deepseek-reasoner'].entries()) {
        await openLibrary();
        const transfer = new DataTransfer();
        findModel(model).dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
        payloads.push(JSON.parse(transfer.getData('application/x-agentflow-library')));
        const canvas = document.querySelector('.canvas-frame');
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
        await checkAdded(initialCount + 3 + index, model);
      }
      const rejectChoice = async (choice, message) => {
        const transfer = new DataTransfer();
        transfer.setData('application/x-agentflow-library', JSON.stringify(choice));
        document.querySelector('.canvas-frame').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        await waitFor(() => document.querySelector('.notice--error')?.textContent.includes(message), 'invalid model notice');
        if (nodes().length !== initialCount + 4) throw new Error('Invalid choice created a node');
      };
      await rejectChoice({ kind: 'model', provider: 'subscription:deepseek-web', model: 'unavailable-model' }, '请重新选择');
      await rejectChoice({ kind: 'model', provider: 'subscription:disconnected', model: 'deepseek-chat' }, '请在设置中重新连接');
      return { labels, overflow, payloads, added: nodes().length - initialCount, addedModels: nodes().slice(initialCount).map(node => node.querySelector('button[aria-label$=" 模型"]')?.textContent) };
    })()`)
    assert.deepEqual(libraryState.labels, ['快速模式', '专家模式'])
    assert.equal(libraryState.overflow, false)
    assert.equal(libraryState.added, 4)
    assert.deepEqual(libraryState.addedModels, [...connector.models, ...connector.models].map(model => modelLabels[model]))
    assert.deepEqual(libraryState.payloads, connector.models.map(model => ({ kind: 'model', provider: connector.id, model })))
    const workspaceState = await window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (read, label) => { for (let i = 0; i < 200; i++) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 25)); } throw new Error('UI did not settle: ' + label); };
      document.querySelector('.sidebar-settings').click();
      (await waitFor(() => [...document.querySelectorAll('.settings-navigation button')].find(button => button.querySelector('strong')?.textContent === 'API 服务商'), 'provider settings')).click();
      const row = await waitFor(() => [...document.querySelectorAll('.settings-list-row')].find(row => row.querySelector('strong')?.textContent === 'Anthropic'), 'Anthropic row');
      const disclosure = row.querySelector('.settings-row-disclosure');
      if (disclosure.getAttribute('aria-expanded') !== 'true') disclosure.click();
      const input = await waitFor(() => document.querySelector('[aria-label="Anthropic 工作区 ID"]'), 'workspace input');
      const testButton = () => [...row.querySelectorAll('button')].find(button => button.textContent === '测试连接' && !button.disabled);
      (await waitFor(testButton, 'test button')).click();
      const error = await waitFor(() => row.querySelector('.provider-test-feedback.is-error'), 'missing workspace feedback');
      const missingMessage = error.textContent;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'wrkspc_test123');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await waitFor(() => !row.querySelector('.provider-test-feedback.is-error'), 'old error cleared');
      (await waitFor(testButton, 'retry test')).click();
      await waitFor(() => row.querySelector('.provider-test-feedback.is-success'), 'workspace test succeeded');
      document.querySelector('.settings-back').click();
      await waitFor(() => !document.querySelector('.settings-surface'), 'settings closed');
      document.querySelector('.sidebar-settings').click();
      (await waitFor(() => [...document.querySelectorAll('.settings-navigation button')].find(button => button.querySelector('strong')?.textContent === 'API 服务商'), 'provider settings reopened')).click();
      const reopened = await waitFor(() => [...document.querySelectorAll('.settings-list-row')].find(row => row.querySelector('strong')?.textContent === 'Anthropic'), 'Anthropic reopened');
      if (reopened.querySelector('.settings-row-disclosure').getAttribute('aria-expanded') !== 'true') reopened.querySelector('.settings-row-disclosure').click();
      const restored = await waitFor(() => document.querySelector('[aria-label="Anthropic 工作区 ID"]'), 'restored workspace');
      return { missingMessage, value: restored.value, help: document.getElementById(restored.getAttribute('aria-describedby')).textContent, overflow: reopened.scrollWidth > reopened.clientWidth, inputWidth: restored.clientWidth };
    })()`)
    assert.match(workspaceState.missingMessage, /需要指定工作区/)
    assert.doesNotMatch(workspaceState.missingMessage, /Error invoking remote method/)
    assert.equal(workspaceState.value, 'wrkspc_test123')
    assert.match(workspaceState.help, /设置 → 工作区/)
    assert.equal(workspaceState.overflow, false)
    assert.ok(workspaceState.inputWidth > 400)
    assert.ok(providerTests >= 2)
    const providerListState = await window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (read, label) => { for (let i = 0; i < 200; i++) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 25)); } throw new Error('UI did not settle: ' + label); };
      const row = [...document.querySelectorAll('.settings-list-row')].find(row => row.querySelector('strong')?.textContent === 'Anthropic');
      const disclosure = row.querySelector('.provider-models__disclosure');
      const initiallyCollapsed = disclosure.getAttribute('aria-expanded') === 'false';
      disclosure.click();
      await waitFor(() => row.querySelector('.settings-model-list'), 'provider models expanded');
      const switches = () => [...row.querySelectorAll('.provider-models input[type=checkbox]')];
      const labels = [...row.querySelectorAll('.provider-models li strong')].map(item => item.textContent);
      const allInitiallyEnabled = switches().every(input => input.checked);
      const control = label => [...row.querySelectorAll('.provider-models button')].find(button => button.textContent === label);
      control('全部关闭').click();
      await waitFor(() => switches().every(input => !input.checked), 'API models all off');
      const allOffCount = switches().filter(input => input.checked).length;
      control('全部启用').click();
      await waitFor(() => switches().every(input => input.checked), 'API models all on');
      switches()[1].click();
      await waitFor(() => switches().filter(input => input.checked).length === 1, 'API model individually off');
      disclosure.click();
      await waitFor(() => document.getElementById(disclosure.getAttribute('aria-controls')).hidden, 'models collapsed');
      const listUnmounted = !row.querySelector('.settings-model-list');
      disclosure.click();
      await waitFor(() => row.querySelector('.settings-model-list'), 'models reopened');
      const statePreserved = switches()[0].checked && !switches()[1].checked;
      row.querySelector('.provider-models').scrollIntoView({ block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 650));
      return { initiallyCollapsed, labels, allInitiallyEnabled, allOffCount, listUnmounted, statePreserved, overflow: row.scrollWidth > row.clientWidth };
    })()`)
    assert.equal(providerListState.initiallyCollapsed, true)
    assert.deepEqual(providerListState.labels, ['claude-sonnet-5', 'claude-opus-5'])
    assert.equal(providerListState.allInitiallyEnabled, true)
    assert.equal(providerListState.allOffCount, 0)
    assert.equal(providerListState.listUnmounted, true)
    assert.equal(providerListState.statePreserved, true)
    assert.equal(providerListState.overflow, false)
    assert.deepEqual(anthropic.disabledModels, ['claude-opus-5'])
    if (process.env.AGENTFLOW_CAPTURE_PROVIDER_MODELS) writeFileSync(join(__dirname, '../out/provider-models-smoke.png'), (await window.webContents.capturePage()).toPNG())
    const modelListState = await window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (read, label) => { for (let i = 0; i < 200; i++) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 25)); } throw new Error('UI did not settle: ' + label); };
      [...document.querySelectorAll('.settings-navigation button')].find(button => button.querySelector('strong')?.textContent === '本机 Agent 工具').click();
      const row = await waitFor(() => [...document.querySelectorAll('.settings-list-row')].find(row => row.querySelector('strong')?.textContent === 'Claude Code'), 'Claude row');
      if (row.querySelector('.settings-row-disclosure').getAttribute('aria-expanded') !== 'true') row.querySelector('.settings-row-disclosure').click();
      await waitFor(() => row.querySelector('.settings-model-list'), 'model list');
      const switches = () => [...row.querySelectorAll('.settings-model-list input[type=checkbox]')];
      const allInitiallyEnabled = switches().every(input => input.checked);
      const count = switches().length;
      const modelLabels = [...row.querySelectorAll('.settings-model-list li strong')].map(node => node.textContent);
      const control = label => [...row.querySelectorAll('button')].find(button => button.textContent === label);
      control('全部关闭').click();
      await waitFor(() => switches().every(input => !input.checked), 'all disabled');
      const noDefaultPicker = !row.querySelector('[aria-label="Claude Code 默认模型"]');
      switches()[2].click();
      await waitFor(() => switches().filter(input => input.checked).length === 1, 'one enabled');
      control('全部启用').click();
      await waitFor(() => switches().every(input => input.checked), 'all enabled');
      switches()[1].click();
      await waitFor(() => switches().filter(input => input.checked).length === count - 1, 'individual disabled');
      await new Promise(resolve => setTimeout(resolve, 650));
      const result = { allInitiallyEnabled, count, modelLabels, noDefaultPicker, freeTextCount: row.querySelectorAll('.tool-capability-settings input:not([type=checkbox]), .tool-capability-settings textarea').length, overflow: row.scrollWidth > row.clientWidth };
      document.querySelector('.settings-back').click();
      await waitFor(() => !document.querySelector('.settings-surface'), 'closed');
      return result;
    })()`)
    assert.equal(modelListState.allInitiallyEnabled, true)
    assert.equal(modelListState.count, 6)
    assert.equal(modelListState.noDefaultPicker, true)
    assert.equal(modelListState.freeTextCount, 0)
    assert.equal(modelListState.overflow, false)
    assert.deepEqual(tool.disabledModels, ['opus'])
    const runState = await window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (read, label) => { for (let i = 0; i < 200; i++) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 25)); } throw new Error('UI did not settle: ' + label); };
      const run = () => [...document.querySelectorAll('.agent-primary-actions button')].find(button => button.textContent === '单独运行');
      const button = await waitFor(run, 'run button');
      const emptyDisabled = button.disabled;
      const disabledTitle = button.title;
      const input = [...document.querySelectorAll('.prompt-field')].find(field => field.querySelector('.prompt-field__heading > span')?.textContent.startsWith('输入提示词')).querySelector('textarea');
      const fill = value => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); };
      fill('   ');
      await new Promise(resolve => setTimeout(resolve, 30));
      const whitespaceDisabled = run().disabled;
      fill('Return a short answer');
      await waitFor(() => !run().disabled, 'enabled run');
      run().click();
      await waitFor(() => document.querySelector('.output-preview-block'), 'output');
      const removedCopyAbsent = !document.querySelector('.inspector').textContent.includes('Working State 自动保存');
      document.querySelector('.output-preview-block button[title="在资源管理器中打开"]').click();
      (await waitFor(() => document.querySelector('.flow-node__top-actions button[aria-label^="在资源管理器中打开"]'), 'card reveal')).click();
      return { emptyDisabled, whitespaceDisabled, disabledTitle, removedCopyAbsent };
    })()`)
    assert.equal(runState.emptyDisabled, true)
    assert.equal(runState.whitespaceDisabled, true)
    assert.match(runState.disabledTitle, /添加输入内容/)
    assert.equal(runState.removedCopyAbsent, true)
    for (let i = 0; i < 100 && revealed.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(invocationCalls, 1)
    assert.equal(revealed.length, 2)
    assert.equal(revealed[0], revealed[1])
    const chatState = await window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (read) => { for (let i=0;i<200;i++) { const value=read(); if(value)return value; await new Promise(resolve=>setTimeout(resolve,20)); } throw new Error('Chat actions did not settle'); };
      document.querySelector('.open-chat-button').click();
      const composer = await waitFor(()=>document.querySelector('.composer textarea'));
      const text = '只复制这一条消息\\n保留换行与 **Markdown**';
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(composer,text);
      composer.dispatchEvent(new Event('input',{bubbles:true}));
      (await waitFor(()=>!document.querySelector('.send-button')?.disabled&&document.querySelector('.send-button'))).click();
      const user = await waitFor(()=>[...document.querySelectorAll('.message--user')].find(message=>message.querySelector('.message__content')?.textContent===text));
      const assistant = await waitFor(()=>document.querySelectorAll('.message--assistant .message__actions').length && [...document.querySelectorAll('.message--assistant')].at(-1)?.querySelector('.message__actions')?.closest('.message'));
      await waitFor(()=>!document.querySelector('.send-button')?.classList.contains('is-loading'));
      const writes=[];
      let rejectCopy=false;
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{if(rejectCopy)throw new Error('Clipboard denied');writes.push(value)}}});
      const userCopy=user.querySelector('[aria-label="复制消息"]');
      userCopy.click();
      await waitFor(()=>user.querySelector('[role=status]')?.textContent==='已复制');
      const assistantCopy=assistant.querySelector('[aria-label="复制消息"]');
      assistantCopy.click();
      await waitFor(()=>assistant.querySelector('[role=status]')?.textContent==='已复制');
      rejectCopy=true;
      assistantCopy.click();
      await waitFor(()=>assistant.querySelector('[role=status]')?.textContent==='复制失败，请重试');
      rejectCopy=false;
      assistantCopy.click();
      await waitFor(()=>assistant.querySelector('[role=status]')?.textContent==='已复制');
      const output=assistant.querySelector('[aria-label="将截至此处的完整对话设为结果输出"]');
      const distinctIcon=Boolean(output.querySelector('.lucide-file-output'))&&!output.querySelector('.lucide-copy,.lucide-files');
      const beforePublish=writes.length;
      output.click();
      await waitFor(()=>document.body.textContent.includes('截至此处的完整对话已设为结果输出'));
      assistantCopy.focus();
      assistant.scrollIntoView({block:'center'});
      return {text,writes,distinctIcon,outputDidNotCopy:writes.length===beforePublish,overflow:assistant.scrollWidth>assistant.clientWidth};
    })()`)
    assert.deepEqual(chatState.writes, [chatState.text, '# UI smoke output', '# UI smoke output'])
    assert.equal(chatState.distinctIcon, true)
    assert.equal(chatState.outputDidNotCopy, true)
    assert.equal(chatState.overflow, false)
    if (process.env.AGENTFLOW_CAPTURE_CHAT_ACTIONS) {
      await new Promise(resolve=>{window.webContents.once('paint',resolve);window.webContents.invalidate()})
      await new Promise(resolve=>setTimeout(resolve,200))
      writeFileSync(join(__dirname,'../out/chat-actions-smoke.png'),(await window.webContents.capturePage()).toPNG())
    }
    console.log('Connection, Agent and chat UI smoke passed: consent, provider settings, model toggles, empty-input guard, output reveal, per-message copy/retry and transcript output icon.')
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
    window?.destroy()
    app.exit(process.exitCode ?? 0)
  }
}
