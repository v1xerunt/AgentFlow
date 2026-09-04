import { t } from '@agentflow/core/localization'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import type { ModelInvocationRequest, ModelInvocationResult } from '@agentflow/core'
import type {
  SubscriptionConnectorConfiguration,
  SubscriptionConnectorConnectOptions,
  SubscriptionConnectorId,
  SubscriptionConnectorProgress,
  RuntimeLoginProgress
} from '../shared/llm'
import { detectAgentTool, type AgentToolRuntimeConfiguration } from './agent-tool-runner'
import { DeepSeekWebAuthenticationError } from './deepseek-web-protocol'
import { readClaudeSubscriptionAccount, type ClaudeAccount, type ClaudeLoginOptions } from './claude-login'
import { spawnManaged, terminateProcessTree } from './platform-process'
import { isWithinDirectory, resolveWorkspaceTarget } from './workspace-paths'
import { atomicWriteFile } from './atomic-file'

type ProgressReporter = (progress: SubscriptionConnectorProgress) => void

interface StoredConnector {
  id: SubscriptionConnectorId
  runtimeCommand?: string
  runtimeVersion?: string
  installedByAgentFlow?: boolean
  initializationComplete?: boolean
  connected?: boolean
  systemToolInstalled?: boolean
  accountLabel?: string
  planType?: string
  detail?: string
  updatedAt?: string
  riskAccepted?: boolean
}

interface StoredSubscriptions {
  version: 1
  connectors: StoredConnector[]
}

interface ConnectorPreset {
  id: SubscriptionConnectorId
  name: string
  accountName: string
  description: string
  quotaDescription: string
  manualInstallUrl: string
  command: string
  systemToolId: string
  installer: { windows: string; unix: string; windowsArgs?: string[]; unixArgs?: string[] }
}

interface ProcessResult { code: number; stdout: string; stderr: string }
interface AccountProbe { connected: boolean; accountLabel?: string; planType?: string }

export interface SubscriptionWebBridge {
  probe(): Promise<AccountProbe>
  connect(report: ProgressReporter): Promise<AccountProbe>
  disconnect(): Promise<void>
  invoke(request: ModelInvocationRequest, onDelta: (delta: string) => void, signal?: AbortSignal): Promise<ModelInvocationResult>
}

export interface SubscriptionConnectorDependencies {
  fetchText(url: string): Promise<string>
  openExternal(url: string): Promise<void>
  runProcess(command: string, args: string[], options: ProcessOptions): Promise<ProcessResult>
  spawnProcess(command: string, args: string[], options: ProcessOptions): ChildProcessWithoutNullStreams
  loginAntigravity?(command: string, options: ProcessOptions, report: (progress: RuntimeLoginProgress) => void): Promise<void>
  loginClaude?(command: string, options: ClaudeLoginOptions, report: (progress: RuntimeLoginProgress) => void): Promise<void>
  now(): string
  deepSeekWeb?: SubscriptionWebBridge
}

interface ProcessOptions {
  cwd: string
  env: NodeJS.ProcessEnv
  stdin?: string
  timeoutMs?: number
  onOutput?: (text: string, source: 'stdout' | 'stderr') => void
}

const PRESETS: ConnectorPreset[] = [
  {
    id: 'subscription:codex',
    name: 'ChatGPT（Codex）',
    accountName: 'ChatGPT',
    get description() { return t("Connect your ChatGPT account through the official Codex runtime.") },
    get quotaDescription() { return t("Uses the Codex allowance included in your ChatGPT plan.") },
    manualInstallUrl: 'https://learn.chatgpt.com/docs/codex/cli',
    command: 'codex',
    systemToolId: 'agent-tool:codex',
    installer: { windows: 'https://chatgpt.com/codex/install.ps1', unix: 'https://chatgpt.com/codex/install.sh' }
  },
  {
    id: 'subscription:claude-code',
    name: 'Claude（Claude Code）',
    accountName: 'Claude',
    get description() { return t("Connect your Claude account through the official Claude Code runtime.") },
    get quotaDescription() { return t("Uses the Claude Code allowance in Claude Pro, Max, Team, or Enterprise.") },
    manualInstallUrl: 'https://code.claude.com/docs/en/installation',
    command: 'claude',
    systemToolId: 'agent-tool:claude-code',
    installer: { windows: 'https://claude.ai/install.ps1', unix: 'https://claude.ai/install.sh' }
  },
  {
    id: 'subscription:kimi-code',
    name: 'Kimi（Kimi Code）',
    accountName: 'Kimi',
    get description() { return t("Connect your Kimi account with device-code login through the official Kimi Code CLI.") },
    get quotaDescription() { return t("Uses your Kimi Code subscription allowance. Git Bash is required on Windows.") },
    manualInstallUrl: 'https://www.kimi.com/code/docs/en/kimi-code-cli/guides/getting-started.html',
    command: 'kimi',
    systemToolId: 'agent-tool:kimi-code',
    installer: { windows: 'https://code.kimi.com/kimi-code/install.ps1', unix: 'https://code.kimi.com/kimi-code/install.sh' }
  },
  {
    id: 'subscription:antigravity',
    name: 'Gemini（Antigravity）',
    accountName: 'Google',
    get description() { return t("Connect your Google account through the official Antigravity CLI.") },
    get quotaDescription() { return t("Uses your Antigravity / Gemini account allowance.") },
    manualInstallUrl: 'https://antigravity.google/docs/cli/install/',
    command: 'agy',
    systemToolId: 'agent-tool:antigravity',
    installer: {
      windows: 'https://antigravity.google/cli/install.ps1',
      unix: 'https://antigravity.google/cli/install.sh'
    }
  }
]

