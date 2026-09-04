import { t } from '@agentflow/core/localization'
import { graphDefinitionSchema, linkSourceIds, type AgentNodeDefinition, type GraphDefinition } from '@agentflow/schema'
import type { StoredArtifact, WorkspaceState } from '../../shared/workspace'
import { ownedOutputEntry, reconcileAgentToolOutput } from './agent-outputs'
import type { ProviderModelOptions } from './llm-catalog'

import { TUTORIAL_BRIEF, TUTORIAL_CSV, TUTORIAL_DESCRIPTION, tutorialOutputs } from '../../shared/tutorial-content'
export { TUTORIAL_BRIEF, TUTORIAL_CSV, TUTORIAL_DESCRIPTION, tutorialOutputs } from '../../shared/tutorial-content'

export type TutorialTool = 'codex' | 'claude-code'
export const tutorialProviders: ProviderModelOptions[] = [
  { provider: 'openai', label: 'OpenAI', configured: true, connector: 'model', models: ['gpt-5.6-sol'] },
  { provider: 'zai', label: 'Z.AI', configured: true, connector: 'model', models: ['glm-5.3'] },
  { provider: 'anthropic', label: 'Anthropic', configured: true, connector: 'model', models: ['claude-fable-5-1'] },
  { provider: 'agent-tool:codex', label: 'Codex', configured: true, connector: 'agent-tool', models: ['@tool-default'] },
  { provider: 'agent-tool:claude-code', label: 'Claude Code', configured: true, connector: 'agent-tool', models: ['sonnet'] }
]

const prompts: Record<string, [string, string, string]> = {
  get analyst() { return [t("Plan the customer feedback analysis. Break the weekly decision task into statistics, findings, and recommendations."), t("Read the meeting requirements and feedback table. Identify the rating scale, topic categories, sample size, and brief objectives."), t("Produce a short work plan with metrics to calculate, checks to perform, and sections for the final brief.")] as [string, string, string] },
  get writer() { return [t("Design the structure of a one-page weekly brief that busy colleagues can scan quickly."), t("Follow the analysis plan to arrange the title, key figures, customer feedback, and next week’s actions."), t("Produce the brief outline and writing requirements for each section. Keep it within one page.")] as [string, string, string] },
  get reviewer() { return [t("Review the weekly brief plan for clear statistical definitions, factual support, and wording."), t("Read the outline. Check the sample size, rating range, customer IDs, and separation of facts and recommendations."), t("Summarize the outline, omissions, and specific revisions for the next author.")] as [string, string, string] },
  get reviser() { return [t("Improve the weekly brief outline."), t("Read the draft outline or review feedback and assemble complete analysis and writing requirements."), t("Produce a complete outline covering 8 interviews, the 1–5 rating scale, topic distribution, customer ID evidence, and two actions for next week.")] as [string, string, string] },
  get local() { return [t("You are a local data assistant. Use local tools to read CSV files, run short analysis scripts, and generate result files."), t("Read customer-feedback.csv. Following the plan and brief requirements, calculate the sample size, average rating, topic distribution, and number of ratings at or below 3. Use Python and verify the topic totals."), t("Write summary.csv and findings.md in the result directory. Include statistical definitions, customer IDs, and verification records for the downstream brief writer.")] as [string, string, string] },
  get delivery() { return [t("Write the customer success team’s weekly brief in concise workplace language."), t("Read findings.md and summary.csv from the result and organize the brief around the statistics."), t("Produce a one-page brief with an overview, key findings, and two actions for next week. Cite customer IDs and label recommendations clearly.")] as [string, string, string] }
}

export type TutorialReviewer = { provider: string; model: string }

