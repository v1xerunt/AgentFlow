import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { encryptSecret, LlmSettingsService, withToolArgs } from './llm-settings'
import { safeStorage } from 'electron'
import * as agentRunner from './agent-tool-runner'

vi.mock('electron', () => ({ safeStorage: {
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'gnome_libsecret',
  encryptString: (value: string) => Buffer.from(value),
  decryptString: (value: Buffer) => value.toString()
} }))
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('persisted provider model capabilities', () => {
  it('rejects the unprotected Linux credential backend', () => {
    vi.stubGlobal('process', { ...process, platform: 'linux' })
    vi.spyOn(safeStorage, 'getSelectedStorageBackend').mockReturnValue('basic_text')
    expect(() => encryptSecret('test-key')).toThrow('凭据加密')
  })
  it('does not offer a freshly installed subscription runtime as a local tool', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-managed-detection-'))
    try {
      await mkdir(join(directory, 'subscription-connectors'), { recursive: true })
      await writeFile(join(directory, 'subscription-connectors', 'state.json'), JSON.stringify({ version: 1, connectors: [
        { id: 'subscription:antigravity', runtimeCommand: process.execPath, installedByAgentFlow: true, connected: true }
      ] }))
      vi.spyOn(agentRunner, 'detectAgentTool').mockImplementation(async (tool, excludedCommands = []) =>
        tool.id === 'agent-tool:antigravity' && !excludedCommands.includes(process.execPath)
          ? { installed: true, resolvedCommand: process.execPath }
          : { installed: false })
      const result = await new LlmSettingsService(directory).detectTools()
      expect(result.agentTools.find(tool => tool.id === 'agent-tool:antigravity')).toMatchObject({ added: false, enabled: false, installed: false })
      expect(result.subscriptions.find(connector => connector.id === 'subscription:antigravity')).toMatchObject({ installed: true, connected: true })
      expect(result.catalog.some(group => group.id === 'agent-tool:antigravity')).toBe(false)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('resolves the configured Antigravity executable for login even when disabled', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-login-command-'))
    try {
      const detect = vi.spyOn(agentRunner, 'detectAgentTool').mockResolvedValue({ installed: true, resolvedCommand: process.execPath })
      const service = new LlmSettingsService(directory)
      const initial = await service.snapshot()
      await service.save({ ...initial, agentTools: initial.agentTools.map(tool => tool.id === 'agent-tool:antigravity' ? { ...tool, command: process.execPath, enabled: false } : tool) })
      await expect(service.agentToolLoginCommand('agent-tool:antigravity')).resolves.toBe(process.execPath)
      expect(detect).toHaveBeenLastCalledWith({ id: 'agent-tool:antigravity', name: 'Antigravity', command: process.execPath }, [])
      await expect(service.agentToolLoginCommand('agent-tool:codex')).rejects.toThrow('暂不支持')
      detect.mockResolvedValue({ installed: false })
      await expect(service.agentToolLoginCommand('agent-tool:antigravity')).rejects.toThrow('检测命令')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it.each(['openai', 'custom:test'])('persists %s model switches across refresh and restart and blocks disabled selections', async providerId => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-provider-models-'))
    try {
      const service = new LlmSettingsService(directory)
      const initial = await service.snapshot()
      const provider = { id: providerId, name: 'Test Provider', protocol: 'openai-compatible' as const, baseUrl: 'https://example.test/v1', added: true, enabled: true, custom: providerId.startsWith('custom:'), apiKey: 'test-only-key', manualModels: [] }
      await service.save({ ...initial, providers: [...initial.providers.filter(item => item.id !== providerId), provider] })
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] }))))
      const discovered = await service.refreshModels(providerId)
      expect(discovered.catalog.find(group => group.id === providerId)?.models).toHaveLength(2)
      const disabled = await service.save({ ...discovered, providers: discovered.providers.map(item => item.id === providerId ? { ...item, disabledModels: ['model-a'] } : item), promptAutofill: { providerId, model: 'model-a' }, flowGeneration: { providerId, model: 'model-b' } })
      expect(disabled.catalog.find(group => group.id === providerId)?.models.map(model => model.modelId)).toEqual(['model-b'])
      expect(disabled.promptAutofill).toEqual({ providerId: '', model: '' })
      expect(disabled.flowGeneration).toEqual({ providerId, model: 'model-b' })
      await expect(service.resolvedProvider(providerId, 'model-a')).rejects.toThrow('已停用')
      await expect(service.resolvedProvider(providerId, 'model-b')).resolves.toMatchObject({ apiKey: 'test-only-key' })
      const reloaded = new LlmSettingsService(directory)
      const refreshed = await reloaded.refreshModels(providerId)
      expect(refreshed.providers.find(item => item.id === providerId)?.disabledModels).toEqual(['model-a'])
      const omitted = await reloaded.save({ ...refreshed, providers: refreshed.providers.map(({ disabledModels: _disabled, ...item }) => item) })
      expect(omitted.providers.find(item => item.id === providerId)?.disabledModels).toEqual(['model-a'])
      const allOff = await reloaded.save({ ...omitted, providers: omitted.providers.map(item => item.id === providerId ? { ...item, disabledModels: ['model-a', 'model-b'] } : item) })
      expect(allOff.catalog.find(group => group.id === providerId)?.models).toEqual([])
      expect(allOff.flowGeneration).toEqual({ providerId: '', model: '' })
      const allOn = await reloaded.save({ ...allOff, providers: allOff.providers.map(item => ({ ...item, disabledModels: [] })) })
      expect(allOn.catalog.find(group => group.id === providerId)?.models).toHaveLength(2)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('persists model toggles, excludes disabled models from the catalog and rejects their invocation', async () => {
    vi.spyOn(agentRunner, 'detectAgentTool').mockResolvedValue({ installed: true, models: ['opus', 'sonnet', 'haiku'], reasoningOverrideSupported: true, modelReasoningEfforts: { opus: ['low', 'high'], sonnet: ['low', 'high'], haiku: [] } })
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-tool-models-'))
    try {
      const service = new LlmSettingsService(directory)
      const initial = await service.detectTools()
      const input = { ...initial, agentTools: initial.agentTools.map(tool => tool.id === 'agent-tool:claude-code' ? { ...tool, added: true, enabled: true, model: 'opus', disabledModels: ['opus', 'haiku'], modelReasoningEfforts: { sonnet: ['invented'] } } : tool) }
      const saved = await service.save(input)
      expect(saved.agentTools.find(tool => tool.id === 'agent-tool:claude-code')?.model).toBeUndefined()
      expect(saved.catalog.find(group => group.id === 'agent-tool:claude-code')?.models.map(model => model.modelId)).toEqual(['@tool-default', 'sonnet'])
      await expect(service.agentTool('agent-tool:claude-code', 'opus')).rejects.toThrow('模型已停用')
      await expect(service.agentTool('agent-tool:claude-code', 'sonnet', 'invented')).rejects.toThrow('仅支持推理强度')
      await expect(service.agentTool('agent-tool:claude-code', 'sonnet', 'high')).resolves.toMatchObject({ model: 'sonnet', reasoning: 'high' })
      const restarted = new LlmSettingsService(directory)
      expect((await restarted.detectTools()).agentTools.find(tool => tool.id === 'agent-tool:claude-code')?.disabledModels).toEqual(['opus', 'haiku'])
      const disabled = await restarted.save({ ...saved, agentTools: saved.agentTools.map(tool => tool.id === 'agent-tool:claude-code' ? { ...tool, disabledModels: ['@tool-default', 'opus', 'sonnet', 'haiku'] } : tool) })
      expect(disabled.catalog.find(group => group.id === 'agent-tool:claude-code')?.models).toEqual([])
      await expect(restarted.agentTool('agent-tool:claude-code', '@tool-default')).rejects.toThrow('模型已停用')
      const enabled = await restarted.save({ ...disabled, agentTools: disabled.agentTools.map(tool => ({ ...tool, disabledModels: [] })) })
      expect(enabled.catalog.find(group => group.id === 'agent-tool:claude-code')?.models).toHaveLength(4)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('saves, reloads, preserves and clears the Anthropic workspace without replacing the key', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-anthropic-workspace-'))
    try {
      const service = new LlmSettingsService(directory)
      const initial = await service.snapshot()
      const saved = await service.save({ ...initial, providers: initial.providers.map(provider => provider.id === 'anthropic' ? { ...provider, added: true, enabled: true, apiKey: 'test-only-key', anthropicWorkspaceId: '  wrkspc_test123  ' } : provider) })
      expect(saved.providers.find(provider => provider.id === 'anthropic')?.anthropicWorkspaceId).toBe('wrkspc_test123')
      const reloaded = new LlmSettingsService(directory)
      expect((await reloaded.resolvedProvider('anthropic'))).toMatchObject({ anthropicWorkspaceId: 'wrkspc_test123', apiKey: 'test-only-key' })
      const omitted = await reloaded.save({ ...saved, providers: [], agentTools: [] })
      expect(omitted.providers.find(provider => provider.id === 'anthropic')?.anthropicWorkspaceId).toBe('wrkspc_test123')
      const unchanged = await reloaded.save({ ...saved, providers: saved.providers.map(({ anthropicWorkspaceId: _workspace, ...provider }) => provider) })
      expect(unchanged.providers.find(provider => provider.id === 'anthropic')?.anthropicWorkspaceId).toBe('wrkspc_test123')
      await reloaded.save({ ...unchanged, providers: unchanged.providers.map(provider => ({ ...provider, anthropicWorkspaceId: '' })) })
      const cleared = await new LlmSettingsService(directory).resolvedProvider('anthropic')
      expect(cleared.anthropicWorkspaceId).toBeUndefined()
      expect(cleared.apiKey).toBe('test-only-key')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('rejects invalid Anthropic workspace IDs before persisting settings', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-anthropic-validation-'))
    try {
      const service = new LlmSettingsService(directory)
      const initial = await service.snapshot()
      for (const anthropicWorkspaceId of ['not-a-workspace', 'wrkspc_ok\r\nInjected: value']) {
        await expect(service.save({ ...initial, providers: initial.providers.map(provider => ({ ...provider, ...(provider.id === 'anthropic' ? { anthropicWorkspaceId } : {}) })) })).rejects.toThrow('工作区 ID 格式无效')
      }
      expect((await service.snapshot()).providers.find(provider => provider.id === 'anthropic')?.anthropicWorkspaceId).toBeUndefined()
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('keeps the general Z.AI API and GLM Coding Plan as separate built-in providers', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-zai-presets-'))
    try {
      const snapshot = await new LlmSettingsService(directory).snapshot()
      expect(snapshot.providers.find((provider) => provider.id === 'zai')?.baseUrl).toBe('https://api.z.ai/api/paas/v4')
      expect(snapshot.providers.find((provider) => provider.id === 'zai-coding-plan')?.baseUrl).toBe('https://api.z.ai/api/coding/paas/v4')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('adds connected subscription accounts to the model catalog separately from local tools', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-subscription-catalog-'))
    try {
      const statePath = join(directory, 'subscription-connectors', 'state.json')
      await mkdir(join(directory, 'subscription-connectors'), { recursive: true })
      await writeFile(statePath, JSON.stringify({ version: 1, connectors: [
        { id: 'subscription:codex', runtimeCommand: process.execPath, connected: true },
        { id: 'subscription:claude-code' },
        { id: 'subscription:kimi-code' },
        { id: 'subscription:antigravity' },
        { id: 'subscription:deepseek-web', connected: true, riskAccepted: true }
      ] }), 'utf8')
      const snapshot = await new LlmSettingsService(directory).snapshot()
      expect(snapshot.catalog.find((group) => group.id === 'subscription:codex')).toMatchObject({ connector: 'subscription', configured: true })
      expect(snapshot.catalog.find((group) => group.id === 'subscription:codex')?.models[0]?.modelName).toBe('订阅默认模型')
      expect(snapshot.catalog.find((group) => group.id === 'subscription:deepseek-web')?.models.map(model => [model.modelId, model.modelName])).toEqual([
        ['deepseek-chat', '快速模式'], ['deepseek-reasoner', '专家模式']
      ])
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('renders Codex reasoning effort as a config override argument', () => {
    expect(withToolArgs(
      ['--sandbox', 'workspace-write', 'exec', '--json', '-'],
      ['--model', '{model}'],
      ['--config', 'model_reasoning_effort="{reasoning}"'],
      'gpt-5.6-sol',
      'high'
    )).toEqual(['--sandbox', 'workspace-write', 'exec', '--json', '--model', 'gpt-5.6-sol', '--config', 'model_reasoning_effort="high"', '-'])
  })

  it('keeps fetched reasoning metadata through save, reload and provider resolution', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-model-capabilities-'))
    try {
      const service = new LlmSettingsService(directory)
      const initial = await service.snapshot()
      expect(initial.chatHistoryMaxChars).toBe(200_000)
      const input = { providers: initial.providers.map(provider => ({ ...provider, ...(provider.id === 'openrouter' ? { enabled: true, added: true, apiKey: 'test-only-key' } : {}) })), agentTools: initial.agentTools, promptAutofill: initial.promptAutofill, flowGeneration: initial.flowGeneration, chatHistoryMaxChars: 48_000 }
      await service.save(input)
      const id = '~deepseek/deepseek-v4-flash-latest'
      vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/key') ? { data: {} } : { data: [{ id, reasoning: { supported_efforts: ['max', 'high', 'low'], default_effort: 'high', mandatory: false }, supported_parameters: ['reasoning', 'max_tokens'] }] }))))
      const tested = await service.testProvider('openrouter')
      const expected = tested.providers.find(provider => provider.id === 'openrouter')?.modelMetadata
      expect(expected?.[id]?.reasoning?.supportedEfforts).toEqual(['max', 'high', 'low'])
      const featureModel = { providerId: 'openrouter', model: id }
      await service.save({ providers: tested.providers, agentTools: tested.agentTools, promptAutofill: featureModel, flowGeneration: featureModel, chatHistoryMaxChars: tested.chatHistoryMaxChars })
      const reloaded = new LlmSettingsService(directory)
      const reloadedSnapshot = await reloaded.snapshot()
      expect(reloadedSnapshot.providers.find(provider => provider.id === 'openrouter')?.modelMetadata).toEqual(expected)
      expect(reloadedSnapshot.promptAutofill).toEqual(featureModel)
      expect(reloadedSnapshot.flowGeneration).toEqual(featureModel)
      expect(reloadedSnapshot.chatHistoryMaxChars).toBe(48_000)
      expect((await reloaded.resolvedProvider('openrouter')).modelMetadata).toEqual(expected)
      expect((await reloaded.snapshot()).catalog.find(provider => provider.id === 'openrouter')?.models[0]?.parameters.reasoningLevels).toEqual(['low', 'high', 'max'])
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('keeps enabled local Agent tools as AI-assisted construction providers', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-local-feature-provider-'))
    try {
      await writeFile(join(directory, 'llm-settings.json'), JSON.stringify({
        version: 7,
        providers: [],
        agentTools: [{
          id: 'agent-tool:codex',
          command: 'codex',
          models: ['gpt-5.6-sol'],
          reasoningEfforts: ['medium'],
          modelReasoningEfforts: { 'gpt-5.6-sol': ['medium'] },
          added: true,
          enabled: true
        }],
        promptAutofill: { providerId: 'agent-tool:codex', model: '@tool-default' },
        flowGeneration: { providerId: 'agent-tool:codex', model: 'gpt-5.6-sol' },
        chatHistoryMaxChars: 24_000
      }), 'utf8')

      const snapshot = await new LlmSettingsService(directory).snapshot()
      expect(snapshot.agentTools.find((tool) => tool.id === 'agent-tool:codex')).toMatchObject({ added: true, enabled: true, installed: false })
      expect(snapshot.promptAutofill).toEqual({ providerId: 'agent-tool:codex', model: '@tool-default' })
      expect(snapshot.flowGeneration).toEqual({ providerId: 'agent-tool:codex', model: 'gpt-5.6-sol' })

      const saved = await new LlmSettingsService(directory).save({
        providers: snapshot.providers,
        agentTools: snapshot.agentTools.map((tool) => tool.id === 'agent-tool:codex' ? { ...tool, models: [] } : tool),
        promptAutofill: snapshot.promptAutofill,
        flowGeneration: snapshot.flowGeneration,
        chatHistoryMaxChars: snapshot.chatHistoryMaxChars
      })
      expect(saved.promptAutofill).toEqual({ providerId: 'agent-tool:codex', model: '@tool-default' })
      expect(saved.flowGeneration).toEqual({ providerId: 'agent-tool:codex', model: 'gpt-5.6-sol' })
      expect(saved.chatHistoryMaxChars).toBe(24_000)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
