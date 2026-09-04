import { t } from '@agentflow/core/localization'
import {
  invokeModelSafely,
  normalizeProviderId,
  sanitizeModelParameters,
  modelParameterProfile,
  setProviderModelMetadata,
  type ModelParameterMetadata,
  type ModelInvocationRequest,
  type ModelInvocationResult,
  type ModelMessage,
  type ModelProviderState,
  type ModelResponsePart,
  type ModelUsage
} from '@agentflow/core'
import type { ProviderProtocol } from '../shared/llm'

export interface ResolvedProvider {
  id: string
  name: string
  protocol: ProviderProtocol
  baseUrl: string
  anthropicWorkspaceId?: string
  apiKey: string
  requireApiKey: boolean
  modelMetadata?: Record<string, ModelParameterMetadata>
}

type FetchLike = typeof fetch

export async function invokeProvider(
  provider: ResolvedProvider,
  request: ModelInvocationRequest,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch
): Promise<ModelInvocationResult> {
  return invokeModelSafely((_request, delta, guardedSignal) => invokeProviderRequest(provider, request, delta ?? (() => {}), guardedSignal, fetchImpl), request, onDelta, signal)
}

async function invokeProviderRequest(
  provider: ResolvedProvider,
  request: ModelInvocationRequest,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch
): Promise<ModelInvocationResult> {
  const providerId = normalizeProviderId(provider.id)
  const model = request.model
  setProviderModelMetadata(providerId, provider.modelMetadata ?? {})
  const parameters = sanitizeModelParameters(providerId, model, request.parameters)
  if (provider.requireApiKey && !provider.apiKey) throw new Error(t("No API key configured for {0}", [provider.name]))

  if (provider.protocol === 'anthropic') {
    return invokeAnthropic(provider, { ...request, providerId, model, parameters }, onDelta, signal, fetchImpl)
  }
  if (provider.protocol === 'gemini') {
    return invokeGemini(provider, { ...request, providerId, model, parameters }, onDelta, signal, fetchImpl)
  }
  if (providerId === 'openai') {
    return invokeOpenAiResponses(provider, { ...request, providerId, model, parameters }, onDelta, signal, fetchImpl)
  }
  return invokeOpenAiCompatible(provider, { ...request, providerId, model, parameters }, onDelta, signal, fetchImpl)
}

async function invokeOpenAiResponses(
  provider: ResolvedProvider,
  request: ModelInvocationRequest,
  onDelta: (delta: string) => void,
  signal: AbortSignal | undefined,
  fetchImpl: FetchLike
): Promise<ModelInvocationResult> {
  const system = request.messages.filter((message) => message.role === 'system').map(messageText).join('\n\n')
  const conversational = request.messages.filter((message) => message.role !== 'system')
  const body: Record<string, unknown> = {
    model: request.model,
    input: responsesInput(conversational),
    stream: true,
    store: false
  }
  const structured = request.responseMode === 'structured'
  if (!structured) body.include = ['reasoning.encrypted_content']
  if (system) body.instructions = system
  const parameters = request.parameters
  if (parameters?.maxTokens != null) body.max_output_tokens = parameters.maxTokens
  if (parameters?.reasoningLevel) body.reasoning = structured
    ? { effort: parameters.reasoningLevel }
    : { effort: parameters.reasoningLevel, summary: 'auto' }
  if (parameters?.verbosity || structured) body.text = {
    ...(parameters?.verbosity ? { verbosity: parameters.verbosity } : {}),
    ...(structured ? { format: { type: 'json_object' } } : {})
  }
  mergeCustomParameters(body, parameters?.customParameters)
  const response = await fetchImpl(joinUrl(provider.baseUrl, 'responses'), {
    method: 'POST', headers: authorizationHeaders(provider), body: JSON.stringify(body), signal
  })
  if (!response.ok) throw await providerError(response, provider.name)
  let content = ''
  let summary = ''
  let responseId: string | undefined
  let usage: ModelUsage | undefined
  const outputItems: unknown[] = []
  await readSseEvents(response, (event) => {
    const type = typeof event.type === 'string' ? event.type : ''
    if (type === 'response.output_text.delta' && typeof event.delta === 'string') {
      content += event.delta
      onDelta(event.delta)
    }
    if (type === 'response.reasoning_summary_text.delta' && typeof event.delta === 'string') summary += event.delta
    if (type === 'response.output_item.done' && event.item !== undefined) outputItems.push(event.item)
    if (type === 'response.completed' && isRecord(event.response)) {
      responseId = typeof event.response.id === 'string' ? event.response.id : responseId
      if (isRecord(event.response.usage)) usage = responsesUsage(event.response.usage)
      if (!outputItems.length && Array.isArray(event.response.output)) outputItems.push(...event.response.output)
    }
  })
  if (!content) content = outputItems.flatMap(responseOutputText).join('')
  if (!content) throw new Error(t("The provider completed the response without returning text"))
  const parts: ModelResponsePart[] = [
    ...(summary ? [{ type: 'reasoning_summary' as const, text: summary }] : []),
    { type: 'output_text', text: content }
  ]
  if (structured) return { content, providerId: request.providerId, model: request.model }
  return { content, parts, providerState: { format: 'openai-responses', data: outputItems }, providerId: request.providerId, model: request.model, externalSessionId: responseId, usage }
}

