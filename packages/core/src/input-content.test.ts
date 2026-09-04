import { describe, expect, it, vi } from 'vitest'
import type { GraphDefinition, InputNodeDefinition, OutputNodeDefinition } from '@agentflow/schema'
import { composeInvocation, executeGraph, nodeHasInputContent, type Artifact } from './index'

const prompt = { content: '', customized: false, locked: false }
const result: OutputNodeDefinition = { type: 'output', name: 'Result', ownerAgentId: 'owner', directory: '.flow/results/owner', note: '', extractText: true }
const artifact: Artifact = { id: 'result-v1', nodeId: 'result', runId: 'run', version: 1, content: 'keep.md\nprivate.md\nprivate.png', parentArtifacts: [], sourceInputs: [], createdAt: '', files: [
  { name: 'keep.md', relativePath: 'keep.md', mode: 'text', mimeType: 'text/markdown', size: 4, content: 'public report' },
  { name: 'private.md', relativePath: 'private.md', mode: 'text', mimeType: 'text/markdown', size: 4, content: 'private notes' },
  { name: 'private.png', relativePath: 'private.png', mode: 'attachment', mimeType: 'image/png', size: 1, dataBase64: 'AA==' }
] }
const graph = (source: InputNodeDefinition | OutputNodeDefinition): GraphDefinition => ({ version: 1, name: 'Flow', goal: '', nodes: {
  result: source, agent: { type: 'agent', name: 'Agent', provider: 'openai', model: 'gpt-5', prompts: { system: prompt, input: prompt, output: prompt } }
}, links: [{ id: 'link', type: 'input', sourceId: 'result', targetId: 'agent' }] })

describe('file inputs', () => {
  it('sends only visible Result text and images, preserving the original artifact', () => {
    const source = { ...result, fileStates: { [artifact.id]: { 'private.md': 'hidden' as const, 'private.png': 'detached' as const } } }
    const invocation = composeInvocation(graph(source), 'agent', new Map([['result', artifact]]))
    expect(JSON.stringify(invocation)).toContain('public report')
    expect(JSON.stringify(invocation)).not.toContain('private')
    expect(invocation.upstream[0]?.files).toHaveLength(1)
    expect(artifact.files).toHaveLength(3)
  })

  it('rebuilds cached Input content from current visibility', () => {
    const source: InputNodeDefinition = { type: 'input', name: 'Input', items: [
      { id: 'a', name: 'keep', mode: 'text', kind: 'text', content: 'visible' },
      { id: 'b', name: 'private', mode: 'text', kind: 'text', content: 'private notes', hidden: true },
      { id: 'c', name: 'private.png', mode: 'attachment', kind: 'file', content: '', mimeType: 'image/png', dataBase64: 'AA==', hidden: true }
    ] }
    const invocation = composeInvocation(graph(source), 'agent', new Map([['result', { ...artifact, content: 'stale private notes' }]]))
    expect(JSON.stringify(invocation)).toContain('visible')
    expect(JSON.stringify(invocation)).not.toContain('private')
    expect(invocation.messages.at(-1)?.content).toBeTypeOf('string')
  })

  it.each(['hidden', 'detached'] as const)('rejects a Result whose files are all %s before calling the model', async state => {
    const source = { ...result, fileStates: { [artifact.id]: Object.fromEntries(artifact.files!.map(file => [file.relativePath, state])) } }
    expect(nodeHasInputContent(source, artifact)).toBe(false)
    const modelInvoker = vi.fn()
    await expect(executeGraph(graph(source), { delayMs: 0, resumeArtifacts: [artifact], modelInvoker })).rejects.toThrow('上游输入为空')
    expect(modelInvoker).not.toHaveBeenCalled()
  })

  it('uses the same empty content rule for Input and Result, including filename-only summaries', () => {
    expect(nodeHasInputContent(result, { ...artifact, files: [] })).toBe(false)
    expect(nodeHasInputContent(result, { ...artifact, files: [{ ...artifact.files![0]!, content: '  ' }] })).toBe(false)
    expect(nodeHasInputContent({ type: 'input', name: 'Input', items: [{ id: 'a', name: 'a', kind: 'text', mode: 'text', content: 'valid', hidden: true }] }, artifact)).toBe(false)
    expect(nodeHasInputContent({ type: 'input', name: 'Input', items: [] }, artifact)).toBe(false)
    expect(nodeHasInputContent(result, { ...artifact, files: [artifact.files![2]!] })).toBe(true)
  })

  it('gives local tools the snapshot path of a detached binary Input', () => {
    const definition = graph({ type: 'input', name: 'Input', items: [{ id: 'image', name: 'chart.png', kind: 'file', mode: 'attachment', content: '', dataBase64: 'AA==', mimeType: 'image/png', workspacePath: '.flow/artifacts/result/chart.png' }] })
    if (definition.nodes.agent?.type !== 'agent') throw new Error('fixture')
    definition.nodes.agent.provider = 'agent-tool:codex'
    const invocation = composeInvocation(definition, 'agent', new Map([['result', artifact]]))
    expect(invocation.messages.at(-1)?.content).toContain('.flow/artifacts/result/chart.png')
    expect(invocation.messages.at(-1)?.content).toBeTypeOf('string')
  })
})
