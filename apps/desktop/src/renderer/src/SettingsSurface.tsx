import { reasoningLabel } from '@agentflow/core/localization'
import { localizeLabel, localizeAppMessage } from '@agentflow/core/localization'
import { t, getLocale } from '@agentflow/core/localization'
import {
  ArrowLeft,
  Bot,
  Check,
  CircleCheck,
  CircleX,
  ChevronDown,
  Copy,
  Download,
  KeyRound,
  Link2,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
  Workflow
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AgentParameters } from '@agentflow/schema'
import type {
  AgentToolConfiguration,
  FeatureModelSettings,
  LlmSettingsInput,
  LlmSettingsSnapshot,
  PromptAutofillSettings,
  ProviderConfiguration,
  RuntimeLoginProgress,
  SubscriptionConnectorConfiguration,
  SubscriptionConnectorId,
  SubscriptionConnectorProgress
} from '../../shared/llm'
import { MAX_CHAT_HISTORY_MAX_CHARS, MIN_CHAT_HISTORY_MAX_CHARS } from '../../shared/llm'
import { ModelSelect, ProviderSelect } from './ConnectionSelect'
import { ModelLogo } from './ModelLogo'
import { ModelParametersEditor } from './ModelParametersEditor'
import { agentToolModelChoices, enabledAgentToolModels } from '../../shared/agent-tool-models'
import { enabledProviderModels, providerModelChoices } from '../../shared/provider-models'
import { RuntimeLoginDialog } from './RuntimeLoginDialog'
import { saveLanguagePreference, useLanguage } from './language'
import { UpdateSettings } from './UpdateSettings'
import { detectLanguage, type LanguagePreference } from '@agentflow/core/localization'

interface Props {
  initialPage?: SettingsPageId
  tutorialCompleted?: boolean
  settings: LlmSettingsSnapshot
  onChange: (settings: LlmSettingsSnapshot) => void
  onClose: () => void
}

interface ProviderDraft extends ProviderConfiguration { apiKey: string; clearApiKey: boolean }
interface ProviderTestFeedback { tone: 'testing' | 'success' | 'error'; text: string }

type SettingsPageId = 'general' | 'updates' | 'ai' | 'model-defaults' | 'subscriptions' | 'providers' | 'tools' | 'chat'

interface SettingsNavigationItem {
  id: SettingsPageId
  label: string
  description: string
  icon: LucideIcon
  keywords: string
}

interface SettingsNavigationSection { label: string; items: SettingsNavigationItem[] }

const navigationSections: SettingsNavigationSection[] = [
  {
    get label() { return t('General') },
    items: [
      { id: 'general', get label() { return t('Language') }, get description() { return t('Display language') }, icon: SlidersHorizontal, keywords: 'language locale 中文 English 系统 语言' },
      { id: 'updates', get label() { return t('App updates') }, get description() { return t('Version checks and automatic updates') }, icon: Download, keywords: 'update version download release 更新 升级 版本 下载' }
    ]
  },
  {
    get label() { return t("Connections") },
    items: [
      { id: 'providers', get label() { return t("API Provider") }, get description() { return t("Credentials, endpoints, and available models") }, icon: KeyRound, keywords: 'api key base url openai anthropic gemini deepseek zai kimi openrouter 自定义 兼容' },
      { id: 'tools', get label() { return t("Local Agent tools") }, get description() { return t("Commands, models, and runtime capabilities") }, icon: Bot, keywords: 'codex claude code deepseek harness kimi command cli 本地' },
      { id: 'subscriptions', get label() { return t("Subscription accounts") }, get description() { return t("Sign in to AI accounts and subscriptions") }, icon: Link2, keywords: '订阅 登录 chatgpt codex claude kimi gemini antigravity deepseek web bridge oauth 账户' }
    ]
  },
  {
    get label() { return t("Features") },
    items: [
      { id: 'ai', get label() { return t("AI-assisted building") }, get description() { return t("Models for prompt and Flow generation") }, icon: Sparkles, keywords: '自动填写 prompt 从描述生成 flow 上下文' },
      { id: 'chat', get label() { return t("Chat") }, get description() { return t("Conversation history and request context") }, icon: MessageSquareText, keywords: '聊天 历史 字符 上限 context' }
    ]
  },
  {
    get label() { return t("Model") },
    items: [
      { id: 'model-defaults', get label() { return t("Model defaults") }, get description() { return t("Reasoning and sampling for new Agents") }, icon: SlidersHorizontal, keywords: 'temperature top-p max tokens reasoning effort verbosity 预设' }
    ]
  }
]

const navigation = navigationSections.flatMap((section) => section.items)

