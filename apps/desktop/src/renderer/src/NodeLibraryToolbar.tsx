import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { useEffect, useRef, useState } from 'react'
import { Bot, Cpu, ChevronDown, ChevronRight, FilePlus2, GripVertical, Link2, Search, Star, Trash2, X } from 'lucide-react'
import type { ProviderModelOptions } from './llm-catalog'
import { ModelLogo } from './ModelLogo'
import { modelDisplayName } from '../../shared/model-display-name'
import { useAgentLibrary } from './AgentLibraryContext'
import { agentFavoriteKey, filterAndSortOptions, modelFavoriteKey, useSelectionFavorites } from './selection-favorites'

export const LIBRARY_DRAG_TYPE = 'application/x-agentflow-library'
export type NodeLibraryChoice = { kind: 'model'; provider: string; model: string } | { kind: 'agent'; id: string }
const collapsedProvidersKey = 'agentflow.node-library.collapsed-providers'

export function nodeLibraryModelEntries(groups: ProviderModelOptions[], query: string, favorites: readonly string[]) {
  return filterAndSortOptions(groups.flatMap((group) => group.connector !== 'model' && group.models.includes('@tool-default')
    ? [{ group, model: '@tool-default', value: '@tool-default', label: group.label, searchText: `${group.label} ${group.models.join(' ')}`, favoriteKey: modelFavoriteKey(group.provider, '@tool-default') }]
    : group.models.map((model) => ({ group, model, value: model, label: modelDisplayName(group.provider, model), searchText: group.label, favoriteKey: modelFavoriteKey(group.provider, model) }))), query, favorites)
}

