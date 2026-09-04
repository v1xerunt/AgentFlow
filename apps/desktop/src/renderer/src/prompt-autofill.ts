import { parameterLabel } from '@agentflow/core/localization'
import { t } from '@agentflow/core/localization'
import { visibleInputItems, type ModelMessage } from '@agentflow/core'
import { applyAutomaticAgentName } from './agent-naming'
import { linkSourceIds, type AgentPromptDefinition, type GraphDefinition, type LinkDefinition } from '@agentflow/schema'
import { analyzePromptAutofill, type PromptAutofillMode, type PromptFieldKind } from './flow-analysis'

export interface PromptAutofillResult {
  graph: GraphDefinition
  changed: number
  protectedLocked: number
  renamed: number
  flowChanged: number
}

export interface PromptAutofillResponse {
  flow: { name?: string; goal?: string }
  agents: Array<{
    id: string
    name?: string
    system?: string
    input?: string
    output?: string
  }>
}

export interface LinkPromptUpdateResult {
  graph: GraphDefinition
  targetId?: string
  promptDefaults: 'updated' | 'protected' | 'unchanged'
}

const MAX_GOAL_CHARS = 2_000
const MAX_INPUT_ITEM_CHARS = 1_600
const MAX_INPUT_LINES = 12
const MAX_TOTAL_INPUT_CHARS = 6_000
const MAX_AUTHORED_PROMPT_CHARS = 3_000
const MAX_RETURNED_PROMPT_CHARS = 12_000
const promptFields: PromptFieldKind[] = ['system', 'input', 'output']
export function DEFAULT_LINK_INPUT_PROMPT() { return t("Read the input and complete the task.") }

export function FLOW_GOAL_PLACEHOLDER() { return t("Describe what this Flow should accomplish.") }

const PROMPT_AUTOFILL_SYSTEM = `You are a prompt architect for a multi-agent framework. Infer the user's purpose from the goal, summarized material, work relations, and authored text. Fill every field present in each draft.

Each worker receives only its own instructions and delivered material. Make every prompt independently usable. Refer to incoming material by its purpose, such as "the supplied draft" or "the review feedback"; do not expose topology or other workers.

For every worker:
- name is a concise responsibility when present in draft.
- system defines its identity, objective, decision criteria, boundaries, and quality bar.
- input explains how to use the material available at runtime and honors its work relation.
- output defines a self-contained deliverable, format, completeness requirements, and validation checks.
- Preserve useful intent from existing draft text and treat fixed text as context. Do not return fixed text.
- Match the user's language. When finalDeliverable is present, describe its semantics without inventing a path.

Return JSON only: {"flow":{...filled flow.draft fields},"agents":[{"id":"the supplied agent id",...filled agent.draft fields}]}. Copy each supplied agent id exactly. In flow, use exactly the keys present in flow.draft. In every agent object, use only id and the keys present in that agent's draft.`

