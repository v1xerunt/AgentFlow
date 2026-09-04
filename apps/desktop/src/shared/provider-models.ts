import type { ProviderConfiguration } from './llm'

type ProviderModels = Pick<ProviderConfiguration, 'custom' | 'manualModels' | 'discoveredModels' | 'disabledModels'>

export function providerModelChoices(provider: ProviderModels): string[] {
  return [...new Set([...(provider.custom ? provider.manualModels : []), ...provider.discoveredModels])]
}

export function enabledProviderModels(provider: ProviderModels): string[] {
  const disabled = new Set(provider.disabledModels ?? [])
  return providerModelChoices(provider).filter(model => !disabled.has(model))
}
