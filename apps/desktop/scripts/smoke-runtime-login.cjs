const assert = require('node:assert/strict')
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
const temporaryRoot = resolve(tmpdir())

if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-login-ui-'))
  try {
    const child = spawnSync(require('electron'), [__filename, userData], { stdio: 'inherit', timeout: 40_000, windowsHide: true, env: { ...process.env, AGENTFLOW_TEST_NODE: process.execPath } })
    if (child.error) throw child.error
    process.exitCode = child.status ?? 1
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-login-ui-')) rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
} else { void run() }

async function run() {
  const { app, BrowserWindow, ipcMain } = require('electron')
  const userData = process.argv[2]
  assert.ok(dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-login-ui-'))
  app.setPath('userData', userData)
  let window
  let pending
  let sequence = 0
  let submits = 0
  let cancellations = 0
  const tool = { id: 'agent-tool:antigravity', name: 'Antigravity', command: 'agy', installed: true, enabled: true, added: true, models: [], disabledModels: [], reasoningEfforts: [], modelReasoningEfforts: {}, reasoningOverrideSupported: false }
  const subscription = { id: 'subscription:antigravity', name: 'Gemini（Antigravity）', accountName: 'Google', description: '通过官方 Antigravity 命令行连接 Google 账户。', quotaDescription: '消耗 Antigravity / Gemini 账户额度。', transport: 'runtime', experimental: false, riskAccepted: false, status: 'needs-login', installed: true, connected: false, systemToolInstalled: false, models: ['@tool-default'] }
  const claude = { ...subscription, id: 'subscription:claude-code', name: 'Claude（Claude Code）', accountName: 'Claude' }
  const snapshot = { providers: [], agentTools: [tool], subscriptions: [subscription, claude], catalog: [], promptAutofill: { providerId: '', model: '' }, flowGeneration: { providerId: '', model: '' }, chatHistoryMaxChars: 200000 }
  const publish = (phase, message) => pending.sender.send('agentflow:llm:runtime-login:progress', { requestId: pending.id, provider: pending.provider, phase, message, ...(['awaiting-code', 'verifying'].includes(phase) ? { authUrl: pending.provider === 'claude' ? 'https://claude.ai/oauth/authorize?client_id=smoke&state=smoke&code_challenge=smoke' : 'https://accounts.google.com/o/oauth2/v2/auth?client_id=smoke&redirect_uri=https%3A%2F%2Fexample.test&state=smoke' } : {}) })
  const start = (event, provider = 'google') => new Promise(resolve => {
    pending = { id: `smoke-${++sequence}`, sender: event.sender, provider, resolve }
    publish('awaiting-code', `在 ${provider === 'claude' ? 'Claude' : 'Google'} 页面完成登录，将页面显示的授权码粘贴到下方。`)
  })
  const timeout = setTimeout(() => { console.error('Runtime login smoke timed out'); window?.destroy(); app.exit(1) }, 30_000)
  try {
    await app.whenReady()
    ipcMain.handle('agentflow:language:get', () => ({ preference: 'zh', systemLanguages: ['zh-CN'] }))
    // Verify the packaged native module can receive input under Electron's ABI.
    await new Promise((resolve, reject) => {
      const terminal = require('node-pty').spawn(process.env.AGENTFLOW_TEST_NODE, ['-e', 'process.stdout.write("PTY_READY\\n"); process.stdin.once("data", data => { process.stdout.write(data.toString().trim() === "smoke-code" ? "PTY_INPUT_OK\\n" : "PTY_INPUT_BAD\\n"); process.exit(0) })'], { cwd: userData, env: process.env, cols: 120, rows: 30 })
      let output = ''
      let sent = false
      const timer = setTimeout(() => { terminal.kill(); reject(new Error('Native PTY input timed out')) }, 5000)
      terminal.onData(text => {
        output += text
        if (!sent && output.includes('PTY_READY')) { sent = true; terminal.write('smoke-code\r') }
      })
      terminal.onExit(() => { clearTimeout(timer); output.includes('PTY_INPUT_OK') ? resolve() : reject(new Error(`Native PTY did not receive input: ${JSON.stringify(output)}`)) })
    })
    ipcMain.handle('agentflow:workspace:load', () => ({ schemaVersion: 1, projects: [], graphs: [] }))
    ipcMain.handle('agentflow:workspace:save', () => undefined)
    ipcMain.handle('agentflow:workspace:ensure-temporary', () => undefined)
    ipcMain.handle('agentflow:library:load', () => null)
    ipcMain.handle('agentflow:llm:settings:load', () => snapshot)
    ipcMain.handle('agentflow:llm:settings:save', () => snapshot)
    ipcMain.handle('agentflow:llm:tools:detect', () => snapshot)
    ipcMain.handle('agentflow:llm:subscriptions:refresh', () => snapshot)
    ipcMain.handle('agentflow:llm:subscriptions:connect', async (event, id) => { assert.ok([subscription.id, claude.id].includes(id)); await start(event, id === claude.id ? 'claude' : 'google'); return snapshot })
    ipcMain.handle('agentflow:llm:tools:login', async (event, id) => { assert.equal(id, tool.id); await start(event) })
    ipcMain.handle('agentflow:llm:runtime-login:submit', (_event, id, code) => {
      assert.equal(id, pending.id)
      assert.equal(code, 'test-code')
      submits++
      publish('verifying', '正在验证授权码…')
      setTimeout(() => { publish('connected', `${pending.provider === 'claude' ? 'Claude' : 'Google'} 账户已连接，可以返回 Agent 继续运行。`); pending.resolve() }, 100)
    })
    ipcMain.handle('agentflow:llm:runtime-login:cancel', (_event, id) => {
      assert.equal(id, pending.id)
      cancellations++
      publish('cancelled', '已取消 Google 登录。')
      pending.resolve()
    })
    window = new BrowserWindow({ width: 1100, height: 820, show: false, webPreferences: { preload: join(__dirname, '../out/preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true, backgroundThrottling: false } })
    window.webContents.on('paint', () => {})
    await window.loadFile(join(__dirname, '../out/renderer/index.html'))
    const runUi = code => window.webContents.executeJavaScript(`(async () => {
      const waitFor = async (read) => { for (let i=0;i<200;i++) { const value=read(); if(value)return value; await new Promise(resolve=>setTimeout(resolve,20)); } throw new Error('Login UI did not settle'); };
      const findButton = (root, text) => [...(root?.querySelectorAll('button') ?? [])].find(button => button.textContent === text);
      ${code}
    })()`)
    const state = await runUi(`
      (await waitFor(()=>document.querySelector('.sidebar-settings'))).click();
      (await waitFor(()=>[...document.querySelectorAll('.settings-navigation button')].find(button=>button.querySelector('strong')?.textContent==='订阅账户'))).click();
      (await waitFor(()=>findButton(document.querySelector('.settings-surface'), '登录账户'))).click();
      const dialog = await waitFor(()=>document.querySelector('.runtime-login-dialog[open]'));
      const input = dialog.querySelector('input');
      await waitFor(()=>document.activeElement===input);
      return { modal:dialog.matches(':modal'), disabled:dialog.querySelector('[type=submit]').disabled, password:input.type, overflow:dialog.scrollWidth>dialog.clientWidth, active:document.activeElement===input };
    `)
    assert.deepEqual(state, { modal: true, disabled: true, password: 'password', overflow: false, active: true })
    await new Promise(resolve => {
      window.webContents.once('paint', resolve)
      window.webContents.invalidate()
    })
    await new Promise(resolve => setTimeout(resolve, 500))
    writeFileSync(join(__dirname, '../out/runtime-login-smoke.png'), (await window.webContents.capturePage()).toPNG())
    await runUi(`
      const dialog = document.querySelector('.runtime-login-dialog');
      const input = dialog.querySelector('input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'test-code'); input.dispatchEvent(new Event('input', {bubbles:true}));
      (await waitFor(()=>!dialog.querySelector('[type=submit]').disabled && dialog.querySelector('[type=submit]'))).click();
      await waitFor(()=>dialog.textContent.includes('Google 账户已连接'));
      if(dialog.querySelector('input'))throw new Error('Code input was retained after login');
      findButton(dialog,'关闭').click();
      await waitFor(()=>!document.querySelector('.runtime-login-dialog'));
      [...document.querySelectorAll('.settings-navigation button')].find(button=>button.querySelector('strong')?.textContent==='本机 Agent 工具').click();
      (await waitFor(()=>document.querySelector('.settings-row-disclosure'))).click();
      (await waitFor(()=>findButton(document.querySelector('.settings-surface'),'登录 Google'))).click();
      const localDialog = await waitFor(()=>document.querySelector('.runtime-login-dialog[open]'));
      localDialog.dispatchEvent(new Event('cancel', {cancelable:true}));
      await waitFor(()=>localDialog.textContent.includes('已取消 Google 登录'));
      findButton(localDialog,'关闭').click();
      await waitFor(()=>!document.querySelector('.runtime-login-dialog'));
      if(!document.querySelector('.settings-surface'))throw new Error('Cancelling login closed settings');
    `)
    assert.equal(submits, 1)
    assert.equal(cancellations, 1)
    const claudeState = await runUi(`
      [...document.querySelectorAll('.settings-navigation button')].find(button=>button.querySelector('strong')?.textContent==='订阅账户').click();
      const row = await waitFor(()=>[...document.querySelectorAll('.subscription-row')].find(row=>row.textContent.includes('Claude（Claude Code）')));
      findButton(row,'登录账户').click();
      const dialog = await waitFor(()=>document.querySelector('.runtime-login-dialog[open]'));
      const input = dialog.querySelector('input');
      await waitFor(()=>document.activeElement===input);
      return { title:dialog.querySelector('h2').textContent, placeholder:input.placeholder, notice:dialog.querySelector('.runtime-login-notice').textContent, overflow:dialog.scrollWidth>dialog.clientWidth };
    `)
    assert.equal(claudeState.title, '登录 Claude')
    assert.equal(claudeState.placeholder, '粘贴 Claude Code 页面显示的授权码')
    assert.match(claudeState.notice, /官方 Claude Code 运行时/)
    assert.equal(claudeState.overflow, false)
    await new Promise(resolve => { window.webContents.once('paint', resolve); window.webContents.invalidate() })
    await new Promise(resolve => setTimeout(resolve, 500))
    writeFileSync(join(__dirname, '../out/claude-login-smoke.png'), (await window.webContents.capturePage()).toPNG())
    await runUi(`
      const dialog = document.querySelector('.runtime-login-dialog');
      const input = dialog.querySelector('input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'test-code'); input.dispatchEvent(new Event('input', {bubbles:true}));
      (await waitFor(()=>!dialog.querySelector('[type=submit]').disabled && dialog.querySelector('[type=submit]'))).click();
      await waitFor(()=>dialog.textContent.includes('Claude 账户已连接'));
      if(dialog.querySelector('input'))throw new Error('Claude code input was retained');
    `)
    assert.equal(submits, 2)
    console.log('Runtime login smoke passed: native Electron PTY input, subscription/local login, code submit, keyboard cancellation, isolated preload, and modal focus.')
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
    window?.destroy()
    app.exit(process.exitCode ?? 0)
  }
}