const DEEPSEEK_WEB_PRESET = {
  id: 'subscription:deepseek-web' as const,
  name: 'DeepSeek（Web Bridge）',
  accountName: 'DeepSeek',
  get description() { return t("Sign in to your DeepSeek web account in a dedicated browser.") },
  get quotaDescription() { return t("Uses the DeepSeek web service. This experimental connection may stop working after web protocol or account security changes.") },
  models: ['deepseek-chat', 'deepseek-reasoner']
}

const API_ENVIRONMENT_KEYS = new Set([
  'OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL', 'ANTHROPIC_VERTEX_PROJECT_ID',
  'ANTHROPIC_VERTEX_BASE_URL', 'ANTHROPIC_BEDROCK_BASE_URL', 'ANTHROPIC_FOUNDRY_API_KEY',
  'ANTHROPIC_FOUNDRY_BASE_URL', 'ANTHROPIC_FOUNDRY_RESOURCE',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY',
  'KIMI_API_KEY', 'MOONSHOT_API_KEY', 'MOONSHOT_BASE_URL',
  'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GEMINI_BASE_URL', 'AGY_ADC_AUTH'
])

const RUNTIME_ENVIRONMENT_KEYS = new Set([
  'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC',
  'TEMP', 'TMP', 'TMPDIR', 'USERPROFILE', 'HOME', 'HOMEDRIVE', 'HOMEPATH',
  'APPDATA', 'LOCALAPPDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432',
  'PROCESSOR_ARCHITECTURE', 'PROCESSOR_IDENTIFIER', 'NUMBER_OF_PROCESSORS',
  'LANG', 'LANGUAGE', 'LC_ALL', 'TERM', 'COLORTERM', 'SHELL',
  'DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY', 'DBUS_SESSION_BUS_ADDRESS',
  'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'XDG_CURRENT_DESKTOP', 'DESKTOP_SESSION', 'BROWSER',
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS'
])

export class SubscriptionConnectorService {
  private state?: StoredSubscriptions
  private connecting = new Set<SubscriptionConnectorId>()
  private claudeAuthCommands = new Map<string, Promise<boolean>>()

  constructor(
    private readonly storeDirectory: string,
    private readonly dependencies: SubscriptionConnectorDependencies = defaultDependencies()
  ) {}

  async managedRuntimeCommands(): Promise<string[]> {
    return (await this.load()).connectors.flatMap(connector => connector.runtimeCommand ? [connector.runtimeCommand] : [])
  }

  async snapshot(): Promise<SubscriptionConnectorConfiguration[]> {
    const state = await this.load()
    const runtimes: SubscriptionConnectorConfiguration[] = await Promise.all(PRESETS.map(async (preset) => {
      const stored = state.connectors.find((candidate) => candidate.id === preset.id) ?? { id: preset.id }
      const installed = Boolean(stored.runtimeCommand && await executableExists(stored.runtimeCommand))
      const connected = installed && Boolean(stored.connected)
      const status = connected
        ? 'connected'
        : stored.systemToolInstalled && !installed
          ? 'system-tool-found'
          : stored.detail
            ? 'error'
            : installed
              ? 'needs-login'
              : 'not-installed'
      return {
        id: preset.id,
        name: preset.name,
        accountName: preset.accountName,
        description: preset.description,
        quotaDescription: preset.quotaDescription,
        transport: 'runtime' as const,
        experimental: false,
        riskAccepted: false,
        manualInstallUrl: preset.manualInstallUrl,
        status,
        installed,
        connected,
        systemToolInstalled: Boolean(stored.systemToolInstalled),
        runtimeVersion: stored.runtimeVersion,
        accountLabel: stored.accountLabel,
        planType: stored.planType,
        detail: stored.detail,
        models: ['@tool-default']
      }
    }))
    const web = this.stored(state, DEEPSEEK_WEB_PRESET.id)
    return [...runtimes, {
      ...DEEPSEEK_WEB_PRESET,
      transport: 'web',
      experimental: true,
      riskAccepted: Boolean(web.riskAccepted),
      installed: false,
      connected: Boolean(web.connected && web.riskAccepted),
      systemToolInstalled: false,
      status: web.connected && web.riskAccepted ? 'connected' : web.detail ? 'error' : 'needs-login',
      detail: web.detail
    }]
  }

  async refresh(): Promise<SubscriptionConnectorConfiguration[]> {
    const state = await this.load()
    await Promise.all(PRESETS.map(async (preset) => {
      if (this.connecting.has(preset.id)) return
      const stored = this.stored(state, preset.id)
      const ownedCommand = stored.runtimeCommand && await executableExists(stored.runtimeCommand) ? stored.runtimeCommand : undefined
      const detected = await detectAgentTool({ id: preset.systemToolId, name: preset.name, command: preset.command })
      stored.systemToolInstalled = Boolean(detected.installed && (!ownedCommand || !await samePath(detected.resolvedCommand, ownedCommand)))
      if (!ownedCommand) {
        stored.connected = false
        return
      }
      await mkdir(this.profileRoot(preset.id), { recursive: true })
      stored.runtimeVersion = await this.version(ownedCommand, preset.id).catch(() => stored.runtimeVersion)
      const account: AccountProbe = await this.probeAccount(preset.id, ownedCommand).catch(() => ({ connected: false }))
      stored.connected = account.connected && (preset.id !== 'subscription:claude-code' || stored.initializationComplete !== false)
      stored.accountLabel = account.accountLabel
      stored.planType = account.planType
      if (stored.connected) stored.detail = undefined
    }))
    const web = this.stored(state, DEEPSEEK_WEB_PRESET.id)
    if (web.riskAccepted && this.dependencies.deepSeekWeb) {
      try {
        const account = await this.dependencies.deepSeekWeb.probe()
        web.connected = account.connected
        web.detail = account.connected ? undefined : t("DeepSeek login has expired. Reconnect to continue.")
      } catch {
        web.detail = t("Could not verify DeepSeek status. Your login is retained; refresh shortly.")
      }
    }
    await this.persist(state)
    return this.snapshot()
  }

