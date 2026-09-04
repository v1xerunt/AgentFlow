import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AgentLibraryStore } from './agent-library'
import { emptyAgentLibrary, lockAgentTemplate, modelParameterKey } from '../shared/agent-library'

describe('model presets and reusable agent library', () => {
  it('persists defaults, named presets and locked agents across store instances', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-library-test-'))
    try {
      const store = new AgentLibraryStore(directory)
      expect(await store.load()).toEqual(emptyAgentLibrary())
      const library = emptyAgentLibrary()
      const parameters = { maxTokens: 32768, reasoningLevel: 'high', topP: .95 }
      const prompt = { content: '独立审核输入方案，并返回修改意见。', customized: true, locked: false }
      const node = { type: 'agent' as const, name: '方案审核', provider: 'zai', model: 'glm-5.3', parameters, prompts: { system: prompt, input: prompt, output: prompt }, position: { x: 42, y: 100 } }
      library.agents.push({ id: 'reviewer', node: lockAgentTemplate(node), createdAt: new Date().toISOString() })
      library.modelDefaults[modelParameterKey('zai', 'glm-5.3')] = parameters
      library.parameterPresets.push({ id: 'p1', name: '仔细审核', providerId: 'zai', model: 'glm-5.3', parameters })
      await store.save(library)
      expect(await new AgentLibraryStore(directory).load()).toEqual(library)
      expect(library.agents[0]?.node.position).toBeUndefined()
      expect(Object.values(library.agents[0]!.node.prompts).every((item) => item.locked)).toBe(true)
      expect(node.prompts.system.locked).toBe(false)
      expect(JSON.parse(await readFile(join(directory, 'agent-library.json'), 'utf8'))).not.toHaveProperty('apiKey')
      expect(() => store.save({ version: 99 })).toThrow()
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
