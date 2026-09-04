import { describe, expect, it } from 'vitest'
import { agentToolModelChoices, enabledAgentToolModels } from './agent-tool-models'

describe('local agent model choices', () => {
  it('enables every discovered model and the tool default on first use', () => {
    const tool = { models: ['opus', 'sonnet', 'opus'], model: 'opus[1m]' }
    expect(agentToolModelChoices(tool)).toEqual(['@tool-default', 'opus', 'sonnet', 'opus[1m]'])
    expect(enabledAgentToolModels(tool)).toEqual(agentToolModelChoices(tool))
  })
  it('keeps disabled models excluded while newly discovered models default to enabled', () => {
    expect(enabledAgentToolModels({ models: ['opus', 'sonnet'], disabledModels: ['@tool-default', 'opus'] })).toEqual(['sonnet'])
  })
})
