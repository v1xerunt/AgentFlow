import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  authDetails,
  createSubscriptionConnectorDependencies,
  sanitizedSubscriptionEnvironment,
  SubscriptionConnectorService,
  subscriptionRuntimeTemplates,
  type SubscriptionWebBridge
} from './subscription-connectors'
import { DeepSeekWebAuthenticationError } from './deepseek-web-protocol'
import { detectAgentTool } from './agent-tool-runner'

const temporaryDirectories: string[] = []
vi.mock('./agent-tool-runner', async importOriginal => ({ ...await importOriginal<typeof import('./agent-tool-runner')>(), detectAgentTool: vi.fn(async () => ({ installed: false })) }))
afterEach(async () => {
  vi.mocked(detectAgentTool).mockReset().mockResolvedValue({ installed: false })
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('subscription connectors', () => {
  it('waits for Claude initialization and preserves its incomplete state across refresh', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-claude-connector-'))
    temporaryDirectories.push(directory)
    let complete!: () => void
    let started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const dependencies = {
      ...createSubscriptionConnectorDependencies(async () => {}),
      runProcess: vi.fn(async (_command: string, args: string[]) => ({ code: 0, stdout: args.includes('--help') ? 'Commands:\n  auth  Manage authentication\n' : args[0] === 'auth' ? JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'pro' }) : '2.1.test', stderr: '' })),
      loginClaude: vi.fn(async () => { started(); await new Promise<void>(resolve => { complete = resolve }) })
    }
    const service = new SubscriptionConnectorService(directory, dependencies)
    vi.spyOn(service as unknown as { install(): Promise<string> }, 'install').mockResolvedValue(process.execPath)
    const connection = service.connect('subscription:claude-code', () => {})
    await ready
    const restarted = new SubscriptionConnectorService(directory, dependencies)
    expect((await restarted.refresh()).find(item => item.id === 'subscription:claude-code')?.connected).toBe(false)
    expect(dependencies.loginClaude).toHaveBeenCalledWith(process.execPath, expect.objectContaining({ cwd: join(directory, 'subscription-connectors', 'claude-code', 'login-workspace'), env: expect.objectContaining({ CLAUDE_CONFIG_DIR: join(directory, 'subscription-connectors', 'claude-code', 'profile') }) }), expect.any(Function))
    complete()
    expect((await connection).find(item => item.id === 'subscription:claude-code')?.connected).toBe(true)
    const after = new SubscriptionConnectorService(directory, dependencies)
    expect((await after.refresh()).find(item => item.id === 'subscription:claude-code')?.connected).toBe(true)
  })

  it('never invokes unsupported auth status commands and rejects Console authentication', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-claude-command-'))
    temporaryDirectories.push(directory)
    const runProcess = vi.fn(async (_command: string, _args: string[]) => ({ code: 0, stdout: 'Commands:\n  mcp Manage servers\n  setup-token Setup a token', stderr: '' }))
    const service = new SubscriptionConnectorService(directory, { ...createSubscriptionConnectorDependencies(async () => {}), runProcess })
    expect(await service.claudeAccount(process.execPath)).toEqual({ connected: false })
    expect(runProcess).toHaveBeenCalledTimes(1)
    expect(runProcess.mock.calls[0]?.[1]).toEqual(['--help'])
    const consoleRuntime = new SubscriptionConnectorService(directory, {
      ...createSubscriptionConnectorDependencies(async () => {}),
      runProcess: async (_command, args) => ({ code: 0, stdout: args.includes('--help') ? 'Commands:\n  auth Manage auth' : JSON.stringify({ loggedIn: true, authMethod: 'api_key' }), stderr: '' })
    })
    expect((await consoleRuntime.claudeAccount(process.execPath)).connected).toBe(false)
  })

  it('saves runtime ownership before login, preserving it across restart and cancellation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-install-record-'))
    temporaryDirectories.push(directory)
    let finishLogin!: () => void
    let loginStarted!: () => void
    const started = new Promise<void>(resolve => { loginStarted = resolve })
    const dependencies = {
      ...createSubscriptionConnectorDependencies(async () => {}),
      runProcess: vi.fn(async () => ({ code: 0, stdout: '1.1.25', stderr: '' })),
      loginAntigravity: vi.fn(async () => {
        loginStarted()
        await new Promise<void>(resolve => { finishLogin = resolve })
        throw new Error('已取消 Google 登录。')
      })
    }
    const service = new SubscriptionConnectorService(directory, dependencies)
    vi.spyOn(service as unknown as { install(): Promise<string> }, 'install').mockResolvedValue(process.execPath)
    const connection = service.connect('subscription:antigravity', () => {})
    const rejected = expect(connection).rejects.toThrow('已取消')
    await started
    const saved = JSON.parse(await readFile(join(directory, 'subscription-connectors', 'state.json'), 'utf8'))
    expect(saved.connectors.find((item: { id: string }) => item.id === 'subscription:antigravity')).toMatchObject({ runtimeCommand: process.execPath, installedByAgentFlow: true, connected: false, systemToolInstalled: false })
    const restarted = new SubscriptionConnectorService(directory, dependencies)
    expect((await restarted.snapshot()).find(item => item.id === 'subscription:antigravity')).toMatchObject({ installed: true, connected: false, status: 'needs-login' })
    vi.mocked(detectAgentTool).mockResolvedValue({ installed: true, resolvedCommand: process.execPath })
    dependencies.runProcess.mockResolvedValue({ code: 1, stdout: '', stderr: 'Please sign in' })
    expect((await restarted.refresh()).find(item => item.id === 'subscription:antigravity')).toMatchObject({ installed: true, connected: false, systemToolInstalled: false, status: 'needs-login' })
    await expect(service.connect('subscription:antigravity', () => {})).rejects.toThrow('正在连接')
    finishLogin()
    await rejected
    expect((await new SubscriptionConnectorService(directory).snapshot()).find(item => item.id === 'subscription:antigravity')).toMatchObject({ installed: true, connected: false, systemToolInstalled: false })
  })

  it('does not adopt an existing system CLI or install a second copy', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-existing-runtime-'))
    temporaryDirectories.push(directory)
    vi.mocked(detectAgentTool).mockResolvedValue({ installed: true, resolvedCommand: process.execPath })
    const dependencies = { ...createSubscriptionConnectorDependencies(async () => {}), fetchText: vi.fn(), loginAntigravity: vi.fn() }
    const service = new SubscriptionConnectorService(directory, dependencies)
    await expect(service.connect('subscription:antigravity', () => {})).rejects.toThrow('本机 Agent 工具')
    expect(dependencies.fetchText).not.toHaveBeenCalled()
    expect(dependencies.loginAntigravity).not.toHaveBeenCalled()
    expect((await service.snapshot()).find(item => item.id === 'subscription:antigravity')).toMatchObject({ installed: false, systemToolInstalled: true })
  })

  it('checks Antigravity login with models instead of starting an interactive prompt', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-auth-probe-'))
    temporaryDirectories.push(directory)
    const runProcess = vi.fn(async () => ({ code: 1, stdout: '', stderr: 'Please sign in to view available models.' }))
    const service = new SubscriptionConnectorService(directory, { ...createSubscriptionConnectorDependencies(async () => {}), runProcess })
    expect(await service.isAntigravityAuthenticated(process.execPath)).toBe(false)
    expect(runProcess).toHaveBeenCalledWith(process.execPath, ['models'], expect.objectContaining({ timeoutMs: 20_000 }))
    runProcess.mockResolvedValue({ code: 0, stdout: 'Available models: gemini', stderr: '' })
    expect(await service.isAntigravityAuthenticated(process.execPath)).toBe(true)
  })

  it('preserves a connected web account across restart and temporary probe failure', async () => {
    const { service, web, directory } = await webService()
    await service.connect('subscription:deepseek-web', () => {}, { acceptExperimentalRisk: true })
    const restarted = new SubscriptionConnectorService(directory, { ...createSubscriptionConnectorDependencies(async () => {}), deepSeekWeb: web })
    vi.mocked(web.probe).mockRejectedValueOnce(new Error('Network offline'))
    expect((await restarted.refresh()).at(-1)).toMatchObject({ connected: true, status: 'connected', detail: expect.stringContaining('暂时无法验证') })
    expect((await new SubscriptionConnectorService(directory).snapshot()).at(-1)).toMatchObject({ connected: true })
    expect((await restarted.refresh()).at(-1)).toMatchObject({ connected: true, detail: undefined })
  })

  it('requires reconnection when the web service confirms authentication expired', async () => {
    const { service, web } = await webService()
    await service.connect('subscription:deepseek-web', () => {}, { acceptExperimentalRisk: true })
    vi.mocked(web.probe).mockResolvedValueOnce({ connected: false })
    expect((await service.refresh()).at(-1)).toMatchObject({ connected: false, status: 'error', detail: expect.stringContaining('登录已失效') })
  })

  it('isolates provider state and passes only an allowlisted environment', () => {
    const source = {
      PATH: 'runtime-path',
      TEMP: 'runtime-temp',
      OPENAI_API_KEY: 'must-not-leak',
      ANTHROPIC_API_KEY: 'must-not-leak',
      GEMINI_API_KEY: 'must-not-leak',
      AGENTFLOW_UNRELATED_SECRET: 'must-not-leak'
    }
    expect(sanitizedSubscriptionEnvironment('subscription:codex', 'C:\\profiles\\codex', source)).toEqual({
      PATH: 'runtime-path',
      TEMP: 'runtime-temp',
      CODEX_HOME: 'C:\\profiles\\codex',
      CODEX_SQLITE_HOME: 'C:\\profiles\\codex'
    })
    expect(sanitizedSubscriptionEnvironment('subscription:claude-code', 'C:\\profiles\\claude', source)).toMatchObject({
      CLAUDE_CONFIG_DIR: 'C:\\profiles\\claude',
      CLAUDE_CODE_AUTO_CONNECT_IDE: 'false'
    })
    expect(sanitizedSubscriptionEnvironment('subscription:kimi-code', 'C:\\profiles\\kimi', source)).toMatchObject({ KIMI_CODE_HOME: 'C:\\profiles\\kimi' })
  })

  it('uses output-only policies and resumable structured output commands', () => {
    expect(subscriptionRuntimeTemplates('subscription:codex').args).toContain('read-only')
    expect(subscriptionRuntimeTemplates('subscription:claude-code').args).toEqual(expect.arrayContaining(['--bare', 'dontAsk', 'stream-json']))
    expect(subscriptionRuntimeTemplates('subscription:kimi-code').resumeArgs).toEqual(expect.arrayContaining(['-r', '{session}', 'stream-json']))
    expect(subscriptionRuntimeTemplates('subscription:antigravity').args).toEqual(expect.arrayContaining(['--sandbox', 'stream-json']))
    expect(subscriptionRuntimeTemplates('subscription:antigravity').resumeArgs).toEqual(expect.arrayContaining(['--conversation', '{session}']))
  })

  it('extracts browser URLs and device codes without including surrounding terminal text', () => {
    expect(authDetails('Open https://auth.example.test/device and enter ABCD-1234.')).toEqual({
      url: 'https://auth.example.test/device',
      userCode: 'ABCD-1234'
    })
  })

  it('publishes five separate connectors and exposes a connected runtime to the catalog layer', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-subscriptions-'))
    temporaryDirectories.push(directory)
    const statePath = join(directory, 'subscription-connectors', 'state.json')
    await mkdir(dirname(statePath), { recursive: true })
    await writeFile(statePath, JSON.stringify({
      version: 1,
      connectors: [
        { id: 'subscription:codex', runtimeCommand: process.execPath, runtimeVersion: 'test', installedByAgentFlow: true, connected: true },
        { id: 'subscription:claude-code' },
        { id: 'subscription:kimi-code' },
        { id: 'subscription:antigravity' }
      ]
    }), 'utf8')
    const service = new SubscriptionConnectorService(directory)
    const snapshot = await service.snapshot()
    expect(snapshot.map((connector) => connector.id)).toEqual([
      'subscription:codex',
      'subscription:claude-code',
      'subscription:kimi-code',
      'subscription:antigravity',
      'subscription:deepseek-web'
    ])
    expect(snapshot[0]).toMatchObject({ connected: true, status: 'connected', models: ['@tool-default'] })
    await expect(service.runtime('subscription:codex')).resolves.toMatchObject({ command: process.execPath, enabled: true })
    expect(snapshot[4]).toMatchObject({ transport: 'web', experimental: true, riskAccepted: false, connected: false, installed: false })
  })

  it('requires explicit risk acceptance before starting the web login', async () => {
    const { service, web } = await webService()
    await expect(service.connect('subscription:deepseek-web', () => {})).rejects.toThrow('实验性风险')
    expect(web.connect).not.toHaveBeenCalled()
    await expect(service.invokeWeb(webRequest, () => {})).rejects.toThrow('请先')
  })

  it('persists acceptance and connection independently of installed runtimes', async () => {
    const { service, web, directory } = await webService()
    const snapshot = await service.connect('subscription:deepseek-web', () => {}, { acceptExperimentalRisk: true })
    expect(snapshot.at(-1)).toMatchObject({ riskAccepted: true, connected: true, installed: false, status: 'connected' })
    const saved = await readFile(join(directory, 'subscription-connectors', 'state.json'), 'utf8')
    expect(saved).toContain('"riskAccepted": true')
    await service.disconnect('subscription:deepseek-web')
    expect(web.disconnect).toHaveBeenCalledOnce()
    await service.connect('subscription:deepseek-web', () => {})
    expect(web.connect).toHaveBeenCalledTimes(2)
    await expect(service.runtime('subscription:deepseek-web')).rejects.toThrow('不使用本机运行时')
  })

  it('exposes failed login status and retains the accepted risk choice', async () => {
    const { service, web } = await webService()
    vi.mocked(web.connect).mockRejectedValueOnce(new Error('登录窗口已关闭'))
    await expect(service.connect('subscription:deepseek-web', () => {}, { acceptExperimentalRisk: true })).rejects.toThrow('登录窗口已关闭')
    expect((await service.snapshot()).at(-1)).toMatchObject({ connected: false, riskAccepted: true, status: 'error', detail: '登录窗口已关闭' })
  })

  it('routes web requests and marks expired accounts as needing reconnection', async () => {
    const { service, web } = await webService()
    await service.connect('subscription:deepseek-web', () => {}, { acceptExperimentalRisk: true })
    await expect(service.invokeWeb(webRequest, () => {})).resolves.toMatchObject({ content: 'ok' })
    vi.mocked(web.invoke).mockRejectedValueOnce(new DeepSeekWebAuthenticationError('请重新连接 DeepSeek'))
    await expect(service.invokeWeb(webRequest, () => {})).rejects.toThrow('重新连接')
    expect((await service.snapshot()).at(-1)).toMatchObject({ connected: false, status: 'error' })
  })
})

const webRequest = { providerId: 'subscription:deepseek-web', model: 'deepseek-chat', messages: [{ role: 'user' as const, content: 'hello' }] }

async function webService() {
  const directory = await mkdtemp(join(tmpdir(), 'agentflow-subscriptions-web-'))
  temporaryDirectories.push(directory)
  const web: SubscriptionWebBridge = {
    probe: vi.fn(async () => ({ connected: true })),
    connect: vi.fn(async () => ({ connected: true })),
    disconnect: vi.fn(async () => undefined),
    invoke: vi.fn(async () => ({ content: 'ok', providerId: 'subscription:deepseek-web', model: 'deepseek-chat' }))
  }
  return { directory, web, service: new SubscriptionConnectorService(directory, { ...createSubscriptionConnectorDependencies(async () => {}), deepSeekWeb: web }) }
}
