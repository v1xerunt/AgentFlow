import { localizeAppMessage, t } from '@agentflow/core/localization'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { atomicWriteFile } from './atomic-file'
import { BrowserWindow, session } from 'electron'
import type { ModelInvocationRequest, ModelInvocationResult, ModelMessage } from '@agentflow/core'
import type { SubscriptionConnectorProgress } from '../shared/llm'
import type { SubscriptionWebBridge } from './subscription-connectors'
import {
  DEEPSEEK_CLIENT_HEADERS,
  DEEPSEEK_COMPLETION_PATH,
  DEEPSEEK_WEB_BASE_URL,
  deepSeekCompletionBody,
  deepSeekPrepareJavascript,
  deepSeekUpdates,
  readDeepSeekSse,
  resolveDeepSeekWebModel,
  DeepSeekWebAuthenticationError,
  type DeepSeekMessageId,
  type DeepSeekPreparedCompletion,
  type DeepSeekStreamState
} from './deepseek-web-protocol'

const PARTITION = 'persist:agentflow-deepseek-web'
const CONNECTOR_ID = 'subscription:deepseek-web'
function LOGIN_HINT() { return t("Reconnect DeepSeek in Settings → Subscription accounts.") }

interface StoredWebSession {
  parentMessageId: DeepSeekMessageId
  historyHash: string
  updatedAt: number
}

type ProgressReporter = (progress: SubscriptionConnectorProgress) => void

/** Owns a dedicated browser profile; no default-browser or API-provider credentials are read. */
export class DeepSeekWebBridge implements SubscriptionWebBridge {
  private queue: Promise<unknown> = Promise.resolve()
  private loginInProgress?: Promise<{ connected: boolean }>
  private loginController?: AbortController
  private invocationController?: AbortController
  private sessions?: Record<string, StoredWebSession>
  private windows = new Set<BrowserWindow>()
  private connectionEpoch = 0
  private disconnecting = false
  private profileConfigured = false

  constructor(private readonly storeDirectory: string) {}

  async probe() {
    const window = this.createWindow(false)
    const signal = AbortSignal.timeout(30_000)
    try {
      await abortable(window.loadURL(DEEPSEEK_WEB_BASE_URL), signal)
      return { connected: await abortable(this.probeWindow(window), signal) }
    } finally { this.closeWindow(window) }
  }

  connect(report: ProgressReporter) {
    if (this.disconnecting) return Promise.reject(new Error(t("DeepSeek is disconnecting. Reconnect shortly.")))
    if (this.loginInProgress) return this.loginInProgress
    const pending = this.connectNow(report)
    this.loginInProgress = pending
    void pending.finally(() => { this.loginInProgress = undefined }).catch(() => undefined)
    return pending
  }

  async disconnect() {
    this.disconnecting = true
    this.connectionEpoch += 1
    try {
      this.loginController?.abort(new Error(t("DeepSeek connection cancelled.")))
      this.invocationController?.abort(new Error(t("DeepSeek disconnected.")))
      for (const window of [...this.windows]) this.closeWindow(window)
      await Promise.all([this.queue.catch(() => undefined), this.loginInProgress?.catch(() => undefined)])
      await session.fromPartition(PARTITION).clearStorageData()
      await session.fromPartition(PARTITION).clearCache()
      this.sessions = {}
      await this.persistSessions()
    } finally { this.disconnecting = false }
  }

  invoke(request: ModelInvocationRequest, onDelta: (delta: string) => void, signal?: AbortSignal): Promise<ModelInvocationResult> {
    const epoch = this.connectionEpoch
    const pending = this.queue.then(() => {
      if (this.disconnecting || epoch !== this.connectionEpoch) throw new Error(t("DeepSeek disconnected."))
      signal?.throwIfAborted()
      return this.invokeNow(request, onDelta, signal)
    })
    this.queue = pending.catch(() => undefined)
    return signal ? abortable(pending, signal) : pending
  }

