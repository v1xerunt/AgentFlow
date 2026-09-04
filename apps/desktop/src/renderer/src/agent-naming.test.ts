import { describe, expect, it } from 'vitest'
import type { GraphDefinition } from '@agentflow/schema'
import { applyAutomaticAgentName, nextAgentName } from './agent-naming'

const prompts = { system: { content: '', customized: false, locked: false }, input: { content: '', customized: false, locked: false }, output: { content: '', customized: false, locked: false } }
const graph = (name: string, nameCustomized = false): GraphDefinition => ({ version: 1, name: 'Flow', goal: 'Goal', nodes: { a: { type: 'agent', name, nameCustomized, provider: 'openai', model: 'gpt-5.6', prompts } }, links: [] })

describe('agent naming', () => {
  it('allocates the first unused automatic number', () => {
    const value = graph('Agent 1')
    value.nodes.b = { type: 'agent', name: 'Reviewer Agent 3', nameCustomized: false, provider: 'openai', model: 'gpt-5.6', prompts }
    expect(nextAgentName(value)).toBe('Agent 2')
  })

  it('derives a role name from the incoming Link', () => {
    expect(applyAutomaticAgentName(graph('Agent 2'), 'a', 'review').nodes.a?.name).toBe('审核 Agent 2')
    expect(applyAutomaticAgentName(graph('Agent 2'), 'a', 'merge').nodes.a?.name).toBe('合并 Agent 2')
  })

  it('never overwrites a user name', () => {
    expect(applyAutomaticAgentName(graph('Agent 2', true), 'a', 'review').nodes.a?.name).toBe('Agent 2')
    expect(applyAutomaticAgentName(graph('My Agent'), 'a', 'review').nodes.a?.name).toBe('My Agent')
  })
})
