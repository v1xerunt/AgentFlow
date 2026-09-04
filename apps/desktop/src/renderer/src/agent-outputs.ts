import { t } from '@agentflow/core/localization'
import { graphDefinitionSchema, type AgentNodeDefinition, type GraphDefinition, type OutputNodeDefinition } from '@agentflow/schema'

export function defaultAgentOutputNode(agentId: string, agent: AgentNodeDefinition): OutputNodeDefinition {
  return {
    type: 'output',
    name: t('Result'),
    ownerAgentId: agentId,
    directory: `.flow/agent-results/${agentId}`,
    note: '',
    extractText: true,
    position: { x: (agent.position?.x ?? 0) + 360, y: (agent.position?.y ?? 0) + 48 }
  }
}

export function ownedOutputEntry(graph: GraphDefinition, agentId: string): [string, OutputNodeDefinition] | undefined {
  return Object.entries(graph.nodes).find((entry): entry is [string, OutputNodeDefinition] => entry[1].type === 'output' && entry[1].ownerAgentId === agentId)
}

export function artifactNodeIdForAgent(graph: GraphDefinition, agentId: string) {
  return ownedOutputEntry(graph, agentId)?.[0] ?? agentId
}

export function reconcileAgentToolOutput(graph: GraphDefinition, agentId: string): GraphDefinition {
  const agent = graph.nodes[agentId]
  if (agent?.type !== 'agent') return graph
  const existing = ownedOutputEntry(graph, agentId)
  if (agent.provider.startsWith('agent-tool:')) {
    if (existing) return graphDefinitionSchema.parse(graph)
    const outputId = outputNodeId(graph, agentId)
    return graphDefinitionSchema.parse({ ...graph, nodes: { ...graph.nodes, [outputId]: defaultAgentOutputNode(agentId, agent) } })
  }
  return existing ? removeOwnedOutput(graph, agentId) : graph
}

function removeOwnedOutput(graph: GraphDefinition, agentId: string): GraphDefinition {
  const entry = ownedOutputEntry(graph, agentId)
  if (!entry) return graph
  const [outputId] = entry
  const nodes = { ...graph.nodes }
  delete nodes[outputId]
  return {
    ...graph,
    nodes,
    links: graph.links.filter((link) => link.targetId !== outputId && (link.type === 'merge' ? !link.sourceIds.includes(outputId) : link.sourceId !== outputId)),
    groups: graph.groups?.map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => id !== outputId) })).filter((group) => group.nodeIds.length >= 2)
  }
}

export function cloneOwnedOutput(graph: GraphDefinition, sourceAgentId: string, targetAgentId: string, targetAgent: AgentNodeDefinition): GraphDefinition {
  const source = ownedOutputEntry(graph, sourceAgentId)?.[1]
  if (!targetAgent.provider.startsWith('agent-tool:')) return graph
  const outputId = outputNodeId(graph, targetAgentId)
  const output = source
    ? { ...source, fileStates: undefined, ownerAgentId: targetAgentId, directory: `.flow/agent-results/${targetAgentId}`, position: { x: (targetAgent.position?.x ?? 0) + 360, y: (targetAgent.position?.y ?? 0) + 48 } }
    : defaultAgentOutputNode(targetAgentId, targetAgent)
  return { ...graph, nodes: { ...graph.nodes, [outputId]: output } }
}

function outputNodeId(graph: GraphDefinition, agentId: string) {
  const base = `output_${agentId}`
  if (!graph.nodes[base]) return base
  let index = 2
  while (graph.nodes[`${base}_${index}`]) index += 1
  return `${base}_${index}`
}
