import { t, getLocale } from '@agentflow/core/localization'
import { visibleInputItems, type ModelMessage, type ProviderCatalogGroup } from '@agentflow/core'
import {
  formatValidationError,
  graphDefinitionSchema,
  linkSourceIds,
  type AgentNodeDefinition,
  type GraphDefinition,
  type InputNodeDefinition,
  type LinkDefinition
} from '@agentflow/schema'
import { defaultAgentOutputNode } from './agent-outputs'

export interface FlowGenerationResponse {
  flow?: { name: string; goal: string }
  agents: Array<{
    name: string
    system: string
    input: string
    output: string
  }>
  routes: Array<{
    inputSources?: number[]
    agentSources?: number[]
    existingAgentSources?: number[]
    target: number
    relation?: 'pass' | 'review' | 'revise'
  }>
}

export type FlowGenerationMode = 'replace' | 'extend'

export interface FlowGenerationInputSummary {
  inputCount: number
  itemCount: number
  includedChars: number
  truncated: boolean
}

export interface FlowGenerationPreview {
  response: FlowGenerationResponse
  graph: GraphDefinition
}

const MAX_DESCRIPTION_CHARS = 8_000
const MAX_INPUT_ITEM_CHARS = 1_600
const MAX_INPUT_LINES = 12
const MAX_TOTAL_INPUT_CHARS = 6_000
const MAX_RETURNED_TEXT_CHARS = 12_000
const MAX_AGENTS = 8
const MAX_LINK_ROUTES = 24
const MAX_EXISTING_CONTEXT_CHARS = 6_000
const MAX_EXISTING_PROMPT_CHARS = 1_200

const FLOW_GENERATION_SYSTEM = `Design the smallest useful executable multi-worker DAG for the user's request and any supplied input summaries.

Each worker receives only its own prompts and delivered material. Write standalone system, input, and output instructions without exposing hidden topology. Match the user's language.

New agents and supplied inputs are referenced by their zero-based array positions. If inputs is absent, input position 0 represents material the user will provide later.

Create new workers reachable from input in an acyclic graph.`

const ROUTE_TOPOLOGY_INSTRUCTIONS = `Routes must name the direct producers consumed by the target, never a shared ancestor of those producers. A Merge is one route containing at least two distinct worker refs; never represent it with one source or with separate routes to the same target.

Example: when worker 0 generates a draft, workers 1 and 2 independently review it, and worker 3 merges both reviews, use routes 0→1 and 0→2, then {"agentSources":[1,2],"target":3}. Do not connect worker 0 directly to worker 3.`

function generationInstructions(mode: FlowGenerationMode) {
  if (mode === 'extend') return `${FLOW_GENERATION_SYSTEM}

The existingFlow workers remain unchanged. Return only new workers. A route has exactly one of inputSources, agentSources (new workers), or existingAgentSources (existingFlow worker refs). For one worker source, relation is pass, review, or revise. For multiple worker sources, omit relation; they are merged locally.

${ROUTE_TOPOLOGY_INSTRUCTIONS}

Return JSON only with this shape:
{"agents":[{"name":"...","system":"...","input":"...","output":"..."}],"routes":[{"existingAgentSources":[0],"target":0,"relation":"pass"},{"agentSources":[0],"target":1,"relation":"review"}]}`
  return `${FLOW_GENERATION_SYSTEM}

A route has exactly one of inputSources or agentSources. For one agent source, relation is pass, review, or revise. For multiple agent sources, omit relation; they are merged locally.

${ROUTE_TOPOLOGY_INSTRUCTIONS}

Return JSON only with this shape:
{"flow":{"name":"...","goal":"..."},"agents":[{"name":"...","system":"...","input":"...","output":"..."}],"routes":[{"inputSources":[0],"target":0},{"agentSources":[0],"target":1,"relation":"review"}]}`
}

