import { describe, expect, it, vi } from 'vitest'
import { agentFavoriteKey, createSelectionFavorites, filterAndSortOptions, modelFavoriteKey, parseFavorites, providerFavoriteKey, SELECTION_FAVORITES_KEY } from './selection-favorites'
import { nodeLibraryModelEntries } from './NodeLibraryToolbar'
import { modelDisplayName } from '../../shared/model-display-name'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ModelSelect } from './ConnectionSelect'

describe('search and favorite ordering', () => {
  const options = [
    { value: 'gpt-4o', label: 'GPT-4o', searchText: 'OpenAI', favoriteKey: modelFavoriteKey('openai', 'gpt-4o') },
    { value: 'deepseek-chat', label: 'deepseek-chat', searchText: 'DeepSeek 深度求索', favoriteKey: modelFavoriteKey('deepseek', 'deepseek-chat') },
    { value: 'deepseek-reasoner', label: 'deepseek-reasoner', searchText: 'DeepSeek 深度求索', favoriteKey: modelFavoriteKey('deepseek', 'deepseek-reasoner') }
  ]

  it('matches names, IDs and provider names with case-insensitive, multi-term search', () => {
    expect(filterAndSortOptions(options, '  DEEPSEEK CHAT ', []).map((option) => option.value)).toEqual(['deepseek-chat'])
    expect(filterAndSortOptions(options, 'ＯＰＥＮＡＩ', []).map((option) => option.value)).toEqual(['gpt-4o'])
    expect(filterAndSortOptions(options, '深度求索', [])).toHaveLength(2)
    expect(filterAndSortOptions(options, 'not-found', [])).toEqual([])
  })

  it('pins favorites while preserving order within each group, including filtered results', () => {
    const favorites = [options[2]!.favoriteKey]
    expect(filterAndSortOptions(options, '', favorites)).toEqual([options[2], options[0], options[1]])
    expect(filterAndSortOptions(options, 'deepseek', favorites)).toEqual([options[2], options[1]])
    expect(filterAndSortOptions(options, '', [])).toEqual(options)
    expect(options[0]!.value).toBe('gpt-4o')
  })

  it('keeps identical models under separate providers and handles delimiter-like IDs', () => {
    expect(modelFavoriteKey('one', 'gpt-4o')).not.toBe(modelFavoriteKey('two', 'gpt-4o'))
    expect(modelFavoriteKey('one:two', 'three')).not.toBe(modelFavoriteKey('one', 'two:three'))
    expect(providerFavoriteKey('openai')).not.toBe(modelFavoriteKey('openai', ''))
  })

  it('handles large catalogs and retains the original option objects', () => {
    const catalog = Array.from({ length: 1500 }, (_, i) => ({ value: `fixture-${i}`, label: `Fixture ${i}`, favoriteKey: `fixture-${i}` }))
    const result = filterAndSortOptions(catalog, '', ['fixture-1499'])
    expect(result).toHaveLength(1500)
    expect(result[0]).toBe(catalog[1499])
    expect(result[1]).toBe(catalog[0])
  })
  it('shares model favorites with the node library and namespaces saved agents', () => {
    const model = { value: 'model', label: 'Model', favoriteKey: modelFavoriteKey('provider', 'model') }
    const saved = { value: 'saved', label: 'Saved Agent', favoriteKey: agentFavoriteKey('saved') }
    expect(filterAndSortOptions([model, saved], '', [saved.favoriteKey])[0]).toBe(saved)
    expect(filterAndSortOptions([saved, model], '', [model.favoriteKey])[0]).toBe(model)
    expect(agentFavoriteKey('saved')).not.toBe(providerFavoriteKey('saved'))
  })

  it('shows each local Agent tool once while retaining normal provider models', () => {
    const groups = [
      { provider: 'agent-tool:codex', label: 'Codex', configured: true, connector: 'agent-tool' as const, models: ['@tool-default', 'gpt-5.6-sol', 'gpt-5.6-terra'] },
      { provider: 'openai', label: 'OpenAI', configured: true, connector: 'model' as const, models: ['gpt-5.6-sol', 'gpt-5.6-luna'] }
    ]
    const entries = nodeLibraryModelEntries(groups, '', [])
    expect(entries.map((entry) => [entry.group.provider, entry.model])).toEqual([
      ['agent-tool:codex', '@tool-default'],
      ['openai', 'gpt-5.6-sol'],
      ['openai', 'gpt-5.6-luna']
    ])
    expect(nodeLibraryModelEntries(groups, 'gpt-5.6-terra', [])).toEqual([entries[0]])
  })

  it('preserves concrete subscription models alongside runtime defaults', () => {
    const groups = [
      { provider: 'subscription:codex', label: 'ChatGPT', configured: true, connector: 'subscription' as const, models: ['@tool-default', 'gpt-5.6-sol'] },
      { provider: 'subscription:deepseek-web', label: 'DeepSeek（Web Bridge）', configured: true, connector: 'subscription' as const, models: ['deepseek-chat', 'deepseek-reasoner'] }
    ]
    const entries = nodeLibraryModelEntries(groups, '', [])
    expect(entries.map((entry) => [entry.group.provider, entry.model])).toEqual([
      ['subscription:codex', '@tool-default'],
      ['subscription:deepseek-web', 'deepseek-chat'],
      ['subscription:deepseek-web', 'deepseek-reasoner']
    ])
    expect(entries.every((entry) => entry.group.models.includes(entry.model))).toBe(true)
    expect(nodeLibraryModelEntries(groups, 'gpt-5.6-sol', [])).toEqual([entries[0]])
  })

  it('searches and favorites individual Web Bridge models with their real IDs', () => {
    const groups = [{ provider: 'subscription:deepseek-web', label: 'DeepSeek（Web Bridge）', configured: true, connector: 'subscription' as const, models: ['deepseek-chat', 'deepseek-reasoner'] }]
    const favorites = [modelFavoriteKey('subscription:deepseek-web', 'deepseek-reasoner')]
    expect(nodeLibraryModelEntries(groups, '', favorites).map((entry) => entry.model)).toEqual(['deepseek-reasoner', 'deepseek-chat'])
    const matches = nodeLibraryModelEntries(groups, 'bridge reasoner', favorites)
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ model: 'deepseek-reasoner', value: 'deepseek-reasoner', favoriteKey: favorites[0] })
  })

  it('does not invent a default model for empty connector catalogs', () => {
    expect(nodeLibraryModelEntries([
      { provider: 'subscription:deepseek-web', label: 'DeepSeek', configured: true, connector: 'subscription', models: [] },
      { provider: 'agent-tool:codex', label: 'Codex', configured: true, connector: 'agent-tool', models: [] }
    ], '', [])).toEqual([])
  })

  it('uses official Web mode names while preserving provider IDs and search aliases', () => {
    const groups = [{ provider: 'subscription:deepseek-web', label: 'DeepSeek（Web Bridge）', configured: true, connector: 'subscription' as const, models: ['deepseek-chat', 'deepseek-reasoner'] }]
    expect(nodeLibraryModelEntries(groups, '', []).map(entry => entry.label)).toEqual(['快速模式', '专家模式'])
    expect(nodeLibraryModelEntries(groups, '专家', [])[0]?.model).toBe('deepseek-reasoner')
    expect(nodeLibraryModelEntries(groups, 'chat', [])[0]?.label).toBe('快速模式')
    expect(modelDisplayName('deepseek', 'deepseek-chat')).toBe('deepseek-chat')
    expect(modelDisplayName('custom:test', 'deepseek-reasoner', 'Custom name')).toBe('Custom name')
  })

  it('renders official names in shared model selectors, including saved model selections', () => {
    for (const [model, label] of [['deepseek-chat', '快速模式'], ['deepseek-reasoner', '专家模式']]) {
      const markup = renderToStaticMarkup(createElement(ModelSelect, { providerId: 'subscription:deepseek-web', ariaLabel: 'Model', value: model, options: [{ value: model!, label: model! }], onChange: () => {} }))
      expect(markup).toContain(label)
      expect(markup).not.toContain(model)
    }
  })
})

