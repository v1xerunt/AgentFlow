import { reasoningLabel } from './localization'
import { numericRequirement, parameterLabel } from './localization'
import { t } from './localization'
import type { AgentParameters } from '@agentflow/schema'

export const MODEL_RULES_VERIFIED_AT = '2026-09-01'
export interface ModelParameterMetadata {
  maxOutputTokens?: number
  defaultMaxTokens?: number
  supportedParameters?: string[]
  inputModalities?: string[]
  reasoning?: { supportedEfforts?: string[] | null; defaultEffort?: string; defaultEnabled?: boolean; mandatory?: boolean; supportsBudget?: boolean } | null
}

const providerMetadata = new Map<string, Record<string, ModelParameterMetadata>>()
export function setProviderModelMetadata(provider: string, models: Record<string, ModelParameterMetadata>) {
  providerMetadata.set(provider.trim().toLowerCase(), models)
}

const openAiImageModels = /^(gpt-(?:4o|4\.1|5)|o[134])/i
const anthropicImageModels = /^claude-(?:[^-]+-)*(?:3|4|5)(?:[-.]|$)/i
const geminiImageModels = /^gemini-(?:1\.5|2|3)/i

export function modelAttachmentIssue(providerId: string, model: string, mimeType: string): string | undefined {
  const provider = providerId.trim().toLowerCase()
  const normalizedMime = mimeType.trim().toLowerCase()
  const metadata = providerMetadata.get(provider)?.[model] ?? providerMetadata.get(provider)?.[model.toLowerCase()]
  const image = normalizedMime.startsWith('image/')
  if (!image) return t("{0} attachments are not supported", [normalizedMime || t("Unknown format")])

  const formats = provider === 'google' || provider === 'gemini'
    ? new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'])
    : new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  if (!formats.has(normalizedMime)) return t("{0} does not accept {1}", [model, mimeType])

  if (provider.startsWith('agent-tool:')) return t("Local Agent tools do not support image attachments yet")
  if (provider.startsWith('subscription:')) return t("Subscription connectors do not support image attachments yet")
  if (metadata?.inputModalities) {
    return metadata.inputModalities.includes('image') ? undefined : t("{0} does not support image input", [model])
  }
  if (provider === 'openrouter') return t("Image capabilities for {0} are missing. Refresh the model list first", [model])
  if (provider === 'openai') return openAiImageModels.test(model) ? undefined : t("{0} has not declared image input support", [model])
  if (provider === 'anthropic') return anthropicImageModels.test(model) ? undefined : t("{0} has not declared image input support", [model])
  if (provider === 'google' || provider === 'gemini') return geminiImageModels.test(model) ? undefined : t("{0} has not declared image input support", [model])
  if (provider === 'deepseek') return /vision|vl/i.test(model) ? undefined : t("{0} does not support image input", [model])
  if (provider === 'zai') return /(?:^|[-_.])(?:vl|\d+(?:\.\d+)?v)(?:[-_.]|$)/i.test(model) ? undefined : t("{0} has not declared image input support", [model])
  if (provider === 'kimi') return /vision|vl/i.test(model) ? undefined : t("{0} has not declared image input support", [model])
  return t("{0} has not declared image input support", [model])
}
type NumericKey = 'temperature' | 'topP' | 'topK' | 'maxTokens' | 'reasoningBudget' | 'presencePenalty' | 'frequencyPenalty' | 'seed'
export interface NumericParameterRule {
  min: number
  max?: number
  default?: number
  integer?: boolean
  fixed?: boolean
  specialValues?: number[]
}
export interface ModelParameterProfile {
  id: string
  verified: boolean
  source?: string
  numeric: Partial<Record<NumericKey, NumericParameterRule>>
  omitMaxTokens: boolean
  maxTokensField: 'max_tokens' | 'max_completion_tokens'
  reasoning?: { kind: 'effort' | 'budget' | 'toggle' | 'always-on'; levels?: string[]; default?: string; wire: 'openai' | 'thinking' | 'adaptive' | 'gemini' }
  samplingOnlyWithoutThinking?: boolean
  verbosity?: boolean
  stopSequences?: boolean
  note?: string
}

