import { agentNodeSchema, agentParametersSchema, type AgentNodeDefinition } from '@agentflow/schema'
import { z } from 'zod'

export const agentLibrarySchema = z.object({
  version: z.literal(1),
  modelDefaults: z.record(agentParametersSchema),
  parameterPresets: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1), providerId: z.string().min(1), model: z.string().min(1), parameters: agentParametersSchema })),
  agents: z.array(z.object({ id: z.string().min(1), node: agentNodeSchema, createdAt: z.string() }))
})
export type AgentLibrary = z.infer<typeof agentLibrarySchema>
export type SavedAgent = AgentLibrary['agents'][number]
export const emptyAgentLibrary = (): AgentLibrary => ({ version: 1, modelDefaults: {}, parameterPresets: [], agents: [] })
export const modelParameterKey = (providerId: string, model: string) => JSON.stringify([providerId, model])

export function lockAgentTemplate(node: AgentNodeDefinition): AgentNodeDefinition {
  const copy = structuredClone(node)
  delete copy.position
  for (const prompt of Object.values(copy.prompts)) prompt.locked = true
  return copy
}
