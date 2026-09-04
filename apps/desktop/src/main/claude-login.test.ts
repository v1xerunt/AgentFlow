import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClaudeLoginService, claudeAuthUrl, claudeLoginFailure, readClaudeSubscriptionAccount } from './claude-login'
import type { ClaudeLoginOptions } from './claude-login'
import type { LoginTerminal } from './antigravity-login'
import type { RuntimeLoginProgress } from '../shared/llm'

const options: ClaudeLoginOptions = { command: '/runtime/claude', cwd: '/runtime/login-workspace', env: { CLAUDE_CONFIG_DIR: '/runtime/profile' } }
const url = 'https://claude.ai/oauth/authorize?client_id=test&state=state&code_challenge=challenge'
const trust = 'Do you trust the files in this folder?\nD:\\ExampleProject\n❯ 1. Yes, proceed\n2. No, exit\nEnter to confirm · Esc to exit'
const theme = 'Choose the text style that looks best with your terminal\n> 1. Dark mode\n2. Light mode'
const method = 'Select login method:\n> 1. Claude account with subscription · Pro, Max, Team, or Enterprise\n2. Anthropic Console account · API usage billing'
const success = 'Login successful. Press Enter to continue…'
const security = 'Security notes:\nClaude can make mistakes\nPress Enter to continue…'
const ready = 'Claude Code v2.0.25\nSonnet 4.5 · Claude Pro\n? for shortcuts'
afterEach(() => vi.useRealTimers())

function harness(loginOptions = options) {
  vi.useFakeTimers()
  const data = new Set<(text: string) => void>()
  const exits = new Set<(event: { exitCode: number }) => void>()
  const terminal: LoginTerminal = {
    write: vi.fn(), kill: vi.fn(),
    onData: listener => { data.add(listener); return { dispose: () => { data.delete(listener) } } },
    onExit: listener => { exits.add(listener); return { dispose: () => { exits.delete(listener) } } }
  }
  const dependencies = { spawn: vi.fn(async () => terminal), probe: vi.fn(async () => false) }
  const service = new ClaudeLoginService(dependencies)
  const progress: RuntimeLoginProgress[] = []
  const result = service.login(loginOptions, update => progress.push(update))
  void result.catch(() => {})
  const emit = async (text: string) => {
    await vi.advanceTimersByTimeAsync(0)
    data.forEach(listener => listener(text))
    await vi.advanceTimersByTimeAsync(200)
  }
  return { service, result, dependencies, terminal, progress, emit, data, exits }
}