const tokenRule = (max?: number, defaultValue = -1): NumericParameterRule => ({ min: 1, max, integer: true, default: defaultValue, specialValues: [-1] })
const sampling = { temperature: { min: 0, max: 2, default: 1 }, topP: { min: 0, max: 1, default: 1 } }
const penalties = { presencePenalty: { min: -2, max: 2, default: 0 }, frequencyPenalty: { min: -2, max: 2, default: 0 } }
const generic: ModelParameterProfile = { id: 'openai-compatible', verified: false, numeric: { ...sampling, maxTokens: tokenRule() }, omitMaxTokens: true, maxTokensField: 'max_tokens' }
const openai: ModelParameterProfile = {
  id: 'gpt-5.6', verified: true, source: 'https://developers.openai.com/api/docs/guides/latest-model',
  numeric: { maxTokens: tokenRule(128000) }, omitMaxTokens: true, maxTokensField: 'max_completion_tokens',
  reasoning: { kind: 'effort', levels: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], default: 'medium', wire: 'openai' }, verbosity: true,
  get note() { return t("Sampling is managed by the model. The output limit includes reasoning tokens.") }
}
const claude: ModelParameterProfile = {
  id: 'claude-5', verified: true, source: 'https://platform.claude.com/docs/en/build-with-claude/effort',
  numeric: { maxTokens: tokenRule(128000, 128000) }, omitMaxTokens: false, maxTokensField: 'max_tokens',
  reasoning: { kind: 'effort', levels: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'high', wire: 'adaptive' }, stopSequences: true,
  get note() { return t("Adaptive reasoning. The output limit includes reasoning tokens and is required by this endpoint. The initial value is the model’s maximum output.") }
}
const claude46: ModelParameterProfile = {
  ...claude,
  id: 'claude-4.6-adaptive',
  reasoning: { kind: 'effort', levels: ['low', 'medium', 'high', 'max'], default: 'high', wire: 'adaptive' },
  get note() { return t("Adaptive reasoning uses effort. The output limit includes reasoning tokens.") }
}
const gemini: ModelParameterProfile = {
  id: 'gemini-3-flash', verified: true, source: 'https://ai.google.dev/gemini-api/docs/generate-content/thinking',
  numeric: { maxTokens: tokenRule(65536, 65536) }, omitMaxTokens: true, maxTokensField: 'max_tokens',
  reasoning: { kind: 'effort', levels: ['low', 'medium', 'high'], default: 'medium', wire: 'gemini' },
  get note() { return t("Uses thinking level. Sampling for this Flash generation is managed by the server.") }
}
const deepseek: ModelParameterProfile = {
  id: 'deepseek-v4', verified: true, source: 'https://api-docs.deepseek.com/api/create-chat-completion/',
  numeric: { ...sampling, ...penalties, maxTokens: tokenRule(393216) }, omitMaxTokens: true, maxTokensField: 'max_tokens',
  reasoning: { kind: 'effort', levels: ['none', 'low', 'high', 'max'], default: 'high', wire: 'thinking' }, samplingOnlyWithoutThinking: true, stopSequences: true,
  get note() { return t("Sampling and penalty parameters are unused during reasoning. Select Off to disable reasoning.") }
}
const zai: ModelParameterProfile = {
  id: 'glm-5.3', verified: true, source: 'https://docs.z.ai/guides/overview/concept-param',
  numeric: { temperature: { min: 0, max: 1, default: 1 }, topP: { min: 0.01, max: 1, default: 0.95 }, maxTokens: tokenRule(131072, 65536) },
  omitMaxTokens: true, maxTokensField: 'max_tokens', reasoning: { kind: 'effort', levels: ['low', 'high', 'max'], default: 'max', wire: 'thinking' },
  get note() { return t("Reasoning is always enabled for this model.") }
}
const kimi: ModelParameterProfile = {
  id: 'kimi-k3', verified: true, source: 'https://platform.kimi.ai/docs/guide/kimi-k3-quickstart',
  numeric: { temperature: { min: 1, max: 1, default: 1, fixed: true }, topP: { min: .95, max: .95, default: .95, fixed: true }, maxTokens: tokenRule(1048576, 131072) },
  omitMaxTokens: true, maxTokensField: 'max_completion_tokens', reasoning: { kind: 'effort', levels: ['low', 'high', 'max'], default: 'max', wire: 'openai' },
  get note() { return t("Sampling parameters are fixed by the provider. Kimi K3 always reasons.") }
}

