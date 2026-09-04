import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateService } from './update-service'

class FakeUpdater extends EventEmitter {
  autoDownload = true
  autoInstallOnAppQuit = false
  allowPrerelease = true
  allowDowngrade = true
  checkForUpdates = vi.fn(async () => { this.emit('update-available', { version: '0.2.0' }); return null })
  downloadUpdate = vi.fn(async () => { this.emit('download-progress', { percent: 55 }); this.emit('update-downloaded', { version: '0.2.0' }); return [] })
}
const roots: string[] = [], services: UpdateService[] = []
afterEach(async () => { services.splice(0).forEach(s => s.dispose()); vi.useRealTimers(); await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))) })
async function fixture(limitation: 'development' | 'unsigned-mac' | null = null) {
  const root = await mkdtemp(join(tmpdir(), 'agentflow-updates-')); roots.push(root)
  const client = new FakeUpdater(), quit = vi.fn(), change = vi.fn()
  const options = { client: limitation === 'development' ? undefined : client as unknown as ConstructorParameters<typeof UpdateService>[0]['client'], file: join(root, 'updates.json'), version: '0.1.0', limitation, onChange: change, onError: vi.fn(), quit }
  const service = new UpdateService(options); services.push(service); await service.initialize()
  return { service, client, quit, change, options }
}
describe('desktop updates', () => {
  it('downloads a discovered stable update without interrupting work, then quits only on request', async () => {
    const { service, client, quit, change } = await fixture()
    await service.check()
    expect(client.allowPrerelease).toBe(false); expect(client.allowDowngrade).toBe(false)
    expect(client.autoDownload).toBe(false); expect(client.autoInstallOnAppQuit).toBe(true)
    expect(service.snapshot().phase).toBe('downloaded'); expect(quit).not.toHaveBeenCalled()
    expect(change.mock.calls.some(([s]) => s.progress === 55)).toBe(true)
    service.install(); expect(quit).toHaveBeenCalledOnce()
    await service.check(); expect(client.checkForUpdates).toHaveBeenCalledOnce()
  })
  it('persists opt-outs, permits manual downloads, and restores choices across restarts', async () => {
    const { service, client, options } = await fixture()
    await service.setPreferences({ autoCheck: false, autoDownload: false })
    await service.check(); expect(service.snapshot().phase).toBe('available'); expect(client.downloadUpdate).not.toHaveBeenCalled()
    expect(JSON.parse(await readFile(options.file, 'utf8'))).toEqual({ autoCheck: false, autoDownload: false })
    const next = new UpdateService(options); services.push(next); await next.initialize()
    expect(next.snapshot().preferences.autoCheck).toBe(false)
    await service.download(); expect(service.snapshot().phase).toBe('downloaded')
  })
  it('shares concurrent checks and downloads, and reports offline failure with a working retry', async () => {
    const { service, client } = await fixture()
    let release!: () => void
    client.checkForUpdates.mockImplementationOnce(async () => { await new Promise<void>(r => { release = r }); throw new Error('offline') })
    const a = service.check(), b = service.check(); expect(a).toBe(b)
    release(); await a; expect(service.snapshot().phase).toBe('error'); expect(client.downloadUpdate).not.toHaveBeenCalled()
    await service.check(); expect(service.snapshot().phase).toBe('downloaded')
  })
  it('does not install a failed or unavailable download', async () => {
    const { service, client, quit } = await fixture()
    client.downloadUpdate.mockRejectedValueOnce(new Error('checksum mismatch'))
    await service.check(); expect(service.snapshot().phase).toBe('error'); expect(() => service.install()).toThrow()
    expect(quit).not.toHaveBeenCalled(); await service.download(); expect(service.snapshot().phase).toBe('downloaded')
  })
  it('keeps checks available for manual-only builds and disables development network checks', async () => {
    const manual = await fixture('unsigned-mac'); await manual.service.check()
    expect(manual.service.snapshot().phase).toBe('available'); expect(manual.client.downloadUpdate).not.toHaveBeenCalled()
    expect(() => manual.service.install()).toThrow()
    const dev = await fixture('development'); await dev.service.check(); expect(dev.client.checkForUpdates).not.toHaveBeenCalled()
  })
  it('checks once after startup and honors opting out before the startup check', async () => {
    vi.useFakeTimers()
    const { service, client } = await fixture()
    client.checkForUpdates.mockImplementation(async () => { client.emit('update-not-available', { version: '0.1.0' }); return null })
    await service.setPreferences({ autoCheck: false, autoDownload: true })
    await vi.advanceTimersByTimeAsync(15_000); expect(client.checkForUpdates).not.toHaveBeenCalled()
    await service.setPreferences({ autoCheck: true, autoDownload: true })
    await vi.advanceTimersByTimeAsync(15_000); expect(client.checkForUpdates).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000); expect(client.checkForUpdates).toHaveBeenCalledTimes(1)
  })
  it('rejects malformed preferences without overwriting the saved policy', async () => {
    const { service } = await fixture()
    await expect(service.setPreferences({ autoCheck: 'yes' })).rejects.toThrow('Invalid')
    expect(service.snapshot().preferences).toEqual({ autoCheck: true, autoDownload: true })
  })
})
