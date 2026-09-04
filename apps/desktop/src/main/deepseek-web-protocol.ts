import { t } from '@agentflow/core/localization'
/**
 * Experimental DeepSeek Web protocol helpers.
 *
 * The PoW preparation and stream-normalization approach is adapted from
 * kittors/deepseek-web-api (MIT, Copyright 2026 kittors). See
 * THIRD_PARTY_NOTICES.md for the full license notice.
 */

export const DEEPSEEK_WEB_BASE_URL = 'https://chat.deepseek.com'
export const DEEPSEEK_COMPLETION_PATH = '/api/v0/chat/completion'
export const DEEPSEEK_POW_WORKER_URL = 'https://fe-static.deepseek.com/chat/static/76608.8f2a9fa413.js'

export const DEEPSEEK_CLIENT_HEADERS = {
  'x-client-platform': 'web',
  'x-client-version': '2.2.0',
  'x-client-locale': 'zh_CN',
  'x-client-bundle-id': 'com.deepseek.chat'
} as const

export type DeepSeekModelType = 'default' | 'expert'
export type DeepSeekMessageId = string | number | null

export interface DeepSeekPreparedCompletion {
  token: string
  powHeader: string
  sessionId: string
  modelType: DeepSeekModelType
  reused: boolean
}

export interface DeepSeekSseEvent {
  event: string | null
  data: Record<string, unknown>
}

export type DeepSeekUpdate =
  | { type: 'ready'; requestMessageId: DeepSeekMessageId; responseMessageId: DeepSeekMessageId }
  | { type: 'reasoning'; delta: string }
  | { type: 'output'; delta: string }
  | { type: 'tokens'; value: number }
  | { type: 'close' }

export interface DeepSeekStreamState {
  current: 'reasoning' | 'output'
}

export class DeepSeekWebAuthenticationError extends Error {
  override name = 'DeepSeekWebAuthenticationError'
}

/** Kept as source text so Electron can execute it inside the authenticated page. */
const PREPARE_COMPLETION_SCRIPT = `async (input) => {
  if (location.origin !== "https://chat.deepseek.com") throw new Error("DeepSeek login is missing");
  const record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  const rawToken = localStorage.getItem("userToken");
  let token = "";
  if (rawToken) {
    try {
      const parsed = JSON.parse(rawToken);
      if (record(parsed) && typeof parsed.value === "string") token = parsed.value;
      else if (typeof parsed === "string") token = parsed;
    } catch { token = rawToken; }
  }
  if (!token) throw new Error("DeepSeek login is missing");

  const authHeaders = {
    authorization: "Bearer " + token,
    "content-type": "application/json",
    ...input.headers,
  };
  const challengeResponse = await fetch("/api/v0/chat/create_pow_challenge", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ target_path: input.targetPath }),
  });
  const challengeBody = await challengeResponse.json();
  if (challengeResponse.status === 401) throw new Error("DeepSeek authentication expired");
  const challengeRoot = record(challengeBody) ? challengeBody : null;
  const challengeData = challengeRoot && record(challengeRoot.data) ? challengeRoot.data : null;
  const challengeBizData = challengeData && record(challengeData.biz_data) ? challengeData.biz_data : null;
  const challenge = challengeBizData && record(challengeBizData.challenge) ? challengeBizData.challenge : null;
  if (!challengeResponse.ok || !challengeRoot || challengeRoot.code !== 0 || !challengeData || challengeData.biz_code !== 0 || !challenge) {
    throw new Error("DeepSeek challenge failed");
  }

  const workerResponse = await fetch(input.powWorkerUrl);
  if (!workerResponse.ok) throw new Error("DeepSeek PoW worker failed: " + workerResponse.status);
  const workerSource = await workerResponse.text();
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "application/javascript" }));
  const answer = await new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl);
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("DeepSeek PoW timed out"));
    }, 120000);
    worker.onmessage = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      const message = record(event.data) ? event.data : null;
      const value = message && record(message.answer) ? message.answer : null;
      if (message && message.type === "pow-answer" && value) resolve(value);
      else reject(new Error("DeepSeek PoW failed"));
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || "DeepSeek PoW worker failed"));
    };
    worker.postMessage({
      type: "pow-challenge",
      challenge: {
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        salt: challenge.salt,
        difficulty: challenge.difficulty,
        signature: challenge.signature,
        expireAt: challenge.expire_at,
      },
    });
  }).finally(() => URL.revokeObjectURL(workerUrl));

  const encoded = new TextEncoder().encode(JSON.stringify({
    algorithm: answer.algorithm,
    challenge: answer.challenge,
    salt: answer.salt,
    answer: answer.answer,
    signature: answer.signature,
    target_path: input.targetPath,
  }));
  let binary = "";
  for (const byte of encoded) binary += String.fromCharCode(byte);
  const powHeader = btoa(binary);

  let resolvedSessionId = input.sessionId;
  if (!input.reuseSession || !resolvedSessionId) {
    const sessionResponse = await fetch("/api/v0/chat_session/create", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const sessionBody = await sessionResponse.json();
    const sessionRoot = record(sessionBody) ? sessionBody : null;
    const sessionData = sessionRoot && record(sessionRoot.data) ? sessionRoot.data : null;
    const sessionBizData = sessionData && record(sessionData.biz_data) ? sessionData.biz_data : null;
    const session = sessionBizData && record(sessionBizData.chat_session) ? sessionBizData.chat_session : null;
    resolvedSessionId = session && typeof session.id === "string" ? session.id : null;
    if (!sessionResponse.ok || !resolvedSessionId) throw new Error("DeepSeek session creation failed");
  }
  return {
    token,
    powHeader,
    sessionId: resolvedSessionId,
    modelType: input.modelType,
    reused: Boolean(input.reuseSession && input.sessionId),
  };
}`

