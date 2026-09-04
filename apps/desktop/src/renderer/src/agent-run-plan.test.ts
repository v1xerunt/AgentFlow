import { describe, expect, it, vi } from 'vitest'
import { graphDefinitionSchema, type GraphDefinition } from '@agentflow/schema'
import { executeGraph, type Artifact } from '@agentflow/core'
import { agentRunInputIssue, planAgentRun } from './agent-run-plan'

const prompt = () => ({ content: '', locked: false, customized: false })
const graph: GraphDefinition = {
  version: 1,
  name: 'Flow',
  goal: 'Test',
  nodes: {
    input: { type: 'input', name: 'Input', items: [] },
    first: { type: 'agent', name: 'First', provider: 'fake', model: 'fake', prompts: { system: prompt(), input: prompt(), output: prompt() } },
    second: { type: 'agent', name: 'Second', provider: 'fake', model: 'fake', prompts: { system: prompt(), input: prompt(), output: prompt() } },
    third: { type: 'agent', name: 'Third', provider: 'fake', model: 'fake', prompts: { system: prompt(), input: prompt(), output: prompt() } }
  },
  links: [
    { id: 'one', type: 'input', sourceId: 'input', targetId: 'first' },
    { id: 'two', type: 'pass', sourceId: 'first', targetId: 'second' },
    { id: 'three', type: 'pass', sourceId: 'second', targetId: 'third' }
  ]
}

