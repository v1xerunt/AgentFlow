import { useSyncExternalStore } from 'react'
import { configureLanguage, getLanguageSettings, getLocale, isLanguagePreference, LANGUAGE_STORAGE_KEY, subscribeLanguage, t, type LanguagePreference } from '@agentflow/core/localization'

export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguageSettings, getLanguageSettings)
}

function applyDocumentLanguage() {
  document.documentElement.lang = getLocale()
  document.title = location.hash === '#diagnostics' ? t('Logs and diagnostics · AgentFlow') : t('AgentFlow')
}

export async function initializeLanguage() {
  const api = window.agentflowDesktop
  if (api?.getLanguageSettings) {
    try { configureLanguage(await api.getLanguageSettings()) } catch { /* Browser preference remains available if the bridge is starting. */ }
  }
  applyDocumentLanguage()
  const unsubscribe = subscribeLanguage(applyDocumentLanguage)
  const unsubscribeDesktop = api?.onLanguageChanged?.(configureLanguage)
  const systemChanged = () => {
    if (!api) configureLanguage({ ...getLanguageSettings(), systemLanguages: [...navigator.languages] })
    else void api.getLanguageSettings?.().then(configureLanguage).catch(() => {})
  }
  const stored = (event: StorageEvent) => {
    if (!api && event.key === LANGUAGE_STORAGE_KEY && (event.newValue === null || isLanguagePreference(event.newValue))) {
      configureLanguage({ ...getLanguageSettings(), preference: event.newValue ?? 'system' })
    }
  }
  window.addEventListener('languagechange', systemChanged)
  window.addEventListener('focus', systemChanged)
  window.addEventListener('storage', stored)
  return () => { unsubscribe(); unsubscribeDesktop?.(); window.removeEventListener('languagechange', systemChanged); window.removeEventListener('focus', systemChanged); window.removeEventListener('storage', stored) }
}

export async function saveLanguagePreference(preference: LanguagePreference) {
  const api = window.agentflowDesktop
  if (api?.setLanguagePreference) configureLanguage(await api.setLanguagePreference(preference))
  else {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, preference)
    configureLanguage({ ...getLanguageSettings(), preference })
  }
}