function responsesInput(messages: ModelMessage[]) {
  return messages.flatMap((message) => {
    if (message.role === 'assistant' && message.providerState?.format === 'openai-responses' && Array.isArray(message.providerState.data) && message.providerState.data.length) return message.providerState.data
    return [{ role: message.role, content: typeof message.content === 'string' ? message.content : message.content.map((part) => part.type === 'text'
      ? { type: 'input_text', text: part.text }
      : { type: 'input_image', image_url: `data:${part.mimeType};base64,${part.dataBase64}` }) }]
  })
}

export async function listProviderModels(
  provider: ResolvedProvider,
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch
) {
  if (provider.requireApiKey && !provider.apiKey) throw new Error(t("No API key configured for {0}", [provider.name]))
  const headers = authorizationHeaders(provider)
  let url: string
  if (provider.protocol === 'gemini') url = joinUrl(provider.baseUrl, 'models')
  else url = joinUrl(provider.baseUrl, 'models')
  const response = await fetchImpl(url, { headers, signal })
  if (!response.ok) throw await providerError(response, provider.name)
  const body = await response.json() as Record<string, unknown>
  const metadata: Record<string, ModelParameterMetadata> = {}
  if (provider.protocol === 'gemini') {
    const models = Array.isArray(body.models) ? body.models : []
    const ids = models.flatMap((candidate) => {
      if (!isRecord(candidate) || typeof candidate.name !== 'string') return []
      const methods = Array.isArray(candidate.supportedGenerationMethods)
        ? candidate.supportedGenerationMethods
        : []
      if (methods.length && !methods.includes('generateContent')) return []
      const id = candidate.name.replace(/^models\//, '')
      const limit = positiveInteger(candidate.outputTokenLimit)
      metadata[id] = { maxOutputTokens: limit, defaultMaxTokens: limit }
      return [id]
    })
    return { models: ids, metadata }
  }
  const data = Array.isArray(body.data) ? body.data : []
  const models = data.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string') return []
    if (provider.id === 'openrouter') {
      const supportedParameters = stringArray(candidate.supported_parameters)
      const reasoning = isRecord(candidate.reasoning) ? candidate.reasoning : undefined
      metadata[candidate.id] = {
        maxOutputTokens: positiveInteger(isRecord(candidate.top_provider) ? candidate.top_provider.max_completion_tokens : undefined),
        defaultMaxTokens: positiveInteger(isRecord(candidate.default_parameters) ? candidate.default_parameters.max_tokens : undefined),
        supportedParameters,
        inputModalities: isRecord(candidate.architecture) ? stringArray(candidate.architecture.input_modalities) : undefined,
        reasoning: reasoning ? {
          supportedEfforts: reasoning.supported_efforts === null ? null : stringArray(reasoning.supported_efforts),
          defaultEffort: typeof reasoning.default_effort === 'string' ? reasoning.default_effort : undefined,
          defaultEnabled: typeof reasoning.default_enabled === 'boolean' ? reasoning.default_enabled : undefined,
          mandatory: reasoning.mandatory === true,
          supportsBudget: reasoning.supports_max_tokens === true
        } : supportedParameters?.some((parameter) => parameter.startsWith('reasoning')) ? undefined : null
      }
    }
    return [candidate.id]
  })
  return { models, metadata }
}

