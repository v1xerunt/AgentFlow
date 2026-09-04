import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { join, parse, resolve, sep } from 'node:path'
import { composeInvocation } from '@agentflow/core'
import { createHostRun, hostRunStatus, validateHostGraph, type HostRun, type HostTask } from '@agentflow/core/host-run'
import type { GraphDefinition } from '@agentflow/schema'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const artifactFilename = (nodeId: string) => `${hash(nodeId)}.md`
export const invocationPath = (path: string) => resolve(process.env.INIT_CWD ?? process.cwd(), path)
export const newTaskId = () => `task-${randomUUID()}`

async function ordinaryPath(path: string, directory = false) {
  const info = await lstat(path)
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) {
    throw new Error(`Expected an ordinary ${directory ? 'directory' : 'file'}: ${path}`)
  }
}

async function checkRunDirectory(directory: string) {
  await directoryTree(directory)
  await ordinaryPath(directory, true)
  for (const child of ['artifacts', 'results']) await ordinaryPath(join(directory, child), true)
  await ordinaryPath(join(directory, 'state.json'))
}

async function directoryTree(path: string, create = false) {
  const absolute = resolve(path)
  let current = parse(absolute).root
  for (const segment of absolute.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, segment)
    // macOS exposes these system directories through links into /private.
    // Only accept their expected system destinations; other links stay rejected.
    if (process.platform === 'darwin' && ['/var', '/tmp', '/etc'].includes(current) &&
        await realpath(current) === `/private${current}`) current = `/private${current}`
    if (create) await mkdir(current).catch(error => { if (error.code !== 'EEXIST') throw error })
    await ordinaryPath(current, true)
  }
}

export async function readHostRun(directory: string): Promise<HostRun> {
  await checkRunDirectory(directory)
  const envelope = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'))
  const run = envelope.run as HostRun
  if (!run || run.format !== 'agentflow-host-run' || run.version !== 1 ||
      !Array.isArray(run.artifacts) || !Array.isArray(run.tasks) || typeof run.workspace !== 'string' ||
      envelope.checksum !== hash(JSON.stringify(run))) throw new Error('Invalid or edited host run state. Start a new run from the edited Flow.')
  validateHostGraph(run.graph)
  return run
}

async function immutableFile(path: string, content: string) {
  try {
    await writeFile(path, content, { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    await ordinaryPath(path)
    if (await readFile(path, 'utf8') !== content) throw new Error(`Stored artifact was modified: ${path}`)
  }
}

async function saveHostRun(directory: string, run: HostRun) {
  for (const artifact of run.artifacts) {
    await immutableFile(join(directory, 'artifacts', artifactFilename(artifact.nodeId)), artifact.content)
  }
  const temporary = join(directory, `.state-${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, JSON.stringify({ checksum: hash(JSON.stringify(run)), run }, null, 2) + '\n', { flag: 'wx' })
    await rename(temporary, join(directory, 'state.json'))
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
}

export async function startHostRun(graph: GraphDefinition, workspacePath: string, requestedDirectory?: string) {
  const workspace = await realpath(workspacePath)
  await ordinaryPath(workspace, true)
  const runId = `run-${randomUUID()}`
  const run = createHostRun(graph, workspace, runId, new Date().toISOString())
  const directory = requestedDirectory ?? join(workspace, '.agentflow', 'runs', runId)
  // Parents can be shared, but a run directory must always be newly allocated.
  await directoryTree(resolve(directory, '..'), true)
  await mkdir(directory)
  for (const child of ['artifacts', 'results']) await mkdir(join(directory, child))
  await immutableFile(join(directory, 'graph.json'), JSON.stringify(run.graph, null, 2) + '\n')
  await saveHostRun(directory, run)
  return describeHostRun(directory, run)
}

export async function withHostRun<T>(directory: string, action: (run: HostRun) => T | Promise<T>): Promise<T> {
  await checkRunDirectory(directory)
  const lockPath = join(directory, '.lock')
  let lock
  try { lock = await open(lockPath, 'wx') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Run is locked by another command. Retry after it exits. If it crashed, verify the recorded process has exited before removing .lock.')
    throw error
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }))
    const run = await readHostRun(directory)
    const result = await action(run)
    await saveHostRun(directory, run)
    return result
  } finally {
    await lock.close()
    await unlink(lockPath)
  }
}

export function describeHostRun(directory: string, run: HostRun) {
  return { ...hostRunStatus(run), runDirectory: directory, graphPath: join(directory, 'graph.json'),
    artifacts: run.artifacts.map(({ content: _content, ...artifact }) => ({ ...artifact, path: join(directory, 'artifacts', artifactFilename(artifact.nodeId)) })) }
}

export function describeHostTask(directory: string, run: HostRun, task: HostTask) {
  const invocation = composeInvocation(run.graph, task.nodeId, new Map(run.artifacts.map(artifact => [artifact.nodeId, artifact])))
  return { runDirectory: directory, workspace: run.workspace, task,
    node: { id: task.nodeId, name: run.graph.nodes[task.nodeId]!.name },
    messages: invocation.messages, relations: invocation.relations,
    upstream: invocation.upstream.map(artifact => ({ nodeId: artifact.nodeId, artifactId: artifact.id,
      path: join(directory, 'artifacts', artifactFilename(artifact.nodeId)) })),
    resultPath: join(directory, 'results', `${task.id}.md`) }
}
