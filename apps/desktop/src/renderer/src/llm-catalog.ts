import { localizeLabel } from '@agentflow/core/localization'
import { t } from '@agentflow/core/localization'
import { parameterSupportFor, setProviderModelMetadata, type ProviderCatalogGroup } from '@agentflow/core'
import type { LlmSettingsSnapshot, SubscriptionConnectorId } from '../../shared/llm'
import { DEFAULT_CHAT_HISTORY_MAX_CHARS } from '../../shared/llm'

const fallbackGroups: Array<{ id: string; name: string; models: string[] }> = [
  { id: 'fake', get name() { return t('Demo model') }, models: ['agent-v1'] }
]

export const fallbackCatalog: ProviderCatalogGroup[] = fallbackGroups.map((group) => ({
  id: group.id,
  name: localizeLabel(group.name),
  connector: 'model',
  configured: group.id === 'fake',
  models: group.models.map((modelId) => ({
    providerId: group.id,
    providerName: localizeLabel(group.name),
    modelId,
    modelName: modelId,
    connector: 'model',
    configured: group.id === 'fake',
    parameters: parameterSupportFor(group.id, modelId)
  }))
}))

export const fallbackLlmSettings: LlmSettingsSnapshot = {
  providers: [
    fallbackProvider('openai', 'OpenAI', 'openai-compatible', 'https://api.openai.com/v1'),
    fallbackProvider('anthropic', 'Anthropic', 'anthropic', 'https://api.anthropic.com/v1'),
    fallbackProvider('google', 'Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta'),
    fallbackProvider('deepseek', 'DeepSeek', 'openai-compatible', 'https://api.deepseek.com'),
    fallbackProvider('zai', 'Z.AI', 'openai-compatible', 'https://api.z.ai/api/paas/v4'),
    fallbackProvider('zai-coding-plan', 'Z.AI GLM Coding Plan', 'openai-compatible', 'https://api.z.ai/api/coding/paas/v4'),
    fallbackProvider('kimi', 'Kimi', 'openai-compatible', 'https://api.moonshot.ai/v1'),
    fallbackProvider('openrouter', 'OpenRouter', 'openai-compatible', 'https://openrouter.ai/api/v1')
  ],
  agentTools: [
    fallbackAgentTool('agent-tool:codex', 'Codex', 'codex'),
    fallbackAgentTool('agent-tool:claude-code', 'Claude Code', 'claude'),
    fallbackAgentTool('agent-tool:deepseek-harness', 'DeepSeek Harness', 'dsh'),
    fallbackAgentTool('agent-tool:kimi-code', 'Kimi Code', 'kimi'),
    fallbackAgentTool('agent-tool:antigravity', 'Antigravity', 'agy')
  ],
  subscriptions: [
    fallbackSubscription('subscription:codex', 'ChatGPT（Codex）', 'ChatGPT', 'https://learn.chatgpt.com/docs/codex/cli'),
    fallbackSubscription('subscription:claude-code', 'Claude（Claude Code）', 'Claude', 'https://code.claude.com/docs/en/installation'),
    fallbackSubscription('subscription:kimi-code', 'Kimi（Kimi Code）', 'Kimi', 'https://www.kimi.com/code/docs/en/kimi-code-cli/guides/getting-started.html'),
    fallbackSubscription('subscription:antigravity', 'Gemini（Antigravity）', 'Google', 'https://antigravity.google/docs/cli/install/'),
    { ...fallbackSubscription('subscription:deepseek-web', 'DeepSeek（Web Bridge）', 'DeepSeek'), transport: 'web', experimental: true, get description() { return t("Sign in to your DeepSeek web account in a dedicated browser.") }, get quotaDescription() { return t("Uses the DeepSeek web service. This experimental connection may stop working after web protocol or account security changes.") }, models: ['deepseek-chat', 'deepseek-reasoner'] }
  ],
  catalog: fallbackCatalog,
  promptAutofill: { providerId: '', model: '' },
  flowGeneration: { providerId: '', model: '' },
  chatHistoryMaxChars: DEFAULT_CHAT_HISTORY_MAX_CHARS
}

export function registerLlmModelMetadata(settings: LlmSettingsSnapshot) {
  for (const provider of settings.providers) setProviderModelMetadata(provider.id, provider.modelMetadata ?? {})
  for (const group of settings.catalog.filter((candidate) => candidate.connector !== 'model')) {
    setProviderModelMetadata(group.id, Object.fromEntries(group.models.map((model) => [model.modelId, {
      reasoning: model.parameters.reasoning && model.parameters.reasoningLevels?.length
        ? { supportedEfforts: [...model.parameters.reasoningLevels] }
        : null
    }])))
  }
}

function fallbackProvider(id: string, name: string, protocol: 'openai-compatible' | 'anthropic' | 'gemini', baseUrl: string) {
  return { id, name, protocol, baseUrl, added: false, enabled: false, custom: false, hasApiKey: false, manualModels: [], discoveredModels: [] }
}

function fallbackAgentTool(id: string, name: string, command: string) {
  return { id, name, command, model: undefined, models: [], reasoningEfforts: [], modelReasoningEfforts: {}, reasoningOverrideSupported: false, added: false, enabled: false, installed: false }
}

function fallbackSubscription(id: SubscriptionConnectorId, name: string, accountName: string, manualInstallUrl?: string) {
  return { id, name, accountName, description: '', quotaDescription: '', transport: 'runtime' as const, experimental: false, riskAccepted: false, manualInstallUrl, status: 'not-installed' as const, installed: false, connected: false, systemToolInstalled: false, models: ['@tool-default'] }
}

export interface ProviderModelOptions {
  provider: string
  label: string
  configured: boolean
  connector: 'model' | 'agent-tool' | 'subscription'
  models: string[]
}

export function providerModelsFromCatalog(catalog: ProviderCatalogGroup[]): ProviderModelOptions[] {
  return catalog.map((group) => ({
    provider: group.id,
    label: group.id === 'fake' ? t('Demo model') : group.id.startsWith('custom:') ? group.name : localizeLabel(group.name),
    configured: group.configured,
    connector: group.connector,
    models: group.models.map((model) => model.modelId)
  })).filter((group) => group.models.length > 0)
}

export function defaultModelFromCatalog(catalog: ProviderCatalogGroup[]) {
  const group = catalog.find((candidate) => candidate.id !== 'fake' && candidate.configured && candidate.models.length)
    ?? catalog.find((candidate) => candidate.id === 'fake')
    ?? catalog.find((candidate) => candidate.models.length)
  return { provider: group?.id ?? 'fake', model: group?.models[0]?.modelId ?? 'agent-v1' }
}