  async connect(connectorId: SubscriptionConnectorId, report: ProgressReporter, options?: SubscriptionConnectorConnectOptions, runtimeReport: (progress: RuntimeLoginProgress) => void = () => {}): Promise<SubscriptionConnectorConfiguration[]> {
    if (connectorId === DEEPSEEK_WEB_PRESET.id) return this.connectWeb(report, options)
    const preset = connectorPreset(connectorId)
    if (this.connecting.has(connectorId)) throw new Error(t("{0} is connecting. Complete the current login first.", [preset.name]))
    const state = await this.load()
    if (this.connecting.has(connectorId)) throw new Error(t("{0} is connecting. Complete the current login first.", [preset.name]))
    this.connecting.add(connectorId)
    const stored = this.stored(state, connectorId)
    try {
      report({ connectorId, phase: 'preparing', message: t("Checking the {0} runtime…", [preset.name]) })
      let command = stored.runtimeCommand && await executableExists(stored.runtimeCommand) ? stored.runtimeCommand : undefined
      if (!command) {
        const detected = await detectAgentTool({ id: preset.systemToolId, name: preset.name, command: preset.command })
        if (detected.installed) {
          stored.systemToolInstalled = true
          stored.detail = t("{0} is already installed. Configure the existing installation in “Local Agent tools”.", [preset.name])
          await this.persist(state)
          throw new Error(stored.detail)
        }
        if (connectorId === 'subscription:kimi-code') await this.ensureKimiShell(report)
        command = await this.install(preset, report)
        stored.runtimeCommand = command
        stored.installedByAgentFlow = true
        stored.systemToolInstalled = false
        stored.connected = false
        stored.detail = undefined
        stored.updatedAt = this.dependencies.now()
        await this.persist(state)
      }
      await mkdir(this.profileRoot(connectorId), { recursive: true })
      stored.runtimeVersion = await this.version(command, connectorId)
      if (connectorId === 'subscription:claude-code') {
        stored.initializationComplete = false
        stored.connected = false
        await this.persist(state)
      }
      report({ connectorId, phase: 'login', message: t("Sign in to {0} in your browser.", [preset.accountName]) })
      const account = await this.login(connectorId, command, report, runtimeReport)
      stored.connected = true
      if (connectorId === 'subscription:claude-code') stored.initializationComplete = true
      stored.accountLabel = account.accountLabel
      stored.planType = account.planType
      stored.detail = undefined
      stored.updatedAt = this.dependencies.now()
      await this.persist(state)
      report({ connectorId, phase: 'connected', message: t("{0} connected.", [preset.name]) })
      return this.snapshot()
    } catch (error) {
      const message = error instanceof Error ? error.message : t("{0} connection failed", [preset.name])
      stored.connected = false
      stored.detail = message
      stored.updatedAt = this.dependencies.now()
      await this.persist(state)
      report({ connectorId, phase: 'error', message })
      throw error
    } finally {
      this.connecting.delete(connectorId)
    }
  }

  async disconnect(connectorId: SubscriptionConnectorId): Promise<SubscriptionConnectorConfiguration[]> {
    if (!isSubscriptionProviderId(connectorId)) throw new Error(t("Subscription connector does not exist"))
    const state = await this.load()
    const stored = this.stored(state, connectorId)
    const command = stored.runtimeCommand
    if (connectorId === DEEPSEEK_WEB_PRESET.id) await this.dependencies.deepSeekWeb?.disconnect()
    else if (command && await executableExists(command)) await this.logout(connectorId, command)
    stored.connected = false
    stored.accountLabel = undefined
    stored.planType = undefined
    stored.detail = undefined
    stored.updatedAt = this.dependencies.now()
    await this.persist(state)
    return this.snapshot()
  }

  async runtime(providerId: string, model?: string, reasoning?: string): Promise<AgentToolRuntimeConfiguration> {
    const connectorId = subscriptionConnectorId(providerId)
    if (connectorId === DEEPSEEK_WEB_PRESET.id) throw new Error(t("DeepSeek Web Bridge uses a web session"))
    const preset = connectorPreset(connectorId)
    const state = await this.load()
    const stored = this.stored(state, connectorId)
    if (!stored.connected || !stored.runtimeCommand || !await executableExists(stored.runtimeCommand)) {
      throw new Error(t("Connect {0} in “Subscription accounts” first", [preset.name]))
    }
    await mkdir(this.profileRoot(connectorId), { recursive: true })
    const selectedModel = model && model !== '@tool-default' ? model : undefined
    const templates = subscriptionRuntimeTemplates(connectorId, selectedModel, reasoning)
    return {
      id: connectorId,
      name: preset.name,
      enabled: true,
      command: stored.runtimeCommand,
      model: selectedModel,
      reasoning,
      args: templates.args,
      resumeArgs: templates.resumeArgs,
      env: this.environment(connectorId, stored.runtimeCommand)
    }
  }