// Exact IDs and documented snapshot families. Unknown models deliberately use the generic profile.
export const MODEL_PARAMETER_PROFILES: { provider: string; models: string[]; profile: ModelParameterProfile }[] = [
  { provider: 'openai', models: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6'], profile: openai },
  { provider: 'anthropic', models: ['claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5'], profile: claude },
  { provider: 'anthropic', models: ['claude-opus-4-8', 'claude-opus-4-7'], profile: claude },
  { provider: 'anthropic', models: ['claude-opus-4-6', 'claude-sonnet-4-6'], profile: claude46 },
  { provider: 'google', models: ['gemini-3.7-flash'], profile: gemini },
  { provider: 'google', models: ['gemini-3.6-flash', 'gemini-3.5-flash'], profile: { ...gemini, reasoning: { ...gemini.reasoning!, levels: ['minimal', 'low', 'medium', 'high'] } } },
  { provider: 'google', models: ['gemini-3.5-flash-lite'], profile: { ...gemini, reasoning: { ...gemini.reasoning!, levels: ['minimal', 'low', 'medium', 'high'], default: 'minimal' } } },
  { provider: 'google', models: ['gemini-3.1-pro-preview'], profile: { ...gemini, numeric: { ...sampling, topP: { min: 0, max: 1, default: .95 }, maxTokens: tokenRule(65536, 65536) }, reasoning: { ...gemini.reasoning!, default: 'high' }, get note() { return t("Pro requires reasoning. Keep temperature at 1.") } } },
  ...(['pro', 'flash', 'flash-lite'] as const).map((tier) => ({ provider: 'google', models: [`gemini-2.5-${tier}`], profile: {
    ...gemini, id: `gemini-2.5-${tier}`, stopSequences: true, numeric: { ...sampling, seed: { min: -2147483648, max: 2147483647, integer: true }, topP: { min: 0, max: 1, default: .95 }, maxTokens: tokenRule(65536, 65536), reasoningBudget: { min: tier === 'pro' ? 128 : tier === 'flash-lite' ? 512 : 0, max: tier === 'pro' ? 32768 : 24576, integer: true, default: tier === 'flash-lite' ? 0 : -1, specialValues: tier === 'pro' ? [-1] : [-1, 0] } },
    reasoning: { kind: 'budget' as const, wire: 'gemini' as const }, note: t("A reasoning budget of -1 enables a dynamic budget{0}.", [tier === 'pro' ? t("; Pro requires a nonzero value") : t("; 0 disables reasoning")])
  } })),
  { provider: 'deepseek', models: ['deepseek-v4-flash', 'deepseek-v4-flash-0731', 'deepseek-v4-pro', 'deepseek-v4-pro-0813', 'deepseek-v4-flash-vision-exp'], profile: deepseek },
  { provider: 'zai', models: ['glm-5.3', 'glm-5.3-flash'], profile: zai },
  { provider: 'zai', models: ['glm-5.2'], profile: { ...zai, id: 'glm-5.2', reasoning: { ...zai.reasoning!, levels: ['none', 'low', 'high', 'max'] }, get note() { return t("Select Off to disable reasoning.") } } },
  { provider: 'kimi', models: ['kimi-k3'], profile: kimi },
  { provider: 'kimi', models: ['kimi-k2.7-code', 'kimi-k2.7-code-highspeed'], profile: { ...kimi, id: 'kimi-k2.7-code', source: 'https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart', maxTokensField: 'max_tokens', numeric: { ...kimi.numeric, maxTokens: tokenRule(262144, 32768) }, reasoning: undefined, get note() { return t("Reasoning is always on. Temperature is fixed at 1 and Top-P at 0.95.") } } },
  { provider: 'kimi', models: ['kimi-k2.6'], profile: { ...kimi, id: 'kimi-k2.6', source: 'https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart', maxTokensField: 'max_tokens', numeric: { ...kimi.numeric, maxTokens: tokenRule(262144, 32768) }, reasoning: { kind: 'toggle', levels: ['none', 'enabled'], default: 'enabled', wire: 'thinking' }, get note() { return t("Temperature is 1 with reasoning on and 0.6 with it off. Top-P is fixed at 0.95.") } } }
]

export function modelParameterProfile(providerId: string, model: string): ModelParameterProfile {
  const normalizedProvider = providerId.trim().toLowerCase()
  let provider = ({ gemini: 'google', claude: 'anthropic', moonshot: 'kimi', 'z.ai': 'zai', 'zai-coding-plan': 'zai' } as Record<string, string>)[normalizedProvider] ?? normalizedProvider
  let modelId = model.trim().toLowerCase()
  const metadata = providerMetadata.get(provider)?.[model] ?? providerMetadata.get(provider)?.[modelId]
  if (provider === 'subscription:deepseek-web') {
    const expert = /reasoner|expert|pro/.test(modelId)
    return {
      ...generic, id: 'deepseek-web', numeric: {}, omitMaxTokens: true,
      reasoning: expert ? { kind: 'always-on', wire: 'thinking' } : { kind: 'toggle', levels: ['none', 'enabled'], default: 'none', wire: 'thinking' },
      note: expert ? t("Web expert mode enables deep thinking. Output length is managed by the web service.") : t("Web default mode supports toggling deep thinking. Output length is managed by the web service.")
    }
  }
  if (provider.startsWith('agent-tool:')) {
    const base = { ...generic, id: 'agent-tool', numeric: {}, omitMaxTokens: false }
    if (!metadata?.reasoning?.supportedEfforts?.length) return base
    return { ...base, reasoning: { kind: 'effort', levels: metadata.reasoning.supportedEfforts, default: metadata.reasoning.defaultEffort, wire: 'openai' } }
  }
  const routed = provider === 'openrouter'
  if (routed) {
    const [vendor = '', ...parts] = modelId.split('/')
    const normalizedVendor = vendor.replace(/^~/, '')
    provider = ({ moonshotai: 'kimi', 'z-ai': 'zai' } as Record<string, string>)[normalizedVendor] ?? normalizedVendor
    modelId = parts.join('/').replace(/:.*$/, '')
    if (provider === 'anthropic') modelId = modelId.replace(/(\d)\.(\d)/g, '$1-$2')
  }
  const entry = MODEL_PARAMETER_PROFILES.find((item) => item.provider === provider && item.models.includes(modelId))
  const profile = entry?.profile ?? (provider === 'anthropic' ? { ...generic, numeric: { maxTokens: tokenRule() }, omitMaxTokens: false }
    : provider === 'openai' && /^(gpt-5|o[134])/.test(modelId) ? { ...generic, numeric: { maxTokens: tokenRule() }, maxTokensField: 'max_completion_tokens' as const } : generic)
  // OpenRouter has a unified reasoning envelope and accepts max_tokens for every routed model.
  const resolved: ModelParameterProfile = routed ? { ...profile, numeric: { ...profile.numeric, maxTokens: tokenRule(profile.numeric.maxTokens?.max) }, maxTokensField: 'max_tokens', omitMaxTokens: true } : profile
  return applyModelMetadata(resolved, metadata, routed)
}

function applyModelMetadata(profile: ModelParameterProfile, metadata: ModelParameterMetadata | undefined, routed: boolean): ModelParameterProfile {
  if (!metadata) return profile
  const numeric = { ...profile.numeric }
  if (routed && metadata.supportedParameters) {
    const wireKeys: Partial<Record<NumericKey, string>> = { temperature: 'temperature', topP: 'top_p', topK: 'top_k', frequencyPenalty: 'frequency_penalty', presencePenalty: 'presence_penalty', seed: 'seed' }
    for (const [key, wireKey] of Object.entries(wireKeys)) if (!metadata.supportedParameters.includes(wireKey)) delete numeric[key as NumericKey]
  }
  const max = metadata.maxOutputTokens ?? numeric.maxTokens?.max
  if (numeric.maxTokens) numeric.maxTokens = tokenRule(max, metadata.defaultMaxTokens ?? numeric.maxTokens.default ?? -1)
  let reasoning = profile.reasoning
  if (routed && metadata.reasoning !== undefined) {
    delete numeric.reasoningBudget
    reasoning = undefined
    const info = metadata.reasoning
    if (info) {
      const order = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
      const allowed = info.supportedEfforts === null ? order : info.supportedEfforts ?? []
      const levels = order.filter((level) => allowed.includes(level) && !(info.mandatory && level === 'none'))
      if (levels.length) reasoning = { kind: 'effort', levels, default: info.defaultEnabled === false ? (levels.includes('none') ? 'none' : undefined) : levels.includes(info.defaultEffort ?? '') ? info.defaultEffort : undefined, wire: 'openai' }
      else if (info.supportsBudget) {
        reasoning = { kind: 'budget', wire: 'openai' }
        numeric.reasoningBudget = { min: 1, max, integer: true }
      } else if (info.mandatory) reasoning = { kind: 'always-on', wire: 'openai' }
      else reasoning = { kind: 'toggle', levels: ['none', 'enabled'], default: info.defaultEnabled === undefined ? undefined : info.defaultEnabled ? 'enabled' : 'none', wire: 'openai' }
    }
  }
  return { ...profile, numeric, reasoning,
    ...(routed && metadata.supportedParameters ? { verbosity: metadata.supportedParameters.includes('verbosity'), stopSequences: metadata.supportedParameters.includes('stop') } : {}),
    ...(routed && metadata.reasoning !== undefined ? { source: 'https://openrouter.ai/docs/guides/best-practices/reasoning-tokens', note: t("Reasoning capabilities and defaults come from the OpenRouter model catalog.") } : {}) }
}

export function effectiveModelParameters(providerId: string, model: string, overrides: AgentParameters = {}, savedDefaults: AgentParameters = {}): AgentParameters {
  const profile = modelParameterProfile(providerId, model)
  const defaults: AgentParameters = {}
  for (const [key, rule] of Object.entries(profile.numeric)) if (rule.default !== undefined) (defaults as Record<string, unknown>)[key] = rule.default
  if (profile.reasoning?.default) defaults.reasoningLevel = profile.reasoning.default
  if (profile.verbosity) defaults.verbosity = 'medium'
  const defined = (values: AgentParameters) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
  const result = { ...defaults, ...defined(savedDefaults), ...defined(overrides) } as AgentParameters
  if (result.maxTokens === null) result.maxTokens = -1
  if (profile.id === 'kimi-k2.6') result.temperature = result.reasoningLevel === 'none' ? .6 : 1
  return result
}

export function featureReasoningParameters(providerId: string, model: string): AgentParameters {
  const profile = modelParameterProfile(providerId, model)
  if (!profile.reasoning) return {}
  if (providerId.trim().toLowerCase() === 'openrouter') return { reasoningLevel: 'medium' }
  if (profile.reasoning.kind === 'effort' && profile.reasoning.levels?.includes('medium')) return { reasoningLevel: 'medium' }
  if (profile.reasoning.kind === 'toggle') return { reasoningLevel: 'enabled' }
  return {}
}

export function modelParameterIssues(providerId: string, model: string, values: AgentParameters): string[] {
  const profile = modelParameterProfile(providerId, model)
  const issues: string[] = []
  const thinking = values.reasoningLevel ? values.reasoningLevel !== 'none' : (values.reasoningBudget ?? 0) !== 0
  for (const [key, rule] of Object.entries(profile.numeric)) {
    const value = values[key as NumericKey]
    if (value === undefined) continue
    if (profile.samplingOnlyWithoutThinking && thinking && ['temperature', 'topP', 'topK', 'presencePenalty', 'frequencyPenalty'].includes(key)) continue
    if (key === 'temperature' && profile.id === 'kimi-k2.6' && value === (values.reasoningLevel === 'none' ? .6 : 1)) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || (rule.integer && !Number.isInteger(value)) || (!rule.specialValues?.includes(value) && (value < rule.min || (rule.max !== undefined && value > rule.max)))) {
      issues.push(t('{0} must be {1}.', [parameterLabel(key), numericRequirement(rule)]))
    }
  }
  if (profile.reasoning?.levels && values.reasoningLevel && !profile.reasoning.levels.includes(values.reasoningLevel)) issues.push(t("Supported reasoning effort: {0}", [profile.reasoning.levels.map(reasoningLabel).join(' / ')]))
  const outputLimit = values.maxTokens === -1 ? profile.numeric.maxTokens?.max : values.maxTokens ?? profile.numeric.maxTokens?.default
  if (values.maxTokens === -1 && !profile.omitMaxTokens && !profile.numeric.maxTokens?.max) issues.push(t("This endpoint requires an output limit. Enter a positive integer supported by the model"))
  if (values.stopSequences && (values.stopSequences.length > 4 || values.stopSequences.some((s) => !s))) issues.push(t("Up to 4 nonempty stop sequences are allowed"))
  if (values.verbosity && !['low', 'medium', 'high'].includes(values.verbosity)) issues.push(t("Response detail supports Low, Medium, and High"))
  if (values.customParameters) {
    const invalidKeys = findInvalidCustomParameterKeys(values.customParameters)
    if (invalidKeys.length) issues.push(t("Custom parameters cannot change: {0}", [invalidKeys.join(', ')]))
  }
  return issues
}

