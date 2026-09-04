import { afterEach, describe, expect, it, vi } from 'vitest'
import { graphDefinitionSchema } from '@agentflow/schema'
import { createAgentSession, createDefaultWorkspaceState, createFlowInProject, duplicateFlow, forkFlowFromRun, isPristineTemporaryProject, loadWorkspaceState, normalizeWorkspaceState, openDirectoryProject, openOrCreateTemporaryProject, preparePersistedWorkspaceState, saveTemporaryAsNewProject } from './workspace-store'
import { projectSnapshot } from '../../shared/flow-project'
import { visibleChatMessages } from './chat-history'

afterEach(() => vi.unstubAllGlobals())

describe('Flow goal and prompt defaults', () => {
  it('stores a blank goal for every new Flow', () => {
    const initial = createDefaultWorkspaceState()
    expect(initial.graphs[0]!.definition.goal).toBe('')
    const second = createFlowInProject(initial, initial.activeProjectId)
    expect(second.graphs.every(graph => graph.definition.goal === '')).toBe(true)
    const directory = openDirectoryProject(initial, 'D:\\Goal-test')
    expect(directory.graphs.find(graph => graph.id === directory.activeGraphId)?.definition.goal).toBe('')
  })

})

describe('AgentSession creation', () => {
  it('restores independent chat branches with their saved parent relationships', () => {
    const state = createDefaultWorkspaceState()
    const graph = state.graphs[0]!
    const session = createAgentSession(graph.projectId, graph.id, 'agent', state.projects[0]!.workspace)
    session.messages = [
      { id: 'root-a', role: 'user', content: 'First candidate' },
      { id: 'reply-a', role: 'assistant', content: 'First answer', parentId: 'root-a' },
      { id: 'root-b', role: 'user', content: 'Second candidate' },
      { id: 'reply-b', role: 'assistant', content: 'Second answer', parentId: 'root-b' }
    ]
    session.activeLeafMessageId = 'reply-b'
    state.sessions = [session]
    const restored = normalizeWorkspaceState(JSON.parse(JSON.stringify(state)))!.sessions[0]!
    expect(restored.messages).toEqual(session.messages)
    expect(visibleChatMessages(restored).map(message => message.id)).toEqual(['root-b', 'reply-b'])
  })

  it('starts a temporary conversation without a synthetic model message', () => {
    const graph = graphDefinitionSchema.parse({
      version: 1,
      name: 'Temporary chat',
      goal: '开始轻量对话',
      nodes: {
        agent: {
          type: 'agent',
          name: '临时对话 1',
          provider: 'fake',
          model: 'agent-v1',
          prompts: {
            system: { content: '', customized: false, locked: false },
            input: { content: '用户尚未发送这段内容', customized: false, locked: false },
            output: { content: '', customized: false, locked: false }
          }
        }
      },
      links: []
    })
    const session = createAgentSession(
      'project',
      'graph',
      'agent',
      { mode: 'temporary', tempId: 'temp' },
      { title: '临时对话 1', origin: 'temporary-conversation' }
    )

    expect(session.origin).toBe('temporary-conversation')
    expect(session.title).toBe('临时对话 1')
    expect(session.messages).toEqual([])
  })
})

