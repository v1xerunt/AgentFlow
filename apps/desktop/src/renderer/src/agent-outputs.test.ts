import { describe, expect, it, vi } from 'vitest'
import { graphDefinitionSchema, type AgentNodeDefinition } from '@agentflow/schema'
import { artifactNodeIdForAgent, reconcileAgentToolOutput } from './agent-outputs'
import { buildFlowNodes } from './EditorPanels'

const prompts = {
  system: { content: '', customized: false, locked: false },
  input: { content: '', customized: false, locked: false },
  output: { content: '', customized: false, locked: false }
}

describe('local agent Result nodes', () => {
  it('reveals the owned Result from either card and hides file actions before output exists', () => {
    const graph = graphDefinitionSchema.parse({ version: 1, name: 'Reveal', goal: 'Inspect output', nodes: { local: { type: 'agent', name: 'Local', provider: 'agent-tool:codex', model: '@tool-default', prompts } }, links: [] })
    const resultId = artifactNodeIdForAgent(graph, 'local')
    const reveal = vi.fn()
    const actions = { onUpdateNode: vi.fn(), onSaveAgent: vi.fn(), onRenameGroup: vi.fn(), onUngroup: vi.fn(), onRevealOutput: reveal, outputNodeIds: new Set([resultId]), providerModels: [] }
    const nodes = buildFlowNodes(graph, {}, new Set(), actions)
    for (const id of ['local', resultId]) {
      const action = nodes.find(node => node.id === id)?.data.onRevealOutput
      expect(typeof action).toBe('function')
      if (typeof action === 'function') action()
      expect(reveal).toHaveBeenCalledWith(id)
    }
    const empty = buildFlowNodes(graph, {}, new Set(), { ...actions, outputNodeIds: new Set() })
    expect(empty.every(node => !node.data.onRevealOutput)).toBe(true)
  })

  it('adds the required Result while parsing a local Agent tool', () => {
    const graph = graphDefinitionSchema.parse({
      version: 1,
      name: 'Required Result',
      goal: 'Keep local output addressable',
      nodes: {
        local: { type: 'agent', name: 'Codex Agent', provider: 'agent-tool:codex', model: '@tool-default', prompts }
      },
      links: []
    })
    const result = Object.entries(graph.nodes).find(([, node]) => node.type === 'output')
    expect(result?.[1]).toMatchObject({ type: 'output', ownerAgentId: 'local' })
    expect(artifactNodeIdForAgent(graph, 'local')).toBe(result?.[0])
  })

  it('places Result to the right and routes downstream links through it', () => {
    const local: AgentNodeDefinition = {
      type: 'agent',
      name: 'Codex Agent',
      provider: 'agent-tool:codex',
      model: '@tool-default',
      prompts,
      position: { x: 120, y: 80 }
    }
    const graph = graphDefinitionSchema.parse({
      version: 1,
      name: 'Local tool flow',
      goal: 'Generate and review a deliverable',
      nodes: {
        local,
        reviewer: { type: 'agent', name: 'Reviewer', provider: 'openai', model: 'gpt-5.6-sol', prompts, position: { x: 900, y: 80 } }
      },
      links: [{ id: 'local-reviewer', sourceId: 'local', targetId: 'reviewer', type: 'pass' }]
    })

    const reconciled = reconcileAgentToolOutput(graph, 'local')
    expect(reconciled.nodes.output_local).toMatchObject({
      type: 'output',
      ownerAgentId: 'local',
      directory: '.flow/agent-results/local',
      position: { x: 480, y: 128 }
    })
    expect(reconciled.links).toEqual([
      { id: 'local-reviewer', sourceId: 'output_local', targetId: 'reviewer', type: 'input' }
    ])
  })

  it('keeps the managed output directory internal when loading a flow', () => {
    const graph = graphDefinitionSchema.parse({
      version: 1,
      name: 'Managed output',
      goal: 'Keep output paths internal',
      nodes: {
        local: { type: 'agent', name: 'Codex Agent', provider: 'agent-tool:codex', model: '@tool-default', prompts, position: { x: 120, y: 80 } },
        result: { type: 'output', name: 'Result', ownerAgentId: 'local', directory: 'user-selected-folder', note: '', extractText: true, position: { x: 120, y: 330 } }
      },
      links: []
    })
    expect(graph.nodes.result).toMatchObject({ directory: '.flow/agent-results/local', position: { x: 120, y: 330 } })
  })
})