export function tutorialGraph(step: number, tool: TutorialTool = 'codex', reviewer?: TutorialReviewer): GraphDefinition {
  const nodes: GraphDefinition['nodes'] = {
    brief: { type: 'input', name: t("Meeting requirements and customer feedback"), position: { x: 0, y: 0 }, items: [
      { id: 'feedback', name: "weekly-requirements.md", kind: 'text', mode: 'text', content: TUTORIAL_BRIEF() },
      { id: 'source', name: "customer-feedback.csv", kind: 'file', mode: 'text', mimeType: 'text/csv', content: TUTORIAL_CSV() }
    ] }
  }
  const specs: Array<[string, string, string, string, number, number]> = [
    ['analyst', t("Analysis plan"), 'anthropic', 'claude-fable-5-1', 350, 0],
    ['writer', t("Brief design"), 'zai', 'glm-5.3', 700, 0],
    ['reviewer', t("Independent review"), 'openai', 'gpt-5.6-sol', 1050, 0],
    ['reviser', t("Revised design"), 'zai', 'glm-5.3', 1400, 0],
    ['local', tool === 'codex' ? t("Codex data analysis") : t("Claude Code data analysis"), `agent-tool:${tool}`, tool === 'codex' ? '@tool-default' : 'sonnet', 1750, 180],
    ['delivery', t("Weekly brief"), 'openai', 'gpt-5.6-sol', 2100, 480]
  ]
  if (step >= 1) {
    for (const [id, name, provider, model, x, y] of specs) {
      if (id === 'reviewer' && step < 2) continue
      const values = prompts[id]!
      const filled = id !== 'reviewer' || step >= 7
      nodes[id] = { type: 'agent', name, nameCustomized: true, provider, model, position: { x, y }, prompts: Object.fromEntries(['system', 'input', 'output'].map((field, index) => [field, { content: filled ? values[index] : '', customized: filled, locked: false }])) as AgentNodeDefinition['prompts'] }
    }
    nodes.result = { type: 'output', name: t("Result · Statistics files"), ownerAgentId: 'local', directory: '.flow/agent-results/local', note: t("Output summary.csv and findings.md for the brief Agent to read."), extractText: true, position: { x: 1750, y: 480 } }
  }
  const graph = graphDefinitionSchema.parse({ version: 1, executionMode: 'tutorial', name: t("Customer feedback → One-page weekly brief"), goal: TUTORIAL_DESCRIPTION(), nodes, links: step >= 1 ? [
    { id: 'input', sourceId: 'brief', targetId: 'analyst', type: 'input' },
    { id: 'pass', sourceId: 'analyst', targetId: 'writer', type: 'pass' },
    ...(step === 1 ? [{ id: 'revise', sourceId: 'writer', targetId: 'reviser', type: 'revise' }] : []),
    ...(step >= 3 ? [{ id: 'review', sourceId: 'writer', targetId: 'reviewer', type: step >= 4 ? 'review' : 'pass' }] : []),
    ...(step >= 5 ? [{ id: 'revise', sourceId: 'reviewer', targetId: 'reviser', type: step >= 6 ? 'revise' : 'pass' }] : []),
    { id: 'merge', sourceIds: ['analyst', 'reviser'], targetId: 'local', type: 'merge' },
    ...(step >= 10 ? [{ id: 'result-input', sourceId: 'result', targetId: 'delivery', type: 'input' }] : [])
  ] : [] })
  return reviewer && step >= 2 ? configureTutorialReviewer(graph, reviewer) : graph
}

export function configureTutorialReviewer(graph: GraphDefinition, selection: TutorialReviewer): GraphDefinition {
  const reviewer = graph.nodes.reviewer
  if (reviewer?.type !== 'agent') return graph
  let next = reconcileAgentToolOutput({ ...graph, nodes: { ...graph.nodes, reviewer: { ...reviewer, ...selection, parameters: {} } } }, 'reviewer')
  const output = ownedOutputEntry(next, 'reviewer')
  if (output) {
    const [outputId, result] = output
    const reviewNode = next.nodes.reviewer as AgentNodeDefinition
    if (reviewNode.prompts.output.content) next.nodes.reviewer = { ...reviewNode, prompts: { ...reviewNode.prompts, output: { ...reviewNode.prompts.output, content: reviewNode.prompts.output.content + t(" Write review feedback to review.md.") } } }
    next = { ...next, nodes: { ...next.nodes, [outputId]: { ...result, name: t("Review result"), position: { x: 1050, y: 300 } } } }
    for (const id of ['reviser', 'local', 'result', 'delivery']) {
      const node = next.nodes[id]
      const base = graph.nodes[id]
      if (node && base?.position) next.nodes[id] = { ...node, position: { x: base.position.x, y: base.position.y + 300 } }
    }
    next.links = next.links.map((link) => link.type !== 'merge' && link.sourceId === 'reviewer' ? { ...link, sourceId: outputId, type: 'input' } : link)
  }
  return graphDefinitionSchema.parse(next)
}