describe('Result artifact migration', () => {
  it('moves legacy chat output bindings from a local Agent to its Result node', () => {
    const state = createDefaultWorkspaceState()
    const graph = state.graphs[0]!
    graph.definition = graphDefinitionSchema.parse({
      version: 1,
      name: 'Local chat',
      goal: 'Publish a chat reply',
      nodes: {
        agent: { type: 'agent', name: 'Codex', provider: 'agent-tool:codex', model: '@tool-default', prompts: { system: { content: '', customized: false, locked: false }, input: { content: '', customized: false, locked: false }, output: { content: '', customized: false, locked: false } } }
      },
      links: []
    })
    const resultNodeId = Object.entries(graph.definition.nodes).find(([, node]) => node.type === 'output')![0]
    state.artifacts.push({ id: 'chat-output', runId: 'chat', nodeId: 'agent', version: 1, content: '# Reply', parentArtifacts: [], sourceInputs: [], createdAt: state.updatedAt, projectId: graph.projectId, graphId: graph.id, origin: 'chat-reply' })
    state.workingArtifactIds[graph.id] = { agent: 'chat-output' }

    const normalized = normalizeWorkspaceState(state)!

    expect(normalized.artifacts.find((artifact) => artifact.id === 'chat-output')?.nodeId).toBe(resultNodeId)
    expect(normalized.workingArtifactIds[graph.id]).toEqual({ [resultNodeId]: 'chat-output' })
  })
})

describe('opening a project directory', () => {
  it('starts a fresh temporary Project without recovering discarded work', async () => {
    const draft = createDefaultWorkspaceState()
    const saved = saveTemporaryAsNewProject(draft, 'Saved project', 'D:\\Work\\Saved')
    vi.stubGlobal('window', { agentflowDesktop: { loadWorkspace: async () => saved } })
    const recovered = await loadWorkspaceState()
    expect(recovered.projects.filter((project) => project.id === draft.activeTemporaryProjectId)).toHaveLength(1)
    expect(recovered.projects.find((project) => project.id === draft.activeTemporaryProjectId)?.workspace.mode).toBe('directory')
    expect(new Set(recovered.graphs.map((graph) => graph.id)).size).toBe(recovered.graphs.length)
  })

  it('reuses only an untouched temporary Project', () => {
    const initial = createDefaultWorkspaceState()
    const reused = openOrCreateTemporaryProject(initial)
    expect(reused.projects).toHaveLength(1)
    initial.graphs[0]!.definition.nodes.input = { type: 'input', name: 'Input', items: [] }
    const created = openOrCreateTemporaryProject(initial)
    expect(created.projects.filter((project) => project.workspace.mode === 'temporary')).toHaveLength(2)
    expect(isPristineTemporaryProject(created, created.activeProjectId)).toBe(true)
  })

  it('treats a changed Flow name or goal as an edited temporary Project', () => {
    const initial = createDefaultWorkspaceState()
    const graph = initial.graphs[0]!
    const edited = {
      ...initial,
      graphs: [{ ...graph, revision: graph.revision + 1, definition: { ...graph.definition, goal: 'A real goal' } }]
    }
    const created = openOrCreateTemporaryProject(edited)
    expect(created.projects.filter((project) => project.workspace.mode === 'temporary')).toHaveLength(2)
    expect(created.activeProjectId).not.toBe(initial.activeProjectId)
  })

  it('omits every temporary Project from persisted state', () => {
    const state = openOrCreateTemporaryProject(createDefaultWorkspaceState())
    state.graphs[0]!.definition.nodes.input = { type: 'input', name: 'Input', items: [] }
    const withSecond = openOrCreateTemporaryProject(state)
    expect(preparePersistedWorkspaceState(withSecond).projects.some((project) => project.workspace.mode === 'temporary')).toBe(false)
  })
  it('creates multiple Flows in one temporary Project and saves them together', () => {
    const initial = createDefaultWorkspaceState()
    const projectId = initial.activeTemporaryProjectId!
    const firstGraphId = initial.activeGraphId

    const withSecondFlow = createFlowInProject(initial, projectId)
    const temporaryFlows = withSecondFlow.graphs.filter((graph) => graph.projectId === projectId)

    expect(temporaryFlows.map((graph) => graph.definition.name)).toEqual(['未命名 Flow', 'Flow 2'])
    expect(withSecondFlow.activeProjectId).toBe(projectId)
    expect(withSecondFlow.activeTemporaryProjectId).toBe(projectId)
    expect(withSecondFlow.activeGraphId).not.toBe(firstGraphId)
    expect(isPristineTemporaryProject(withSecondFlow, projectId)).toBe(false)

    const saved = saveTemporaryAsNewProject(withSecondFlow, 'Saved project', 'D:\\Work\\Saved')
    expect(saved.graphs.filter((graph) => graph.projectId === projectId)).toHaveLength(2)
    expect(saved.projects.find((project) => project.id === projectId)?.workspace.mode).toBe('directory')
  })
  it('saves a temporary project to the selected folder and reopens its .flow snapshot', () => {
    const draft = createDefaultWorkspaceState()
    draft.graphs[0]!.definition.name = 'Persistent Flow'
    const saved = saveTemporaryAsNewProject(draft, 'Saved project', 'D:\\Work\\Saved')
    const savedProject = saved.projects.find((project) => project.name === 'Saved project')!
    expect(savedProject.workspace).toEqual({ mode: 'directory', rootPath: 'D:\\Work\\Saved' })
    const reopened = openDirectoryProject(createDefaultWorkspaceState(), 'D:\\Work\\Relocated', projectSnapshot(saved, savedProject.id))
    expect(reopened.projects.find((project) => project.id === savedProject.id)?.workspace).toEqual({ mode: 'directory', rootPath: 'D:\\Work\\Relocated' })
    expect(reopened.graphs.find((graph) => graph.id === reopened.activeGraphId)?.definition.name).toBe('Persistent Flow')
    expect(reopened.projects).toHaveLength(2)
  })
  it('adds a directory once and activates its initial graph', () => {
    const initial = createDefaultWorkspaceState()
    const opened = openDirectoryProject(initial, 'D:\\Work\\Demo')
    const project = opened.projects.find((candidate) => candidate.workspace.mode === 'directory')

    expect(project?.name).toBe('Demo')
    expect(project?.workspace).toEqual({ mode: 'directory', rootPath: 'D:\\Work\\Demo' })
    expect(opened.activeProjectId).toBe(project?.id)
    expect(opened.graphs.some((graph) => graph.projectId === project?.id && graph.id === opened.activeGraphId)).toBe(true)

    const reopened = openDirectoryProject(opened, 'd:/work/demo/')
    expect(reopened.projects.filter((candidate) => candidate.workspace.mode === 'directory')).toHaveLength(1)
    expect(reopened.activeProjectId).toBe(project?.id)
  })
})

