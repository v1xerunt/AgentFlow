import { t } from '@agentflow/core/localization'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { atomicWriteFile } from './atomic-file'
import { safeStorage } from 'electron'
import {
  parameterSupportFor,
  setProviderModelMetadata,
  type ModelParameterMetadata,
  type ProviderCatalogGroup
} from '@agentflow/core'
import type {
  AgentToolConfiguration,
  AgentToolConfigurationInput,
  FeatureModelSettings,
  LlmSettingsInput,
  LlmSettingsSnapshot,
  PromptAutofillSettings,
  ProviderConfiguration,
  ProviderConfigurationInput,
  ProviderProtocol,
  SubscriptionConnectorConfiguration
} from '../shared/llm'
import { DEFAULT_CHAT_HISTORY_MAX_CHARS, MAX_CHAT_HISTORY_MAX_CHARS, MIN_CHAT_HISTORY_MAX_CHARS } from '../shared/llm'
import { modelDisplayName } from '../shared/model-display-name'
import { enabledAgentToolModels } from '../shared/agent-tool-models'
import { enabledProviderModels } from '../shared/provider-models'
import { claudeReasoningEffortsForModel, detectAgentTool } from './agent-tool-runner'
import type { DetectedAgentTool } from './agent-tool-runner'
import { listProviderModels, testProviderConnection, type ResolvedProvider } from './provider-client'
import { SubscriptionConnectorService } from './subscription-connectors'

interface ProviderPreset {
  id: string
  name: string
  protocol: ProviderProtocol
  baseUrl: string
}

interface AgentToolPreset {
  id: string
  name: string
  command: string
  args: string[]
  resumeArgs: string[]
  modelArgs?: string[]
  reasoningArgs?: string[]
  loginCommand?: string
}

interface StoredProvider {
  id: string
  name: string
  protocol: ProviderProtocol
  baseUrl: string
  anthropicWorkspaceId?: string
  added: boolean
  enabled: boolean
  custom: boolean
  encryptedApiKey?: string
  manualModels: string[]
  discoveredModels: string[]
  disabledModels?: string[]
  modelMetadata?: Record<string, ModelParameterMetadata>
  modelsUpdatedAt?: string
}

interface StoredAgentTool extends AgentToolConfigurationInput {}

interface StoredLlmSettings {
  version: number
  providers: StoredProvider[]
  agentTools: StoredAgentTool[]
  promptAutofill: PromptAutofillSettings
  flowGeneration: FeatureModelSettings
  chatHistoryMaxChars: number
}

