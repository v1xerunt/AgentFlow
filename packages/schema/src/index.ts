import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

const positionSchema = z.object({
  x: z.number(),
  y: z.number()
})

export const agentParametersSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.union([z.number().int().positive(), z.literal(-1), z.null()]).optional(),
  reasoningLevel: z.string().optional(),
  reasoningBudget: z.number().int().min(-1).optional(),
  topK: z.number().int().nonnegative().optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  seed: z.number().int().optional(),
  stopSequences: z.array(z.string().min(1)).max(4).optional(),
  verbosity: z.enum(['low', 'medium', 'high']).optional(),
  customParameters: z.record(z.string(), z.unknown()).optional()
})

export const inputItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['text', 'file']),
  mode: z.enum(['text', 'attachment']),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  content: z.string(),
  dataBase64: z.string().optional(),
  hidden: z.boolean().optional(),
  workspacePath: z.string().refine(value => !/^[\\/]/.test(value) && !/^[A-Za-z]:/.test(value) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value), 'Input file path must stay inside the workspace').optional()
})

export const inputNodeSchema = z.object({
  type: z.literal('input'),
  name: z.string().min(1),
  items: z.array(inputItemSchema).default([]),
  executionMode: z.enum(['all', 'for-each']).optional(),
  orderMode: z.enum(['name', 'manual']).optional(),
  position: positionSchema.optional()
})

export const agentPromptSchema = z.object({
  content: z.string(),
  customized: z.boolean().default(false),
  locked: z.boolean().default(false)
})

export const agentPromptsSchema = z.object({
  system: agentPromptSchema,
  input: agentPromptSchema,
  output: agentPromptSchema
})

const workspaceRelativePathSchema = z.string().min(1).refine(
  (value) => !/^[\\/]/.test(value) && !/^[A-Za-z]:[\\/]/.test(value) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value),
  'Output path must stay inside the workspace'
)

export const outputNodeSchema = z.object({
  type: z.literal('output'),
  name: z.string().min(1),
  ownerAgentId: z.string().min(1),
  directory: workspaceRelativePathSchema,
  note: z.string().default(''),
  extractText: z.boolean().default(true),
  fileStates: z.record(z.string(), z.record(z.string(), z.enum(['hidden', 'detached']))).optional(),
  position: positionSchema.optional()
})

export const agentNodeSchema = z.object({
  type: z.literal('agent'),
  name: z.string().min(1),
  nameCustomized: z.boolean().optional(),
  provider: z.string().min(1),
  model: z.string().min(1),
  parameters: agentParametersSchema.optional(),
  prompts: agentPromptsSchema,
  position: positionSchema.optional()
})

export const graphNodeSchema = z.discriminatedUnion('type', [
  inputNodeSchema,
  agentNodeSchema,
  outputNodeSchema
])

export const graphGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nodeIds: z.array(z.string().min(1)).min(2).refine(
    (nodeIds) => new Set(nodeIds).size === nodeIds.length,
    'Group nodes must be unique'
  )
})

export const linkRelationSchema = z.enum([
  'input',
  'pass',
  'review',
  'revise',
  'merge'
])

export const singleLinkRelationSchema = z.enum([
  'input',
  'pass',
  'review',
  'revise'
])

export const singleLinkSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: singleLinkRelationSchema
})

export const mergeLinkSchema = z.object({
  id: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(2).refine(
    (sourceIds) => new Set(sourceIds).size === sourceIds.length,
    'Merge sources must be unique'
  ),
  targetId: z.string().min(1),
  type: z.literal('merge')
})

export const linkSchema = z.union([singleLinkSchema, mergeLinkSchema])

export const workspaceBindingSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('directory'),
    rootPath: z.string().min(1)
  }),
  z.object({
    mode: z.literal('temporary'),
    tempId: z.string().min(1)
  })
])

export const projectDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  workspace: workspaceBindingSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