export function flowGenerationInputSummary(graph: GraphDefinition): FlowGenerationInputSummary {
  const payload = inputPayload(graph)
  return {
    inputCount: payload.sources.length,
    itemCount: payload.sources.reduce((count, source) => count + source.items.length, 0),
    includedChars: payload.includedChars,
    truncated: payload.truncated
  }
}

export function buildFlowGenerationMessages(description: string, graph: GraphDefinition, mode: FlowGenerationMode = 'replace'): ModelMessage[] {
  const request = description.trim()
  if (!request) throw new Error(t("Describe the Flow you want to build first"))
  if (request.length > MAX_DESCRIPTION_CHARS) throw new Error(t("Flow descriptions cannot exceed {0} characters", [MAX_DESCRIPTION_CHARS.toLocaleString(getLocale())]))
  const inputs = inputPayload(graph)
  const payload = {
    request,
    ...(inputs.sources.length ? { inputs: inputs.sources } : {}),
    ...(mode === 'extend' ? { existingFlow: existingFlowPayload(graph) } : {})
  }
  return [
    { role: 'system', content: generationInstructions(mode) },
    { role: 'user', content: JSON.stringify(payload) }
  ]
}

export function parseFlowGenerationResponse(content: string, graph: GraphDefinition, mode: FlowGenerationMode = 'replace'): FlowGenerationResponse {
  let validationError: Error | undefined
  for (const json of extractJsonObjects(content)) {
    try {
      const candidate = JSON.parse(json) as unknown
      if (isRecord(candidate)) {
        try { return validateResponse(candidate, inputCount(graph), mode === 'extend' ? existingAgentCount(graph) : 0, mode) }
        catch (error) { validationError = error instanceof Error ? error : new Error(String(error)) }
      }
    } catch { /* try the next complete JSON object */ }
  }
  if (validationError) throw validationError
  throw new Error(t("The Flow generation model did not return valid JSON. Try again or choose another model"))
}

