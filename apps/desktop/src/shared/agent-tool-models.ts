import type { AgentToolConfigurationInput } from './llm'

type ToolModels = Pick<AgentToolConfigurationInput, 'models' | 'model' | 'disabledModels'>

export function agentToolModelChoices(tool: ToolModels) {
  return [...new Set(['@tool-default', ...tool.models, ...(tool.model ? [tool.model] : [])])]
}

export function enabledAgentToolModels(tool: ToolModels) {
  const disabled = new Set(tool.disabledModels ?? [])
  return agentToolModelChoices(tool).filter(model => !disabled.has(model))
}