export async function testProviderConnection(
  provider: ResolvedProvider,
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch
) {
  if (provider.requireApiKey && !provider.apiKey) throw new Error(t("No API key configured for {0}", [provider.name]))
  if (provider.id === 'openrouter') {
    const response = await fetchImpl(joinUrl(provider.baseUrl, 'key'), {
      headers: authorizationHeaders(provider),
      signal
    })
    if (!response.ok) throw await providerError(response, provider.name)
  }
  return listProviderModels(provider, signal, fetchImpl)
}

async function invokeOpenAiCompatible(
  provider: ResolvedProvider,
  request: ModelInvocationRequest,
  onDelta: (delta: string) => void,
  signal: AbortSignal | undefined,
  fetchImpl: FetchLike
): Promise<ModelInvocationResult> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: typeof message.content === 'string' ? message.content : message.content.map((part) => part.type === 'text'
        ? { type: 'text', text: part.text }
        : { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.dataBase64}` } }),
      ...(message.role === 'assistant' && message.providerState?.format === 'openai-reasoning-details' && Array.isArray(message.providerState.data)
        ? { reasoning_details: message.providerState.data }
        : {})
    })),
    stream: true
  }
  const structured = request.responseMode === 'structured'
  if (structured) body.response_format = { type: 'json_object' }
  else body.stream_options = { include_usage: true }
  const parameters = request.parameters
  if (parameters?.temperature !== undefined) body.temperature = parameters.temperature
  if (parameters?.topP !== undefined) body.top_p = parameters.topP
  const profile = modelParameterProfile(request.providerId, request.model)
  if (parameters?.maxTokens != null) body[profile.maxTokensField] = parameters.maxTokens
  if (parameters?.presencePenalty !== undefined) body.presence_penalty = parameters.presencePenalty
  if (parameters?.frequencyPenalty !== undefined) body.frequency_penalty = parameters.frequencyPenalty
  if (parameters?.seed !== undefined) body.seed = parameters.seed
  if (parameters?.stopSequences?.length) body.stop = parameters.stopSequences
  if (parameters?.verbosity) body.verbosity = parameters.verbosity
  if (request.providerId === 'openrouter') {
    if (parameters?.reasoningLevel) body.reasoning = profile.reasoning?.kind === 'toggle' ? { enabled: parameters.reasoningLevel === 'enabled' } : { effort: parameters.reasoningLevel }
    if (parameters?.reasoningBudget !== undefined) body.reasoning = parameters.reasoningBudget === 0 ? { enabled: false } : parameters.reasoningBudget === -1 ? { enabled: true } : { max_tokens: parameters.reasoningBudget }
    if (structured && isRecord(body.reasoning)) body.reasoning.exclude = true
    if (parameters?.topK !== undefined) body.top_k = parameters.topK
  } else if (parameters?.reasoningLevel) {
    if (profile.reasoning?.wire === 'thinking') {
      body.thinking = { type: parameters.reasoningLevel === 'none' ? 'disabled' : 'enabled' }
      if (!['none', 'enabled'].includes(parameters.reasoningLevel)) body.reasoning_effort = parameters.reasoningLevel
    } else body.reasoning_effort = parameters.reasoningLevel
  }
  mergeCustomParameters(body, parameters?.customParameters)

  const response = await fetchImpl(joinUrl(provider.baseUrl, 'chat/completions'), {
    method: 'POST',
    headers: authorizationHeaders(provider),
    body: JSON.stringify(body),
    signal
  })
  if (!response.ok) throw await providerError(response, provider.name)
  let usage: ModelUsage | undefined
  const reasoningDetails: unknown[] = []
  let reasoning = ''
  const content = await readSse(response, (event) => {
    const choice = arrayFirst(event.choices)
    const delta = isRecord(choice?.delta) ? choice.delta : undefined
    const text = textContent(delta?.content)
    if (Array.isArray(delta?.reasoning_details)) reasoningDetails.push(...delta.reasoning_details)
    const reasoningDelta = typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : typeof delta?.reasoning === 'string' ? delta.reasoning : ''
    reasoning += reasoningDelta
    if (isRecord(event.usage)) usage = openAiUsage(event.usage)
    return text
  }, onDelta)
  const parts: ModelResponsePart[] = [...(reasoning ? [{ type: 'reasoning' as const, text: reasoning }] : []), { type: 'output_text', text: content }]
  const providerState: ModelProviderState | undefined = reasoningDetails.length ? { format: 'openai-reasoning-details', data: reasoningDetails } : undefined
  if (structured) return { content, providerId: request.providerId, model: request.model }
  return { content, parts, providerState, providerId: request.providerId, model: request.model, usage }
}

async function invokeAnthropic(
  provider: ResolvedProvider,
  request: ModelInvocationRequest,
  onDelta: (delta: string) => void,
  signal: AbortSignal | undefined,
  fetchImpl: FetchLike
): Promise<ModelInvocationResult> {
  const system = request.messages.filter((message) => message.role === 'system').map((message) => messageText(message)).join('\n\n')
  const messages = coalesceMessages(request.messages.filter((message) => message.role !== 'system')).map((message) => ({
    role: message.role,
    content: message.role === 'assistant' && message.providerState?.format === 'anthropic-content'
      ? message.providerState.data
      : typeof message.content === 'string' ? message.content : message.content.map((part) => part.type === 'text'
      ? { type: 'text', text: part.text }
      : { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.dataBase64 } })
  }))
  if (!request.parameters?.maxTokens || request.parameters.maxTokens < 1) throw new Error(t("This Messages endpoint requires a positive integer output limit"))
  const body: Record<string, unknown> = {
    model: request.model,
    messages,
    stream: true,
    max_tokens: request.parameters.maxTokens
  }
  if (system) body.system = system
  if (request.parameters?.temperature !== undefined) body.temperature = request.parameters.temperature
  if (request.parameters?.topP !== undefined) body.top_p = request.parameters.topP
  if (request.parameters?.topK !== undefined) body.top_k = request.parameters.topK
  if (request.parameters?.stopSequences?.length) body.stop_sequences = request.parameters.stopSequences
  if (request.parameters?.reasoningLevel && request.parameters.reasoningLevel !== 'none') {
    body.thinking = { type: 'adaptive' }
    body.output_config = { effort: request.parameters.reasoningLevel }
  }
  if (request.parameters?.reasoningBudget !== undefined) body.thinking = request.parameters.reasoningBudget > 0
    ? { type: 'enabled', budget_tokens: request.parameters.reasoningBudget }
    : { type: 'disabled' }
  mergeCustomParameters(body, request.parameters?.customParameters)
  const response = await fetchImpl(joinUrl(provider.baseUrl, 'messages'), {
    method: 'POST',
    headers: authorizationHeaders(provider),
    body: JSON.stringify(body),
    signal
  })
  if (!response.ok) throw await providerError(response, provider.name)
  let usage: ModelUsage | undefined
  const blocks = new Map<number, Record<string, unknown>>()
  let reasoning = ''
  const content = await readSse(response, (event) => {
    const delta = isRecord(event.delta) ? event.delta : undefined
    const message = isRecord(event.message) ? event.message : undefined
    if (isRecord(message?.usage)) usage = anthropicUsage(message.usage)
    if (isRecord(event.usage)) usage = { ...usage, ...anthropicUsage(event.usage) }
    const index = typeof event.index === 'number' ? event.index : 0
    if (event.type === 'content_block_start' && isRecord(event.content_block)) blocks.set(index, { ...event.content_block })
    const block = blocks.get(index)
    if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') {
      reasoning += delta.thinking
      if (block) block.thinking = `${typeof block.thinking === 'string' ? block.thinking : ''}${delta.thinking}`
    }
    if (delta?.type === 'signature_delta' && typeof delta.signature === 'string' && block) block.signature = `${typeof block.signature === 'string' ? block.signature : ''}${delta.signature}`
    if (delta?.type === 'text_delta' && typeof delta.text === 'string' && block) block.text = `${typeof block.text === 'string' ? block.text : ''}${delta.text}`
    return delta?.type === 'text_delta' && typeof delta.text === 'string' ? delta.text : ''
  }, onDelta)
  if (request.responseMode === 'structured') return { content, providerId: request.providerId, model: request.model }
  return { content, parts: [...(reasoning ? [{ type: 'reasoning' as const, text: reasoning }] : []), { type: 'output_text', text: content }], providerState: blocks.size ? { format: 'anthropic-content', data: [...blocks.entries()].sort(([a], [b]) => a - b).map(([, block]) => block) } : undefined, providerId: request.providerId, model: request.model, usage }
}

async function invokeGemini(
  provider: ResolvedProvider,
  request: ModelInvocationRequest,
  onDelta: (delta: string) => void,
  signal: AbortSignal | undefined,
  fetchImpl: FetchLike
): Promise<ModelInvocationResult> {
  const system = request.messages.filter((message) => message.role === 'system').map((message) => messageText(message)).join('\n\n')
  const contents = coalesceMessages(request.messages.filter((message) => message.role !== 'system')).map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: message.role === 'assistant' && message.providerState?.format === 'gemini-parts' && Array.isArray(message.providerState.data)
      ? message.providerState.data
      : typeof message.content === 'string' ? [{ text: message.content }] : message.content.map((part) => part.type === 'text'
      ? { text: part.text }
      : { inlineData: { mimeType: part.mimeType, data: part.dataBase64 } })
  }))
  const generationConfig: Record<string, unknown> = {}
  const structured = request.responseMode === 'structured'
  if (request.parameters?.temperature !== undefined) generationConfig.temperature = request.parameters.temperature
  if (request.parameters?.topP !== undefined) generationConfig.topP = request.parameters.topP
  if (request.parameters?.maxTokens != null) generationConfig.maxOutputTokens = request.parameters.maxTokens
  if (request.parameters?.topK !== undefined) generationConfig.topK = request.parameters.topK
  if (request.parameters?.seed !== undefined) generationConfig.seed = request.parameters.seed
  if (request.parameters?.stopSequences?.length) generationConfig.stopSequences = request.parameters.stopSequences
  if (request.parameters?.reasoningLevel && request.parameters.reasoningLevel !== 'none') {
    generationConfig.thinkingConfig = { thinkingLevel: request.parameters.reasoningLevel.toUpperCase(), includeThoughts: !structured }
  }
  if (request.parameters?.reasoningBudget !== undefined) generationConfig.thinkingConfig = { thinkingBudget: request.parameters.reasoningBudget, includeThoughts: !structured }
  if (!generationConfig.thinkingConfig && !structured) generationConfig.thinkingConfig = { includeThoughts: true }
  if (structured) generationConfig.responseMimeType = 'application/json'
  const body: Record<string, unknown> = { contents, generationConfig }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  mergeCustomParameters(body, request.parameters?.customParameters)
  const url = `${joinUrl(provider.baseUrl, `models/${encodeURIComponent(request.model)}:streamGenerateContent`)}?alt=sse`
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: authorizationHeaders(provider),
    body: JSON.stringify(body),
    signal
  })
  if (!response.ok) throw await providerError(response, provider.name)
  let usage: ModelUsage | undefined
  let reasoning = ''
  const rawParts: unknown[] = []
  const content = await readSse(response, (event) => {
    if (isRecord(event.usageMetadata)) {
      usage = {
        inputTokens: numberValue(event.usageMetadata.promptTokenCount),
        outputTokens: numberValue(event.usageMetadata.candidatesTokenCount)
      }
    }
    const candidate = arrayFirst(event.candidates)
    const content = isRecord(candidate?.content) ? candidate.content : undefined
    const parts = Array.isArray(content?.parts) ? content.parts : []
    rawParts.push(...parts)
    reasoning += parts.map((part) => isRecord(part) && part.thought && typeof part.text === 'string' ? part.text : '').join('')
    return parts.map((part) => isRecord(part) && !part.thought && typeof part.text === 'string' ? part.text : '').join('')
  }, onDelta)
  if (structured) return { content, providerId: request.providerId, model: request.model }
  return { content, parts: [...(reasoning ? [{ type: 'reasoning_summary' as const, text: reasoning }] : []), { type: 'output_text', text: content }], providerState: rawParts.length ? { format: 'gemini-parts', data: rawParts } : undefined, providerId: request.providerId, model: request.model, usage }
}

function checkStreamEvent(event: Record<string, unknown>) {
  const response = isRecord(event.response) ? event.response : undefined
  const error = event.error ?? response?.error
  if (error || event.type === 'error' || event.type === 'response.failed' || response?.status === 'failed') {
    const detail = typeof error === 'string' ? error : isRecord(error) && typeof error.message === 'string' ? error.message : typeof event.message === 'string' ? event.message : t('No error details')
    throw new Error(t('The provider reported an error: {0}', [detail]))
  }
  const choice = arrayFirst(event.choices)
  const candidate = arrayFirst(event.candidates)
  const delta = isRecord(event.delta) ? event.delta : undefined
  const feedback = isRecord(event.promptFeedback) ? event.promptFeedback : undefined
  const incomplete = event.type === 'response.incomplete' || response?.status === 'incomplete'
  const stop = choice?.finish_reason ?? delta?.stop_reason ?? candidate?.finishReason ?? feedback?.blockReason
  if (incomplete || typeof stop === 'string' && !['stop', 'end_turn', 'stop_sequence', 'tool_calls', 'function_call', 'tool_use', 'STOP'].includes(stop)) {
    const details = isRecord(response?.incomplete_details) ? response.incomplete_details.reason : undefined
    throw new Error(t('The provider stopped before completing the response: {0}', [details ?? stop ?? 'incomplete']))
  }
}

async function readSseEvents(response: Response, onEvent: (event: Record<string, unknown>) => void) {
  if (!response.body) throw new Error(t('The provider returned an empty streaming response'))
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const consume = (source: string) => {
    const data = source.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim()
    if (!data || data === '[DONE]') return
    let event: unknown
    try { event = JSON.parse(data) } catch { throw new Error(t('The provider returned malformed streaming data')) }
    if (!isRecord(event)) throw new Error(t('The provider returned malformed streaming data'))
    checkStreamEvent(event)
    onEvent(event)
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() ?? ''
      frames.forEach(consume)
      if (done) break
    }
    if (buffer.trim()) consume(buffer)
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function readSse(response: Response, extract: (event: Record<string, unknown>) => string, onDelta: (delta: string) => void) {
  let content = ''
  await readSseEvents(response, event => {
    const delta = extract(event)
    if (delta) { content += delta; onDelta(delta) }
  })
  if (!content.trim()) throw new Error(t('The provider completed the response without returning text'))
  return content
}

function authorizationHeaders(provider: ResolvedProvider) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.protocol === 'anthropic') {
    headers['x-api-key'] = provider.apiKey
    headers['anthropic-version'] = '2023-06-01'
    if (provider.anthropicWorkspaceId?.trim()) headers['anthropic-workspace-id'] = provider.anthropicWorkspaceId.trim()
  } else if (provider.protocol === 'gemini') {
    headers['x-goog-api-key'] = provider.apiKey
  } else if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`
  }
  if (provider.id === 'openrouter') {
    headers['HTTP-Referer'] = 'https://agentflow.local'
    headers['X-Title'] = 'AgentFlow'
  }
  return headers
}