export function tutorialReviewerSource(graph: GraphDefinition) { return ownedOutputEntry(graph, 'reviewer')?.[0] ?? 'reviewer' }

export function tutorialProvidersFor(real: ProviderModelOptions[], active: boolean): ProviderModelOptions[] {
  return active ? tutorialProviders.map((provider) => ({ ...provider, models: [...provider.models] })) : real
}

export function tutorialArtifacts(graphId: string, projectId: string, step: number, tool: TutorialTool, actualGraph?: GraphDefinition): StoredArtifact[] {
  const graph = actualGraph ?? tutorialGraph(step, tool)
  const reviewerSource = tutorialReviewerSource(graph)
  const nodeIds = step >= 11 ? ['analyst', 'writer', reviewerSource, 'reviser', 'result', 'delivery'] : step >= 8 ? ['analyst', 'writer', reviewerSource, 'reviser', 'result'] : []
  const artifactId = (id: string) => `${graphId}-sample-${id}`
  const summaryCsv = t("Topic,Interviews,Average rating\nResponse time,3,2.67\nTraining materials,3,4.33\nProcess clarity,2,3.50")
  return nodeIds.map((nodeId) => ({
    id: artifactId(nodeId), nodeId, projectId, graphId, runId: `${graphId}-sample`, version: 1,
    content: tutorialOutputs[nodeId === reviewerSource ? 'reviewer' : nodeId]!, origin: 'run', label: t("Run result"), createdAt: '2026-01-01T00:00:00.000Z',
    sourceInputs: ['brief'],
    parentArtifacts: graph.links.filter((link) => link.targetId === (graph.nodes[nodeId]?.type === 'output' ? graph.nodes[nodeId].ownerAgentId : nodeId)).flatMap(linkSourceIds).filter((id) => nodeIds.includes(id)).map(artifactId),
    ...(nodeId === reviewerSource && reviewerSource !== 'reviewer' ? { files: [{ name: 'review.md', relativePath: '.flow/agent-results/reviewer/review.md', mode: 'text' as const, content: tutorialOutputs.reviewer!, mimeType: 'text/markdown', size: new TextEncoder().encode(tutorialOutputs.reviewer!).length }] } : {}),
    ...(nodeId === 'result' ? { files: [{ name: 'findings.md', relativePath: '.flow/agent-results/local/findings.md', mode: 'text' as const, content: tutorialOutputs.result!, mimeType: 'text/markdown', size: new TextEncoder().encode(tutorialOutputs.result!).length }, { name: 'summary.csv', relativePath: '.flow/agent-results/local/summary.csv', mode: 'text' as const, content: summaryCsv, mimeType: 'text/csv', size: new TextEncoder().encode(summaryCsv).length }] } : {})
  }))
}

export function setTutorialStep(state: WorkspaceState, step: number, tool = state.tutorial?.tool ?? 'codex'): WorkspaceState {
  const tutorial = state.tutorial
  const stored = state.graphs.find((graph) => graph.id === tutorial?.graphId)
  if (!tutorial || !stored) return state
  step = Math.max(0, Math.min(12, step))
  const definition = tutorialGraph(step, tool, tutorial.reviewer)
  const artifacts = tutorialArtifacts(stored.id, stored.projectId, step, tool, definition)
  const now = new Date().toISOString()
  return {
    ...state, tutorial: { ...tutorial, version: 2, step, tool }, updatedAt: now,
    graphs: state.graphs.map((graph) => graph.id === stored.id ? { ...graph, definition, revision: graph.revision + 1, updatedAt: now } : graph),
    artifacts: [...state.artifacts.filter((artifact) => artifact.graphId !== stored.id), ...artifacts],
    workingArtifactIds: { ...state.workingArtifactIds, [stored.id]: Object.fromEntries(artifacts.map((artifact) => [artifact.nodeId, artifact.id])) }
  }
}