  private async connectNow(report: ProgressReporter) {
    const controller = new AbortController()
    this.loginController = controller
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10 * 60_000)])
    const window = this.createWindow(true)
    window.once('closed', () => controller.abort(new Error(t("The DeepSeek login window was closed. Click “Sign in to DeepSeek” again."))))
    try {
      report({ connectorId: CONNECTOR_ID, phase: 'login', message: t("Sign in to DeepSeek in the dedicated browser and complete any verification challenge.") })
      await abortable(window.loadURL(DEEPSEEK_WEB_BASE_URL), signal)
      while (true) {
        signal.throwIfAborted()
        const connected = await abortable(this.probeWindow(window).catch(() => false), signal)
        if (connected) {
          const browserSession = session.fromPartition(PARTITION)
          browserSession.flushStorageData()
          await browserSession.cookies.flushStore()
          return { connected: true }
        }
        await delay(1_500, signal)
      }
    } catch (error) {
      if (signal.aborted && signal.reason?.name === 'TimeoutError') throw new Error(t("DeepSeek login timed out. Reconnect to continue."))
      throw error
    } finally {
      this.loginController = undefined
      this.closeWindow(window)
    }
  }

  private async invokeNow(request: ModelInvocationRequest, onDelta: (delta: string) => void, externalSignal?: AbortSignal): Promise<ModelInvocationResult> {
    if (request.messages.some((message) => Array.isArray(message.content) && message.content.some((part) => part.type === 'image'))) {
      throw new Error(t("DeepSeek Web Bridge supports text input. Remove the images and try again."))
    }
    const controller = new AbortController()
    this.invocationController = controller
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10 * 60_000), ...(externalSignal ? [externalSignal] : [])])
    const window = this.createWindow(false)
    try {
      return await abortable(this.complete(window, request, onDelta, signal), signal)
    } catch (error) {
      if (externalSignal?.aborted) throw externalSignal.reason
      if (signal.aborted) {
        if (signal.reason?.name === 'TimeoutError') throw new Error(t("The DeepSeek web response timed out. Try again shortly."))
        throw signal.reason
      }
      const message = error instanceof Error ? error.message : String(error)
      if (/login is missing|not logged|unauthori|authentication expired|token.*expired|HTTP 401/i.test(message) || message.includes(t('DeepSeek login is missing'))) throw new DeepSeekWebAuthenticationError(t("DeepSeek login has expired. {0}", [LOGIN_HINT()]))
      throw new Error(t("DeepSeek Web Bridge request failed: {0}. The web protocol may have changed. Try again later or use the DeepSeek API.", [localizeAppMessage(message)]))
    } finally {
      this.invocationController = undefined
      this.closeWindow(window)
    }
  }

  private async complete(window: BrowserWindow, request: ModelInvocationRequest, onDelta: (delta: string) => void, signal: AbortSignal): Promise<ModelInvocationResult> {
    const sessions = await this.loadSessions()
    const previous = request.externalSessionId ? sessions[request.externalSessionId] : undefined
    const lastMessage = request.messages.at(-1)
    const canResume = Boolean(previous?.parentMessageId != null && lastMessage?.role === 'user' && previous.historyHash === historyHash(request.messages.slice(0, -1)))
    const prompt = canResume ? messageText(lastMessage!) : request.messages.map((message) => `${message.role.toUpperCase()}:\n${messageText(message)}`).join('\n\n')
    if (!prompt.trim()) throw new Error(t("No text to send"))
    const model = resolveDeepSeekWebModel(request.model, request.parameters?.reasoningLevel)
    await window.loadURL(DEEPSEEK_WEB_BASE_URL)
    signal.throwIfAborted()
    if (!isDeepSeekPage(window.webContents.getURL())) throw new Error(t("DeepSeek login is missing"))
    const prepared = await window.webContents.executeJavaScript(deepSeekPrepareJavascript({
      modelType: model.modelType,
      sessionId: canResume ? request.externalSessionId! : null,
      reuseSession: canResume
    })) as DeepSeekPreparedCompletion
    signal.throwIfAborted()
    if (!prepared?.token || !prepared.powHeader || !prepared.sessionId) throw new Error(t("The web service did not return a valid session"))

    const response = await session.fromPartition(PARTITION).fetch(`${DEEPSEEK_WEB_BASE_URL}${DEEPSEEK_COMPLETION_PATH}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...DEEPSEEK_CLIENT_HEADERS,
        authorization: `Bearer ${prepared.token}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'x-ds-pow-response': prepared.powHeader,
        origin: DEEPSEEK_WEB_BASE_URL,
        referer: `${DEEPSEEK_WEB_BASE_URL}/a/chat/s/${prepared.sessionId}`,
        'user-agent': window.webContents.getUserAgent()
      },
      body: JSON.stringify(deepSeekCompletionBody({
        sessionId: prepared.sessionId,
        parentMessageId: canResume ? previous!.parentMessageId : null,
        modelType: model.modelType,
        prompt,
        thinking: model.thinking
      })),
      signal
    })

    let content = ''
    let reasoning = ''
    let completed = false
    let responseMessageId: DeepSeekMessageId = null
    const streamState: DeepSeekStreamState = { current: 'reasoning' }
    for await (const event of readDeepSeekSse(response)) {
      signal.throwIfAborted()
      if (event.event === 'error') throw new Error(String(event.data.message ?? event.data.error ?? t("The web service returned an error")))
      const updates = deepSeekUpdates(event, streamState)
      for (const update of updates) {
        if (update.type === 'ready') responseMessageId = update.responseMessageId
        else if (update.type === 'reasoning') reasoning += update.delta
        else if (update.type === 'output') { content += update.delta; onDelta(update.delta) }
      }
      if (updates.some((update) => update.type === 'close')) { completed = true; break }
    }
    if (!completed) throw new Error(t("The web connection closed before the answer was confirmed complete"))
    if (!content.trim()) throw new Error(t("The web service did not return a final answer"))

    sessions[prepared.sessionId] = {
      parentMessageId: responseMessageId,
      historyHash: historyHash([...request.messages, { role: 'assistant', content }]),
      updatedAt: Date.now()
    }
    this.sessions = Object.fromEntries(Object.entries(sessions).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 1_000))
    // A failed lineage write must not turn a completed remote response into a retry.
    await this.persistSessions().catch(() => undefined)
    return {
      content,
      parts: [...(reasoning ? [{ type: 'reasoning' as const, text: reasoning }] : []), { type: 'output_text', text: content }],
      providerId: request.providerId,
      model: request.model,
      externalSessionId: prepared.sessionId
    }
  }

  private createWindow(visible: boolean) {
    const browserSession = session.fromPartition(PARTITION)
    browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    browserSession.setPermissionCheckHandler(() => false)
    if (!this.profileConfigured) {
      browserSession.setUserAgent(chromeUserAgent(browserSession.getUserAgent()))
      browserSession.on('will-download', (event) => event.preventDefault())
      this.profileConfigured = true
    }
    const window = new BrowserWindow({
      width: 1_080,
      height: 800,
      minWidth: 640,
      minHeight: 480,
      show: visible,
      title: t("Connect DeepSeek · AgentFlow"),
      autoHideMenuBar: true,
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    this.windows.add(window)
    window.once('closed', () => this.windows.delete(window))
    window.webContents.on('will-navigate', (event, url) => { if (!isHttps(url)) event.preventDefault() })
    window.webContents.on('will-redirect', (event, url) => { if (!isHttps(url)) event.preventDefault() })
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (!isHttps(url)) return { action: 'deny' }
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true }
        }
      }
    })
    window.webContents.on('did-create-window', (child) => {
      this.windows.add(child)
      child.once('closed', () => this.windows.delete(child))
      child.webContents.on('will-navigate', (event, url) => { if (!isHttps(url)) event.preventDefault() })
      child.webContents.on('will-redirect', (event, url) => { if (!isHttps(url)) event.preventDefault() })
      child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      window.once('closed', () => this.closeWindow(child))
    })
    return window
  }

  private async probeWindow(window: BrowserWindow): Promise<boolean> {
    if (window.isDestroyed() || !isDeepSeekPage(window.webContents.getURL())) throw new Error(t("Could not verify DeepSeek login. Refresh shortly."))
    return window.webContents.executeJavaScript(`(async () => {
      let token = '';
      const raw = localStorage.getItem('userToken');
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        token = typeof parsed === 'string' ? parsed : parsed?.value;
      } catch { token = raw; }
      if (typeof token !== 'string' || !token) return false;
      const response = await fetch('/api/v0/chat/create_pow_challenge', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...${JSON.stringify(DEEPSEEK_CLIENT_HEADERS)} },
        body: JSON.stringify({ target_path: ${JSON.stringify(DEEPSEEK_COMPLETION_PATH)} }),
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 401) return false;
      if (!response.ok) throw new Error('DeepSeek status check failed (HTTP ' + response.status + ')');
      const body = await response.json();
      if (body?.code === 0 && body?.data?.biz_code === 0) return true;
      const message = String(body?.data?.biz_msg ?? body?.msg ?? '');
      if (/not logged|unauthorized|token.*expired|登录.*失效/i.test(message)) return false;
      throw new Error('DeepSeek status check failed');
    })()`) as Promise<boolean>
  }

  private closeWindow(window: BrowserWindow) {
    if (!window.isDestroyed()) window.destroy()
  }

  private sessionsPath() { return join(this.storeDirectory, 'subscription-connectors', 'deepseek-web', 'sessions.json') }

  private async loadSessions() {
    if (this.sessions) return this.sessions
    try {
      const parsed = JSON.parse(await readFile(this.sessionsPath(), 'utf8')) as { sessions?: Record<string, StoredWebSession> }
      this.sessions = Object.fromEntries(Object.entries(parsed.sessions ?? {}).filter(([, value]) => value && typeof value.historyHash === 'string' && typeof value.updatedAt === 'number' && (value.parentMessageId === null || typeof value.parentMessageId === 'string' || typeof value.parentMessageId === 'number')))
    } catch { this.sessions = {} }
    return this.sessions
  }

  private async persistSessions() {
    const path = this.sessionsPath()
    await atomicWriteFile(path, JSON.stringify({ version: 1, sessions: this.sessions ?? {} }, null, 2))
  }
}

