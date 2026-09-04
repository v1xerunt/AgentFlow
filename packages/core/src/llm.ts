import type { AgentParameters } from '@agentflow/schema'
import { modelParameterProfile, validatedModelParameters } from './model-parameters'

export type ModelMessageRole = 'system' | 'user' | 'assistant'

export interface ModelTextPart {
  type: 'text'
  text: string
}

export interface ModelImagePart {
  type: 'image'
  name: string
  mimeType: string
  dataBase64: string
}

export type ModelMessageContent = string | Array<ModelTextPart | ModelImagePart>

export interface ModelResponsePart {
  type: 'output_text' | 'reasoning_summary' | 'reasoning'
  text: string
}

export interface ModelProviderState {
  format: 'openai-responses' | 'anthropic-content' | 'gemini-parts' | 'openai-reasoning-details'
  data?: unknown
}

export interface ModelMessage {
  role: ModelMessageRole
  content: ModelMessageContent
  providerState?: ModelProviderState
}

export interface ModelUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface ModelInvocationRequest {
  providerId: string
  model: string
  messages: ModelMessage[]
  parameters?: AgentParameters
  responseMode?: 'conversation' | 'structured'
  externalSessionId?: string
  outputDirectory?: {
    path: string
    note: string
    extractText: boolean
  }
}

export interface ModelOutputFile {
  name: string
  relativePath: string
  mimeType: string
  size: number
  mode: 'text' | 'attachment'
  content?: string
  dataBase64?: string
  extractionError?: string
}

export interface ModelInvocationResult {
  content: string
  parts?: ModelResponsePart[]
  providerState?: ModelProviderState
  providerId: string
  model: string
  externalSessionId?: string
  usage?: ModelUsage
  files?: ModelOutputFile[]
}

export type ModelInvoker = (
  request: ModelInvocationRequest,
  onDelta?: (delta: string) => void,
  signal?: AbortSignal
) => Promise<ModelInvocationResult>

export type ConnectorKind = 'model' | 'agent-tool' | 'subscription'

export interface ModelParameterSupport {
  temperature: boolean
  temperatureMin?: number
  temperatureMax?: number
  topP: boolean
  maxTokens: boolean
  reasoning: boolean
  reasoningLevels?: string[]
}

export interface ModelCatalogItem {
  providerId: string
  providerName: string
  modelId: string
  modelName: string
  connector: ConnectorKind
  configured: boolean
  parameters: ModelParameterSupport
}

export interface ProviderCatalogGroup {
  id: string
  name: string
  connector: ConnectorKind
  configured: boolean
  models: ModelCatalogItem[]
}

export function parameterSupportFor(providerId: string, modelId: string): ModelParameterSupport {
  const profile = modelParameterProfile(providerId, modelId)
  return {
    temperature: !!profile.numeric.temperature && !profile.numeric.temperature.fixed,
    temperatureMin: profile.numeric.temperature?.min,
    temperatureMax: profile.numeric.temperature?.max,
    topP: !!profile.numeric.topP && !profile.numeric.topP.fixed,
    maxTokens: !!profile.numeric.maxTokens,
    reasoning: !!profile.reasoning,
    reasoningLevels: profile.reasoning?.levels
  }
}

export function sanitizeModelParameters(providerId: string, modelId: string, parameters?: AgentParameters): AgentParameters {
  return validatedModelParameters(providerId, modelId, parameters)
}

export function normalizeProviderId(providerId: string) {
  const normalized = providerId.trim().toLowerCase()
  const aliases: Record<string, string> = {
    google: 'google',
    gemini: 'google',
    anthropic: 'anthropic',
    claude: 'anthropic',
    openai: 'openai',
    deepseek: 'deepseek',
    'z.ai': 'zai',
    zai: 'zai',
    'zai-coding-plan': 'zai',
    kimi: 'kimi',
    moonshot: 'kimi',
    openrouter: 'openrouter',
    fake: 'fake'
  }
  return aliases[normalized] ?? normalized
}
