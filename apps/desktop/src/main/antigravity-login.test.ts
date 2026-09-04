import { afterEach, describe, expect, it, vi } from 'vitest'
import { AntigravityLoginService, antigravityAuthUrl, type LoginTerminal } from './antigravity-login'
import type { RuntimeLoginProgress } from '../shared/llm'

const options = { command: '/runtime/agy', cwd: '/runtime/login', env: { PATH: '/runtime' } }
const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&redirect_uri=https%3A%2F%2Fexample.test&response_type=code&scope=openid&state=test&code_challenge=challenge&code_challenge_method=S256'
afterEach(() => vi.useRealTimers())

function harness(probe = vi.fn(async () => false)) {
  vi.useFakeTimers()
  const data = new Set<(text: string) => void>()
  const exits = new Set<(event: { exitCode: number }) => void>()
  const terminal: LoginTerminal = {
    write: vi.fn(), kill: vi.fn(),
    onData: listener => { data.add(listener); return { dispose: () => { data.delete(listener) } } },
    onExit: listener => { exits.add(listener); return { dispose: () => { exits.delete(listener) } } }
  }
  const dependencies = { spawn: vi.fn(async () => terminal), probe, openExternal: vi.fn(async () => {}) }
  const service = new AntigravityLoginService(dependencies)
  const progress: RuntimeLoginProgress[] = []
  const result = service.login(options, update => progress.push(update))
  // Attach immediately so deliberately rejected flows never become unhandled.
  void result.catch(() => {})
  const emit = (text: string) => data.forEach(listener => listener(text))
  const ready = async () => {
    await vi.advanceTimersByTimeAsync(0)
    emit('\x1b[6nSelect login method:\r\n > 1. Google OAuth\r\n 2. Use a Google Cloud project')
    emit(`Open the URL below:\r\n ${url.slice(0, 45)}`)
    emit(`${url.slice(45)}\r\nAfter authenticating, copy the code displayed in the browser and paste it below:`)
  }
  return { service, result, dependencies, terminal, progress, emit, ready, exits }
}

