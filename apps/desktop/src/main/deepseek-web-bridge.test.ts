import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelInvocationRequest } from '@agentflow/core'

const browser = vi.hoisted(() => ({
  windows: [] as any[],
  cookies: [{ name: 'ds_session_id', value: 'test-cookie' }],
  probeResult: true,
  probeError: undefined as Error | undefined,
  scripts: [] as string[],
  clearStorageData: vi.fn(async () => undefined),
  clearCache: vi.fn(async () => undefined),
  partitions: [] as string[]
}))

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  class WebContents extends EventEmitter {
    url = ''
    getURL() { return this.url }
    getUserAgent() { return 'test-agent' }
    setWindowOpenHandler(_handler: unknown) {}
    async executeJavaScript(script: string) {
      browser.scripts.push(script)
      if (browser.probeError) throw browser.probeError
      return script.includes('powWorkerUrl')
        ? { token: 'test-token', powHeader: 'test-pow', sessionId: 'test-session', modelType: 'default', reused: script.includes('"reuseSession":true') }
        : browser.probeResult
    }
  }
  class Window extends EventEmitter {
    webContents = new WebContents()
    destroyed = false
    constructor(readonly options: unknown) { super(); browser.windows.push(this) }
    async loadURL(url: string) { this.webContents.url = url }
    isDestroyed() { return this.destroyed }
    destroy() { if (!this.destroyed) { this.destroyed = true; this.emit('closed') } }
  }
  return {
    BrowserWindow: Window,
    session: {
      fromPartition(partition: string) {
        browser.partitions.push(partition)
        return {
          cookies: { get: async () => browser.cookies, flushStore: async () => undefined },
          fetch: (input: string, init: RequestInit) => globalThis.fetch(input, init),
          flushStorageData() {},
          clearStorageData: browser.clearStorageData,
          clearCache: browser.clearCache,
          on() {},
          setPermissionRequestHandler() {},
          setPermissionCheckHandler() {}
        }
      }
    }
  }
})

import { DeepSeekWebBridge } from './deepseek-web-bridge'

const directories: string[] = []
const request: ModelInvocationRequest = { providerId: 'subscription:deepseek-web', model: 'deepseek-chat', messages: [{ role: 'user', content: 'hello' }] }