export function SettingsSurface({ settings, onChange, onClose, initialPage = 'general', tutorialCompleted = false }: Props) {
  const language = useLanguage()
  const [languageError, setLanguageError] = useState(false)
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [query, setQuery] = useState('')
  const [activePageId, setActivePageId] = useState<SettingsPageId>(initialPage)
  const [providers, setProviders] = useState<ProviderDraft[]>(() => settings.providers.map(toDraft))
  const [tools, setTools] = useState<AgentToolConfiguration[]>(settings.agentTools)
  const [subscriptions, setSubscriptions] = useState<SubscriptionConnectorConfiguration[]>(settings.subscriptions)
  const [promptAutofill, setPromptAutofill] = useState<PromptAutofillSettings>(settings.promptAutofill)
  const [flowGeneration, setFlowGeneration] = useState<FeatureModelSettings>(settings.flowGeneration)
  const [chatHistoryMaxChars, setChatHistoryMaxChars] = useState(settings.chatHistoryMaxChars)
  const [defaultModel, setDefaultModel] = useState<FeatureModelSettings>({ providerId: '', model: '' })
  const [defaultParameters, setDefaultParameters] = useState<AgentParameters>({})
  const [expandedProvider, setExpandedProvider] = useState<string | null>(() => settings.providers.find((provider) => provider.added && provider.hasApiKey)?.id ?? settings.providers.find((provider) => provider.added)?.id ?? null)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<SubscriptionConnectorId | null>(null)
  const [pendingExperimentalConnector, setPendingExperimentalConnector] = useState<SubscriptionConnectorId | null>(null)
  const [subscriptionProgress, setSubscriptionProgress] = useState<SubscriptionConnectorProgress | null>(null)
  const [runtimeLogin, setRuntimeLogin] = useState<RuntimeLoginProgress | null>(null)
  const [loggingInTool, setLoggingInTool] = useState(false)
  const activeRuntimeLogin = useRef<string | null>(null)
  const [testFeedback, setTestFeedback] = useState<Record<string, ProviderTestFeedback>>({})
  const [autoSaveRevision, setAutoSaveRevision] = useState(0)
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const editRevision = useRef(0)
  const savedRevision = useRef(0)
  const pendingModelRefreshIds = useRef(new Map<string, number>())
  const subscriptionRefreshStarted = useRef(false)

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy && !pendingExperimentalConnector && !runtimeLogin && !loggingInTool && !connecting) onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [busy, onClose, pendingExperimentalConnector, runtimeLogin, loggingInTool, connecting])

  useEffect(() => window.agentflowDesktop?.onSubscriptionConnectorProgress((progress) => {
    setSubscriptionProgress(progress)
    if (progress.phase === 'error') setMessage({ text: progress.message, error: true })
  }), [])

  useEffect(() => {
    const unsubscribe = window.agentflowDesktop?.onRuntimeLoginProgress(progress => {
      activeRuntimeLogin.current = ['connected', 'cancelled', 'error'].includes(progress.phase) ? null : progress.requestId
      setRuntimeLogin(progress)
    })
    return () => {
      unsubscribe?.()
      if (activeRuntimeLogin.current) void window.agentflowDesktop?.cancelRuntimeLogin(activeRuntimeLogin.current).catch(() => {})
    }
  }, [])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const staticPageMatchesQuery = (id: SettingsPageId) => {
    const item = navigation.find((candidate) => candidate.id === id)!
    return !normalizedQuery || `${item.label} ${item.description} ${item.keywords}`.toLocaleLowerCase().includes(normalizedQuery)
  }
  const providerPageMatchesQuery = staticPageMatchesQuery('providers')
  const toolPageMatchesQuery = staticPageMatchesQuery('tools')
  const visibleProviders = useMemo(() => providerPageMatchesQuery
    ? providers
    : providers.filter((provider) => [provider.name, provider.id, provider.protocol, provider.baseUrl].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))), [normalizedQuery, providerPageMatchesQuery, providers, language])
  const visibleTools = useMemo(() => toolPageMatchesQuery
    ? tools
    : tools.filter((tool) => [tool.name, tool.command].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))), [normalizedQuery, toolPageMatchesQuery, tools, language])
  const visibleSubscriptions = useMemo(() => staticPageMatchesQuery('subscriptions')
    ? subscriptions
    : subscriptions.filter((connector) => [connector.name, connector.accountName, connector.description, connector.quotaDescription].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))), [normalizedQuery, subscriptions, language])
  const builtInProviders = visibleProviders.filter((provider) => !provider.custom && provider.added)
  const customProviders = visibleProviders.filter((provider) => provider.custom)
  const availableBuiltInProviders = providers.filter((provider) => !provider.custom && !provider.added)
  const addedTools = visibleTools.filter((tool) => tool.added)
  const availableAgentTools = tools.filter((tool) => tool.installed && !tool.added)
  const featureProviders = [...providers.filter((provider) => {
    const models = enabledProviderModels(provider)
    const hasCredential = provider.custom || provider.hasApiKey || Boolean(provider.apiKey.trim())
    return provider.added && provider.enabled && hasCredential && models.length > 0
  }).map((provider) => ({
    id: provider.id,
    name: provider.name,
    models: enabledProviderModels(provider)
  })), ...tools.filter((tool) => tool.added && tool.enabled && tool.installed).map((tool) => ({
    id: tool.id,
    name: tool.name,
    models: enabledAgentToolModels(tool)
  })).filter(tool => tool.models.length), ...subscriptions.filter((connector) => connector.connected).map((connector) => ({
    id: connector.id,
    name: localizeLabel(connector.name),
    models: connector.models
  }))]
  const selectedAutofillProvider = featureProviders.find((provider) => provider.id === promptAutofill.providerId)
  const selectedFlowGenerationProvider = featureProviders.find((provider) => provider.id === flowGeneration.providerId)
  const selectedDefaultProvider = featureProviders.find((provider) => provider.id === defaultModel.providerId)
  const pageSearchText = (id: SettingsPageId) => {
    const item = navigation.find((candidate) => candidate.id === id)!
    const dynamic = id === 'providers'
      ? providers.flatMap((provider) => [provider.name, provider.id, provider.protocol, provider.baseUrl]).join(' ')
      : id === 'tools' ? tools.flatMap((tool) => [tool.name, tool.command, ...tool.models]).join(' ')
        : id === 'subscriptions' ? subscriptions.flatMap((connector) => [connector.name, connector.accountName, connector.description]).join(' ') : ''
    return `${item.label} ${item.description} ${item.keywords} ${dynamic}`.toLocaleLowerCase()
  }
  const matchingPageIds = navigation.filter((item) => !normalizedQuery || pageSearchText(item.id).includes(normalizedQuery)).map((item) => item.id)
  const hasSearchResults = matchingPageIds.length > 0
  const desktopRuntimeAvailable = Boolean(window.agentflowDesktop)
  const runtimeUnavailableMessage = /\bElectron\//.test(navigator.userAgent)
    ? t("Desktop service disconnected. Quit AgentFlow completely and restart it.")
    : t("This is the web preview. Use the AgentFlow desktop window to save credentials, test connections, and detect local tools.")

  useEffect(() => {
    if (activePageId !== 'subscriptions' || subscriptionRefreshStarted.current || !window.agentflowDesktop) return
    subscriptionRefreshStarted.current = true
    void window.agentflowDesktop.refreshSubscriptionConnectors().then((next) => {
      setSubscriptions(next.subscriptions)
      setProviders(next.providers.map(toDraft))
      setTools(next.agentTools)
      onChange(next)
    }).catch((error) => setMessage({ text: error instanceof Error ? error.message : t("Could not refresh subscription account status"), error: true }))
  }, [activePageId, onChange])

  useEffect(() => {
    if (!normalizedQuery || matchingPageIds.includes(activePageId)) return
    const first = matchingPageIds[0]
    if (first) setActivePageId(first)
  }, [normalizedQuery, matchingPageIds.join('|'), activePageId])

  useEffect(() => {
    const provider = featureProviders.find((candidate) => candidate.id === defaultModel.providerId)
    if (provider?.models.includes(defaultModel.model)) return
    const firstProvider = featureProviders[0]
    setDefaultModel(firstProvider ? { providerId: firstProvider.id, model: firstProvider.models[0] ?? '' } : { providerId: '', model: '' })
    setDefaultParameters({})
  }, [featureProviders.map((provider) => `${provider.id}:${provider.models.join(',')}`).join('|'), defaultModel.providerId, defaultModel.model])

  const markDirty = () => {
    editRevision.current += 1
    setAutoSaveRevision(editRevision.current)
    setAutoSaveState('idle')
    return editRevision.current
  }

  const updateProvider = (id: string, patch: Partial<ProviderDraft>) => {
    const target = providers.find((provider) => provider.id === id)
    const revision = markDirty()
    if ((patch.apiKey?.trim() || patch.anthropicWorkspaceId !== undefined) && target && !target.custom) pendingModelRefreshIds.current.set(id, revision)
    if (patch.apiKey !== undefined || patch.anthropicWorkspaceId !== undefined) {
      setTestFeedback((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
    }
    setProviders((current) => current.map((provider) => provider.id === id ? { ...provider, ...patch } : provider))
  }

  const updateTool = (id: string, patch: Partial<AgentToolConfiguration>) => {
    setTools((current) => current.map((tool) => {
      if (tool.id !== id) return tool
      if (patch.command !== undefined && patch.command !== tool.command) {
        return { ...tool, ...patch, enabled: false, installed: false, reasoningOverrideSupported: false }
      }
      return { ...tool, ...patch }
    }))
    markDirty()
  }

  const buildInput = (): LlmSettingsInput => ({
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
      anthropicWorkspaceId: provider.anthropicWorkspaceId ?? '',
      added: provider.added,
      enabled: provider.enabled,
      custom: provider.custom,
      apiKey: provider.apiKey || undefined,
      clearApiKey: provider.clearApiKey,
      manualModels: provider.manualModels,
      disabledModels: provider.disabledModels ?? []
    })),
    agentTools: tools.map((tool) => ({
      id: tool.id,
      added: tool.added,
      enabled: tool.enabled,
      command: tool.command,
      model: tool.model,
      models: tool.models,
      disabledModels: tool.disabledModels ?? [],
      reasoningEfforts: tool.reasoningEfforts,
      modelReasoningEfforts: tool.modelReasoningEfforts
    })),
    promptAutofill,
    flowGeneration,
    chatHistoryMaxChars
  })

  const adoptSnapshot = (next: LlmSettingsSnapshot) => {
    setProviders(next.providers.map(toDraft))
    setTools(next.agentTools)
    setSubscriptions(next.subscriptions)
    setPromptAutofill(next.promptAutofill)
    setFlowGeneration(next.flowGeneration)
    setChatHistoryMaxChars(next.chatHistoryMaxChars)
    onChange(next)
  }

  const updatePromptAutofill = (next: PromptAutofillSettings) => {
    setPromptAutofill(next)
    markDirty()
  }

  const updateFlowGeneration = (next: FeatureModelSettings) => {
    setFlowGeneration(next)
    markDirty()
  }

  const updateChatHistoryMaxChars = (next: number) => {
    setChatHistoryMaxChars(next)
    markDirty()
  }

  const persist = async (adopt = true) => {
    if (!window.agentflowDesktop) {
      setMessage({ text: runtimeUnavailableMessage, error: true })
      return null
    }
    try {
      const next = await window.agentflowDesktop.saveLlmSettings(buildInput())
      if (adopt) adoptSnapshot(next)
      return next
    } catch (error) {
      setMessage({ text: providerFeedbackMessage(error, t("Could not save settings")), error: true })
      return null
    }
  }

  useEffect(() => {
    if (!window.agentflowDesktop || autoSaveRevision <= savedRevision.current) return
    const revision = autoSaveRevision
    const timer = window.setTimeout(() => {
      void (async () => {
        setAutoSaveState('saving')
        const saved = await persist(false)
        if (!saved) { setAutoSaveState('error'); return }
        let latest = saved
        const refreshIds = [...pendingModelRefreshIds.current.entries()].filter(([, changedAt]) => changedAt <= revision).map(([id]) => id)
        refreshIds.forEach((id) => {
          if ((pendingModelRefreshIds.current.get(id) ?? Number.POSITIVE_INFINITY) <= revision) pendingModelRefreshIds.current.delete(id)
        })
        for (const id of refreshIds) {
          try {
            latest = await window.agentflowDesktop!.refreshProviderModels(id)
            const provider = latest.providers.find((candidate) => candidate.id === id)
            setTestFeedback((current) => ({ ...current, [id]: { tone: 'success', text: t("Settings saved; synchronized {0} models.", [provider?.discoveredModels.length ?? 0]) } }))
          } catch (error) {
            const detail = providerFeedbackMessage(error, t("Could not read models"))
            setTestFeedback((current) => ({ ...current, [id]: { tone: 'error', text: t("Settings saved; model synchronization failed: {0}", [error instanceof Error ? error.message : String(error)]) } }))
          }
        }
        savedRevision.current = Math.max(savedRevision.current, revision)
        if (editRevision.current === revision) adoptSnapshot(latest)
        setAutoSaveState('saved')
      })()
    }, 650)
    return () => window.clearTimeout(timer)
  }, [autoSaveRevision])

  const testConnection = async (id: string) => {
    if (!window.agentflowDesktop) {
      setTestFeedback((current) => ({ ...current, [id]: { tone: 'error', text: runtimeUnavailableMessage } }))
      setMessage({ text: runtimeUnavailableMessage, error: true })
      return
    }
    setTesting(id)
    setTestFeedback((current) => ({ ...current, [id]: { tone: 'testing', text: t("Verifying credentials and reading models…") } }))
    setMessage(null)
    try {
      const saved = await persist()
      if (!saved) {
        setTestFeedback((current) => ({ ...current, [id]: { tone: 'error', text: t("Could not save the configuration for testing.") } }))
        return
      }
      const next = await window.agentflowDesktop.testProvider(id)
      adoptSnapshot(next)
      const provider = next.providers.find((candidate) => candidate.id === id)
      const count = provider?.discoveredModels.length ?? 0
      const text = t("Connected; synchronized {0} models.", [count])
      setTestFeedback((current) => ({ ...current, [id]: { tone: 'success', text } }))
      setMessage({ text: `${provider?.name ?? 'Provider'} ${text}` })
    } catch (error) {
      const text = providerFeedbackMessage(error, t("Provider connection test failed"))
      setTestFeedback((current) => ({ ...current, [id]: { tone: 'error', text } }))
      setMessage({ text, error: true })
    } finally {
      setTesting(null)
    }
  }

  const detectTools = async () => {
    if (!window.agentflowDesktop) return
    setBusy(true)
    setMessage(null)
    try {
      const saved = await persist()
      if (!saved) return
      const next = await window.agentflowDesktop.detectAgentTools()
      adoptSnapshot(next)
      setMessage({ text: t("Detected {0} local Agent tools.", [next.agentTools.filter(tool => tool.installed).length]) })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : t("Tool detection failed"), error: true })
    } finally {
      setBusy(false)
    }
  }

  const refreshSubscriptions = async () => {
    if (!window.agentflowDesktop) return
    setBusy(true)
    setMessage(null)
    try {
      const next = await window.agentflowDesktop.refreshSubscriptionConnectors()
      adoptSnapshot(next)
      setMessage({ text: t("Refreshed {0} subscription connectors.", [next.subscriptions.length]) })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : t("Could not refresh subscription account status"), error: true })
    } finally { setBusy(false) }
  }

  const connectSubscription = async (connectorId: SubscriptionConnectorId, acceptExperimentalRisk = false) => {
    if (!window.agentflowDesktop) { setMessage({ text: runtimeUnavailableMessage, error: true }); return }
    const connector = subscriptions.find((candidate) => candidate.id === connectorId)
    if (connector?.experimental && !connector.riskAccepted && !acceptExperimentalRisk) { setPendingExperimentalConnector(connectorId); return }
    setPendingExperimentalConnector(null)
    setConnecting(connectorId)
    setSubscriptionProgress({ connectorId, phase: 'preparing', message: t("Preparing connection…") })
    setMessage(null)
    try {
      const next = await window.agentflowDesktop.connectSubscriptionConnector(connectorId, { acceptExperimentalRisk })
      adoptSnapshot(next)
      const connector = next.subscriptions.find((candidate) => candidate.id === connectorId)
      setMessage({ text: t("{0} connected.", [connector?.name ?? t("Subscription accounts")]) })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : t("Subscription account connection failed"), error: true })
      try {
        const next = await window.agentflowDesktop.refreshSubscriptionConnectors()
        adoptSnapshot(next)
      } catch { /* Keep the original connection error visible. */ }
    } finally { setConnecting(null) }
  }

  const loginLocalAntigravity = async () => {
    if (!window.agentflowDesktop || loggingInTool) return
    setLoggingInTool(true)
    setMessage(null)
    try {
      if (!await persist(false)) return
      await window.agentflowDesktop.loginAgentTool('agent-tool:antigravity')
      setMessage({ text: t("Google account connected. You can return to your Agent.") })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : t("Google login failed"), error: true })
    } finally { setLoggingInTool(false) }
  }

  const disconnectSubscription = async (connectorId: SubscriptionConnectorId) => {
    if (!window.agentflowDesktop) return
    setConnecting(connectorId)
    setMessage(null)
    try {
      const next = await window.agentflowDesktop.disconnectSubscriptionConnector(connectorId)
      adoptSnapshot(next)
      setMessage({ text: t("Subscription account disconnected.") })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : t("Could not disconnect subscription account"), error: true })
    } finally { setConnecting(null) }
  }

  const addCustom = () => {
    const id = `custom:${Date.now().toString(36)}`
    setProviders((current) => [...current, {
      id,
      name: t("Custom provider"),
      protocol: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
      added: true,
      enabled: true,
      custom: true,
      hasApiKey: false,
      manualModels: [],
      discoveredModels: [],
      apiKey: '',
      clearApiKey: false
    }])
    setExpandedProvider(id)
    markDirty()
  }

  const addBuiltIn = (id: string) => {
    if (!id) return
    updateProvider(id, { added: true, enabled: true })
    setExpandedProvider(id)
  }

  const removeBuiltIn = (id: string) => {
    updateProvider(id, { added: false, enabled: false })
    if (promptAutofill.providerId === id) setPromptAutofill({ providerId: '', model: '' })
    if (flowGeneration.providerId === id) setFlowGeneration({ providerId: '', model: '' })
    setExpandedProvider((current) => current === id ? null : current)
  }

  const addAgentTool = (id: string) => {
    if (!id) return
    updateTool(id, { added: true, enabled: false })
    setExpandedTool(id)
  }

  const removeAgentTool = (id: string) => {
    updateTool(id, { added: false, enabled: false })
    if (promptAutofill.providerId === id) setPromptAutofill({ providerId: '', model: '' })
    if (flowGeneration.providerId === id) setFlowGeneration({ providerId: '', model: '' })
    setExpandedTool((current) => current === id ? null : current)
  }

  const activeNavigation = navigation.find((item) => item.id === activePageId) ?? navigation[0]!

  return <div className="settings-surface" aria-labelledby="settings-surface-title">
    <aside className="settings-sidebar" aria-label={t("Settings navigation")}>
      <button className="settings-back" type="button" onClick={onClose} disabled={loggingInTool || Boolean(connecting)}><ArrowLeft size={16} />{t("Back to AgentFlow")}</button>
      <label className="settings-search">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">{t("Search settings")}</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search settings…")} />
      </label>
      <nav className="settings-navigation">
        {navigationSections.map((section) => {
          const items = section.items.filter((item) => !normalizedQuery || matchingPageIds.includes(item.id))
          if (!items.length) return null
          return <div className="settings-navigation-section" key={section.label}>
            <span>{section.label}</span>
            {items.map((item) => {
              const Icon = item.icon
              const active = item.id === activePageId
              return <button key={item.id} type="button" className={active ? 'is-active' : undefined} aria-current={active ? 'page' : undefined} onClick={() => setActivePageId(item.id)}>
                <Icon size={16} aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </button>
            })}
          </div>
        })}
        {normalizedQuery && !hasSearchResults ? <div className="settings-navigation-empty">{t("No matching settings")}</div> : null}
      </nav>
    </aside>

    <main className="settings-main">
      <div className="settings-content" key={activePageId}>
        <header className="settings-page-header">
          <div><h1 id="settings-surface-title">{activeNavigation.label}</h1><p>{activeNavigation.description}</p></div>
          {!desktopRuntimeAvailable || autoSaveState === 'saving' || autoSaveState === 'error' ? <div className={`settings-autosave-status is-${autoSaveState}`} role="status" aria-live="polite">
            {!desktopRuntimeAvailable ? <span>{t("Local service disconnected")}</span> : autoSaveState === 'saving' ? <><LoaderCircle className="spin" size={13} />{t("Saving…")}</> : <><CircleX size={13} />{t("Save failed")}</>}
          </div> : null}
        </header>

        {tutorialCompleted ? <div className="settings-message" role="status"><Check size={16} /><span>{t("Tutorial complete. Connect an API model or local Agent, then create a project for your own task. In “AI-assisted building”, choose models for Flow generation and prompt autofill.")}</span></div> : null}
        {message ? <div className={`settings-message ${message.error ? 'is-error' : ''}`} role="status">{message.error ? null : <Check size={14} />}{localizeAppMessage(message.text)}</div> : !desktopRuntimeAvailable ? <div className="settings-message" role="status">{runtimeUnavailableMessage}</div> : null}

        {normalizedQuery && !hasSearchResults ? <div className="settings-list settings-search-empty"><SettingsEmpty query={query} /></div> : null}

        {hasSearchResults && activePageId === 'updates' ? <UpdateSettings /> : null}
        {hasSearchResults && activePageId === 'general' ? <section className="settings-group settings-group--first">
          <div className="settings-group-heading settings-group-heading--stacked"><div className="settings-group-heading-copy"><h2>{t('Display language')}</h2></div><p>{t('Choose your interface language. Changes apply immediately.')}</p></div>
          <label className="field language-setting"><span>{t('Language')}</span><select aria-label={t('Display language')} value={language.preference} disabled={savingLanguage} onChange={async event => {
            const preference = event.target.value as LanguagePreference
            setSavingLanguage(true); setLanguageError(false)
            try { await saveLanguagePreference(preference) } catch { setLanguageError(true) } finally { setSavingLanguage(false) }
          }}><option value="system">{t('Follow system')}</option><option value="zh">中文</option><option value="en">English</option></select></label>
          <p className="field-help">{t('Detected language: {0}', [detectLanguage(language.systemLanguages) === 'zh' ? t('Chinese') : t('English')])}</p>
          {languageError ? <p role="alert" className="parameter-error">{t('Could not save language preference. Try again.')}</p> : null}
        </section> : null}

        {hasSearchResults && activePageId === 'ai' ? <>
          <section className="settings-group settings-group--first" aria-label={t("AI-assisted building")}>
            <div className="settings-group-heading settings-group-heading--stacked">
              <div className="settings-group-heading-copy"><h2><Sparkles size={16} aria-hidden="true" />{t("AI-assisted building")}</h2><span>{t("Choose models for the two Flow-building features")}</span></div>
              <p>{t("These models design Flows and prompts. Each Agent uses its own execution model.")}</p>
            </div>
            {featureProviders.length ? <div className="feature-model-settings">
              <FeatureModelRow icon={<Sparkles size={16} />} title={t("Autofill prompts")} description={t("Fill in Agent responsibilities and input/output requirements while respecting locked prompts.")} ariaPrefix={t("Autofill prompts")} providers={featureProviders} selectedProvider={selectedAutofillProvider} value={promptAutofill} onChange={updatePromptAutofill} />
              <FeatureModelRow icon={<Workflow size={16} />} title={t("Generate Flow from description")} description={t("Generate Agents, prompts, and links from a description and current input summaries.")} ariaPrefix={t("Generate Flow from description")} providers={featureProviders} selectedProvider={selectedFlowGenerationProvider} value={flowGeneration} onChange={updateFlowGeneration} />
            </div> : <SettingsActionEmpty title={t("No models available yet")} description={t("Sign in to a subscription account, connect an API provider, or enable an installed local Agent tool.")} action={t("Sign in to a subscription account")} onAction={() => setActivePageId('subscriptions')} />}
          </section>
        </> : null}

        {hasSearchResults && activePageId === 'model-defaults' ? <section className="settings-group settings-group--first" aria-label={t("Model defaults")}>
          <div className="settings-group-heading settings-group-heading--stacked">
            <div className="settings-group-heading-copy"><h2><SlidersHorizontal size={16} aria-hidden="true" />{t("Defaults for new Agents")}</h2><span>{t("Choose a model to configure reasoning, sampling, and output")}</span></div>
            <p>{t("New Agents use these saved parameters. Existing Agents keep their own settings.")}</p>
          </div>
          {featureProviders.length ? <div className="settings-model-defaults">
            <div className="settings-model-defaults__selectors">
              <label><span>{t("Provider")}</span><ProviderSelect ariaLabel={t("Default parameters provider")} value={defaultModel.providerId} options={featureProviders.map((provider) => ({ value: provider.id, label: provider.name, icon: <ModelLogo providerId={provider.id} name={provider.name} size={19} /> }))} onChange={(providerId) => { const provider = featureProviders.find((candidate) => candidate.id === providerId); setDefaultModel({ providerId, model: provider?.models[0] ?? '' }); setDefaultParameters({}) }} /></label>
              <label><span>{t("Model")}</span><ModelSelect providerId={selectedDefaultProvider?.id ?? ''} providerName={selectedDefaultProvider?.name} ariaLabel={t("Default parameters model")} value={defaultModel.model} options={(selectedDefaultProvider?.models ?? []).map((model) => ({ value: model, label: model === '@tool-default' ? t("Tool default model") : model, icon: <ModelLogo providerId={selectedDefaultProvider?.id ?? ''} modelId={model} name={model} size={19} /> }))} onChange={(model) => { setDefaultModel((current) => ({ ...current, model })); setDefaultParameters({}) }} /></label>
            </div>
            {defaultModel.providerId && defaultModel.model ? <div className="settings-model-defaults__editor"><ModelParametersEditor key={`${defaultModel.providerId}:${defaultModel.model}`} provider={defaultModel.providerId} model={defaultModel.model} parameters={defaultParameters} customParametersEnabled={!defaultModel.providerId.startsWith('agent-tool:')} onChange={setDefaultParameters} /></div> : null}
          </div> : <SettingsActionEmpty title={t("No models to configure")} description={t("Model defaults are available for connected and enabled models.")} action={t("Go to API providers")} onAction={() => setActivePageId('providers')} />}
        </section> : null}

        {hasSearchResults && activePageId === 'subscriptions' ? <section className="settings-group settings-group--first" aria-label={t("Subscription accounts")}>
          <div className="settings-group-heading settings-group-heading--stacked">
            <div className="settings-group-heading-copy"><h2><Link2 size={16} aria-hidden="true" />{t("Sign in to a subscription account")}</h2><span>{subscriptions.filter((connector) => connector.connected).length} {t("connected")}</span></div>
            <button className="settings-group-action settings-subscription-refresh" type="button" onClick={() => void refreshSubscriptions()} disabled={busy || Boolean(connecting)}><RefreshCw className={busy ? 'spin' : undefined} size={13} />{t("Refresh status")}</button>
          </div>
          <div className="settings-list settings-subscription-list">
            {visibleSubscriptions.map((connector) => <SubscriptionRow
              key={connector.id}
              connector={connector}
              busy={connecting === connector.id}
              progress={subscriptionProgress?.connectorId === connector.id ? subscriptionProgress : undefined}
              desktopRuntimeAvailable={desktopRuntimeAvailable && (!connecting || connecting === connector.id)}
              onConnect={() => void connectSubscription(connector.id)}
              onDisconnect={() => void disconnectSubscription(connector.id)}
              onUseSystemTool={() => setActivePageId('tools')}
            />)}
          </div>
        </section> : null}

        {hasSearchResults && activePageId === 'providers' ? <>
          <section className="settings-group settings-group--first" aria-label={t("Built-in providers")}>
            <div className="settings-group-heading">
              <div className="settings-group-heading-copy"><h2>{t("Built-in providers")}</h2><span>{providers.filter((provider) => !provider.custom && provider.added).length} {t("added")}</span></div>
              <ProviderSelect ariaLabel={t("Add built-in provider")} placeholder={availableBuiltInProviders.length ? t("Add provider…") : t("All providers added")} leadingIcon={<Plus size={13} aria-hidden="true" />} options={availableBuiltInProviders.map((provider) => ({ value: provider.id, label: provider.name, icon: <ModelLogo providerId={provider.id} name={provider.name} size={19} /> }))} disabled={!availableBuiltInProviders.length} className="provider-add-menu" onChange={addBuiltIn} />
            </div>
            <div className="settings-list">
              {builtInProviders.map((provider) => <ProviderRow key={provider.id} provider={provider} expanded={expandedProvider === provider.id} testing={testing === provider.id} interactionDisabled={busy} onToggleExpanded={() => setExpandedProvider((current) => current === provider.id ? null : provider.id)} onChange={(patch) => updateProvider(provider.id, patch)} onTest={() => void testConnection(provider.id)} testFeedback={testFeedback[provider.id]} onRemove={() => removeBuiltIn(provider.id)} />)}
              {!builtInProviders.length ? <div className="settings-custom-empty"><span>{t("Choose a provider to connect from the menu above.")}</span></div> : null}
            </div>
          </section>
          <section className="settings-group settings-group--secondary" aria-label={t("Custom provider")}>
            <div className="settings-group-heading">
              <div className="settings-group-heading-copy"><h2>{t("Custom compatible providers")}</h2><span>{providers.filter((provider) => provider.custom).length} {t("items")}</span></div>
              <button className="settings-group-action" type="button" onClick={addCustom}><Plus size={13} />{t("Add compatible provider")}</button>
            </div>
            <div className="settings-list">
              {customProviders.map((provider) => <ProviderRow key={provider.id} provider={provider} expanded={expandedProvider === provider.id} testing={testing === provider.id} interactionDisabled={busy} onToggleExpanded={() => setExpandedProvider((current) => current === provider.id ? null : provider.id)} onChange={(patch) => updateProvider(provider.id, patch)} onTest={() => void testConnection(provider.id)} testFeedback={testFeedback[provider.id]} onRemove={() => { setProviders((current) => current.filter((candidate) => candidate.id !== provider.id)); if (promptAutofill.providerId === provider.id) setPromptAutofill({ providerId: '', model: '' }); if (flowGeneration.providerId === provider.id) setFlowGeneration({ providerId: '', model: '' }); markDirty() }} />)}
              {!customProviders.length ? <div className="settings-custom-empty"><span>{t("Connect local deployments or compatible services through the OpenAI API protocol.")}</span></div> : null}
            </div>
          </section>
        </> : null}

        {hasSearchResults && activePageId === 'tools' ? <section className="settings-group settings-group--first" aria-label={t("Local Agent tools")}>
            <div className="settings-group-heading">
              <div className="settings-group-heading-copy"><h2>{t("Local Agent tools")}</h2><span>{tools.filter((tool) => tool.added).length} {t("added ·")} {tools.filter((tool) => tool.installed).length} {t("detected")}</span></div>
              <div className="settings-group-heading-actions">
                <ProviderSelect
                  ariaLabel={t("Add local Agent tool")}
                  placeholder={availableAgentTools.length ? t("Add Agent tool…") : t("No tools available to add")}
                  leadingIcon={<Plus size={13} aria-hidden="true" />}
                  options={availableAgentTools.map((tool) => ({ value: tool.id, label: tool.name, icon: <ModelLogo providerId={tool.id} name={tool.name} size={19} /> }))}
                  disabled={!availableAgentTools.length}
                  className="provider-add-menu"
                  onChange={addAgentTool}
                />
                <button className="settings-group-action" type="button" onClick={() => void detectTools()} disabled={busy || !desktopRuntimeAvailable} title={desktopRuntimeAvailable ? undefined : t("Detect tools in the AgentFlow desktop app")}><RefreshCw className={busy ? 'spin' : undefined} size={13} />{t("Detect again")}</button>
              </div>
            </div>
            <div className="settings-list">
              {addedTools.map((tool) => <ToolRow
                key={tool.id}
                tool={tool}
                desktopRuntimeAvailable={desktopRuntimeAvailable}
                expanded={expandedTool === tool.id}
                onToggleExpanded={() => setExpandedTool((current) => current === tool.id ? null : tool.id)}
                onChange={(patch) => updateTool(tool.id, patch)}
                onRemove={() => removeAgentTool(tool.id)}
                onLogin={() => void loginLocalAntigravity()}
                loginBusy={loggingInTool || Boolean(connecting)}
              />)}
              {!addedTools.length ? <div className="settings-custom-empty"><span>{t("Detect tools again, then choose an installed local Agent tool from the menu above.")}</span></div> : null}
            </div>
          </section> : null}

        {hasSearchResults && activePageId === 'chat' ? <section className="settings-group settings-group--first" aria-label={t("Chat")}>
          <div className="settings-group-heading settings-group-heading--stacked">
            <div className="settings-group-heading-copy"><h2><MessageSquareText size={16} aria-hidden="true" />{t("Conversation context")}</h2><span>{t("Control the history sent to the model")}</span></div>
            <p>{t("Full messages are saved locally. The character limit determines the context sent with the next request.")}</p>
          </div>
          <div className="feature-model-settings"><ChatHistoryLimitRow value={chatHistoryMaxChars} onChange={updateChatHistoryMaxChars} /></div>
        </section> : null}
      </div>
    </main>
    {pendingExperimentalConnector ? <SubscriptionRiskDialog
      onCancel={() => setPendingExperimentalConnector(null)}
      onAccept={() => void connectSubscription(pendingExperimentalConnector, true)}
    /> : null}
    {runtimeLogin ? <RuntimeLoginDialog key={runtimeLogin.requestId} progress={runtimeLogin} onClose={() => setRuntimeLogin(null)} /> : null}
  </div>
}