export function NodeLibraryToolbar({ providers, open, onOpenChange, onAdd, onInput, disabled, guided = false }: {
  guided?: boolean; providers: ProviderModelOptions[]; open: boolean; onOpenChange: (value: boolean) => void
  onAdd: (choice: NodeLibraryChoice) => void; onInput: () => void; disabled: boolean
}) {
  const language = useLanguage()

  const { library, removeAgent, ready } = useAgentLibrary()
  const { favorites, toggleFavorite, saveFavorites } = useSelectionFavorites()
  const [favoriteError, setFavoriteError] = useState(false)
  const [tab, setTab] = useState<'models' | 'agents'>('models')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(window.localStorage.getItem(collapsedProvidersKey) ?? '[]') as string[]) }
    catch { return new Set() }
  })
  const root = useRef<HTMLDivElement>(null)
  const configured = providers.filter((provider) => provider.configured)
  const real = configured.filter((provider) => provider.provider !== 'fake')
  const groups = real.length ? real : configured
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) onOpenChange(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, onOpenChange])
  useEffect(() => window.localStorage.setItem(collapsedProvidersKey, JSON.stringify([...collapsedProviders])), [collapsedProviders])
  const drag = (event: React.DragEvent, choice: NodeLibraryChoice) => { event.dataTransfer.setData(LIBRARY_DRAG_TYPE, JSON.stringify(choice)); event.dataTransfer.effectAllowed = 'copy' }
  const select = (choice: NodeLibraryChoice) => { onAdd(choice); onOpenChange(false) }
  const models = nodeLibraryModelEntries(groups, query, favorites)
  const favoriteModels = models.filter((entry) => favorites.includes(entry.favoriteKey))
  const toolEntries = models.filter((entry) => entry.group.connector === 'agent-tool')
  const subscriptionEntries = models.filter((entry) => entry.group.connector === 'subscription')
  const modelGroups = groups.filter((group) => group.connector === 'model').map((group) => ({ group, entries: models.filter((entry) => entry.group.provider === group.provider) })).filter((item) => item.entries.length)
  const saved = filterAndSortOptions(library.agents.map((item) => ({ ...item, value: item.id, label: item.node.name, searchText: `${item.node.model} ${item.node.provider}`, favoriteKey: agentFavoriteKey(item.id) })), query, favorites)
  const favoriteButton = (key: string, name: string) => {
    const active = favorites.includes(key)
    return <button type="button" className={`menu-select__favorite ${active ? 'is-favorite' : ''}`} aria-label={`${active ? t("Remove favorite") : t("Favorite")} ${name}`} aria-pressed={active} title={active ? t("Remove favorite") : t("Favorite and pin")} onClick={(event) => { event.stopPropagation(); setFavoriteError(!toggleFavorite(key)) }}><Star size={16} fill={active ? 'currentColor' : 'none'} aria-hidden="true" /></button>
  }
  const modelRow = ({ group, model, favoriteKey }: (typeof models)[number]) => <div className="node-library-row" key={favoriteKey}>
    <button type="button" className="node-library-item" data-tutorial="model-choice" draggable={!disabled && !guided} disabled={disabled} onDragStart={(event) => drag(event, { kind: 'model', provider: group.provider, model })} onClick={() => select({ kind: 'model', provider: group.provider, model })}><ModelLogo providerId={group.provider} modelId={model} size={24} /><span><strong>{model === '@tool-default' ? t("Tool default model") : model}</strong><small>{group.label}</small></span><GripVertical size={14} /></button>
    {favoriteButton(favoriteKey, model)}
  </div>
  const toolRow = (entry: (typeof models)[number]) => <div className="node-library-row" key={entry.favoriteKey}>
    <button type="button" className="node-library-item" data-tutorial="model-choice" draggable={!disabled && !guided} disabled={disabled} onDragStart={(event) => drag(event, { kind: 'model', provider: entry.group.provider, model: entry.model })} onClick={() => select({ kind: 'model', provider: entry.group.provider, model: entry.model })}><ModelLogo providerId={entry.group.provider} modelId={entry.model} name={entry.group.label} size={24} /><span><strong>{entry.group.label}</strong><small>{entry.model === '@tool-default' ? t("Local Agent tool") : entry.model}</small></span><GripVertical size={14} /></button>
    {favoriteButton(entry.favoriteKey, entry.group.label)}
  </div>
  const subscriptionRow = (entry: (typeof models)[number]) => <div className="node-library-row" key={entry.favoriteKey}>
    <button type="button" className="node-library-item" data-tutorial="model-choice" draggable={!disabled && !guided} disabled={disabled} onDragStart={(event) => drag(event, { kind: 'model', provider: entry.group.provider, model: entry.model })} onClick={() => select({ kind: 'model', provider: entry.group.provider, model: entry.model })}><ModelLogo providerId={entry.group.provider} modelId={entry.model} name={entry.group.label} size={24} /><span><strong>{entry.label}</strong><small>{entry.model === '@tool-default' ? t("Subscription accounts") : entry.group.label}</small></span><GripVertical size={14} /></button>
    {favoriteButton(entry.favoriteKey, entry.model === '@tool-default' ? entry.group.label : `${entry.group.label} ${entry.label}`)}
  </div>
  return <div className="node-library" ref={root} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onOpenChange(false) } }}>
    <div className="node-library-toolbar" role="toolbar" aria-label={t("Add Flow element")}><button type="button" onClick={onInput} disabled={disabled}><FilePlus2 size={15} />{t("Input")}</button><span className="toolbar-divider" /><button type="button" data-tutorial="models" aria-expanded={open && tab === 'models'} disabled={disabled} onClick={() => { setTab('models'); onOpenChange(tab === 'models' ? !open : true) }}><Cpu size={15} />{t("Model")}<ChevronDown size={13} /></button><button type="button" aria-expanded={open && tab === 'agents'} disabled={disabled || !ready} onClick={() => { setTab('agents'); onOpenChange(tab === 'agents' ? !open : true) }}><Bot size={15} />{t("Agent library")}{library.agents.length ? <small>{library.agents.length}</small> : null}<ChevronDown size={13} /></button></div>
    {open ? <section className="node-library-panel" aria-label={tab === 'models' ? t("Configured model library") : t("Saved Agent library")}>
      <header><strong>{tab === 'models' ? t("Configured models") : t("Saved Agents")}</strong><button type="button" className="icon-button" aria-label={t("Close node library")} onClick={() => onOpenChange(false)}><X size={15} /></button></header>
      <label className="library-search"><Search size={15} /><input aria-label={tab === 'models' ? t("Search configured models") : t("Search saved Agents")} placeholder={tab === 'models' ? t("Search models") : t("Search Agents")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {!guided ? <p className="field-help">{t("Click to add, or drag to a position in the Flow.")}</p> : null}
      <div className="node-library-items">{tab === 'models' ? <>{favoriteModels.length ? <section className="node-library-group is-favorites"><div className="node-library-group__heading"><Star size={14} fill="currentColor" /><strong>{t("Favorite")}</strong><small>{favoriteModels.length}</small></div>{favoriteModels.map((entry) => entry.group.connector === 'agent-tool' ? toolRow(entry) : entry.group.connector === 'subscription' ? subscriptionRow(entry) : modelRow(entry))}</section> : null}{subscriptionEntries.length ? <section className="node-library-group"><div className="node-library-group__heading is-tools"><Link2 size={14} /><strong>{t("Subscription accounts")}</strong><small>{subscriptionEntries.length}</small></div>{subscriptionEntries.map(subscriptionRow)}</section> : null}{toolEntries.length ? <section className="node-library-group"><div className="node-library-group__heading is-tools"><Bot size={14} /><strong>{t("Local Agent tools")}</strong><small>{toolEntries.length}</small></div>{toolEntries.map(toolRow)}</section> : null}{modelGroups.map(({ group, entries }) => { const collapsed = !query.trim() && collapsedProviders.has(group.provider); return <section className="node-library-group" key={group.provider}><button className="node-library-group__toggle" type="button" aria-expanded={!collapsed} onClick={() => setCollapsedProviders((current) => { const next = new Set(current); if (next.has(group.provider)) next.delete(group.provider); else next.add(group.provider); return next })}>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}<ModelLogo providerId={group.provider} modelId={group.models[0]} name={group.label} size={18} /><strong>{group.label}</strong><small>{entries.length}</small></button>{collapsed ? null : entries.map(modelRow)}</section> })}</> : saved.map(({ id, node, favoriteKey }) => <div className="node-library-row" key={id}>
        <button type="button" className="node-library-item" data-tutorial="model-choice" draggable={!disabled && !guided} disabled={disabled} onDragStart={(event) => drag(event, { kind: 'agent', id })} onClick={() => select({ kind: 'agent', id })}><ModelLogo providerId={node.provider} modelId={node.model} size={24} /><span><strong>{node.name}</strong><small>{modelDisplayName(node.provider, node.model)} {t("· Prompts locked")}</small></span><GripVertical size={14} /></button>
        {favoriteButton(favoriteKey, node.name)}
        <button className="icon-button" type="button" aria-label={t("Delete saved {0}", [node.name])} disabled={disabled} onClick={() => void removeAgent(id).catch((e) => setError(String(e)))}><Trash2 size={14} /></button>
      </div>)}</div>
      {(tab === 'models' ? !models.length : !saved.length) ? <p className="library-empty">{query ? t("No matches.") : tab === 'models' ? t("Configured and enabled providers or local Agent tools appear here.") : t("Click “Save to Agent library” in the Agent sidebar to reuse it in other Flows.")}</p> : null}
      {favoriteError ? <p role="status" className="parameter-error">{t("Favorites could not be saved locally")} <button type="button" className="quiet-button" onClick={() => setFavoriteError(!saveFavorites())}>{t("Try again")}</button></p> : null}
      {error ? <p role="alert" className="parameter-error">{error}</p> : null}
    </section> : null}
  </div>
}