export function buildGeneratedFlow(
  current: GraphDefinition,
  response: FlowGenerationResponse,
  catalog: ProviderCatalogGroup[],
  idFactory: (prefix: string) => string,
  mode: FlowGenerationMode = 'replace'
): GraphDefinition {
  const currentInputs = Object.entries(current.nodes).filter((entry): entry is [string, InputNodeDefinition] => entry[1].type === 'input')
  const existingAgents = Object.entries(current.nodes).filter((entry): entry is [string, Extract<GraphDefinition['nodes'][string], { type: 'agent' }>] => entry[1].type === 'agent')
  validateResponse(response as unknown as Record<string, unknown>, currentInputs.length || 1, mode === 'extend' ? existingAgents.length : 0, mode)
  const inputEntries = currentInputs.length
    ? currentInputs.map(([id, node]) => [id, structuredClone(node)] as const)
    : [[idFactory('input'), { type: 'input', name: t("Task input"), items: [], executionMode: 'all', orderMode: 'name' } satisfies InputNodeDefinition] as const]
  const agentIds = response.agents.map(() => idFactory('agent'))
  const models = modelOptions(catalog)
  const selectedModel = defaultGeneratedAgentModel(current, models, mode)
  const nodes: GraphDefinition['nodes'] = mode === 'extend' ? structuredClone(current.nodes) : {}
  inputEntries.forEach(([id, node], index) => {
    if (mode === 'replace' || !nodes[id]) nodes[id] = { ...node, position: { x: 72, y: 86 + index * 190 } }
  })
  const generatedOutputIds = new Map<string, string>()
  response.agents.forEach((agent, index) => {
    const id = agentIds[index]!
    const agentNode: AgentNodeDefinition = {
      type: 'agent',
      name: agent.name,
      nameCustomized: true,
      provider: selectedModel.providerId,
      model: selectedModel.modelId,
      prompts: {
        system: { content: agent.system, customized: true, locked: false },
        input: { content: agent.input, customized: true, locked: false },
        output: { content: agent.output, customized: true, locked: false }
      }
    }
    nodes[id] = agentNode
    if (selectedModel.providerId.startsWith('agent-tool:')) {
      const outputId = idFactory('output')
      generatedOutputIds.set(id, outputId)
      nodes[outputId] = defaultAgentOutputNode(id, agentNode)
    }
  })

  const links: LinkDefinition[] = mode === 'extend' ? structuredClone(current.links) : []
  const incomingWorkerRoute = new Set<number>()
  for (const route of response.routes) {
    const targetId = agentIds[route.target]!
    if (route.inputSources) {
      const sources = route.inputSources.map((index) => inputEntries[index]![0])
      for (const sourceId of sources) links.push({ id: idFactory('link'), sourceId, targetId, type: 'input' })
      continue
    }
    const sources = route.existingAgentSources
      ? route.existingAgentSources.map((index) => preferredAgentOutputSource(nodes, existingAgents[index]![0]))
      : route.agentSources!.map((index) => preferredAgentOutputSource(nodes, agentIds[index]!))
    if (sources.length > 1) {
      if (incomingWorkerRoute.has(route.target)) throw new Error(t("Agent {0} can have only one upstream Agent route", [route.target]))
      incomingWorkerRoute.add(route.target)
      links.push({ id: idFactory('link'), sourceIds: sources, targetId, type: 'merge' })
    } else {
      if (incomingWorkerRoute.has(route.target)) throw new Error(t("Agent {0} can have only one upstream Agent route", [route.target]))
      incomingWorkerRoute.add(route.target)
      const sourceId = sources[0]!
      links.push({ id: idFactory('link'), sourceId, targetId, type: nodes[sourceId]?.type === 'output' ? 'input' : route.relation! })
    }
  }

  let parsed: GraphDefinition
  try {
    parsed = graphDefinitionSchema.parse({
      version: 1,
      name: mode === 'extend' ? current.name : response.flow!.name,
      goal: mode === 'extend' ? current.goal : response.flow!.goal,
      nodes,
      links,
      ...(mode === 'extend' && current.groups ? { groups: structuredClone(current.groups) } : {})
    })
  } catch (error) {
    throw new Error(t("The generated result cannot form a valid Flow: {0}", [error instanceof Error ? error.message : String(error)]))
  }
  const reachable = new Set(inputEntries.map(([id]) => id))
  let changed = true
  while (changed) {
    changed = false
    for (const [id, node] of Object.entries(parsed.nodes)) {
      if (node.type === 'output' && reachable.has(node.ownerAgentId) && !reachable.has(id)) {
        reachable.add(id)
        changed = true
      }
    }
    for (const link of parsed.links) {
      if (linkSourceIds(link).every((id) => reachable.has(id)) && !reachable.has(link.targetId)) {
        reachable.add(link.targetId)
        changed = true
      }
    }
  }
  const unreachable = agentIds.filter((id) => !reachable.has(id))
  if (unreachable.length) throw new Error(t("The result contains Agents unreachable from input"))

  const depths = new Map(inputEntries.map(([id]) => [id, 0]))
  while (depths.size < Object.keys(parsed.nodes).length) {
    let advanced = false
    for (const [id, node] of Object.entries(parsed.nodes)) {
      if (node.type !== 'output') continue
      const ownerDepth = depths.get(node.ownerAgentId)
      if (ownerDepth !== undefined && (depths.get(id) ?? -1) < ownerDepth + 1) {
        depths.set(id, ownerDepth + 1)
        advanced = true
      }
    }
    for (const link of parsed.links) {
      const sourceDepths = linkSourceIds(link).map((id) => depths.get(id))
      if (sourceDepths.some((depth) => depth === undefined)) continue
      const depth = Math.max(...sourceDepths as number[]) + 1
      if ((depths.get(link.targetId) ?? -1) < depth) { depths.set(link.targetId, depth); advanced = true }
    }
    if (!advanced) break
  }
  const layers = new Map<number, string[]>()
  for (const id of agentIds) {
    const depth = depths.get(id) ?? 1
    layers.set(depth, [...(layers.get(depth) ?? []), id])
  }
  const firstGeneratedDepth = Math.min(...agentIds.map((id) => depths.get(id) ?? 1))
  const existingRightEdge = Math.max(60, ...existingAgents.map(([, node]) => node.position?.x ?? 390))
  for (const [depth, ids] of layers) ids.forEach((id, index) => {
    const node = parsed.nodes[id]!
    const x = mode === 'extend' ? existingRightEdge + 330 + (depth - firstGeneratedDepth) * 330 : 390 + (depth - 1) * 330
    parsed.nodes[id] = { ...node, position: { x, y: 86 + index * 190 } }
  })
  for (const [agentId, outputId] of generatedOutputIds) {
    const agent = parsed.nodes[agentId]
    const output = parsed.nodes[outputId]
    if (agent?.type !== 'agent' || output?.type !== 'output') continue
    parsed.nodes[outputId] = {
      ...output,
      position: { x: (agent.position?.x ?? 0) + 360, y: (agent.position?.y ?? 0) + 48 }
    }
  }
  return graphDefinitionSchema.parse(parsed)
}

