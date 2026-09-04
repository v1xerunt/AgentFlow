import { t } from './localization'
import type {
  AgentNodeDefinition,
  GraphDefinition,
  GraphNodeDefinition,
  LinkRelation,
  OutputNodeDefinition
} from '@agentflow/schema'
import { linkSourceIds } from '@agentflow/schema'
import { inputText, nodeHasInputContent, transferableArtifact, visibleInputItems } from './input-content'
import type { ModelInvoker, ModelMessage, ModelImagePart, ModelOutputFile, ModelProviderState, ModelResponsePart, ModelTextPart } from './llm'
import { modelAttachmentIssue } from './model-parameters'
import { invokeModelSafely } from './model-response'

export type NodeRuntimeStatus =
  | 'idle'
  | 'waiting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'

export interface Artifact {
  id: string
  runId: string
  nodeId: string
  version: number
  content: string
  parentArtifacts: string[]
  sourceInputs: string[]
  createdAt: string
  files?: ModelOutputFile[]
  parts?: ModelResponsePart[]
  providerState?: ModelProviderState
}

export type RuntimeEvent =
  | {
      type: 'run.started'
      runId: string
      at: string
      message: string
    }
  | {
      type: 'node.status'
      runId: string
      nodeId: string
      status: NodeRuntimeStatus
      at: string
      message: string
    }
  | {
      type: 'artifact.created'
      runId: string
      nodeId: string
      artifact: Artifact
      at: string
      message: string
    }
  | {
      type: 'run.completed' | 'run.cancelled' | 'run.paused'
      runId: string
      at: string
      message: string
    }

export interface RunResult {
  runId: string
  status: 'completed' | 'cancelled' | 'paused'
  artifacts: Artifact[]
  events: RuntimeEvent[]
  blocked?: { nodeId: string; nodeName: string; files: string[] }
}

export interface RuntimeOptions {
  nodeIds?: string[]
  modelTimeoutMs?: number
  delayMs?: number
  onEvent?: (event: RuntimeEvent) => void | Promise<void>
  modelInvoker?: ModelInvoker
  onTextDelta?: (nodeId: string, delta: string) => void
  signal?: AbortSignal
  resumeArtifacts?: Artifact[]
  skipUnsupportedFiles?: boolean
  artifactVersions?: Record<string, number>
}

export interface ComposedInvocation {
  nodeId: string
  messages: ModelMessage[]
  upstream: Artifact[]
  relations: LinkRelation[]
}

function sleep(duration: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted()
    const abort = () => { clearTimeout(timer); reject(signal?.reason) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, duration)
    signal?.addEventListener('abort', abort, { once: true })
  })
}

function createRunId() {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `run_${Date.now().toString(36)}_${suffix}`
}

function now() {
  return new Date().toISOString()
}

