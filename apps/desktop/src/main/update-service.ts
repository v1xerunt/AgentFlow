import { readFile } from 'node:fs/promises'
import type { AppUpdater } from 'electron-updater'
import { atomicWriteFile } from './atomic-file'
import type { UpdatePreferences, UpdateState } from '../shared/updates'

type Client = Pick<AppUpdater, 'on' | 'autoDownload' | 'autoInstallOnAppQuit' | 'allowPrerelease' | 'allowDowngrade' | 'checkForUpdates' | 'downloadUpdate'>
interface Options {
  client?: Client
  file: string
  version: string
  limitation: UpdateState['limitation']
  onChange: (state: UpdateState) => void
  onError: (error: unknown) => void
  quit: () => void
}
export class UpdateService {
  private state: UpdateState
  private operation?: Promise<UpdateState>
  private writes: Promise<unknown> = Promise.resolve()
  private startup?: ReturnType<typeof setTimeout>
  private startupChecked = false
  constructor(private readonly options: Options) {
    this.state = { currentVersion: options.version, phase: 'idle', preferences: { autoCheck: true, autoDownload: true }, canCheck: Boolean(options.client), canInstall: Boolean(options.client) && options.limitation === null, limitation: options.limitation }
    const client = options.client
    if (!client) return
    client.autoDownload = false
    client.autoInstallOnAppQuit = this.state.canInstall
    client.allowPrerelease = false
    client.allowDowngrade = false
    client.on('checking-for-update', () => this.patch({ phase: 'checking', error: undefined }))
    client.on('update-available', info => this.patch({ phase: 'available', latestVersion: info.version, progress: undefined, checkedAt: new Date().toISOString() }))
    client.on('update-not-available', () => this.patch({ phase: 'current', latestVersion: undefined, progress: undefined, checkedAt: new Date().toISOString() }))
    client.on('download-progress', info => this.patch({ phase: 'downloading', progress: Math.min(100, Math.max(0, info.percent)) }))
    client.on('update-downloaded', info => this.patch({ phase: 'downloaded', latestVersion: info.version, progress: 100, error: undefined }))
    client.on('error', error => this.fail(error))
  }
  snapshot(): UpdateState { return { ...this.state, preferences: { ...this.state.preferences } } }
  private patch(patch: Partial<UpdateState>) { this.state = { ...this.state, ...patch }; this.options.onChange(this.snapshot()) }
  private fail(error: unknown) {
    this.options.onError(error)
    const code = (error as { code?: string })?.code ?? ''
    this.patch({ phase: 'error', error: /LATEST_VERSION_NOT_FOUND|CHANNEL_FILE_NOT_FOUND|NO_PUBLISHED_VERSIONS/.test(code) ? 'no-release' : 'network', progress: undefined })
  }
  async initialize() {
    try {
      const saved: unknown = JSON.parse(await readFile(this.options.file, 'utf8'))
      if (validPreferences(saved)) this.state.preferences = saved
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.options.onError(error) }
    this.schedule()
    return this.snapshot()
  }
  private schedule() {
    this.dispose()
    if (!this.state.canCheck || !this.state.preferences.autoCheck || this.startupChecked) return
    this.startup = setTimeout(() => { this.startupChecked = true; void this.check() }, 15_000)
    this.startup.unref?.()
  }
  dispose() { clearTimeout(this.startup) }
  setPreferences(value: unknown): Promise<UpdateState> {
    if (!validPreferences(value)) return Promise.reject(new Error('Invalid update preferences'))
    const preferences = { autoCheck: value.autoCheck, autoDownload: value.autoDownload }
    const write = this.writes.catch(() => {}).then(async () => {
      await atomicWriteFile(this.options.file, JSON.stringify(preferences))
      this.patch({ preferences }); this.schedule()
      if (preferences.autoDownload && this.state.phase === 'available' && this.state.canInstall) void this.download()
      return this.snapshot()
    })
    this.writes = write
    return write
  }
  check(): Promise<UpdateState> {
    if (this.operation) return this.operation
    if (!this.state.canCheck || this.state.phase === 'downloaded') return Promise.resolve(this.snapshot())
    const work = async () => {
      try {
        this.patch({ phase: 'checking', error: undefined })
        await this.options.client!.checkForUpdates()
        if (this.snapshot().phase === 'available' && this.state.preferences.autoDownload && this.state.canInstall) await this.performDownload()
      } catch (error) { this.fail(error) }
      return this.snapshot()
    }
    this.operation = work().finally(() => { this.operation = undefined })
    return this.operation
  }
  download(): Promise<UpdateState> {
    if (this.operation) return this.operation
    if (!this.state.canInstall || !this.state.latestVersion || !['available', 'error'].includes(this.state.phase)) return Promise.resolve(this.snapshot())
    this.operation = this.performDownload().then(() => this.snapshot()).finally(() => { this.operation = undefined })
    return this.operation
  }
  private async performDownload() {
    try {
      this.patch({ phase: 'downloading', progress: 0, error: undefined })
      await this.options.client!.downloadUpdate()
    } catch (error) { this.fail(error) }
  }
  install() {
    if (this.state.phase !== 'downloaded' || !this.state.canInstall) throw new Error('No downloaded update is ready')
    // Normal quit runs the renderer's save/close guard before the updater's on-quit installer.
    this.options.quit()
  }
}
function validPreferences(value: unknown): value is UpdatePreferences {
  return Boolean(value && typeof value === 'object' && typeof (value as UpdatePreferences).autoCheck === 'boolean' && typeof (value as UpdatePreferences).autoDownload === 'boolean')
}
