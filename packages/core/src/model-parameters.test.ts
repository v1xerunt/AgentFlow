import { afterEach, describe, expect, it } from 'vitest'
import { MODEL_PARAMETER_PROFILES, effectiveModelParameters, featureReasoningParameters, modelParameterIssues, modelParameterProfile, setProviderModelMetadata, validatedModelParameters } from './model-parameters'

afterEach(() => { setProviderModelMetadata('openrouter', {}); setProviderModelMetadata('google', {}); setProviderModelMetadata('agent-tool:codex', {}) })

describe('documented model parameter profiles', () => {
  it('covers at least three current model IDs per built-in vendor with valid defaults', () => {
    for (const provider of ['openai', 'anthropic', 'google', 'deepseek', 'zai', 'kimi']) {
      const entries = MODEL_PARAMETER_PROFILES.filter((item) => item.provider === provider)
      expect(entries.flatMap((entry) => entry.models).length).toBeGreaterThanOrEqual(3)
      for (const { models } of entries) for (const model of models) {
        expect(modelParameterIssues(provider, model, effectiveModelParameters(provider, model))).toEqual([])
        expect(() => validatedModelParameters(provider, model)).not.toThrow()
      }
    }
  })
  it('merges built-in, per-model and current-node parameters without losing explicit omission', () => {
    expect(effectiveModelParameters('custom:local', 'local-model', { temperature: .4, maxTokens: -1 }, { temperature: .8, topP: .7, maxTokens: 6000 })).toEqual({ temperature: .4, topP: .7, maxTokens: -1 })
    expect(effectiveModelParameters('custom:local', 'local-model', { maxTokens: null }).maxTokens).toBe(-1)
    expect(validatedModelParameters('custom:local', 'local-model', { maxTokens: null })).not.toHaveProperty('maxTokens')
  })
  it('rejects invalid max tokens and translates -1 according to the endpoint contract', () => {
    for (const maxTokens of [-2, 0, 4.5, Infinity, 128001]) expect(() => validatedModelParameters('anthropic', 'claude-sonnet-5', { maxTokens })).toThrow()
    expect(validatedModelParameters('anthropic', 'claude-sonnet-5', { maxTokens: -1 }).maxTokens).toBe(128000)
    expect(validatedModelParameters('openrouter', 'deepseek/deepseek-v4-flash-0731', { maxTokens: -1 })).not.toHaveProperty('maxTokens')
    expect(() => validatedModelParameters('anthropic', 'unknown-model', { maxTokens: -1 })).toThrow('必须指定输出上限')
  })
  it('distinguishes Gemini budgets from levels and validates disabling constraints', () => {
    expect(validatedModelParameters('google', 'gemini-2.5-pro').reasoningBudget).toBe(-1)
    expect(() => validatedModelParameters('google', 'gemini-2.5-pro', { reasoningBudget: 0 })).toThrow()
    expect(() => validatedModelParameters('google', 'gemini-2.5-flash', { reasoningBudget: 24577 })).toThrow()
    expect(validatedModelParameters('google', 'gemini-2.5-flash-lite', { reasoningBudget: 0 }).reasoningBudget).toBe(0)
    expect(() => validatedModelParameters('google', 'gemini-3.7-flash', { reasoningLevel: 'minimal' })).toThrow()
    expect(validatedModelParameters('google', 'gemini-3.5-flash-lite').reasoningLevel).toBe('minimal')
  })
  it('handles DeepSeek sampling only when thinking is disabled', () => {
    expect(validatedModelParameters('deepseek', 'deepseek-v4-flash')).toEqual({ reasoningLevel: 'high' })
    expect(validatedModelParameters('deepseek', 'deepseek-v4-flash', { reasoningLevel: 'none', temperature: .3 })).toMatchObject({ temperature: .3, topP: 1, reasoningLevel: 'none' })
  })
  it('enforces ZAI and Kimi fixed values and effort ranges', () => {
    expect(() => validatedModelParameters('zai', 'glm-5.3', { reasoningLevel: 'none' })).toThrow()
    expect(() => validatedModelParameters('zai', 'glm-5.3', { topP: 0 })).toThrow()
    expect(() => validatedModelParameters('kimi', 'kimi-k3', { topP: .5 })).toThrow()
    expect(validatedModelParameters('kimi', 'kimi-k3')).not.toHaveProperty('temperature')
    expect(effectiveModelParameters('kimi', 'kimi-k2.6', { reasoningLevel: 'none' }).temperature).toBe(.6)
    expect(modelParameterProfile('zai-coding-plan', 'glm-5.3').id).toBe('glm-5.3')
  })
  it('leaves unmaintained models on generic controls and preserves custom request parameters', () => {
    expect(modelParameterProfile('anthropic', 'claude-haiku-4-5').verified).toBe(false)
    expect(modelParameterProfile('anthropic', 'claude-haiku-4-5').reasoning).toBeUndefined()
    expect(validatedModelParameters('anthropic', 'claude-haiku-4-5', { maxTokens: 64000, customParameters: { thinking: { type: 'enabled', budget_tokens: 4096 } } })).toMatchObject({
      maxTokens: 64000,
      customParameters: { thinking: { type: 'enabled', budget_tokens: 4096 } }
    })
    expect(() => validatedModelParameters('anthropic', 'claude-haiku-4-5', { maxTokens: 64000, customParameters: { messages: [] } })).toThrow('自定义参数不能修改')
  })
  it('uses routed model profiles without applying vendor rules to unrelated custom names', () => {
    expect(modelParameterProfile('openrouter', 'anthropic/claude-fable-5.1').id).toBe('claude-5')
    expect(modelParameterProfile('openrouter', 'moonshotai/kimi-k3').maxTokensField).toBe('max_tokens')
    expect(modelParameterProfile('custom:local', 'gpt-5.6-sol').verified).toBe(false)
    expect(validatedModelParameters('agent-tool:codex', 'default')).toEqual({})
  })
  it('exposes detected Codex reasoning levels for the tool default model', () => {
    setProviderModelMetadata('agent-tool:codex', { '@tool-default': { reasoning: { supportedEfforts: ['low', 'medium', 'high', 'xhigh'] } } })
    expect(modelParameterProfile('agent-tool:codex', '@tool-default').reasoning?.levels).toEqual(['low', 'medium', 'high', 'xhigh'])
    expect(validatedModelParameters('agent-tool:codex', '@tool-default', { reasoningLevel: 'high' })).toEqual({ reasoningLevel: 'high' })
  })
  it('limits DeepSeek Web parameters to its browser thinking capability', () => {
    expect(modelParameterProfile('subscription:deepseek-web', 'deepseek-chat')).toMatchObject({ numeric: {}, reasoning: { kind: 'toggle', levels: ['none', 'enabled'] } })
    expect(modelParameterProfile('subscription:deepseek-web', 'deepseek-reasoner').reasoning?.kind).toBe('always-on')
    expect(validatedModelParameters('subscription:deepseek-web', 'deepseek-chat', { temperature: 0.5, maxTokens: 2048, reasoningLevel: 'enabled' })).toEqual({ reasoningLevel: 'enabled' })
  })
  it('uses documented provider defaults and defers unspecified values to the endpoint', () => {
    expect(effectiveModelParameters('zai', 'glm-5.3').maxTokens).toBe(65536)
    expect(effectiveModelParameters('kimi', 'kimi-k3').maxTokens).toBe(131072)
    expect(effectiveModelParameters('kimi', 'kimi-k2.7-code').maxTokens).toBe(32768)
    expect(effectiveModelParameters('google', 'gemini-3.7-flash').maxTokens).toBe(65536)
    expect(effectiveModelParameters('deepseek', 'deepseek-v4-flash').maxTokens).toBe(-1)
    expect(effectiveModelParameters('openai', 'gpt-5.6-sol').maxTokens).toBe(-1)
    expect(effectiveModelParameters('openrouter', 'moonshotai/kimi-k3').maxTokens).toBe(-1)
    expect(effectiveModelParameters('kimi', 'kimi-k3', { maxTokens: 4000 }).maxTokens).toBe(4000)
  })
  it('uses fetched OpenRouter reasoning options for exact IDs, aliases and variants', () => {
    for (const model of ['deepseek/deepseek-v4-flash-0731', '~deepseek/deepseek-v4-flash-latest', 'deepseek/deepseek-v4-flash-0731:batch']) {
      setProviderModelMetadata('openrouter', { [model]: { maxOutputTokens: 943718, reasoning: { supportedEfforts: ['max', 'high', 'low'], defaultEffort: 'high' } } })
      expect(modelParameterProfile('openrouter', model).reasoning?.levels).toEqual(['low', 'high', 'max'])
      expect(effectiveModelParameters('openrouter', model).reasoningLevel).toBe('high')
      expect(validatedModelParameters('openrouter', model, { reasoningLevel: 'max' }).reasoningLevel).toBe('max')
      expect(() => validatedModelParameters('openrouter', model, { reasoningLevel: 'xhigh' })).toThrow('推理强度')
    }
  })
  it('respects mandatory reasoning, no reasoning, and gateway-wide effort metadata', () => {
    setProviderModelMetadata('openrouter', {
      'vendor/mandatory': { reasoning: { supportedEfforts: null, mandatory: true, defaultEffort: 'high' } },
      'openai/gpt-5.6-sol': { reasoning: null },
      'vendor/budget': { reasoning: { supportsBudget: true } }
    })
    expect(modelParameterProfile('openrouter', 'vendor/mandatory').reasoning?.levels).toEqual(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
    expect(modelParameterProfile('openrouter', 'openai/gpt-5.6-sol').reasoning).toBeUndefined()
    expect(modelParameterProfile('openrouter', 'vendor/budget').numeric.reasoningBudget).toMatchObject({ min: 1 })
  })
  it('uses medium reasoning for AI-assisted construction when the endpoint supports it', () => {
    expect(featureReasoningParameters('openai', 'gpt-5.6-sol')).toEqual({ reasoningLevel: 'medium' })
    expect(featureReasoningParameters('google', 'gemini-2.5-flash')).toEqual({})
    expect(featureReasoningParameters('kimi', 'kimi-k2.6')).toEqual({ reasoningLevel: 'enabled' })
    expect(featureReasoningParameters('custom:local', 'plain-model')).toEqual({})
    expect(featureReasoningParameters('openrouter', 'deepseek/deepseek-v4-flash-0731')).toEqual({ reasoningLevel: 'medium' })
    setProviderModelMetadata('openrouter', { 'vendor/no-reasoning': { reasoning: null } })
    expect(featureReasoningParameters('openrouter', 'vendor/no-reasoning')).toEqual({})
  })
  it('separates fetched default tokens from capacity and removes unsupported sampling', () => {
    setProviderModelMetadata('openrouter', { 'vendor/model': { maxOutputTokens: 100000, defaultMaxTokens: 16000, supportedParameters: ['max_tokens', 'reasoning'], reasoning: { supportedEfforts: ['high', 'low'] } } })
    expect(effectiveModelParameters('openrouter', 'vendor/model').maxTokens).toBe(16000)
    expect(validatedModelParameters('openrouter', 'vendor/model', { temperature: .5 })).not.toHaveProperty('temperature')
    setProviderModelMetadata('google', { 'gemini-3.7-flash': { maxOutputTokens: 65000, defaultMaxTokens: 65000 } })
    expect(effectiveModelParameters('google', 'gemini-3.7-flash').maxTokens).toBe(65000)
  })
})