  async invokeWeb(request: ModelInvocationRequest, onDelta: (delta: string) => void, signal?: AbortSignal) {
    if (request.providerId !== DEEPSEEK_WEB_PRESET.id) throw new Error(t("Web connector does not exist"))
    const stored = this.stored(await this.load(), DEEPSEEK_WEB_PRESET.id)
    if (!stored.connected || !stored.riskAccepted) throw new Error(t("Connect DeepSeek Web Bridge in Settings → Subscription accounts first."))
    if (!this.dependencies.deepSeekWeb) throw new Error(t("DeepSeek Web Bridge is unavailable in this environment"))
    try { return await this.dependencies.deepSeekWeb.invoke(request, onDelta, signal) }
    catch (error) {
      if (error instanceof DeepSeekWebAuthenticationError) {
        stored.connected = false
        stored.detail = error.message
        await this.persist(await this.load())
      }
      throw error
    }
  }

  private async connectWeb(report: ProgressReporter, options?: SubscriptionConnectorConnectOptions) {
    const connectorId = DEEPSEEK_WEB_PRESET.id
    const state = await this.load()
    const stored = this.stored(state, connectorId)
    if (!stored.riskAccepted && options?.acceptExperimentalRisk !== true) throw new Error(t("Accept the experimental risks of DeepSeek Web Bridge first."))
    if (!this.dependencies.deepSeekWeb) throw new Error(t("DeepSeek Web Bridge is unavailable in this environment"))
    stored.riskAccepted = true
    await this.persist(state)
    try {
      const account = await this.dependencies.deepSeekWeb.connect(report)
      if (!account.connected) throw new Error(t("DeepSeek login is incomplete. Reconnect to continue."))
      stored.connected = true
      stored.detail = undefined
      stored.updatedAt = this.dependencies.now()
      await this.persist(state)
      report({ connectorId, phase: 'connected', message: t("DeepSeek connected. The dedicated browser session is saved.") })
      return this.snapshot()
    } catch (error) {
      const message = error instanceof Error ? error.message : t("DeepSeek connection failed")
      stored.connected = false
      stored.detail = message
      stored.updatedAt = this.dependencies.now()
      await this.persist(state)
      report({ connectorId, phase: 'error', message })
      throw error
    }
  }

  async createInvocationWorkspace(requestId: string) {
    if (!/^[a-zA-Z0-9:_-]{8,100}$/.test(requestId)) throw new Error(t("Invalid subscription request id"))
    const directory = join(this.root(), 'workspaces', requestId.replaceAll(':', '_'))
    await mkdir(directory, { recursive: true })
    return directory
  }

  async removeInvocationWorkspace(directory: string) {
    const root = resolve(join(this.root(), 'workspaces'))
    const target = resolve(directory)
    const child = relative(root, target)
    if (!isWithinDirectory(root, target)) return
    await rm(await resolveWorkspaceTarget(root, child), { recursive: true, force: true })
  }

