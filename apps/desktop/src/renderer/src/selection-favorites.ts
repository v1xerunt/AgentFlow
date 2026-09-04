import { useSyncExternalStore } from 'react'

export const SELECTION_FAVORITES_KEY = 'agentflow.selection-favorites.v1'

export const providerFavoriteKey = (provider: string) => JSON.stringify(['provider', provider])
export const modelFavoriteKey = (provider: string, model: string) => JSON.stringify(['model', provider, model])
export const agentFavoriteKey = (id: string) => JSON.stringify(['agent', id])

export function parseFavorites(raw: string | null): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? [...new Set(parsed.filter((key): key is string => typeof key === 'string'))] : []
  } catch {
    return []
  }
}

export function createSelectionFavorites(storage: () => Pick<Storage, 'getItem' | 'setItem'> | undefined) {
  let favorites: readonly string[] = []
  const listeners = new Set<() => void>()
  const reload = () => {
    try {
      const next = parseFavorites(storage()?.getItem(SELECTION_FAVORITES_KEY) ?? null)
      if (JSON.stringify(next) === JSON.stringify(favorites)) return
      favorites = next
      listeners.forEach((listener) => listener())
    } catch {
      // Retain this window's preferences when local storage is unavailable.
    }
  }
  reload()
  const persist = () => {
    try {
      const target = storage()
      if (!target) return false
      target.setItem(SELECTION_FAVORITES_KEY, JSON.stringify(favorites))
      return true
    } catch {
      return false
    }
  }
  return {
    getSnapshot: () => favorites,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    reload,
    persist,
    toggle: (key: string) => {
      favorites = favorites.includes(key) ? favorites.filter((value) => value !== key) : [...favorites, key]
      const saved = persist()
      listeners.forEach((listener) => listener())
      return saved
    }
  }
}

const favoritesStore = createSelectionFavorites(() => typeof window === 'undefined' ? undefined : window.localStorage)
const subscribe = (listener: () => void) => {
  const unsubscribe = favoritesStore.subscribe(listener)
  const sync = (event: StorageEvent) => {
    if (event.key === SELECTION_FAVORITES_KEY || event.key === null) favoritesStore.reload()
  }
  window.addEventListener('storage', sync)
  return () => { unsubscribe(); window.removeEventListener('storage', sync) }
}

export function useSelectionFavorites() {
  const favorites = useSyncExternalStore(subscribe, favoritesStore.getSnapshot, favoritesStore.getSnapshot)
  return { favorites, toggleFavorite: favoritesStore.toggle, saveFavorites: favoritesStore.persist }
}

interface SearchableOption { value: string; label: string; searchText?: string; favoriteKey?: string }

export function filterAndSortOptions<T extends SearchableOption>(options: T[], query: string, favorites: readonly string[]): T[] {
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase()
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
  const favoriteSet = new Set(favorites)
  return options.filter((option) => {
    const text = normalize(`${option.label} ${option.value} ${option.searchText ?? ''}`)
    return terms.every((term) => text.includes(term))
  }).sort((a, b) => Number(favoriteSet.has(b.favoriteKey ?? '')) - Number(favoriteSet.has(a.favoriteKey ?? '')))
}
