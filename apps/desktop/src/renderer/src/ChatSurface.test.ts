import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChatSurface } from './EditorPanels'
import { MessageCopyButton } from './MessageCopyButton'

describe('chat message actions', () => {
  it('provides per-message copy and a distinct transcript output action', () => {
    const noop = () => {}
    const prompt = { content: '', customized: false, locked: false }
    const html = renderToStaticMarkup(createElement(ChatSurface, {
      graphName: 'Flow', nodeId: 'agent', node: { type: 'agent', name: 'Chat', provider: 'test', model: 'test', prompts: { system: prompt, input: prompt, output: prompt } },
      session: { id: 'session', status: 'idle', activeLeafMessageId: 'a', messages: [{ id: 'u', role: 'user', content: '你好' }, { id: 'a', role: 'assistant', content: '# 回复', parentId: 'u' }] },
      composerValue: '', setComposerValue: noop, replying: false, providerModels: [], onSend: noop, onBack: noop, onReset: noop,
      onEditMessage: noop, onCancelEdit: noop, onDeleteMessage: noop, onSelectCandidate: noop, onPublishArtifact: noop, onParametersChange: noop
    }))
    expect(html.match(/aria-label="复制消息"/g)).toHaveLength(2)
    expect(html).toContain('lucide-file-output')
    expect(html).not.toContain('lucide-files')
    expect(html).toContain('aria-label="将截至此处的完整对话设为结果输出"')
    expect(html).toContain('aria-label="将此回复设为结果输出"')
    expect(html).toContain('<h1>回复</h1>')
  })

  it('disables copying an empty message', () => {
    const html = renderToStaticMarkup(createElement(MessageCopyButton, { content: '' }))
    expect(html).toContain('aria-label="复制消息"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('role="status"')
  })
})