describe('duplicating a Flow', () => {
  it('creates and activates an independent copy without copying run history', () => {
    const initial = createDefaultWorkspaceState()
    const source = initial.graphs[0]!
    source.definition.name = 'Research Flow'
    source.definition.nodes.input = { type: 'input', name: 'Brief', items: [{ id: 'item', name: 'Brief', kind: 'text', mode: 'text', content: 'Original' }] }
    source.definition.nodes.agent = { type: 'agent', name: 'Researcher', provider: 'agent-tool:codex', model: '@tool-default', prompts: { system: { content: '', customized: false, locked: false }, input: { content: '', customized: false, locked: false }, output: { content: '', customized: false, locked: false } } }
    source.definition.nodes.output = { type: 'output', name: 'Result', ownerAgentId: 'agent', directory: '.flow/agent-results/agent', note: '', extractText: true }
    source.definition.links = [{ id: 'input-link', sourceId: 'input', targetId: 'agent', type: 'input' }]
    initial.runs.push({ id: 'run', projectId: source.projectId, graphId: source.id, graphRevision: source.revision, sessionBindings: {}, workspaceSnapshot: initial.projects[0]!.workspace, events: [], artifacts: [], createdAt: new Date().toISOString() })

    const duplicated = duplicateFlow(initial, source.id)
    const copy = duplicated.graphs.find((graph) => graph.id === duplicated.activeGraphId)!

    expect(copy.id).not.toBe(source.id)
    expect(copy.projectId).toBe(source.projectId)
    expect(copy.definition.name).toBe('Research Flow 副本')
    const sourceNodeIds = new Set(Object.keys(source.definition.nodes))
    expect(Object.keys(copy.definition.nodes).every((nodeId) => !sourceNodeIds.has(nodeId))).toBe(true)
    expect(copy.definition.nodes).not.toBe(source.definition.nodes)
    const copiedAgent = Object.entries(copy.definition.nodes).find(([, node]) => node.type === 'agent')!
    const copiedOutput = Object.values(copy.definition.nodes).find((node) => node.type === 'output')!
    expect(copiedOutput).toMatchObject({ ownerAgentId: copiedAgent[0], directory: `.flow/agent-results/${copiedAgent[0]}` })
    expect(copy.definition.links[0]).toMatchObject({ sourceId: Object.entries(copy.definition.nodes).find(([, node]) => node.type === 'input')![0], targetId: copiedAgent[0] })
    expect(duplicated.runs).toHaveLength(1)
    expect(duplicated.runs[0]!.graphId).toBe(source.id)
  })

  it('increments the suffix when the copy name already exists', () => {
    const initial = createDefaultWorkspaceState()
    initial.graphs[0]!.definition.name = 'Flow'
    const first = duplicateFlow(initial, initial.graphs[0]!.id)
    const second = duplicateFlow(first, initial.graphs[0]!.id)
    expect(second.graphs.map((graph) => graph.definition.name)).toContain('Flow 副本 2')
  })
})

