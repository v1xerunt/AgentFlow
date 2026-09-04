import { localizeLabel, t } from '@agentflow/core/localization'
import type { WorkspaceState } from '../../shared/workspace'
import { localizeAutomaticAgentName } from './agent-naming'
import { legacyTutorialMessages } from './tutorial-language-compat'

/** Only tutorial fixtures and generated names follow the interface language. */
export function localizeWorkspaceDefaults(state: WorkspaceState): WorkspaceState {
  const tutorialProjects = new Set(state.graphs.filter(graph => graph.definition.executionMode === 'tutorial').map(graph => graph.projectId))
  const projects = state.projects.map(project => {
    if (tutorialProjects.has(project.id)) return translateFixture(project)
    if (project.workspace.mode === 'temporary' && ['Untitled project', '未命名项目'].includes(project.name)) {
      const name = t('Untitled project')
      return name === project.name ? project : { ...project, name }
    }
    return project
  })
  const graphs = state.graphs.map(graph => {
    if (graph.definition.executionMode === 'tutorial') return translateFixture(graph)
    const nodes = Object.fromEntries(Object.entries(graph.definition.nodes).map(([id, node]) => {
      if (node.type === 'agent') return [id, localizeAutomaticAgentName(node)]
      if (node.type === 'output') {
        const name = ['Result', '结果'].includes(node.name) ? t('Result') : node.name
        return [id, name === node.name ? node : { ...node, name }]
      }
      const number = /^(?:Input|输入) (\d+)$/.exec(node.name)?.[1]
      const name = number ? t('Input {0}', [number]) : node.name
      const items = node.items.map(item => {
        const name = ['Text input', '文本输入'].includes(item.name) ? t('Text input') : item.name
        return name === item.name ? item : { ...item, name }
      })
      return [id, name === node.name && items.every((item, index) => item === node.items[index]) ? node : { ...node, name, items }]
    }))
    const name = ['Untitled Flow', '未命名 Flow'].includes(graph.definition.name) ? t('Untitled Flow') : graph.definition.name
    if (name === graph.definition.name && Object.entries(nodes).every(([id, node]) => node === graph.definition.nodes[id])) return graph
    return { ...graph, definition: { ...graph.definition, nodes, name } }
  })
  const artifacts = state.artifacts.map(artifact => tutorialProjects.has(artifact.projectId) && artifact.runId.endsWith('-sample') ? translateFixture(artifact) : artifact)
  if (projects.every((p, i) => p === state.projects[i]) && graphs.every((g, i) => g === state.graphs[i]) && artifacts.every((a, i) => a === state.artifacts[i])) return state
  return { ...state, projects, graphs, artifacts }
}

function translateFixture<T>(value: T, key = ''): T {
  if (typeof value === 'string') {
    if (!/^(name|goal|content|note|label)$/.test(key)) return value
    const legacy = legacyTutorialMessages[value as keyof typeof legacyTutorialMessages]
    return (legacy ? t(legacy) : localizeLabel(value)) as T
  }
  if (!value || typeof value !== 'object') return value
  const entries = Object.entries(value).map(([k, v]) => [k, translateFixture(v, k)] as const)
  if (entries.every(([k, v]) => v === (value as Record<string, unknown>)[k])) return value
  if (Array.isArray(value)) return entries.map(([, v]) => v) as T
  const result = Object.fromEntries(entries)
  if (typeof result.content === 'string' && typeof result.size === 'number') result.size = new TextEncoder().encode(result.content).length
  return result as T
}
