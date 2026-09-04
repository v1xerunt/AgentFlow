import { afterEach, describe, expect, it, vi } from 'vitest'
import { graphDefinitionSchema, linkSourceIds } from '@agentflow/schema'
import { executeGraph } from '@agentflow/core'
import { TUTORIAL_CSV, endTutorial, tutorialProviders, tutorialProvidersFor, tutorialReviewerSource, setTutorialStep, runTutorialFixture, tutorialLinkProgress, tutorialArtifacts, tutorialGraph } from './tutorial-project'
import { createDefaultWorkspaceState, duplicateFlow, loadWorkspaceState, normalizeWorkspaceState, removeWorkspaceProjects, preparePersistedWorkspaceState, saveTemporaryAsNewProject, startTutorial } from './workspace-store'
import { projectSnapshot } from '../../shared/flow-project'

afterEach(() => vi.unstubAllGlobals())

describe('guided office-work tutorial', () => {
  it('generates prompts with the Flow, then fills only the newly added reviewer', () => {
    const generated = tutorialGraph(1)
    expect(Object.values(generated.nodes).filter((node) => node.type === 'agent')).toHaveLength(5)
    for (const node of Object.values(generated.nodes)) if (node.type === 'agent') expect(Object.values(node.prompts).every((prompt) => prompt.content.length > 0)).toBe(true)
    const added = tutorialGraph(2)
    const filled = tutorialGraph(7)
    expect(added.nodes.reviewer?.type === 'agent' && added.nodes.reviewer.prompts.input.content).toBe('')
    expect(filled.nodes.reviewer?.type === 'agent' && filled.nodes.reviewer.prompts.input.content).not.toBe('')
    for (const id of Object.keys(generated.nodes)) expect(filled.nodes[id]).toEqual(generated.nodes[id])
    expect(new Set(filled.links.map((link) => link.type))).toEqual(new Set(['input', 'pass', 'review', 'revise', 'merge']))
  })

  it('keeps every stage valid for both local tools and carries Result lineage downstream', () => {
    for (const tool of ['codex', 'claude-code'] as const) for (let step = 0; step <= 11; step += 1) {
      expect(graphDefinitionSchema.safeParse(tutorialGraph(step, tool)).success).toBe(true)
    }
    const artifacts = tutorialArtifacts('graph', 'project', 11, 'claude-code')
    const result = artifacts.find((artifact) => artifact.nodeId === 'result')!
    const downstream = artifacts.find((artifact) => artifact.nodeId === 'delivery')!
    expect(result.files?.map((file) => file.name)).toEqual(['findings.md', 'summary.csv'])
    expect(downstream.parentArtifacts).toEqual([result.id])
    const rows = TUTORIAL_CSV().split('\n').slice(1).map((row) => row.split(','))
    expect(rows).toHaveLength(8)
    expect(rows.reduce((sum, row) => sum + Number(row[2]), 0) / rows.length).toBe(3.5)
    expect(rows.filter((row) => Number(row[2]) <= 3)).toHaveLength(4)
  })

  it('opens automatically only on first use and restores interrupted progress', async () => {
    vi.stubGlobal('window', { agentflowDesktop: { loadWorkspace: async () => null } })
    const first = await loadWorkspaceState()
    expect(first.tutorial?.status).toBe('active')
    expect(first.projects).toHaveLength(1)
    const saved = preparePersistedWorkspaceState(setTutorialStep(first, 4, 'claude-code'))
    vi.stubGlobal('window', { agentflowDesktop: { loadWorkspace: async () => saved } })
    const resumed = await loadWorkspaceState()
    expect(resumed.tutorial).toMatchObject({ status: 'active', step: 4, tool: 'claude-code' })
    expect(resumed.graphs[0]?.definition.nodes.local?.type === 'agent' && resumed.graphs[0].definition.nodes.local.provider).toBe('agent-tool:claude-code')
    for (const status of ['skipped', 'completed'] as const) {
      const dismissed = endTutorial(setTutorialStep(saved, 12), status)
      vi.stubGlobal('window', { agentflowDesktop: { loadWorkspace: async () => dismissed } })
      const reopened = await loadWorkspaceState()
      expect(reopened.tutorial?.status).toBe(status)
      expect(reopened.graphs.find((graph) => graph.id === first.tutorial!.graphId)?.definition.executionMode).toBe('tutorial')
    }
  })

  it('uses a single real project across replays and supports deletion', () => {
    const state = startTutorial(createDefaultWorkspaceState())
    expect(state.projects.filter(project => project.workspace.mode === 'directory')).toHaveLength(1)
    expect(state.projects.find(project => project.id === state.activeProjectId)!.workspace.mode).toBe('directory')
    expect(state.activeTemporaryProjectId).toBeUndefined()
    expect(preparePersistedWorkspaceState(state).projects).toHaveLength(1)
    const replayed = startTutorial(setTutorialStep(state, 8))
    expect(replayed.projects).toHaveLength(state.projects.length)
    expect(replayed.activeGraphId).toBe(state.activeGraphId)
    const deleted = removeWorkspaceProjects(replayed, [replayed.activeProjectId])
    expect(deleted.projects.some(project => project.id === state.activeProjectId)).toBe(false)
    expect(deleted.tutorial?.status).toBe('skipped')
    expect(startTutorial(deleted).projects).toHaveLength(state.projects.length)
  })

  it('advances only after actual links and preserves edited graph when providing outputs', () => {
    expect(tutorialLinkProgress(tutorialGraph(2), 2)).toBe(2)
    expect(tutorialLinkProgress(tutorialGraph(3), 2)).toBe(3)
    expect(tutorialLinkProgress(tutorialGraph(4), 3)).toBe(4)
    expect(tutorialLinkProgress(tutorialGraph(6), 5)).toBe(6)
    expect(tutorialLinkProgress(tutorialGraph(10), 9)).toBe(10)
    const state = setTutorialStep(startTutorial(createDefaultWorkspaceState()), 7)
    const graph = state.graphs.find((graph) => graph.id === state.activeGraphId)!
    graph.definition.nodes.writer!.position = { x: 620, y: 55 }
    const ran = runTutorialFixture(state, 8)
    expect(ran.graphs).toEqual(state.graphs)
    expect(ran.artifacts.some((artifact) => artifact.nodeId === 'result')).toBe(true)
    const complete = tutorialGraph(11)
    for (const link of complete.links) for (const source of linkSourceIds(link)) expect(complete.nodes[source]!.position!.x).toBeLessThan(complete.nodes[link.targetId]!.position!.x)
    expect(complete.nodes.local!.position!.y).toBeLessThan(complete.nodes.result!.position!.y)
    expect(complete.nodes.result!.position!.x).toBeLessThan(complete.nodes.delivery!.position!.x)
  })

  it('accepts tutorial reviewer models and routes local reviewer results through Input', () => {
    for (const reviewer of [{ provider: 'zai', model: 'glm-5.3' }, { provider: 'anthropic', model: 'claude-fable-5-1' }, { provider: 'agent-tool:codex', model: '@tool-default' }, { provider: 'agent-tool:claude-code', model: 'sonnet' }]) {
      const graph = tutorialGraph(7, 'codex', reviewer)
      expect(graph.nodes.reviewer).toMatchObject(reviewer)
      const source = tutorialReviewerSource(graph)
      const tool = reviewer.provider.startsWith('agent-tool:')
      expect(source).toBe(tool ? 'output_reviewer' : 'reviewer')
      expect(graph.links.find((link) => link.targetId === 'reviser')).toMatchObject({ sourceId: source, type: tool ? 'input' : 'revise' })
      expect(tutorialLinkProgress(graph, 4)).toBe(6)
      const artifacts = tutorialArtifacts('graph', 'project', 11, 'codex', graph)
      const review = artifacts.find((artifact) => artifact.nodeId === source)!
      expect(artifacts.find((artifact) => artifact.nodeId === 'reviser')?.parentArtifacts).toEqual([review.id])
      if (tool) expect(review.files?.[0]?.name).toBe('review.md')
      const state = startTutorial(createDefaultWorkspaceState())
      state.tutorial!.reviewer = reviewer
      const restored = setTutorialStep(state, 4)
      expect(restored.graphs.find((graph) => graph.id === state.activeGraphId)?.definition.nodes.reviewer).toMatchObject(reviewer)
    }
  })

  it('keeps the real model catalog unchanged when temporary tutorial choices end', () => {
    const real = [{ provider: 'openai', label: 'My models', configured: true, connector: 'model' as const, models: ['my-model'] }]
    const original = structuredClone(real)
    expect(tutorialProvidersFor(real, true)).toEqual(tutorialProviders)
    expect(tutorialProvidersFor(real, false)).toEqual(original)
    expect(real).toEqual(original)
    expect(tutorialProvidersFor([], false)).toEqual([])
  })

  it('switches every tutorial Agent to Fake on exit while retaining Result files and user work', () => {
    const original = saveTemporaryAsNewProject(createDefaultWorkspaceState(), 'My work', 'D:\\Example')
    let state = startTutorial(original)
    state.tutorial!.reviewer = { provider: 'agent-tool:codex', model: '@tool-default' }
    state = setTutorialStep(state, 12)
    const before = state.graphs.find((graph) => graph.id === state.activeGraphId)!
    for (const status of ['completed', 'skipped'] as const) {
      const finished = normalizeWorkspaceState(preparePersistedWorkspaceState(endTutorial(state, status)))!
      const graph = finished.graphs.find((graph) => graph.id === state.activeGraphId)!.definition
      expect(finished.tutorial).toMatchObject({ step: 12, status })
      expect(Object.values(graph.nodes).filter((node) => node.type === 'agent').every((node) => node.provider === 'fake' && node.model === 'agent-v1')).toBe(true)
      expect(graph.links).toEqual(before.definition.links)
      expect(graph.nodes.result).toEqual(before.definition.nodes.result)
      expect(graph.nodes.output_reviewer).toEqual(before.definition.nodes.output_reviewer)
      expect(finished.artifacts).toEqual(state.artifacts)
      expect(finished.graphs[0]).toEqual(original.graphs[0])
      expect(graphDefinitionSchema.safeParse({ ...graph, executionMode: undefined }).success).toBe(false)
    }
  })

  it('skips from any stage to the complete example with prompts, links and final files', () => {
    const original = saveTemporaryAsNewProject(createDefaultWorkspaceState(), 'My work', 'D:\\Example')
    for (const reviewer of [undefined, { provider: 'agent-tool:codex', model: '@tool-default' }, { provider: 'agent-tool:claude-code', model: 'sonnet' }]) {
      const initial = startTutorial(original)
      initial.tutorial!.reviewer = reviewer
      const completed = normalizeWorkspaceState(preparePersistedWorkspaceState(endTutorial(setTutorialStep(initial, 12), 'completed')))!
      const completeGraph = completed.graphs.find((graph) => graph.id === initial.activeGraphId)!.definition
      for (let step = 0; step <= 12; step += 1) {
        const skipped = normalizeWorkspaceState(preparePersistedWorkspaceState(endTutorial(setTutorialStep(initial, step), 'skipped')))!
        expect(skipped.tutorial).toMatchObject({ status: 'skipped', step: 12 })
        expect(skipped.graphs.find((graph) => graph.id === initial.activeGraphId)!.definition).toEqual(completeGraph)
        expect(skipped.artifacts).toEqual(completed.artifacts)
        expect(skipped.workingArtifactIds).toEqual(completed.workingArtifactIds)
        expect(skipped.graphs[0]).toEqual(original.graphs[0])
      }
    }
  })

  it('preserves existing work when replayed, saved, exported and duplicated', async () => {
    const original = saveTemporaryAsNewProject(createDefaultWorkspaceState(), 'My work', 'D:\\Example')
    const before = structuredClone(original)
    const tutorial = startTutorial(original)
    expect(tutorial.graphs[0]).toEqual(before.graphs[0])
    expect(original).toEqual(before)
    const saved = setTutorialStep(tutorial, 11)
    const normalized = normalizeWorkspaceState(preparePersistedWorkspaceState(saved))!
    expect(normalized.tutorial?.step).toBe(11)
    const snapshot = projectSnapshot(saved, saved.activeProjectId)
    expect(snapshot.graphs[0]?.definition.executionMode).toBe('tutorial')
    const duplicated = duplicateFlow(saved, saved.activeGraphId)
    const graph = duplicated.graphs.find((candidate) => candidate.id === duplicated.activeGraphId)!.definition
    const invoke = vi.fn()
    await expect(executeGraph(graph, { modelInvoker: invoke, delayMs: 0 })).rejects.toThrow('教程')
    expect(invoke).not.toHaveBeenCalled()
  })
})
