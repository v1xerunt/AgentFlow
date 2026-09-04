import { t } from '@agentflow/core/localization'
import { linkSourceIds, type GraphDefinition } from '@agentflow/schema'
import { nodeHasInputContent, visibleInputItems } from '@agentflow/core'

export type PromptFieldKind = 'system' | 'input' | 'output'
export type PromptAutofillMode = 'all-unlocked' | 'blank-and-default'

export interface PromptAutofillAgentPlan {
  id: string
  name: string
  fillFields: PromptFieldKind[]
  blankFields: PromptFieldKind[]
  defaultFields: PromptFieldKind[]
  existingFields: PromptFieldKind[]
  lockedFields: PromptFieldKind[]
}

export interface PromptAutofillPlan {
  agents: PromptAutofillAgentPlan[]
  disconnectedAgents: Array<{ id: string; name: string }>
  disconnectedInputs: Array<{ id: string; name: string }>
  connectedInputCount: number
}

export interface FlowRunPlan {
  runnableAgentIds: string[]
  runnableAgents: Array<{ id: string; name: string }>
  skippedAgents: Array<{ id: string; name: string }>
  defaultPromptAgents: Array<{ id: string; name: string; fields: PromptFieldKind[] }>
  emptyPromptAgents: Array<{ id: string; name: string; fields: PromptFieldKind[] }>
  connectedInputs: Array<{ id: string; name: string }>
  emptyInputs: Array<{ id: string; name: string }>
  canRun: boolean
  batchSize: number
  batchIssues: string[]
}

const promptFields: PromptFieldKind[] = ['system', 'input', 'output']

export function analyzePromptAutofill(graph: GraphDefinition, mode: PromptAutofillMode = 'all-unlocked'): PromptAutofillPlan {
  const connectedNodeIds = new Set<string>()
  for (const link of graph.links) {
    connectedNodeIds.add(link.targetId)
    linkSourceIds(link).forEach((sourceId) => connectedNodeIds.add(sourceId))
  }
  const agents: PromptAutofillAgentPlan[] = []
  const disconnectedAgents: PromptAutofillPlan['disconnectedAgents'] = []
  const disconnectedInputs: PromptAutofillPlan['disconnectedInputs'] = []
  let connectedInputCount = 0

  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.type === 'input') {
      const connected = graph.links.some((link) => linkSourceIds(link).includes(id))
      if (connected) connectedInputCount += 1
      else disconnectedInputs.push({ id, name: node.name })
      continue
    }
    if (node.type === 'output') continue
    if (!connectedNodeIds.has(id)) {
      disconnectedAgents.push({ id, name: node.name })
      continue
    }
    const blankFields = promptFields.filter((field) => !node.prompts[field].locked && !node.prompts[field].content.trim())
    const defaultFields = promptFields.filter((field) => !node.prompts[field].locked && Boolean(node.prompts[field].content.trim()) && !node.prompts[field].customized)
    const existingFields = promptFields.filter((field) => !node.prompts[field].locked && Boolean(node.prompts[field].content.trim()) && node.prompts[field].customized)
    agents.push({
      id,
      name: node.name,
      fillFields: mode === 'blank-and-default' ? promptFields.filter((field) => blankFields.includes(field) || defaultFields.includes(field)) : promptFields.filter((field) => !node.prompts[field].locked),
      blankFields,
      defaultFields,
      existingFields,
      lockedFields: promptFields.filter((field) => node.prompts[field].locked)
    })
  }
  return { agents, disconnectedAgents, disconnectedInputs, connectedInputCount }
}

