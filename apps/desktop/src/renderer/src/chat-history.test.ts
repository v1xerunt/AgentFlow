import { describe, expect, it } from 'vitest'
import type { AgentSession } from '../../shared/workspace'
import { boundedVisibleChatMessages, buildChatModelMessages, deleteChatMessage, messageCandidates, selectMessageCandidate, visibleChatMessages } from './chat-history'

const session = (): AgentSession => ({
  id: 's', projectId: 'p', graphId: 'g', agentNodeId: 'a', connector: 'model', isActive: true, status: 'idle',
  workspaceSnapshot: { mode: 'temporary', tempId: 't' }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', activeLeafMessageId: 'a2',
  messages: [
    { id: 'u1', role: 'user', content: 'one' },
    { id: 'a1', role: 'assistant', content: 'first', parentId: 'u1' },
    { id: 'a1b', role: 'assistant', content: 'alternative', parentId: 'u1' },
    { id: 'u2', role: 'user', content: 'two', parentId: 'a1b' },
    { id: 'a2', role: 'assistant', content: 'answer', parentId: 'u2', externalSessionId: 'opaque', providerState: { format: 'gemini-parts', data: [] } }
  ]
})

describe('chat history branches', () => {
  it('shows only the selected branch and switches candidates', () => {
    expect(visibleChatMessages(session()).map((message) => message.id)).toEqual(['u1', 'a1b', 'u2', 'a2'])
    expect(messageCandidates(session(), 'a1b').map((message) => message.id)).toEqual(['a1', 'a1b'])
    expect(visibleChatMessages(selectMessageCandidate(session(), 'a1')).map((message) => message.id)).toEqual(['u1', 'a1'])
  })

  it('splices a deleted message without deleting later replies', () => {
    const result = deleteChatMessage(session(), 'u2')
    expect(result.messages.some((message) => message.id === 'a2')).toBe(true)
    expect(result.messages.find((message) => message.id === 'a2')).toMatchObject({ parentId: 'a1b', externalSessionId: undefined, providerState: undefined })
  })

  it('drops the oldest visible messages when the history limit is exceeded', () => {
    expect(boundedVisibleChatMessages(session(), 9).map((message) => message.id)).toEqual(['u2', 'a2'])
    expect(boundedVisibleChatMessages(session(), 1).map((message) => message.id)).toEqual(['a2'])
  })

  it('builds chat context from the Flow goal, System Prompt and bounded visible history only', () => {
    const messages = buildChatModelMessages(
      { goal: '完成产品评审' },
      { prompts: {
        system: { content: '你是产品顾问。', customized: true, locked: false },
        input: { content: '必须按批处理输入约定执行。', customized: true, locked: false },
        output: { content: '必须输出固定 schema。', customized: true, locked: false }
      } },
      session(),
      9
    )
    expect(messages.map((message) => message.role)).toEqual(['system', 'user', 'assistant'])
    expect(messages[0]?.content).toContain('完成产品评审')
    expect(messages[0]?.content).toContain('你是产品顾问。')
    expect(messages[0]?.content).not.toContain('批处理输入约定')
    expect(messages[0]?.content).not.toContain('固定 schema')
    expect(messages.slice(1).map((message) => message.content)).toEqual(['two', 'answer'])
    expect(messages.slice(1).some((message) => message.providerState)).toBe(false)
  })
})
