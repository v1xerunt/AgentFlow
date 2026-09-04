import { describe, expect, it, vi } from 'vitest'
import { modelParameterProfile, type ModelInvocationResult } from '@agentflow/core'
import type { DesktopLlmApi } from '../../shared/llm'
import { invokeDesktopModel } from './model-invocation'
import { fallbackLlmSettings, registerLlmModelMetadata } from './llm-catalog'

const request = { providerId: 'deepseek', model: 'test-model', messages: [{ role: 'user' as const, content: 'test' }], workspace: { mode: 'temporary' as const, tempId: 'test' } }

describe('model cancellation bridge', () => {
  it('registers local Agent reasoning levels in the renderer parameter editor', () => {
    registerLlmModelMetadata({
      ...fallbackLlmSettings,
      catalog: [{
        id: 'agent-tool:codex',
        name: 'Codex',
        connector: 'agent-tool',
        configured: true,
        models: [{
          providerId: 'agent-tool:codex',
          providerName: 'Codex',
          modelId: '@tool-default',
          modelName: '工具默认模型',
          connector: 'agent-tool',
          configured: true,
          parameters: { temperature: false, topP: false, maxTokens: false, reasoning: true, reasoningLevels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] }
        }]
      }]
    })
    expect(modelParameterProfile('agent-tool:codex', '@tool-default').reasoning?.levels).toEqual(['low', 'medium', 'high', 'xhigh', 'max', 'ultra'])
  })

  it('cancels by request ID, rejects promptly and suppresses late text', async () => {
    const controller = new AbortController()
    let delta: ((text: string) => void) | undefined
    let finish!: (result: ModelInvocationResult) => void
    const invokeModel = vi.fn((_request, callback) => { delta = callback; return new Promise<ModelInvocationResult>((resolve) => { finish = resolve }) })
    const cancelModel = vi.fn()
    const output = vi.fn()
    const pending = invokeDesktopModel({ invokeModel, cancelModel } as unknown as DesktopLlmApi, request, output, controller.signal)
    delta?.('first')
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancelModel).toHaveBeenCalledWith(invokeModel.mock.calls[0]![0].requestId)
    delta?.('late')
    finish({ content: 'late', providerId: 'deepseek', model: 'test-model' })
    expect(output.mock.calls).toEqual([['first']])
  })

  it('does not invoke an already cancelled request', async () => {
    const invokeModel = vi.fn()
    await expect(invokeDesktopModel({ invokeModel } as unknown as DesktopLlmApi, request, undefined, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' })
    expect(invokeModel).not.toHaveBeenCalled()
  })
})