function coalesceMessages(messages: ModelMessage[]) {
  const result: { role: 'user' | 'assistant'; content: ModelMessage['content']; providerState?: ModelProviderState }[] = []
  for (const message of messages) {
    const role = message.role === 'assistant' ? 'assistant' : 'user'
    const previous = result.at(-1)
    if (previous?.role === role) {
      const left = typeof previous.content === 'string' ? [{ type: 'text' as const, text: previous.content }] : previous.content
      const right = typeof message.content === 'string' ? [{ type: 'text' as const, text: message.content }] : message.content
      previous.content = [...left, { type: 'text', text: '\n\n' }, ...right]
      previous.providerState = undefined
    }
    else result.push({ role, content: message.content, providerState: message.providerState })
  }
  if (result[0]?.role === 'assistant') result.unshift({ role: 'user', content: 'Continue the conversation.' })
  return result
}

function messageText(message: ModelMessage) {
  return typeof message.content === 'string'
    ? message.content
    : message.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n')
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function providerError(response: Response, providerName: string) {
  const requestId = response.headers.get('x-request-id') ?? response.headers.get('request-id')
  let detail = response.statusText
  try {
    const raw = await response.text()
    if (raw.trim()) {
      try {
        const body = JSON.parse(raw) as Record<string, unknown>
        const error = isRecord(body.error) ? body.error : undefined
        const candidate = error?.message ?? error?.detail ?? (typeof body.error === 'string' ? body.error : undefined) ?? body.message ?? body.detail
        detail = typeof candidate === 'string' ? candidate : raw
      } catch { detail = raw }
    }
  } catch { /* keep status text */ }
  detail = detail.replace(/\s+/g, ' ').trim().slice(0, 1200)
  if (detail.includes('anthropic-workspace-id') && detail.includes('is required')) {
    detail = t("This API key requires a workspace. Enter the ID (wrkspc_…) from Claude Console → Settings → Workspaces in this provider’s “Anthropic workspace ID”, then test the connection again.")
  }
  return new Error(t("{0} request failed ({1}): {2}{3}", [providerName, response.status, detail, requestId ? ` · ${requestId}` : '']))
}

function textContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map((part) => isRecord(part) && typeof part.text === 'string' ? part.text : '').join('')
}

