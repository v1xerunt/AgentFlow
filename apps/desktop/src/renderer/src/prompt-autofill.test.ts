import { describe, expect, it } from 'vitest'
import { graphDefinitionSchema } from '@agentflow/schema'
import {
  addLinkWithPromptDefaultsDetailed,
  applyPromptAutofill,
  buildPromptAutofillMessages,
  DEFAULT_LINK_INPUT_PROMPT,
  parsePromptAutofillResponse,
  updateLinkTypeWithPromptDefaults,
  updateLinkTypeWithPromptDefaultsDetailed
} from './prompt-autofill'

const graph = graphDefinitionSchema.parse({
  version: 1,
  name: 'Prompt graph',
  goal: '完成产品评审',
  nodes: {
    planner: {
      type: 'agent',
      name: 'Planner',
      provider: 'OpenAI',
      model: 'GPT-5',
      prompts: {
        system: { content: '用户自定义角色', customized: true, locked: false },
        input: { content: '锁定输入', customized: true, locked: true },
        output: { content: '', customized: false, locked: false }
      }
    }
  },
  links: []
})

function makeGraph() {
  return graphDefinitionSchema.parse({
    version: 1,
    name: 'Linked prompts',
    goal: '完成产品评审',
    nodes: {
      planner: graph.nodes.planner,
      reviewer: {
        type: 'agent',
        name: 'Reviewer',
        provider: 'OpenAI',
        model: 'GPT-5',
        prompts: {
          system: { content: '', customized: false, locked: false },
          input: { content: '', customized: false, locked: false },
          output: { content: '', customized: false, locked: false }
        }
      }
    },
    links: [{ id: 'planner-reviewer', sourceId: 'planner', targetId: 'reviewer', type: 'review' }]
  })
}

it('updates only downstream default prompts when a Link relation changes', () => {
  const graph = makeGraph()
  const upstream = graph.nodes.planner
  const downstreamBefore = graph.nodes.reviewer
  const updated = updateLinkTypeWithPromptDefaults(graph, 'planner-reviewer', 'revise')
  const downstreamAfter = updated.nodes.reviewer
  expect(updated.nodes.planner).toEqual(upstream)
  if (downstreamAfter?.type !== 'agent' || downstreamBefore?.type !== 'agent') throw new Error('missing reviewer')
  expect(downstreamAfter.prompts.system.content).toContain('修订')
  expect(downstreamAfter.prompts.system.content).toContain('可直接替换上游版本')
  expect(downstreamAfter.prompts.input.content).toBe(DEFAULT_LINK_INPUT_PROMPT())
  expect(downstreamAfter.prompts.input.content).not.toBe(downstreamBefore.prompts.input.content)
  expect(updateLinkTypeWithPromptDefaultsDetailed(graph, 'planner-reviewer', 'revise').promptDefaults).toBe('updated')
})

it('generates a semantic Pass prompt as soon as a Link is created', () => {
  const graph = makeGraph()
  const withoutLinks = { ...graph, links: [] }
  const result = addLinkWithPromptDefaultsDetailed(withoutLinks, {
    id: 'planner-reviewer',
    sourceId: 'planner',
    targetId: 'reviewer',
    type: 'pass'
  })
  const reviewer = result.graph.nodes.reviewer
  if (reviewer?.type !== 'agent') throw new Error('missing reviewer')
  expect(result.promptDefaults).toBe('updated')
  expect(reviewer.prompts.system.content).toContain('传递 · 承接 Planner 的输出作为上游成果')
  expect(reviewer.prompts.system.content).toContain('不重复上游已经完成的工作')
  expect(reviewer.prompts.input.content).toBe(DEFAULT_LINK_INPUT_PROMPT())
})