const PROVIDERS: ProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { id: 'google', name: 'Google Gemini', protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'deepseek', name: 'DeepSeek', protocol: 'openai-compatible', baseUrl: 'https://api.deepseek.com' },
  { id: 'zai', name: 'Z.AI', protocol: 'openai-compatible', baseUrl: 'https://api.z.ai/api/paas/v4' },
  { id: 'zai-coding-plan', name: 'Z.AI GLM Coding Plan', protocol: 'openai-compatible', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
  { id: 'kimi', name: 'Kimi', protocol: 'openai-compatible', baseUrl: 'https://api.moonshot.ai/v1' },
  { id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1' }
]

const AGENT_TOOLS: AgentToolPreset[] = [
  { id: 'agent-tool:codex', name: 'Codex', command: 'codex', args: ['--sandbox', 'workspace-write', 'exec', '--json', '--skip-git-repo-check', '--cd', '{workspace}', '-'], resumeArgs: ['--sandbox', 'workspace-write', 'exec', 'resume', '--json', '--skip-git-repo-check', '{session}', '-'], modelArgs: ['--model', '{model}'], reasoningArgs: ['--config', 'model_reasoning_effort="{reasoning}"'], loginCommand: 'codex login' },
  { id: 'agent-tool:claude-code', name: 'Claude Code', command: 'claude', args: ['-p', '--permission-mode', 'acceptEdits', '--verbose', '--output-format', 'stream-json'], resumeArgs: ['-p', '--permission-mode', 'acceptEdits', '--verbose', '--output-format', 'stream-json', '--resume', '{session}'], modelArgs: ['--model', '{model}'], reasoningArgs: ['--effort', '{reasoning}'], loginCommand: 'claude auth login' },
  { id: 'agent-tool:deepseek-harness', name: 'DeepSeek Harness', command: 'dsh', args: ['--profile', 'headless', '{prompt}'], resumeArgs: ['--profile', 'headless', '{prompt}'] },
  { id: 'agent-tool:kimi-code', name: 'Kimi Code', command: 'kimi', args: ['acp'], resumeArgs: ['acp'], loginCommand: 'kimi login' },
  { id: 'agent-tool:antigravity', name: 'Antigravity', command: 'agy', args: ['--input-format', 'stream-json', '--output-format', 'stream-json', '--sandbox'], resumeArgs: ['--input-format', 'stream-json', '--output-format', 'stream-json', '--sandbox', '--conversation', '{session}'], modelArgs: ['--model', '{model}'], reasoningArgs: ['--effort', '{reasoning}'], loginCommand: 'agy' }
]

export class LlmSettingsService {
  private state?: StoredLlmSettings
  private detectedTools = new Map<string, DetectedAgentTool>()

  constructor(
    private readonly storeDirectory: string,
    private readonly subscriptions = new SubscriptionConnectorService(storeDirectory),
    private readonly protectSecret: (secret: string) => void = () => {}
  ) {}

  async snapshot(): Promise<LlmSettingsSnapshot> {
    const state = await this.load()
    const subscriptions = await this.subscriptions.snapshot()
    const promptAutofill = validateFeatureModel(state.promptAutofill, state.providers, state.agentTools, subscriptions)
    const flowGeneration = validateFeatureModel(state.flowGeneration, state.providers, state.agentTools, subscriptions)
    if (promptAutofill.providerId !== state.promptAutofill.providerId || promptAutofill.model !== state.promptAutofill.model
      || flowGeneration.providerId !== state.flowGeneration.providerId || flowGeneration.model !== state.flowGeneration.model) {
      state.promptAutofill = promptAutofill
      state.flowGeneration = flowGeneration
      await this.persist(state)
    }
    const providers = state.providers.map(publicProvider)
    const agentTools = state.agentTools.map((tool) => {
      const preset = agentToolPreset(tool.id)
      const detected = this.detectedTools.get(tool.id)
      const installed = detected?.installed ?? false
      const models = uniqueStrings([...(detected?.models ?? []), ...(tool.models ?? [])])
      const reasoningOverrideSupported = detected?.reasoningOverrideSupported ?? false
      return { ...tool, name: preset.name, enabled: tool.enabled, installed, loginCommand: preset.loginCommand,
        models,
        reasoningEfforts: [],
        modelReasoningEfforts: reasoningOverrideSupported ? detected?.modelReasoningEfforts ?? {} : {},
        reasoningOverrideSupported }
    })
    return { providers, agentTools, subscriptions, catalog: buildCatalog(providers, agentTools, subscriptions), promptAutofill, flowGeneration, chatHistoryMaxChars: state.chatHistoryMaxChars }
  }

  async save(input: LlmSettingsInput) {
    const current = await this.load()
    const currentProviders = new Map(current.providers.map((provider) => [provider.id, provider]))
    const nextProviders: StoredProvider[] = []
    for (const preset of PROVIDERS) {
      const candidate = input.providers.find((provider) => provider.id === preset.id)
      nextProviders.push(this.updatedProvider(candidate ?? providerInput(currentProviders.get(preset.id) ?? defaultProvider(preset)), currentProviders.get(preset.id), false))
    }
    for (const candidate of input.providers.filter((provider) => provider.custom)) {
      if (!candidate.id.startsWith('custom:')) throw new Error(t("Invalid custom provider ID"))
      nextProviders.push(this.updatedProvider(candidate, currentProviders.get(candidate.id), true))
    }
    const nextTools = AGENT_TOOLS.map((preset) => {
      const candidate = input.agentTools.find((tool) => tool.id === preset.id)
      const previous = current.agentTools.find((tool) => tool.id === preset.id) ?? defaultAgentTool(preset)
      const next = candidate ?? previous
      const commandUnchanged = next.command.trim() === previous.command
      if (!commandUnchanged) this.detectedTools.delete(preset.id)
      return validateAgentTool({ ...next, disabledModels: next.disabledModels ?? previous.disabledModels }, preset)
    })
    const subscriptions = await this.subscriptions.snapshot()
    const promptAutofill = validateFeatureModel(input.promptAutofill ?? current.promptAutofill, nextProviders, nextTools, subscriptions)
    const flowGeneration = validateFeatureModel(input.flowGeneration ?? current.flowGeneration, nextProviders, nextTools, subscriptions)
    const chatHistoryMaxChars = validateChatHistoryMaxChars(input.chatHistoryMaxChars ?? current.chatHistoryMaxChars)
    this.state = { version: 7, providers: nextProviders, agentTools: nextTools, promptAutofill, flowGeneration, chatHistoryMaxChars }
    await this.persist(this.state)
    return this.snapshot()
  }

  async refreshModels(providerId?: string) {
    const state = await this.load()
    const targets = providerId
      ? state.providers.filter((provider) => provider.id === providerId)
      : state.providers.filter((provider) => provider.enabled && (provider.custom || Boolean(provider.encryptedApiKey)))
    if (providerId && !targets.length) throw new Error(t("Provider does not exist"))
    for (const stored of targets) {
      const resolved = this.resolveStoredProvider(stored)
      const discovered = await listProviderModels(resolved)
      stored.discoveredModels = filterConversationModels(stored.id, discovered.models)
      stored.modelMetadata = discovered.metadata
      stored.modelsUpdatedAt = new Date().toISOString()
    }
    await this.persist(state)
    return this.snapshot()
  }

  async testProvider(providerId: string) {
    const state = await this.load()
    const stored = state.providers.find((provider) => provider.id === providerId)
    if (!stored) throw new Error(t("Provider does not exist"))
    if (!stored.enabled) throw new Error(t("{0} is disabled", [stored.name]))
    const discovered = await testProviderConnection(this.resolveStoredProvider(stored))
    stored.discoveredModels = filterConversationModels(stored.id, discovered.models)
    stored.modelMetadata = discovered.metadata
    stored.modelsUpdatedAt = new Date().toISOString()
    await this.persist(state)
    return this.snapshot()
  }

  async detectTools() {
    const state = await this.load()
    const managedCommands = await this.subscriptions.managedRuntimeCommands()
    const detected = await Promise.all(state.agentTools.map(async (tool) => {
      const preset = agentToolPreset(tool.id)
      return [tool.id, await detectAgentTool({ id: tool.id, name: preset.name, command: tool.command }, managedCommands)] as const
    }))
    this.detectedTools = new Map(detected)
    return this.snapshot()
  }

  async refreshSubscriptions() {
    await this.subscriptions.refresh()
    return this.snapshot()
  }

  async resolvedProvider(providerId: string, model?: string) {
    const state = await this.load()
    const aliases: Record<string, string> = { OpenAI: 'openai', Anthropic: 'anthropic', Google: 'google' }
    const id = aliases[providerId] ?? providerId.toLowerCase()
    const stored = state.providers.find((provider) => provider.id === id)
    if (!stored || !stored.enabled) throw new Error(t("Provider {0} does not exist or is disabled", [providerId]))
    if (model && stored.disabledModels?.includes(model)) throw new Error(t("Model {1} from {0} is disabled. Enable it in Settings → API providers before running.", [stored.name, model]))
    return this.resolveStoredProvider(stored)
  }

  async agentToolLoginCommand(providerId: string) {
    if (providerId !== 'agent-tool:antigravity') throw new Error(t("This tool does not support in-app login yet"))
    const tool = (await this.load()).agentTools.find(candidate => candidate.id === providerId)
    if (!tool) throw new Error(t("Antigravity configuration not found"))
    const detected = await detectAgentTool({ id: tool.id, name: 'Antigravity', command: tool.command }, await this.subscriptions.managedRuntimeCommands())
    if (!detected.installed || !detected.resolvedCommand) throw new Error(t("Antigravity was not found. Check its command and try again."))
    return detected.resolvedCommand
  }

  async agentTool(providerId: string, model?: string, reasoning?: string, refresh = false) {
    const state = await this.load()
    const tool = state.agentTools.find((candidate) => candidate.id === providerId)
    if (!tool) throw new Error(t("Agent tool {0} does not exist", [providerId]))
    const preset = agentToolPreset(tool.id)
    if (!tool.enabled) throw new Error(t("{0} is disabled in settings", [preset.name]))
    if (refresh) this.detectedTools.delete(tool.id)
    const detected = this.detectedTools.get(tool.id) ?? await detectAgentTool({ id: tool.id, name: preset.name, command: tool.command }, await this.subscriptions.managedRuntimeCommands())
    this.detectedTools.set(tool.id, detected)
    if (!detected.installed) throw new Error(t("{0} was not found on this computer (command: {1})", [preset.name, tool.command]))
    const selectedModel = model && model !== '@tool-default' ? model : tool.model
    if (tool.disabledModels?.includes(model || '@tool-default') || (selectedModel && tool.disabledModels?.includes(selectedModel))) {
      throw new Error(t("Models for {0} are disabled. Enable them in Settings → Local Agent tools before running.", [preset.name]))
    }
    if (reasoning) {
      if (!detected.reasoningOverrideSupported) throw new Error(t("The installed version of {0} has no supported reasoning effort argument", [preset.name]))
      const detectedLevels = selectedModel
        ? detected.modelReasoningEfforts?.[selectedModel] ?? (tool.id === 'agent-tool:claude-code' ? claudeReasoningEffortsForModel(selectedModel) : undefined)
        : detected.modelReasoningEfforts?.['@tool-default']
      const allowedLevels = detectedLevels ?? []
      if (!allowedLevels.includes(reasoning)) throw new Error(t("{0} · {1}: {2}", [preset.name, selectedModel ?? t("Default model"), allowedLevels.length ? t("Supported reasoning effort: {0}", [allowedLevels.join(' / ')]) : t("No reasoning effort levels are available. Use the tool defaults.")]))
    }
    return {
      ...tool,
      name: preset.name,
      installed: true,
      command: detected.resolvedCommand ?? tool.command,
      model: selectedModel,
      reasoning,
      args: withToolArgs(preset.args, preset.modelArgs, preset.reasoningArgs, selectedModel, reasoning),
      resumeArgs: withToolArgs(preset.resumeArgs, preset.modelArgs, preset.reasoningArgs, selectedModel, reasoning)
    }
  }

  private async load() {
    if (this.state) return this.state
    let parsed: StoredLlmSettings | undefined
    try { parsed = JSON.parse(await readFile(this.path(), 'utf8')) as StoredLlmSettings }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    const storedProviders = new Map((parsed?.providers ?? []).map((provider) => [provider.id, provider]))
    const storedTools = new Map((parsed?.agentTools ?? []).map((tool) => [tool.id, tool]))
    this.state = {
      version: 7,
      providers: [
        ...PROVIDERS.map((preset) => storedProviders.get(preset.id) ?? defaultProvider(preset)),
        ...(parsed?.providers ?? [])
          .filter((provider) => provider.custom && !PROVIDERS.some((preset) => preset.id === provider.id))
      ],
      agentTools: AGENT_TOOLS.map((preset) => storedAgentTool(preset, storedTools.get(preset.id))),
      promptAutofill: parsed?.promptAutofill ?? { providerId: '', model: '' },
      flowGeneration: parsed?.flowGeneration ?? { providerId: '', model: '' },
      chatHistoryMaxChars: validateChatHistoryMaxChars(parsed?.chatHistoryMaxChars)
    }
    const subscriptions = await this.subscriptions.snapshot()
    this.state.promptAutofill = validateFeatureModel(this.state.promptAutofill, this.state.providers, this.state.agentTools, subscriptions)
    this.state.flowGeneration = validateFeatureModel(this.state.flowGeneration, this.state.providers, this.state.agentTools, subscriptions)
    return this.state
  }

  private updatedProvider(input: ProviderConfigurationInput, current: StoredProvider | undefined, custom: boolean): StoredProvider {
    const baseUrl = validateBaseUrl(input.baseUrl)
    const anthropicWorkspaceId = input.protocol === 'anthropic'
      ? (input.anthropicWorkspaceId ?? current?.anthropicWorkspaceId)?.trim() || undefined
      : undefined
    if (anthropicWorkspaceId && !/^wrkspc_[A-Za-z0-9]+$/.test(anthropicWorkspaceId)) {
      throw new Error(t("Invalid Anthropic workspace ID. Copy an ID starting with wrkspc_ from Claude Console → Settings → Workspaces."))
    }
    const encryptedApiKey = input.clearApiKey
      ? undefined
      : input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : current?.encryptedApiKey
    return {
      id: input.id,
      name: input.name.trim() || input.id,
      protocol: input.protocol,
      baseUrl,
      anthropicWorkspaceId,
      added: custom || input.added,
      enabled: input.enabled && (custom || input.added),
      custom,
      encryptedApiKey,
      manualModels: custom ? uniqueStrings(input.manualModels) : [],
      discoveredModels: current?.discoveredModels ?? [],
      disabledModels: uniqueStrings(input.disabledModels ?? current?.disabledModels ?? []),
      modelMetadata: current?.baseUrl === baseUrl ? current.modelMetadata : undefined,
      modelsUpdatedAt: current?.modelsUpdatedAt
    }
  }

  private resolveStoredProvider(provider: StoredProvider): ResolvedProvider {
    const apiKey = provider.encryptedApiKey ? decryptSecret(provider.encryptedApiKey) : ''
    this.protectSecret(apiKey)
    return {
      id: provider.id,
      name: provider.name,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
      anthropicWorkspaceId: provider.anthropicWorkspaceId,
      apiKey,
      requireApiKey: !provider.custom,
      modelMetadata: provider.modelMetadata
    }
  }

  private async persist(state: StoredLlmSettings) {
    const target = this.path()
    await atomicWriteFile(target, JSON.stringify(state, null, 2))
  }

  private path() { return join(this.storeDirectory, 'llm-settings.json') }
}

function publicProvider(provider: StoredProvider): ProviderConfiguration {
  return {
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl,
    anthropicWorkspaceId: provider.anthropicWorkspaceId,
    added: provider.added,
    enabled: provider.enabled,
    custom: provider.custom,
    hasApiKey: Boolean(provider.encryptedApiKey),
    manualModels: provider.manualModels,
    discoveredModels: provider.discoveredModels,
    disabledModels: provider.disabledModels ?? [],
    modelMetadata: provider.modelMetadata,
    modelsUpdatedAt: provider.modelsUpdatedAt
  }
}

function buildCatalog(providers: ProviderConfiguration[], tools: AgentToolConfiguration[], subscriptions: SubscriptionConnectorConfiguration[]): ProviderCatalogGroup[] {
  const fake: ProviderCatalogGroup = {
    id: 'fake',
    name: t('Demo model'),
    connector: 'model',
    configured: true,
    models: [{ providerId: 'fake', providerName: t('Demo model'), modelId: 'agent-v1', modelName: 'agent-v1', connector: 'model', configured: true, parameters: parameterSupportFor('fake', 'agent-v1') }]
  }
  const providerGroups = providers.filter((provider) => provider.added && provider.enabled).map((provider) => {
    setProviderModelMetadata(provider.id, provider.modelMetadata ?? {})
    const models = enabledProviderModels(provider)
    const configured = provider.custom || provider.hasApiKey
    return {
      id: provider.id,
      name: provider.name,
      connector: 'model' as const,
      configured,
      models: models.map((modelId) => ({
        providerId: provider.id,
        providerName: provider.name,
        modelId,
        modelName: modelId,
        connector: 'model' as const,
        configured,
        parameters: parameterSupportFor(provider.id, modelId)
      }))
    }
  })
  const toolGroups = tools.filter((tool) => tool.enabled && tool.installed).map((tool) => {
    const selectableModels = enabledAgentToolModels(tool)
    setProviderModelMetadata(tool.id, Object.fromEntries(selectableModels.map((model) => [model, {
      reasoning: tool.modelReasoningEfforts[model]?.length ? { supportedEfforts: tool.modelReasoningEfforts[model] } : null
    }])))
    return {
      id: tool.id,
      name: tool.name,
      connector: 'agent-tool' as const,
      configured: tool.installed,
      models: selectableModels.map((modelId) => ({
        providerId: tool.id,
        providerName: tool.name,
        modelId,
        modelName: modelId === '@tool-default' ? t("Tool default model") : modelId,
        connector: 'agent-tool' as const,
        configured: tool.installed,
        parameters: parameterSupportFor(tool.id, modelId)
      }))
    }
  })
  const subscriptionGroups = subscriptions.filter((connector) => connector.connected).map((connector) => ({
    id: connector.id,
    name: connector.name,
    connector: 'subscription' as const,
    configured: true,
    models: connector.models.map((modelId) => ({
      providerId: connector.id,
      providerName: connector.name,
      modelId,
      modelName: modelDisplayName(connector.id, modelId, modelId === '@tool-default' ? t("Subscription default model") : modelId),
      connector: 'subscription' as const,
      configured: true,
      parameters: parameterSupportFor(connector.id, modelId)
    }))
  }))
  return [fake, ...subscriptionGroups, ...providerGroups, ...toolGroups]
}

function defaultProvider(preset: ProviderPreset): StoredProvider {
  return { ...preset, added: false, enabled: false, custom: false, manualModels: [], discoveredModels: [] }
}

function providerInput(provider: StoredProvider): ProviderConfigurationInput {
  return { id: provider.id, name: provider.name, protocol: provider.protocol, baseUrl: provider.baseUrl, anthropicWorkspaceId: provider.anthropicWorkspaceId, added: provider.added, enabled: provider.enabled, custom: provider.custom, manualModels: provider.manualModels, disabledModels: provider.disabledModels }
}

function defaultAgentTool(preset: AgentToolPreset): StoredAgentTool {
  return { id: preset.id, command: preset.command, model: undefined, models: [], reasoningEfforts: [], modelReasoningEfforts: {}, added: false, enabled: false }
}

function storedAgentTool(preset: AgentToolPreset, stored: StoredAgentTool | undefined) {
  if (!stored) return defaultAgentTool(preset)
  const command = stored.command?.trim() || preset.command
  const model = stored.model?.trim() || undefined
  return { id: preset.id, command, model, models: uniqueStrings(stored.models ?? []), disabledModels: uniqueStrings(stored.disabledModels ?? []), reasoningEfforts: [], modelReasoningEfforts: {}, added: stored.added, enabled: stored.enabled }
}

function validateAgentTool(tool: AgentToolConfigurationInput, preset: AgentToolPreset): StoredAgentTool {
  if (!tool.command.trim()) throw new Error(t("The command for {0} cannot be empty", [preset.name]))
  const disabledModels = uniqueStrings(tool.disabledModels ?? [])
  const model = tool.model?.trim() || undefined
  return { id: preset.id, command: tool.command.trim(), model: model && !disabledModels.includes(model) ? model : undefined, models: uniqueStrings(tool.models ?? []), disabledModels, reasoningEfforts: [], modelReasoningEfforts: {}, added: tool.added, enabled: tool.added && tool.enabled }
}

function validateFeatureModel(settings: FeatureModelSettings, providers: StoredProvider[], tools: StoredAgentTool[], subscriptions: SubscriptionConnectorConfiguration[]): FeatureModelSettings {
  const providerId = settings.providerId?.trim() ?? ''
  const model = settings.model?.trim() ?? ''
  if (!providerId || !model) return { providerId: '', model: '' }
  if (providerId.startsWith('agent-tool:')) {
    const tool = tools.find((candidate) => candidate.id === providerId)
    return tool?.added && !tool.disabledModels?.includes(model) ? { providerId, model } : { providerId: '', model: '' }
  }
  if (providerId.startsWith('subscription:')) {
    return subscriptions.some((connector) => connector.id === providerId && connector.connected && connector.models.includes(model))
      ? { providerId, model }
      : { providerId: '', model: '' }
  }
  const provider = providers.find((candidate) => candidate.id === providerId)
  if (!provider?.added || !provider.enabled) return { providerId: '', model: '' }
  const models = enabledProviderModels(provider)
  return models.includes(model) ? { providerId, model } : { providerId: '', model: '' }
}

function validateChatHistoryMaxChars(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CHAT_HISTORY_MAX_CHARS
  return Math.min(MAX_CHAT_HISTORY_MAX_CHARS, Math.max(MIN_CHAT_HISTORY_MAX_CHARS, Math.round(value)))
}

function agentToolPreset(id: string) {
  const preset = AGENT_TOOLS.find((candidate) => candidate.id === id)
  if (!preset) throw new Error(t("Agent tool {0} does not exist", [id]))
  return preset
}

export function withToolArgs(template: string[], modelArgs: string[] | undefined, reasoningArgs: string[] | undefined, model: string | undefined, reasoning: string | undefined) {
  const rendered = [
    ...(modelArgs && model ? modelArgs.map((value) => value.replaceAll('{model}', model)) : []),
    ...(reasoningArgs && reasoning ? reasoningArgs.map((value) => value.replaceAll('{reasoning}', reasoning)) : [])
  ]
  if (!rendered.length) return template
  const promptIndex = template.findIndex((value) => value === '{prompt}' || value === '-')
  if (promptIndex < 0) return [...template, ...rendered]
  const insertIndex = template[promptIndex - 1] === '-p' ? promptIndex - 1 : promptIndex
  return [...template.slice(0, insertIndex), ...rendered, ...template.slice(insertIndex)]
}

function validateBaseUrl(value: string) {
  const url = new URL(value.trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(t("Provider URLs must use http or https"))
  return url.toString().replace(/\/$/, '')
}

export function encryptSecret(value: string) {
  const insecureBackend = process.platform === 'linux' && ['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend())
  if (insecureBackend || !safeStorage.isEncryptionAvailable()) throw new Error(t("Operating system credential encryption is unavailable. The API key was not saved"))
  return safeStorage.encryptString(value).toString('base64')
}

function decryptSecret(value: string) {
  return safeStorage.decryptString(Buffer.from(value, 'base64'))
}

function filterConversationModels(providerId: string, models: string[]) {
  const deny = /(?:embedding|moderation|whisper|tts|transcri|realtime|audio|image|dall-e|sora)/i
  const filtered = providerId === 'openrouter' || providerId.startsWith('custom:')
    ? models
    : models.filter((model) => !deny.test(model))
  return uniqueStrings(filtered).sort((left, right) => left.localeCompare(right)).slice(0, 500)
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
