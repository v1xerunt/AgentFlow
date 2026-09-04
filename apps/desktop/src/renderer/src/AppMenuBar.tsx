import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import {
  ChevronDown,
  Clipboard,
  Copy,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderSearch,
  Fullscreen,
  Info,
  BookOpen,
  LogOut,
  PanelLeft,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  ScanText,
  Scissors,
  Settings,
  TerminalSquare,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AppIcon } from './AppIcon'
import type { DesktopEditAction, DesktopMenuAction, DesktopMenuContext } from '../../shared/workspace'

type MenuId = 'file' | 'edit' | 'view' | 'help'

interface AppMenuItem {
  label: string
  action: DesktopMenuAction | 'tutorial'
  icon: LucideIcon
  shortcut?: string
  separatorBefore?: boolean
  graphCapability?: keyof AppMenuGraphState
}

interface AppMenuDefinition {
  id: MenuId
  label: string
  items: AppMenuItem[]
}

export interface AppMenuGraphState {
  canUndo: boolean
  canRedo: boolean
  canCopy: boolean
  canPaste: boolean
  canSelectAll: boolean
}

interface AppMenuBarProps {
  sidebarHidden: boolean
  graphActive: boolean
  graphState: AppMenuGraphState
  onGraphEdit: (action: DesktopEditAction) => void
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onStartTutorial: () => void
}

const editActions = new Set<DesktopMenuAction>(['undo', 'redo', 'cut', 'copy', 'paste', 'select-all'])

function menuDefinitions(platform: string): AppMenuDefinition[] {
  const command = platform === 'darwin' ? '⌘' : 'Ctrl+'
  return [
    {
      id: 'file',
      label: t("File"),
      items: [
        { label: t("New temporary project"), action: 'new-project', icon: FilePlus2, shortcut: `${command}N` },
        { label: t("Open project folder…"), action: 'open-project-directory', icon: FolderOpen, shortcut: `${command}O` },
        { label: t("Open current directory in file manager"), action: 'open-current-directory', icon: FolderSearch, shortcut: `${command}Shift+O` },
        { label: t("Save"), action: 'save', icon: Save, shortcut: `${command}S`, separatorBefore: true },
        { label: t("Quit AgentFlow"), action: 'quit', icon: LogOut, shortcut: platform === 'darwin' ? '⌘Q' : 'Alt+F4', separatorBefore: true }
      ]
    },
    {
      id: 'edit',
      label: t("Edit"),
      items: [
        { label: t("Undo"), action: 'undo', icon: Undo2, shortcut: `${command}Z`, graphCapability: 'canUndo' },
        { label: t("Redo"), action: 'redo', icon: Redo2, shortcut: platform === 'darwin' ? '⇧⌘Z' : 'Ctrl+Y', graphCapability: 'canRedo' },
        { label: t("Cut"), action: 'cut', icon: Scissors, shortcut: `${command}X`, separatorBefore: true },
        { label: t("Copy"), action: 'copy', icon: Copy, shortcut: `${command}C`, graphCapability: 'canCopy' },
        { label: t("Paste"), action: 'paste', icon: Clipboard, shortcut: `${command}V`, graphCapability: 'canPaste' },
        { label: t("Select all"), action: 'select-all', icon: ScanText, shortcut: `${command}A`, separatorBefore: true, graphCapability: 'canSelectAll' },
        { label: t("Settings"), action: 'settings', icon: Settings, shortcut: `${command},`, separatorBefore: true }
      ]
    },
    {
      id: 'view',
      label: t("View"),
      items: [
        { label: t("Reload"), action: 'reload', icon: RefreshCw, shortcut: `${command}R` },
        { label: t("Developer tools"), action: 'toggle-dev-tools', icon: TerminalSquare, shortcut: platform === 'darwin' ? '⌥⌘I' : 'Ctrl+Shift+I' },
        { label: t("Actual size"), action: 'reset-zoom', icon: RotateCcw, shortcut: `${command}0`, separatorBefore: true },
        { label: t("Zoom in"), action: 'zoom-in', icon: ZoomIn, shortcut: `${command}+` },
        { label: t("Zoom out"), action: 'zoom-out', icon: ZoomOut, shortcut: `${command}-` },
        { label: t("Toggle full screen"), action: 'toggle-fullscreen', icon: Fullscreen, shortcut: platform === 'darwin' ? '⌃⌘F' : 'F11', separatorBefore: true }
      ]
    },
    {
      id: 'help',
      label: t("Help"),
      items: [
        { label: t("Interactive tutorial"), action: 'tutorial', icon: BookOpen },
        { label: t("Logs and diagnostics…"), action: 'diagnostics', icon: FileText },
        { label: t("About AgentFlow"), action: 'about', icon: Info }
      ]
    }
  ]
}

