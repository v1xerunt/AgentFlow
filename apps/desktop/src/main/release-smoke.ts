import { app, BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { terminateManagedProcesses } from './platform-process'

export function initializeReleaseSmoke() {
  const path = process.env.AGENTFLOW_RELEASE_SMOKE
    ?? process.argv.find((argument) => argument.startsWith('--agentflow-release-smoke='))?.slice('--agentflow-release-smoke='.length)
  if (!path) return undefined
  app.disableHardwareAcceleration()
  const root = resolve(path)
  if (dirname(root) !== resolve(tmpdir()) || !basename(root).startsWith('agentflow-release-smoke-')) throw new Error('Invalid release smoke directory')
  mkdirSync(join(root, 'profile'), { recursive: true })
  app.setPath('userData', join(root, 'profile'))
  return root
}

export async function runReleaseSmoke(root: string) {
  const finish = (result: Record<string, unknown>, code: number) => {
    writeFileSync(join(root, 'report.json'), JSON.stringify({ platform: process.platform, arch: process.arch, packaged: app.isPackaged, ...result }, null, 2))
    terminateManagedProcesses()
    app.exit(code)
  }
  const timeout = setTimeout(() => finish({ error: 'Release smoke timed out' }, 1), 30_000)
  try {
    if (!app.isPackaged) throw new Error('Release smoke must run the packaged application')
    const acp = await import('@agentclientprotocol/sdk')
    if (typeof acp.client !== 'function' || typeof acp.ndJsonStream !== 'function') throw new Error('Packaged ACP client is unavailable')
    const updater = createRequire(import.meta.url)('electron-updater') as typeof import('electron-updater')
    if (typeof updater.autoUpdater.checkForUpdates !== 'function') throw new Error('Updater runtime is missing')
    const updateConfig = await readFile(join(process.resourcesPath, 'app-update.yml'), 'utf8')
    if (!updateConfig.includes('repo: AgentFlow') || !updateConfig.includes('owner: v1xerunt')) throw new Error('Missing official update feed')
    const window = BrowserWindow.getAllWindows()[0]!
    if (window.webContents.isLoading()) await new Promise<void>((resolve, reject) => {
      window.webContents.once('did-finish-load', () => resolve())
      window.webContents.once('did-fail-load', (_event, _code, description) => reject(new Error(description)))
    })
    const ui = await window.webContents.executeJavaScript(`(async () => {
      const api = window.agentflowDesktop;
      if (!api) throw new Error('Preload bridge is missing');
      const settings = await api.getLanguageSettings();
      await new Promise((resolve, reject) => {
        const started = Date.now();
        const check = () => {
          if (document.querySelector('.app-shell')) return resolve();
          if (Date.now() - started > 15000) return reject(new Error('Renderer did not mount: ' + document.body.innerText));
          setTimeout(check, 100);
        };
        check();
      });
      const library = await api.loadAgentLibrary();
      await api.saveAgentLibrary(library);
      if (JSON.stringify(await api.loadAgentLibrary()) !== JSON.stringify(library)) throw new Error('Persistence round trip failed');
      const updates = await api.getUpdateState();
      await api.setUpdatePreferences({ autoCheck: false, autoDownload: false });
      const savedUpdates = await api.getUpdateState();
      if (savedUpdates.preferences.autoCheck || savedUpdates.preferences.autoDownload) throw new Error('Update preferences did not persist');
      if (updates.canCheck) throw new Error('Release smoke must not contact the update feed');
      const waitFor = async (predicate) => {
        for (let i = 0; i < 80; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 40)); }
        throw new Error('Update settings did not render: ' + predicate.toString() + '\\n' + document.body.innerText.slice(-4000));
      };
      const skip = document.querySelector('.tutorial-close');
      if (skip) { skip.click(); await waitFor(() => !document.querySelector('.tutorial-spotlight')); }
      document.querySelector('.sidebar-settings').click();
      await waitFor(() => document.querySelector('.settings-navigation'));
      for (const locale of ['zh', 'en']) {
        await api.setLanguagePreference(locale);
        const label = locale === 'zh' ? '应用更新' : 'App updates';
        await waitFor(() => Array.from(document.querySelectorAll('.settings-navigation button')).some(button => button.textContent.includes(label)));
        Array.from(document.querySelectorAll('.settings-navigation button')).find(button => button.textContent.includes(label)).click();
        await waitFor(() => document.querySelectorAll('.update-option input').length === 2);
        if (!document.querySelector('.update-status')) throw new Error('Update status is missing');
      }
      return { title: document.title, languagePreference: settings.preference, elements: document.querySelectorAll('*').length, persistence: true, updates: true };
    })()`)
    if (ui.elements < 20) throw new Error('Renderer did not mount')
    const pty = await import('node-pty')
    const terminal = process.platform === 'win32'
      ? pty.spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe'), ['/d', '/q'], { cwd: root, cols: 80, rows: 24 })
      : pty.spawn('/bin/sh', [], { cwd: root, cols: 80, rows: 24 })
    await new Promise<void>((resolve, reject) => {
      let output = ''
      terminal.onData(text => { output += text })
      terminal.onExit(({ exitCode }) => exitCode === 0 && output.includes('AGENTFLOW_PTY_OK') ? resolve() : reject(new Error(`PTY failed (${exitCode}): ${output}`)))
      terminal.write('echo AGENTFLOW_PTY_OK\r')
      terminal.write('exit\r')
    })
    clearTimeout(timeout)
    finish({ ok: true, ui, pty: true, acp: true }, 0)
  } catch (error) { clearTimeout(timeout); finish({ error: String(error) }, 1) }
}