  private async install(preset: ConnectorPreset, report: ProgressReporter) {
    const connectorRoot = this.connectorRoot(preset.id)
    await mkdir(connectorRoot, { recursive: true })
    const windows = process.platform === 'win32'
    const url = windows ? preset.installer.windows : preset.installer.unix
    const extension = windows ? 'ps1' : 'sh'
    const scriptPath = join(connectorRoot, `installer-${Date.now()}.${extension}`)
    report({ connectorId: preset.id, phase: 'downloading', message: t("Downloading the official {0} installer…", [preset.name]) })
    const script = await this.dependencies.fetchText(url)
    if (!script.trim() || script.length > 2_000_000) throw new Error(t("The {0} installer is invalid", [preset.name]))
    await writeFile(scriptPath, script, 'utf8')
    report({ connectorId: preset.id, phase: 'installing', message: t("Installing {0} in the background…", [preset.name]) })
    const environment = this.environment(preset.id)
    const managedInstallDirectory = preset.id === 'subscription:antigravity' ? join(connectorRoot, 'bin') : undefined
    const installerArgs = managedInstallDirectory
      ? ['--dir', managedInstallDirectory]
      : windows ? (preset.installer.windowsArgs ?? []) : (preset.installer.unixArgs ?? [])
    let command: string
    let args: string[]
    if (windows) {
      command = powershellCommand()
      args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...installerArgs]
    } else {
      command = '/bin/bash'
      args = [scriptPath, ...installerArgs]
    }
    if (preset.id === 'subscription:codex') {
      const installDirectory = join(connectorRoot, 'bin')
      await mkdir(installDirectory, { recursive: true })
      environment.CODEX_INSTALL_DIR = installDirectory
      environment.CODEX_NON_INTERACTIVE = '1'
    }
    try {
      const result = await this.dependencies.runProcess(command, args, { cwd: connectorRoot, env: environment, timeoutMs: 10 * 60_000 })
      if (result.code !== 0) throw new Error(t("{0} installation failed: {1}", [preset.name, processDetail(result)]))
    } finally {
      await rm(scriptPath, { force: true })
    }
    const installed = await this.findInstalledCommand(preset)
    if (!installed) throw new Error(t("{0} was installed, but its executable was not found", [preset.name]))
    return installed
  }

  private async ensureKimiShell(report: ProgressReporter) {
    if (process.platform !== 'win32' || findKimiShell()) return
    await mkdir(this.connectorRoot('subscription:kimi-code'), { recursive: true })
    report({ connectorId: 'subscription:kimi-code', phase: 'installing', message: t("Preparing Git Bash for Kimi Code…") })
    const environment = sanitizedSubscriptionEnvironment('subscription:kimi-code', this.profileRoot('subscription:kimi-code'), process.env)
    const result = await this.dependencies.runProcess('winget.exe', [
      'install', '--id', 'Git.Git', '--exact', '--scope', 'user', '--silent',
      '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'
    ], { cwd: this.connectorRoot('subscription:kimi-code'), env: environment, timeoutMs: 15 * 60_000 }).catch((error) => ({ code: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) }))
    if (result.code !== 0 || !findKimiShell()) throw new Error(t("Kimi Code requires Git Bash on Windows. Automatic setup failed: {0}", [processDetail(result)]))
  }

  private async findInstalledCommand(preset: ConnectorPreset) {
    const candidates = expectedCommands(preset.id, this.connectorRoot(preset.id))
    for (const command of candidates) {
      if (!await executableExists(command)) continue
      const result = await this.dependencies.runProcess(command, ['--version'], { cwd: this.connectorRoot(preset.id), env: this.environment(preset.id, command), timeoutMs: 10_000 }).catch(() => undefined)
      if (result?.code === 0) return command
    }
    return undefined
  }

  private async version(command: string, connectorId: SubscriptionConnectorId) {
    const result = await this.dependencies.runProcess(command, ['--version'], { cwd: this.connectorRoot(connectorId), env: this.environment(connectorId, command), timeoutMs: 10_000 })
    if (result.code !== 0) throw new Error(t("Could not start {0}: {1}", [command, processDetail(result)]))
    return (result.stdout || result.stderr).trim().split(/\r?\n/)[0]?.slice(0, 160)
  }

  private async login(connectorId: SubscriptionConnectorId, command: string, report: ProgressReporter, runtimeReport: (progress: RuntimeLoginProgress) => void) {
    if (connectorId === 'subscription:codex') return this.loginCodex(command, report)
    if (connectorId === 'subscription:claude-code') {
      if (!this.dependencies.loginClaude) throw new Error(t("Claude login channel is not configured"))
      const options = await this.claudeLoginOptions(command)
      await this.dependencies.loginClaude(command, options, runtimeReport)
      const account = await this.claudeAccount(command)
      if (!account.connected) throw new Error(t("Claude initialization finished without a valid subscription login. Reconnect to continue."))
      return account
    }
    if (connectorId === 'subscription:kimi-code') return this.loginKimi(command, report)
    if (!this.dependencies.loginAntigravity) throw new Error(t("Antigravity login channel is not configured"))
    await this.dependencies.loginAntigravity(command, { cwd: this.connectorRoot(connectorId), env: this.environment(connectorId, command) }, runtimeReport)
    return {}
  }

  private async logout(connectorId: SubscriptionConnectorId, command: string) {
    const options = { cwd: this.connectorRoot(connectorId), env: this.environment(connectorId, command), timeoutMs: 30_000 }
    if (connectorId === 'subscription:codex') {
      await this.codexRequest(command, 'account/logout', {})
      return
    }
    if (connectorId === 'subscription:claude-code') {
      if (!await this.supportsClaudeAuthCommands(command)) {
        await rm(join(this.profileRoot(connectorId), '.credentials.json'), { force: true })
        return
      }
      const result = await this.dependencies.runProcess(command, ['auth', 'logout'], options)
      if (result.code !== 0) throw new Error(t("Could not disconnect Claude: {0}", [processDetail(result)]))
      return
    }
    if (connectorId === 'subscription:kimi-code') {
      await rm(join(this.profileRoot(connectorId), 'credentials'), { recursive: true, force: true })
      return
    }
    const result = await this.dependencies.runProcess(command, [], { ...options, stdin: '/logout\n/exit\n' })
    if (result.code !== 0 && !/logout|signed out|disconnected/i.test(`${result.stdout}\n${result.stderr}`)) {
      throw new Error(t("Antigravity could not clear the login automatically. Run /logout in the Antigravity CLI."))
    }
  }

  private async probeAccount(connectorId: SubscriptionConnectorId, command: string): Promise<AccountProbe> {
    if (connectorId === 'subscription:codex') {
      const result = await this.codexRequest(command, 'account/read', { refreshToken: false })
      const account = record(record(result)?.account)
      if (!account || account.type !== 'chatgpt') return { connected: false }
      return { connected: true, accountLabel: stringValue(account.email), planType: stringValue(account.planType) }
    }
    if (connectorId === 'subscription:claude-code') {
      return this.claudeAccount(command)
    }
    if (connectorId === 'subscription:kimi-code') return { connected: await directoryHasFiles(join(this.profileRoot(connectorId), 'credentials')) }
    return { connected: await this.isAntigravityAuthenticated(command) }
  }

  async isAntigravityAuthenticated(command: string, env?: NodeJS.ProcessEnv) {
    const cwd = this.connectorRoot('subscription:antigravity')
    await mkdir(cwd, { recursive: true })
    const result = await this.dependencies.runProcess(command, ['models'], { cwd, env: env ?? this.environment('subscription:antigravity', command), timeoutMs: 20_000 })
    return result.code === 0 && Boolean(result.stdout.trim()) && !/authentication required|sign[ -]?in|login required/i.test(`${result.stdout}\n${result.stderr}`)
  }

  async localAntigravityLoginOptions(command: string) {
    const cwd = this.connectorRoot('subscription:antigravity')
    await mkdir(cwd, { recursive: true })
    return { command, cwd, env: this.environment('subscription:antigravity', command) }
  }

  async claudeLoginOptions(command: string) {
    const id = 'subscription:claude-code'
    const root = this.connectorRoot(id)
    const cwd = join(root, 'login-workspace')
    await mkdir(this.profileRoot(id), { recursive: true })
    await mkdir(cwd, { recursive: true })
    const mode = await this.supportsClaudeAuthCommands(command) ? 'auth-command' : 'interactive'
    return { command, cwd, env: this.environment(id, command), mode } satisfies ClaudeLoginOptions
  }

  private supportsClaudeAuthCommands(command: string) {
    let pending = this.claudeAuthCommands.get(command)
    if (!pending) {
      pending = this.dependencies.runProcess(command, ['--help'], {
        cwd: this.connectorRoot('subscription:claude-code'), env: this.environment('subscription:claude-code', command), timeoutMs: 15_000
      }).then(result => {
        if (result.code !== 0) throw new Error(t("Could not detect Claude command capabilities. Check the runtime."))
        return /^\s+auth(?:\s|$)/m.test(result.stdout)
      }).catch(error => { this.claudeAuthCommands.delete(command); throw error })
      this.claudeAuthCommands.set(command, pending)
    }
    return pending
  }

  async claudeAccount(command: string): Promise<ClaudeAccount> {
    if (!await this.supportsClaudeAuthCommands(command)) {
      return readClaudeSubscriptionAccount(this.profileRoot('subscription:claude-code'))
    }
    const result = await this.dependencies.runProcess(command, ['auth', 'status'], {
      cwd: this.connectorRoot('subscription:claude-code'), env: this.environment('subscription:claude-code', command), timeoutMs: 15_000
    })
    const parsed = parseJsonObject(result.stdout)
    const connected = result.code === 0 && parsed?.loggedIn === true && /^(?:claude[.-]?ai|oauth)$/i.test(stringValue(parsed.authMethod) ?? '')
    return { connected, accountLabel: connected ? stringValue(parsed?.email) : undefined, planType: connected ? stringValue(parsed?.subscriptionType) : undefined }
  }

  private async loginCodex(command: string, report: ProgressReporter) {
    const environment = this.environment('subscription:codex', command)
    const child = this.dependencies.spawnProcess(command, ['app-server'], { cwd: this.connectorRoot('subscription:codex'), env: environment })
    let stdoutBuffer = ''
    let stderr = ''
    let completed = false
    let loginId: string | undefined
    const send = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`)
    const account = await new Promise<{ accountLabel?: string; planType?: string }>((resolvePromise, reject) => {
      const timeout = setTimeout(() => finish(new Error(t("Codex login timed out. Reconnect to continue."))), 10 * 60_000)
      const finish = (error?: Error, value?: { accountLabel?: string; planType?: string }) => {
        if (completed) return
        completed = true
        clearTimeout(timeout)
        terminateProcessTree(child)
        if (error) reject(error)
        else resolvePromise(value ?? {})
      }
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => { stderr += chunk })
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdoutBuffer += chunk
        const lines = stdoutBuffer.split(/\r?\n/)
        stdoutBuffer = lines.pop() ?? ''
        for (const line of lines) {
          const message = parseJsonObject(line)
          if (!message) continue
          if (message.id === 0 && message.result) {
            send({ method: 'initialized', params: {} })
            send({ method: 'account/login/start', id: 1, params: { type: 'chatgpt', useHostedLoginSuccessPage: true, appBrand: 'chatgpt' } })
          } else if (message.id === 1 && record(message.result)) {
            const result = record(message.result)!
            loginId = stringValue(result.loginId)
            const authUrl = stringValue(result.authUrl)
            if (authUrl) {
              report({ connectorId: 'subscription:codex', phase: 'login', message: t("The browser is open. Complete your ChatGPT login."), authUrl })
              void this.openAuthUrl(authUrl)
            }
          } else if (message.method === 'account/login/completed' && record(message.params)) {
            const params = record(message.params)!
            if (loginId && params.loginId !== loginId) continue
            if (params.success === false) finish(new Error(stringValue(params.error) ?? t("Codex login failed")))
            else send({ method: 'account/read', id: 2, params: { refreshToken: false } })
          } else if (message.id === 2 && record(message.result)) {
            const current = record(record(message.result)!.account)
            if (!current || current.type !== 'chatgpt') finish(new Error(t("Codex did not return a ChatGPT subscription account")))
            else finish(undefined, { accountLabel: stringValue(current.email), planType: stringValue(current.planType) })
          } else if (message.error) finish(new Error(jsonRpcError(message.error)))
        }
      })
      child.once('error', (error) => finish(error))
      child.once('close', (code) => { if (!completed) finish(new Error(t("Codex App Server exited ({0}): {1}", [code ?? 1, stderr.trim() || t("No error details")]))) })
      send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'agentflow', title: 'AgentFlow', version: '0.1.0' } } })
    })
    return account
  }

  private async loginKimi(command: string, report: ProgressReporter) {
    let openedUrl = ''
    let lastCode = ''
    const result = await this.dependencies.runProcess(command, ['login'], {
      cwd: this.connectorRoot('subscription:kimi-code'),
      env: this.environment('subscription:kimi-code', command),
      timeoutMs: 10 * 60_000,
      onOutput: (text) => {
        const { url, userCode } = authDetails(text)
        if (userCode) lastCode = userCode
        if (url && url !== openedUrl) {
          openedUrl = url
          void this.openAuthUrl(url)
        }
        if (url || userCode) report({ connectorId: 'subscription:kimi-code', phase: 'login', message: t("Confirm device login on the Kimi page."), authUrl: url || openedUrl || undefined, userCode: userCode || lastCode || undefined })
      }
    })
    if (result.code !== 0) throw new Error(t("Kimi login failed: {0}", [processDetail(result)]))
    const account = await this.probeAccount('subscription:kimi-code', command)
    if (!account.connected) throw new Error(t("Kimi login finished, but OAuth credentials were not found."))
    return account
  }

  private async codexRequest(command: string, method: string, params: Record<string, unknown>) {
    const child = this.dependencies.spawnProcess(command, ['app-server'], { cwd: this.connectorRoot('subscription:codex'), env: this.environment('subscription:codex', command) })
    const send = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`)
    return new Promise<unknown>((resolvePromise, reject) => {
      let buffer = ''
      let stderr = ''
      let settled = false
      const timeout = setTimeout(() => finish(new Error(t("Codex {0} timed out", [method]))), 30_000)
      const finish = (error?: Error, value?: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        terminateProcessTree(child)
        if (error) reject(error)
        else resolvePromise(value)
      }
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => { stderr += chunk })
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        buffer += chunk
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const message = parseJsonObject(line)
          if (!message) continue
          if (message.id === 0 && message.result) {
            send({ method: 'initialized', params: {} })
            send({ method, id: 1, params })
          } else if (message.id === 1) {
            if (message.error) finish(new Error(jsonRpcError(message.error)))
            else finish(undefined, message.result)
          }
        }
      })
      child.once('error', (error) => finish(error))
      child.once('close', (code) => { if (!settled) finish(new Error(t("Codex App Server exited ({0}): {1}", [code ?? 1, stderr.trim() || t("No error details")]))) })
      send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'agentflow', title: 'AgentFlow', version: '0.1.0' } } })
    })
  }

  private async openAuthUrl(url: string) {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') throw new Error(t("Login URLs must use HTTPS"))
    await this.dependencies.openExternal(parsed.toString())
  }

  private environment(connectorId: SubscriptionConnectorId, command?: string) {
    const environment = sanitizedSubscriptionEnvironment(connectorId, this.profileRoot(connectorId), process.env)
    if (command) prependPath(environment, dirname(command))
    return environment
  }

  private root() { return join(this.storeDirectory, 'subscription-connectors') }
  private connectorRoot(id: SubscriptionConnectorId) { return join(this.root(), id.replace('subscription:', '')) }
  private profileRoot(id: SubscriptionConnectorId) { return join(this.connectorRoot(id), 'profile') }
  private path() { return join(this.root(), 'state.json') }

  private stored(state: StoredSubscriptions, id: SubscriptionConnectorId) {
    let stored = state.connectors.find((candidate) => candidate.id === id)
    if (!stored) { stored = { id }; state.connectors.push(stored) }
    return stored
  }

  private async load() {
    if (this.state) return this.state
    let parsed: StoredSubscriptions | undefined
    try { parsed = JSON.parse(await readFile(this.path(), 'utf8')) as StoredSubscriptions }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    this.state = { version: 1, connectors: [...PRESETS, DEEPSEEK_WEB_PRESET].map((preset) => parsed?.connectors?.find((candidate) => candidate.id === preset.id) ?? { id: preset.id }) }
    return this.state
  }

  private async persist(state: StoredSubscriptions) {
    const target = this.path()
    await atomicWriteFile(target, JSON.stringify(state, null, 2))
  }
}

