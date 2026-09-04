import { t } from '@agentflow/core/localization'
import type { Artifact } from '@agentflow/core'
import type { WorkspaceState } from './workspace'

export const FLOW_DIRECTORY = '.flow'
export const FLOW_PROJECT_FILE = '.flow/project.json'

export interface FlowProjectFile {
  format: 'agentflow-project'
  version: 1
  state: WorkspaceState
}

// Prefixing also makes Windows reserved names and dot segments safe file names.
export function fileSegment(id: string) {
  const encoded = encodeURIComponent(id).replace(/[.!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16)}`)
  if (encoded.length <= 96) return `id-${encoded}`
  let hash = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(id)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n)
  return `id-${encoded.slice(0, 72).replace(/%(?:[0-9a-f])?$/i, '')}-${hash.toString(16).padStart(16, '0')}`
}

export const inputTextPath = (graphId: string, nodeId: string, itemId: string) =>
  `.flow/inputs/${fileSegment(graphId)}/${fileSegment(nodeId)}/${fileSegment(itemId)}.md`

export const inputAttachmentPath = (graphId: string, itemId: string, name: string) =>
  `.flow/attachments/${fileSegment(graphId)}/${fileSegment(itemId)}/${fileSegment(name)}`

export const outputTextPath = (graphId: string, nodeId: string, outputId: string) =>
  `.flow/outputs/${fileSegment(graphId)}/${fileSegment(nodeId)}/${fileSegment(outputId)}.md`

export function outputFilePath(graphId: string, artifact: Artifact, index: number) {
  const file = artifact.files?.[index]
  if (!file) throw new Error(t("Output file does not exist"))
  if (file.content === undefined && !file.dataBase64) return file.relativePath
  const extension = /\.[a-zA-Z0-9]{1,16}$/.exec(file.name)?.[0] ?? ''
  const name = `${fileSegment(extension ? file.name.slice(0, -extension.length) : file.name)}${extension}`
  return `.flow/outputs/${fileSegment(graphId)}/${fileSegment(artifact.nodeId)}/${fileSegment(artifact.id)}-files/${index + 1}-${name}`
}

export const isMarkdownOutput = (file: { name: string; mimeType?: string }) => /\.(md|markdown)$/i.test(file.name) || file.mimeType === 'text/markdown'

export function projectSnapshot(state: WorkspaceState, projectId: string): WorkspaceState {
  const project = state.projects.find((candidate) => candidate.id === projectId)
  if (!project) throw new Error(t("Project does not exist"))
  const graphs = state.graphs.filter((graph) => graph.projectId === projectId)
  const graphIds = new Set(graphs.map((graph) => graph.id))
  const nodeIds = new Set(graphs.flatMap((graph) => Object.keys(graph.definition.nodes)))
  return {
    schemaVersion: 1,
    projects: [project],
    graphs,
    sessions: state.sessions.filter((session) => session.projectId === projectId && graphIds.has(session.graphId)),
    runs: state.runs.filter((run) => run.projectId === projectId && graphIds.has(run.graphId)),
    artifacts: state.artifacts.filter((artifact) => artifact.projectId === projectId && graphIds.has(artifact.graphId)),
    workingArtifactIds: Object.fromEntries(Object.entries(state.workingArtifactIds).filter(([graphId]) => graphIds.has(graphId))),
    workingBaseRunIds: Object.fromEntries(Object.entries(state.workingBaseRunIds).filter(([graphId]) => graphIds.has(graphId))),
    activeHistoryRunIds: Object.fromEntries(Object.entries(state.activeHistoryRunIds).filter(([graphId]) => graphIds.has(graphId))),
    activeProjectId: projectId,
    activeGraphId: graphIds.has(state.activeGraphId) ? state.activeGraphId : graphs[0]?.id ?? '',
    archivedProjectIds: [],
    pinnedProjectIds: [],
    pinnedGraphIds: state.pinnedGraphIds.filter((id) => graphIds.has(id)),
    suppressedSessionAgentIds: state.suppressedSessionAgentIds?.filter((id) => nodeIds.has(id)),
    updatedAt: project.updatedAt
  }
}

export interface AgentOutput {
  id: string
  content: string
  createdAt: string
  relativePath: string
  parts?: import('@agentflow/core').ModelResponsePart[]
}

export function artifactTextContent(artifact: Artifact) {
  const textFiles = (artifact.files ?? []).filter((file) => file.mode === 'text' && file.content?.trim())
  if (textFiles.length === 1) return textFiles[0]!.content!.trim()
  if (textFiles.length > 1) return textFiles.map((file) => `## ${file.name}\n\n${file.content!.trim()}`).join('\n\n')
  return artifact.content
}

export function latestAgentOutput(state: WorkspaceState, graphId: string, nodeId: string): AgentOutput | undefined {
  const selectedId = state.workingArtifactIds[graphId]?.[nodeId]
  const selected = selectedId ? state.artifacts.find((artifact) => artifact.id === selectedId) : undefined
  const artifact = selected ?? state.artifacts
    .filter((candidate) => candidate.graphId === graphId && candidate.nodeId === nodeId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  return artifact ? {
    id: artifact.id,
    content: artifactTextContent(artifact),
    createdAt: artifact.createdAt,
    relativePath: outputTextPath(graphId, nodeId, artifact.id),
    parts: artifact.parts
  } : undefined
}
