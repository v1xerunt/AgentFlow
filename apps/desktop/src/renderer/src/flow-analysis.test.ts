import { describe, expect, it } from 'vitest'
import { graphDefinitionSchema } from '@agentflow/schema'
import { analyzeFlowRun, analyzePromptAutofill, graphForRun } from './flow-analysis'

const prompt = (locked = false, customized = false) => ({ content: '', locked, customized })
const graph = graphDefinitionSchema.parse({
  version: 1,
  name: 'Flow',
  goal: 'Goal',
  nodes: {
    input: { type: 'input', name: 'Brief', items: [{ id: 'text', name: 'Text', kind: 'text', mode: 'text', content: 'Build it' }] },
    empty: { type: 'input', name: 'Empty', items: [] },
    isolatedInput: { type: 'input', name: 'Unused', items: [] },
    first: { type: 'agent', name: 'Agent 1', provider: 'agent-tool:codex', model: 'gpt', prompts: { system: prompt(), input: prompt(true), output: prompt() } },
    result: { type: 'output', name: 'Result', ownerAgentId: 'first', directory: '.flow/agent-results/first', note: '', extractText: true },
    second: { type: 'agent', name: 'Agent 2', provider: 'openai', model: 'gpt', prompts: { system: prompt(true), input: prompt(true), output: prompt(true) } },
    isolated: { type: 'agent', name: 'Agent 3', provider: 'openai', model: 'gpt', prompts: { system: prompt(), input: prompt(), output: prompt() } }
  },
  links: [
    { id: 'one', sourceId: 'input', targetId: 'first', type: 'input' },
    { id: 'empty-first', sourceId: 'empty', targetId: 'first', type: 'input' },
    { id: 'two', sourceId: 'result', targetId: 'second', type: 'input' }
  ]
})

describe('flow analysis', () => {
  it('restores the required Result when a local Agent output is missing', () => {
    const definition = structuredClone(graph)
    delete definition.nodes.result
    definition.links = definition.links.filter((link) => !linkSourceIdsForTest(link).includes('result'))
    const parsed = graphDefinitionSchema.parse(definition)
    expect(Object.values(parsed.nodes).some((node) => node.type === 'output' && node.ownerAgentId === 'first')).toBe(true)
  })

  it('describes fillable, locked and disconnected prompt fields', () => {
    const plan = analyzePromptAutofill(graph)
    expect(plan.agents[0]).toMatchObject({ id: 'first', fillFields: ['system', 'output'], blankFields: ['system', 'output'], defaultFields: [], existingFields: [], lockedFields: ['input'] })
    expect(plan.agents[1]).toMatchObject({ id: 'second', fillFields: [], blankFields: [], defaultFields: [], existingFields: [], lockedFields: ['system', 'input', 'output'] })
    expect(plan.disconnectedAgents.map((item) => item.id)).toEqual(['isolated'])
    expect(plan.disconnectedInputs.map((item) => item.id)).toEqual(['isolatedInput'])
    expect(plan.connectedInputCount).toBe(2)

    const first = graph.nodes.first
    if (first?.type !== 'agent') throw new Error('missing first agent')
    const classified = analyzePromptAutofill(graphDefinitionSchema.parse({
      ...graph,
      nodes: { ...graph.nodes, first: { ...first, prompts: { ...first.prompts, system: { content: '已编辑', customized: true, locked: false }, output: { content: '默认输出', customized: false, locked: false } } } }
    }))
    expect(classified.agents[0]).toMatchObject({ blankFields: [], existingFields: ['system'], defaultFields: ['output'] })
    expect(analyzePromptAutofill(classifiedGraph(graph, first), 'blank-and-default').agents[0]?.fillFields).toEqual(['output'])
  })

  it('runs only agents reachable from connected Inputs', () => {
    const plan = analyzeFlowRun(graph)
    expect(plan.runnableAgentIds).toEqual(['first', 'second'])
    expect(plan.skippedAgents.map((item) => item.id)).toEqual(['isolated'])
    expect(plan.emptyInputs.map((item) => item.id)).toEqual(['empty'])
    expect(plan.emptyPromptAgents).toEqual([
      { id: 'first', name: 'Agent 1', fields: ['system', 'input', 'output'] },
      { id: 'second', name: 'Agent 2', fields: ['system', 'input', 'output'] }
    ])
    expect(plan.defaultPromptAgents).toEqual([])
    expect(Object.keys(graphForRun(graph, plan).nodes)).toEqual(['input', 'empty', 'first', 'result', 'second'])
  })

  it('lists every non-empty default Prompt field for runnable Agents', () => {
    const first = graph.nodes.first
    const second = graph.nodes.second
    if (first?.type !== 'agent' || second?.type !== 'agent') throw new Error('missing agents')
    const withDefaults = graphDefinitionSchema.parse({
      ...graph,
      nodes: {
        ...graph.nodes,
        first: { ...first, prompts: { ...first.prompts, system: { content: '默认系统', customized: false, locked: false } } },
        second: { ...second, prompts: { ...second.prompts, input: { content: '默认输入', customized: false, locked: true }, output: { content: '用户输出', customized: true, locked: false } } }
      }
    })
    expect(analyzeFlowRun(withDefaults).defaultPromptAgents).toEqual([
      { id: 'first', name: 'Agent 1', fields: ['system'] },
      { id: 'second', name: 'Agent 2', fields: ['input'] }
    ])
  })
})

function classifiedGraph(source: typeof graph, first: Extract<(typeof graph.nodes)[string], { type: 'agent' }>) {
  return graphDefinitionSchema.parse({
    ...source,
    nodes: { ...source.nodes, first: { ...first, prompts: { ...first.prompts, system: { content: '已编辑', customized: true, locked: false }, output: { content: '默认输出', customized: false, locked: false } } } }
  })
}

function linkSourceIdsForTest(link: (typeof graph.links)[number]) {
  return link.type === 'merge' ? link.sourceIds : [link.sourceId]
}
