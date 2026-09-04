import type { ModelMessage } from '@agentflow/core'
import type { AgentNodeDefinition, GraphDefinition } from '@agentflow/schema'
import type { AgentSession, PersistedChatMessage } from '../../shared/workspace'

export function visibleChatMessages(session: Pick<AgentSession, 'messages' | 'activeLeafMessageId'>) {
  const byId = new Map(session.messages.map((message) => [message.id, message]))
  let current = session.activeLeafMessageId ? byId.get(session.activeLeafMessageId) : session.messages.at(-1)
  const path: PersistedChatMessage[] = []
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    path.unshift(current)
    visited.add(current.id)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

export function boundedVisibleChatMessages(session: Pick<AgentSession, 'messages' | 'activeLeafMessageId'>, maxChars: number) {
  const visible = visibleChatMessages(session)
  const limit = Math.max(0, Math.floor(maxChars))
  const selected: PersistedChatMessage[] = []
  let used = 0
  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const message = visible[index]!
    if (selected.length && used + message.content.length > limit) break
    selected.unshift(message)
    used += message.content.length
  }
  return selected
}

export function buildChatModelMessages(
  graph: Pick<GraphDefinition, 'goal'>,
  node: Pick<AgentNodeDefinition, 'prompts'>,
  session: Pick<AgentSession, 'messages' | 'activeLeafMessageId'>,
  maxHistoryChars: number
): ModelMessage[] {
  const messages: ModelMessage[] = []
  const system = [
    graph.goal.trim() ? `Flow goal:\n${graph.goal.trim()}` : '',
    node.prompts.system.content.trim() ? `Agent system prompt:\n${node.prompts.system.content.trim()}` : ''
  ].filter(Boolean).join('\n\n')
  if (system) messages.push({ role: 'system', content: system })
  messages.push(...boundedVisibleChatMessages(session, maxHistoryChars).map((message) => ({
    role: message.role,
    content: message.content
  })))
  return messages
}

export function messageCandidates(session: Pick<AgentSession, 'messages'>, messageId: string) {
  const target = session.messages.find((message) => message.id === messageId)
  if (!target) return []
  return session.messages.filter((message) => message.role === target.role && message.parentId === target.parentId)
}

export function selectMessageCandidate(session: AgentSession, messageId: string): AgentSession {
  if (!session.messages.some((message) => message.id === messageId)) return session
  let leaf = messageId
  const visited = new Set<string>()
  while (!visited.has(leaf)) {
    visited.add(leaf)
    const child = [...session.messages].reverse().find((message) => message.parentId === leaf)
    if (!child) break
    leaf = child.id
  }
  return { ...session, activeLeafMessageId: leaf, updatedAt: new Date().toISOString() }
}

export function appendChatMessage(session: AgentSession, message: PersistedChatMessage, parentId = session.activeLeafMessageId): AgentSession {
  return {
    ...session,
    messages: [...session.messages, { ...message, parentId }],
    activeLeafMessageId: message.id,
    updatedAt: message.createdAt ?? new Date().toISOString()
  }
}

export function deleteChatMessage(session: AgentSession, messageId: string): AgentSession {
  const target = session.messages.find((message) => message.id === messageId)
  if (!target) return session
  const descendants = descendantIds(session.messages, messageId)
  const children = session.messages.filter((message) => message.parentId === messageId)
  const messages = session.messages
    .filter((message) => message.id !== messageId)
    .map((message) => {
      const reparented = children.some((child) => child.id === message.id) ? { ...message, parentId: target.parentId } : message
      return descendants.has(message.id)
        ? { ...reparented, providerState: undefined, externalSessionId: undefined }
        : reparented
    })
  let activeLeafMessageId = session.activeLeafMessageId
  if (activeLeafMessageId === messageId) activeLeafMessageId = children.at(-1)?.id ?? target.parentId
  return { ...session, messages, activeLeafMessageId, externalSessionId: undefined, updatedAt: new Date().toISOString() }
}

export function editChatMessageCandidate(session: AgentSession, messageId: string, replacement: PersistedChatMessage) {
  const target = session.messages.find((message) => message.id === messageId)
  if (!target) return session
  return appendChatMessage(session, { ...replacement, role: target.role }, target.parentId)
}

function descendantIds(messages: PersistedChatMessage[], parentId: string) {
  const result = new Set<string>()
  const queue = [parentId]
  while (queue.length) {
    const current = queue.shift()!
    for (const message of messages) if (message.parentId === current && !result.has(message.id)) {
      result.add(message.id)
      queue.push(message.id)
    }
  }
  return result
}
