import type {
  ModelInvocationRequest,
  ModelInvocationResult,
  ProviderCatalogGroup
} from '@agentflow/core'
import type { ModelParameterMetadata } from '@agentflow/core'
import type { WorkspaceBinding } from '@agentflow/schema'

export type ProviderProtocol = 'openai-compatible' | 'anthropic' | 'gemini'

export interface ProviderConfiguration {
  id: string
  name: string
  protocol: ProviderProtocol
  baseUrl: string
  anthropicWorkspaceId?: string
  added: boolean
  enabled: boolean
  custom: boolean
  hasApiKey: boolean
  manualModels: string[]
  discoveredModels: string[]
  disabledModels?: string[]
  modelMetadata?: Record<string, ModelParameterMetadata>
  modelsUpdatedAt?: string
}

export interface ProviderConfigurationInput {
  id: string
  name: string
  protocol: ProviderProtocol
  baseUrl: string
  anthropicWorkspaceId?: string
  added: boolean
  enabled: boolean
  custom: boolean
  apiKey?: string
  clearApiKey?: boolean
  manualModels: string[]
  disabledModels?: string[]
}

export interface AgentToolConfiguration {
  id: string
  name: string
  added: boolean
  enabled: boolean
  command: string
  model?: string
  models: string[]
  disabledModels?: string[]
  reasoningEfforts: string[]
  modelReasoningEfforts: Record<string, string[]>
  reasoningOverrideSupported: boolean
  installed: boolean
  loginCommand?: string
}

export interface AgentToolConfigurationInput {
  id: string
  added: boolean
  enabled: boolean
  command: string
  model?: string
  models: string[]
  disabledModels?: string[]
  reasoningEfforts: string[]
  modelReasoningEfforts?: Record<string, string[]>
}

export type SubscriptionConnectorId =
  | 'subscription:codex'
  | 'subscription:claude-code'
  | 'subscription:kimi-code'
  | 'subscription:antigravity'
  | 'subscription:deepseek-web'

export type SubscriptionConnectorTransport = 'runtime' | 'web'

export interface SubscriptionConnectorConnectOptions {
  acceptExperimentalRisk?: boolean
}

export type SubscriptionConnectorStatus =
  | 'not-installed'
  | 'system-tool-found'
  | 'ready'
  | 'needs-login'
  | 'connected'
  | 'error'

export interface SubscriptionConnectorConfiguration {
  id: SubscriptionConnectorId
  name: string
  accountName: string
  description: string
  quotaDescription: string
  transport: SubscriptionConnectorTransport
  experimental: boolean
  riskAccepted: boolean
  manualInstallUrl?: string
  status: SubscriptionConnectorStatus
  installed: boolean
  connected: boolean
  systemToolInstalled: boolean
  runtimeVersion?: string
  accountLabel?: string
  planType?: string
  detail?: string
  models: string[]
}

export interface SubscriptionConnectorProgress {
  connectorId: SubscriptionConnectorId
  phase: 'preparing' | 'downloading' | 'installing' | 'login' | 'connected' | 'error'
  message: string
  authUrl?: string
  userCode?: string
}

export interface RuntimeLoginProgress {
  requestId: string
  provider?: 'google' | 'claude'
  phase: 'starting' | 'awaiting-code' | 'verifying' | 'connected' | 'cancelled' | 'error'
  message: string
  authUrl?: string
}

export interface FeatureModelSettings {
  providerId: string
  model: string
}

export type PromptAutofillSettings = FeatureModelSettings

export const DEFAULT_CHAT_HISTORY_MAX_CHARS = 200_000
export const MIN_CHAT_HISTORY_MAX_CHARS = 1_000
export const MAX_CHAT_HISTORY_MAX_CHARS = 500_000

export interface LlmSettingsSnapshot {
  providers: ProviderConfiguration[]
  agentTools: AgentToolConfiguration[]
  subscriptions: SubscriptionConnectorConfiguration[]
  catalog: ProviderCatalogGroup[]
  promptAutofill: PromptAutofillSettings
  flowGeneration: FeatureModelSettings
  chatHistoryMaxChars: number
}

export interface LlmSettingsInput {
  providers: ProviderConfigurationInput[]
  agentTools: AgentToolConfigurationInput[]
  promptAutofill: PromptAutofillSettings
  flowGeneration: FeatureModelSettings
  chatHistoryMaxChars: number
}

export interface DesktopModelInvocationRequest extends ModelInvocationRequest {
  requestId: string
  workspace: WorkspaceBinding
}

export interface ModelStreamDelta {
  requestId: string
  delta: string
}

export interface DesktopLlmApi {
  loadLlmSettings(): Promise<LlmSettingsSnapshot>
  saveLlmSettings(input: LlmSettingsInput): Promise<LlmSettingsSnapshot>
  refreshProviderModels(providerId?: string): Promise<LlmSettingsSnapshot>
  testProvider(providerId: string): Promise<LlmSettingsSnapshot>
  detectAgentTools(): Promise<LlmSettingsSnapshot>
  refreshSubscriptionConnectors(): Promise<LlmSettingsSnapshot>
  connectSubscriptionConnector(connectorId: SubscriptionConnectorId, options?: SubscriptionConnectorConnectOptions): Promise<LlmSettingsSnapshot>
  disconnectSubscriptionConnector(connectorId: SubscriptionConnectorId): Promise<LlmSettingsSnapshot>
  onSubscriptionConnectorProgress(callback: (progress: SubscriptionConnectorProgress) => void): () => void
  loginAgentTool(toolId: string): Promise<void>
  submitRuntimeLoginCode(requestId: string, code: string): Promise<void>
  cancelRuntimeLogin(requestId: string): Promise<void>
  onRuntimeLoginProgress(callback: (progress: RuntimeLoginProgress) => void): () => void
  invokeModel(
    request: Omit<DesktopModelInvocationRequest, 'requestId'> & { requestId?: string },
    onDelta?: (delta: string) => void
  ): Promise<ModelInvocationResult>
  cancelModel(requestId: string): void
}