export function deepSeekPrepareJavascript(input: {
  modelType: DeepSeekModelType
  sessionId: string | null
  reuseSession: boolean
}) {
  const payload = {
    ...input,
    powWorkerUrl: DEEPSEEK_POW_WORKER_URL,
    headers: DEEPSEEK_CLIENT_HEADERS,
    targetPath: DEEPSEEK_COMPLETION_PATH
  }
  return `(${PREPARE_COMPLETION_SCRIPT})(${JSON.stringify(payload)})`
}

export function resolveDeepSeekWebModel(model: string, reasoningLevel?: string) {
  const normalized = model.toLocaleLowerCase()
  const modelType: DeepSeekModelType = /reasoner|expert|pro/.test(normalized) ? 'expert' : 'default'
  const thinking = modelType === 'expert' || Boolean(reasoningLevel && !['none', 'off', 'disabled'].includes(reasoningLevel.toLocaleLowerCase()))
  return { modelType, thinking }
}

export function deepSeekCompletionBody(input: {
  sessionId: string
  parentMessageId: DeepSeekMessageId
  modelType: DeepSeekModelType
  prompt: string
  thinking: boolean
}) {
  return {
    chat_session_id: input.sessionId,
    parent_message_id: input.parentMessageId,
    model_type: input.modelType,
    prompt: input.prompt,
    ref_file_ids: [],
    thinking_enabled: input.thinking,
    search_enabled: false,
    action: null,
    preempt: false
  }
}

export class DeepSeekSseParser {
  private buffer = ''

  push(chunk: string): DeepSeekSseEvent[] {
    this.buffer += chunk
    const events: DeepSeekSseEvent[] = []
    while (true) {
      const boundary = /\r?\n\r?\n/.exec(this.buffer)
      if (!boundary || boundary.index === undefined) break
      const block = this.buffer.slice(0, boundary.index)
      this.buffer = this.buffer.slice(boundary.index + boundary[0].length)
      const event = parseSseBlock(block)
      if (event) events.push(event)
    }
    return events
  }

  finish(): DeepSeekSseEvent[] {
    const event = parseSseBlock(this.buffer)
    this.buffer = ''
    return event ? [event] : []
  }
}

