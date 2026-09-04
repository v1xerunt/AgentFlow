import { afterEach, describe, expect, it } from 'vitest'
import { configureLanguage, detectLanguage, getLanguage, getLanguageSettings, getLocale, localizeAppMessage, reasoningLabel, t } from './index'
import { zhMessages, type MessageKey } from './messages'

const original = getLanguageSettings()
afterEach(() => configureLanguage(original))

describe('language selection and translated messages', () => {
  it('matches supported system languages in preference order and falls back to English', () => {
    expect(detectLanguage(['zh-TW', 'en-US'])).toBe('zh')
    expect(detectLanguage(['zh_Hant_HK'])).toBe('zh')
    expect(detectLanguage(['en-GB', 'zh-CN'])).toBe('en')
    expect(detectLanguage(['fr-FR', 'zh-CN'])).toBe('zh')
    expect(detectLanguage(['ja-JP'])).toBe('en')
    expect(detectLanguage([])).toBe('en')
  })

  it('gives manual preferences priority and resumes detection in system mode', () => {
    configureLanguage({ preference: 'en', systemLanguages: ['zh-CN'] })
    expect(getLanguage()).toBe('en')
    expect(t('Settings')).toBe('Settings')
    configureLanguage({ preference: 'system', systemLanguages: ['zh-CN'] })
    expect(getLocale()).toBe('zh-CN')
    expect(t('Settings')).toBe('设置')
    expect(reasoningLabel('high')).toBe('高')
    expect(() => configureLanguage({ preference: 'invalid' as 'en', systemLanguages: [] })).toThrow()
  })

  it('substitutes user text once and retains it when feedback is relocalized', () => {
    configureLanguage({ preference: 'zh', systemLanguages: [] })
    const message = t('New connection: {0} to {1}', ['My {1} 项目', 'Target'])
    expect(message).toContain('My {1} 项目')
    configureLanguage({ preference: 'en', systemLanguages: [] })
    expect(localizeAppMessage(message)).toBe('New connection: My {1} 项目 to Target')
    expect(localizeAppMessage('A user-authored sentence')).toBe('A user-authored sentence')
  })

  it('provides complete bilingual messages with identical placeholder sets', () => {
    for (const [key, value] of Object.entries(zhMessages)) {
      expect(value.trim(), key).not.toBe('')
      expect(key, 'English contains Chinese').not.toMatch(/\p{Script=Han}/u)
      const slots = (s: string) => [...new Set(s.match(/\{\d+\}/g) ?? [])].sort()
      expect(slots(value), key).toEqual(slots(key))
      configureLanguage({ preference: 'en', systemLanguages: [] })
      expect(t(key as MessageKey, ['one', 'two', 'three', 'four', 'five'])).not.toMatch(/\{\d+\}/)
    }
  })
})
