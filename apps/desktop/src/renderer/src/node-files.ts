import { t } from '@agentflow/core/localization'
import type { Artifact } from '@agentflow/core'
import { resultFiles } from '@agentflow/core'
import type { GraphDefinition, InputItemDefinition } from '@agentflow/schema'
import { outputFilePath } from '../../shared/flow-project'

export const NODE_FILES_DRAG_TYPE = 'application/x-agentflow-node-files'
export interface NodeFilesDrag {
  graphId: string
  nodeId: string
  artifactId?: string
  ids: string[]
}

export function parseNodeFilesDrag(text: string): NodeFilesDrag {
  const value = JSON.parse(text) as NodeFilesDrag
  if (!value || typeof value.graphId !== 'string' || typeof value.nodeId !== 'string' || !Array.isArray(value.ids) || !value.ids.length || value.ids.some(id => typeof id !== 'string') || (value.artifactId !== undefined && typeof value.artifactId !== 'string')) throw new Error(t("The file selection has expired. Drag again."))
  return { graphId: value.graphId, nodeId: value.nodeId, artifactId: value.artifactId, ids: [...new Set(value.ids)] }
}

export function toggleNodeFile(graph: GraphDefinition, nodeId: string, id: string, artifact?: Artifact): GraphDefinition {
  const node = graph.nodes[nodeId]
  if (node?.type === 'input') return { ...graph, nodes: { ...graph.nodes, [nodeId]: { ...node, items: node.items.map(item => item.id === id ? { ...item, hidden: !item.hidden } : item) } } }
  if (node?.type !== 'output' || !artifact || !resultFiles(node, artifact).some(file => file.relativePath === id)) return graph
  const states = { ...node.fileStates?.[artifact.id] }
  if (states[id] === 'hidden') delete states[id]
  else states[id] = 'hidden'
  return { ...graph, nodes: { ...graph.nodes, [nodeId]: { ...node, fileStates: { ...node.fileStates, [artifact.id]: states } } } }
}

export function detachNodeFiles(graph: GraphDefinition, payload: NodeFilesDrag, targetId: string, position: { x: number; y: number }, artifact?: Artifact): GraphDefinition {
  const node = graph.nodes[payload.nodeId]
  const selected = new Set(payload.ids)
  let items: InputItemDefinition[]
  let source: GraphDefinition['nodes'][string]
  if (node?.type === 'input') {
    items = node.items.filter(item => selected.has(item.id)).map(item => ({ ...item, hidden: false }))
    source = { ...node, items: node.items.filter(item => !selected.has(item.id)) }
  } else if (node?.type === 'output' && artifact && payload.artifactId === artifact.id) {
    const files = resultFiles(node, artifact).filter(file => selected.has(file.relativePath))
    items = files.map((file, index) => ({
      id: `${targetId}_file_${index + 1}`, name: file.name, kind: 'file', mode: file.mode,
      mimeType: file.mimeType, size: file.size, content: file.content ?? '', dataBase64: file.dataBase64,
      workspacePath: file.mode === 'attachment' ? outputFilePath(payload.graphId, artifact, artifact.files!.indexOf(file)) : undefined
    }))
    source = { ...node, fileStates: { ...node.fileStates, [artifact.id]: { ...node.fileStates?.[artifact.id], ...Object.fromEntries(files.map(file => [file.relativePath, 'detached' as const])) } } }
  } else throw new Error(t("The source file version has changed. Select the files again."))
  if (!items.length || items.length !== selected.size) throw new Error(t("Some files have moved. Select them again."))
  return { ...graph, nodes: { ...graph.nodes, [payload.nodeId]: source, [targetId]: { type: 'input', name: items.length === 1 ? items[0]!.name : t("Input group · {0} items", [items.length]), items, executionMode: 'all', orderMode: 'manual', position } } }
}
