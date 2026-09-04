import { app, BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { terminateManagedProcesses } from './platform-process'

export function initializeReleaseSmoke() {
  const path = process.env.AGENTFLOW_RELEASE_SMOKE
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
      return { title: document.title, languagePreference: settings.preference, elements: document.querySelectorAll('*').length, persistence: true };
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
    finish({ ok: true, ui, pty: true }, 0)
  } catch (error) { clearTimeout(timeout); finish({ error: String(error) }, 1) }
}