describe('Agent run planning', () => {
  it('rejects empty inputs, whitespace and the target previous answer', () => {
    expect(agentRunInputIssue(graph, 'first', {})).toBeTruthy()
    const ownOutput = { nodeId: 'first', content: 'old answer' } as Artifact
    expect(agentRunInputIssue(graph, 'first', { first: ownOutput })).toBeTruthy()
    const draft = structuredClone(graph)
    draft.nodes.input = { type: 'input', name: 'Input', items: [{ id: 'text', name: 'Text', kind: 'text', mode: 'text', content: '  \n ' }] }
    expect(agentRunInputIssue(draft, 'first', {})).toBeTruthy()
  })

  it('accepts input text, attachments and explicitly written input prompts', () => {
    const draft = structuredClone(graph)
    draft.nodes.input = { type: 'input', name: 'Input', items: [{ id: 'text', name: 'Text', kind: 'text', mode: 'text', content: 'hello' }] }
    expect(agentRunInputIssue(draft, 'first', {})).toBeUndefined()
    draft.nodes.input = { type: 'input', name: 'Input', items: [{ id: 'file', name: 'image.png', kind: 'file', mode: 'attachment', content: '', dataBase64: 'AA==', mimeType: 'image/png' }] }
    expect(agentRunInputIssue(draft, 'first', {})).toBeUndefined()
    if (draft.nodes.third?.type !== 'agent') throw new Error('fixture')
    draft.nodes.third.prompts.input = { content: 'Explain this topic', locked: false, customized: true }
    expect(agentRunInputIssue(draft, 'third', {})).toBeUndefined()
  })

  it('requires an upstream artifact for single runs and follows inputs for runs from the start', () => {
    const draft = structuredClone(graph)
    draft.nodes.input = { type: 'input', name: 'Input', items: [{ id: 'text', name: 'Text', kind: 'text', mode: 'text', content: 'hello' }] }
    expect(agentRunInputIssue(draft, 'third', {})).toBeTruthy()
    expect(agentRunInputIssue(draft, 'third', {}, true)).toBeUndefined()
    expect(agentRunInputIssue(draft, 'third', { second: { content: 'upstream result' } as Artifact })).toBeUndefined()
    expect(agentRunInputIssue(draft, 'third', { second: { content: '  ' } as Artifact })).toBeTruthy()
  })

  it('accepts upstream Result files even when no text was extracted', () => {
    const draft = structuredClone(graph)
    draft.nodes.result = { type: 'output', name: 'Result', ownerAgentId: 'second', directory: '.flow/results/second', note: '', extractText: false }
    draft.links = [{ id: 'result-link', sourceId: 'result', targetId: 'third', type: 'input' }]
    expect(agentRunInputIssue(draft, 'third', { result: { content: '', files: [{ name: 'plot.png', relativePath: 'plot.png', mode: 'attachment', mimeType: 'image/png', size: 1, dataBase64: 'AA==' }] } as Artifact })).toBeUndefined()
  })

  it('uses only the target and its current direct upstream artifacts by default', () => {
    expect(planAgentRun(graph, 'third', 'single')).toEqual({ runNodeIds: ['third'], reuseNodeIds: ['second'] })
  })

  it('walks back to inputs when starting from the beginning', () => {
    const plan = planAgentRun(graph, 'second', 'upstream')
    expect(plan.runNodeIds.sort()).toEqual(['first', 'input', 'second'])
    expect(plan.reuseNodeIds).toEqual([])
  })

  it('runs the selected Agent and descendants, reusing a sibling at a Merge', async () => {
    const draft = structuredClone(graph)
    draft.nodes.input = { type: 'input', name: 'Input', items: [{ id: 'text', name: 'Text', kind: 'text', mode: 'text', content: 'brief' }] }
    draft.nodes.sibling = { ...draft.nodes.first! }
    draft.links = [...draft.links.filter(link => link.id !== 'three'), { id: 'side', type: 'input', sourceId: 'input', targetId: 'sibling' }, { id: 'merge', type: 'merge', sourceIds: ['second', 'sibling'], targetId: 'third' }]
    const previous = await executeGraph(draft, { delayMs: 0 })
    const plan = planAgentRun(draft, 'second', 'downstream')
    expect(plan.runNodeIds.sort()).toEqual(['second', 'third'])
    expect(plan.reuseNodeIds.sort()).toEqual(['first', 'sibling'])
    const result = await executeGraph(draft, { delayMs: 0, nodeIds: plan.runNodeIds, resumeArtifacts: previous.artifacts })
    expect(result.events.filter(event => event.type === 'node.status' && event.status === 'running').map(event => 'nodeId' in event && event.nodeId)).toEqual(['second', 'third'])
    const third = result.artifacts.find(artifact => artifact.nodeId === 'third')!
    expect(third.parentArtifacts).toContain(previous.artifacts.find(artifact => artifact.nodeId === 'sibling')!.id)
    expect(third.parentArtifacts).not.toContain(previous.artifacts.find(artifact => artifact.nodeId === 'second')!.id)
  })

  it('traverses Result ownership upstream and downstream, and reuses external Result files without rerunning their owner', async () => {
    const draft = structuredClone(graph)
    draft.nodes.input = { type: 'input', name: 'Input', items: [{ id: 'text', name: 'Text', kind: 'text', mode: 'text', content: 'brief' }] }
    if (draft.nodes.first?.type === 'agent') draft.nodes.first.provider = 'agent-tool:codex'
    draft.nodes.result = { type: 'output', name: 'Result', ownerAgentId: 'first', directory: '.flow/results/first', note: '', extractText: true }
    draft.links = draft.links.map(link => link.id === 'two' ? { ...link, sourceId: 'result', type: 'input' } : link)
    expect(planAgentRun(draft, 'first', 'downstream').runNodeIds.sort()).toEqual(['first', 'input', 'result', 'second', 'third'])
    expect(planAgentRun(draft, 'second', 'upstream').runNodeIds.sort()).toEqual(['first', 'input', 'result', 'second'])
    expect(planAgentRun(draft, 'second', 'downstream')).toEqual({ runNodeIds: ['second', 'third'], reuseNodeIds: ['result'] })
    expect(planAgentRun(draft, 'first', 'single').runNodeIds.sort()).toEqual(['first', 'input', 'result'])
    const validated = graphDefinitionSchema.parse(draft)
    const modelInvoker = vi.fn(async () => ({ providerId: 'agent-tool:codex', model: 'default', content: 'Ready', files: [{ name: 'report.md', relativePath: 'report.md', mode: 'text' as const, content: '# Report', mimeType: 'text/markdown', size: 8 }] }))
    const previous = await executeGraph(validated, { delayMs: 0, modelInvoker })
    modelInvoker.mockClear()
    const plan = planAgentRun(validated, 'second', 'downstream')
    const result = await executeGraph(validated, { delayMs: 0, modelInvoker, nodeIds: plan.runNodeIds, resumeArtifacts: previous.artifacts.filter(artifact => plan.reuseNodeIds.includes(artifact.nodeId)) })
    expect(result.status).toBe('completed')
    expect(modelInvoker).not.toHaveBeenCalled()
    expect(result.artifacts.find(artifact => artifact.nodeId === 'second')?.parentArtifacts).toContain(previous.artifacts.find(artifact => artifact.nodeId === 'result')!.id)
  })
})
