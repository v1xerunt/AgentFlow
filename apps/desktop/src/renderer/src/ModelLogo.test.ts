import { describe, expect, it } from 'vitest'
import { modelLogoKey } from './ModelLogo'

describe('model logo resolution', () => {
  it('uses the actual model family behind OpenRouter and compatible providers', () => {
    expect(modelLogoKey('openrouter', 'anthropic/claude-sonnet-4')).toBe('claude')
    expect(modelLogoKey('openrouter', 'google/gemini-2.5-pro')).toBe('gemini')
    expect(modelLogoKey('custom:local', 'deepseek-r1')).toBe('deepseek')
    expect(modelLogoKey('custom:local', 'glm-4.5')).toBe('zai')
  })

  it('keeps provider and local coding-tool identities distinct', () => {
    expect(modelLogoKey('anthropic')).toBe('anthropic')
    expect(modelLogoKey('anthropic', 'claude-opus-4')).toBe('claude')
    expect(modelLogoKey('agent-tool:codex')).toBe('codex')
    expect(modelLogoKey('agent-tool:claude-code')).toBe('claude-code')
  })

  it('uses account brands for subscription connectors', () => {
    expect(modelLogoKey('subscription:codex')).toBe('openai')
    expect(modelLogoKey('subscription:claude-code')).toBe('claude')
    expect(modelLogoKey('subscription:deepseek-web')).toBe('deepseek')
  })
})
