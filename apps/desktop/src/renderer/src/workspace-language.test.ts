import { afterEach, expect, it } from 'vitest'
import { configureLanguage, getLanguageSettings } from '@agentflow/core/localization'
import { createDefaultWorkspaceState, startTutorial } from './workspace-store'
import { localizeWorkspaceDefaults } from './workspace-language'
import { localizeAutomaticAgentName } from './agent-naming'

const original = getLanguageSettings()
afterEach(() => configureLanguage(original))
it('translates tutorial fixtures and generated names while preserving custom content and structure', () => {
  configureLanguage({ preference: 'zh', systemLanguages: [] })
  const state = startTutorial(createDefaultWorkspaceState(), 12)
  const graph = state.graphs.find(graph => graph.id === state.tutorial?.graphId)!
  const writer = graph.definition.nodes.writer
  if (writer?.type !== 'agent') throw new Error('Missing writer')
  writer.name = '我的作者'
  writer.prompts.system.content = '用户自己写的提示词 {0}'
  configureLanguage({ preference: 'en', systemLanguages: [] })
  const translated = localizeWorkspaceDefaults(state)
  const result = translated.graphs.find(graph => graph.id === state.tutorial?.graphId)!
  expect(result.definition.name).toBe('Customer feedback → One-page weekly brief')
  expect(result.definition.nodes.writer?.name).toBe(writer.name)
  expect(result.definition.nodes.writer?.type === 'agent' && result.definition.nodes.writer.prompts.system.content).toBe(writer.prompts.system.content)
  expect(result.definition.links).toEqual(graph.definition.links)
  expect(result.definition.nodes.analyst?.name).toBe('Analysis plan')
  expect(translated.artifacts.map(artifact => artifact.content).join('')).not.toMatch(/\p{Script=Han}/u)
  expect(localizeWorkspaceDefaults(translated)).toBe(translated)
  const auto = { ...writer, nameCustomized: false, name: '审核 Agent 2' }
  expect(localizeAutomaticAgentName(auto).name).toBe('Reviewer Agent 2')
  expect(localizeAutomaticAgentName({ ...auto, nameCustomized: true }).name).toBe('审核 Agent 2')
})
