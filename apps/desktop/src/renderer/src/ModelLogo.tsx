import { useLanguage } from './language'
import type { CSSProperties } from 'react'
import anthropicLogo from '@lobehub/icons-static-svg/icons/anthropic.svg?url'
import claudeLogo from '@lobehub/icons-static-svg/icons/claude-color.svg?url'
import claudeCodeLogo from '@lobehub/icons-static-svg/icons/claudecode-color.svg?url'
import codexLogo from '@lobehub/icons-static-svg/icons/codex-color.svg?url'
import deepSeekLogo from '@lobehub/icons-static-svg/icons/deepseek-color.svg?url'
import geminiLogo from '@lobehub/icons-static-svg/icons/gemini-color.svg?url'
import kimiLogo from '@lobehub/icons-static-svg/icons/kimi-color.svg?url'
import openAiLogo from '@lobehub/icons-static-svg/icons/openai.svg?url'
import openRouterLogo from '@lobehub/icons-static-svg/icons/openrouter-color.svg?url'
import zaiLogo from '@lobehub/icons-static-svg/icons/zai.svg?url'

type ModelLogoKey = 'openai' | 'anthropic' | 'claude' | 'gemini' | 'deepseek' | 'zai' | 'kimi' | 'openrouter' | 'codex' | 'claude-code' | 'custom'

const assets: Partial<Record<ModelLogoKey, string>> = {
  openai: openAiLogo,
  anthropic: anthropicLogo,
  claude: claudeLogo,
  gemini: geminiLogo,
  deepseek: deepSeekLogo,
  zai: zaiLogo,
  kimi: kimiLogo,
  openrouter: openRouterLogo,
  codex: codexLogo,
  'claude-code': claudeCodeLogo
}

export function modelLogoKey(providerId: string, modelId?: string): ModelLogoKey {
  const provider = providerId.toLocaleLowerCase()
  if (provider === 'agent-tool:codex') return 'codex'
  if (provider === 'agent-tool:claude-code') return 'claude-code'
  if (provider === 'agent-tool:deepseek-harness') return 'deepseek'
  if (provider === 'agent-tool:kimi-code') return 'kimi'
  if (provider === 'agent-tool:antigravity') return 'gemini'
  if (provider === 'subscription:codex') return 'openai'
  if (provider === 'subscription:claude-code') return 'claude'
  if (provider === 'subscription:kimi-code') return 'kimi'
  if (provider === 'subscription:antigravity') return 'gemini'
  if (provider === 'subscription:deepseek-web') return 'deepseek'

  const model = modelId?.toLocaleLowerCase() ?? ''
  if (/(?:^|[/_-])claude(?:$|[/_.-])|anthropic/.test(model)) return 'claude'
  if (/(?:^|[/_-])gemini(?:$|[/_.-])|google\//.test(model)) return 'gemini'
  if (/deepseek/.test(model)) return 'deepseek'
  if (/(?:kimi|moonshot)/.test(model)) return 'kimi'
  if (/(?:^|[/_-])glm(?:$|[/_.-])|(?:z-ai|zai|zhipu)/.test(model)) return 'zai'
  if (/(?:^|\/)gpt-|(?:^|\/)o\d|openai\/|codex/.test(model)) return 'openai'

  if (provider === 'openai') return 'openai'
  if (provider === 'anthropic') return modelId ? 'claude' : 'anthropic'
  if (provider === 'google') return 'gemini'
  if (provider === 'deepseek') return 'deepseek'
  if (provider === 'zai') return 'zai'
  if (provider === 'kimi') return 'kimi'
  if (provider === 'openrouter') return 'openrouter'
  return 'custom'
}

export function ModelLogo({ providerId, modelId, name, size = 28, status, className = '' }: {
  providerId: string
  modelId?: string
  name?: string
  size?: number
  status?: 'ready' | 'idle'
  className?: string
}) {
  const language = useLanguage()

  const key = modelLogoKey(providerId, modelId)
  const asset = assets[key]
  const fallback = (name ?? providerId.replace(/^agent-tool:/, '')).trim().charAt(0).toLocaleUpperCase() || '?'
  const style = { '--model-logo-size': `${size}px` } as CSSProperties
  return <span className={`model-logo model-logo--${key} ${className}`} style={style} aria-hidden="true">
    {asset ? <img src={asset} alt="" draggable={false} /> : <span className="model-logo__fallback">{fallback}</span>}
    {status ? <span className={`model-logo__status is-${status}`} /> : null}
  </span>
}
