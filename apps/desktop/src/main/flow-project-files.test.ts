import { mkdtemp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { graphDefinitionSchema } from '@agentflow/schema'
import { executeGraph } from '@agentflow/core'
import { createAgentSession, createDefaultWorkspaceState, preparePersistedWorkspaceState, startTutorial } from '../renderer/src/workspace-store'
import { artifactTextContent, fileSegment, FLOW_PROJECT_FILE, inputTextPath, latestAgentOutput, outputFilePath, outputTextPath } from '../shared/flow-project'
import { endTutorial, setTutorialStep } from '../renderer/src/tutorial-project'
import { ensureTutorialWorkspace } from './tutorial-workspace'
import { readFlowProject, saveFlowProject } from './flow-project-files'

const roots: string[] = []
async function directory() {
  const root = await mkdtemp(join(tmpdir(), 'agentflow-project-test-'))
  roots.push(root)
  return root
}
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })

function fixture() {
  const state = createDefaultWorkspaceState()
  const stored = state.graphs[0]!
  const longText = '# 长文本输入\n\n正文与 **Markdown**。\n'.repeat(1500)
  stored.definition = graphDefinitionSchema.parse({
    version: 1, name: 'Test Flow', goal: 'Verify persistence',
    nodes: {
      input: { type: 'input', name: 'Input', items: [{ id: 'text', name: '长文本', kind: 'text', mode: 'text', content: longText }] },
      agent: { type: 'agent', name: 'Agent', provider: 'fake', model: 'test', graphRolePrompt: 'Write Markdown' }
    }, links: [{ id: 'link', sourceId: 'input', targetId: 'agent', type: 'input' }]
  })
  const session = createAgentSession(state.activeProjectId, stored.id, 'agent', state.projects[0]!.workspace)
  state.sessions.push(session)
  state.artifacts.push({ id: 'reply', runId: 'run', nodeId: 'agent', version: 1, content: '# 输出\n\n| A | B |\n| --- | --- |\n| 1 | 2 |', parentArtifacts: [], sourceInputs: ['input'], createdAt: state.updatedAt, projectId: state.activeProjectId, graphId: stored.id })
  state.workingArtifactIds[stored.id] = { agent: 'reply' }
  return { state, stored, longText }
}