describe('Claude default login initialization', () => {
  it('uses the dedicated auth flow without waiting for the main Claude interface', async () => {
    const h = harness({ ...options, mode: 'auth-command' })
    await h.emit(`${url}\nOpening browser…`)
    expect(h.progress.at(-1)).toMatchObject({ phase: 'starting', authUrl: url, message: expect.stringContaining('浏览器') })
    expect(h.terminal.write).not.toHaveBeenCalled()
    h.dependencies.probe.mockResolvedValue(true)
    h.exits.forEach(listener => listener({ exitCode: 0 }))
    await vi.advanceTimersByTimeAsync(0)
    await expect(h.result).resolves.toBeUndefined()
    expect(h.progress.at(-1)).toMatchObject({ phase: 'connected' })
    expect(h.dependencies.probe).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports official runtime connectivity failures immediately', async () => {
    const h = harness({ ...options, mode: 'auth-command' })
    await h.emit('Unable to connect to Anthropic services\nFailed to connect to api.anthropic.com: ENOTFOUND')
    await expect(h.result).rejects.toThrow('无法连接 Anthropic 服务')
    expect(h.progress.at(-1)).toMatchObject({ phase: 'error' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['before-login', 'after-login'])('handles trust %s and completes all defaults before reporting connected', async order => {
    const h = harness()
    if (order === 'before-login') await h.emit(trust)
    await h.emit(theme)
    await h.emit(method)
    await h.emit(`${url}\nPaste code here if prompted >`)
    expect(h.progress.at(-1)).toMatchObject({ provider: 'claude', phase: 'awaiting-code', authUrl: url })
    h.dependencies.probe.mockResolvedValue(true)
    await h.emit(success)
    expect(h.progress.at(-1)?.phase).not.toBe('connected')
    await h.emit(security)
    if (order === 'after-login') await h.emit(trust)
    expect(h.progress.at(-1)?.phase).not.toBe('connected')
    await h.emit(ready)
    await expect(h.result).resolves.toBeUndefined()
    expect(h.terminal.write).toHaveBeenCalledTimes(5)
    expect(h.terminal.kill).toHaveBeenCalledOnce()
    expect(h.progress.at(-1)).toMatchObject({ phase: 'connected', authUrl: undefined })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not press Enter again when Ink redraws an already processed prompt', async () => {
    const h = harness()
    await h.emit(trust)
    await h.emit(trust)
    expect(h.terminal.write).toHaveBeenCalledTimes(1)
    await h.emit(`${trust}\n${theme}`)
    expect(h.terminal.write).toHaveBeenCalledTimes(2)
    h.service.cancel()
    await expect(h.result).rejects.toThrow('已取消')
  })

  it('selects the subscription account even when Console is highlighted', async () => {
    const h = harness()
    await h.emit('Select login method:\n1. Claude account with subscription\n> 2. Anthropic Console account')
    expect(h.terminal.write).toHaveBeenNthCalledWith(1, '\x1b[A')
    expect(h.terminal.write).toHaveBeenNthCalledWith(2, '\r')
    h.service.cancel()
    await expect(h.result).rejects.toThrow('已取消')
  })

  it('sends a manual code as bracketed paste followed by a separate Enter and redacts failures', async () => {
    const h = harness()
    await h.emit(`${url}\nPaste code here if prompted >`)
    const id = h.progress[0]!.requestId
    h.service.submit(id, 'secret-code#state')
    expect(h.terminal.write).toHaveBeenLastCalledWith('\x1b[200~secret-code#state\x1b[201~')
    await vi.advanceTimersByTimeAsync(150)
    expect(h.terminal.write).toHaveBeenLastCalledWith('\r')
    await h.emit('secret-code#state invalid_grant')
    await expect(h.result).rejects.toThrow('授权码无效或已过期')
    expect(JSON.stringify(h.progress)).not.toContain('secret-code')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps credentials separate from initialization and can resume an already logged-in session', async () => {
    const h = harness()
    h.dependencies.probe.mockResolvedValue(true)
    await h.emit(trust)
    expect(h.progress.at(-1)?.phase).not.toBe('connected')
    await h.emit(ready)
    await expect(h.result).resolves.toBeUndefined()
    expect(h.terminal.write).toHaveBeenCalledOnce()
  })

  it('uses /login when initialization is complete but account authentication is missing', async () => {
    const h = harness()
    await h.emit(ready)
    expect(h.terminal.write).toHaveBeenCalledWith('/login')
    await h.emit(`${url}\nPaste code here if prompted >`)
    h.service.cancel()
    await expect(h.result).rejects.toThrow('已取消')
  })

  it('rejects stale sessions, injected terminal input, and double submission', async () => {
    const h = harness()
    await h.emit(`${url}\nPaste code here if prompted >`)
    const id = h.progress[0]!.requestId
    for (const value of ['', 'a\rb', 'a\x1b[2J', 'x'.repeat(4097)]) expect(() => h.service.submit(id, value)).toThrow('只粘贴')
    expect(() => h.service.submit('stale', 'code')).toThrow('已结束')
    await expect(h.service.login(options, () => {})).rejects.toThrow('正在进行')
    h.service.submit(id, 'code')
    expect(() => h.service.submit(id, 'code')).toThrow('当前还不能')
    h.service.cancel(id)
    await expect(h.result).rejects.toThrow('已取消')
    await vi.advanceTimersByTimeAsync(1000)
    expect(h.terminal.write).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds unknown prompts without blindly accepting new permissions', async () => {
    const h = harness()
    await h.emit('Do you want to enable unrestricted permissions?\n> 1. Yes\nEnter to confirm')
    expect(h.terminal.write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60_000)
    await expect(h.result).rejects.toThrow('新的确认提示')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('allows three minutes for browser and email verification while bounding the whole session', async () => {
    const h = harness()
    await h.emit(`${url}\nPaste code here if prompted >`)
    await vi.advanceTimersByTimeAsync(2 * 60_000)
    expect(h.progress.at(-1)?.phase).toBe('awaiting-code')
    await vi.advanceTimersByTimeAsync(60_000)
    await expect(h.result).rejects.toThrow('登录超时')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('kills a terminal that arrives after cancellation', async () => {
    vi.useFakeTimers()
    let resolveSpawn!: (terminal: LoginTerminal) => void
    const terminal = { kill: vi.fn() } as unknown as LoginTerminal
    const service = new ClaudeLoginService({ spawn: () => new Promise(resolve => { resolveSpawn = resolve }), probe: async () => false })
    const result = service.login(options, () => {})
    void result.catch(() => {})
    service.cancel()
    resolveSpawn(terminal)
    await expect(result).rejects.toThrow('已取消')
    await vi.advanceTimersByTimeAsync(0)
    expect(terminal.kill).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports startup failures without assuming Git Bash on every platform', async () => {
    const service = new ClaudeLoginService({ spawn: async () => { throw new Error('shell unavailable') }, probe: async () => false })
    const progress: RuntimeLoginProgress[] = []
    await expect(service.login(options, update => progress.push(update))).rejects.toThrow('命令行环境')
    expect(progress.at(-1)).toMatchObject({ phase: 'error', message: expect.not.stringContaining('Git Bash') })
  })

  it('recognizes only complete official authorization URLs', () => {
    expect(claudeAuthUrl(url)).toBeUndefined()
    expect(claudeAuthUrl(`${url}\nPaste code here`)).toBe(url)
    expect(claudeAuthUrl(`\x1b]8;;${url}\x1b\\Sign in\x1b]8;;\x1b\\`)).toBe(url)
    expect(claudeAuthUrl(`${url.replace('claude.ai', 'evil.test')}\n`)).toBeUndefined()
  })

  it('redacts runtime failure details into actionable categories', () => {
    expect(claudeLoginFailure('Failed to connect to api.anthropic.com: ENOTFOUND secret')).toContain('无法连接 Anthropic 服务')
    expect(claudeLoginFailure('Login failed: Failed to start OAuth callback server: Is port 1234 in use?')).toContain('本地登录回调')
    expect(claudeLoginFailure('unrelated terminal output')).toBeUndefined()
  })
})

it('checks isolated legacy OAuth credentials, expiry and scopes without invoking auth as a prompt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'agentflow-claude-account-test-'))
  try {
    await mkdir(directory, { recursive: true })
    const path = join(directory, '.credentials.json')
    await writeFile(path, JSON.stringify({ claudeAiOauth: { accessToken: 'test-only', expiresAt: 2000, scopes: ['user:inference'], subscriptionType: 'pro' } }))
    expect(await readClaudeSubscriptionAccount(directory, 1000)).toMatchObject({ connected: true, planType: 'pro' })
    expect(await readClaudeSubscriptionAccount(directory, 3000)).toEqual({ connected: false })
    await writeFile(path, JSON.stringify({ apiKey: 'test-only' }))
    expect(await readClaudeSubscriptionAccount(directory, 1000)).toEqual({ connected: false })
  } finally { await rm(directory, { recursive: true, force: true }) }
})