/** Record a completed UI action without replacing the graph the user is editing. */
export function advanceTutorial(state: WorkspaceState, step: number): WorkspaceState {
  if (!state.tutorial || state.tutorial.status !== 'active') return state
  return { ...state, tutorial: { ...state.tutorial, step }, updatedAt: new Date().toISOString() }
}

export function runTutorialFixture(state: WorkspaceState, step: 8 | 11): WorkspaceState {
  const stored = state.graphs.find((graph) => graph.id === state.tutorial?.graphId)
  if (!stored || !state.tutorial) return state
  const local = stored.definition.nodes.local
  const tool = local?.type === 'agent' && local.provider === 'agent-tool:claude-code' ? 'claude-code' : 'codex'
  const artifacts = tutorialArtifacts(stored.id, stored.projectId, step, tool, stored.definition)
  return {
    ...advanceTutorial(state, step),
    artifacts: [...state.artifacts.filter((artifact) => artifact.graphId !== stored.id), ...artifacts],
    workingArtifactIds: { ...state.workingArtifactIds, [stored.id]: Object.fromEntries(artifacts.map((artifact) => [artifact.nodeId, artifact.id])) }
  }
}

export function publishTutorialNode(state: WorkspaceState, nodeId: string, step: 8 | 11): WorkspaceState {
  const tutorial = state.tutorial
  const stored = state.graphs.find((graph) => graph.id === tutorial?.graphId)
  if (!stored || tutorial?.status !== 'active') return state
  const artifact = tutorialArtifacts(stored.id, stored.projectId, step, tutorial.tool, stored.definition).find((item) => item.nodeId === nodeId)
  if (!artifact) return state
  return {
    ...state,
    artifacts: [...state.artifacts.filter((item) => item.id !== artifact.id), artifact],
    workingArtifactIds: { ...state.workingArtifactIds, [stored.id]: { ...state.workingArtifactIds[stored.id], [nodeId]: artifact.id } }
  }
}

export function endTutorial(state: WorkspaceState, status: 'skipped' | 'completed'): WorkspaceState {
  if (!state.tutorial) return state
  if (status === 'skipped') state = setTutorialStep(state, 12)
  const now = new Date().toISOString()
  return {
    ...state, tutorial: { ...state.tutorial!, status }, updatedAt: now,
    graphs: state.graphs.map((stored) => stored.id !== state.tutorial!.graphId ? stored : {
      ...stored, revision: stored.revision + 1, updatedAt: now,
      definition: graphDefinitionSchema.parse({ ...stored.definition, nodes: Object.fromEntries(Object.entries(stored.definition.nodes).map(([id, node]) => [id, node.type === 'agent'
        ? { ...node, provider: 'fake', model: 'agent-v1', parameters: {}, name: id === 'local' ? t("Data analysis") : node.name }
        : node])) })
    })
  }
}

export function tutorialLinkProgress(graph: GraphDefinition, step: number): number {
  const first = graph.links.find((link) => linkSourceIds(link).includes('writer') && link.targetId === 'reviewer')
  const second = graph.links.find((link) => linkSourceIds(link).includes(tutorialReviewerSource(graph)) && link.targetId === 'reviser')
  if (step === 2 && first) return first.type === 'review' ? 4 : 3
  if (step === 3 && first?.type === 'review') return 4
  if (step === 4 && second) return second.type === 'revise' || second.type === 'input' ? 6 : 5
  if (step === 5 && second?.type === 'revise') return 6
  if (step === 9 && graph.links.some((link) => linkSourceIds(link).includes('result') && link.targetId === 'delivery' && link.type === 'input')) return 10
  return step
}
