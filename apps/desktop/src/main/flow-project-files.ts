import { t } from '@agentflow/core/localization'
import { lstat, readFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { flowProjectSchema } from '../shared/flow-project-schema'
import { FLOW_PROJECT_FILE, inputAttachmentPath, inputTextPath, outputTextPath, outputFilePath, projectSnapshot, type FlowProjectFile } from '../shared/flow-project'
import type { WorkspaceState } from '../shared/workspace'
import { atomicWriteFile } from './atomic-file'

const writes = new Map<string, Promise<void>>()

async function safeTarget(root: string, relativePath: string) {
  const base = resolve(root)
  const target = resolve(base, relativePath)
  const path = relative(base, target)
  if (path.startsWith(`..${sep}`) || path === '..' || path.startsWith(sep) || !path.startsWith(`.flow${sep}`)) throw new Error(t("Invalid project file path"))
  let cursor = base
  for (const segment of path.split(sep)) {
    cursor = join(cursor, segment)
    try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error(t("Symbolic links and junctions are not allowed inside .flow")) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  return target
}

async function atomicWrite(root: string, relativePath: string, content: string | Buffer) {
  const target = await safeTarget(root, relativePath)
  try {
    const previous = await readFile(target)
    if (previous.equals(Buffer.isBuffer(content) ? content : Buffer.from(content))) return
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  await atomicWriteFile(target, content)
}

export async function readFlowProject(root: string): Promise<WorkspaceState | null> {
  const target = await safeTarget(root, FLOW_PROJECT_FILE)
  let raw: unknown
  try { raw = JSON.parse(await readFile(target, 'utf8')) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new Error(t("Could not read {0}. Check that the file is complete.", [FLOW_PROJECT_FILE]), { cause: error }) }
  const parsed = flowProjectSchema.safeParse(raw)
  if (!parsed.success) throw new Error(t("Unrecognized project format, version, or records in .flow/project.json"), { cause: parsed.error })
  const { state } = parsed.data
  const project = state.projects[0]!
  const workspace = { mode: 'directory' as const, rootPath: resolve(root) }
  return {
    ...state,
    projects: [{ ...project, workspace }],
    sessions: state.sessions.map((session) => ({ ...session, workspaceSnapshot: workspace })),
    runs: state.runs.map((run) => ({ ...run, workspaceSnapshot: workspace }))
  }
}

export async function saveFlowProject(root: string, state: WorkspaceState, projectId: string): Promise<void> {
  const key = resolve(root)
  const snapshot = projectSnapshot(state, projectId)
  flowProjectSchema.parse({ format: 'agentflow-project', version: 1, state: snapshot })
  const pending = (writes.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const existing = await readFlowProject(key)
    if (existing && existing.projects[0]?.id !== projectId) throw new Error(t("The destination already contains another Flow project. Open it or choose another directory."))
    for (const graph of snapshot.graphs) {
      for (const [nodeId, node] of Object.entries(graph.definition.nodes)) {
        if (node.type !== 'input') continue
        for (const item of node.items) {
          if (item.mode === 'text') await atomicWrite(key, inputTextPath(graph.id, nodeId, item.id), item.content)
          if (item.dataBase64) {
            const path = inputAttachmentPath(graph.id, item.id, item.name)
            await atomicWrite(key, path, Buffer.from(item.dataBase64, 'base64'))
          }
        }
      }
    }
    for (const artifact of snapshot.artifacts) {
      await atomicWrite(key, outputTextPath(artifact.graphId, artifact.nodeId, artifact.id), artifact.content)
      for (const [index, file] of (artifact.files ?? []).entries()) {
        if (file.content !== undefined) await atomicWrite(key, outputFilePath(artifact.graphId, artifact, index), file.content)
        else if (file.dataBase64) await atomicWrite(key, outputFilePath(artifact.graphId, artifact, index), Buffer.from(file.dataBase64, 'base64'))
      }
    }
    await atomicWrite(key, FLOW_PROJECT_FILE, JSON.stringify({ format: 'agentflow-project', version: 1, state: snapshot } satisfies FlowProjectFile, null, 2))
  })
  writes.set(key, pending)
  try { await pending } finally { if (writes.get(key) === pending) writes.delete(key) }
}
