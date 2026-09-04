import { localizeLabel } from '@agentflow/core/localization'
import { directoryPathIdentity, normalizeDirectoryPath } from '../../shared/directory-path'
import { t } from '@agentflow/core/localization'
import {
  graphDefinitionSchema,
  projectDefinitionSchema,
  workspaceBindingSchema,
  type GraphDefinition,
  type WorkspaceBinding
} from '@agentflow/schema'
import type {
  AgentSession,
  StoredGraph,
  WorkspaceState
} from '../../shared/workspace'
import { TUTORIAL_PROJECT_ID, TUTORIAL_GRAPH_ID } from '../../shared/tutorial-content'
import { setTutorialStep, tutorialGraph } from './tutorial-project'

const STORAGE_KEY = 'agentflow.workspace.v1'

export function createId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}_${suffix}`
}

export function duplicateFlow(state: WorkspaceState, graphId: string): WorkspaceState {
  const source = state.graphs.find((graph) => graph.id === graphId)
  if (!source) return state
  const project = state.projects.find((candidate) => candidate.id === source.projectId)
  const names = new Set(state.graphs.filter((graph) => graph.projectId === source.projectId).map((graph) => graph.definition.name))
  const baseName = t("{0} copy", [source.definition.name])
  let name = baseName
  for (let suffix = 2; names.has(name); suffix += 1) name = `${baseName} ${suffix}`
  const nodeIds = new Map(Object.entries(source.definition.nodes).map(([nodeId, node]) => [nodeId, createId(node.type)]))
  const nodes = Object.fromEntries(Object.entries(source.definition.nodes).map(([nodeId, node]) => {
    const nextId = nodeIds.get(nodeId)!
    if (node.type !== 'output') return [nextId, node]
    const ownerAgentId = nodeIds.get(node.ownerAgentId)!
    return [nextId, { ...node, ownerAgentId, directory: `.flow/agent-results/${ownerAgentId}`, fileStates: undefined }]
  }))
  const links = source.definition.links.map((link) => link.type === 'merge'
    ? { ...link, id: createId('link'), sourceIds: link.sourceIds.map((sourceId) => nodeIds.get(sourceId)!), targetId: nodeIds.get(link.targetId)! }
    : { ...link, id: createId('link'), sourceId: nodeIds.get(link.sourceId)!, targetId: nodeIds.get(link.targetId)! })
  const groups = source.definition.groups?.map((group) => ({ ...group, id: createId('group'), nodeIds: group.nodeIds.map((nodeId) => nodeIds.get(nodeId)!) }))
  const now = new Date().toISOString()
  const copy: StoredGraph = {
    id: createId('graph'),
    projectId: source.projectId,
    revision: 1,
    definition: graphDefinitionSchema.parse({ ...source.definition, name, nodes, links, groups }),
    createdAt: now,
    updatedAt: now
  }
  return {
    ...state,
    graphs: [...state.graphs, copy],
    activeProjectId: source.projectId,
    activeGraphId: copy.id,
    ...(project?.workspace.mode === 'temporary' ? { activeTemporaryProjectId: source.projectId } : {}),
    updatedAt: now
  }
}

export function createFlowInProject(state: WorkspaceState, projectId: string): WorkspaceState {
  const project = state.projects.find((candidate) => candidate.id === projectId)
  if (!project) return state
  const now = new Date().toISOString()
  const graphId = createId('graph')
  const projectGraphs = state.graphs.filter((candidate) => candidate.projectId === projectId)
  const name = uniqueName(`Flow ${projectGraphs.length + 1}`, new Set(projectGraphs.map((candidate) => candidate.definition.name)))
  const graph: StoredGraph = {
    id: graphId,
    projectId,
    revision: 1,
    definition: graphDefinitionSchema.parse({
      version: 1,
      name,
      goal: '',
      nodes: {},
      links: []
    }),
    createdAt: now,
    updatedAt: now
  }
  return {
    ...state,
    graphs: [...state.graphs, graph],
    activeProjectId: projectId,
    activeGraphId: graphId,
    ...(project.workspace.mode === 'temporary' ? { activeTemporaryProjectId: projectId } : {}),
    updatedAt: now
  }
}

export function forkFlowFromRun(state: WorkspaceState, graphId: string, runId: string): WorkspaceState {
  const source = state.graphs.find((graph) => graph.id === graphId)
  const run = state.runs.find((candidate) => candidate.id === runId && candidate.graphId === graphId)
  if (!source || !run?.graphSnapshot) return state
  const names = new Set(state.graphs.filter((graph) => graph.projectId === source.projectId).map((graph) => graph.definition.name))
  const baseName = t('{0} · Fork', [run.graphSnapshot.name])
  let name = baseName
  for (let suffix = 2; names.has(name); suffix += 1) name = `${baseName} ${suffix}`
  const nodeIds = new Map(Object.entries(run.graphSnapshot.nodes).map(([nodeId, node]) => [nodeId, createId(node.type)]))
  const artifactIds = new Map(run.artifacts.map((artifact) => [artifact.id, createId('artifact')]))
  const nodes = Object.fromEntries(Object.entries(run.graphSnapshot.nodes).map(([nodeId, node]) => {
    const nextId = nodeIds.get(nodeId)!
    if (node.type !== 'output') return [nextId, structuredClone(node)]
    const ownerAgentId = nodeIds.get(node.ownerAgentId)!
    const fileStates = node.fileStates && Object.fromEntries(Object.entries(node.fileStates).flatMap(([id, states]) => artifactIds.has(id) ? [[artifactIds.get(id)!, structuredClone(states)]] : []))
    return [nextId, { ...structuredClone(node), ownerAgentId, directory: `.flow/agent-results/${ownerAgentId}`, fileStates }]
  }))
  const links = run.graphSnapshot.links.map((link) => link.type === 'merge'
    ? { ...structuredClone(link), id: createId('link'), sourceIds: link.sourceIds.map((sourceId) => nodeIds.get(sourceId)!), targetId: nodeIds.get(link.targetId)! }
    : { ...structuredClone(link), id: createId('link'), sourceId: nodeIds.get(link.sourceId)!, targetId: nodeIds.get(link.targetId)! })
  const groups = run.graphSnapshot.groups?.map((group) => ({ ...structuredClone(group), id: createId('group'), nodeIds: group.nodeIds.map((nodeId) => nodeIds.get(nodeId)!) }))
  const now = new Date().toISOString()
  const graph: StoredGraph = {
    id: createId('graph'),
    projectId: source.projectId,
    revision: 1,
    definition: graphDefinitionSchema.parse({ ...run.graphSnapshot, name, nodes, links, groups }),
    createdAt: now,
    updatedAt: now
  }
  const artifacts = run.artifacts.flatMap((artifact) => {
    const nextNodeId = nodeIds.get(artifact.nodeId)
    if (!nextNodeId) return []
    return [{
      ...structuredClone(artifact),
      id: artifactIds.get(artifact.id)!,
      nodeId: nextNodeId,
      parentArtifacts: artifact.parentArtifacts.map((id) => artifactIds.get(id) ?? id),
      projectId: source.projectId,
      graphId: graph.id,
      origin: 'run' as const,
      label: t("Forked from {0}", [run.name ?? t("Historical state")])
    }]
  })
  const artifactBindings = Object.fromEntries(artifacts.map((artifact) => [artifact.nodeId, artifact.id]))
  return reconcileWorkspaceState({
    ...state,
    graphs: [...state.graphs, graph],
    artifacts: [...state.artifacts, ...artifacts],
    workingArtifactIds: { ...state.workingArtifactIds, [graph.id]: artifactBindings },
    workingBaseRunIds: { ...state.workingBaseRunIds, [graph.id]: run.id },
    activeProjectId: source.projectId,
    activeGraphId: graph.id,
    updatedAt: now
  })
}

export function createDefaultWorkspaceState(): WorkspaceState {
  return attachFreshTemporaryProject(createEmptyWorkspaceState())
}

export function removeWorkspaceProjects(state: WorkspaceState, ids: string[]): WorkspaceState {
  const removed = new Set(ids)
  const graphIds = new Set(state.graphs.filter((graph) => removed.has(graph.projectId)).map((graph) => graph.id))
  const retainBindings = <T,>(bindings: Record<string, T>) => Object.fromEntries(Object.entries(bindings).filter(([id]) => !graphIds.has(id)))
  return {
    ...state, projects: state.projects.filter((project) => !removed.has(project.id)), graphs: state.graphs.filter((graph) => !removed.has(graph.projectId)),
    sessions: state.sessions.filter((session) => !removed.has(session.projectId)), runs: state.runs.filter((run) => !removed.has(run.projectId)), artifacts: state.artifacts.filter((artifact) => !removed.has(artifact.projectId)),
    workingArtifactIds: retainBindings(state.workingArtifactIds), workingBaseRunIds: retainBindings(state.workingBaseRunIds), activeHistoryRunIds: retainBindings(state.activeHistoryRunIds),
    archivedProjectIds: state.archivedProjectIds.filter((id) => !removed.has(id)), pinnedProjectIds: state.pinnedProjectIds.filter((id) => !removed.has(id)), pinnedGraphIds: state.pinnedGraphIds.filter((id) => !graphIds.has(id)),
    activeTemporaryProjectId: removed.has(state.activeTemporaryProjectId ?? '') ? undefined : state.activeTemporaryProjectId,
    tutorial: state.tutorial && graphIds.has(state.tutorial.graphId) ? { ...state.tutorial, status: 'skipped' } : state.tutorial
  }
}

export function startTutorial(state: WorkspaceState, step = 0, rootPath?: string): WorkspaceState {
  const previous = state.projects.find((project) => project.id === TUTORIAL_PROJECT_ID)
  const now = new Date().toISOString()
  const project = { id: TUTORIAL_PROJECT_ID, name: t("Customer feedback · Weekly brief tutorial"), workspace: { mode: 'directory' as const, rootPath: rootPath ?? (previous?.workspace.mode === 'directory' ? previous.workspace.rootPath : 'AgentFlow Examples/Customer Weekly Brief') }, createdAt: previous?.createdAt ?? now, updatedAt: now }
  const tool = step === 0 ? 'codex' : state.tutorial?.tool ?? 'codex'
  return reconcileWorkspaceState(setTutorialStep({
    ...state, projects: [...state.projects.filter((item) => item.id !== project.id), project],
    graphs: [...state.graphs.filter((graph) => graph.id !== TUTORIAL_GRAPH_ID), { id: TUTORIAL_GRAPH_ID, projectId: project.id, revision: 1, definition: tutorialGraph(step, tool), createdAt: now, updatedAt: now }],
    sessions: state.sessions.filter((session) => session.graphId !== TUTORIAL_GRAPH_ID),
    archivedProjectIds: state.archivedProjectIds.filter((id) => id !== project.id),
    activeProjectId: project.id, activeGraphId: TUTORIAL_GRAPH_ID, activeTemporaryProjectId: undefined,
    tutorial: { version: 2, status: 'active', step, graphId: TUTORIAL_GRAPH_ID, tool }
  }, step, tool))
}

function createEmptyWorkspaceState(): WorkspaceState {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    projects: [],
    graphs: [],
    sessions: [],
    runs: [],
    artifacts: [],
    workingArtifactIds: {},
    workingBaseRunIds: {},
    activeHistoryRunIds: {},
    archivedProjectIds: [],
    pinnedProjectIds: [],
    pinnedGraphIds: [],
    suppressedSessionAgentIds: [],
    activeProjectId: '',
    activeGraphId: '',
    updatedAt: now
  }
}

export function attachFreshTemporaryProject(state: WorkspaceState): WorkspaceState {
  const now = new Date().toISOString()
  const projectId = createId('draft')
  const graphId = createId('graph')
  const workspace: WorkspaceBinding = { mode: 'temporary', tempId: createId('workspace') }
  const project = projectDefinitionSchema.parse({
    id: projectId,
    name: t("Untitled project"),
    workspace,
    createdAt: now,
    updatedAt: now
  })
  const graph: StoredGraph = {
    id: graphId,
    projectId,
    revision: 1,
    definition: graphDefinitionSchema.parse({
      version: 1,
      name: t('Untitled Flow'),
      goal: '',
      nodes: {},
      links: []
    }),
    createdAt: now,
    updatedAt: now
  }
  return {
    ...state,
    projects: [...state.projects, project],
    graphs: [...state.graphs, graph],
    activeProjectId: projectId,
    activeGraphId: graphId,
    activeTemporaryProjectId: projectId,
    updatedAt: now
  }
}

export function openOrCreateTemporaryProject(state: WorkspaceState): WorkspaceState {
  const reusable = state.projects.find((project) => project.workspace.mode === 'temporary' && isPristineTemporaryProject(state, project.id))
  if (!reusable) return attachFreshTemporaryProject(state)
  const graph = state.graphs.find((candidate) => candidate.projectId === reusable.id)
  return { ...state, activeProjectId: reusable.id, activeGraphId: graph?.id ?? state.activeGraphId, activeTemporaryProjectId: reusable.id }
}

export function isPristineTemporaryProject(state: WorkspaceState, projectId: string) {
  const project = state.projects.find((candidate) => candidate.id === projectId)
  const graphs = state.graphs.filter((candidate) => candidate.projectId === projectId)
  const graph = graphs[0]
  return project?.workspace.mode === 'temporary'
    && localizeLabel(project.name) === t("Untitled project")
    && graphs.length === 1
    && graph?.revision === 1
    && localizeLabel(graph.definition.name) === t('Untitled Flow')
    && !graph.definition.goal.trim()
    && Object.keys(graph.definition.nodes).length === 0
    && graph.definition.links.length === 0
    && !state.sessions.some((session) => session.projectId === projectId)
    && !state.runs.some((run) => run.projectId === projectId)
}

export function openDirectoryProject(state: WorkspaceState, rootPath: string, saved?: unknown): WorkspaceState {
  const normalizedPath = normalizeDirectoryPath(rootPath)
  if (!normalizedPath) return state
  const comparablePath = directoryPathIdentity(normalizedPath)
  const existing = state.projects.find((project) => project.workspace.mode === 'directory'
    && directoryPathIdentity(project.workspace.rootPath) === comparablePath)
  const now = new Date().toISOString()
  const imported = normalizeWorkspaceState(saved)
  if (saved && (!imported || imported.projects.length !== 1 || !imported.graphs.length)) throw new Error(t("Project files are incomplete. The current project was retained."))
  if (imported) {
    const incoming = imported.projects[0]!
    const binding: WorkspaceBinding = { mode: 'directory', rootPath: normalizedPath }
    const replacedIds = new Set([incoming.id, ...(existing ? [existing.id] : [])])
    const incomingGraphIds = new Set(imported.graphs.map((graph) => graph.id))
    return reconcileWorkspaceState({
      ...state,
      projects: [...state.projects.filter((project) => !replacedIds.has(project.id)), { ...incoming, workspace: binding }],
      graphs: [...state.graphs.filter((graph) => !replacedIds.has(graph.projectId)), ...imported.graphs],
      sessions: [...state.sessions.filter((session) => !replacedIds.has(session.projectId)), ...imported.sessions.map((session) => ({ ...session, workspaceSnapshot: binding }))],
      runs: [...state.runs.filter((run) => !replacedIds.has(run.projectId)), ...imported.runs.map((run) => ({ ...run, workspaceSnapshot: binding }))],
      artifacts: [...state.artifacts.filter((artifact) => !replacedIds.has(artifact.projectId)), ...imported.artifacts],
      workingArtifactIds: { ...Object.fromEntries(Object.entries(state.workingArtifactIds).filter(([graphId]) => !incomingGraphIds.has(graphId))), ...imported.workingArtifactIds },
      workingBaseRunIds: { ...Object.fromEntries(Object.entries(state.workingBaseRunIds).filter(([graphId]) => !incomingGraphIds.has(graphId))), ...imported.workingBaseRunIds },
      activeHistoryRunIds: { ...Object.fromEntries(Object.entries(state.activeHistoryRunIds).filter(([graphId]) => !incomingGraphIds.has(graphId))), ...imported.activeHistoryRunIds },
      activeProjectId: incoming.id,
      activeGraphId: incomingGraphIds.has(imported.activeGraphId) ? imported.activeGraphId : imported.graphs[0]!.id,
      archivedProjectIds: state.archivedProjectIds.filter((id) => !replacedIds.has(id)),
      updatedAt: now
    })
  }
  if (existing) {
    const graph = state.graphs.find((candidate) => candidate.projectId === existing.id)
    return reconcileWorkspaceState({
      ...state,
      activeProjectId: existing.id,
      activeGraphId: graph?.id ?? state.activeGraphId,
      archivedProjectIds: state.archivedProjectIds.filter((id) => id !== existing.id),
      updatedAt: now
    })
  }

  const projectId = createId('project')
  const graphId = createId('graph')
  const name = normalizedPath.split(/[\\/]/).filter(Boolean).at(-1) ?? t('Project')
  const workspace: WorkspaceBinding = { mode: 'directory', rootPath: normalizedPath }
  const project = projectDefinitionSchema.parse({ id: projectId, name, workspace, createdAt: now, updatedAt: now })
  const graph: StoredGraph = {
    id: graphId,
    projectId,
    revision: 1,
    definition: graphDefinitionSchema.parse({
      version: 1,
      name: t('Untitled Flow'),
      goal: '',
      nodes: {},
      links: []
    }),
    createdAt: now,
    updatedAt: now
  }
  return reconcileWorkspaceState({
    ...state,
    projects: [...state.projects, project],
    graphs: [...state.graphs, graph],
    activeProjectId: projectId,
    activeGraphId: graphId,
    updatedAt: now
  })
}

export function preparePersistedWorkspaceState(state: WorkspaceState): WorkspaceState {
  const temporaryProjectIds = new Set(state.projects.filter((project) => project.workspace.mode === 'temporary').map((project) => project.id))
  const temporaryGraphIds = new Set(
    state.graphs.filter((graph) => temporaryProjectIds.has(graph.projectId)).map((graph) => graph.id)
  )
  const projects = state.projects.filter((project) => !temporaryProjectIds.has(project.id))
  const graphs = state.graphs.filter((graph) => !temporaryProjectIds.has(graph.projectId))
  const persistedAgentIds = new Set(graphs.flatMap((graph) => Object.entries(graph.definition.nodes).filter(([, node]) => node.type === 'agent').map(([nodeId]) => nodeId)))
  const activeProject = projects.find((project) => project.id === state.activeProjectId) ?? projects[0]
  const activeGraph = graphs.find((graph) => graph.projectId === activeProject?.id)
  return {
    ...state,
    projects,
    graphs,
    sessions: state.sessions.filter((session) => !temporaryGraphIds.has(session.graphId)),
    runs: state.runs.filter((run) => !temporaryGraphIds.has(run.graphId)),
    artifacts: state.artifacts.filter((artifact) => !temporaryGraphIds.has(artifact.graphId)),
    workingArtifactIds: Object.fromEntries(Object.entries(state.workingArtifactIds).filter(([graphId]) => !temporaryGraphIds.has(graphId))),
    workingBaseRunIds: Object.fromEntries(Object.entries(state.workingBaseRunIds).filter(([graphId]) => !temporaryGraphIds.has(graphId))),
    activeHistoryRunIds: Object.fromEntries(Object.entries(state.activeHistoryRunIds).filter(([graphId]) => !temporaryGraphIds.has(graphId))),
    activeProjectId: activeProject?.id ?? '',
    activeGraphId: activeGraph?.id ?? '',
    suppressedSessionAgentIds: (state.suppressedSessionAgentIds ?? []).filter((nodeId) => persistedAgentIds.has(nodeId)),
    activeTemporaryProjectId: undefined
  }
}

export function saveTemporaryAsNewProject(state: WorkspaceState, name: string, rootPath?: string): WorkspaceState {
  if (!state.activeTemporaryProjectId) return state
  const now = new Date().toISOString()
  const binding: WorkspaceBinding | undefined = rootPath ? { mode: 'directory', rootPath } : undefined
  return {
    ...state,
    projects: state.projects.map((project) => project.id === state.activeTemporaryProjectId
      ? { ...project, name: name.trim() || t("Untitled project"), workspace: binding ?? project.workspace, updatedAt: now }
      : project),
    sessions: state.sessions.map((session) => session.projectId === state.activeTemporaryProjectId && binding ? { ...session, workspaceSnapshot: binding } : session),
    runs: state.runs.map((run) => run.projectId === state.activeTemporaryProjectId && binding ? { ...run, workspaceSnapshot: binding } : run),
    activeTemporaryProjectId: undefined,
    updatedAt: now
  }
}

export function moveTemporaryIntoProject(state: WorkspaceState, targetProjectId: string): WorkspaceState {
  const temporaryProjectId = state.activeTemporaryProjectId
  const target = state.projects.find((project) => project.id === targetProjectId)
  if (!temporaryProjectId || !target || temporaryProjectId === targetProjectId) return state
  const now = new Date().toISOString()
  const temporaryGraphs = state.graphs.filter((graph) => graph.projectId === temporaryProjectId)
  const temporaryGraphIds = new Set(temporaryGraphs.map((graph) => graph.id))
  const usedNames = new Set(
    state.graphs.filter((graph) => graph.projectId === targetProjectId).map((graph) => graph.definition.name)
  )
  const movedGraphs = temporaryGraphs.map((graph) => {
    const name = uniqueName(graph.definition.name, usedNames)
    usedNames.add(name)
    return { ...graph, projectId: targetProjectId, definition: { ...graph.definition, name }, updatedAt: now }
  })
  return reconcileWorkspaceState({
    ...state,
    projects: state.projects
      .filter((project) => project.id !== temporaryProjectId)
      .map((project) => project.id === targetProjectId ? { ...project, updatedAt: now } : project),
    graphs: [
      ...state.graphs.filter((graph) => graph.projectId !== temporaryProjectId),
      ...movedGraphs
    ],
    sessions: state.sessions.map((session) => temporaryGraphIds.has(session.graphId)
      ? { ...session, projectId: targetProjectId, workspaceSnapshot: { ...target.workspace }, updatedAt: now }
      : session),
    runs: state.runs.map((run) => temporaryGraphIds.has(run.graphId)
      ? { ...run, projectId: targetProjectId, workspaceSnapshot: { ...target.workspace } }
      : run),
    artifacts: state.artifacts.map((artifact) => temporaryGraphIds.has(artifact.graphId) ? { ...artifact, projectId: targetProjectId } : artifact),
    activeProjectId: targetProjectId,
    activeGraphId: movedGraphs[0]?.id ?? state.graphs.find((graph) => graph.projectId === targetProjectId)?.id ?? '',
    activeTemporaryProjectId: undefined,
    updatedAt: now
  })
}

function uniqueName(preferred: string, used: Set<string>) {
  if (!used.has(preferred)) return preferred
  let index = 2
  while (used.has(`${preferred} (${index})`)) index += 1
  return `${preferred} (${index})`
}

export function createAgentSession(
  projectId: string,
  graphId: string,
  agentNodeId: string,
  workspaceSnapshot: WorkspaceBinding,
  options?: { title?: string; origin?: AgentSession['origin'] }
): AgentSession {
  const now = new Date().toISOString()
  return {
    id: createId('session'),
    title: options?.title,
    origin: options?.origin ?? 'graph',
    projectId,
    graphId,
    agentNodeId,
    connector: 'model',
    isActive: true,
    status: 'idle',
    workspaceSnapshot: { ...workspaceSnapshot },
    messages: [],
    createdAt: now,
    updatedAt: now
  }
}

export function normalizeWorkspaceState(value: unknown): WorkspaceState | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null
  if (!Array.isArray(value.projects) || !Array.isArray(value.graphs)) return null

  const projects = value.projects
    .map((project) => projectDefinitionSchema.safeParse(project))
    .filter((result) => result.success)
    .map((result) => result.data)
  const graphs = value.graphs
    .filter(isRecord)
    .map((stored) => {
      const definition = graphDefinitionSchema.safeParse(stored.definition)
      if (
        !definition.success ||
        typeof stored.id !== 'string' ||
        typeof stored.projectId !== 'string' ||
        typeof stored.revision !== 'number' ||
        typeof stored.createdAt !== 'string' ||
        typeof stored.updatedAt !== 'string'
      ) {
        return null
      }
      return {
        id: stored.id,
        projectId: stored.projectId,
        revision: stored.revision,
        definition: definition.data,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt
      } satisfies StoredGraph
    })
    .filter((graph): graph is StoredGraph => Boolean(graph))

  const validProjectIds = new Set(projects.map((project) => project.id))
  const validGraphs = graphs.filter((graph) => validProjectIds.has(graph.projectId))
  const activeProjectId =
    typeof value.activeProjectId === 'string' &&
    projects.some((project) => project.id === value.activeProjectId)
      ? value.activeProjectId
      : (projects[0]?.id ?? '')
  const projectGraphs = validGraphs.filter((graph) => graph.projectId === activeProjectId)
  const activeGraphId =
    typeof value.activeGraphId === 'string' &&
    projectGraphs.some((graph) => graph.id === value.activeGraphId)
      ? value.activeGraphId
      : (projectGraphs[0]?.id ?? '')
  const sessions = Array.isArray(value.sessions)
    ? value.sessions.filter(isAgentSession).map((session) => {
        const workspace = workspaceBindingSchema.safeParse(session.workspaceSnapshot)
        const project = projects.find((candidate) => candidate.id === session.projectId)
        const messages = session.messages
        return {
          ...session,
          messages,
          activeLeafMessageId: typeof session.activeLeafMessageId === 'string' && messages.some((message) => message.id === session.activeLeafMessageId)
            ? session.activeLeafMessageId
            : messages.at(-1)?.id,
          workspaceSnapshot: workspace.success
            ? workspace.data
            : (project?.workspace ?? session.workspaceSnapshot)
        }
      })
    : []
  const activeTemporaryCandidate = typeof value.activeTemporaryProjectId === 'string' ? value.activeTemporaryProjectId : undefined
  const activeTemporaryProjectId = projects.some((project) => project.id === activeTemporaryCandidate && project.workspace.mode === 'temporary')
    ? activeTemporaryCandidate
    : undefined

  const runs = Array.isArray(value.runs) ? (value.runs as WorkspaceState['runs']) : []
  const migratedArtifacts: WorkspaceState['artifacts'] = runs.flatMap((run) => run.artifacts.map((artifact) => ({ ...artifact, projectId: run.projectId, graphId: run.graphId, origin: 'run' as const })))
  const resultNodeByAgent = new Map(validGraphs.flatMap((graph) => Object.entries(graph.definition.nodes).flatMap(([nodeId, node]) => node.type === 'output' ? [[`${graph.id}\u0000${node.ownerAgentId}`, nodeId] as const] : [])))
  const rawArtifacts: WorkspaceState['artifacts'] = Array.isArray(value.artifacts)
    ? (value.artifacts as WorkspaceState['artifacts']).filter((artifact) => artifact && typeof artifact.id === 'string' && typeof artifact.graphId === 'string')
    : migratedArtifacts
  const artifacts = rawArtifacts.map((artifact) => {
    if (artifact.origin !== 'chat-reply' && artifact.origin !== 'chat-transcript') return artifact
    const resultNodeId = resultNodeByAgent.get(`${artifact.graphId}\u0000${artifact.nodeId}`)
    return resultNodeId ? { ...artifact, nodeId: resultNodeId } : artifact
  })
  const rawWorkingArtifactIds = isRecord(value.workingArtifactIds) ? value.workingArtifactIds as WorkspaceState['workingArtifactIds'] : Object.fromEntries(
    validGraphs.map((graph) => [graph.id, Object.fromEntries(artifacts.filter((artifact) => artifact.graphId === graph.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((artifact) => [artifact.nodeId, artifact.id]))])
  )
  const workingArtifactIds = Object.fromEntries(validGraphs.map((graph) => {
    const bindings = { ...(rawWorkingArtifactIds[graph.id] ?? {}) }
    for (const [agentId, artifactId] of Object.entries(bindings)) {
      const resultNodeId = resultNodeByAgent.get(`${graph.id}\u0000${agentId}`)
      const artifact = artifacts.find((candidate) => candidate.id === artifactId)
      if (!resultNodeId || !artifact || (artifact.origin !== 'chat-reply' && artifact.origin !== 'chat-transcript')) continue
      bindings[resultNodeId] = artifactId
      delete bindings[agentId]
    }
    return [graph.id, bindings]
  }))
  return {
    schemaVersion: 1,
    projects,
    graphs: validGraphs,
    sessions,
    runs,
    artifacts,
    workingArtifactIds,
    workingBaseRunIds: isRecord(value.workingBaseRunIds) ? value.workingBaseRunIds as Record<string, string> : {},
    activeHistoryRunIds: isRecord(value.activeHistoryRunIds) ? Object.fromEntries(Object.entries(value.activeHistoryRunIds).filter(([graphId, runId]) => typeof runId === 'string' && runs.some((run) => run.id === runId && run.graphId === graphId))) as Record<string, string> : {},
    archivedProjectIds: Array.isArray(value.archivedProjectIds)
      ? value.archivedProjectIds.filter((id): id is string => typeof id === 'string')
      : [],
    pinnedProjectIds: Array.isArray(value.pinnedProjectIds)
      ? value.pinnedProjectIds.filter((id): id is string => typeof id === 'string' && validProjectIds.has(id))
      : [],
    pinnedGraphIds: Array.isArray(value.pinnedGraphIds)
      ? value.pinnedGraphIds.filter((id): id is string => typeof id === 'string' && validGraphs.some((graph) => graph.id === id))
      : [],
    activeProjectId,
    activeGraphId,
    tutorial: normalizeTutorial(value.tutorial),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    activeTemporaryProjectId,
    suppressedSessionAgentIds: Array.isArray(value.suppressedSessionAgentIds)
      ? value.suppressedSessionAgentIds.filter((id): id is string => typeof id === 'string')
      : []
  }
}

export async function loadWorkspaceState() {
  const saved = window.agentflowDesktop ? await window.agentflowDesktop.loadWorkspace() : readBrowserStorage()
  const persisted = normalizeWorkspaceState(saved) ?? createEmptyWorkspaceState()
  if (persisted.tutorial?.status === 'active' && persisted.graphs.some((graph) => graph.id === persisted.tutorial!.graphId)) {
    const stored = persisted.graphs.find((graph) => graph.id === persisted.tutorial!.graphId)!
    return reconcileWorkspaceState({ ...persisted, activeProjectId: stored.projectId, activeGraphId: stored.id })
  }
  if (!saved || persisted.tutorial?.status === 'active') {
    const root = await window.agentflowDesktop?.ensureTutorialWorkspace?.()
    return startTutorial(persisted, persisted.tutorial?.step ?? 0, root)
  }
  return reconcileWorkspaceState(attachFreshTemporaryProject(persisted))
}

function normalizeTutorial(value: unknown): WorkspaceState['tutorial'] {
  if (!isRecord(value) || value.version !== 2 || !['active', 'skipped', 'completed'].includes(String(value.status)) || typeof value.graphId !== 'string') return undefined
  return { version: 2, status: value.status as 'active' | 'skipped' | 'completed', graphId: value.graphId, step: typeof value.step === 'number' && Number.isInteger(value.step) ? Math.max(0, Math.min(12, value.step)) : 0, tool: value.tool === 'claude-code' ? 'claude-code' : 'codex', overviewSeen: value.overviewSeen === true, reviewer: isRecord(value.reviewer) && typeof value.reviewer.provider === 'string' && typeof value.reviewer.model === 'string' ? { provider: value.reviewer.provider, model: value.reviewer.model } : undefined }
}

export async function saveWorkspaceState(state: WorkspaceState) {
  const persisted = preparePersistedWorkspaceState(state)
  if (window.agentflowDesktop) {
    await window.agentflowDesktop.saveWorkspace(persisted)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
}

export function reconcileWorkspaceState(state: WorkspaceState): WorkspaceState {
  const sessions = state.sessions.map((session) => ({
    ...session,
    messages: [...session.messages]
  }))
  let changed = false

  for (const graph of state.graphs) {
    const project = state.projects.find((candidate) => candidate.id === graph.projectId)
    if (!project) continue
    const agentIds = new Set(
      Object.entries(graph.definition.nodes)
        .filter(([, node]) => node.type === 'agent')
        .map(([nodeId]) => nodeId)
    )

    for (const session of sessions) {
      if (
        session.graphId === graph.id &&
        session.isActive &&
        !agentIds.has(session.agentNodeId)
      ) {
        session.isActive = false
        session.status = 'archived'
        changed = true
      }
    }

    for (const nodeId of agentIds) {
      if (state.suppressedSessionAgentIds?.includes(nodeId)) continue
      const active = sessions.some(
        (session) =>
          session.graphId === graph.id &&
          session.agentNodeId === nodeId &&
          session.isActive
      )
      if (!active) {
        sessions.push(
          createAgentSession(
            graph.projectId,
            graph.id,
            nodeId,
            project.workspace
          )
        )
        changed = true
      }
    }
  }

  return changed ? { ...state, sessions } : state
}

function readBrowserStorage() {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) return null
  try {
    return JSON.parse(saved) as unknown
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAgentSession(value: unknown): value is AgentSession {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.graphId === 'string' &&
    typeof value.agentNodeId === 'string' &&
    typeof value.isActive === 'boolean' &&
    Array.isArray(value.messages)
  )
}