export function buildPromptAutofillMessages(graph: GraphDefinition, mode: PromptAutofillMode = 'all-unlocked'): ModelMessage[] {
  const plan = analyzePromptAutofill(graph, mode)
  const includedInputIds = new Set(graph.links.flatMap((link) => linkSourceIds(link)).filter((id) => graph.nodes[id]?.type === 'input'))
  let remainingInputChars = MAX_TOTAL_INPUT_CHARS
  const inputs = Object.entries(graph.nodes)
    .filter(([id, node]) => node.type === 'input' && includedInputIds.has(id))
    .map(([, node]) => {
      if (node.type !== 'input') throw new Error(t("Could not read the input node"))
      return {
        name: node.name,
        items: visibleInputItems(node).map((item) => {
          const excerpt = remainingInputChars > 0
            ? truncateExcerpt(item.content, Math.min(MAX_INPUT_ITEM_CHARS, remainingInputChars), MAX_INPUT_LINES)
            : { text: '', truncated: Boolean(item.content) }
          remainingInputChars -= excerpt.text.length
          return {
            name: item.name,
            format: item.mimeType ?? item.kind,
            excerpt: excerpt.text,
            truncated: excerpt.truncated
          }
        })
      }
    })

  const agents = plan.agents.map((agentPlan) => {
      const id = agentPlan.id
      const node = graph.nodes[id]
      if (!node || node.type !== 'agent') throw new Error(t("Could not read the Agent node"))
      const incoming = graph.links.filter((link) => link.targetId === id).map((link) => ({
        relation: link.type,
        sources: linkSourceIds(link).map((sourceId) => ({
          role: graph.nodes[sourceId]?.name ?? 'Supplied material',
          type: graph.nodes[sourceId]?.type ?? 'material'
        }))
      }))
      const outgoing = graph.links.filter((link) => linkSourceIds(link).includes(id)).map((link) => ({
        relation: link.type,
        purpose: graph.nodes[link.targetId]?.name ?? 'Next deliverable'
      }))
      const fixed = Object.fromEntries(promptFields
        .filter((kind) => !agentPlan.fillFields.includes(kind) && node.prompts[kind].content.trim())
        .map((kind) => [kind, truncateExcerpt(node.prompts[kind].content, MAX_AUTHORED_PROMPT_CHARS).text]))
      const draft = Object.fromEntries([
        ...(!node.nameCustomized ? [['name', node.name] as const] : []),
        ...agentPlan.fillFields.map((kind) => [kind, node.prompts[kind].customized ? truncateExcerpt(node.prompts[kind].content, MAX_AUTHORED_PROMPT_CHARS).text : ''] as const)
      ])
      const specifiedOutput = Object.values(graph.nodes).find((candidate) => candidate.type === 'output' && candidate.ownerAgentId === id)
      return {
        id,
        role: node.name,
        incoming,
        outgoing,
        ...(specifiedOutput?.type === 'output' ? { finalDeliverable: { name: specifiedOutput.name, ...(specifiedOutput.note ? { note: specifiedOutput.note } : {}) } } : {}),
        ...(Object.keys(fixed).length ? { fixed } : {}),
        draft
      }
    })

  const payload = {
    flow: {
      context: {
        ...(!isDefaultFlowName(graph.name) ? { name: graph.name } : {}),
        ...(graph.goal.trim() ? { goal: truncateExcerpt(graph.goal, MAX_GOAL_CHARS).text } : {})
      },
      draft: {
        ...(isDefaultFlowName(graph.name) ? { name: '' } : {}),
        ...(!graph.goal.trim() ? { goal: '' } : {})
      }
    },
    inputs,
    agents
  }
  return [
    { role: 'system', content: PROMPT_AUTOFILL_SYSTEM },
    { role: 'user', content: `Generate the Agent prompts from this flow data:\n${JSON.stringify(payload)}` }
  ]
}

export function parsePromptAutofillResponse(content: string, graph: GraphDefinition, mode: PromptAutofillMode = 'all-unlocked'): PromptAutofillResponse {
  let validationError: Error | undefined
  for (const json of extractJsonObjects(content)) {
    try {
      const candidate = JSON.parse(json) as unknown
      if (isRecord(candidate) && Array.isArray(candidate.agents)) {
        try { return validatePromptAutofillValue(candidate, graph, mode) }
        catch (error) { validationError = error instanceof Error ? error : new Error(String(error)) }
      }
    } catch { /* try the next complete JSON object */ }
  }
  if (validationError) throw validationError
  throw new Error(t("The autofill model did not return valid JSON. Try again or choose another model"))
}

