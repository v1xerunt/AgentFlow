import { graphDefinitionSchema, linkSourceIds, type GraphDefinition } from '@agentflow/schema'
import { composeInvocation, type Artifact, type ComposedInvocation } from './index'
import { inputText, visibleInputItems } from './input-content'

export interface HostTask {
  id: string
  nodeId: string
  attempt: number
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  finishedAt?: string
  error?: string
}

export interface HostRun {
  format: 'agentflow-host-run'
  version: 1
  runId: string
  workspace: string
  createdAt: string
  graph: GraphDefinition
  artifacts: Artifact[]
  tasks: HostTask[]
}

/** A deliberately small execution profile of the shared portable graph format. */
export function validateHostGraph(value: unknown): GraphDefinition {
  const graph = graphDefinitionSchema.parse(value)
  if (graph.executionMode) throw new Error('Host execution requires an ordinary Flow.')
  if (!Object.values(graph.nodes).some(node => node.type === 'agent')) throw new Error('Add at least one Agent.')
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.type === 'output') throw new Error(`Output ${id}: host Agents return Markdown artifacts; describe deliverable files in their output prompts.`)
    if (node.type === 'agent') {
      if (node.provider !== 'host' || node.model !== 'inherit') throw new Error(`Agent ${id}: host execution requires provider: host and model: inherit.`)
      if (node.parameters && Object.keys(node.parameters).length) throw new Error(`Agent ${id}: model parameters are controlled by the host session.`)
      if (!node.prompts.system.content.trim() || !node.prompts.output.content.trim()) throw new Error(`Agent ${id}: supply system and output prompts.`)
    } else {
      if (node.executionMode === 'for-each') throw new Error(`Input ${id}: expand for-each into explicit nodes before host execution.`)
      if (visibleInputItems(node).some(item => item.mode !== 'text')) throw new Error(`Input ${id}: read or extract attachments with host tools, then supply text or a workspace-relative file reference as text.`)
      if (!inputText(node).trim()) throw new Error(`Input ${id}: supply the material before starting the Flow.`)
    }
  }
  return graph
}

export function hostDependencies(graph: GraphDefinition, nodeId: string): string[] {
  return graph.links.filter(link => link.targetId === nodeId).flatMap(linkSourceIds)
}

function artifactFor(run: HostRun, nodeId: string, content: string, at: string): Artifact {
  const parents = hostDependencies(run.graph, nodeId).map(id => run.artifacts.find(artifact => artifact.nodeId === id)!)
  return {
    id: `${run.runId}:${nodeId}:v1`, runId: run.runId, nodeId, version: 1, content,
    parentArtifacts: parents.map(parent => parent.id),
    sourceInputs: run.graph.nodes[nodeId]?.type === 'input' ? [nodeId] : [...new Set(parents.flatMap(parent => parent.sourceInputs))],
    createdAt: at
  }
}

export function createHostRun(graph: GraphDefinition, workspace: string, runId: string, at: string): HostRun {
  const run: HostRun = {
    format: 'agentflow-host-run', version: 1, runId, workspace, createdAt: at,
    graph: validateHostGraph(graph), artifacts: [], tasks: []
  }
  for (const [id, node] of Object.entries(run.graph.nodes)) {
    if (node.type === 'input') run.artifacts.push(artifactFor(run, id, inputText(node), at))
  }
  return run
}

export function hostRunStatus(run: HostRun) {
  const completed = new Set(run.artifacts.map(artifact => artifact.nodeId))
  const nodes = Object.entries(run.graph.nodes).map(([nodeId, node]) => {
    const task = run.tasks.filter(task => task.nodeId === nodeId).at(-1)
    const waitingFor = hostDependencies(run.graph, nodeId).filter(id => !completed.has(id))
    const status = completed.has(nodeId) ? 'completed'
      : task?.status === 'running' ? 'running'
        : task?.status === 'failed' ? 'failed'
          : waitingFor.length ? 'waiting' : 'ready'
    return { nodeId, name: node.name, type: node.type, status, waitingFor, taskId: task?.id, error: task?.error }
  })
  const status = nodes.every(node => node.status === 'completed') ? 'completed'
    : nodes.some(node => node.status === 'running') ? 'running'
      : nodes.some(node => node.status === 'failed') ? 'blocked' : 'ready'
  return { runId: run.runId, workspace: run.workspace, name: run.graph.name, status, nodes,
    ready: nodes.filter(node => node.status === 'ready').map(node => node.nodeId) }
}

export function claimHostTask(run: HostRun, taskId: string, at: string, requestedNodeId?: string): { task: HostTask; invocation: ComposedInvocation } | null {
  const ready = hostRunStatus(run).ready
  const nodeId = requestedNodeId ?? ready[0]
  if (!nodeId) return null
  if (!ready.includes(nodeId)) throw new Error(`Node ${nodeId} is not ready. Inspect host status.`)
  if (run.tasks.some(task => task.id === taskId)) throw new Error('Task ID already exists.')
  const invocation = composeInvocation(run.graph, nodeId, new Map(run.artifacts.map(artifact => [artifact.nodeId, artifact])))
  const task: HostTask = { id: taskId, nodeId, attempt: run.tasks.filter(task => task.nodeId === nodeId).length + 1, status: 'running', startedAt: at }
  run.tasks.push(task)
  return { task, invocation }
}

export function submitHostTask(run: HostRun, taskId: string, content: string, at: string): Artifact {
  const task = run.tasks.find(task => task.id === taskId)
  if (!task) throw new Error('Unknown task ID.')
  const existing = run.artifacts.find(artifact => artifact.nodeId === task.nodeId)
  if (task.status === 'completed' && existing?.content === content) return existing
  if (task.status !== 'running' || existing) throw new Error('Task is no longer running; completed results are immutable.')
  if (!content.trim()) throw new Error('A completed task must contain a non-empty result.')
  const artifact = artifactFor(run, task.nodeId, content, at)
  run.artifacts.push(artifact)
  task.status = 'completed'
  task.finishedAt = at
  return artifact
}

export function failHostTask(run: HostRun, taskId: string, error: string, at: string) {
  const task = run.tasks.find(task => task.id === taskId)
  if (!task || task.status !== 'running') throw new Error('Only a running task can be failed.')
  if (!error.trim()) throw new Error('Supply the reason execution stopped.')
  task.status = 'failed'
  task.error = error
  task.finishedAt = at
}

export function retryHostTask(run: HostRun, nodeId: string, taskId: string, at: string) {
  if (run.tasks.some(task => task.id === taskId)) throw new Error('Task ID already exists.')
  const previous = run.tasks.filter(task => task.nodeId === nodeId).at(-1)
  if (!previous || previous.status !== 'failed') throw new Error('Only a failed node can be retried. Mark an interrupted task failed first.')
  // Retain failed attempts while making only this node eligible for a new claim.
  const eligible = { ...run, tasks: run.tasks.filter(task => task.nodeId !== nodeId) }
  if (!hostRunStatus(eligible).ready.includes(nodeId)) throw new Error('Dependencies are not complete.')
  const invocation = composeInvocation(run.graph, nodeId, new Map(run.artifacts.map(artifact => [artifact.nodeId, artifact])))
  const task: HostTask = { id: taskId, nodeId, attempt: run.tasks.filter(task => task.nodeId === nodeId).length + 1, status: 'running', startedAt: at }
  run.tasks.push(task)
  return { task, invocation }
}