export function isSubscriptionProviderId(providerId: string): providerId is SubscriptionConnectorId {
  return providerId === DEEPSEEK_WEB_PRESET.id || PRESETS.some((preset) => preset.id === providerId)
}

function subscriptionConnectorId(providerId: string): SubscriptionConnectorId {
  if (!isSubscriptionProviderId(providerId)) throw new Error(t("Subscription connector {0} does not exist", [providerId]))
  return providerId
}

function connectorPreset(id: SubscriptionConnectorId) {
  const preset = PRESETS.find((candidate) => candidate.id === id)
  if (!preset) throw new Error(t("Subscription connector {0} does not exist", [id]))
  return preset
}

export function sanitizedSubscriptionEnvironment(connectorId: SubscriptionConnectorId, profileRoot: string, source: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform) {
  const environment: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(source)) {
    const normalized = key.toUpperCase()
    if (value !== undefined && RUNTIME_ENVIRONMENT_KEYS.has(normalized) && !API_ENVIRONMENT_KEYS.has(normalized)) environment[key] = value
  }
  if (connectorId === 'subscription:codex') {
    environment.CODEX_HOME = profileRoot
    environment.CODEX_SQLITE_HOME = profileRoot
  } else if (connectorId === 'subscription:claude-code') {
    environment.CLAUDE_CONFIG_DIR = profileRoot
    environment.CLAUDE_CODE_AUTO_CONNECT_IDE = 'false'
    environment.DISABLE_AUTOUPDATER = '1'
    if (source.CLAUDE_CODE_USE_POWERSHELL_TOOL === '0' || source.CLAUDE_CODE_USE_POWERSHELL_TOOL === '1') {
      environment.CLAUDE_CODE_USE_POWERSHELL_TOOL = source.CLAUDE_CODE_USE_POWERSHELL_TOOL
    }
    const configuredBash = source.CLAUDE_CODE_GIT_BASH_PATH
    const shellPath = configuredBash && existsSync(configuredBash) ? resolve(configuredBash) : findKimiShell(platform, source)
    if (shellPath) environment.CLAUDE_CODE_GIT_BASH_PATH = shellPath
  } else if (connectorId === 'subscription:kimi-code') {
    environment.KIMI_CODE_HOME = profileRoot
    const shellPath = findKimiShell(platform, source)
    if (shellPath) environment.KIMI_SHELL_PATH = shellPath
  }
  return environment
}