function validatePromptAutofillValue(value: Record<string, unknown>, graph: GraphDefinition, mode: PromptAutofillMode): PromptAutofillResponse {
  if (!Array.isArray(value.agents)) throw new Error(t("Invalid autofill result: missing agents"))
  const plan = analyzePromptAutofill(graph, mode)
  const flowKeys = [isDefaultFlowName(graph.name) ? 'name' : '', !graph.goal.trim() ? 'goal' : ''].filter(Boolean)
  const flow: PromptAutofillResponse['flow'] = {}
  if (isRecord(value.flow)) {
    try {
      assertExactKeys(value.flow, flowKeys, 'Flow')
      if (flowKeys.includes('name')) flow.name = validMetadataString(value.flow.name, 'Flow name')
      if (flowKeys.includes('goal')) flow.goal = validMetadataString(value.flow.goal, 'Flow goal')
    } catch { /* keep valid Agent results even when Flow metadata is malformed */ }
  }
  const planById = new Map(plan.agents.map((agent) => [agent.id, agent]))
  const returnedIds = new Set<string>()
  const agents: PromptAutofillResponse['agents'] = []
  for (const candidate of value.agents) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || returnedIds.has(candidate.id)) continue
    const agentPlan = planById.get(candidate.id)
    if (!agentPlan) continue
    const node = graph.nodes[agentPlan.id]
    if (node?.type !== 'agent') continue
    try {
      const keys = ['id', ...(!node.nameCustomized ? ['name'] : []), ...agentPlan.fillFields]
      assertExactKeys(candidate, keys, node.name)
      const result: PromptAutofillResponse['agents'][number] = { id: candidate.id }
      if (!node.nameCustomized) result.name = validMetadataString(candidate.name, t('{0} name', [node.name]))
      for (const kind of agentPlan.fillFields) result[kind] = validPromptString(candidate[kind], node.name, kind)
      agents.push(result)
      returnedIds.add(candidate.id)
    } catch { /* skip only this Agent and retain other parseable results */ }
  }
  if (!agents.length && !Object.keys(flow).length) throw new Error(t("The autofill result contains no applicable Flow or Agent content"))
  return { flow, agents }
}

export function applyPromptAutofill(graph: GraphDefinition, response: PromptAutofillResponse, mode: PromptAutofillMode = 'all-unlocked'): PromptAutofillResult {
  let changed = 0
  let protectedLocked = 0
  let renamed = 0
  let flowChanged = 0
  const nodes = { ...graph.nodes }
  const returned = new Map(response.agents.map((agent) => [agent.id, agent]))
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (node.type !== 'agent') continue
    const generated = returned.get(nodeId)
    if (!generated) continue
    const prompts = { ...node.prompts }
    for (const kind of ['system', 'input', 'output'] as const) {
      const current = prompts[kind]
      if (current.locked) {
        protectedLocked += 1
        continue
      }
      const content = generated[kind]
      if (typeof content !== 'string') continue
      if (current.content !== content || !current.customized) changed += 1
      prompts[kind] = { content, customized: true, locked: false }
    }
    const name = node.nameCustomized || !generated.name ? node.name : generated.name
    if (name !== node.name) renamed += 1
    nodes[nodeId] = { ...node, name, prompts }
  }
  const name = isDefaultFlowName(graph.name) && response.flow.name ? response.flow.name : graph.name
  const goal = !graph.goal.trim() && response.flow.goal ? response.flow.goal : graph.goal
  if (name !== graph.name) flowChanged += 1
  if (goal !== graph.goal) flowChanged += 1
  return { graph: { ...graph, name, goal, nodes }, changed, protectedLocked, renamed, flowChanged }
}

function truncateExcerpt(value: string, maxChars: number, maxLines = Number.POSITIVE_INFINITY) {
  const source = value.replace(/\r\n/g, '\n')
  const lines = source.split('\n')
  const byLines = lines.slice(0, maxLines).join('\n')
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
      if (depth === 0) {
        candidates.push(content.slice(start, index + 1))
        start = index
        break
      }
    }
  }
  return candidates
}

function validPromptString(value: unknown, agentId: string, kind: string) {
  if (typeof value !== 'string') throw new Error(t("The {1} prompt for Agent {0} is not a string", [agentId, parameterLabel(kind)]))
  const trimmed = value.trim()
  if (trimmed.length > MAX_RETURNED_PROMPT_CHARS) throw new Error(t("The {1} prompt for Agent {0} is too long", [agentId, parameterLabel(kind)]))
  return trimmed
}

function validMetadataString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(t("{0} is empty", [label]))
  const trimmed = value.trim()
  if (trimmed.length > MAX_RETURNED_PROMPT_CHARS) throw new Error(t("{0} is too long", [label]))
  return trimmed
}

function assertExactKeys(value: Record<string, unknown>, expected: string[], label: string) {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(t("Returned fields do not match {0}", [label]))
  }
}

