const assert = require('node:assert/strict')
const { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { spawnSync } = require('node:child_process')

const temporaryRoot = resolve(tmpdir())
const output = resolve(__dirname, '../../..', 'artifacts/localization')
if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-language-'))
  try {
    for (const phase of ['switch', 'restart']) {
      const child = spawnSync(require('electron'), [__filename, userData, phase], { stdio: 'inherit', timeout: 60_000, windowsHide: true })
      if (child.error) throw child.error
      assert.equal(child.status, 0, `Language smoke: ${phase}`)
    }
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-language-')) rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
} else void run()

async function run() {
  const { app, BrowserWindow, ipcMain, Menu } = require('electron')
  const userData = process.argv[2], phase = process.argv[3]
  assert.ok(dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-language-'))
  app.setPath('userData', userData)
  let systemLanguages = ['zh-TW', 'en-GB']
  app.getPreferredSystemLanguages = () => systemLanguages
  BrowserWindow.prototype.show = function () {}
  const errors = []
  app.on('browser-window-created', (_event, window) => {
    window.webContents.setBackgroundThrottling(false)
    window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message) })
    // Keep the smoke independent of locally installed command-line tools.
    ipcMain.removeHandler('agentflow:llm:tools:detect')
    ipcMain.handle('agentflow:llm:tools:detect', event => event.sender.executeJavaScript('window.agentflowDesktop.loadLlmSettings()'))
  })
  const timer = setTimeout(() => { console.error('Language smoke timed out'); app.exit(1) }, 50_000)
  const wait = async read => { for (let i = 0; i < 300; i++) { const result = await read(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 30)) } throw new Error('UI did not settle') }
  const capture = async (window, filename) => {
    await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
    await new Promise(resolve => setTimeout(resolve, 180))
    writeFileSync(join(output, filename), (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG())
  }
  try {
    await import(pathToFileURL(resolve(__dirname, '../out/main/index.js')).href)
    const window = await wait(() => BrowserWindow.getAllWindows()[0])
    const js = source => window.webContents.executeJavaScript(source)
    await wait(() => js('Boolean(document.querySelector(".sidebar-settings"))').catch(() => false))
    const settingsPath = join(userData, 'agentflow/language.json')
    if (phase === 'restart') {
      assert.equal(await js('document.documentElement.lang'), 'en-US')
      assert.equal(JSON.parse(readFileSync(settingsPath, 'utf8')), 'en')
      assert.equal((await js('window.agentflowDesktop.getLanguageSettings()')).preference, 'en')
      console.log('PASS: language persisted across a full app restart')
      app.exit(0); return
    }
    assert.equal(await js('document.documentElement.lang'), 'zh-CN')
    await wait(() => js('Boolean(document.querySelector(".tutorial-close"))'))
    await js('document.querySelector(".tutorial-close").click()')
    await wait(() => js('!document.querySelector(".tutorial-close")'))
    await js(`(async () => {
      const settings = await window.agentflowDesktop.loadLlmSettings();
      await window.agentflowDesktop.saveLlmSettings({ ...settings, providers: [...settings.providers.map(provider => ['openai','anthropic'].includes(provider.id) ? { ...provider, added: true, enabled: true, apiKey: 'local-smoke-test' } : provider), { id: 'custom:smoke', name: 'Smoke model', protocol: 'openai-compatible', baseUrl: 'http://127.0.0.1:1/v1', added: true, enabled: true, custom: true, manualModels: ['gpt-5.6-sol'] }] });
    })()`)
    await wait(() => js('window.agentflowDesktop.loadWorkspace().then(state => state?.tutorial?.status === "skipped")'))
    await window.reload()
    await wait(() => js('Boolean(document.querySelector(".sidebar-settings"))').catch(() => false))
    await js('document.querySelector(".sidebar-settings").click()')
    await wait(() => js('Boolean(document.querySelector(".language-setting select"))'))
    const switchLanguage = async preference => {
      await js(`document.querySelector('.settings-navigation button').click()`)
      await wait(() => js('Boolean(document.querySelector(".language-setting select"))'))
      await js(`(() => { const select = document.querySelector('.language-setting select'); select.value = ${JSON.stringify(preference)}; select.dispatchEvent(new Event('change', { bubbles: true })); })()`)
      await wait(() => js(`document.querySelector('.language-setting select')?.value === ${JSON.stringify(preference)} && !document.querySelector('.language-setting select').disabled`))
    }
    const inspect = async (language, page) => {
      const text = await js(`(() => {
        const root = document.querySelector('.settings-surface') || document.body;
        const clone = root.cloneNode(true); clone.querySelectorAll('option[value="zh"],option[value="en"],script,style').forEach(el => el.remove());
        return clone.textContent + [...root.querySelectorAll('[aria-label],[title],[placeholder]')].map(el => [el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('placeholder')].flat()).join(' ');
      })()`)
      writeFileSync(join(output, `${language}-${page}.txt`), text)
      if (language === 'en') assert.doesNotMatch(text, /\p{Script=Han}/u, `${page}: Chinese residue in English`)
      else assert.doesNotMatch(text, /\b(Project|Provider|Session|Prompt|Result|Input|Output|Review|Reviser|Merger|Ready|Temperature|Reasoning|nodes|links|Artifact|Fork)\b/, `${page}: untranslated terminology`)
      assert.doesNotMatch(text, /\{\d+\}|undefined/, `${page}: missing interpolation`)
      assert.equal(await js('document.documentElement.scrollWidth > innerWidth'), false, `${page}: page overflows`)
    }
    mkdirSync(output, { recursive: true })
    await js('window.agentflowDesktop.invokeMenuAction("diagnostics")')
    const diagnostics = await wait(() => BrowserWindow.getAllWindows().find(item => item.id !== window.id))
    await wait(() => diagnostics.webContents.executeJavaScript('Boolean(document.querySelector(".diagnostics-heading"))').catch(() => false))
    for (const language of ['zh', 'en']) {
      await switchLanguage(language)
      assert.equal(JSON.parse(readFileSync(settingsPath, 'utf8')), language)
      assert.equal(await js('document.documentElement.lang'), language === 'zh' ? 'zh-CN' : 'en-US')
      await wait(() => diagnostics.webContents.executeJavaScript(`document.documentElement.lang === '${language === 'zh' ? 'zh-CN' : 'en-US'}'`))
      assert.equal(Menu.getApplicationMenu().items[0].label, language === 'zh' ? '文件' : 'File')
      const count = await js('document.querySelectorAll(".settings-navigation button").length')
      for (let index = 0; index < count; index++) {
        await js(`document.querySelectorAll('.settings-navigation button')[${index}].click()`)
        await new Promise(resolve => setTimeout(resolve, 100))
        await js(`document.querySelectorAll('.settings-row-disclosure[aria-expanded="false"]').forEach(button => button.click())`)
        await new Promise(resolve => setTimeout(resolve, 60))
        await inspect(language, `settings-${index}`)
        if ([0, 1, 6].includes(index)) await capture(window, `${language}-settings-${index}.png`)
      }
      await capture(diagnostics, `${language}-diagnostics.png`)
    }
    // A locale event must not remount settings or erase an in-progress search.
    await js(`(() => { const input = document.querySelector('.settings-search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'OpenAI'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
    await js('window.agentflowDesktop.setLanguagePreference("zh")')
    await wait(() => js('document.documentElement.lang === "zh-CN"'))
    assert.equal(await js('document.querySelector(".settings-search input").value'), 'OpenAI')
    await js(`(() => { const input = document.querySelector('.settings-search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
    systemLanguages = ['en-GB', 'zh-CN']
    await switchLanguage('system')
    assert.equal(await js('document.documentElement.lang'), 'en-US')
    systemLanguages = ['zh-CN']
    await js('dispatchEvent(new Event("languagechange"))')
    await wait(() => js('document.documentElement.lang === "zh-CN"'))
    await switchLanguage('en')
    await js('document.querySelector(".settings-back").click()')
    await wait(() => js('!document.querySelector(".settings-surface")'))
    await inspect('en', 'tutorial-canvas')
    await js(`(() => { const button = [...document.querySelectorAll('.project-row__main')].find(button => button.textContent.includes('Customer feedback')); if (!button) throw new Error('Tutorial project missing'); button.click(); })()`)
    await wait(() => js('document.querySelector(".canvas-heading h1")?.textContent.includes("Customer feedback")'))
    await inspect('en', 'tutorial-nodes')
    await capture(window, 'en-canvas.png')
    await js('window.agentflowDesktop.setLanguagePreference("zh")')
    await wait(() => js('document.documentElement.lang === "zh-CN"'))
    await inspect('zh', 'tutorial-nodes')
    await js('window.agentflowDesktop.setLanguagePreference("en")')
    assert.deepEqual(errors, [], 'Renderer errors')
    console.log('PASS: system detection, both languages on all settings pages, native menus, diagnostics synchronization, draft preservation, live system change, tutorial canvas, and layout')
    clearTimeout(timer)
    app.exit(0)
  } catch (error) {
    console.error(error)
    console.error(errors)
    app.exit(1)
  }
}
