import { describe, expect, it, vi } from 'vitest'
import { graphDefinitionSchema, validateLinkCandidate, validateMergeCandidate } from '@agentflow/schema'
import { composeInvocation, executeGraph } from './index'

const graph = graphDefinitionSchema.parse({
  version: 1,
  name: 'Review flow',
  goal: 'Create and review a prototype plan',
  nodes: {
    brief: {
      type: 'input',
      name: 'Brief',
      content: 'Build AgentFlow'
    },
    planner: {
      type: 'agent',
      name: 'Planner',
      provider: 'fake',
      model: 'planner-v1',
      graphRolePrompt: 'Create the plan.'
    },
    reviewer: {
      type: 'agent',
      name: 'Reviewer',
      provider: 'fake',
      model: 'reviewer-v1',
      graphRolePrompt: 'Review the upstream plan.'
    }
  },
  links: [
    { id: 'brief-planner', sourceId: 'brief', targetId: 'planner', type: 'input' },
    { id: 'planner-reviewer', sourceId: 'planner', targetId: 'reviewer', type: 'review' }
  ]
})

describe('runtime', () => {
  it('resets every scheduled node before execution and immediately cancels parallel and downstream work on empty output', async () => {
    const draft = graphDefinitionSchema.parse({ ...graph, nodes: {
      ...graph.nodes,
      planner: { ...graph.nodes.planner, provider: 'test' },
      parallel: { ...graph.nodes.planner, name: 'Parallel', provider: 'test' }
    }, links: [...graph.links, { id: 'parallel', sourceId: 'brief', targetId: 'parallel', type: 'input' }] })
    const events: any[] = []
    let parallelSignal: AbortSignal | undefined
    const invoker = vi.fn(async (request, _delta, signal) => {
      expect(events.filter(event => event.type === 'node.status' && event.status === 'waiting')).toHaveLength(4)
      if (invoker.mock.calls.length === 1) { await Promise.resolve(); return { providerId: 'test', model: 'test', content: '  ' } }
      parallelSignal = signal
      return new Promise<never>(() => {})
    })
    await expect(executeGraph(draft, { delayMs: 0, modelInvoker: invoker, onEvent: event => { events.push(event) } })).rejects.toThrow(/返回文本|returning text/)
    expect(parallelSignal?.aborted).toBe(true)
    expect(events.filter(event => event.type === 'artifact.created').map(event => event.nodeId)).toEqual(['brief'])
    expect(events.filter(event => event.type === 'node.status').slice(-3).map(event => [event.nodeId, event.status])).toEqual(expect.arrayContaining([['planner', 'failed'], ['parallel', 'cancelled'], ['reviewer', 'cancelled']]))
    expect(invoker).toHaveBeenCalledTimes(2)
  })

  it('stops the Flow on a model timeout before invoking its downstream', async () => {
    const draft = graphDefinitionSchema.parse({ ...graph, nodes: { ...graph.nodes, planner: { ...graph.nodes.planner, provider: 'test' } } })
    const invoker = vi.fn(() => new Promise<never>(() => {}))
    await expect(executeGraph(draft, { delayMs: 0, modelInvoker: invoker, modelTimeoutMs: 20 })).rejects.toThrow(/超时|timed out/)
    expect(invoker).toHaveBeenCalledTimes(1)
  })
  it('stops before starting nodes for an already aborted run', async () => {
    const result = await executeGraph(graph, { signal: AbortSignal.abort(), delayMs: 0 })
    expect(result.status).toBe('cancelled')
    expect(result.artifacts).toEqual([])
    expect(result.events.at(-1)?.type).toBe('run.cancelled')
    expect(result.events.some((event) => event.type === 'node.status' && event.status === 'running')).toBe(false)
  })

  it('preserves completed input and ignores a late model result after cancellation', async () => {
    const controller = new AbortController()
    const real = structuredClone(graph)
    if (real.nodes.planner?.type === 'agent') real.nodes.planner.provider = 'test-provider'
    const modelInvoker = vi.fn(async (_request, onDelta, signal) => {
      controller.abort()
      expect(signal?.aborted).toBe(true)
      onDelta?.('late text')
      return { content: 'late result', providerId: 'test-provider', model: 'test' }
    })
    const onTextDelta = vi.fn()
    const result = await executeGraph(real, { signal: controller.signal, delayMs: 0, modelInvoker, onTextDelta })
    expect(result.status).toBe('cancelled')
    expect(result.artifacts.map((artifact) => artifact.nodeId)).toEqual(['brief'])
    expect(modelInvoker).toHaveBeenCalledTimes(1)
    expect(onTextDelta).not.toHaveBeenCalled()
    expect(result.events.some((event) => event.type === 'node.status' && event.nodeId === 'reviewer' && event.status === 'running')).toBe(false)
  })
  it('executes a graph and preserves lineage', async () => {
    const result = await executeGraph(graph, { delayMs: 0 })
    expect(result.status).toBe('completed')
    expect(result.artifacts).toHaveLength(3)
    const reviewer = result.artifacts.find((artifact) => artifact.nodeId === 'reviewer')
    expect(reviewer?.parentArtifacts).toHaveLength(1)
    expect(reviewer?.sourceInputs).toEqual(['brief'])
  })

  it('allocates the requested immutable artifact versions', async () => {
    const result = await executeGraph(graph, { delayMs: 0, artifactVersions: { brief: 4, planner: 7, reviewer: 3 } })
    expect(Object.fromEntries(result.artifacts.map((artifact) => [artifact.nodeId, artifact.version]))).toEqual({ brief: 4, planner: 7, reviewer: 3 })
    expect(result.artifacts.find((artifact) => artifact.nodeId === 'planner')?.id).toContain(':planner:v7')
  })

  it('composes the target agent prompt from upstream artifacts', async () => {
    const result = await executeGraph(graph, { delayMs: 0 })
    const artifacts = new Map(result.artifacts.map((artifact) => [artifact.nodeId, artifact]))
    const invocation = composeInvocation(graph, 'reviewer', artifacts)
    const prompt = invocation.messages.map((message) => typeof message.content === 'string' ? message.content : message.content.map((part) => part.type === 'text' ? part.text : '').join('\n')).join('\n')
    expect(prompt).toContain('Review the upstream plan.')
    expect(prompt).toContain('原型方案')
    expect(invocation.relations).toEqual(['review'])
  })

  it('rejects links that target inputs or introduce a cycle', () => {
    expect(
      validateLinkCandidate(graph, {
        sourceId: 'planner',
        targetId: 'brief',
        type: 'pass'
      })
    ).toBe('invalid-target')

    expect(
      validateLinkCandidate(graph, {
        sourceId: 'reviewer',
        targetId: 'planner',
        type: 'revise'
      })
    ).toBe('cycle')
  })

  it('accepts provider parameters in agent definitions', () => {
    const configured = graphDefinitionSchema.parse({
      ...graph,
      nodes: {
        ...graph.nodes,
        planner: {
          ...graph.nodes.planner,
          parameters: {
            temperature: 0.4,
            maxTokens: 4096,
            reasoningLevel: 'high'
          }
        }
      }
    })

    expect(configured.nodes.planner?.type).toBe('agent')
    if (configured.nodes.planner?.type === 'agent') {
      expect(configured.nodes.planner.parameters?.maxTokens).toBe(4096)
    }
  })

  it('treats Merge as one logical link with multiple upstream agents', async () => {
    const mergeGraph = graphDefinitionSchema.parse({
      ...graph,
      nodes: {
        ...graph.nodes,
        finalizer: {
          type: 'agent',
          name: 'Finalizer',
          provider: 'fake',
          model: 'finalizer-v1',
          graphRolePrompt: 'Merge the upstream results.'
        }
      },
      links: [
        ...graph.links,
        {
          id: 'planner-reviewer-finalizer',
          sourceIds: ['planner', 'reviewer'],
          targetId: 'finalizer',
          type: 'merge'
        }
      ]
    })

    const result = await executeGraph(mergeGraph, { delayMs: 0 })
    const artifacts = new Map(result.artifacts.map((artifact) => [artifact.nodeId, artifact]))
    const invocation = composeInvocation(mergeGraph, 'finalizer', artifacts)
    const finalizer = artifacts.get('finalizer')

    expect(invocation.upstream.map((artifact) => artifact.nodeId)).toEqual(['planner', 'reviewer'])
    expect(invocation.relations).toEqual(['merge'])
    expect(finalizer?.parentArtifacts).toHaveLength(2)
    expect(finalizer?.sourceInputs).toEqual(['brief'])
  })

  it('requires at least two agent sources for Merge', () => {
    expect(validateMergeCandidate(graph, { sourceIds: ['planner'], targetId: 'reviewer' })).toBe('merge-needs-sources')
    expect(validateMergeCandidate(graph, { sourceIds: ['brief', 'planner'], targetId: 'reviewer' })).toBe('merge-source-must-be-agent')
  })

  it('pauses on an unsupported output file and resumes without rerunning completed nodes', async () => {
    const fileFlow = graphDefinitionSchema.parse({
      version: 1,
      name: 'File flow',
      goal: 'Create and consume a file',
      nodes: {
        input: { type: 'input', name: 'Brief', items: [{ id: 'text', name: 'Text', kind: 'text', mode: 'text', content: 'Create it' }] },
        local: { type: 'agent', name: 'Codex Agent', provider: 'agent-tool:codex', model: 'gpt-5.6-sol', prompts: { system: { content: '', locked: false, customized: false }, input: { content: '', locked: false, customized: false }, output: { content: '', locked: false, customized: false } } },
        result: { type: 'output', name: 'Result', ownerAgentId: 'local', directory: '.flow/agent-results/local', note: 'A PDF report', extractText: false },
        consumer: { type: 'agent', name: 'Consumer', provider: 'openai', model: 'gpt-5.6-sol', prompts: { system: { content: '', locked: false, customized: false }, input: { content: '', locked: false, customized: false }, output: { content: '', locked: false, customized: false } } }
      },
      links: [
        { id: 'input-local', sourceId: 'input', targetId: 'local', type: 'input' },
        { id: 'result-consumer', sourceId: 'result', targetId: 'consumer', type: 'input' }
      ]
    })
    const modelInvoker = vi.fn(async (request: { providerId: string; outputDirectory?: unknown }) => request.providerId === 'agent-tool:codex'
      ? { content: 'Created', providerId: request.providerId, model: 'gpt-5.6-sol', files: [{ name: 'report.pdf', relativePath: 'report.pdf', mimeType: 'application/pdf', size: 4, mode: 'attachment' as const, dataBase64: 'AAAA' }] }
      : { content: 'Consumed', providerId: request.providerId, model: 'gpt-5.6-sol' })

    const paused = await executeGraph(fileFlow, { delayMs: 0, modelInvoker })
    expect(paused.status).toBe('paused')
    expect(paused.blocked).toMatchObject({ nodeId: 'consumer', files: ['report.pdf'] })
    expect(paused.artifacts.map((artifact) => artifact.nodeId)).toEqual(['input', 'local', 'result'])
    expect(modelInvoker).toHaveBeenCalledTimes(1)
    expect(modelInvoker.mock.calls[0]?.[0]).toMatchObject({ outputDirectory: { path: '.flow/agent-results/local', extractText: false } })

    const resumed = await executeGraph(fileFlow, { delayMs: 0, modelInvoker, resumeArtifacts: paused.artifacts, skipUnsupportedFiles: true })
    expect(resumed.status).toBe('completed')
    expect(resumed.artifacts.map((artifact) => artifact.nodeId)).toEqual(['input', 'local', 'result', 'consumer'])
    expect(modelInvoker).toHaveBeenCalledTimes(2)
  })
})
