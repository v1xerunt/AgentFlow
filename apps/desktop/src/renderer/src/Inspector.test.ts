import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentLibraryProvider } from './AgentLibraryContext'
import { Inspector } from './EditorPanels'
import { createDefaultWorkspaceState } from './workspace-store'

afterEach(() => vi.unstubAllGlobals())

describe('Flow goal field', () => {
  it('renders guidance as a placeholder while the actual goal stays empty', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    const noop = () => {}
    const graph = createDefaultWorkspaceState().graphs[0]!
    const html = renderToStaticMarkup(createElement(AgentLibraryProvider, { children: createElement(Inspector, {
      graph, nodeId: null, artifactOptions: [], events: [], running: false, historyViewing: false, providerModels: [],
      onSelectArtifact: noop, onUpdateGraph: noop, onRunAgent: noop, onOpenChat: noop, onOpenOutput: noop, onRevealOutput: noop,
      onEditInput: noop, onRequestFiles: noop, onDelete: noop, setNotice: noop
    }) }))
    expect(graph.definition.goal).toBe('')
    expect(html).toMatch(/<textarea[^>]*placeholder="描述这个 Flow 需要完成的目标。"[^>]*><\/textarea>/)
  })
})
