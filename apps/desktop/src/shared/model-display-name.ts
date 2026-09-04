import { t } from '@agentflow/core/localization'
export function modelDisplayName(providerId: string, model: string, fallback = model): string {
  if (providerId === 'subscription:deepseek-web') {
    if (model === 'deepseek-chat') return t("Fast mode")
    if (model === 'deepseek-reasoner') return t("Expert mode")
  }
  return fallback
}
