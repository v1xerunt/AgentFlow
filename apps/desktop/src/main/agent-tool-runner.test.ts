import { afterEach, describe, expect, it, vi } from 'vitest'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, dirname, join } from 'node:path'
import { agentToolExitErrorMessage, claudeConfigCapabilities, claudeReasoningEffortsForModel, detectAgentTool, invokeAgentTool, invokeAgentToolWithRefresh, parseKimiConfigCapabilities, parseStructuredLine } from './agent-tool-runner'

afterEach(() => vi.unstubAllEnvs())

describe('managed runtime exclusion', () => {
  it('excludes an explicit managed executable, including directory aliases', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-runtime-alias-'))
    try {
      const alias = join(directory, 'runtime')
      await symlink(dirname(process.execPath), alias, process.platform === 'win32' ? 'junction' : 'dir')
      const command = join(alias, basename(process.execPath))
      expect(await detectAgentTool({ id: 'test', name: 'Test', command }, [process.execPath])).toEqual({ installed: false })
      expect(await detectAgentTool({ id: 'test', name: 'Test', command })).toMatchObject({ installed: true })
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('resolves PATH commands before excluding managed runtimes', async () => {
    vi.stubEnv('PATH', dirname(process.execPath))
    const command = basename(process.execPath)
    expect(await detectAgentTool({ id: 'test', name: 'Test', command })).toMatchObject({ installed: true, resolvedCommand: process.execPath })
    expect(await detectAgentTool({ id: 'test', name: 'Test', command }, [process.execPath])).toEqual({ installed: false })
  })

  it('keeps an independent local installation when the first PATH candidate is managed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-independent-runtime-'))
    try {
      const independent = join(directory, basename(process.execPath))
      await copyFile(process.execPath, independent)
      if (process.platform !== 'win32') await chmod(independent, 0o755)
      vi.stubEnv('PATH', `${dirname(process.execPath)}${delimiter}${directory}`)
      expect(await detectAgentTool({ id: 'test', name: 'Test', command: basename(process.execPath) }, [process.execPath])).toMatchObject({ installed: true, resolvedCommand: independent })
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it.runIf(process.platform === 'win32')('excludes the default Antigravity install directory without a PATH entry', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentflow-agy-location-'))
    try {
      const command = join(directory, 'agy', 'bin', 'agy.exe')
      await mkdir(dirname(command), { recursive: true })
      await copyFile(process.execPath, command)
      vi.stubEnv('PATH', '')
      vi.stubEnv('LOCALAPPDATA', directory)
      vi.stubEnv('APPDATA', directory)
      vi.stubEnv('USERPROFILE', directory)
      vi.stubEnv('HOME', directory)
      const tool = { id: 'agent-tool:antigravity', name: 'Antigravity', command: 'agy' }
      expect(await detectAgentTool(tool)).toMatchObject({ installed: true, resolvedCommand: command })
      expect(await detectAgentTool(tool, [command.toUpperCase()])).toEqual({ installed: false })
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})

describe('agent tool output parsing', () => {
  it('rejects destructive output paths and linked ancestors before starting a tool', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agentflow-output-guard-'))
    try {
      const workspacePath = join(root, 'workspace')
      const outside = join(root, 'outside')
      await mkdir(workspacePath); await mkdir(outside)
      await writeFile(join(outside, 'keep.txt'), 'keep')
      await symlink(outside, join(workspacePath, 'link'), process.platform === 'win32' ? 'junction' : 'dir')
      for (const path of ['.', '..', '../outside', '..\\outside', 'C:\\outside', 'C:outside', '\\\\server\\share', 'link/output', '.flow', '.flow/inputs', '.flow/agent-results', 'NUL', 'file:stream']) {
        await expect(invokeAgentTool({ id: 'test', name: 'Test', command: 'must-not-start', enabled: true, args: [], resumeArgs: [] },
          { providerId: 'test', model: 'default', prompt: '', workspacePath, outputDirectory: { path, note: '', extractText: true } }, () => {})).rejects.toThrow()
        expect(await readFile(join(outside, 'keep.txt'), 'utf8')).toBe('keep')
      }
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it('offers official Claude aliases in addition to the currently configured model', () => {
    const capabilities = claudeConfigCapabilities({ model: 'opus[1m]' }, '--effort <level> low, medium, high')
    expect(capabilities.models).toEqual(['opus', 'sonnet', 'haiku', 'opus[1m]', 'sonnet[1m]'])
    expect(capabilities.modelReasoningEfforts?.['opus[1m]']).toEqual(['low', 'medium', 'high'])
    expect(capabilities.modelReasoningEfforts?.haiku).toEqual([])
    expect(capabilities.modelReasoningEfforts?.['@tool-default']).toEqual(['low', 'medium', 'high'])
  })

  it('respects Claude model restrictions and does not offer effort on older CLIs', () => {
    const capabilities = claudeConfigCapabilities({ availableModels: ['sonnet', 'haiku'], model: 'sonnet' }, '--model <model>')
    expect(capabilities.models).toEqual(['sonnet', 'haiku'])
    expect(capabilities.reasoningOverrideSupported).toBe(false)
    expect(capabilities.modelReasoningEfforts?.sonnet ?? []).toEqual([])
  })

  it('uses the current Claude Code effort levels for each exact model family', () => {
    expect(claudeReasoningEffortsForModel('claude-opus-5')).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    expect(claudeReasoningEffortsForModel('claude-sonnet-4-6')).toEqual(['low', 'medium', 'high', 'max'])
    expect(claudeReasoningEffortsForModel('claude-haiku-4-5')).toEqual([])
  })

  it('reads Kimi Code model-specific efforts with user overrides taking precedence', () => {
    const capabilities = parseKimiConfigCapabilities(`
default_model = "kimi-code/k3"
[providers.kimi]
type = "kimi"
[models."kimi-code/k3"]
provider = "kimi"
support_efforts = ["low", "high", "max"]
[models."kimi-code/k3".overrides]
support_efforts = ["high", "max"]
[models.custom]
provider = "kimi"
support_efforts = ["low"]
`)
    expect(capabilities.models).toEqual(['kimi-code/k3', 'custom'])
    expect(capabilities.modelReasoningEfforts).toEqual({
      'kimi-code/k3': ['high', 'max'],
      custom: ['low'],
      '@tool-default': ['high', 'max']
    })
  })

  it('does not spawn a local agent when already cancelled', async () => {
    await expect(invokeAgentTool({ id: 'test', name: 'Test', command: 'must-not-spawn', enabled: true, args: [], resumeArgs: [] },
      { providerId: 'test', model: 'default', prompt: 'test', workspacePath: process.cwd() }, () => undefined, AbortSignal.abort()))
      .rejects.toMatchObject({ name: 'AbortError' })
  })

  it('turns local Agent authentication failures into actionable login guidance', () => {
    expect(agentToolExitErrorMessage('agent-tool:codex', 'Codex', 1, '', 'Not logged in. Please run codex login.'))
      .toBe('Codex 已安装，但尚未登录或登录已失效。请先在终端运行“codex login”，完成登录后回到 AgentFlow 重试。')
    expect(agentToolExitErrorMessage('agent-tool:claude-code', 'Claude Code', 1, '', 'Authentication required. Run /login.'))
      .toContain('claude auth login')
    expect(agentToolExitErrorMessage('agent-tool:kimi-code', 'Kimi Code', 1, '', 'Not authenticated. Please run kimi login.'))
      .toContain('kimi login')
    expect(agentToolExitErrorMessage('agent-tool:antigravity', 'Antigravity', 1, '', 'Sign-in required.'))
      .toContain('点击“登录 Google”')
  })

  it('sends expired managed subscriptions back to the subscription settings', () => {
    expect(agentToolExitErrorMessage('subscription:codex', 'ChatGPT（Codex）', 1, '', 'HTTP 401 Unauthorized'))
      .toBe('ChatGPT（Codex） 的登录已失效。请前往“设置 → 订阅账户”重新连接后再试。')
  })

  it('preserves non-authentication failures and their exit details', () => {
    expect(agentToolExitErrorMessage('agent-tool:codex', 'Codex', 2, '', 'Quota exceeded'))
      .toBe('Codex 退出码 2：Quota exceeded')
  })

  it('redetects and retries when an updated tool invalidates the cached executable path', async () => {
    const resolutions: boolean[] = []
    const result = await invokeAgentToolWithRefresh(async (refresh) => {
      resolutions.push(refresh)
      return {
        id: 'test',
        name: 'Test',
        command: refresh ? process.execPath : join(tmpdir(), `agentflow-stale-tool-${process.pid}`),
        enabled: true,
        args: ['-e', 'process.stdout.write("recovered")'],
        resumeArgs: []
      }
    }, { providerId: 'test', model: 'default', prompt: 'test', workspacePath: process.cwd() }, () => undefined)
    expect(result.content).toBe('recovered')
    expect(resolutions).toEqual([false, true])
  })
  it('terminates the process started for a cancelled local invocation', async () => {
    const controller = new AbortController()
    await expect(invokeAgentTool({ id: 'test', name: 'Test', command: process.execPath, enabled: true,
      args: ['-e', 'process.stdout.write("ready"); setInterval(() => {}, 1000)'], resumeArgs: [] },
      { providerId: 'test', model: 'default', prompt: 'test', workspacePath: process.cwd() }, () => controller.abort(), controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' })
  })
  it('rejects structured initialization without an answer and terminates structured failures', async () => {
    for (const event of [{ type: 'thread.started', thread_id: 'empty' }, { type: 'turn.failed', error: { message: 'Quota exceeded' } }]) {
      const script = `process.stdout.write(${JSON.stringify(JSON.stringify(event) + '\n')}); ${event.type === 'turn.failed' ? 'setInterval(() => {}, 1000)' : ''}`
      await expect(invokeAgentTool({ id: 'test', name: 'Test', command: process.execPath, enabled: true, args: ['-e', script], resumeArgs: [] }, { providerId: 'agent-tool:codex', model: 'default', prompt: 'test', workspacePath: process.cwd() }, () => {})).rejects.toThrow()
    }
    expect(parseStructuredLine('agent-tool:claude-code', JSON.stringify({ type: 'result', is_error: true, result: 'Request failed' }))).toEqual({ text: '', error: 'Request failed' })
  })
  it('reads Kimi Code assistant messages from its stream-json records', () => {
    expect(parseStructuredLine('agent-tool:kimi-code', JSON.stringify({
      role: 'assistant',
      content: '已完成修改'
    }))).toEqual({ text: '已完成修改' })
    expect(parseStructuredLine('agent-tool:kimi-code', JSON.stringify({
      role: 'assistant',
      content: [{ type: 'text', text: '兼容旧格式' }]
    }))).toEqual({ text: '兼容旧格式' })
  })

  it('captures the Kimi Code resume session id and ignores tool records', () => {
    expect(parseStructuredLine('agent-tool:kimi-code', JSON.stringify({
      role: 'meta',
      type: 'session.resume_hint',
      session_id: 'session_123'
    }))).toEqual({ text: '', sessionId: 'session_123' })
    expect(parseStructuredLine('agent-tool:kimi-code', JSON.stringify({
      role: 'tool',
      content: 'internal tool result'
    }))).toEqual({ text: '' })
  })

  it('streams Antigravity response deltas and captures its conversation id', () => {
    expect(parseStructuredLine('subscription:antigravity', JSON.stringify({
      event: 'init',
      conversation_id: 'conversation_123'
    }))).toEqual({ text: '', sessionId: 'conversation_123' })
    expect(parseStructuredLine('subscription:antigravity', JSON.stringify({
      event: 'step_update',
      step_update: { text_delta: '正在分析' }
    }))).toEqual({ text: '正在分析' })
    expect(parseStructuredLine('subscription:antigravity', JSON.stringify({
      event: 'result',
      result: { conversation_id: 'conversation_123', response: '完整结果' }
    }))).toEqual({ text: '', finalText: '完整结果', sessionId: 'conversation_123' })
  })

  it('collects files from the specified output directory', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'agentflow-agent-output-'))
    try {
      const result = await invokeAgentTool({ id: 'test', name: 'Test', command: process.execPath, enabled: true,
        args: ['-e', 'const fs=require("fs");fs.mkdirSync(".flow/agent-results/a",{recursive:true});fs.writeFileSync(".flow/agent-results/a/result.md","# Final\\n\\nDelivered");process.stdout.write("done")'], resumeArgs: [] },
      { providerId: 'test', model: 'default', prompt: 'test', workspacePath, outputDirectory: { path: '.flow/agent-results/a', note: '', extractText: true } }, () => undefined)
      expect(result.content).toBe('done')
      expect(result.files).toEqual([expect.objectContaining({ name: 'result.md', mode: 'text', content: '# Final\n\nDelivered' })])
    } finally {
      await rm(workspacePath, { recursive: true, force: true })
    }
  })

  it('saves a text-only final answer as Markdown in the managed output directory', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'agentflow-agent-output-'))
    try {
      const result = await invokeAgentTool({ id: 'test', name: 'Test', command: process.execPath, enabled: true,
        args: ['-e', 'process.stdout.write("# Final\\n\\nDelivered")'], resumeArgs: [] },
      { providerId: 'test', model: 'default', prompt: 'test', workspacePath, outputDirectory: { path: '.flow/agent-results/a', note: '', extractText: true } }, () => undefined)
      expect(result.files).toEqual([expect.objectContaining({ name: 'response.md', mode: 'text', content: '# Final\n\nDelivered\n' })])
    } finally {
      await rm(workspacePath, { recursive: true, force: true })
    }
  })
})