export function composeInvocation(
  graph: GraphDefinition,
  nodeId: string,
  artifactByNode: Map<string, Artifact>
): ComposedInvocation {
  const node = graph.nodes[nodeId]
  if (!node || node.type !== 'agent') {
    throw new Error(t("Node {0} is not an agent", [nodeId]))
  }

  const incoming = graph.links.filter((link) => link.targetId === nodeId)
  if (incoming.length && !(node.prompts.input.customized && node.prompts.input.content.trim()) &&
      !incoming.flatMap(linkSourceIds).some(sourceId => nodeHasInputContent(graph.nodes[sourceId], artifactByNode.get(sourceId)))) {
    throw new Error(t("Upstream input for {0} is empty. Add content or show the files to send.", [node.name]))
  }
  const upstream = incoming
    .flatMap((link) => linkSourceIds(link))
    .map((sourceId) => artifactByNode.get(sourceId))
    .filter((artifact): artifact is Artifact => Boolean(artifact))
    .map(artifact => transferableArtifact(graph.nodes[artifact.nodeId], artifact))
  const sourceBlocks = upstream
    .map((artifact, index) => {
      const sourceNode = graph.nodes[artifact.nodeId]
      const textFiles = (artifact.files ?? []).filter((file) => file.mode === 'text' && file.content).map((file) => `### ${file.name}\n${file.content}`).join('\n\n')
      const workspaceFiles = node.provider.startsWith('agent-tool:')
        ? sourceNode?.type === 'output'
          ? (artifact.files ?? []).filter(file => file.mode === 'attachment').map(file => `- ${sourceNode.directory}/${file.relativePath}`).join('\n')
          : sourceNode?.type === 'input' ? visibleInputItems(sourceNode).filter(item => item.mode === 'attachment' && item.workspacePath).map(item => `- ${item.workspacePath}`).join('\n') : ''
        : ''
      return [upstream.length > 1 ? `## Source ${index + 1}` : undefined, artifact.content, textFiles, workspaceFiles ? `Workspace files:\n${workspaceFiles}` : undefined].filter(Boolean).join('\n\n')
    })
    .join('\n\n')

  const goal = graph.goal.trim()
  const ownInstructions = [node.prompts.system.content, node.prompts.input.content, node.prompts.output.content].join('\n')
  const userPrompt = [
    node.prompts.input.content,
    goal && !ownInstructions.includes(goal) ? `# Current task\n${goal}` : undefined,
    sourceBlocks ? `# Connected context\n${sourceBlocks}` : undefined,
    node.prompts.output.content ? `# Required output\n${node.prompts.output.content}` : undefined,
    outputContract(graph, nodeId)
  ]
    .filter(Boolean)
    .join('\n\n')
  const messages: ModelMessage[] = []
  const systemPrompt = node.prompts.system.content
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  const imageParts: ModelImagePart[] = incoming.flatMap((link) => linkSourceIds(link)).flatMap((sourceId) => {
    const source = graph.nodes[sourceId]
    if (source?.type === 'input') return visibleInputItems(source).flatMap((item) => item.mode === 'attachment' && item.mimeType?.startsWith('image/') && item.dataBase64 && !(node.provider.startsWith('agent-tool:') && item.workspacePath)
        ? [{ type: 'image' as const, name: item.name, mimeType: item.mimeType, dataBase64: item.dataBase64 }]
        : [])
    const artifact = artifactByNode.get(sourceId)
    if (node.provider.startsWith('agent-tool:') && source?.type === 'output') return []
    return (artifact ? transferableArtifact(source, artifact).files ?? [] : []).flatMap((file) => file.mode === 'attachment' && file.mimeType.startsWith('image/') && file.dataBase64
      ? [{ type: 'image' as const, name: file.name, mimeType: file.mimeType, dataBase64: file.dataBase64 }]
      : [])
  })
  for (const image of imageParts) {
    const issue = modelAttachmentIssue(node.provider, node.model, image.mimeType)
    if (issue) throw new Error(t("{0} cannot receive {1}: {2}", [node.name, image.name, issue]))
  }
  const content: string | Array<ModelTextPart | ModelImagePart> = imageParts.length
    ? [{ type: 'text', text: userPrompt }, ...imageParts.flatMap((image) => [{ type: 'text' as const, text: t("Image: {0}", [image.name]) }, image])]
    : userPrompt
  messages.push({ role: 'user', content })

  return {
    nodeId,
    messages,
    upstream,
    relations: incoming.map((link) => link.type)
  }
}

function outputContract(graph: GraphDefinition, agentId: string) {
  const output = Object.values(graph.nodes).find((node): node is OutputNodeDefinition => node.type === 'output' && node.ownerAgentId === agentId)
  if (!output) return undefined
  return [
    '# Deliverables',
    `Write final deliverables to this workspace-relative directory: ${output.directory}`,
    'Only final deliverables belong there.',
    output.note ? `Output note: ${output.note}` : undefined,
  ].filter(Boolean).join('\n')
}

function fakeResponse(
  nodeId: string,
  node: AgentNodeDefinition,
  invocation: ComposedInvocation
) {
  const lowerName = `${nodeId} ${node.name} ${node.prompts.input.content}`.toLowerCase()

  if (lowerName.includes('review')) {
    return [
      t("## Review conclusion"),
      '',
      t("The main approach is clear and ready for prototype validation. Refine three points before implementation:"),
      '',
      t("1. The GUI and CLI must read the same Flow schema."),
      t("2. Links describe information relationships. Tasks belong in downstream Agent prompts."),
      t("3. Runs, artifacts, and parent dependencies need immutable version records."),
      '',
      t("Reviewed {0} upstream artifacts.", [invocation.upstream.length])
    ].join('\n')
  }

  return [
    t("## Prototype plan"),
    '',
    t("Use a shared core to support both the desktop canvas and CLI:"),
    '',
    t("- The Flow schema validates nodes, relations, and versions."),
    t("- The runtime follows DAG dependencies and streams status events."),
    t("- Each node produces an immutable artifact and supports partial reruns."),
    t("- Each Agent retains its prompts, model configuration, and runtime context."),
    '',
    t("This request received {0} upstream inputs.", [invocation.upstream.length])
  ].join('\n')
}