function SubscriptionRiskDialog({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  const language = useLanguage()

  const dialog = useRef<HTMLDialogElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    cancelButton.current?.focus()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className="prompt-autofill-dialog subscription-risk-dialog" aria-labelledby="subscription-risk-title" aria-describedby="subscription-risk-description" onCancel={(event) => { event.preventDefault(); onCancel() }}>
    <div className="dialog-heading">
      <span className="dialog-icon dialog-icon--warning"><TriangleAlert size={18} /></span>
      <div><h2 id="subscription-risk-title">{t("Enable experimental DeepSeek Web Bridge?")}</h2><p>{t("After login, AgentFlow sends requests through a web session.")}</p></div>
    </div>
    <div id="subscription-risk-description" className="subscription-risk-copy">
      <p>{t("This is an unofficial connection. DeepSeek’s terms restrict automated scraping and content copying. Use may lead to rate limits, account restrictions, or suspension. Web protocol changes may also break the connection.")}</p>
      <p>{t("Flow and chat text is sent to DeepSeek and may appear in web chat history. Login is stored in AgentFlow’s dedicated browser partition and cleared on disconnect.")}</p>
      <p>{t("Complete login and verification challenges manually.")}<a href="https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html" target="_blank" rel="noreferrer">{t("Read DeepSeek terms of service")}</a></p>
    </div>
    <div className="dialog-actions"><button ref={cancelButton} type="button" className="quiet-button" onClick={onCancel}>{t("Cancel")}</button><button type="button" className="primary-button" onClick={onAccept}>{t("Accept risks and open login")}</button></div>
  </dialog>
}

interface FeatureProviderOption { id: string; name: string; models: string[] }

function FeatureModelRow({ icon, title, description, ariaPrefix, providers, selectedProvider, value, onChange }: {
  icon: ReactNode
  title: string
  description: string
  ariaPrefix: string
  providers: FeatureProviderOption[]
  selectedProvider?: FeatureProviderOption
  value: FeatureModelSettings
  onChange: (next: FeatureModelSettings) => void
}) {
  const language = useLanguage()

  return <section className="feature-model-row" aria-label={title}>
    <div className="feature-model-row__copy"><h3>{icon}{title}</h3><p>{description}</p></div>
    <div className="feature-model-row__controls">
      <label><span>{t("Provider")}</span><ProviderSelect ariaLabel={t('{0} provider', [ariaPrefix])} value={value.providerId} placeholder={providers.length ? t("Choose a connected provider") : t("Connect and fetch models first")} options={providers.map((provider) => ({ value: provider.id, label: provider.name, icon: <ModelLogo providerId={provider.id} name={provider.name} size={19} /> }))} disabled={!providers.length} onChange={(providerId) => { const provider = providers.find((candidate) => candidate.id === providerId); onChange({ providerId, model: provider?.models[0] ?? '' }) }} /></label>
      <label><span>{t("Model")}</span><ModelSelect providerId={selectedProvider?.id ?? ''} providerName={selectedProvider?.name} ariaLabel={t("{0} model", [ariaPrefix])} value={value.model} placeholder={selectedProvider ? t("Choose model") : t("Choose a provider first")} options={(selectedProvider?.models ?? []).map((model) => ({ value: model, label: model === '@tool-default' ? t("Tool default model") : model, icon: <ModelLogo providerId={selectedProvider?.id ?? ''} modelId={model} name={model} size={19} /> }))} disabled={!selectedProvider} onChange={(model) => onChange({ providerId: selectedProvider?.id ?? '', model })} /></label>
    </div>
  </section>
}

function ChatHistoryLimitRow({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const language = useLanguage()

  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const parsed = Number(draft)
    const next = Number.isFinite(parsed)
      ? Math.min(MAX_CHAT_HISTORY_MAX_CHARS, Math.max(MIN_CHAT_HISTORY_MAX_CHARS, Math.round(parsed)))
      : value
    setDraft(String(next))
    if (next !== value) onChange(next)
  }
  return <section className="feature-model-row feature-history-row" aria-label={t("Chat context")}>
    <div className="feature-model-row__copy"><h3><MessageSquareText size={16} />{t("Chat context")}</h3><p>{t("Send the visible conversation. When it exceeds the limit, remove the earliest messages first.")}</p></div>
    <label className="feature-history-limit"><span>{t("History character limit")}</span><input type="number" min={MIN_CHAT_HISTORY_MAX_CHARS} max={MAX_CHAT_HISTORY_MAX_CHARS} step={1000} inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur() } }} /><small>{MIN_CHAT_HISTORY_MAX_CHARS.toLocaleString(getLocale())}–{MAX_CHAT_HISTORY_MAX_CHARS.toLocaleString(getLocale())}{t("; keeps the latest messages.")}</small></label>
  </section>
}

