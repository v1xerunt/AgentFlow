import { describe, expect, it } from 'vitest'
import { composeInvocation } from './index'
import { modelAttachmentIssue, setProviderModelMetadata } from './model-parameters'
import type { GraphDefinition } from '@agentflow/schema'

const prompts = { system: { content: '', customized: false, locked: false }, input: { content: '', customized: false, locked: false }, output: { content: '', customized: false, locked: false } }

describe('model attachments', () => {
  it('uses fetched OpenRouter modalities and validates the MIME type', () => {
    setProviderModelMetadata('openrouter', {
      'openai/gpt-5.6-sol': { inputModalities: ['text', 'image'] },
      'text/model': { inputModalities: ['text'] }
    })
    expect(modelAttachmentIssue('openrouter', 'openai/gpt-5.6-sol', 'image/png')).toBeUndefined()
    expect(modelAttachmentIssue('openrouter', 'text/model', 'image/png')).toContain('不支持图片')
    expect(modelAttachmentIssue('openrouter', 'openai/gpt-5.6-sol', 'image/heic')).toContain('不接受')
  })

  it('applies provider and model family image-format requirements', () => {
    expect(modelAttachmentIssue('openai', 'gpt-5', 'image/gif')).toBeUndefined()
    expect(modelAttachmentIssue('openai', 'gpt-5', 'image/heic')).toContain('不接受')
    expect(modelAttachmentIssue('anthropic', 'claude-sonnet-4-6', 'image/webp')).toBeUndefined()
    expect(modelAttachmentIssue('google', 'gemini-2.5-pro', 'image/heic')).toBeUndefined()
    expect(modelAttachmentIssue('google', 'gemini-2.5-pro', 'image/gif')).toContain('不接受')
    expect(modelAttachmentIssue('deepseek', 'deepseek-chat', 'image/png')).toContain('不支持图片')
    expect(modelAttachmentIssue('zai', 'glm-4.5v', 'image/jpeg')).toBeUndefined()
    expect(modelAttachmentIssue('kimi', 'kimi-vl-a3b-thinking-2506', 'image/png')).toBeUndefined()
    expect(modelAttachmentIssue('agent-tool:codex', 'codex', 'image/png')).toContain('本机 Agent 工具')
    expect(modelAttachmentIssue('subscription:codex', '@tool-default', 'image/png')).toContain('订阅账户连接器')
  })

  it('places connected images in the downstream user message', () => {
    const graph: GraphDefinition = {
      version: 1, name: 'Flow', goal: 'Describe the image',
      nodes: {
        input: { type: 'input', name: 'Input', items: [{ id: 'image', name: 'photo.png', kind: 'file', mode: 'attachment', mimeType: 'image/png', size: 4, content: '', dataBase64: 'AAAA' }] },
        agent: { type: 'agent', name: 'Agent 1', provider: 'openai', model: 'gpt-5.6-sol', prompts }
      },
      links: [{ id: 'link', sourceId: 'input', targetId: 'agent', type: 'input' }]
    }
    const content = composeInvocation(graph, 'agent', new Map()).messages.at(-1)?.content
    expect(Array.isArray(content) && content.some((part) => part.type === 'image' && part.name === 'photo.png')).toBe(true)
  })
})