export function subscriptionRuntimeTemplates(connectorId: SubscriptionConnectorId, model?: string, reasoning?: string) {
  if (connectorId === 'subscription:deepseek-web') throw new Error(t("DeepSeek Web Bridge does not use runtime templates"))
  const modelArgs = model ? ['--model', model] : []
  if (connectorId === 'subscription:codex') {
    const reasoningArgs = reasoning ? ['--config', `model_reasoning_effort="${reasoning}"`] : []
    return {
      args: ['--sandbox', 'read-only', 'exec', '--json', '--skip-git-repo-check', '--cd', '{workspace}', ...modelArgs, ...reasoningArgs, '-'],
      resumeArgs: ['--sandbox', 'read-only', 'exec', 'resume', '--json', '--skip-git-repo-check', ...modelArgs, ...reasoningArgs, '{session}', '-']
    }
  }
  if (connectorId === 'subscription:claude-code') {
    const reasoningArgs = reasoning ? ['--effort', reasoning] : []
    const base = ['-p', '--bare', '--permission-mode', 'dontAsk', '--verbose', '--output-format', 'stream-json', ...modelArgs, ...reasoningArgs]
    return { args: base, resumeArgs: [...base, '--resume', '{session}'] }
  }
  if (connectorId === 'subscription:kimi-code') {
    return {
      args: ['acp'],
      resumeArgs: ['acp']
    }
  }
  const reasoningArgs = reasoning ? ['--effort', reasoning] : []
  return {
    args: ['--input-format', 'stream-json', '--output-format', 'stream-json', '--sandbox', ...modelArgs, ...reasoningArgs],
    resumeArgs: ['--input-format', 'stream-json', '--output-format', 'stream-json', '--sandbox', '--conversation', '{session}', ...modelArgs, ...reasoningArgs]
  }
}