export function validatedModelParameters(providerId: string, model: string, overrides?: AgentParameters): AgentParameters {
  const profile = modelParameterProfile(providerId, model)
  const values = effectiveModelParameters(providerId, model, overrides)
  const issues = modelParameterIssues(providerId, model, values)
  if (issues.length) throw new Error(t("Invalid parameters for {0}: {1}", [model, issues.join('; ')]))
  const result: AgentParameters = {}
  const thinking = values.reasoningLevel ? values.reasoningLevel !== 'none' : (values.reasoningBudget ?? 0) !== 0
  for (const [key, rule] of Object.entries(profile.numeric)) {
    if (key === 'maxTokens' && values.maxTokens === -1) {
      if (!profile.omitMaxTokens) result.maxTokens = rule.max
      continue
    }
    if (rule.fixed) continue
    if (profile.samplingOnlyWithoutThinking && thinking && ['temperature', 'topP', 'topK', 'presencePenalty', 'frequencyPenalty'].includes(key)) continue
    if (values[key as NumericKey] !== undefined && values[key as NumericKey] !== null) (result as Record<string, unknown>)[key] = values[key as NumericKey]
  }
  if (profile.reasoning?.levels) result.reasoningLevel = values.reasoningLevel
  if (profile.stopSequences && values.stopSequences?.length) result.stopSequences = values.stopSequences
  if (profile.verbosity) result.verbosity = values.verbosity
  if (values.customParameters && Object.keys(values.customParameters).length) result.customParameters = structuredClone(values.customParameters)
  return result
}

const reservedCustomParameterKeys = new Set(['model', 'messages', 'contents', 'system', 'systemInstruction', 'stream'])

function findInvalidCustomParameterKeys(values: Record<string, unknown>, path = ''): string[] {
  const invalid: string[] = []
  for (const [key, value] of Object.entries(values)) {
    const keyPath = path ? `${path}.${key}` : key
    if (key === '__proto__' || key === 'prototype' || key === 'constructor' || (!path && reservedCustomParameterKeys.has(key))) invalid.push(keyPath)
    if (value && typeof value === 'object' && !Array.isArray(value)) invalid.push(...findInvalidCustomParameterKeys(value as Record<string, unknown>, keyPath))
  }
  return invalid
}