export function analyzeFlowRun(graph: GraphDefinition): FlowRunPlan {
  const connectedInputs = Object.entries(graph.nodes)
    .filter(([id, node]) => node.type === 'input' && graph.links.some((link) => linkSourceIds(link).includes(id)))
    .map(([id, node]) => ({ id, name: node.name }))
  const reachable = new Set(connectedInputs.map((input) => input.id))
  let changed = true
  while (changed) {
    changed = false
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (reachable.has(id)) continue
      if (node.type === 'output' && reachable.has(node.ownerAgentId)) {
        reachable.add(id)
        changed = true
        continue
      }
      if (node.type === 'agent') {
        const dependencies = graph.links.filter((link) => link.targetId === id).flatMap(linkSourceIds)
        if (dependencies.length && dependencies.every((sourceId) => reachable.has(sourceId))) {
          reachable.add(id)
          changed = true
        }
      }
    }
  }
  const allAgents = Object.entries(graph.nodes)
    .filter((entry): entry is [string, Extract<GraphDefinition['nodes'][string], { type: 'agent' }>] => entry[1].type === 'agent')
  const runnableAgents = allAgents.filter(([id]) => reachable.has(id)).map(([id, node]) => ({ id, name: node.name }))
  const skippedAgents = allAgents.filter(([id]) => !reachable.has(id)).map(([id, node]) => ({ id, name: node.name }))
  const defaultPromptAgents = allAgents
    .filter(([id]) => reachable.has(id))
    .map(([id, node]) => ({ id, name: node.name, fields: promptFields.filter((field) => Boolean(node.prompts[field].content.trim()) && !node.prompts[field].customized) }))
    .filter((agent) => agent.fields.length > 0)
  const emptyPromptAgents = allAgents
    .filter(([id]) => reachable.has(id))
    .map(([id, node]) => ({ id, name: node.name, fields: promptFields.filter((field) => !node.prompts[field].content.trim()) }))
    .filter((agent) => agent.fields.length > 0)
  const emptyInputs = connectedInputs.filter(({ id }) => {
    const node = graph.nodes[id]
    return node?.type === 'input' && !nodeHasInputContent(node)
  })
  const batch = planBatchRuns(graph, connectedInputs.map((input) => input.id))
  return {
    runnableAgentIds: runnableAgents.map((agent) => agent.id),
    runnableAgents,
    skippedAgents,
    defaultPromptAgents,
    emptyPromptAgents,
    connectedInputs,
    emptyInputs,
    canRun: connectedInputs.some(input => nodeHasInputContent(graph.nodes[input.id])) && runnableAgents.length > 0 && batch.issues.length === 0,
    batchSize: batch.batchSize,
    batchIssues: batch.issues
  }
}

export function planBatchRuns(graph: GraphDefinition, inputIds?: string[]) {
  const allowed = inputIds ? new Set(inputIds) : undefined
  const batchInputs = Object.entries(graph.nodes).filter((entry): entry is [string, Extract<GraphDefinition['nodes'][string], { type: 'input' }>] =>
    entry[1].type === 'input' && entry[1].executionMode === 'for-each' && (!allowed || allowed.has(entry[0])))
  if (!batchInputs.length) return { graphs: [graph], batchSize: 1, issues: [] as string[] }
  const lengths = batchInputs.map(([, node]) => visibleInputItems(node).length)
  const issues: string[] = []
  if (lengths.some((length) => length === 0)) issues.push(...batchInputs.filter(([, node]) => !visibleInputItems(node).length).map(([, node]) => t("{0} · Batch list is empty", [node.name])))
  if (new Set(lengths).size > 1) issues.push(t("Batch inputs must have matching item counts: {0}", [batchInputs.map(([, node]) => t("{0} · {1} items", [node.name, visibleInputItems(node).length])).join('，')]))
  if (issues.length) return { graphs: [] as GraphDefinition[], batchSize: Math.max(0, ...lengths), issues }
  const batchSize = lengths[0] ?? 1
  return {
    batchSize,
    issues,
    graphs: Array.from({ length: batchSize }, (_, index) => ({
      ...graph,
      nodes: Object.fromEntries(Object.entries(graph.nodes).map(([id, node]) => [id,
        node.type === 'input' && node.executionMode === 'for-each' ? { ...node, items: visibleInputItems(node)[index] ? [visibleInputItems(node)[index]!] : [] } : node
      ]))
    }))
  }
}

export function graphForRun(graph: GraphDefinition, plan = analyzeFlowRun(graph)): GraphDefinition {
  const runnable = new Set(plan.runnableAgentIds)
  const outputs = Object.entries(graph.nodes)
    .filter((entry) => entry[1].type === 'output' && runnable.has(entry[1].ownerAgentId))
    .map(([id]) => id)
  const included = new Set([...plan.connectedInputs.map((input) => input.id), ...plan.runnableAgentIds, ...outputs])
  return {
    ...graph,
    nodes: Object.fromEntries(Object.entries(graph.nodes).filter(([id]) => included.has(id))),
    links: graph.links.filter((link) => included.has(link.targetId) && linkSourceIds(link).every((sourceId) => included.has(sourceId))),
    groups: graph.groups?.map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => included.has(id)) })).filter((group) => group.nodeIds.length >= 2)
  }
}