beforeEach(() => {
  browser.windows.length = 0
  browser.scripts.length = 0
  browser.partitions.length = 0
  browser.cookies = [{ name: 'ds_session_id', value: 'test-cookie' }]
  browser.probeResult = true
  browser.probeError = undefined
  vi.clearAllMocks()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  for (const window of browser.windows) window.destroy()
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function bridge() {
  const directory = await mkdtemp(join(tmpdir(), 'agentflow-deepseek-web-'))
  directories.push(directory)
  return { directory, value: new DeepSeekWebBridge(directory) }
}

function response() {
  return new Response([
    'event: ready\ndata: {"request_message_id":1,"response_message_id":2}\n\n',
    'data: {"p":"response/fragments","o":"APPEND","v":[{"type":"THINK","content":"reason"},{"type":"RESPONSE","content":"answer"}]}\n\n',
    'data: {"p":"response/fragments/-1/content","o":"APPEND","v":"!"}\n\n',
    'event: close\ndata: {}\n\n'
  ].join(''), { headers: { 'content-type': 'text/event-stream' } })
}

describe('DeepSeek Web browser bridge', () => {
  it('validates the persisted profile even when the session cookie did not survive restart', async () => {
    browser.cookies = []
    const { value } = await bridge()
    await expect(value.probe()).resolves.toEqual({ connected: true })
    expect(browser.windows).toHaveLength(1)
    expect(browser.windows[0].isDestroyed()).toBe(true)
    expect(browser.scripts[0]).toContain('localStorage.getItem')
  })

  it('reports a missing or expired token as disconnected', async () => {
    browser.probeResult = false
    const { value } = await bridge()
    await expect(value.probe()).resolves.toEqual({ connected: false })
    expect(browser.windows[0].isDestroyed()).toBe(true)
  })

  it('propagates transient probe errors without claiming authentication expired', async () => {
    browser.probeError = new Error('Network offline')
    const { value } = await bridge()
    await expect(value.probe()).rejects.toThrow('Network offline')
    expect(browser.windows[0].isDestroyed()).toBe(true)
  })

  it('logs in using a sandboxed dedicated profile and closes the window after verification', async () => {
    const { value } = await bridge()
    const report = vi.fn()
    await expect(value.connect(report)).resolves.toEqual({ connected: true })
    expect(browser.windows[0].options).toMatchObject({ show: true, webPreferences: { partition: 'persist:agentflow-deepseek-web', sandbox: true, nodeIntegration: false, contextIsolation: true } })
    expect(browser.windows[0].isDestroyed()).toBe(true)
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ phase: 'login' }))
    expect(new Set(browser.partitions)).toEqual(new Set(['persist:agentflow-deepseek-web']))
  })

  it('treats closing the login window as cancellation', async () => {
    const { value } = await bridge()
    browser.probeResult = false
    const pending = value.connect(() => {})
    const rejected = expect(pending).rejects.toThrow('登录窗口已关闭')
    await vi.waitFor(() => expect(browser.windows).toHaveLength(1))
    browser.windows[0].destroy()
    await rejected
  })

  it('streams only answer text and stores lineage without credentials or prompt text', async () => {
    const fetcher = vi.fn(async () => response())
    vi.stubGlobal('fetch', fetcher)
    const { value, directory } = await bridge()
    const delta = vi.fn()
    const result = await value.invoke(request, delta)
    expect(result).toMatchObject({ content: 'answer!', externalSessionId: 'test-session', parts: [{ type: 'reasoning', text: 'reason' }, { type: 'output_text', text: 'answer!' }] })
    expect(delta.mock.calls.flat()).toEqual(['answer', '!'])
    const saved = await readFile(join(directory, 'subscription-connectors', 'deepseek-web', 'sessions.json'), 'utf8')
    expect(saved).toContain('historyHash')
    for (const secret of ['test-token', 'test-cookie', 'hello', 'answer!']) expect(saved).not.toContain(secret)
    expect(browser.windows[0].isDestroyed()).toBe(true)
  })

  it('resumes matching history and starts a fresh session when history changes', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return response() }))
    const { value } = await bridge()
    await value.invoke(request, () => {})
    await value.invoke({ ...request, externalSessionId: 'test-session', messages: [...request.messages, { role: 'assistant', content: 'answer!' }, { role: 'user', content: 'continue' }] }, () => {})
    expect(bodies[1]).toMatchObject({ parent_message_id: 2, prompt: 'continue' })
    await value.invoke({ ...request, externalSessionId: 'test-session', messages: [{ role: 'user', content: 'edited' }] }, () => {})
    expect(bodies[2]).toMatchObject({ parent_message_id: null, prompt: 'USER:\nedited' })
  })

  it('rejects images before creating a browser or sending a request', async () => {
    const { value } = await bridge()
    await expect(value.invoke({ ...request, messages: [{ role: 'user', content: [{ type: 'image', name: 'x.png', mimeType: 'image/png', dataBase64: 'AA==' }] }] }, () => {})).rejects.toThrow('目前支持文本输入')
    expect(browser.windows).toHaveLength(0)
  })

  it('normalizes expired authentication into a reconnect error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('expired', { status: 401 })))
    const { value } = await bridge()
    await expect(value.invoke(request, () => {})).rejects.toMatchObject({ name: 'DeepSeekWebAuthenticationError', message: expect.stringContaining('重新连接 DeepSeek') })
  })

  it('does not accept a truncated stream as a completed answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('data: {"p":"response/fragments","o":"APPEND","v":[{"type":"RESPONSE","content":"partial"}]}\n\n')))
    const { value } = await bridge()
    await expect(value.invoke(request, () => {})).rejects.toThrow('未收到回答完成确认')
  })

  it('aborts an in-flight request and destroys its browser', async () => {
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })))
    vi.stubGlobal('fetch', fetcher)
    const { value } = await bridge()
    const controller = new AbortController()
    const pending = value.invoke(request, () => {}, controller.signal)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    controller.abort()
    await rejected
    await vi.waitFor(() => expect(browser.windows[0].isDestroyed()).toBe(true))
  })

  it('disconnects active and queued calls before clearing only its profile', async () => {
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })))
    vi.stubGlobal('fetch', fetcher)
    const { value } = await bridge()
    const first = value.invoke(request, () => {})
    const second = value.invoke(request, () => {})
    const results = Promise.allSettled([first, second])
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    await value.disconnect()
    expect((await results).map((result) => result.status)).toEqual(['rejected', 'rejected'])
    expect(fetcher).toHaveBeenCalledOnce()
    expect(browser.clearStorageData).toHaveBeenCalledOnce()
    expect(browser.clearCache).toHaveBeenCalledOnce()
  })
})
