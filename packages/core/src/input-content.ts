import type { GraphNodeDefinition, InputItemDefinition, InputNodeDefinition, OutputNodeDefinition } from '@agentflow/schema'
import type { Artifact } from './index'
import type { ModelOutputFile } from './llm'

export function visibleInputItems(node: InputNodeDefinition): InputItemDefinition[] {
  return node.items.filter(item => !item.hidden)
}

export function inputItemHasContent(item: InputItemDefinition): boolean {
  return !item.hidden && fileHasInputContent(item)
}

export function fileHasInputContent(file: { mode: 'text' | 'attachment'; content?: string; dataBase64?: string }): boolean {
  return file.mode === 'text' ? Boolean(file.content?.trim()) : Boolean(file.dataBase64?.trim())
}

export function resultFileState(node: OutputNodeDefinition, artifact: Artifact, path: string) {
  return node.fileStates?.[artifact.id]?.[path]
}

export function resultFiles(node: OutputNodeDefinition, artifact?: Artifact, visibleOnly = false): ModelOutputFile[] {
  return (artifact?.files ?? []).filter(file => {
    const state = artifact && resultFileState(node, artifact, file.relativePath)
    return state !== 'detached' && (!visibleOnly || state !== 'hidden')
  })
}

/** One content rule for Input items and Result files, including completely filtered sources. */
export function nodeHasInputContent(node: GraphNodeDefinition | undefined, artifact?: Artifact): boolean {
  if (node?.type === 'input') return node.items.some(inputItemHasContent)
  if (node?.type === 'output' && artifact?.files !== undefined) {
    return resultFiles(node, artifact, true).some(fileHasInputContent)
  }
  return Boolean(artifact?.content.trim() || artifact?.files?.some(fileHasInputContent))
}

export function inputText(node: InputNodeDefinition) {
  return visibleInputItems(node).filter(inputItemHasContent).map(item => item.mode === 'text' ? item.content : `[Attachment: ${item.name} · ${item.mimeType ?? 'unknown'}]`).join('\n\n')
}

export function transferableArtifact(node: GraphNodeDefinition | undefined, artifact: Artifact): Artifact {
  if (node?.type === 'input') return { ...artifact, content: inputText(node), files: undefined, parts: undefined }
  if (node?.type === 'output' && artifact.files !== undefined) {
    const files = resultFiles(node, artifact, true)
    return { ...artifact, files, content: files.map(file => file.name).join('\n'), parts: undefined }
  }
  return artifact
}