describe('Antigravity interactive login', () => {
  it('prefers a valid terminal hyperlink and rejects duplicated OAuth parameters', () => {
    const corrupted = `${url}&client_id=test&scope=openid&state=other`
    const hyperlink = `\x1b]8;;${url}\x1b\\Open Google login\x1b]8;;\x1b\\`
    expect(antigravityAuthUrl(`${corrupted}\r\n${hyperlink}`)).toBe(url)
    expect(antigravityAuthUrl(corrupted)).toBeUndefined()
    expect(antigravityAuthUrl(url.replace('accounts.google.com', 'accounts.google.example'))).toBeUndefined()
  })

  it('selects Google OAuth, handles split URLs, and sends the code only into the PTY', async () => {
    const h = harness()
    await h.ready()
    expect(h.dependencies.spawn).toHaveBeenCalledWith({ ...options, env: { ...options.env, SSH_CONNECTION: expect.any(String), AGY_CLI_DISABLE_AUTO_UPDATE: 'true' } })
    expect(h.terminal.write).toHaveBeenCalledWith('\x1b[1;1R')
    expect(h.terminal.write).toHaveBeenCalledWith('\r')
    expect(h.progress.at(-1)).toMatchObject({ phase: 'awaiting-code', authUrl: url })
    expect(h.dependencies.openExternal).toHaveBeenCalledOnce()
    h.service.submit(h.progress[0]!.requestId, '  4/secret_test-code  ')
    expect(h.terminal.write).toHaveBeenLastCalledWith('4/secret_test-code\r')
    expect(h.progress.at(-1)?.phase).toBe('verifying')
    h.dependencies.probe.mockResolvedValue(true)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(h.result).resolves.toBeUndefined()
    expect(h.terminal.kill).toHaveBeenCalledOnce()
    expect(h.progress.at(-1)).toMatchObject({ phase: 'connected', authUrl: undefined })
    expect(JSON.stringify(h.progress)).not.toContain('secret_test-code')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reuses valid authentication without starting an interactive process', async () => {
    const h = harness(vi.fn(async () => true))
    await expect(h.result).resolves.toBeUndefined()
    expect(h.dependencies.spawn).not.toHaveBeenCalled()
    expect(h.dependencies.openExternal).not.toHaveBeenCalled()
  })

  it('rejects stale sessions, empty codes, control sequences, and duplicate submission', async () => {
    const h = harness()
    await h.ready()
    const id = h.progress[0]!.requestId
    expect(() => h.service.submit('old-session', 'valid-code')).toThrow('这次登录已结束')
    for (const code of ['', ' ', 'code\r/quit', 'code\x1b[2J', 'x'.repeat(4097)]) {
      expect(() => h.service.submit(id, code)).toThrow('只粘贴')
    }
    await expect(h.service.login(options, () => {})).rejects.toThrow('已有 Google 登录')
    h.service.submit(id, 'valid-code')
    expect(() => h.service.submit(id, 'second-code')).toThrow('当前还不能提交')
    h.service.cancel(id)
    await expect(h.result).rejects.toThrow('已取消')
    expect(() => h.service.submit(id, 'late-code')).toThrow('这次登录已结束')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('redacts rejected codes and terminates the failed session', async () => {
    const h = harness()
    await h.ready()
    h.service.submit(h.progress[0]!.requestId, 'secret-code')
    h.emit('secret-code\nfailed to exchange authorization code for token: invalid_grant')
    await expect(h.result).rejects.toThrow('授权码无效或已过期')
    expect(JSON.stringify(h.progress)).not.toContain('secret-code')
    expect(h.terminal.kill).toHaveBeenCalledOnce()
  })

  it('keeps the manual link available when opening the browser fails', async () => {
    const h = harness()
    h.dependencies.openExternal.mockRejectedValue(new Error('browser blocked'))
    await h.ready()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.progress.at(-1)).toMatchObject({ phase: 'awaiting-code', authUrl: url, message: expect.stringContaining('未能自动打开') })
    h.service.cancel()
    await expect(h.result).rejects.toThrow('已取消')
  })

  it('does not open unexpected URLs or submit a login menu for another provider', async () => {
    const h = harness()
    await vi.advanceTimersByTimeAsync(0)
    h.emit('Select login method:\n > 1. Use a Google Cloud project\n 2. Google OAuth')
    h.emit('https://untrusted.test/?state=secret authorization code...')
    expect(h.terminal.write).not.toHaveBeenCalled()
    expect(h.dependencies.openExternal).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(45_000)
    await expect(h.result).rejects.toThrow('未能打开登录流程')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds waiting for a code and verification without assuming login succeeded', async () => {
    const h = harness()
    await h.ready()
    await vi.advanceTimersByTimeAsync(599_000)
    expect(h.progress.at(-1)?.phase).toBe('awaiting-code')
    await vi.advanceTimersByTimeAsync(1000)
    await expect(h.result).rejects.toThrow('登录超时')
    const second = harness()
    await second.ready()
    second.service.submit(second.progress[0]!.requestId, 'code')
    await vi.advanceTimersByTimeAsync(60_000)
    await expect(second.result).rejects.toThrow('授权验证未完成')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('kills a terminal that finishes spawning after cancellation', async () => {
    const h = harness()
    let spawned!: (terminal: LoginTerminal) => void
    h.dependencies.spawn.mockImplementation(() => new Promise(resolve => { spawned = resolve }))
    await vi.advanceTimersByTimeAsync(0)
    h.service.cancel()
    spawned(h.terminal)
    await expect(h.result).rejects.toThrow('已取消')
    await vi.advanceTimersByTimeAsync(0)
    expect(h.terminal.kill).toHaveBeenCalledOnce()
  })
})