it('keeps Input material out of system instructions and handles an empty Flow goal', () => {
  const initial = makeGraph()
  initial.goal = ''
  initial.links = []
  initial.nodes.input = { type: 'input', name: '输入 1', items: [] }
  const result = addLinkWithPromptDefaultsDetailed(initial, { id: 'material', sourceId: 'input', targetId: 'reviewer', type: 'input' })
  const reviewer = result.graph.nodes.reviewer
  if (reviewer?.type !== 'agent') throw new Error('missing reviewer')
  expect(reviewer.prompts.system.content).not.toContain('Input ·')
  expect(reviewer.prompts.system.content).not.toContain('围绕“”')
  expect(reviewer.prompts.input.content).toBe(DEFAULT_LINK_INPUT_PROMPT())
  const payload = JSON.parse(buildPromptAutofillMessages(result.graph)[1]!.content.toString().split('\n').slice(1).join('\n'))
  expect(payload.flow.draft.goal).toBe('')
  expect(payload.flow.context).not.toHaveProperty('goal')
})

it('uses review semantics instead of only labeling the upstream relation', () => {
  const linked = makeGraph()
  const result = addLinkWithPromptDefaultsDetailed({ ...linked, links: [] }, linked.links[0]!)
  const reviewer = result.graph.nodes.reviewer
  if (reviewer?.type !== 'agent') throw new Error('missing reviewer')
  expect(reviewer.prompts.system.content).toContain('核对正确性、完整性、证据与约束')
  expect(reviewer.prompts.system.content).toContain('问题、风险和可执行的改进建议')
  expect(reviewer.prompts.input.content).toBe(DEFAULT_LINK_INPUT_PROMPT())
})

it('preserves a customized downstream prompt when a Link relation changes', () => {
  const graph = makeGraph()
  const reviewer = graph.nodes.reviewer
  if (reviewer?.type !== 'agent') throw new Error('missing reviewer')
  const customized = {
    ...graph,
    nodes: {
      ...graph.nodes,
      reviewer: {
        ...reviewer,
        prompts: {
          ...reviewer.prompts,
          input: { content: '保持我的输入约定', customized: true, locked: false }
        }
      }
    }
  }
  const updated = updateLinkTypeWithPromptDefaults(customized, 'planner-reviewer', 'revise')
  const nextReviewer = updated.nodes.reviewer
  if (nextReviewer?.type !== 'agent') throw new Error('missing reviewer')
  expect(nextReviewer.prompts.input.content).toBe('保持我的输入约定')
  expect(nextReviewer.prompts.input.customized).toBe(true)
  expect(nextReviewer.prompts.system.content).toContain('修订')
  expect(updateLinkTypeWithPromptDefaultsDetailed(customized, 'planner-reviewer', 'revise').promptDefaults).toBe('updated')
})

it('preserves a locked downstream default prompt when a Link relation changes', () => {
  const graph = makeGraph()
  const reviewer = graph.nodes.reviewer
  if (reviewer?.type !== 'agent') throw new Error('missing reviewer')
  const locked = {
    ...graph,
    nodes: {
      ...graph.nodes,
      reviewer: {
        ...reviewer,
        prompts: {
          ...reviewer.prompts,
          input: { content: '锁定的默认输入', customized: false, locked: true }
        }
      }
    }
  }
  const result = updateLinkTypeWithPromptDefaultsDetailed(locked, 'planner-reviewer', 'revise')
  const nextReviewer = result.graph.nodes.reviewer
  if (nextReviewer?.type !== 'agent') throw new Error('missing reviewer')
  expect(result.promptDefaults).toBe('updated')
  expect(nextReviewer.prompts.input.content).toBe('锁定的默认输入')
  expect(nextReviewer.prompts.system.content).toContain('修订')
})

