import { describe, expect, it } from 'vitest'
import { graphDefinitionSchema } from '@agentflow/schema'
import type { ProviderCatalogGroup } from '@agentflow/core'
import {
  buildFlowGenerationMessages,
  buildGeneratedFlow,
  flowGenerationInputSummary,
  parseFlowGenerationResponse,
  type FlowGenerationResponse
} from './flow-generation'

const catalog: ProviderCatalogGroup[] = [{
  id: 'openrouter',
  name: 'OpenRouter',
  connector: 'model',
  configured: true,
  models: [{
    providerId: 'openrouter',
    providerName: 'OpenRouter',
    modelId: 'deepseek/deepseek-v4-flash-0731',
    modelName: 'DeepSeek V4 Flash 0731',
    connector: 'model',
    configured: true,
    parameters: { temperature: true, topP: true, maxTokens: true, reasoning: true, reasoningLevels: ['low', 'medium', 'high'] }
  }]
}]

const catalogWithCodex: ProviderCatalogGroup[] = [{
  id: 'agent-tool:codex',
  name: 'Codex',
  connector: 'agent-tool',
  configured: true,
  models: [{
    providerId: 'agent-tool:codex',
    providerName: 'Codex',
    modelId: 'gpt-5.6-sol',
    modelName: 'GPT-5.6 Sol',
    connector: 'agent-tool',
    configured: true,
    parameters: { temperature: false, topP: false, maxTokens: false, reasoning: true, reasoningLevels: ['low', 'medium', 'high'] }
  }]
}, ...catalog]

const current = graphDefinitionSchema.parse({
  version: 1,
  name: 'Existing Flow',
  goal: '旧目标',
  nodes: {
    source: {
      type: 'input',
      name: '访谈记录',
      executionMode: 'for-each',
      orderMode: 'manual',
      items: [{ id: 'doc-1', name: '01.txt', kind: 'text', mode: 'text', content: `用户反馈需要更清晰的导航。\n${'x'.repeat(8_000)}\nTAIL_SHOULD_NOT_APPEAR` }]
    },
    oldAgent: {
      type: 'agent',
      name: '旧 Agent',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash-0731',
      prompts: {
        system: { content: '', customized: false, locked: false },
        input: { content: '', customized: false, locked: false },
        output: { content: '', customized: false, locked: false }
      }
    }
  },
  links: [{ id: 'old-link', sourceId: 'source', targetId: 'oldAgent', type: 'input' }]
})

const response: FlowGenerationResponse = {
  flow: { name: '访谈洞察 Flow', goal: '逐份提炼访谈洞察并完成证据审查' },
  agents: [
    { name: '洞察分析', system: '提炼可验证的用户洞察。', input: '读取访谈材料并标明证据。', output: '输出主题、证据和影响。' },
    { name: '证据审查', system: '独立审查每条结论。', input: '检查所提供洞察的证据完整性。', output: '输出修订后的完整洞察清单。' }
  ],
  routes: [
    { inputSources: [0], target: 0 },
    { agentSources: [0], target: 1, relation: 'review' }
  ]
}

