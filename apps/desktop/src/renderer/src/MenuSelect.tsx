import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { Check, ChevronDown, Search, Star, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { filterAndSortOptions, useSelectionFavorites } from './selection-favorites'

export interface MenuSelectOption {
  value: string
  label: string
  icon?: ReactNode
  searchText?: string
  favoriteKey?: string
  actions?: MenuSelectOptionAction[]
}

export interface MenuSelectOptionAction {
  key: string
  ariaLabel: string
  title?: string
  icon: ReactNode
  onSelect: () => void
}

export interface MenuSelectProps {
  ariaLabel: string
  value?: string
  placeholder?: string
  leadingIcon?: ReactNode
  options: MenuSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  searchable?: boolean
  searchPlaceholder?: string
  menuWidth?: number
  wrapLabels?: boolean
}

export function MenuSelect({ ariaLabel, value, placeholder, leadingIcon, options, onChange, disabled, className = '', searchable = false, searchPlaceholder = t("Search…"), menuWidth, wrapLabels = false }: MenuSelectProps) {
  const language = useLanguage()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeValue, setActiveValue] = useState(value)
  const [favoriteError, setFavoriteError] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({ left: 0, top: 0, width: 140 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const initialFocus = useRef(value)
  const optionRefs = useRef(new Map<string, HTMLButtonElement>())
  const favoriteRefs = useRef(new Map<string, HTMLButtonElement>())
  const actionRefs = useRef(new Map<string, HTMLButtonElement>())
  const listId = useId()
  const { favorites, toggleFavorite, saveFavorites } = useSelectionFavorites()
  const visibleOptions = useMemo(() => filterAndSortOptions(options, query, favorites), [options, query, favorites, language])
  const hasFavorites = options.some((option) => option.favoriteKey)
  const hasRowActions = hasFavorites || options.some((option) => option.actions?.length)
  const focusedValue = visibleOptions.some((option) => option.value === activeValue) ? activeValue : visibleOptions[0]?.value
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      const target = event.target as Node | null
      if (!target || (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target))) setOpen(false)
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    const closeForLayout = () => setOpen(false)
    const scroll = (event: Event) => {
      // Scrollbars, wheel, touch and keyboard scrolling inside the popup keep it open.
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside)
    window.addEventListener('keydown', escape, true)
    window.addEventListener('resize', closeForLayout)
    document.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', outside)
      window.removeEventListener('keydown', escape, true)
      window.removeEventListener('resize', closeForLayout)
      document.removeEventListener('scroll', scroll, true)
    }
  }, [open])

  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  useEffect(() => {
    if (!open) return
    if (searchable) searchRef.current?.focus({ preventScroll: true })
    else optionRefs.current.get(initialFocus.current ?? '')?.focus({ preventScroll: true })
  }, [open, searchable])

  const openMenu = () => {
    if (disabled || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.min(Math.max(menuWidth ?? (searchable ? 320 : 120), rect.width), window.innerWidth - 16)
    const estimatedHeight = Math.min(280, options.length * 36 + 12 + (searchable ? 44 : 0))
    const below = window.innerHeight - rect.bottom - 13
    const above = rect.top - 13
    const opensBelow = below >= estimatedHeight || below >= above
    setPosition({
      left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.left)),
      ...(opensBelow ? { top: rect.bottom + 5 } : { bottom: window.innerHeight - rect.top + 5 }),
      maxHeight: Math.max(0, Math.min(280, opensBelow ? below : above)),
      width
    })
    setQuery('')
    initialFocus.current = value ?? filterAndSortOptions(options, '', favorites)[0]?.value
    setActiveValue(initialFocus.current)
    setOpen(true)
  }

  const choose = (option: MenuSelectOption) => {
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }

  const rowControls = (option: MenuSelectOption) => [
    optionRefs.current.get(option.value),
    ...(option.favoriteKey ? [favoriteRefs.current.get(option.value)] : []),
    ...(option.actions ?? []).map((action) => actionRefs.current.get(`${option.value}:${action.key}`))
  ].filter((button): button is HTMLButtonElement => Boolean(button))

  const focusOption = (index: number, controlIndex = 0) => {
    const option = visibleOptions[index]
    if (!option) return
    setActiveValue(option.value)
    const controls = rowControls(option)
    const button = controls[Math.min(controlIndex, controls.length - 1)] ?? controls[0]
    button?.focus({ preventScroll: true })
    button?.scrollIntoView({ block: 'nearest' })
  }

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (event.nativeEvent.isComposing) return
    const inSearch = event.target === searchRef.current
    const index = visibleOptions.findIndex((option) => option.value === focusedValue)
    const currentOption = visibleOptions[index]
    const controls = currentOption ? rowControls(currentOption) : []
    const controlIndex = Math.max(0, controls.indexOf(event.target as HTMLButtonElement))
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption(inSearch ? (event.key === 'ArrowDown' ? 0 : visibleOptions.length - 1) : Math.max(0, Math.min(visibleOptions.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))), controlIndex)
    } else if (!inSearch && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault()
      focusOption(event.key === 'Home' ? 0 : visibleOptions.length - 1, controlIndex)
    } else if (!inSearch && hasRowActions && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      focusOption(index, Math.max(0, Math.min(controls.length - 1, controlIndex + (event.key === 'ArrowRight' ? 1 : -1))))
    } else if (inSearch && event.key === 'Enter' && visibleOptions[0]) {
      event.preventDefault()
      choose(visibleOptions[0])
    }
  }

  return <span className={`menu-select ${className}`}>
    <button ref={triggerRef} className="menu-select__trigger" type="button" aria-label={ariaLabel} title={selected?.label ?? value} aria-haspopup={hasRowActions ? 'grid' : 'listbox'} aria-controls={open ? listId : undefined} aria-expanded={open} disabled={disabled}
      onClick={(event) => { event.stopPropagation(); if (open) setOpen(false); else openMenu() }}
      onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); openMenu() } }}
      onMouseDown={(event) => event.stopPropagation()}>
      <span className="menu-select__value">{leadingIcon}<span>{selected?.label ?? placeholder ?? value}</span></span>
      <ChevronDown size={12} />
    </button>
    {open ? createPortal(<div ref={menuRef} className={`menu-select__popover ${wrapLabels ? 'menu-select__popover--wrap' : ''}`} style={position} onKeyDown={navigate}
      onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      {searchable ? <div className="menu-select__search">
        <Search size={15} aria-hidden="true" />
        <input ref={searchRef} type="search" aria-label={t("Search {0}", [ariaLabel])} aria-controls={listId} placeholder={searchPlaceholder} value={query}
          onChange={(event) => { setQuery(event.target.value); if (listRef.current) listRef.current.scrollTop = 0 }} />
        {query ? <button type="button" aria-label={t("Clear search")} onClick={() => { setQuery(''); searchRef.current?.focus() }}><X size={14} /></button> : null}
      </div> : null}
      <div ref={listRef} className="menu-select__list" id={listId} role={hasRowActions ? 'grid' : 'listbox'} aria-label={ariaLabel}>
        {visibleOptions.map((option) => {
          const isFavorite = Boolean(option.favoriteKey && favorites.includes(option.favoriteKey))
          const selection = <button ref={(element) => { if (element) optionRefs.current.set(option.value, element); else optionRefs.current.delete(option.value) }} type="button"
            role={hasRowActions ? undefined : 'option'} aria-selected={hasRowActions ? undefined : option.value === value}
            className="menu-select__option" data-value={option.value} title={option.label} tabIndex={option.value === focusedValue ? 0 : -1}
            onFocus={() => setActiveValue(option.value)} onClick={() => choose(option)}>
            <span className="menu-select__option-label">{option.icon}<span>{option.label}</span></span>
            {option.value === value ? <Check className="menu-select__check" size={14} aria-hidden="true" /> : null}
          </button>
          return hasRowActions ? <div className={`menu-select__row ${option.value === value ? 'is-selected' : ''}`} key={option.value} role="row" aria-selected={option.value === value}>
            <div role="gridcell">{selection}</div>
            <div className="menu-select__row-actions" role="gridcell">{option.favoriteKey ? <button
              ref={(element) => { if (element) favoriteRefs.current.set(option.value, element); else favoriteRefs.current.delete(option.value) }}
              type="button" className={`menu-select__favorite ${isFavorite ? 'is-favorite' : ''}`} aria-label={`${isFavorite ? t("Remove favorite") : t("Favorite")} ${option.label}`} aria-pressed={isFavorite}
              title={isFavorite ? t("Remove favorite") : t("Favorite and pin")} tabIndex={option.value === focusedValue ? 0 : -1}
              onFocus={() => setActiveValue(option.value)} onClick={() => { setFavoriteError(!toggleFavorite(option.favoriteKey!)) }}>
              <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button> : null}{option.actions?.map((action) => <button
              key={action.key}
              ref={(element) => { const key = `${option.value}:${action.key}`; if (element) actionRefs.current.set(key, element); else actionRefs.current.delete(key) }}
              type="button" className="menu-select__action" aria-label={action.ariaLabel} title={action.title ?? action.ariaLabel} tabIndex={option.value === focusedValue ? 0 : -1}
              onFocus={() => setActiveValue(option.value)} onClick={() => { setOpen(false); action.onSelect() }}>
              {action.icon}
            </button>)}</div>
          </div> : <div role="presentation" className={`menu-select__row ${option.value === value ? 'is-selected' : ''}`} key={option.value}>{selection}</div>
        })}
      </div>
      {!visibleOptions.length ? <div className="menu-select__empty" role="status">{query ? t("No matching results. Try other keywords.") : t("No options available")}</div> : null}
      {favoriteError ? <div className="menu-select__error" role="status">{t("Favorites could not be saved locally")}<button type="button" onClick={() => setFavoriteError(!saveFavorites())}>{t("Try again")}</button></div> : null}
    </div>, document.body) : null}
  </span>
}