function inputPayload(graph: GraphDefinition) {
  let remaining = MAX_TOTAL_INPUT_CHARS
  let truncated = false
  let includedChars = 0
  const sources = Object.entries(graph.nodes).filter(([, node]) => node.type === 'input').map(([, node]) => {
    if (node.type !== 'input') throw new Error(t("Could not read the input node"))
    return {
      name: node.name,
      batch: node.executionMode === 'for-each' ? 'each' : 'all',
      items: visibleInputItems(node).map((item) => {
        const excerpt = remaining > 0 ? truncateExcerpt(item.content, Math.min(MAX_INPUT_ITEM_CHARS, remaining), MAX_INPUT_LINES) : { text: '', truncated: Boolean(item.content) }
        remaining -= excerpt.text.length
        includedChars += excerpt.text.length
        truncated ||= excerpt.truncated
        return { name: item.name, format: item.mimeType ?? item.kind, excerpt: excerpt.text, truncated: excerpt.truncated }
      })
    }
  })
  return { sources, includedChars, truncated }
}

function existingFlowPayload(graph: GraphDefinition) {
  const entries = Object.entries(graph.nodes).filter((entry): entry is [string, Extract<GraphDefinition['nodes'][string], { type: 'agent' }>] => entry[1].type === 'agent')
  const refs = new Map(entries.map(([id], ref) => [id, ref]))
  let remaining = MAX_EXISTING_CONTEXT_CHARS
  const excerpt = (value: string) => {
    if (!value.trim() || remaining <= 0) return undefined
    const text = truncateExcerpt(value, Math.min(MAX_EXISTING_PROMPT_CHARS, remaining), MAX_INPUT_LINES).text
    remaining -= text.length
    return text || undefined
  }
  return {
    name: graph.name,
    goal: truncateExcerpt(graph.goal, 2_000, MAX_INPUT_LINES).text,
    agents: entries.map(([id, node], ref) => {
      const incomingSources = graph.links.filter((link) => link.targetId === id).flatMap(linkSourceIds)
      const existingSources = [...new Set(incomingSources.flatMap((sourceId) => {
        const source = graph.nodes[sourceId]
        const ownerId = source?.type === 'output' ? source.ownerAgentId : source?.type === 'agent' ? sourceId : undefined
        const sourceRef = ownerId ? refs.get(ownerId) : undefined
        return sourceRef === undefined ? [] : [sourceRef]
      }))]
      const system = excerpt(node.prompts.system.content)
      const input = excerpt(node.prompts.input.content)
      const output = excerpt(node.prompts.output.content)
      return {
        ref,
        name: node.name,
        ...(system ? { system } : {}),
        ...(input ? { input } : {}),
        ...(output ? { output } : {}),
        ...(incomingSources.some((sourceId) => graph.nodes[sourceId]?.type === 'input') ? { receivesInput: true } : {}),
        ...(existingSources.length ? { existingSources } : {})
      }
    })
  }
}

