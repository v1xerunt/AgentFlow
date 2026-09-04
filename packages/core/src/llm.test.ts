import { describe, expect, it } from 'vitest'
import { parameterSupportFor, sanitizeModelParameters } from './llm'

describe('LLM model capabilities', () => {
  it('filters unsupported sampling parameters for reasoning OpenAI models', () => {
    expect(sanitizeModelParameters('OpenAI', 'gpt-5.6-sol', {
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 4096,
      reasoningLevel: 'high'
    })).toEqual({ maxTokens: 4096, reasoningLevel: 'high', verbosity: 'medium' })
  })

  it('uses maintained Claude controls and generic controls for older models', () => {
    expect(parameterSupportFor('Anthropic', 'claude-opus-5').temperature).toBe(false)
    expect(parameterSupportFor('Anthropic', 'claude-haiku-4-5')).toMatchObject({ temperature: false, maxTokens: true, reasoning: false })
  })

})
