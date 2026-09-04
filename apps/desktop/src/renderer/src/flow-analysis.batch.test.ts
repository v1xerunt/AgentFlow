import { describe, expect, it } from 'vitest'
import { graphDefinitionSchema } from '@agentflow/schema'
import { planBatchRuns } from './flow-analysis'

const item = (id: string) => ({ id, name: `${id}.txt`, kind: 'file' as const, mode: 'text' as const, content: id })
const graph = (rightCount = 2) => graphDefinitionSchema.parse({ version: 1, name: 'Batch', goal: 'pair files', nodes: {
  left: { type: 'input', name: 'Left', executionMode: 'for-each', items: [item('a'), item('b')] },
  right: { type: 'input', name: 'Right', executionMode: 'for-each', items: [item('x'), item('y')].slice(0, rightCount) },
  agent: { type: 'agent', name: 'Agent', provider: 'fake', model: 'fake', prompts: { system: { content: '' }, input: { content: '' }, output: { content: '' } } }
}, links: [{ id: 'l1', sourceId: 'left', targetId: 'agent', type: 'input' }, { id: 'l2', sourceId: 'right', targetId: 'agent', type: 'input' }] })

describe('batch input planning', () => {
  it('pairs file groups row by row', () => {
    const plan = planBatchRuns(graph())
    expect(plan.batchSize).toBe(2)
    expect(plan.graphs.map((candidate) => [candidate.nodes.left, candidate.nodes.right].map((node) => node?.type === 'input' ? node.items[0]?.name : ''))).toEqual([['a.txt', 'x.txt'], ['b.txt', 'y.txt']])
  })

  it('blocks unequal file group lengths with exact counts', () => {
    expect(planBatchRuns(graph(1)).issues).toEqual(['批量输入数量必须一致：Left 2 项，Right 1 项'])
  })
})