export function deepSeekUpdates(event: DeepSeekSseEvent, state: DeepSeekStreamState): DeepSeekUpdate[] {
  if (event.event === 'ready') {
    return [{
      type: 'ready',
      requestMessageId: messageId(event.data.request_message_id),
      responseMessageId: messageId(event.data.response_message_id)
    }]
  }
  if (event.event === 'close') return [{ type: 'close' }]

  const response = record(event.data.v)?.response
  const responseData = record(response)
  if (responseData) {
    const updates = fragmentUpdates(responseData.fragments, state)
    if (typeof responseData.accumulated_token_usage === 'number') updates.push({ type: 'tokens', value: responseData.accumulated_token_usage })
    return updates
  }
  if (event.data.p === 'response/fragments' && event.data.o === 'APPEND') return fragmentUpdates(event.data.v, state)

  const contentAppend = event.data.p === 'response/fragments/-1/content' && event.data.o === 'APPEND'
  const rootAppend = event.data.p === undefined && event.data.o === 'APPEND' && event.data.v !== undefined
  const bareString = event.data.p === undefined && event.data.o === undefined && typeof event.data.v === 'string'
  if (contentAppend || rootAppend || bareString) {
    const delta = String(event.data.v ?? '')
    return delta ? [{ type: state.current, delta }] : []
  }
  if (event.data.p === 'response' && event.data.o === 'BATCH' && Array.isArray(event.data.v)) {
    return event.data.v.flatMap((patch) => {
      const value = record(patch)
      return value?.p === 'accumulated_token_usage' && typeof value.v === 'number'
        ? [{ type: 'tokens' as const, value: value.v }]
        : []
    })
  }
  return []
}

export async function* readDeepSeekSse(response: Response): AsyncGenerator<DeepSeekSseEvent> {
  if (!response.ok) {
    const detail = (await response.text()).trim().slice(0, 500)
    throw new Error(t("DeepSeek web request failed (HTTP {0}){1}", [response.status, detail ? `: ${detail}` : '']))
  }
  if (response.headers.get('content-type')?.includes('application/json')) {
    const body = record(await response.json())
    const data = record(body?.data)
    const detail = data?.biz_msg ?? body?.msg ?? body?.message ?? t("No event stream returned")
    throw new Error(t("DeepSeek web: {0}", [detail]))
  }
  if (!response.body) throw new Error(t("DeepSeek web returned an empty response"))
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const parser = new DeepSeekSseParser()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of parser.push(decoder.decode(value, { stream: true }))) yield event
    }
    for (const event of parser.push(decoder.decode())) yield event
    for (const event of parser.finish()) yield event
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function parseSseBlock(block: string): DeepSeekSseEvent | undefined {
  if (!block.trim()) return undefined
  let event: string | null = null
  const data: string[] = []
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  if (!data.length) return undefined
  if (data.join('\n').trim() === '[DONE]') return { event: 'close', data: {} }
  try {
    const value = JSON.parse(data.join('\n'))
    const parsed = record(value)
    return parsed ? { event, data: parsed } : undefined
  } catch { return undefined }
}

function fragmentUpdates(value: unknown, state: DeepSeekStreamState): DeepSeekUpdate[] {
  if (!Array.isArray(value)) return []
  const updates: DeepSeekUpdate[] = []
  for (const candidate of value) {
    const fragment = record(candidate)
    if (!fragment) continue
    const type = typeof fragment.type === 'string' ? fragment.type : ''
    const content = typeof fragment.content === 'string' ? fragment.content : ''
    if (type === 'THINK' || type === 'SEARCH' || type === 'SEARCH_REF') {
      state.current = 'reasoning'
      if (content) updates.push({ type: 'reasoning', delta: content })
    } else if (type === 'RESPONSE') {
      state.current = 'output'
      if (content) updates.push({ type: 'output', delta: content })
    }
  }
  return updates
}

function messageId(value: unknown): DeepSeekMessageId {
  return typeof value === 'string' || typeof value === 'number' ? value : null
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
