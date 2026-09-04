import { t } from '@agentflow/core/localization'
import { linkSourceIds, type GraphDefinition } from '@agentflow/schema'
import { nodeHasInputContent, type Artifact } from '@agentflow/core'

export function agentRunInputIssue(graph: GraphDefinition, targetId: string, artifacts: Record<string, Artifact>, fromStart = false): string | undefined {
  const upstream = { ...artifacts }
  delete upstream[targetId]
  const visited = new Set<string>()
  const hasInput = (id: string): boolean => {
    if (visited.has(id)) return false
    visited.add(id)
    const node = graph.nodes[id]
    if (!node) return false
    if (node.type === 'input') return nodeHasInputContent(node)
    const artifact = upstream[id]
    if (artifact && nodeHasInputContent(node, artifact) && !fromStart) return true
    if (node.type === 'output') return fromStart && hasInput(node.ownerAgentId)
    const sources = graph.links.filter(link => link.targetId === id).flatMap(linkSourceIds)
    if (node.prompts.input.content.trim() && (node.prompts.input.customized || !sources.length)) return true
    return sources.some(sourceId => (graph.nodes[sourceId]?.type === 'input' || fromStart) ? hasInput(sourceId) : nodeHasInputContent(graph.nodes[sourceId], upstream[sourceId]))
  }
  return hasInput(targetId) ? undefined : t("Add input, write an input prompt, or generate upstream output before running this Agent alone.")
}

export type AgentRunScope = 'single' | 'upstream' | 'downstream'

export function planAgentRun(graph: GraphDefinition, targetId: string, scope: AgentRunScope) {
  const dependencies = (id: string) => {
    const node = graph.nodes[id]
    return node?.type === 'output' ? [node.ownerAgentId] : graph.links.filter(link => link.targetId === id).flatMap(linkSourceIds)
  }
  const outputs = (id: string) => Object.entries(graph.nodes).filter(([, node]) => node.type === 'output' && node.ownerAgentId === id).map(([id]) => id)
  const run = new Set<string>()
  const pending = [targetId]
  while (pending.length) {
    const id = pending.pop()!
    if (run.has(id) || !graph.nodes[id]) continue
    run.add(id)
    if (scope === 'upstream') pending.push(...dependencies(id))
    if (scope === 'downstream') pending.push(...outputs(id), ...graph.links.filter(link => linkSourceIds(link).includes(id)).map(link => link.targetId))
  }
  for (const id of [...run]) for (const outputId of outputs(id)) run.add(outputId)
  const reuse = new Set<string>()
  for (const id of run) for (const sourceId of dependencies(id)) {
    if (run.has(sourceId)) continue
    if (graph.nodes[sourceId]?.type === 'input') run.add(sourceId)
    else reuse.add(sourceId)
  }
  return { runNodeIds: [...run], reuseNodeIds: [...reuse] }
}