function SettingsActionEmpty({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  const language = useLanguage()

  return <div className="settings-action-empty">
    <div><strong>{title}</strong><span>{description}</span></div>
    <button type="button" onClick={onAction}>{action}</button>
  </div>
}

function SubscriptionRow({ connector, busy, progress, desktopRuntimeAvailable, onConnect, onDisconnect, onUseSystemTool }: {
  connector: SubscriptionConnectorConfiguration
  busy: boolean
  progress?: SubscriptionConnectorProgress
  desktopRuntimeAvailable: boolean
  onConnect: () => void
  onDisconnect: () => void
  onUseSystemTool: () => void
}) {
  const language = useLanguage()

  const status = connector.connected
    ? connector.planType ? t("Connected · {0}", [connector.accountLabel]) : t("Connected")
    : connector.systemToolInstalled && !connector.installed
      ? t("Local tool detected")
      : connector.installed ? t("Waiting for login") : connector.status === 'error' ? t("Action required") : t("Not connected")
  const progressActive = busy && progress && progress.phase !== 'connected' && progress.phase !== 'error'
  const runtimeNote = connector.transport === 'web'
    ? connector.connected ? t("Dedicated browser session saved; disconnecting clears the local login") : t("Sign in through AgentFlow’s dedicated browser")
    : connector.runtimeVersion
    ? t("Runtime {0}", [connector.runtimeVersion])
    : connector.installed
      ? t("Official runtime ready")
      : connector.systemToolInstalled
        ? t("Local tool installed. Reuse it through “Local Agent tools”")
        : <>{t("First connection downloads the official runtime in the background, or visit the")} <a href={connector.manualInstallUrl} target="_blank" rel="noreferrer">{localizeLabel(connector.name)} {t("official installation page")}</a> {t("to install it manually")}</>
  return <article className={`settings-list-row subscription-row ${connector.connected ? '' : 'is-disabled'}`}>
    <div className="subscription-row__summary">
      <ModelLogo providerId={connector.id} name={localizeLabel(connector.name)} size={34} status={connector.connected ? 'ready' : 'idle'} />
      <div className="settings-row-copy">
        <strong>{localizeLabel(connector.name)}{connector.experimental ? <span className="subscription-experimental-label">{t("Experimental")}</span> : null}</strong>
        <small>{connector.accountLabel ?? localizeLabel(connector.description)}</small>
      </div>
      <span className="settings-row-status">{status}</span>
    </div>
    <div className="subscription-row__body">
      <p>{localizeLabel(connector.quotaDescription)}</p>
      {connector.systemToolInstalled && !connector.installed ? <div className="subscription-runtime-warning"><Bot size={14} /><span>{t("This tool is already installed on your computer. Reuse it through “Local Agent tools” to avoid PATH, account, and configuration conflicts.")}</span></div> : null}
      {connector.detail && connector.status === 'error' ? <div className="provider-test-feedback is-error"><CircleX size={14} /><span>{localizeAppMessage(connector.detail)}</span></div> : null}
      {connector.detail && connector.connected ? <p className="settings-runtime-note" role="status">{localizeAppMessage(connector.detail)}</p> : null}
      {progressActive ? <div className="subscription-progress" role="status" aria-live="polite"><LoaderCircle className="spin" size={14} /><span>{localizeAppMessage(progress.message)}</span></div> : null}
      {progress?.userCode ? <div className="subscription-device-code"><span>{t("One-time verification code")}</span><strong>{progress.userCode}</strong><button type="button" onClick={() => void navigator.clipboard.writeText(progress.userCode!)}><Copy size={13} />{t("Copy")}</button></div> : null}
      <div className="settings-row-actions">
        <span className="settings-runtime-note">{runtimeNote}</span>
        {connector.systemToolInstalled && !connector.installed
          ? <button type="button" onClick={onUseSystemTool}><Bot size={13} />{t("Go to local Agent tools")}</button>
          : connector.connected
            ? <button type="button" disabled={busy || !desktopRuntimeAvailable} onClick={onDisconnect}><LogOut size={13} />{t("Disconnect")}</button>
            : <button type="button" disabled={busy || !desktopRuntimeAvailable} onClick={onConnect}>{busy ? <LoaderCircle className="spin" size={13} /> : connector.installed || connector.transport === 'web' ? <Link2 size={13} /> : <Download size={13} />}{connector.transport === 'web' ? t("Sign in to DeepSeek") : connector.installed ? t("Sign in to account") : t("Connect and prepare runtime")}</button>}
      </div>
    </div>
  </article>
}

function ProviderRow({ provider, expanded, testing, testFeedback, interactionDisabled, onToggleExpanded, onChange, onTest, onRemove }: {
  provider: ProviderDraft
  expanded: boolean
  testing: boolean
  testFeedback?: ProviderTestFeedback
  interactionDisabled: boolean
  onToggleExpanded: () => void
  onChange: (patch: Partial<ProviderDraft>) => void
  onTest: () => void
  onRemove?: () => void
}) {
  const language = useLanguage()

  const [modelsExpanded, setModelsExpanded] = useState(false)
  const models = providerModelChoices(provider)
  const enabledModels = enabledProviderModels(provider)
  const configured = (provider.hasApiKey || Boolean(provider.apiKey.trim())) && !provider.clearApiKey
  const ready = configured || (provider.custom && models.length > 0)
  const status = ready ? t("Configured") : provider.custom ? t("Waiting for connection") : t("Waiting for API key")

  return <article className={`settings-list-row ${provider.enabled ? '' : 'is-disabled'}`}>
    <div className="settings-row-summary">
      <button className="settings-row-disclosure" type="button" aria-expanded={expanded} onClick={onToggleExpanded}>
        <ModelLogo providerId={provider.id} name={provider.name} size={28} status={ready ? 'ready' : 'idle'} />
        <span className="settings-row-copy"><strong>{provider.name}</strong><small>{provider.baseUrl}</small></span>
        <span className="settings-row-status">{status}</span>
        <ChevronDown className={expanded ? 'is-open' : ''} size={16} aria-hidden="true" />
      </button>
      <label className="compact-toggle" title={provider.enabled ? t("Disable provider") : t("Enable provider")}><input type="checkbox" aria-label={t("Enable {0}", [provider.name])} checked={provider.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} /><span /></label>
    </div>
    {expanded ? <div className="settings-row-detail">
      <div className="settings-form-grid">
        {provider.custom ? <label><span>{t("Display name")}</span><input value={provider.name} onChange={(event) => onChange({ name: event.target.value })} /></label> : null}
        <label className="is-wide"><span>{t("Base URL")}</span><input value={provider.baseUrl} readOnly={!provider.custom} onChange={(event) => onChange({ baseUrl: event.target.value })} /></label>
        <label className="is-wide"><span>{t("API Key")} {provider.custom ? t(" (optional)") : ''}</span><ApiKeyInput provider={provider} onChange={onChange} /></label>
        {provider.protocol === 'anthropic' ? <div className="is-wide">
          <label><span>{t("Anthropic workspace ID (depends on key type)")}</span><input aria-label={t("Anthropic workspace ID")} aria-describedby={`workspace-help-${provider.id}`} value={provider.anthropicWorkspaceId ?? ''} placeholder="wrkspc_…" autoComplete="off" spellCheck={false} onChange={(event) => onChange({ anthropicWorkspaceId: event.target.value })} /></label>
          <p className="field-help" id={`workspace-help-${provider.id}`}>{t("Required for cross-workspace keys; optional for keys bound to one workspace. Copy the ID from Claude Console → Settings → Workspaces.")}<a href="https://platform.claude.com/docs/en/manage-claude/authentication#select-a-workspace" target="_blank" rel="noreferrer">{t("View official documentation")}</a></p>
        </div> : null}
        {provider.custom ? <label className="is-wide"><span>{t("Model IDs (one per line)")}</span><textarea rows={3} value={provider.manualModels.join('\n')} placeholder={t("Enter real model IDs only if the service does not support /models")} onChange={(event) => onChange({ manualModels: lines(event.target.value) })} /></label> : null}
      </div>
      <div className="settings-row-actions">
        <span>{models.length ? t("{0} / {1} models enabled", [enabledModels.length, models.length]) : provider.modelsUpdatedAt ? t("The service returned no chat models") : t("Models are fetched automatically after saving")}</span>
        {provider.hasApiKey ? <button type="button" onClick={() => onChange({ clearApiKey: !provider.clearApiKey, apiKey: '' })}>{provider.clearApiKey ? t("Keep key") : t("Clear key")}</button> : null}
        <button type="button" onClick={onTest} disabled={interactionDisabled || testing || !provider.enabled || (!provider.custom && !configured)} title={!provider.custom && !configured ? t("Enter an API key first") : undefined}>{testing ? <LoaderCircle className="spin" size={13} /> : <ShieldCheck size={13} />}{t("Test connection")}</button>
        {onRemove ? <button className="is-danger" type="button" onClick={onRemove}><Trash2 size={13} />{t("Remove")}</button> : null}
      </div>
      <div className="provider-models">
        <div className="settings-model-list__heading">
          <button className="provider-models__disclosure" type="button" aria-label={t("{0} available models", [provider.name])} aria-expanded={modelsExpanded} aria-controls={`provider-models-${provider.id}`} onClick={() => setModelsExpanded(value => !value)}><ChevronDown className={modelsExpanded ? 'is-open' : undefined} size={15} /><strong>{t("Available models")}</strong><span>{enabledModels.length} / {models.length} {t("Enabled")}</span></button>
          <button className="quiet-button" type="button" disabled={interactionDisabled || !models.length || enabledModels.length === models.length} onClick={() => onChange({ disabledModels: [] })}>{t("Enable all")}</button>
          <button className="quiet-button" type="button" disabled={interactionDisabled || !enabledModels.length} onClick={() => onChange({ disabledModels: [...new Set([...(provider.disabledModels ?? []), ...models])] })}>{t("Disable all")}</button>
        </div>
        <div id={`provider-models-${provider.id}`} hidden={!modelsExpanded}>
          {modelsExpanded && models.length ? <ul className="settings-model-list" aria-label={t("{0} model list", [provider.name])}>{models.map(model => <li key={model}><div><strong>{model}</strong></div><label className="compact-toggle"><input type="checkbox" aria-label={t("Enable {0} model {1}", [provider.name, model])} checked={enabledModels.includes(model)} disabled={interactionDisabled} onChange={event => onChange({ disabledModels: event.target.checked ? (provider.disabledModels ?? []).filter(value => value !== model) : [...(provider.disabledModels ?? []), model] })} /><span /></label></li>)}</ul> : modelsExpanded ? <p className="muted-copy">{provider.modelsUpdatedAt ? t("The service returned no chat models. Check the configuration and test the connection.") : t("Models appear here after testing the connection.")}</p> : null}
        </div>
      </div>
      {testFeedback ? <div className={`provider-test-feedback is-${testFeedback.tone}`} role="status" aria-live="polite">
        {testFeedback.tone === 'success' ? <CircleCheck size={14} /> : testFeedback.tone === 'error' ? <CircleX size={14} /> : <LoaderCircle className="spin" size={14} />}
        <span>{localizeAppMessage(testFeedback.text)}</span>
      </div> : null}
    </div> : null}
  </article>
}

function providerFeedbackMessage(error: unknown, fallback: string) {
  return error instanceof Error
    ? error.message.replace(/^(?:Error:\s*)?Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '')
    : fallback
}

function ApiKeyInput({ provider, onChange }: { provider: ProviderDraft; onChange: (patch: Partial<ProviderDraft>) => void }) {
  const language = useLanguage()

  const saved = provider.hasApiKey && !provider.clearApiKey && !provider.apiKey
  const [editing, setEditing] = useState(!saved)
  useEffect(() => { if (saved) setEditing(false) }, [provider.id, saved])
  const redacted = `•••• •••• •••• ${redactedSuffix(provider.id)}`
  const showingRedacted = saved && !editing
  return <input className={showingRedacted ? 'api-key-redacted' : undefined} type={showingRedacted ? 'text' : 'password'} autoComplete="off" value={showingRedacted ? redacted : provider.apiKey} placeholder={t("Enter API key")} onFocus={() => { if (showingRedacted) setEditing(true) }} onBlur={() => { if (saved && !provider.apiKey) setEditing(false) }} onChange={(event) => onChange({ apiKey: event.target.value, clearApiKey: false })} />
}

function redactedSuffix(value: string) {
  let hash = 2166136261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4)
}