export function AppMenuBar({ sidebarHidden, graphActive, graphState, onGraphEdit, onToggleSidebar, onOpenSettings, onStartTutorial }: AppMenuBarProps) {
  const language = useLanguage()

  const [openMenu, setOpenMenu] = useState<MenuId | null>(null)
  const [menuContext, setMenuContext] = useState<DesktopMenuContext>('app')
  const rootRef = useRef<HTMLElement | null>(null)
  const textTargetRef = useRef<HTMLElement | null>(null)
  const platform = window.agentflowDesktop?.platform ?? 'win32'
  const definitions = menuDefinitions(platform)

  useEffect(() => {
    if (!openMenu) return
    const closeFromPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    const closeFromKeyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    const closeFromWindow = () => setOpenMenu(null)
    document.addEventListener('pointerdown', closeFromPointer, true)
    window.addEventListener('keydown', closeFromKeyboard)
    window.addEventListener('blur', closeFromWindow)
    return () => {
      document.removeEventListener('pointerdown', closeFromPointer, true)
      window.removeEventListener('keydown', closeFromKeyboard)
      window.removeEventListener('blur', closeFromWindow)
    }
  }, [openMenu])

  const focusFirstItem = (id: MenuId) => {
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`[data-menu-panel="${id}"] button:not(:disabled)`)?.focus())
  }

  const captureMenuContext = () => {
    const active = document.activeElement as HTMLElement | null
    const textTarget = active?.closest<HTMLElement>('input,textarea,[contenteditable="true"]') ?? null
    textTargetRef.current = textTarget
    setMenuContext(textTarget ? 'text' : graphActive ? 'graph' : 'app')
  }

  const openFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, id: MenuId) => {
    if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setOpenMenu(id)
    focusFirstItem(id)
  }

  const moveWithinMenu = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const panel = event.currentTarget.closest('[data-menu-panel]')
    const items = panel ? [...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')] : []
    const index = items.indexOf(event.currentTarget)
    const delta = event.key === 'ArrowDown' ? 1 : -1
    items[(index + delta + items.length) % items.length]?.focus()
  }

  const itemEnabled = (item: AppMenuItem) => {
    if (item.action === 'tutorial') return true
    if (!editActions.has(item.action)) return true
    if (item.action === 'select-all' && graphActive) return graphState.canSelectAll
    if (menuContext === 'text') return true
    if (menuContext !== 'graph' || !item.graphCapability) return false
    return graphState[item.graphCapability]
  }

  const invoke = (action: DesktopMenuAction | 'tutorial') => {
    if (action === 'tutorial') { setOpenMenu(null); onStartTutorial(); return }
    if (action === 'settings') { setOpenMenu(null); onOpenSettings(); return }
    if (action === 'diagnostics' && !window.agentflowDesktop) { setOpenMenu(null); window.open(`${window.location.pathname}#diagnostics`, '_blank', 'noopener'); return }
    const context = menuContext
    if ((context === 'graph' || (action === 'select-all' && graphActive)) && editActions.has(action)) {
      setOpenMenu(null)
      onGraphEdit(action as DesktopEditAction)
      return
    }
    if (context === 'text' && textTargetRef.current?.isConnected) textTargetRef.current.focus({ preventScroll: true })
    setOpenMenu(null)
    void window.agentflowDesktop?.invokeMenuAction(action, context)
  }

  return <header ref={rootRef} className={`app-titlebar is-${platform}`}>
    <div className="app-titlebar__identity" aria-label={t('AgentFlow')}>
      <AppIcon />
      <span className="brand-name">{t('AgentFlow')}</span>
    </div>
    <button className="icon-button app-titlebar__sidebar-toggle" type="button" onClick={onToggleSidebar} aria-label={sidebarHidden ? t("Show sidebar") : t("Hide sidebar")} aria-pressed={!sidebarHidden}>
      <PanelLeft size={17} />
    </button>
    <span className="app-titlebar__divider" aria-hidden="true" />
    <nav className="app-menu-bar" aria-label={t("Application menu")}>
      {definitions.map((menu) => <div className={`app-menu ${openMenu === menu.id ? 'is-open' : ''}`} key={menu.id} onPointerEnter={() => { if (openMenu) setOpenMenu(menu.id) }}>
        <button className="app-menu__trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === menu.id} onPointerDown={captureMenuContext} onClick={() => setOpenMenu((current) => current === menu.id ? null : menu.id)} onKeyDown={(event) => openFromKeyboard(event, menu.id)}>
          {menu.label}<ChevronDown size={12} />
        </button>
        {openMenu === menu.id ? <div className="app-menu__popover" role="menu" aria-label={t("{0} menu", [menu.label])} data-menu-panel={menu.id}>
          {menu.items.map((item) => {
            const Icon = item.icon
            const enabled = itemEnabled(item)
            return <div key={item.action}>
              {item.separatorBefore ? <span className="app-menu__separator" role="separator" /> : null}
              <button type="button" role="menuitem" disabled={!enabled} onClick={() => invoke(item.action)} onKeyDown={moveWithinMenu}>
                <Icon size={15} />
                <span>{item.label}</span>
                {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
              </button>
            </div>
          })}
        </div> : null}
      </div>)}
    </nav>
    <div className="app-titlebar__drag-region" aria-hidden="true" />
  </header>
}