describe('.flow project protocol', () => {
  it.each([
    { provider: 'zai', model: 'glm-5.3' },
    { provider: 'agent-tool:codex', model: '@tool-default' },
    { provider: 'agent-tool:claude-code', model: 'sonnet' }
  ].flatMap((reviewer) => (['completed', 'skipped'] as const).map((status) => ({ reviewer, status }))))(
    'saves and reopens a $status tutorial with a $reviewer.provider reviewer after switching to Fake',
    async ({ reviewer, status }) => {
      const root = await ensureTutorialWorkspace(await directory())
      const initial = startTutorial(createDefaultWorkspaceState(), 0, root)
      initial.tutorial!.reviewer = reviewer
      const active = setTutorialStep(initial, status === 'completed' ? 12 : 8)
      await saveFlowProject(root, active, active.activeProjectId)

      const finished = preparePersistedWorkspaceState(endTutorial(active, status))
      await saveFlowProject(root, finished, finished.activeProjectId)
      const reopened = (await readFlowProject(root))!
      const graph = reopened.graphs.find((item) => item.id === finished.activeGraphId)!.definition
      const before = setTutorialStep(active, 12).graphs.find((item) => item.id === active.activeGraphId)!.definition
      expect(graph.executionMode).toBe('tutorial')
      expect(Object.values(graph.nodes).filter((node) => node.type === 'agent').every((node) => node.provider === 'fake' && node.model === 'agent-v1')).toBe(true)
      expect(graph.links).toEqual(before.links)
      expect(graph.nodes.result).toEqual(before.nodes.result)
      expect(graph.nodes.output_reviewer).toEqual(before.nodes.output_reviewer)
      expect(reopened.artifacts).toEqual(finished.artifacts)
      expect(reopened.workingArtifactIds).toEqual(finished.workingArtifactIds)
      for (const artifact of reopened.artifacts) {
        for (const [index, file] of (artifact.files ?? []).entries()) {
          expect(await readFile(join(root, outputFilePath(artifact.graphId, artifact, index)), 'utf8')).toBe(file.content)
        }
      }
      await saveFlowProject(root, reopened, reopened.activeProjectId)
      expect((await readFlowProject(root))?.graphs).toEqual(reopened.graphs)
    }
  )

  it('materializes tutorial files with usable extensions and retains source files across replay', async () => {
    const store = await directory()
    const root = await ensureTutorialWorkspace(store)
    const state = setTutorialStep(startTutorial(createDefaultWorkspaceState(), 0, root), 11)
    await saveFlowProject(root, state, state.activeProjectId)
    const result = state.artifacts.find((artifact) => artifact.nodeId === 'result')!
    expect(outputFilePath(state.activeGraphId, result, 0)).toMatch(/\.md$/)
    expect(await readFile(join(root, outputFilePath(state.activeGraphId, result, 0)), 'utf8')).toContain('3.50')
    expect(await readFile(join(root, outputFilePath(state.activeGraphId, result, 1)), 'utf8')).toContain('响应时效,3,2.67')
    expect(await readFile(join(root, 'customer-feedback.csv'), 'utf8')).toContain('C08')
    expect(await ensureTutorialWorkspace(store)).toBe(root)
    const replay = startTutorial(state, 0, root)
    await saveFlowProject(root, replay, replay.activeProjectId)
    expect(await readFile(join(root, 'customer-feedback.csv'), 'utf8')).toContain('C08')
  })

  it('uses extracted Result text instead of the internal file-name summary', () => {
    expect(artifactTextContent({
      id: 'result', runId: 'run', nodeId: 'output', version: 1, content: 'response.md', parentArtifacts: [], sourceInputs: [], createdAt: new Date().toISOString(),
      files: [{ name: 'response.md', relativePath: 'response.md', mimeType: 'text/markdown', size: 12, mode: 'text', content: '# Final answer' }]
    })).toBe('# Final answer')
  })

  it('round-trips long inputs, Markdown outputs and project metadata, rebinding the selected root', async () => {
    const root = await directory()
    const { state, stored, longText } = fixture()
    await saveFlowProject(root, state, state.activeProjectId)
    expect(await readFile(join(root, inputTextPath(stored.id, 'input', 'text')), 'utf8')).toBe(longText)
    expect(await readFile(join(root, outputTextPath(stored.id, 'agent', 'reply')), 'utf8')).toContain('# 输出')
    const reopened = await readFlowProject(root)
    expect(reopened?.graphs).toEqual(state.graphs)
    expect(reopened?.projects[0]?.workspace).toEqual({ mode: 'directory', rootPath: resolve(root) })
    expect(reopened?.sessions[0]?.workspaceSnapshot).toEqual(reopened?.projects[0]?.workspace)
    expect(latestAgentOutput(reopened!, stored.id, 'agent')?.relativePath).toBe(outputTextPath(stored.id, 'agent', 'reply'))
    expect(await readdir(root)).toEqual(['.flow'])
  })

  it('serializes competing saves and commits the newest complete state', async () => {
    const root = await directory()
    const { state } = fixture()
    const next = structuredClone(state)
    next.graphs[0]!.definition.name = 'Newest Flow'
    await Promise.all([saveFlowProject(root, state, state.activeProjectId), saveFlowProject(root, next, next.activeProjectId)])
    expect((await readFlowProject(root))?.graphs[0]?.definition.name).toBe('Newest Flow')
    expect((await readdir(join(root, '.flow'))).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  it('writes run artifacts and attachment bytes inside .flow', async () => {
    const root = await directory()
    const { state, stored } = fixture()
    const input = stored.definition.nodes.input
    if (input?.type === 'input') input.items.push({ id: 'attachment', name: 'example.bin', kind: 'file', mode: 'attachment', content: '', dataBase64: Buffer.from('binary-test').toString('base64') })
    const run = await executeGraph(stored.definition, { delayMs: 0 })
    state.runs.push({ id: run.runId, projectId: stored.projectId, graphId: stored.id, graphRevision: stored.revision,
      sessionBindings: {}, workspaceSnapshot: state.projects[0]!.workspace, artifacts: run.artifacts, events: run.events, createdAt: state.updatedAt })
    state.artifacts.push(...run.artifacts.map((artifact) => ({ ...artifact, projectId: stored.projectId, graphId: stored.id })))
    await saveFlowProject(root, state, stored.projectId)
    const output = run.artifacts.find((artifact) => artifact.nodeId === 'agent')!
    expect(await readFile(join(root, outputTextPath(stored.id, 'agent', output.id)), 'utf8')).toBe(output.content)
    expect(await readFile(join(root, '.flow', 'attachments', fileSegment(stored.id), fileSegment('attachment'), fileSegment('example.bin')), 'utf8')).toBe('binary-test')
    expect((await readFlowProject(root))?.runs[0]?.artifacts).toEqual(run.artifacts)
  })

  it('refuses to overwrite a different project in the selected directory', async () => {
    const root = await directory()
    const { state } = fixture()
    await saveFlowProject(root, state, state.activeProjectId)
    const before = await readFile(join(root, FLOW_PROJECT_FILE), 'utf8')
    const other = fixture().state
    await expect(saveFlowProject(root, other, other.activeProjectId)).rejects.toThrow('另一个 Flow 项目')
    expect(await readFile(join(root, FLOW_PROJECT_FILE), 'utf8')).toBe(before)
  })

  it.each(['null', '{"format":"agentflow-project","version":99}', '{"broken":', '{"format":"agentflow-project","version":1,"state":{"runs":[null]}}'])('preserves invalid or unsupported metadata: %s', async (content) => {
    const root = await directory()
    await mkdir(join(root, '.flow'))
    await writeFile(join(root, FLOW_PROJECT_FILE), content)
    const { state } = fixture()
    await expect(readFlowProject(root)).rejects.toThrow()
    await expect(saveFlowProject(root, state, state.activeProjectId)).rejects.toThrow()
    expect(await readFile(join(root, FLOW_PROJECT_FILE), 'utf8')).toBe(content)
  })

  it('encodes dot segments, separators, punctuation and Windows device names', () => {
    for (const name of ['..', '.', '../escape', 'C:\\outside', 'CON', 'a:b', 'name.']) {
      const segment = fileSegment(name)
      expect(segment).toMatch(/^id-[^\\/:]+$/)
      expect(segment.endsWith('.')).toBe(false)
      expect(segment).not.toBe(name)
    }
  })

  it('returns null for a folder that has no project metadata', async () => {
    expect(await readFlowProject(await directory())).toBeNull()
  })
})
