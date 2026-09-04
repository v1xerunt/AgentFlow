import { zhMessages, type MessageKey } from './messages'

export type Language = 'zh' | 'en'
export type LanguagePreference = 'system' | Language
export interface LanguageSettings { preference: LanguagePreference; systemLanguages: string[] }
export const LANGUAGE_STORAGE_KEY = 'agentflow.language'

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || value === 'zh' || value === 'en'
}

export function detectLanguage(languages: readonly string[]): Language {
  for (const language of languages) {
    const code = language.trim().replaceAll('_', '-').split('-')[0]?.toLowerCase()
    if (code === 'zh' || code === 'en') return code
  }
  return 'en'
}

function browserPreference(): LanguagePreference {
  try { const value = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY); return isLanguagePreference(value) ? value : 'system' }
  catch { return 'system' }
}

let settings: LanguageSettings = {
  preference: browserPreference(),
  systemLanguages: typeof navigator === 'undefined' ? [] : [...navigator.languages]
}
const listeners = new Set<() => void>()
export const getLanguageSettings = () => settings
export const getLanguage = (): Language => settings.preference === 'system' ? detectLanguage(settings.systemLanguages) : settings.preference
export const getLocale = () => getLanguage() === 'zh' ? 'zh-CN' : 'en-US'
export function subscribeLanguage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function configureLanguage(next: LanguageSettings) {
  if (!isLanguagePreference(next.preference)) throw new Error('Invalid language preference')
  if (settings.preference === next.preference && settings.systemLanguages.length === next.systemLanguages.length && settings.systemLanguages.every((value, index) => value === next.systemLanguages[index])) return
  settings = { preference: next.preference, systemLanguages: [...next.systemLanguages] }
  for (const listener of listeners) listener()
}

/** Substitute once so user text containing braces is never interpreted as another placeholder. */
export function t(key: MessageKey, values: readonly unknown[] = []): string {
  const message: string = getLanguage() === 'zh' ? zhMessages[key] : key
  return message.replace(/\{(\d+)\}/g, (placeholder, index: string) => index in values ? String(values[Number(index)] ?? '') : placeholder)
}

/** Localize app-owned labels received from catalogs or stored UI feedback, never user content. */
export function localizeLabel(value: string): string {
  if (value === 'Fake (Demo)') return t('Demo model')
  if (value === 'DeepSeek（Web Bridge）') return t('DeepSeek web connection')
  if (Object.hasOwn(zhMessages, value)) return t(value as MessageKey)
  const key = reverseMessages.get(value)
  return key ? t(key) : value
}
const reverseMessages = new Map<string, MessageKey>(Object.entries(zhMessages).map(([key, value]) => [value, key as MessageKey]))

export function reasoningLabel(value: string): string {
  const labels: Record<string, MessageKey> = { default: 'Default', auto: 'Auto', none: 'Off', disabled: 'Off', enabled: 'On', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Very high', max: 'Maximum', ultra: 'Maximum' }
  return labels[value] ? t(labels[value]) : value
}

export function parameterLabel(value: string): string {
  const labels: Record<string, MessageKey> = { temperature: 'Temperature', topP: 'Top-P', topK: 'Top-K', maxTokens: 'Maximum output tokens', reasoningBudget: 'Reasoning budget · Tokens', presencePenalty: 'Presence penalty', frequencyPenalty: 'Frequency penalty', seed: 'Seed', system: 'System', input: 'Input', output: 'Output' }
  return labels[value] ? t(labels[value]) : value
}

export function runtimeStatusLabel(value: string): string {
  const labels: Record<string, MessageKey> = { idle: 'Not run', waiting: 'Waiting', running: 'Running', completed: 'Completed', failed: 'Run failed', cancelled: 'Stopped', paused: 'Paused' }
  return labels[value] ? t(labels[value]) : value
}

export function numericRequirement(rule: { min: number; max?: number; integer?: boolean; specialValues?: readonly number[] }) {
  const range = rule.max === undefined
    ? t(rule.integer ? 'an integer greater than or equal to {0}' : 'a number greater than or equal to {0}', [rule.min])
    : t(rule.integer ? 'an integer from {0} to {1}' : 'a number from {0} to {1}', [rule.min, rule.max])
  return rule.specialValues?.length ? t('{0}, or one of {1}', [range, rule.specialValues.join(' / ')]) : range
}

const messagePatterns = Object.entries(zhMessages).flatMap(([key, zh]) => /\{\d+\}/.test(key) ? [key, zh].map(pattern => {
  const indices: number[] = []
  const escaped = pattern.split(/(\{\d+\})/).map(part => {
    if (/^\{\d+\}$/.test(part)) { indices.push(Number(part.slice(1, -1))); return '(.*?)' }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('')
  return { key: key as MessageKey, indices, regex: new RegExp('^' + escaped + '$', 's') }
}) : [])

/** Re-render retained app feedback in the current language; keep interpolated user data intact. */
export function localizeAppMessage(message: string): string {
  const direct = localizeLabel(message)
  if (direct !== message) return direct
  for (const pattern of messagePatterns) {
    const match = pattern.regex.exec(message)
    if (!match) continue
    const values: string[] = []
    pattern.indices.forEach((index, i) => { values[index] = match[i + 1] ?? '' })
    return t(pattern.key, values)
  }
  return message
}

export function formatNumber(value: number) { return new Intl.NumberFormat(getLocale()).format(value) }
export function formatDateTime(value: string | number | Date) { return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) }
