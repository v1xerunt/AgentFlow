import { describe, expect, it, vi } from 'vitest'
import {
  DeepSeekSseParser,
  deepSeekCompletionBody,
  deepSeekPrepareJavascript,
  deepSeekUpdates,
  readDeepSeekSse,
  resolveDeepSeekWebModel,
  type DeepSeekStreamState
} from './deepseek-web-protocol'

describe('DeepSeek Web protocol', () => {
  it('parses chunk boundaries, CRLF and a final unterminated event', () => {
    const parser = new DeepSeekSseParser()
    expect(parser.push('event: ready\r\ndata: {"response_message')).toEqual([])
    expect(parser.push('_id":2}\r\n\r\ndata: {"v":"ok"}')).toEqual([{ event: 'ready', data: { response_message_id: 2 } }])
    expect(parser.finish()).toEqual([{ event: null, data: { v: 'ok' } }])
  })

  it('ignores malformed frames and handles the DONE marker', () => {
    const parser = new DeepSeekSseParser()
    expect(parser.push(': heartbeat\n\ndata: invalid\n\ndata: [DONE]\n\n')).toEqual([{ event: 'close', data: {} }])
  })

  it('keeps reasoning separate from answer append patches', () => {
    const state: DeepSeekStreamState = { current: 'reasoning' }
    expect(deepSeekUpdates({ event: null, data: { v: { response: { fragments: [{ type: 'THINK', content: 'reason' }] } } } }, state)).toEqual([{ type: 'reasoning', delta: 'reason' }])
    expect(deepSeekUpdates({ event: null, data: { p: 'response/fragments/-1/content', o: 'APPEND', v: 'ing' } }, state)).toEqual([{ type: 'reasoning', delta: 'ing' }])
    expect(deepSeekUpdates({ event: null, data: { p: 'response/fragments', o: 'APPEND', v: [{ type: 'RESPONSE', content: 'answer' }] } }, state)).toEqual([{ type: 'output', delta: 'answer' }])
    expect(deepSeekUpdates({ event: null, data: { v: '!' } }, state)).toEqual([{ type: 'output', delta: '!' }])
  })

  it('extracts session lineage and token metadata without mixing them into output', () => {
    const state: DeepSeekStreamState = { current: 'reasoning' }
    expect(deepSeekUpdates({ event: 'ready', data: { request_message_id: 1, response_message_id: '2' } }, state)).toEqual([{ type: 'ready', requestMessageId: 1, responseMessageId: '2' }])
    expect(deepSeekUpdates({ event: null, data: { p: 'response', o: 'BATCH', v: [{ p: 'accumulated_token_usage', v: 17 }] } }, state)).toEqual([{ type: 'tokens', value: 17 }])
    expect(deepSeekUpdates({ event: 'close', data: {} }, state)).toEqual([{ type: 'close' }])
  })

  it('decodes split UTF-8 bytes and cancels the reader on early completion', async () => {
    const bytes = new TextEncoder().encode('data: {"v":"你好"}\n\n')
    const cancel = vi.fn()
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(bytes.slice(0, 14)); controller.enqueue(bytes.slice(14)) },
      cancel
    }))
    for await (const event of readDeepSeekSse(response)) { expect(event.data.v).toBe('你好'); break }
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('reports HTTP failures instead of treating them as an empty successful stream', async () => {
    await expect((async () => {
      for await (const _event of readDeepSeekSse(new Response('expired', { status: 401 }))) { /* no events */ }
    })()).rejects.toThrow('HTTP 401')
  })

  it('maps web model modes and only exposes the supported thinking switch', () => {
    expect(resolveDeepSeekWebModel('deepseek-chat')).toEqual({ modelType: 'default', thinking: false })
    expect(resolveDeepSeekWebModel('deepseek-chat', 'enabled')).toEqual({ modelType: 'default', thinking: true })
    expect(resolveDeepSeekWebModel('deepseek-reasoner', 'none')).toEqual({ modelType: 'expert', thinking: true })
  })

  it('builds a completion request with explicit session lineage and no tool access', () => {
    expect(deepSeekCompletionBody({ sessionId: 'session', parentMessageId: 12, modelType: 'default', prompt: 'hello', thinking: false })).toEqual({
      chat_session_id: 'session', parent_message_id: 12, model_type: 'default', prompt: 'hello',
      ref_file_ids: [], thinking_enabled: false, search_enabled: false, action: null, preempt: false
    })
    const script = deepSeekPrepareJavascript({ sessionId: null, reuseSession: false, modelType: 'default' })
    expect(script).toContain('localStorage.getItem("userToken")')
    expect(script).toContain('"reuseSession":false')
    expect(script).not.toContain('fallbackToken')
  })
})
