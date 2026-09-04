const assert = require('node:assert/strict')
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { spawn, spawnSync } = require('node:child_process')

const temporaryRoot = resolve(tmpdir())
if (!process.versions.electron) {
  const userData = mkdtempSync(join(temporaryRoot, 'agentflow-branding-smoke-'))
  try {
    const child = spawnSync(require('electron'), [__filename, userData], { stdio: 'inherit', windowsHide: true, timeout: 60000 })
    if (child.error) throw child.error
    process.exitCode = child.status ?? 1
  } finally {
    if (dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-branding-smoke-')) rmSync(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
} else void run()

async function run() {
  const { app, BrowserWindow, dialog, nativeImage } = require('electron')
  const userData = process.argv[2]
  assert.ok(userData && dirname(resolve(userData)) === temporaryRoot && basename(userData).startsWith('agentflow-branding-smoke-'))
  app.setPath('userData', userData)
  app.getPreferredSystemLanguages = () => ['zh-CN']
  BrowserWindow.prototype.show = function () {}
  dialog.showErrorBox = (title, detail) => { throw new Error(`${title}: ${detail}`) }
  const windowIcons = new Map(), taskbarDetails = new Map()
  const setIcon = BrowserWindow.prototype.setIcon
  BrowserWindow.prototype.setIcon = function (icon) { windowIcons.set(this.id, icon); return setIcon.call(this, icon) }
  const setAppDetails = BrowserWindow.prototype.setAppDetails
  BrowserWindow.prototype.setAppDetails = function (details) { taskbarDetails.set(this.id, details); return setAppDetails.call(this, details) }
  const timeout = setTimeout(() => { console.error('Branding smoke timed out'); app.exit(1) }, 45000)
  const waitFor = async predicate => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await predicate()) return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error('Timed out waiting for application branding')
  }
  try {
    await import(pathToFileURL(resolve(__dirname, '../out/main/index.js')).href)
    await app.whenReady()
    await waitFor(() => BrowserWindow.getAllWindows().length > 0)
    const main = BrowserWindow.getAllWindows()[0]
    main.webContents.setBackgroundThrottling(false)
    const evaluate = code => main.webContents.executeJavaScript(code)
    await waitFor(() => evaluate('Boolean(document.querySelector(".app-titlebar img.brand-mark")?.naturalWidth)'))
    await waitFor(() => evaluate('document.title === "传声筒AgentFlow"'))
    assert.equal(main.getTitle(), '传声筒AgentFlow')
    assert.equal(await evaluate('document.querySelector(".brand-name").textContent'), '传声筒AgentFlow')
    const rendered = await evaluate(`(() => {
      const image = document.querySelector('.app-titlebar img.brand-mark');
      const favicon = document.querySelector('link[rel="icon"]');
      const bounds = image.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height, naturalWidth: image.naturalWidth, favicon: favicon.href };
    })()`)
    assert.equal(rendered.width, 24)
    assert.equal(rendered.height, 24)
    assert.equal(rendered.naturalWidth, 512)
    assert.match(rendered.favicon, /app-icon-.*\.ico$/)
    const evidence = resolve(__dirname, '../../../artifacts/brand/verification')
    mkdirSync(evidence, { recursive: true })
    await evaluate(`document.querySelector('[aria-label="跳过教程"]')?.click()`)
    await waitFor(() => evaluate(`!document.querySelector('[aria-label="跳过教程"]')`))
    writeFileSync(join(evidence, 'titlebar.png'), (await main.webContents.capturePage({ x: 0, y: 0, width: 760, height: 48 })).toPNG())
    if (process.platform === 'win32') {
      const details = taskbarDetails.get(main.id)
      assert.equal(details.appId, 'com.agentflow.desktop')
      assert.equal(details.relaunchDisplayName, '传声筒AgentFlow')
      assert.ok(details.relaunchCommand.includes(process.execPath))
      assert.equal(details.appIconPath, join(userData, 'agentflow', 'brand', 'app-icon.ico'))
      const ico = readFileSync(details.appIconPath)
      assert.equal(ico.readUInt16LE(2), 1)
      assert.deepEqual(Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16] || 256), [16, 20, 24, 32, 40, 48, 64, 128, 256])
      assert.ok(windowIcons.has(main.id))
      const captureScript = join(userData, 'native-icon.ps1')
      writeFileSync(captureScript, `Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BrandNativeIcon {
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
}
'@
$handle = [BrandNativeIcon]::SendMessage([IntPtr]::new([long]$args[0]), 127, [IntPtr]::new(1), [IntPtr]::Zero)
if ($handle -eq [IntPtr]::Zero) { throw 'The window has no native large icon' }
$bitmap = [System.Drawing.Icon]::FromHandle($handle).ToBitmap()
$bitmap.Save($args[1], [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
`)
      const nativePath = join(evidence, 'native-window-icon.png')
      const handle = main.getNativeWindowHandle().readBigUInt64LE().toString()
      // Keep Electron's UI thread responsive while Windows handles WM_GETICON.
      await new Promise((resolveCapture, reject) => {
        const capture = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', captureScript, handle, nativePath], { windowsHide: true, timeout: 15000 })
        let errors = ''
        capture.stderr.on('data', chunk => { errors += chunk })
        capture.on('error', reject)
        capture.on('close', code => code === 0 ? resolveCapture() : reject(new Error(errors || `Native icon capture exited with ${code}`)))
      })
      const actual = nativeImage.createFromPath(nativePath)
      assert.equal(actual.isEmpty(), false)
      const expected = nativeImage.createFromPath(resolve(__dirname, '../src/assets/app-icon.png')).resize({ ...actual.getSize(), quality: 'best' })
      const a = actual.toBitmap(), b = expected.toBitmap()
      const difference = a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / a.length
      assert.ok(difference < 15, `The native window icon differs from the approved icon: ${difference}`)
      await evaluate('window.agentflowDesktop.invokeMenuAction("diagnostics")')
      await waitFor(() => BrowserWindow.getAllWindows().length === 2)
      for (const window of BrowserWindow.getAllWindows()) assert.equal(taskbarDetails.get(window.id).appIconPath, details.appIconPath)
      for (const [preference, name] of [['en', 'AgentFlow'], ['zh', '传声筒AgentFlow']]) {
        await evaluate(`window.agentflowDesktop.setLanguagePreference(${JSON.stringify(preference)})`)
        await waitFor(() => evaluate(`document.title === ${JSON.stringify(name)} && document.querySelector('.brand-name').textContent === ${JSON.stringify(name)}`))
        assert.equal(main.getTitle(), name)
        for (const window of BrowserWindow.getAllWindows()) assert.equal(taskbarDetails.get(window.id).relaunchDisplayName, name)
      }
      for (const width of [1440, 1040]) {
        main.setSize(width, 920)
        await main.webContents.capturePage()
        await new Promise(resolve => setTimeout(resolve, 600))
        const brand = await evaluate(`(() => { const el = document.querySelector('.brand-name'); return { display: getComputedStyle(el).display, width: el.clientWidth, scrollWidth: el.scrollWidth }; })()`)
        assert.notEqual(brand.display, 'none')
        assert.ok(brand.width >= brand.scrollWidth, 'The full Chinese brand should fit')
        if (width === 1440) writeFileSync(join(evidence, 'titlebar-1440.png'), (await main.webContents.capturePage({ x: 0, y: 0, width: 760, height: 48 })).toPNG())
      }
      console.log(JSON.stringify({ renderer: rendered, nativeIcon: actual.getSize(), nativeDifference: difference, brandedWindows: taskbarDetails.size, evidence }))
    } else console.log(JSON.stringify({ renderer: rendered, evidence }))
    clearTimeout(timeout)
    for (const window of BrowserWindow.getAllWindows()) window.destroy()
    app.exit(0)
  } catch (error) {
    clearTimeout(timeout)
    console.error(error)
    app.exit(1)
  }
}