function messageText(message: ModelMessage) {
  return typeof message.content === 'string' ? message.content : message.content.map((part) => part.type === 'text' ? part.text : '').join('\n')
}

function historyHash(messages: ModelMessage[]) {
  return createHash('sha256').update(JSON.stringify(messages.map((message) => ({ role: message.role, content: messageText(message) })))).digest('hex')
}

function isHttps(url: string) {
  try { return new URL(url).protocol === 'https:' }
  catch { return false }
}

/** Keep the host platform and bundled Chromium version while removing Electron/app product tokens. */
export function chromeUserAgent(userAgent: string) {
  const platform = userAgent.match(/^Mozilla\/5\.0 \([^)]+\)/)?.[0]
  const appleWebKit = userAgent.match(/\bAppleWebKit\/[\d.]+/)?.[0]
  const chrome = userAgent.match(/\bChrome\/[\d.]+/)?.[0]
  const safari = userAgent.match(/\bSafari\/[\d.]+/)?.[0]
  if (!platform || !appleWebKit || !chrome || !safari) return userAgent
  return `${platform} ${appleWebKit} (KHTML, like Gecko) ${chrome} ${safari}`
}

function isDeepSeekPage(url: string) {
  try { return new URL(url).origin === DEEPSEEK_WEB_BASE_URL }
  catch { return false }
}

function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

function delay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const finish = () => { signal.removeEventListener('abort', abort); resolve() }
    const timer = setTimeout(finish, milliseconds)
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
  })
}
