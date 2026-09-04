import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { effectiveModelParameters, modelParameterIssues } from '@agentflow/core'
import type { AgentNodeDefinition, AgentParameters } from '@agentflow/schema'
import { agentLibrarySchema, emptyAgentLibrary, lockAgentTemplate, modelParameterKey, type AgentLibrary } from '../../shared/agent-library'

const storageKey = 'agentflow.agent-library.v1'
interface LibraryContextValue {
  library: AgentLibrary
  ready: boolean
  defaults: (provider: string, model: string) => AgentParameters
  saveDefaults: (provider: string, model: string, parameters: AgentParameters) => Promise<void>
  savePreset: (provider: string, model: string, name: string, parameters: AgentParameters) => Promise<void>
  removePreset: (id: string) => Promise<void>
  saveAgent: (node: AgentNodeDefinition) => Promise<void>
  removeAgent: (id: string) => Promise<void>
}
const Context = createContext<LibraryContextValue | null>(null)

export function AgentLibraryProvider({ children }: { children: ReactNode }) {
  const language = useLanguage()

  const [library, setLibrary] = useState(emptyAgentLibrary)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const current = useRef(library)
  const writes = useRef(Promise.resolve())
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const api = window.agentflowDesktop
        const raw = api ? await api.loadAgentLibrary() : JSON.parse(localStorage.getItem(storageKey) ?? 'null')
        const value = raw === null ? emptyAgentLibrary() : agentLibrarySchema.parse(raw)
        if (active) { current.current = value; setLibrary(value); setReady(true) }
      } catch (e) { if (active) setError(t("Could not load model presets and Agent library: {0}", [e instanceof Error ? e.message : String(e)])) }
    }
    void load()
    return () => { active = false }
  }, [])
  const update = (transform: (value: AgentLibrary) => AgentLibrary) => {
    if (!ready) return Promise.reject(new Error(t("The Agent library has not loaded. Restart the app and try again")))
    const result = writes.current.then(async () => {
      const next = agentLibrarySchema.parse(transform(current.current))
      if (window.agentflowDesktop) await window.agentflowDesktop.saveAgentLibrary(next)
      else localStorage.setItem(storageKey, JSON.stringify(next))
      current.current = next
      setLibrary(next)
      setError('')
    })
    writes.current = result.catch((e) => setError(t("Could not save the Agent library: {0}", [e instanceof Error ? e.message : String(e)])))
    return result
  }
  const validate = (provider: string, model: string, parameters: AgentParameters) => {
    const issues = modelParameterIssues(provider, model, parameters)
    if (issues.length) throw new Error(issues.join(t('; ')))
  }
  const value: LibraryContextValue = {
    library, ready,
    defaults: (provider, model) => library.modelDefaults[modelParameterKey(provider, model)] ?? {},
    saveDefaults: async (provider, model, parameters) => { validate(provider, model, parameters); await update((old) => ({ ...old, modelDefaults: { ...old.modelDefaults, [modelParameterKey(provider, model)]: parameters } })) },
    savePreset: async (providerId, model, name, parameters) => { validate(providerId, model, parameters); await update((old) => ({ ...old, parameterPresets: [...old.parameterPresets, { id: crypto.randomUUID(), providerId, model, name: name.trim(), parameters }] })) },
    removePreset: (id) => update((old) => ({ ...old, parameterPresets: old.parameterPresets.filter((item) => item.id !== id) })),
    saveAgent: (node) => {
      const parameters = effectiveModelParameters(node.provider, node.model, node.parameters, library.modelDefaults[modelParameterKey(node.provider, node.model)])
      validate(node.provider, node.model, parameters)
      return update((old) => ({ ...old, agents: [...old.agents, { id: crypto.randomUUID(), node: lockAgentTemplate({ ...node, parameters }), createdAt: new Date().toISOString() }] }))
    },
    removeAgent: (id) => update((old) => ({ ...old, agents: old.agents.filter((item) => item.id !== id) }))
  }
  return <Context.Provider value={value}>{error ? <div className="library-error" role="alert">{error}</div> : null}{children}</Context.Provider>
}

export function useAgentLibrary() {
  const value = useContext(Context)
  if (!value) throw new Error(t("AgentLibraryProvider is missing"))
  return value
}