function validateResponse(
  value: Record<string, unknown>,
  availableInputCount: number,
  availableExistingAgentCount = 0,
  mode: FlowGenerationMode = 'replace'
): FlowGenerationResponse {
  if (!Array.isArray(value.agents) || !Array.isArray(value.routes) || (mode === 'replace' && !isRecord(value.flow))) throw new Error(t("Flow generation result is missing {0}agents or routes", [mode === 'replace' ? 'flow, ' : '']))
  if (!value.agents.length || value.agents.length > MAX_AGENTS) throw new Error(t("Flow generation must include 1–{0} Agents", [MAX_AGENTS]))
  if (value.routes.length > MAX_LINK_ROUTES) throw new Error(t("Flow generation cannot exceed {0} routes", [MAX_LINK_ROUTES]))
  const agents = value.agents.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(t("Flow generation contains an invalid Agent"))
    return {
      name: shortString(candidate.name, t('Agent {0} name', [index + 1]), 120),
      system: textString(candidate.system, t('Agent {0} system prompt', [index + 1])),
      input: textString(candidate.input, t('Agent {0} input prompt', [index + 1])),
      output: textString(candidate.output, t('Agent {0} output prompt', [index + 1]))
    }
  })
  const targetCounts = new Map<number, number>()
  const workerRouteTargets = new Set<number>()
  const pairKeys = new Set<string>()
  const routes = value.routes.map((candidate) => {
    if (!isRecord(candidate)) throw new Error(t("Flow generation contains an invalid route"))
    const target = indexValue(candidate.target, t("Route target"), agents.length)
    const hasInputs = Array.isArray(candidate.inputSources)
    const hasAgents = Array.isArray(candidate.agentSources)
    const hasExistingAgents = Array.isArray(candidate.existingAgentSources)
    if (Number(hasInputs) + Number(hasAgents) + Number(hasExistingAgents) !== 1) throw new Error(t("The route for Agent {0} must contain exactly one source type", [target]))
    if (hasExistingAgents && mode !== 'extend') throw new Error(t("Agent {0} cannot reference an existing Agent", [target]))
    const rawSources = (hasInputs ? candidate.inputSources : hasExistingAgents ? candidate.existingAgentSources : candidate.agentSources) as unknown[]
    const maxSources = hasInputs ? availableInputCount : hasExistingAgents ? availableExistingAgentCount : agents.length
    const sources = rawSources.map((source) => indexValue(source, t("Route source"), maxSources))
    if (!sources.length || new Set(sources).size !== sources.length) throw new Error(t("Agent {0} has empty or duplicate route sources", [target]))
    let relation: FlowGenerationResponse['routes'][number]['relation']
    if (hasInputs) {
      if (candidate.relation !== undefined) throw new Error(t("The input route for Agent {0} does not require a relation", [target]))
    } else if (sources.length > 1) {
      if (candidate.relation !== undefined) throw new Error(t("The merge route for Agent {0} does not require a relation", [target]))
    } else {
      if (candidate.relation === undefined) throw new Error(t("Agent {0} has only one upstream source and cannot create a merge", [target]))
      if (!['pass', 'review', 'revise'].includes(String(candidate.relation))) throw new Error(t("Agent {0} has an invalid relation", [target]))
      relation = candidate.relation as typeof relation
    }
    if (!hasInputs) {
      if (workerRouteTargets.has(target)) throw new Error(t("Multiple upstream sources for Agent {0} must share one merge route", [target]))
      workerRouteTargets.add(target)
    }
    if (hasAgents && sources.includes(target)) throw new Error(t("Agent {0} cannot connect to itself", [target]))
    for (const source of sources) {
      const pair = `${hasInputs ? 'input' : hasExistingAgents ? 'existing' : 'agent'}:${source}\u0000${target}`
      if (pairKeys.has(pair)) throw new Error(t("Duplicate link: {0} → {1}", [source, target]))
      pairKeys.add(pair)
    }
    targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1)
    if (hasInputs) return { inputSources: sources, target }
    if (hasExistingAgents) return { existingAgentSources: sources, target, ...(relation ? { relation } : {}) }
    return { agentSources: sources, target, ...(relation ? { relation } : {}) }
  })
  const missingIncoming = agents.filter((_, index) => !targetCounts.has(index))
  if (missingIncoming.length) throw new Error(t("These Agents have no input source: {0}", [missingIncoming.map(agent => agent.name).join(', ')]))
  return {
    ...(mode === 'replace' && isRecord(value.flow) ? { flow: { name: shortString(value.flow.name, t('Flow name'), 120), goal: shortString(value.flow.goal, t('Flow goal'), 4_000) } } : {}),
    agents,
    routes
  }
}