export function authDetails(text: string) {
  const url = text.match(/https:\/\/[^\s<>'"\]\)]+/i)?.[0]
  const userCode = text.match(/\b[A-Z0-9]{4}(?:-[A-Z0-9]{4}){1,2}\b/i)?.[0]?.toUpperCase()
  return { url, userCode }
}

function expectedCommands(id: SubscriptionConnectorId, connectorRoot: string) {
  const executable = (name: string) => process.platform === 'win32' ? `${name}.exe` : name
  if (id === 'subscription:codex') return [join(connectorRoot, 'bin', executable('codex'))]
  if (id === 'subscription:antigravity') return [join(connectorRoot, 'bin', executable('agy'))]
  return [join(homedir(), '.local', 'bin', executable(id === 'subscription:claude-code' ? 'claude' : id === 'subscription:kimi-code' ? 'kimi' : 'agy'))]
}

function findKimiShell(platform: NodeJS.Platform = process.platform, source: NodeJS.ProcessEnv = process.env) {
  if (platform !== 'win32') return undefined
  const candidates = [
    source.ProgramFiles ? join(source.ProgramFiles, 'Git', 'bin', 'bash.exe') : undefined,
    source.ProgramFiles ? join(source.ProgramFiles, 'Git', 'usr', 'bin', 'bash.exe') : undefined,
    source['ProgramFiles(x86)'] ? join(source['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe') : undefined,
    source.LOCALAPPDATA ? join(source.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe') : undefined
  ]
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)))
}

async function executableExists(path: string) {
  try { return (await stat(path)).isFile() }
  catch { return false }
}

async function samePath(left: string | undefined, right: string | undefined) {
  if (!left || !right) return false
  try {
    const [resolvedLeft, resolvedRight] = await Promise.all([realpath(left), realpath(right)])
    return process.platform === 'win32' ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase() : resolvedLeft === resolvedRight
  } catch { return false }
}

async function directoryHasFiles(directory: string): Promise<boolean> {
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isFile()) return true
      if (entry.isDirectory() && await directoryHasFiles(join(directory, entry.name))) return true
    }
  } catch { return false }
  return false
}

function powershellCommand() {
  return process.env.SystemRoot
    ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe'
}

function prependPath(environment: NodeJS.ProcessEnv, directory: string) {
  const key = Object.keys(environment).find((candidate) => candidate.toLowerCase() === 'path') ?? 'PATH'
  const separator = process.platform === 'win32' ? ';' : ':'
  environment[key] = `${directory}${environment[key] ? `${separator}${environment[key]}` : ''}`
}

function processDetail(result: ProcessResult) {
  return (result.stderr || result.stdout || t("Exit code {0}", [result.code])).trim().slice(-2_000)
}

function parseJsonObject(value: string) {
  try { return record(JSON.parse(value)) }
  catch { return undefined }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
}

function stringValue(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : undefined }

function jsonRpcError(value: unknown) {
  const error = record(value)
  return stringValue(error?.message) ?? t("Codex App Server request failed")
}

function defaultDependencies(): SubscriptionConnectorDependencies {
  return {
    async fetchText(url) {
      const response = await fetch(url, { redirect: 'follow' })
      if (!response.ok) throw new Error(t("Installer download failed (HTTP {0})", [response.status]))
      return response.text()
    },
    async openExternal() { throw new Error(t("openExternal dependency is not configured")) },
    runProcess: runChildProcess,
    spawnProcess(command, args, options) {
      return spawnManaged(command, args, options)
    },
    now: () => new Date().toISOString()
  }
}

export function createSubscriptionConnectorDependencies(openExternal: (url: string) => Promise<void>): SubscriptionConnectorDependencies {
  return { ...defaultDependencies(), openExternal }
}

function runChildProcess(command: string, args: string[], options: ProcessOptions) {
  return new Promise<ProcessResult>((resolvePromise, reject) => {
    const child = spawnManaged(command, args, options)
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      terminateProcessTree(child)
      reject(new Error(t("{0} timed out", [command])))
    }, options.timeoutMs ?? 30_000)
    const append = (chunk: Buffer | string, source: 'stdout' | 'stderr') => {
      const text = chunk.toString()
      if (source === 'stdout') stdout = `${stdout}${text}`.slice(-64_000)
      else stderr = `${stderr}${text}`.slice(-64_000)
      options.onOutput?.(text, source)
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => append(chunk, 'stdout'))
    child.stderr.on('data', (chunk) => append(chunk, 'stderr'))
    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolvePromise({ code: code ?? 1, stdout, stderr })
    })
    child.stdin.end(options.stdin)
  })
}
