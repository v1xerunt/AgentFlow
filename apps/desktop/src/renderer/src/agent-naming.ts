import type { AgentNodeDefinition, GraphDefinition, LinkRelation } from '@agentflow/schema'
import { t } from '@agentflow/core/localization'

const automaticNamePattern = /^(?:(Reviewer|Reviser|Merger|审核|修订|合并) )?Agent (\d+)$/

function agentNumber(name: string) {
  const match = automaticNamePattern.exec(name)
  return match ? Number(match[2]) : undefined
}

export function nextAgentName(graph: GraphDefinition) {
  const used = new Set(Object.values(graph.nodes).flatMap((node) => node.type === 'agent' ? [agentNumber(node.name)] : []).filter((value): value is number => value !== undefined))
  let index = 1
  while (used.has(index)) index += 1
  return `Agent ${index}`
}

export function markAgentNameCustomized(node: AgentNodeDefinition, name: string): AgentNodeDefinition {
  return { ...node, name, nameCustomized: true }
}

export function applyAutomaticAgentName(graph: GraphDefinition, targetId: string, relation: LinkRelation): GraphDefinition {
  const target = graph.nodes[targetId]
  if (target?.type !== 'agent' || target.nameCustomized || !automaticNamePattern.test(target.name)) return graph
  const index = agentNumber(target.name)
  if (!index) return graph
  const name = t(relation === 'review' ? 'Reviewer Agent {0}' : relation === 'revise' ? 'Reviser Agent {0}' : relation === 'merge' ? 'Merger Agent {0}' : 'Agent {0}', [index])
  if (name === target.name) return graph
  return { ...graph, nodes: { ...graph.nodes, [targetId]: { ...target, name } } }
}

export function localizeAutomaticAgentName(node: AgentNodeDefinition): AgentNodeDefinition {
  if (node.nameCustomized) return node
  const match = automaticNamePattern.exec(node.name)
  if (!match?.[1]) return node
  const name = t(/Reviewer|审核/.test(match[1]) ? 'Reviewer Agent {0}' : /Reviser|修订/.test(match[1]) ? 'Reviser Agent {0}' : 'Merger Agent {0}', [match[2]])
  return name === node.name ? node : { ...node, name }
}