function modelOptions(catalog: ProviderCatalogGroup[]) {
  return catalog.filter((provider) => provider.configured).flatMap((provider) => provider.models
    .filter((model) => model.configured)
    .map((model) => ({ providerId: provider.id, modelId: model.modelId })))
}

function defaultGeneratedAgentModel(current: GraphDefinition, models: ReturnType<typeof modelOptions>, mode: FlowGenerationMode) {
  const existing = mode === 'extend'
    ? Object.values(current.nodes).find((node) => node.type === 'agent' && models.some((model) => model.providerId === node.provider && model.modelId === node.model))
    : undefined
  const selected = existing?.type === 'agent'
    ? models.find((model) => model.providerId === existing.provider && model.modelId === existing.model)
    : models[0]
  if (!selected) throw new Error(t("No configured models are available for new Agents"))
  return selected
}

function inputCount(graph: GraphDefinition) {
  return Math.max(1, Object.values(graph.nodes).filter((node) => node.type === 'input').length)
}

function existingAgentCount(graph: GraphDefinition) {
  return Object.values(graph.nodes).filter((node) => node.type === 'agent').length
}

function preferredAgentOutputSource(nodes: GraphDefinition['nodes'], agentId: string) {
  return Object.entries(nodes).find(([, node]) => node.type === 'output' && node.ownerAgentId === agentId)?.[0] ?? agentId
}

function indexValue(value: unknown, label: string, upperBound: number) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value >= upperBound) throw new Error(t("Invalid {0}", [label]))
  return value
}

function truncateExcerpt(value: string, maxChars: number, maxLines: number) {
  const source = value.replace(/\r\n/g, '\n')
  const byLines = source.split('\n').slice(0, maxLines).join('\n')
  const text = byLines.slice(0, Math.max(0, maxChars))
  return { text, truncated: text.length < source.length }
}

function extractJsonObjects(content: string) {
  const candidates: string[] = []
  for (let start = 0; start < content.length; start += 1) {
    if (content[start] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < content.length; index += 1) {
      const char = content[index]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') { inString = true; continue }
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      if (depth === 0) { candidates.push(content.slice(start, index + 1)); start = index; break }
    }
  }
  return candidates
}

function shortString(value: unknown, label: string, maxChars: number) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(t("{0} is empty", [label]))
  const text = value.trim()
  if (text.length > maxChars) throw new Error(t("{0} is too long", [label]))
  return text
}

function textString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(t("{0} is empty", [label]))
  const text = value.trim()
  if (text.length > MAX_RETURNED_TEXT_CHARS) throw new Error(t("{0} is too long", [label]))
  return text
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