describe('forking a historical State', () => {
  it('creates an independent Flow with inherited artifact bindings and preserves the original Working State', () => {
    const initial = createDefaultWorkspaceState()
    const source = initial.graphs[0]!
    source.definition.name = 'Current Working'
    const historical = graphDefinitionSchema.parse({
      version: 1,
      name: 'Historical Flow',
      goal: 'Historical goal',
      nodes: { agent: { type: 'agent', name: 'Agent', provider: 'fake', model: 'fake', prompts: { system: { content: '', customized: false, locked: false }, input: { content: '', customized: false, locked: false }, output: { content: '', customized: false, locked: false } } } },
      links: []
    })
    const createdAt = new Date().toISOString()
    initial.runs.push({ id: 'run-history', name: 'Approved draft', projectId: source.projectId, graphId: source.id, graphRevision: 1, sessionBindings: {}, workspaceSnapshot: initial.projects[0]!.workspace, artifacts: [{ id: 'artifact-old', runId: 'run-history', nodeId: 'agent', version: 1, content: 'Historical output', parentArtifacts: [], sourceInputs: [], createdAt }], events: [], graphSnapshot: historical, artifactBindings: { agent: 'artifact-old' }, status: 'completed', createdAt, completedAt: createdAt })
    initial.activeHistoryRunIds[source.id] = 'run-history'

    const forked = forkFlowFromRun(initial, source.id, 'run-history')
    const original = forked.graphs.find((graph) => graph.id === source.id)!
    const branch = forked.graphs.find((graph) => graph.id === forked.activeGraphId)!
    const branchAgentId = Object.entries(branch.definition.nodes).find(([, node]) => node.type === 'agent')![0]
    const selectedArtifactId = forked.workingArtifactIds[branch.id]?.[branchAgentId]

    expect(source.definition.name).toBe('Current Working')
    expect(original.definition.name).toBe('Current Working')
    expect(forked.activeHistoryRunIds[source.id]).toBe('run-history')
    expect(forked.activeHistoryRunIds[branch.id]).toBeUndefined()
    expect(branch.definition.name).toBe('Historical Flow · 派生')
    expect(branch.id).not.toBe(source.id)
    expect(selectedArtifactId).toBeTruthy()
    expect(selectedArtifactId).not.toBe('artifact-old')
    expect(forked.artifacts.find((artifact) => artifact.id === selectedArtifactId)).toMatchObject({ graphId: branch.id, nodeId: branchAgentId, content: 'Historical output' })
    expect(forked.workingBaseRunIds[branch.id]).toBe('run-history')
  })
})