describe('flow generation', () => {
  it('uses bounded Input excerpts as context', () => {
    const messages = buildFlowGenerationMessages('整理访谈并审查证据', current)
    expect(messages).toHaveLength(2)
    expect(messages[1]?.content).toContain('整理访谈并审查证据')
    expect(messages[1]?.content).toContain('用户反馈需要更清晰的导航')
    expect(messages[1]?.content).not.toContain('TAIL_SHOULD_NOT_APPEAR')
    expect(messages[1]?.content).toContain('"inputs"')
    expect(messages[1]?.content).not.toContain('orderMode')
    expect(messages[1]?.content).not.toContain('providerId')
    expect(messages[1]?.content).not.toContain('models')
    expect(messages[0]?.content).not.toContain('modelRef')
    expect(messages[0]?.content).not.toContain('1 to 8')
    expect(messages[0]?.content).toContain('{"agentSources":[1,2],"target":3}')
    expect(messages[0]?.content).toContain('Do not connect worker 0 directly to worker 3')
    expect(flowGenerationInputSummary(current)).toMatchObject({ inputCount: 1, itemCount: 1, truncated: true })
  })

  it('uses only the description when the current Flow has no Input', () => {
    const empty = graphDefinitionSchema.parse({ version: 1, name: 'Empty', goal: 'Empty', nodes: {}, links: [] })
    const messages = buildFlowGenerationMessages('做一个研究 Flow', empty)
    expect(messages[1]?.content).not.toContain('"inputs"')
    expect(messages[1]?.content).not.toContain('placeholder')
    expect(flowGenerationInputSummary(empty)).toEqual({ inputCount: 0, itemCount: 0, includedChars: 0, truncated: false })
  })

  it('parses, validates and applies a generated DAG while preserving Inputs', () => {
    const parsed = parseFlowGenerationResponse(`Result:\n${JSON.stringify(response)}`, current)
    let sequence = 0
    const graph = buildGeneratedFlow(current, parsed, catalog, (prefix) => `${prefix}_${++sequence}`)
    expect(graph.name).toBe('访谈洞察 Flow')
    expect(graph.nodes.source).toMatchObject({ type: 'input', name: '访谈记录', executionMode: 'for-each', orderMode: 'manual' })
    expect(graph.nodes.oldAgent).toBeUndefined()
    expect(Object.values(graph.nodes).filter((node) => node.type === 'agent')).toHaveLength(2)
    expect(graph.links.map((link) => link.type)).toEqual(['input', 'review'])
    expect(() => graphDefinitionSchema.parse(graph)).not.toThrow()
  })

  it('extends an existing Flow without changing its current Agents, Links or metadata', () => {
    const extension: FlowGenerationResponse = {
      agents: [{ name: '后续验证', system: '验证已有结果。', input: '读取现有 Agent 的输出。', output: '输出验证结论。' }],
      routes: [{ existingAgentSources: [0], target: 0, relation: 'review' }]
    }
    const messages = buildFlowGenerationMessages('在现有分析后增加验证', current, 'extend')
    expect(messages[0]?.content).toContain('existingAgentSources')
    expect(messages[1]?.content).toContain('"existingFlow"')
    expect(messages[1]?.content).toContain('旧 Agent')
    const parsed = parseFlowGenerationResponse(JSON.stringify(extension), current, 'extend')
    let sequence = 0
    const extended = buildGeneratedFlow(current, parsed, catalog, (prefix) => `${prefix}_${++sequence}`, 'extend')
    expect(extended.name).toBe('Existing Flow')
    expect(extended.goal).toBe('旧目标')
    expect(extended.nodes.oldAgent).toEqual(current.nodes.oldAgent)
    expect(extended.links).toEqual(expect.arrayContaining([current.links[0]!]))
    expect(Object.values(extended.nodes).filter((node) => node.type === 'agent')).toHaveLength(2)
    expect(extended.links.some((link) => link.type === 'review' && link.targetId !== 'oldAgent')).toBe(true)
  })

  it('creates one empty Input when none exists', () => {
    const empty = graphDefinitionSchema.parse({ version: 1, name: 'Empty', goal: 'Empty', nodes: {}, links: [] })
    const withoutExistingInput = { ...response, routes: [{ inputSources: [0], target: 0 }, { agentSources: [0], target: 1, relation: 'review' as const }] }
    let sequence = 0
    const graph = buildGeneratedFlow(empty, withoutExistingInput, catalog, (prefix) => `${prefix}_${++sequence}`)
    const inputs = Object.values(graph.nodes).filter((node) => node.type === 'input')
    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toMatchObject({ name: '任务输入', items: [] })
  })

  it('adds a bound Result to every generated Codex agent and merges the two reviewer Results', () => {
    const codexResponse: FlowGenerationResponse = {
      flow: { name: '双评审 Flow', goal: '生成内容，经两个独立评审后合并' },
      agents: [
        { name: '生成 Agent', system: '生成初稿。', input: '读取输入。', output: '输出初稿。' },
        { name: 'Reviewer A', system: '独立评审初稿。', input: '检查事实。', output: '输出评审意见。' },
        { name: 'Reviewer B', system: '独立评审初稿。', input: '检查结构。', output: '输出评审意见。' },
        { name: 'Merge Agent', system: '合并两份评审。', input: '读取两份直接上游评审。', output: '输出合并结论。' }
      ],
      routes: [
        { inputSources: [0], target: 0 },
        { agentSources: [0], target: 1, relation: 'review' },
        { agentSources: [0], target: 2, relation: 'review' },
        { agentSources: [1, 2], target: 3 }
      ]
    }
    let sequence = 0
    const graph = buildGeneratedFlow(current, codexResponse, catalogWithCodex, (prefix) => `${prefix}_${++sequence}`)
    const agents = Object.entries(graph.nodes).filter((entry): entry is [string, Extract<typeof entry[1], { type: 'agent' }>] => entry[1].type === 'agent')
    const outputs = Object.entries(graph.nodes).filter((entry): entry is [string, Extract<typeof entry[1], { type: 'output' }>] => entry[1].type === 'output')
    expect(agents).toHaveLength(4)
    expect(outputs).toHaveLength(4)
    expect(new Set(outputs.map(([, output]) => output.ownerAgentId))).toEqual(new Set(agents.map(([id]) => id)))
    const merge = graph.links.find((link) => link.type === 'merge')
    expect(merge?.type).toBe('merge')
    if (merge?.type !== 'merge') throw new Error('missing Merge')
    expect(merge.sourceIds).toHaveLength(2)
    expect(merge.sourceIds.map((id) => graph.nodes[id]?.type)).toEqual(['output', 'output'])
    expect(merge.sourceIds.map((id) => graph.nodes[id]?.type === 'output' ? graph.nodes[graph.nodes[id].ownerAgentId]?.name : '')).toEqual(['Reviewer A', 'Reviewer B'])
    expect(graph.nodes[merge.targetId]?.name).toBe('Merge Agent')
    expect(() => graphDefinitionSchema.parse(graph)).not.toThrow()
  })

  it('rejects one-source Merge syntax and split worker routes to the same target', () => {
    const oneSourceMerge = { ...response, routes: [{ inputSources: [0], target: 0 }, { agentSources: [0], target: 1 }] }
    expect(() => parseFlowGenerationResponse(JSON.stringify(oneSourceMerge), current)).toThrow('不能创建合并')
    const splitMerge = {
      ...response,
      agents: [...response.agents, { name: '第二审查', system: '独立审查。', input: '读取材料。', output: '输出意见。' }],
      routes: [
        { inputSources: [0], target: 0 },
        { agentSources: [0], target: 1, relation: 'review' },
        { agentSources: [0], target: 2, relation: 'review' },
        { agentSources: [1], target: 0, relation: 'pass' },
        { agentSources: [2], target: 0, relation: 'pass' }
      ]
    }
    expect(() => parseFlowGenerationResponse(JSON.stringify(splitMerge), current)).toThrow('同一条合并')
  })

  it('assigns the local default model and rejects cyclic output', () => {
    const parsed = parseFlowGenerationResponse(JSON.stringify(response), current)
    let defaultSequence = 0
    const generated = buildGeneratedFlow(current, parsed, catalog, (prefix) => `${prefix}_${++defaultSequence}`)
    expect(Object.values(generated.nodes).filter((node) => node.type === 'agent').every((node) => node.type === 'agent' && node.provider === 'openrouter' && node.model === 'deepseek/deepseek-v4-flash-0731')).toBe(true)
    const cyclic: FlowGenerationResponse = {
      ...response,
      routes: [
        { inputSources: [0], target: 0 },
        { agentSources: [1], target: 0, relation: 'revise' },
        { agentSources: [0], target: 1, relation: 'review' }
      ]
    }
    let sequence = 0
    expect(() => buildGeneratedFlow(current, cyclic, catalog, (prefix) => `${prefix}_${++sequence}`)).toThrow('DAG')
  })
})