function dependenciesFor(graph: GraphDefinition, nodeId: string) {
  const node = graph.nodes[nodeId]
  if (node?.type === 'output') return [node.ownerAgentId]
  return graph.links
    .filter((link) => link.targetId === nodeId)
    .flatMap((link) => linkSourceIds(link))
}

function collectInputSources(
  graph: GraphDefinition,
  nodeId: string,
  artifactByNode: Map<string, Artifact>
) {
  const direct = dependenciesFor(graph, nodeId)
  const sources = new Set<string>()
  for (const sourceId of direct) {
    const source = graph.nodes[sourceId]
    if (source?.type === 'input') sources.add(sourceId)
    const artifact = artifactByNode.get(sourceId)
    artifact?.sourceInputs.forEach((id) => sources.add(id))
  }
  return [...sources]
}

export async function executeGraph(
  graph: GraphDefinition,
  options: RuntimeOptions = {}
): Promise<RunResult> {
  if (graph.executionMode === 'tutorial') throw new Error(t("The tutorial Flow uses preset results. Run it in the interactive tutorial."))
  const delayMs = options.delayMs ?? 480
  const runId = createRunId()
  const events: RuntimeEvent[] = []
  const controller = new AbortController()
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  const runOptions = { ...options, signal }
  const requested = options.nodeIds ? new Set(options.nodeIds) : undefined
  const artifactByNode = new Map((options.resumeArtifacts ?? []).filter((artifact) => graph.nodes[artifact.nodeId] && !requested?.has(artifact.nodeId)).map((artifact) => [artifact.nodeId, artifact]))
  const pending = new Set((options.nodeIds ?? Object.keys(graph.nodes)).filter((nodeId) => !artifactByNode.has(nodeId)))
  let failure: { error: unknown } | undefined

  const emit = async (event: RuntimeEvent) => {
    events.push(event)
    await options.onEvent?.(event)
  }

  await emit({
    type: 'run.started',
    runId,
    at: now(),
    message: t('Run started · {0}', [graph.name])
  })

  for (const nodeId of pending) if (!signal.aborted) await emit({ type: 'node.status', runId, nodeId, status: 'waiting', at: now(), message: t('Waiting to run') })
  while (pending.size > 0 && !signal.aborted) {
    const ready = [...pending].filter((nodeId) =>
      dependenciesFor(graph, nodeId).every((dependency) =>
        artifactByNode.has(dependency)
      )
    )

    if (ready.length === 0) {
      throw new Error(t("Runtime stalled because graph dependencies are unresolved"))
    }

    const blocked = ready.flatMap((nodeId) => {
      const node = graph.nodes[nodeId]
      if (node?.type !== 'agent') return []
      const files = unsupportedArtifactFiles(graph, nodeId, artifactByNode)
      return files.length ? [{ nodeId, nodeName: node.name, files }] : []
    })[0]
    const runnable = blocked && !options.skipUnsupportedFiles ? ready.filter((nodeId) => nodeId !== blocked.nodeId) : ready
    if (!runnable.length && blocked && !options.skipUnsupportedFiles) {
      await emit({ type: 'node.status', runId, nodeId: blocked.nodeId, status: 'paused', at: now(), message: t("{0} is waiting for unsupported files to be handled", [blocked.nodeName]) })
      await emit({ type: 'run.paused', runId, at: now(), message: t("Flow paused") })
      return { runId, status: 'paused', artifacts: [...artifactByNode.values()], events, blocked }
    }
    const results = await Promise.allSettled(
      runnable.map(async (nodeId) => {
        const node = graph.nodes[nodeId]
        if (!node) return
        pending.delete(nodeId)
        try {
          await runNode(graph, runId, nodeId, node, artifactByNode, delayMs, emit, runOptions)
        } catch (error) {
          const cancelled = signal.aborted
          if (!cancelled) { failure = { error }; controller.abort(error) }
          await emit({
            type: 'node.status',
            runId,
            nodeId,
            status: cancelled ? 'cancelled' : 'failed',
            at: now(),
            message: cancelled ? t("{0} stopped", [node.name]) : error instanceof Error ? error.message : t('{0} failed', [node.name])
          })
          throw error
        }
      })
    )
    if (signal.aborted) break
    const failed = results.find((result) => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
  }

  if (signal.aborted) for (const nodeId of pending) {
    await emit({ type: 'node.status', runId, nodeId, status: 'cancelled', at: now(), message: t("Stopped before execution") })
  }
  if (failure) throw failure.error
  await emit({
    type: options.signal?.aborted ? 'run.cancelled' : 'run.completed',
    runId,
    at: now(),
    message: options.signal?.aborted ? t("Flow stopped") : t('Run completed')
  })

  return {
    runId,
    status: options.signal?.aborted ? 'cancelled' : 'completed',
    artifacts: [...artifactByNode.values()],
    events
  }
}

function unsupportedArtifactFiles(graph: GraphDefinition, nodeId: string, artifactByNode: Map<string, Artifact>) {
  const node = graph.nodes[nodeId]
  if (node?.type !== 'agent') return []
  if (node.provider === 'fake' || node.provider.startsWith('agent-tool:')) return []
  return dependenciesFor(graph, nodeId).flatMap<{ mode: string; mimeType: string; name: string }>((dependency) => {
    const source = graph.nodes[dependency]
    if (source?.type === 'input') return visibleInputItems(source).filter(item => item.mode === 'attachment').map(item => ({ ...item, mimeType: item.mimeType ?? '' }))
    const artifact = artifactByNode.get(dependency)
    return artifact ? transferableArtifact(source, artifact).files ?? [] : []
  }).flatMap((file) => {
    if (file.mode === 'text') return []
    if (file.mimeType.startsWith('image/') && !modelAttachmentIssue(node.provider, node.model, file.mimeType)) return []
    return [file.name]
  })
}

async function runNode(
  graph: GraphDefinition,
  runId: string,
  nodeId: string,
  node: GraphNodeDefinition,
  artifactByNode: Map<string, Artifact>,
  delayMs: number,
  emit: (event: RuntimeEvent) => Promise<void>,
  options: RuntimeOptions
) {
  options.signal?.throwIfAborted()
  await emit({
    type: 'node.status',
    runId,
    nodeId,
    status: 'running',
    at: now(),
    message: t('{0} started', [node.name])
  })

  if (delayMs > 0) await sleep(node.type === 'input' || node.type === 'output' ? delayMs / 3 : delayMs, options.signal)
  options.signal?.throwIfAborted()

  const parents = dependenciesFor(graph, nodeId)
    .map((dependency) => artifactByNode.get(dependency)?.id)
    .filter((id): id is string => Boolean(id))
  let content: string
  let files: ModelOutputFile[] | undefined
  let parts: ModelResponsePart[] | undefined
  let providerState: ModelProviderState | undefined
  const specifiedOutput = node.type === 'agent'
    ? Object.values(graph.nodes).find((candidate): candidate is OutputNodeDefinition => candidate.type === 'output' && candidate.ownerAgentId === nodeId)
    : undefined
  if (node.type === 'input') {
    content = inputText(node)
  } else if (node.type === 'output') {
    const owner = artifactByNode.get(node.ownerAgentId)
    files = owner?.files ?? []
    content = files.map((file) => file.name).join('\n')
  } else {
    const invocation = composeInvocation(graph, nodeId, artifactByNode)
    if (node.provider.toLowerCase() === 'fake') {
      content = fakeResponse(nodeId, node, invocation)
    } else {
      if (!options.modelInvoker) throw new Error(t("Provider {0} requires a model invoker", [node.provider]))
      const response = await invokeModelSafely(options.modelInvoker, {
        providerId: node.provider,
        model: node.model,
        messages: invocation.messages,
        parameters: node.parameters,
        outputDirectory: specifiedOutput ? { path: specifiedOutput.directory, note: specifiedOutput.note, extractText: specifiedOutput.extractText } : undefined
      }, (delta) => { if (!options.signal?.aborted) options.onTextDelta?.(nodeId, delta) }, options.signal, options.modelTimeoutMs)
      content = response.content
      files = response.files
      parts = response.parts
      providerState = response.providerState
    }
  }
  options.signal?.throwIfAborted()
  const version = options.artifactVersions?.[nodeId] ?? 1
  const artifact: Artifact = {
    id: `${runId}:${nodeId}:v${version}`,
    runId,
    nodeId,
    version,
    content,
    parentArtifacts: parents,
    sourceInputs:
      node.type === 'input'
        ? [nodeId]
        : collectInputSources(graph, nodeId, artifactByNode),
    createdAt: now(),
    files,
    parts,
    providerState
  }

  artifactByNode.set(nodeId, artifact)
  await emit({
    type: 'artifact.created',
    runId,
    nodeId,
    artifact,
    at: now(),
    message: t('{0} produced artifact v{1}', [node.name, version])
  })
  await emit({
    type: 'node.status',
    runId,
    nodeId,
    status: 'completed',
    at: now(),
    message: t('{0} completed', [node.name])
  })
}

export type { GraphDefinition } from '@agentflow/schema'
export * from './llm'
export * from './model-response'
export * from './model-parameters'
export * from './input-content'
