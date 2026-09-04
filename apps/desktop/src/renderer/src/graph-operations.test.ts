import { describe, expect, it } from 'vitest'
import { graphDefinitionSchema, type GraphDefinition } from '@agentflow/schema'
import { deleteGraphSelection, groupSelectedNodes, mergeAgentSourceIntoTarget, moveGraphGroup, renameGraphGroup, selectAllGraphElements, ungroupGraphNodes } from './graph-operations'

function graph(): GraphDefinition {
  return graphDefinitionSchema.parse({
    version: 1,
    name: 'Merge operations',
    goal: 'Exercise editor transforms',
    nodes: {
      a: agent('A', 0, 0),
      b: agent('B', 100, 20),
      c: agent('C', 200, 40),
      d: agent('D', 300, 60),
      target: agent('Target', 500, 100)
    },
    links: [
      { id: 'a-target', sourceId: 'a', targetId: 'target', type: 'pass' },
      { id: 'b-target', sourceId: 'b', targetId: 'target', type: 'review' },
      { id: 'c-b', sourceId: 'c', targetId: 'b', type: 'pass' }
    ]
  })
}

describe('graph editor operations', () => {
  it('selects every node and link on the graph canvas', () => {
    const selection = selectAllGraphElements(graph())
    expect([...selection.nodeIds]).toEqual(['a', 'b', 'c', 'd', 'target'])
    expect([...selection.linkIds]).toEqual(['a-target', 'b-target', 'c-b'])
  })

  it('consolidates all incoming links when a second upstream connection is merged', () => {
    const result = mergeAgentSourceIntoTarget(graph(), 'd', 'target')
    expect(result.issue).toBeUndefined()
    expect(result.graph?.links.filter((link) => link.targetId === 'target')).toEqual([
      { id: 'a-target', sourceIds: ['a', 'b', 'd'], targetId: 'target', type: 'merge' }
    ])
    expect(result.graph?.links).toHaveLength(2)
  })

  it('renames an automatically named merge target', () => {
    const value = graph()
    const target = value.nodes.target
    if (target?.type !== 'agent') throw new Error('missing target')
    value.nodes.target = { ...target, name: 'Agent 5', nameCustomized: false }
    expect(mergeAgentSourceIntoTarget(value, 'd', 'target').graph?.nodes.target?.name).toBe('合并 Agent 5')
  })

  it('rejects a merge when the new source is already the only upstream source', () => {
    const singleIncoming = { ...graph(), links: graph().links.filter((link) => link.id !== 'b-target') }
    expect(mergeAgentSourceIntoTarget(singleIncoming, 'a', 'target').issue).toBe('merge-needs-sources')
  })

  it('merges Result nodes from local agents as direct sources', () => {
    const value = graphDefinitionSchema.parse({
      version: 1,
      name: 'Result merge',
      goal: 'Merge local reviewer results',
      nodes: {
        reviewerA: { ...agent('Reviewer A', 0, 0), provider: 'agent-tool:codex' },
        resultA: { type: 'output', name: 'Result', ownerAgentId: 'reviewerA', directory: '.flow/agent-results/reviewerA', note: '', extractText: true },
        reviewerB: { ...agent('Reviewer B', 0, 180), provider: 'agent-tool:codex' },
        resultB: { type: 'output', name: 'Result', ownerAgentId: 'reviewerB', directory: '.flow/agent-results/reviewerB', note: '', extractText: true },
        target: agent('Merge Agent', 600, 90)
      },
      links: [{ id: 'result-a-target', sourceId: 'resultA', targetId: 'target', type: 'input' }]
    })
    const result = mergeAgentSourceIntoTarget(value, 'resultB', 'target')
    expect(result.issue).toBeUndefined()
    expect(result.graph?.links).toEqual([
      { id: 'result-a-target', sourceIds: ['resultA', 'resultB'], targetId: 'target', type: 'merge' }
    ])
    expect(() => graphDefinitionSchema.parse(result.graph)).not.toThrow()
  })

  it('preserves multiple input links while consolidating agent sources', () => {
    const withInputs = graphDefinitionSchema.parse({
      ...graph(),
      nodes: {
        ...graph().nodes,
        inputA: input('Input A', -200, 0),
        inputB: input('Input B', -200, 80)
      },
      links: [
        ...graph().links,
        { id: 'input-a-target', sourceId: 'inputA', targetId: 'target', type: 'input' },
        { id: 'input-b-target', sourceId: 'inputB', targetId: 'target', type: 'input' }
      ]
    })
    const result = mergeAgentSourceIntoTarget(withInputs, 'd', 'target')
    expect(result.issue).toBeUndefined()
    expect(result.graph?.links.filter((link) => link.targetId === 'target' && link.type === 'input')).toHaveLength(2)
    expect(result.graph?.links.filter((link) => link.targetId === 'target' && link.type === 'merge')).toEqual([
      { id: 'a-target', sourceIds: ['a', 'b', 'd'], targetId: 'target', type: 'merge' }
    ])
  })

  it('persists a group and removes deleted nodes from it', () => {
    const grouped = groupSelectedNodes(graph(), new Set(['a', 'b']), 'group-1', 'Review team')
    expect(grouped.graph?.groups).toEqual([{ id: 'group-1', name: 'Review team', nodeIds: ['a', 'b'] }])
    const deleted = deleteGraphSelection(grouped.graph!, new Set(['a']), new Set())
    expect(deleted.groups).toEqual([])
    expect(deleted.links.some((link) => linkSourceIdsForTest(link).includes('a'))).toBe(false)
  })

  it('moves, renames and ungroups a group as one unit', () => {
    const grouped = groupSelectedNodes(graph(), new Set(['a', 'b']), 'group-1', 'Review team')
    const moved = moveGraphGroup(grouped.graph!, 'group-1', { x: 40, y: -10 })
    expect(moved.graph?.nodes.a?.position).toEqual({ x: 40, y: -10 })
    expect(moved.graph?.nodes.b?.position).toEqual({ x: 140, y: 10 })
    const renamed = renameGraphGroup(moved.graph!, 'group-1', 'Core team')
    expect(renamed.graph?.groups?.[0]?.name).toBe('Core team')
    expect(ungroupGraphNodes(renamed.graph!, 'group-1').graph?.groups).toEqual([])
  })
})

function linkSourceIdsForTest(link: GraphDefinition['links'][number]) {
  return link.type === 'merge' ? link.sourceIds : [link.sourceId]
}

function agent(name: string, x: number, y: number) {
  return {
    type: 'agent' as const,
    name,
    provider: 'fake',
    model: 'v1',
    prompts: {
      system: { content: '', customized: false, locked: false },
      input: { content: '', customized: false, locked: false },
      output: { content: '', customized: false, locked: false }
    },
    position: { x, y }
  }
}

function input(name: string, x: number, y: number) {
  return {
    type: 'input' as const,
    name,
    items: [],
    position: { x, y }
  }
}
