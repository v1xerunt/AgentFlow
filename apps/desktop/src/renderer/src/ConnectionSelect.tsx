import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { MenuSelect, type MenuSelectProps } from './MenuSelect'
import { modelFavoriteKey, providerFavoriteKey } from './selection-favorites'
import { modelDisplayName } from '../../shared/model-display-name'

export function ProviderSelect(props: MenuSelectProps) {
  const language = useLanguage()

  return <MenuSelect {...props} searchable menuWidth={420} wrapLabels searchPlaceholder={t("Search providers…")} options={props.options.map((option) => ({
    ...option,
    favoriteKey: option.favoriteKey ?? providerFavoriteKey(option.value)
  }))} />
}

export function ModelSelect({ providerId, providerName, ...props }: MenuSelectProps & { providerId: string; providerName?: string }) {
  const language = useLanguage()

  return <MenuSelect {...props} searchable menuWidth={480} wrapLabels searchPlaceholder={t("Search models…")} options={props.options.map((option) => ({
    ...option,
    label: modelDisplayName(providerId, option.value, option.label),
    searchText: `${providerId} ${providerName ?? ''} ${option.searchText ?? ''}`,
    favoriteKey: modelFavoriteKey(providerId, option.value)
  }))} />
}