function openAiUsage(value: Record<string, unknown>): ModelUsage {
  return { inputTokens: numberValue(value.prompt_tokens), outputTokens: numberValue(value.completion_tokens) }
}

function responsesUsage(value: Record<string, unknown>): ModelUsage {
  return { inputTokens: numberValue(value.input_tokens), outputTokens: numberValue(value.output_tokens) }
}

function responseOutputText(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.content)) return []
  return value.content.flatMap((part) => isRecord(part) && part.type === 'output_text' && typeof part.text === 'string' ? [part.text] : [])
}

function anthropicUsage(value: Record<string, unknown>): ModelUsage {
  return { inputTokens: numberValue(value.input_tokens), outputTokens: numberValue(value.output_tokens) }
}

function arrayFirst(value: unknown) {
  return Array.isArray(value) && isRecord(value[0]) ? value[0] : undefined
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function mergeCustomParameters(target: Record<string, unknown>, custom: Record<string, unknown> | undefined) {
  if (!custom) return
  for (const [key, value] of Object.entries(custom)) {
    if (value === undefined || key === '__proto__' || key === 'prototype' || key === 'constructor') continue
    if (isRecord(value) && !Array.isArray(value) && isRecord(target[key]) && !Array.isArray(target[key])) {
      mergeCustomParameters(target[key] as Record<string, unknown>, value)
    } else target[key] = value
  }
}