it('preserves protected System and Input prompts without reporting an update', () => {
  const graph = makeGraph()
  const reviewer = graph.nodes.reviewer
  if (reviewer?.type !== 'agent') throw new Error('missing reviewer')
  const protectedGraph = {
    ...graph,
    nodes: {
      ...graph.nodes,
      reviewer: {
        ...reviewer,
        prompts: {
          ...reviewer.prompts,
          system: { content: '自定义系统指令', customized: true, locked: false },
          input: { content: '锁定输入指令', customized: false, locked: true }
        }
      }
    }
  }
  const result = updateLinkTypeWithPromptDefaultsDetailed(protectedGraph, 'planner-reviewer', 'revise')
  const nextReviewer = result.graph.nodes.reviewer
  if (nextReviewer?.type !== 'agent') throw new Error('missing reviewer')
  expect(result.promptDefaults).toBe('protected')
  expect(nextReviewer.prompts.system.content).toBe('自定义系统指令')
  expect(nextReviewer.prompts.input.content).toBe('锁定输入指令')
})

describe('prompt autofill', () => {
  const response = {
    flow: {},
    agents: [
      { id: 'planner', name: 'Planner', system: '优化后的策划角色', output: '给出完整策划案' },
      { id: 'reviewer', name: 'Reviewer', system: '独立审查交付内容', input: '检查所提供的方案', output: '输出问题与修改建议' }
    ]
  }

  it('sends graph structure and authored prompts while omitting default prompt text', () => {
    const linked = makeGraph()
    const reviewer = linked.nodes.reviewer
    if (reviewer?.type !== 'agent') throw new Error('missing reviewer')
    const withDefaultMarker = {
      ...linked,
      nodes: {
        ...linked.nodes,
        reviewer: {
          ...reviewer,
          prompts: { ...reviewer.prompts, system: { content: '不应发送的默认内容', customized: false, locked: false } }
        }
      }
    }
    const messages = buildPromptAutofillMessages(withDefaultMarker)
    expect(messages).toHaveLength(2)
    expect(typeof messages[0]?.content === 'string' && messages[0].content.startsWith('You are a prompt architect for a multi-agent framework.')).toBe(true)
    expect(messages[0]?.content).toContain('Each worker receives only its own instructions')
    expect(messages[1]?.content).toContain('用户自定义角色')
    expect(messages[1]?.content).toContain('锁定输入')
    expect(messages[1]?.content).not.toContain('不应发送的默认内容')
    expect(messages[1]?.content).toContain('"relation":"review"')
    expect(messages[1]?.content).toContain('"id":"planner"')
    expect(messages[1]?.content).toContain('"id":"reviewer"')
    expect(messages[1]?.content).not.toContain('nameIsDefault')
    expect(messages[1]?.content).not.toContain('lockedPromptFields')
  })

  it('truncates long Input content before sending it to the model', () => {
    const linked = makeGraph()
    const longInput = Array.from({ length: 30 }, (_, index) => `line-${index}-${'x'.repeat(300)}`).join('\n')
    const withInput = graphDefinitionSchema.parse({
      ...linked,
      nodes: {
        ...linked.nodes,
        source: { type: 'input', name: 'Research', items: [{ id: 'item', name: 'large.txt', kind: 'text', mode: 'text', content: longInput }] }
      },
      links: [...linked.links, { id: 'source-planner', sourceId: 'source', targetId: 'planner', type: 'input' }]
    })
    const payloadText = buildPromptAutofillMessages(withInput)[1]?.content ?? ''
    expect(payloadText).toContain('"truncated":true')
    expect(payloadText).toContain('line-0-')
    expect(payloadText).not.toContain('line-20-')
    expect(payloadText.length).toBeLessThan(longInput.length)
  })

  it('parses fenced JSON by Agent id and retains valid partial results', () => {
    const linked = makeGraph()
    expect(parsePromptAutofillResponse(`\`\`\`json\n${JSON.stringify(response)}\n\`\`\``, linked)).toEqual(response)
    expect(parsePromptAutofillResponse(`Schema example: {"flow":{},"agents":[]}\nResult:\n${JSON.stringify(response)}`, linked)).toEqual(response)
    const partial = parsePromptAutofillResponse(JSON.stringify({ flow: response.flow, agents: [response.agents[1], { id: 'unknown', system: 'ignore' }] }), linked)
    expect(partial.agents).toEqual([response.agents[1]])
    const applied = applyPromptAutofill(linked, partial)
    expect(applied.graph.nodes.planner).toEqual(linked.nodes.planner)
    expect(applied.graph.nodes.reviewer?.type === 'agent' ? applied.graph.nodes.reviewer.prompts.system.content : '').toBe('独立审查交付内容')
  })

  it('updates every unlocked field but never overwrites a locked prompt', () => {
    const result = applyPromptAutofill(makeGraph(), response)
    const planner = result.graph.nodes.planner
    if (planner?.type !== 'agent') throw new Error('missing planner')
    expect(planner.prompts.system.content).toBe('优化后的策划角色')
    expect(planner.prompts.system.customized).toBe(true)
    expect(planner.prompts.input.content).toBe('锁定输入')
    expect(result.protectedLocked).toBe(1)
    expect(result.changed).toBe(5)
    expect(result.graph.name).toBe('Linked prompts')
    expect(result.graph.goal).toBe('完成产品评审')
  })

  it('fills blank and default prompts while preserving customized unlocked prompts', () => {
    const linked = makeGraph()
    const reviewer = linked.nodes.reviewer
    if (reviewer?.type !== 'agent') throw new Error('missing reviewer')
    const withDefault = graphDefinitionSchema.parse({
      ...linked,
      nodes: {
        ...linked.nodes,
        reviewer: { ...reviewer, prompts: { ...reviewer.prompts, system: { content: '默认审查角色', customized: false, locked: false } } }
      }
    })
    const blankAndDefaultResponse = {
      flow: {},
      agents: [
        { id: 'planner', name: 'Planner', output: '只填写原本空白的输出' },
        { id: 'reviewer', name: 'Reviewer', system: '新的审查角色', input: '读取方案', output: '给出审查结果' }
      ]
    }
    const messages = buildPromptAutofillMessages(withDefault, 'blank-and-default')
    expect(messages[1]?.content).toContain('用户自定义角色')
    expect(messages[1]?.content).toContain('"fixed"')
    expect(messages[1]?.content).not.toContain('默认审查角色')
    const parsed = parsePromptAutofillResponse(JSON.stringify(blankAndDefaultResponse), withDefault, 'blank-and-default')
    const result = applyPromptAutofill(withDefault, parsed, 'blank-and-default')
    const planner = result.graph.nodes.planner
    const updatedReviewer = result.graph.nodes.reviewer
    if (planner?.type !== 'agent' || updatedReviewer?.type !== 'agent') throw new Error('missing agents')
    expect(planner.prompts.system.content).toBe('用户自定义角色')
    expect(planner.prompts.input.content).toBe('锁定输入')
    expect(planner.prompts.output.content).toBe('只填写原本空白的输出')
    expect(updatedReviewer.prompts.system.content).toBe('新的审查角色')
  })

  it('updates default Flow metadata and automatic Agent names', () => {
    const linked = makeGraph()
    const automatic = graphDefinitionSchema.parse({
      ...linked,
      name: 'Untitled Flow',
      goal: '',
      nodes: {
        ...linked.nodes,
        reviewer: { ...linked.nodes.reviewer, name: 'Agent 2', nameCustomized: false }
      }
    })
    const generated = {
      ...response,
      flow: { name: '产品方案评审', goal: '形成一份经过独立评审的完整产品方案' },
      agents: response.agents.map((agent, index) => index === 1 ? { ...agent, name: '方案审核' } : agent)
    }
    const result = applyPromptAutofill(automatic, generated)
    expect(result.graph.name).toBe('产品方案评审')
    expect(result.graph.goal).toBe('形成一份经过独立评审的完整产品方案')
    expect(result.graph.nodes.reviewer?.name).toBe('方案审核')
    expect(result.renamed).toBe(1)
    expect(result.flowChanged).toBe(2)
  })
})