function ToolRow({ tool, desktopRuntimeAvailable, expanded, onToggleExpanded, onChange, onRemove, onLogin, loginBusy }: {
  tool: AgentToolConfiguration
  desktopRuntimeAvailable: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onChange: (patch: Partial<AgentToolConfiguration>) => void
  onRemove: () => void
  onLogin: () => void
  loginBusy: boolean
}) {
  const language = useLanguage()

  const canEnable = desktopRuntimeAvailable && tool.installed
  const supportsModelOverride = tool.id !== 'agent-tool:deepseek-harness'
  const choices = agentToolModelChoices(tool)
  const enabledModels = enabledAgentToolModels(tool)
  const setDisabledModels = (disabledModels: string[]) => onChange({ disabledModels, model: tool.model && disabledModels.includes(tool.model) ? undefined : tool.model })
  const status = tool.installed ? tool.enabled ? t("Enabled") : t("Available to enable") : desktopRuntimeAvailable ? t("Not installed") : t("Desktop detection only")
  return <article className={`settings-list-row ${tool.enabled && tool.installed ? '' : 'is-disabled'}`}>
    <div className="settings-row-summary">
      <button className="settings-row-disclosure" type="button" aria-expanded={expanded} onClick={onToggleExpanded}>
        <ModelLogo providerId={tool.id} name={tool.name} size={28} status={tool.installed ? 'ready' : 'idle'} />
        <span className="settings-row-copy"><strong>{tool.name}</strong><small>{tool.installed ? tool.model ? t("Installed; model override: {0}", [tool.model]) : t("Installed; uses the tool’s default model") : desktopRuntimeAvailable ? t("Command not found: {0}", [tool.command]) : t("Launch the desktop app to detect local commands")}</small></span>
        <span className="settings-row-status">{status}</span>
        <ChevronDown className={expanded ? 'is-open' : ''} size={16} aria-hidden="true" />
      </button>
      <label className="compact-toggle" title={canEnable ? tool.enabled ? t("Disable tool") : t("Enable tool") : t("Detect an installation before enabling")}><input type="checkbox" aria-label={t("Enable {0}", [tool.name])} checked={tool.enabled} disabled={!canEnable} onChange={(event) => onChange({ enabled: event.target.checked })} /><span /></label>
    </div>
    {expanded ? <div className="settings-row-detail">
      <div className="settings-form-grid">
        <label><span>{t("Detection command")}</span><input value={tool.command} onChange={(event) => onChange({ command: event.target.value })} /></label>
        <div className="is-wide tool-capability-settings">
          <div className="settings-model-list__heading"><strong>{t("Available models")}</strong><span>{enabledModels.length} / {choices.length} {t("Enabled")}</span><button type="button" className="quiet-button" disabled={enabledModels.length === choices.length} onClick={() => setDisabledModels([])}>{t("Enable all")}</button><button type="button" className="quiet-button" disabled={!enabledModels.length} onClick={() => setDisabledModels(choices)}>{t("Disable all")}</button></div>
          <ul className="settings-model-list" aria-label={t("{0} available models", [tool.name])}>{choices.map(model => {
            const label = model === '@tool-default' ? t("Tool default model") : model
            const efforts = tool.reasoningOverrideSupported ? tool.modelReasoningEfforts[model === '@tool-default' && tool.model ? tool.model : model] ?? [] : []
            return <li key={model}><div><strong>{label}</strong><small>{efforts.length ? t("Reasoning effort: {0}", [efforts.map(reasoningLabel).join(' / ')]) : t("Reasoning effort is managed by the tool")}</small></div><label className="compact-toggle"><input type="checkbox" aria-label={t("Enable {0} model {1}", [tool.name, model])} checked={enabledModels.includes(model)} onChange={(event) => setDisabledModels(event.target.checked ? (tool.disabledModels ?? []).filter(item => item !== model) : [...(tool.disabledModels ?? []), model])} /><span /></label></li>
          })}</ul>
          {supportsModelOverride && enabledModels.length ? <label><span>{t("Default model for new Agents")}</span><ModelSelect providerId={tool.id} providerName={tool.name} ariaLabel={t("{0} default model", [tool.name])} value={enabledModels.includes(tool.model ?? '@tool-default') ? tool.model ?? '@tool-default' : undefined} placeholder={t("Choose an enabled model")} options={enabledModels.map(model => ({ value: model, label: model === '@tool-default' ? t("Tool default model") : model }))} onChange={(model) => onChange({ model: model === '@tool-default' ? undefined : model })} /></label> : null}
        </div>
      </div>
      {tool.installed && tool.id === 'agent-tool:antigravity' ? <div className="settings-tool-auth-note settings-tool-google-login"><span>{t("Sign in with Google and paste the authorization code into AgentFlow.")}</span><button type="button" disabled={!desktopRuntimeAvailable || loginBusy} onClick={onLogin}>{loginBusy ? <LoaderCircle className="spin" size={13} /> : <Link2 size={13} />}{t("Sign in with Google")}</button></div> : tool.installed && tool.loginCommand ? <p className="settings-tool-auth-note">{t("Login is checked on the first run. If needed, run")} <code>{tool.loginCommand}</code>{t("in a terminal, then try again.")}</p> : null}
      <div className="settings-row-actions"><span>{enabledModels.length ? t("{0} models enabled", [enabledModels.length]) : t("All models disabled")}</span><button className="is-danger" type="button" onClick={onRemove}><Trash2 size={13} />{t("Remove")}</button></div>
    </div> : null}
  </article>
}

function SettingsEmpty({ query }: { query: string }) {
  const language = useLanguage()

  return <div className="settings-empty"><Search size={18} /><strong>{t("No matching settings")}</strong><span>{t("No results for “{0}”. Try a provider or command name.", [query])}</span></div>
}

function toDraft(provider: ProviderConfiguration): ProviderDraft {
  return { ...provider, apiKey: '', clearApiKey: false }
}

function lines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}
