import { describe, expect, it } from 'vitest'
import { enabledProviderModels, providerModelChoices } from './provider-models'

describe('API provider model choices', () => {
  it('enables all discovered models for existing settings without toggles', () => {
    expect(enabledProviderModels({ custom: false, manualModels: ['ignored'], discoveredModels: ['a', 'b', 'a'] })).toEqual(['a', 'b'])
  })
  it('combines manual and discovered custom-provider models without duplicates', () => {
    expect(providerModelChoices({ custom: true, manualModels: ['manual', 'a'], discoveredModels: ['a', 'b'] })).toEqual(['manual', 'a', 'b'])
  })
  it('supports all disabled, newly discovered models and empty lists', () => {
    const provider = { custom: false, manualModels: [], discoveredModels: ['a'], disabledModels: ['a'] }
    expect(enabledProviderModels(provider)).toEqual([])
    expect(enabledProviderModels({ ...provider, discoveredModels: ['a', 'b'] })).toEqual(['b'])
    expect(enabledProviderModels({ ...provider, discoveredModels: [] })).toEqual([])
  })
})
