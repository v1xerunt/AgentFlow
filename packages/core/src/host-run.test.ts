import { describe, expect, it } from 'vitest'
import { graphDefinitionSchema } from '@agentflow/schema'
import { claimHostTask, createHostRun, failHostTask, hostRunStatus, retryHostTask, submitHostTask, validateHostGraph } from './host-run'

const at = '2026-09-04T12:00:00.000Z'
function fixture() {
  const worker = (name: string) => ({ type: 'agent', name, provider: 'host', model: 'inherit', prompts: {
    system: { content: `You are ${name}.` }, input: { content: 'Use the supplied material.' }, output: { content: 'Return your complete result.' }
  } })
  return graphDefinitionSchema.parse({ version: 1, name: 'Fork and merge', goal: 'Check both independent analyses', nodes: {
    source: { type: 'input', name: 'Source', items: [
      { id: 'public', name: 'Public', kind: 'text', mode: 'text', content: 'visible evidence' },
      { id: 'hidden', name: 'Hidden', kind: 'text', mode: 'text', content: 'hidden evidence', hidden: true }
    ] }, left: worker('Left'), right: worker('Right'), final: worker('Final')
  }, links: [
    { id: 'left', sourceId: 'source', targetId: 'left', type: 'input' },
    { id: 'right', sourceId: 'source', targetId: 'right', type: 'input' },
    { id: 'merge', sourceIds: ['left', 'right'], targetId: 'final', type: 'merge' }
  ] })
}

describe('host-driven execution', () => {
  it('releases a merge only after both real results and retains exact lineage', () => {
    const run = createHostRun(fixture(), '/workspace', 'run-a', at)
    expect(run.artifacts[0]?.content).toBe('visible evidence')
    expect(hostRunStatus(run).ready).toEqual(['left', 'right'])
    expect(() => claimHostTask(run, 'too-early', at, 'final')).toThrow('not ready')
    const left = claimHostTask(run, 'l', at)!
    const right = claimHostTask(run, 'r', at)!
    expect(JSON.stringify(left.invocation.messages)).toContain('visible evidence')
    expect(JSON.stringify(left.invocation.messages)).not.toContain('hidden evidence')
    expect(claimHostTask(run, 'none', at)).toBeNull()
    submitHostTask(run, right.task.id, 'right analysis', at)
    expect(hostRunStatus(run).ready).toEqual([])
    submitHostTask(run, left.task.id, 'left analysis', at)
    const merged = claimHostTask(run, 'm', at)!
    expect(merged.invocation.upstream.map(artifact => artifact.content)).toEqual(['left analysis', 'right analysis'])
    expect(JSON.stringify(merged.invocation.messages)).not.toContain('visible evidence')
    const final = submitHostTask(run, 'm', 'combined result', at)
    expect(final.parentArtifacts).toEqual(['run-a:left:v1', 'run-a:right:v1'])
    expect(final.sourceInputs).toEqual(['source'])
    expect(hostRunStatus(run).status).toBe('completed')
  })

  it('preserves accepted artifacts and makes identical submit retries idempotent', () => {
    const run = createHostRun(fixture(), '/workspace', 'run-b', at)
    claimHostTask(run, 'l', at)
    expect(() => submitHostTask(run, 'l', ' ', at)).toThrow('non-empty')
    const result = submitHostTask(run, 'l', 'complete text', at)
    expect(submitHostTask(run, 'l', 'complete text', at)).toBe(result)
    expect(() => submitHostTask(run, 'l', 'changed text', at)).toThrow('immutable')
    expect(run.artifacts).toHaveLength(2)
  })

  it('keeps failed attempts and rejects stale workers after a retry', () => {
    const run = createHostRun(fixture(), '/workspace', 'run-c', at)
    claimHostTask(run, 'l1', at)
    failHostTask(run, 'l1', 'Tool unavailable', at)
    expect(hostRunStatus(run).status).toBe('blocked')
    expect(hostRunStatus(run).ready).toEqual(['right'])
    const retry = retryHostTask(run, 'left', 'l2', at)
    expect(retry.task.attempt).toBe(2)
    expect(() => submitHostTask(run, 'l1', 'late response', at)).toThrow('no longer running')
    expect(() => retryHostTask(run, 'left', 'l3', at)).toThrow('Only a failed')
    submitHostTask(run, 'l2', 'recovered result', at)
    expect(run.tasks[0]?.status).toBe('failed')
  })

  it('rejects unsupported execution instead of silently reinterpreting the Flow', () => {
    const graph = fixture()
    if (graph.nodes.left?.type !== 'agent' || graph.nodes.source?.type !== 'input') throw new Error('fixture')
    graph.nodes.left.provider = 'fake'
    expect(() => validateHostGraph(graph)).toThrow('provider: host')
    graph.nodes.left.provider = 'host'
    graph.nodes.left.parameters = { temperature: 0.7 }
    expect(() => validateHostGraph(graph)).toThrow('parameters')
    delete graph.nodes.left.parameters
    graph.nodes.source.executionMode = 'for-each'
    expect(() => validateHostGraph(graph)).toThrow('for-each')
    delete graph.nodes.source.executionMode
    graph.nodes.source.items[0]!.mode = 'attachment'
    expect(() => validateHostGraph(graph)).toThrow('attachments')
  })

  it('takes an isolated graph snapshot and enforces the shared DAG constraints', () => {
    const graph = fixture()
    const run = createHostRun(graph, '/workspace', 'run-d', at)
    graph.goal = 'changed after starting'
    expect(run.graph.goal).toBe('Check both independent analyses')
    graph.links.push({ id: 'cycle', sourceId: 'final', targetId: 'left', type: 'pass' })
    expect(() => validateHostGraph(graph)).toThrow('DAG')
  })
})