const graphDefinitionOutputSchema = z
  .object({
    version: z.literal(1),
    executionMode: z.literal('tutorial').optional(),
    name: z.string().min(1),
    goal: z.string(),
    groups: z.array(graphGroupSchema).optional(),
    nodes: z.record(z.string(), graphNodeSchema),
    links: z.array(linkSchema)
  })
  .superRefine((graph, context) => {
    const nodeIds = new Set(Object.keys(graph.nodes))
    const linkIds = new Set<string>()
    const linkPairs = new Set<string>()
    const groupedNodeIds = new Set<string>()
    const outputOwners = new Set<string>()

    for (const [nodeId, node] of Object.entries(graph.nodes)) {
      if (node.type !== 'output') continue
      const owner = graph.nodes[node.ownerAgentId]
      if (owner?.type !== 'agent' || !(owner.provider.startsWith('agent-tool:') || graph.executionMode === 'tutorial' && owner.provider === 'fake')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Output ${nodeId} must belong to a local agent tool`,
          path: ['nodes', nodeId, 'ownerAgentId']
        })
      }
      if (outputOwners.has(node.ownerAgentId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Agent ${node.ownerAgentId} may own only one output node`,
          path: ['nodes', nodeId, 'ownerAgentId']
        })
      }
      outputOwners.add(node.ownerAgentId)
    }

    for (const [groupIndex, group] of (graph.groups ?? []).entries()) {
      for (const nodeId of group.nodeIds) {
        if (!nodeIds.has(nodeId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Group ${group.id} references a missing node`,
            path: ['groups', groupIndex, 'nodeIds']
          })
        }
        if (groupedNodeIds.has(nodeId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Node ${nodeId} belongs to more than one group`,
            path: ['groups', groupIndex, 'nodeIds']
          })
        }
        groupedNodeIds.add(nodeId)
      }
    }

    for (const link of graph.links) {
      if (linkIds.has(link.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate link id: ${link.id}`,
          path: ['links']
        })
      }
      linkIds.add(link.id)

      const sourceIds = linkSourceIds(link)
      if (!sourceIds.every((sourceId) => nodeIds.has(sourceId)) || !nodeIds.has(link.targetId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Link ${link.id} references a missing node`,
          path: ['links']
        })
        continue
      }

      const target = graph.nodes[link.targetId]
      if (target?.type !== 'agent') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Link ${link.id} must target an agent`,
          path: ['links']
        })
      }
      for (const sourceId of sourceIds) {
        const pair = `${sourceId}\u0000${link.targetId}`
        if (linkPairs.has(pair)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate link: ${sourceId} -> ${link.targetId}`,
            path: ['links']
          })
        }
        linkPairs.add(pair)

        const source = graph.nodes[sourceId]
        if (
          (link.type === 'merge' && source?.type !== 'agent' && source?.type !== 'output') ||
          (link.type !== 'merge' && (source?.type === 'input' || source?.type === 'output') && link.type !== 'input') ||
          (link.type !== 'merge' && source?.type === 'agent' && link.type === 'input') ||
          (source?.type === 'agent' && outputOwners.has(sourceId))
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Link ${link.id} has an invalid relation for its source`,
            path: ['links']
          })
        }
      }
    }

    const indegree = new Map([...nodeIds].map((id) => [id, 0]))
    const outgoing = new Map([...nodeIds].map((id) => [id, [] as string[]]))

    for (const link of graph.links) {
      for (const sourceId of linkSourceIds(link)) {
        if (!nodeIds.has(sourceId) || !nodeIds.has(link.targetId)) continue
        indegree.set(link.targetId, (indegree.get(link.targetId) ?? 0) + 1)
        outgoing.get(sourceId)?.push(link.targetId)
      }
    }
    for (const [nodeId, node] of Object.entries(graph.nodes)) {
      if (node.type !== 'output' || !nodeIds.has(node.ownerAgentId)) continue
      indegree.set(nodeId, (indegree.get(nodeId) ?? 0) + 1)
      outgoing.get(node.ownerAgentId)?.push(nodeId)
    }

    const queue = [...indegree.entries()]
      .filter(([, degree]) => degree === 0)
      .map(([id]) => id)
    let visited = 0

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      visited += 1
      for (const target of outgoing.get(current) ?? []) {
        const next = (indegree.get(target) ?? 0) - 1
        indegree.set(target, next)
        if (next === 0) queue.push(target)
      }
    }

    if (visited !== nodeIds.size) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Graph must be a DAG',
        path: ['links']
      })
    }
  })

export const graphDefinitionSchema = z.preprocess(
  migrateLegacyGraph,
  graphDefinitionOutputSchema
)

export type InputItemDefinition = z.infer<typeof inputItemSchema>
export type InputNodeDefinition = z.infer<typeof inputNodeSchema>
export type AgentNodeDefinition = z.infer<typeof agentNodeSchema>
export type OutputNodeDefinition = z.infer<typeof outputNodeSchema>
export type AgentPromptDefinition = z.infer<typeof agentPromptSchema>
export type AgentPrompts = z.infer<typeof agentPromptsSchema>
export type AgentParameters = z.infer<typeof agentParametersSchema>
export type GraphNodeDefinition = z.infer<typeof graphNodeSchema>
export type GraphGroupDefinition = z.infer<typeof graphGroupSchema>
export type LinkRelation = z.infer<typeof linkRelationSchema>
export type SingleLinkRelation = z.infer<typeof singleLinkRelationSchema>
export type SingleLinkDefinition = z.infer<typeof singleLinkSchema>
export type MergeLinkDefinition = z.infer<typeof mergeLinkSchema>
export type LinkDefinition = z.infer<typeof linkSchema>
export type GraphDefinition = z.infer<typeof graphDefinitionSchema>
export type WorkspaceBinding = z.infer<typeof workspaceBindingSchema>
export type ProjectDefinition = z.infer<typeof projectDefinitionSchema>

export type LinkCandidateError =
  | 'missing-node'
  | 'self-link'
  | 'invalid-target'
  | 'invalid-input-relation'
  | 'merge-needs-sources'
  | 'merge-source-must-be-agent'
  | 'agent-output-required'
  | 'duplicate-link'
  | 'cycle'

export function validateLinkCandidate(
  graph: GraphDefinition,
  candidate: Pick<SingleLinkDefinition, 'sourceId' | 'targetId' | 'type'>,
  ignoreLinkId?: string
): LinkCandidateError | null {
  const source = graph.nodes[candidate.sourceId]
  const target = graph.nodes[candidate.targetId]

  if (!source || !target) return 'missing-node'
  if (candidate.sourceId === candidate.targetId) return 'self-link'
  if (target.type !== 'agent') return 'invalid-target'
  if ((source.type === 'input' || source.type === 'output') && candidate.type !== 'input') {
    return 'invalid-input-relation'
  }
  if (source.type === 'agent' && candidate.type === 'input') {
    return 'invalid-input-relation'
  }
  if (source.type === 'agent' && Object.values(graph.nodes).some((node) => node.type === 'output' && node.ownerAgentId === candidate.sourceId)) {
    return 'agent-output-required'
  }
  if (
    graph.links.some(
      (link) =>
        link.id !== ignoreLinkId &&
        linkSourceIds(link).includes(candidate.sourceId) &&
        link.targetId === candidate.targetId
    )
  ) {
    return 'duplicate-link'
  }

  const outgoing = new Map<string, string[]>()
  for (const nodeId of Object.keys(graph.nodes)) outgoing.set(nodeId, [])
  for (const link of graph.links) {
    if (link.id === ignoreLinkId) continue
    for (const sourceId of linkSourceIds(link)) {
      outgoing.get(sourceId)?.push(link.targetId)
    }
  }
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (node.type === 'output') outgoing.get(node.ownerAgentId)?.push(nodeId)
  }
  outgoing.get(candidate.sourceId)?.push(candidate.targetId)

  const stack = [candidate.targetId]
  const visited = new Set<string>()
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    if (current === candidate.sourceId) return 'cycle'
    visited.add(current)
    stack.push(...(outgoing.get(current) ?? []))
  }

  return null
}

export function validateMergeCandidate(
  graph: GraphDefinition,
  candidate: Pick<MergeLinkDefinition, 'sourceIds' | 'targetId'>,
  ignoreLinkId?: string
): LinkCandidateError | null {
  const sourceIds = [...new Set(candidate.sourceIds)]
  const target = graph.nodes[candidate.targetId]
  if (sourceIds.length < 2) return 'merge-needs-sources'
  if (!target || sourceIds.some((sourceId) => !graph.nodes[sourceId])) return 'missing-node'
  if (target.type !== 'agent') return 'invalid-target'
  if (sourceIds.includes(candidate.targetId)) return 'self-link'
  if (sourceIds.some((sourceId) => !['agent', 'output'].includes(graph.nodes[sourceId]?.type ?? ''))) {
    return 'merge-source-must-be-agent'
  }
  if (sourceIds.some((sourceId) => Object.values(graph.nodes).some((node) => node.type === 'output' && node.ownerAgentId === sourceId))) {
    return 'agent-output-required'
  }
  if (
    sourceIds.some((sourceId) =>
      graph.links.some(
        (link) =>
          link.id !== ignoreLinkId &&
          link.targetId === candidate.targetId &&
          linkSourceIds(link).includes(sourceId)
      )
    )
  ) {
    return 'duplicate-link'
  }

  const outgoing = new Map<string, string[]>()
  for (const nodeId of Object.keys(graph.nodes)) outgoing.set(nodeId, [])
  for (const link of graph.links) {
    if (link.id === ignoreLinkId) continue
    for (const sourceId of linkSourceIds(link)) outgoing.get(sourceId)?.push(link.targetId)
  }
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (node.type === 'output') outgoing.get(node.ownerAgentId)?.push(nodeId)
  }
  for (const sourceId of sourceIds) outgoing.get(sourceId)?.push(candidate.targetId)

  for (const sourceId of sourceIds) {
    const stack = [candidate.targetId]
    const visited = new Set<string>()
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current || visited.has(current)) continue
      if (current === sourceId) return 'cycle'
      visited.add(current)
      stack.push(...(outgoing.get(current) ?? []))
    }
  }

  return null
}

export function linkSourceIds(link: LinkDefinition): string[] {
  return link.type === 'merge' ? link.sourceIds : [link.sourceId]
}

export function linkHasSource(link: LinkDefinition, nodeId: string): boolean {
  return linkSourceIds(link).includes(nodeId)
}

function migrateLegacyGraph(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.nodes)) return value
  const addedOutputs: Array<[string, Record<string, unknown>]> = []
  const existingOutputOwners = new Set(Object.values(value.nodes).flatMap((node) => isRecord(node) && node.type === 'output' && typeof node.ownerAgentId === 'string' ? [node.ownerAgentId] : []))
  const usedNodeIds = new Set(Object.keys(value.nodes))
  const nextOutputId = (agentId: string) => {
    const base = `output_${agentId}`
    let outputId = base
    let index = 2
    while (usedNodeIds.has(outputId)) outputId = `${base}_${index++}`
    usedNodeIds.add(outputId)
    return outputId
  }
  const nodes = Object.fromEntries(Object.entries(value.nodes).map(([nodeId, candidate]) => {
    if (!isRecord(candidate)) return [nodeId, candidate]
    if (candidate.type === 'input' && !Array.isArray(candidate.items)) {
      const content = typeof candidate.content === 'string' ? candidate.content : ''
      return [nodeId, {
        ...candidate,
        items: content ? [{
          id: `text_${nodeId}`,
          name: '文本输入',
          kind: 'text',
          mode: 'text',
          content
        }] : []
      }]
    }
    let current = candidate
    if (candidate.type === 'agent' && !isRecord(candidate.prompts)) {
      const system = typeof candidate.basePrompt === 'string' ? candidate.basePrompt : ''
      const input = typeof candidate.graphRolePrompt === 'string' ? candidate.graphRolePrompt : ''
      const { basePrompt: _basePrompt, graphRolePrompt: _graphRolePrompt, ...rest } = candidate
      current = {
        ...rest,
        prompts: {
          system: { content: system, customized: Boolean(system), locked: false },
          input: { content: input, customized: Boolean(input), locked: false },
          output: { content: '', customized: false, locked: false }
        }
      }
    }
    if (current.type === 'agent' && !existingOutputOwners.has(nodeId) && typeof current.provider === 'string' && current.provider.startsWith('agent-tool:')) {
      addedOutputs.push([nextOutputId(nodeId), {
        type: 'output',
        name: 'Result',
        ownerAgentId: nodeId,
        directory: `.flow/agent-results/${nodeId}`,
        note: '',
        extractText: true,
        position: isRecord(current.position) && typeof current.position.x === 'number' && typeof current.position.y === 'number'
          ? { x: current.position.x + 360, y: current.position.y + 48 }
          : undefined
      }])
      existingOutputOwners.add(nodeId)
    }
    return [nodeId, current]
  }))
  for (const [nodeId, output] of addedOutputs) if (!nodes[nodeId]) nodes[nodeId] = output
  for (const [nodeId, candidate] of Object.entries(nodes)) {
    if (!isRecord(candidate) || candidate.type !== 'output' || typeof candidate.ownerAgentId !== 'string') continue
    nodes[nodeId] = { ...candidate, directory: `.flow/agent-results/${candidate.ownerAgentId}` }
  }
  return { ...value, nodes, links: migrateOwnedOutputLinks(value.links, nodes) }
}

function migrateOwnedOutputLinks(links: unknown, nodes: Record<string, unknown>): unknown {
  if (!Array.isArray(links)) return links
  const outputByOwner = new Map<string, string>()
  for (const [nodeId, candidate] of Object.entries(nodes)) {
    if (isRecord(candidate) && candidate.type === 'output' && typeof candidate.ownerAgentId === 'string') outputByOwner.set(candidate.ownerAgentId, nodeId)
  }
  const usedIds = new Set(links.flatMap((candidate) => isRecord(candidate) && typeof candidate.id === 'string' ? [candidate.id] : []))
  const nextId = (base: string) => {
    let id = base
    let index = 2
    while (usedIds.has(id)) id = `${base}-${index++}`
    usedIds.add(id)
    return id
  }
  return links.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.targetId !== 'string') return [candidate]
    if (candidate.type !== 'merge') {
      const outputId = typeof candidate.sourceId === 'string' ? outputByOwner.get(candidate.sourceId) : undefined
      return outputId ? [{ ...candidate, sourceId: outputId, type: 'input' }] : [candidate]
    }
    if (!Array.isArray(candidate.sourceIds)) return [candidate]
    const sourceIds = candidate.sourceIds.filter((sourceId): sourceId is string => typeof sourceId === 'string')
    const outputSources = sourceIds.flatMap((sourceId) => {
      const outputId = outputByOwner.get(sourceId)
      return outputId ? [outputId] : []
    })
    if (!outputSources.length) return [candidate]
    const remainingSources = sourceIds.filter((sourceId) => !outputByOwner.has(sourceId))
    const retained = remainingSources.length >= 2
      ? [{ ...candidate, sourceIds: remainingSources }]
      : remainingSources.length === 1
        ? [{ id: candidate.id, sourceId: remainingSources[0], targetId: candidate.targetId, type: 'pass' }]
        : []
    return [
      ...retained,
      ...outputSources.map((sourceId, index) => ({
        id: !retained.length && index === 0 ? candidate.id : nextId(`${candidate.id}-output`),
        sourceId,
        targetId: candidate.targetId,
        type: 'input'
      }))
    ]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseGraph(source: string): GraphDefinition {
  const value = parseYaml(source) as unknown
  return graphDefinitionSchema.parse(value)
}

export function formatValidationError(error: unknown): string {
  if (!(error instanceof z.ZodError)) {
    return error instanceof Error ? error.message : String(error)
  }

  return error.issues
    .map((issue) => `${issue.path.join('.') || 'graph'}: ${issue.message}`)
    .join('\n')
}
