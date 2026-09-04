import { describe, expect, it } from 'vitest'
import { graphDefinitionSchema } from '@agentflow/schema'
import { nodeHasInputContent, resultFiles, type Artifact } from '@agentflow/core'
import { detachNodeFiles, toggleNodeFile } from './node-files'
import { agentRunInputIssue } from './agent-run-plan'
import { analyzeFlowRun, planBatchRuns } from './flow-analysis'
import { createDefaultWorkspaceState, forkFlowFromRun } from './workspace-store'

const prompt = { content: '', customized: false, locked: false }
const graph = graphDefinitionSchema.parse({ version: 1, name: 'Flow', goal: '', nodes: {
  owner: { type: 'agent', name: 'Owner', provider: 'agent-tool:codex', model: 'default', prompts: { system: prompt, input: prompt, output: prompt } },
  result: { type: 'output', name: 'Result', ownerAgentId: 'owner', directory: '.flow/results/owner' },
  agent: { type: 'agent', name: 'Agent', provider: 'fake', model: 'agent-v1', prompts: { system: prompt, input: prompt, output: prompt } },
  input: { type: 'input', name: 'Input', executionMode: 'for-each', items: [
    { id: 'a', name: 'a.md', kind: 'file', mode: 'text', content: 'alpha' },
    { id: 'b', name: 'b.md', kind: 'file', mode: 'text', content: 'beta' }
  ] }
}, links: [{ id: 'link', type: 'input', sourceId: 'result', targetId: 'agent' }] })
const artifact: Artifact = { id: 'v1', nodeId: 'result', runId: 'run', version: 1, content: 'a.md\nb.png', parentArtifacts: [], sourceInputs: [], createdAt: '', files: [
  { name: 'a.md', relativePath: 'a.md', mode: 'text', mimeType: 'text/markdown', size: 5, content: 'alpha' },
  { name: 'b.png', relativePath: 'b.png', mode: 'attachment', mimeType: 'image/png', size: 1, dataBase64: 'AA==' }
] }

describe('node file selection', () => {
  it('moves selected Result files into one Input and persists visibility without mutating the artifact', () => {
    const hidden = toggleNodeFile(graph, 'result', 'a.md', artifact)
    const moved = graphDefinitionSchema.parse(detachNodeFiles(hidden, { graphId: 'flow', nodeId: 'result', artifactId: 'v1', ids: ['a.md', 'b.png'] }, 'new', { x: 20, y: 30 }, artifact))
    expect(moved.nodes.new).toMatchObject({ type: 'input', position: { x: 20, y: 30 }, items: [{ content: 'alpha' }, { dataBase64: 'AA==', workspacePath: expect.stringContaining('.flow/') }] })
    expect(nodeHasInputContent(moved.nodes.new)).toBe(true)
    expect(nodeHasInputContent(moved.nodes.result, artifact)).toBe(false)
    expect(agentRunInputIssue(moved, 'agent', { result: artifact })).toBeTruthy()
    expect(artifact.files).toHaveLength(2)
    if (moved.nodes.result?.type !== 'output' || graph.nodes.result?.type !== 'output') throw new Error('fixture')
    expect(resultFiles(moved.nodes.result, artifact)).toEqual([])
    expect(resultFiles(graph.nodes.result, artifact)).toHaveLength(2)
    expect(resultFiles(moved.nodes.result, { ...artifact, id: 'v2' })).toHaveLength(2)
  })

  it('makes hidden Result files empty for single runs and restores them with the eye toggle', () => {
    const hidden = toggleNodeFile(toggleNodeFile(graph, 'result', 'a.md', artifact), 'result', 'b.png', artifact)
    expect(agentRunInputIssue(hidden, 'agent', { result: artifact })).toBeTruthy()
    const shown = toggleNodeFile(hidden, 'result', 'a.md', artifact)
    expect(agentRunInputIssue(shown, 'agent', { result: artifact })).toBeUndefined()
  })

  it('moves all Input items, preserving bytes and leaving the source empty', () => {
    const hidden = toggleNodeFile(graph, 'input', 'a')
    const moved = detachNodeFiles(hidden, { graphId: 'flow', nodeId: 'input', ids: ['a', 'b'] }, 'new', { x: 0, y: 0 })
    expect(moved.nodes.input).toMatchObject({ items: [] })
    expect(moved.nodes.new).toMatchObject({ items: [{ id: 'a', content: 'alpha', hidden: false }, { id: 'b', content: 'beta', hidden: false }] })
    expect(nodeHasInputContent(moved.nodes.input)).toBe(false)
    expect(() => detachNodeFiles(graph, { graphId: 'flow', nodeId: 'result', artifactId: 'old', ids: ['a.md'] }, 'new', { x: 0, y: 0 }, artifact)).toThrow('版本')
  })

  it('excludes hidden items from batches and blocks an entirely hidden Input', () => {
    const definition = { ...graph, links: [{ id: 'link', type: 'input' as const, sourceId: 'input', targetId: 'agent' }] }
    const hidden = toggleNodeFile(definition, 'input', 'a')
    const batch = planBatchRuns(hidden)
    expect(batch.batchSize).toBe(1)
    expect(batch.graphs[0]?.nodes.input).toMatchObject({ items: [{ id: 'b' }] })
    const empty = toggleNodeFile(hidden, 'input', 'b')
    expect(analyzeFlowRun(empty).canRun).toBe(false)
    expect(agentRunInputIssue(empty, 'agent', {})).toBeTruthy()
  })

  it('preserves file visibility when forking a saved State with new artifact IDs', () => {
    const state = createDefaultWorkspaceState()
    const source = state.graphs[0]!
    const snapshot = toggleNodeFile(graph, 'result', 'a.md', artifact)
    state.runs.push({ id: 'history', projectId: source.projectId, graphId: source.id, graphRevision: 1, sessionBindings: {}, workspaceSnapshot: state.projects[0]!.workspace, artifacts: [artifact], events: [], graphSnapshot: snapshot, artifactBindings: { result: artifact.id }, status: 'completed', createdAt: state.updatedAt })
    const fork = forkFlowFromRun(state, source.id, 'history')
    const definition = fork.graphs.find(value => value.id === fork.activeGraphId)!.definition
    const [id, result] = Object.entries(definition.nodes).find(([, node]) => node.type === 'output')!
    if (result.type !== 'output') throw new Error('fixture')
    const current = fork.artifacts.find(value => value.id === fork.workingArtifactIds[fork.activeGraphId]?.[id])!
    expect(resultFiles(result, current, true).map(file => file.name)).toEqual(['b.png'])
  })
})
