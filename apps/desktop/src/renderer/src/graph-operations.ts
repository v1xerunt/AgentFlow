import {
  linkHasSource,
  linkSourceIds,
  validateMergeCandidate,
  type GraphDefinition,
  type LinkCandidateError,
  type LinkDefinition
} from '@agentflow/schema'
import { applyAutomaticAgentName } from './agent-naming'

export type GraphOperationResult =
  | { graph: GraphDefinition; issue?: never }
  | { graph?: never; issue: LinkCandidateError | 'group-needs-nodes' | 'group-node-already-used' | 'group-missing' }

export function selectAllGraphElements(graph: GraphDefinition) {
  return {
    nodeIds: new Set(Object.keys(graph.nodes)),
    linkIds: new Set(graph.links.map((link) => link.id))
  }
}

export function mergeAgentSourceIntoTarget(
  graph: GraphDefinition,
  sourceId: string,
  targetId: string
): GraphOperationResult {
  const incoming = graph.links.filter((link) =>
    link.targetId === targetId &&
    linkSourceIds(link).some((sourceId) => graph.nodes[sourceId]?.type === 'agent' || graph.nodes[sourceId]?.type === 'output')
  )
  if (!incoming.length) return { issue: 'missing-node' }
  const sourceIds = [...new Set([...incoming.flatMap(linkSourceIds), sourceId])]
  const incomingIds = new Set(incoming.map((link) => link.id))
  const remainingLinks = graph.links.filter((link) => !incomingIds.has(link.id))
  const base = { ...graph, links: remainingLinks }
  const issue = validateMergeCandidate(base, { sourceIds, targetId })
  if (issue) return { issue }
  const merge: LinkDefinition = { id: incoming[0]!.id, sourceIds, targetId, type: 'merge' }
  const insertionIndex = graph.links.findIndex((link) => incomingIds.has(link.id))
  const links = [...remainingLinks]
  links.splice(Math.min(insertionIndex, links.length), 0, merge)
  return { graph: applyAutomaticAgentName({ ...base, links }, targetId, 'merge') }
}

export function groupSelectedNodes(
  graph: GraphDefinition,
  selectedNodeIds: ReadonlySet<string>,
  groupId: string,
  name: string
): GraphOperationResult {
  const nodeIds = [...selectedNodeIds].filter((nodeId) => Boolean(graph.nodes[nodeId]))
  if (nodeIds.length < 2) return { issue: 'group-needs-nodes' }
  const used = new Set((graph.groups ?? []).flatMap((group) => group.nodeIds))
  if (nodeIds.some((nodeId) => used.has(nodeId))) return { issue: 'group-node-already-used' }
  return {
    graph: {
      ...graph,
      groups: [...(graph.groups ?? []), { id: groupId, name, nodeIds }]
    }
  }
}

export function renameGraphGroup(graph: GraphDefinition, groupId: string, name: string): GraphOperationResult {
  const trimmed = name.trim()
  if (!trimmed || !(graph.groups ?? []).some((group) => group.id === groupId)) return { issue: 'group-missing' }
  return {
    graph: {
      ...graph,
      groups: (graph.groups ?? []).map((group) => group.id === groupId ? { ...group, name: trimmed } : group)
    }
  }
}

export function ungroupGraphNodes(graph: GraphDefinition, groupId: string): GraphOperationResult {
  if (!(graph.groups ?? []).some((group) => group.id === groupId)) return { issue: 'group-missing' }
  return { graph: { ...graph, groups: (graph.groups ?? []).filter((group) => group.id !== groupId) } }
}

export function moveGraphGroup(graph: GraphDefinition, groupId: string, delta: { x: number; y: number }): GraphOperationResult {
  const group = (graph.groups ?? []).find((candidate) => candidate.id === groupId)
  if (!group) return { issue: 'group-missing' }
  const nodes = { ...graph.nodes }
  for (const nodeId of group.nodeIds) {
    const node = nodes[nodeId]
    if (!node) continue
    nodes[nodeId] = {
      ...node,
      position: {
        x: (node.position?.x ?? 0) + delta.x,
        y: (node.position?.y ?? 0) + delta.y
      }
    }
  }
  return { graph: { ...graph, nodes } }
}

export function deleteGraphSelection(
  graph: GraphDefinition,
  selectedNodeIds: ReadonlySet<string>,
  selectedLinkIds: ReadonlySet<string>
): GraphDefinition {
  const nodes = { ...graph.nodes }
  for (const nodeId of selectedNodeIds) delete nodes[nodeId]
  const groups = (graph.groups ?? [])
    .map((group) => ({ ...group, nodeIds: group.nodeIds.filter((nodeId) => !selectedNodeIds.has(nodeId)) }))
    .filter((group) => group.nodeIds.length > 1)
  return {
    ...graph,
    nodes,
    groups,
    links: graph.links.filter((link) =>
      !selectedLinkIds.has(link.id) &&
      !selectedNodeIds.has(link.targetId) &&
      ![...selectedNodeIds].some((nodeId) => linkHasSource(link, nodeId))
    )
  }
}