export function isDefaultFlowName(name: string) {
  return name === 'Untitled Flow' || /^Flow \d+$/.test(name)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function defaultPromptPart(current: AgentPromptDefinition, content: string): AgentPromptDefinition {
  return { content, customized: false, locked: current.locked }
}

export function updateLinkTypeWithPromptDefaults(
  graph: GraphDefinition,
  linkId: string,
  type: 'input' | 'pass' | 'review' | 'revise'
): GraphDefinition {
  return updateLinkTypeWithPromptDefaultsDetailed(graph, linkId, type).graph
}

export function updateLinkTypeWithPromptDefaultsDetailed(
  graph: GraphDefinition,
  linkId: string,
  type: 'input' | 'pass' | 'review' | 'revise'
): LinkPromptUpdateResult {
  const link = graph.links.find((candidate) => candidate.id === linkId)
  if (!link || link.type === 'merge' || link.type === type) return { graph, promptDefaults: 'unchanged' }
  const next = {
    ...graph,
    links: graph.links.map((candidate) => candidate.id === linkId && candidate.type !== 'merge' ? { ...candidate, type } : candidate)
  } as GraphDefinition
  return syncAgentLinkPromptDefaults(applyAutomaticAgentName(next, link.targetId, type), link.targetId)
}

export function addLinkWithPromptDefaultsDetailed(
  graph: GraphDefinition,
  link: LinkDefinition
): LinkPromptUpdateResult {
  const linked = { ...graph, links: [...graph.links, link] }
  const next = applyAutomaticAgentName(linked, link.targetId, link.type)
  return syncAgentLinkPromptDefaults(next, link.targetId)
}

export function syncAgentLinkPromptDefaults(
  graph: GraphDefinition,
  targetId: string
): LinkPromptUpdateResult {
  const target = graph.nodes[targetId]
  if (target?.type !== 'agent') return { graph, targetId, promptDefaults: 'unchanged' }
  const generated = generatedPromptsForAgent(graph, targetId)
  if (!generated) return { graph, targetId, promptDefaults: 'unchanged' }
  let protectedField = false
  let updated = false
  const prompts = { ...target.prompts }
  for (const kind of ['system', 'input'] as const) {
    const current = target.prompts[kind]
    if (current.locked || current.customized) {
      protectedField = true
      continue
    }
    const next = defaultPromptPart(current, generated[kind])
    if (next.content !== current.content || next.customized !== current.customized) updated = true
    prompts[kind] = next
  }
  if (!updated) return { graph, targetId, promptDefaults: protectedField ? 'protected' : 'unchanged' }
  return {
    graph: { ...graph, nodes: { ...graph.nodes, [targetId]: { ...target, prompts } } },
    targetId,
    promptDefaults: 'updated'
  }
}

function generatedPromptsForAgent(graph: GraphDefinition, nodeId: string) {
  const node = graph.nodes[nodeId]
  if (node?.type !== 'agent') return null
  const incoming = graph.links
    .filter((link) => link.targetId === nodeId)
    .map((link) => {
      if (link.type === 'input') return null
      const sourceNames = linkSourceIds(link)
        .map((sourceId) => graph.nodes[sourceId]?.name)
        .filter((name): name is string => Boolean(name))
      return sourceNames.length ? incomingRelationInstruction(link.type, sourceNames) : null
    })
    .filter((instruction): instruction is string => Boolean(instruction))
  return {
    system: [t("You are {0}.", [node.name]), ...incoming].join('\n\n'),
    input: DEFAULT_LINK_INPUT_PROMPT()
  }
}

function incomingRelationInstruction(type: Exclude<GraphDefinition['links'][number]['type'], 'input'>, sourceNames: string[]) {
  const sources = sourceNames.join(t(', '))
  if (type === 'pass') return t("Continue from {0}’s output. Preserve its conclusions and constraints, and advance the current task. Revisit completed work only when you find a specific issue.", [sources])
  if (type === 'review') return t("Review {0}’s output for correctness, completeness, evidence, and constraints. Clearly list issues, risks, and actionable improvements.", [sources])
  if (type === 'revise') return t("Revise {0}’s output. Correct errors and omissions, incorporate useful feedback, and produce a complete replacement.", [sources])
  return t("Merge the outputs of {0}. Align shared conclusions, resolve conflicts and duplication explicitly, and retain essential constraints from every source.", [sources])
}