describe('favorite persistence', () => {
  const memoryStorage = () => {
    const values = new Map<string, string>()
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  }

  it('automatically saves additions and removals and restores them on reload', () => {
    const storage = memoryStorage()
    const store = createSelectionFavorites(() => storage)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const key = modelFavoriteKey('openai', 'gpt-4o')
    expect(store.toggle(key)).toBe(true)
    expect(createSelectionFavorites(() => storage).getSnapshot()).toEqual([key])
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.toggle(key)).toBe(true)
    expect(createSelectionFavorites(() => storage).getSnapshot()).toEqual([])
    unsubscribe()
    store.toggle(key)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('refreshes external changes without notifying for unchanged snapshots', () => {
    const storage = memoryStorage()
    const store = createSelectionFavorites(() => storage)
    const listener = vi.fn()
    store.subscribe(listener)
    storage.setItem(SELECTION_FAVORITES_KEY, JSON.stringify([providerFavoriteKey('deepseek')]))
    store.reload()
    expect(store.getSnapshot()).toEqual([providerFavoriteKey('deepseek')])
    store.reload()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('recovers malformed preferences and deduplicates keys', () => {
    expect(parseFavorites('not-json')).toEqual([])
    expect(parseFavorites('{"unexpected":true}')).toEqual([])
    expect(parseFavorites('["a",1,null,"a","b"]')).toEqual(['a', 'b'])
  })

  it('retains usable session preferences on storage failure and supports retry', () => {
    const storage = memoryStorage()
    let blocked = true
    const store = createSelectionFavorites(() => {
      if (blocked) throw new Error('Storage unavailable')
      return storage
    })
    expect(store.toggle('favorite')).toBe(false)
    expect(store.getSnapshot()).toEqual(['favorite'])
    blocked = false
    expect(store.persist()).toBe(true)
    expect(createSelectionFavorites(() => storage).getSnapshot()).toEqual(['favorite'])
  })
})
