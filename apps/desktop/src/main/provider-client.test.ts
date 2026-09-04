import { describe, expect, it } from 'vitest'
import { invokeProvider, listProviderModels, testProviderConnection, type ResolvedProvider } from './provider-client'
import { MODEL_PARAMETER_PROFILES, modelParameterProfile } from '@agentflow/core'

const sse = (events: unknown[]) => new Response(
  `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`,
  { status: 200, headers: { 'content-type': 'text/event-stream' } }
)

describe('provider client', () => {
  it.each([
    [{ choices: [{ delta: { content: '  \n' } }] }],
    [{ choices: [{ delta: { content: 'partial' } }] }, { error: { message: 'Quota exceeded' } }],
    [{ choices: [{ delta: { content: 'partial' } }] }, { choices: [{ finish_reason: 'length' }] }],
    [{ type: 'response.failed', response: { error: { message: 'Server failed' } } }],
    [{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]
  ])('rejects empty, failed and truncated streaming responses: %j', async (...events) => {
    await expect(invokeProvider({ id: 'test', name: 'Test', protocol: 'openai-compatible', baseUrl: 'https://example.test', requireApiKey: false, apiKey: '' }, { providerId: 'test', model: 'test', messages: [] }, () => {}, undefined, async () => sse(events))).rejects.toThrow()
  })
  it('propagates errors in the last unterminated SSE frame and malformed frames', async () => {
    for (const tail of ['{"error":{"message":"Stream failed"}}', '{broken-json']) {
      const body = 'data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: ' + tail
      await expect(invokeProvider({ id: 'test', name: 'Test', protocol: 'openai-compatible', baseUrl: 'https://example.test', requireApiKey: false, apiKey: '' }, { providerId: 'test', model: 'test', messages: [] }, () => {}, undefined, async () => new Response(body))).rejects.toThrow()
    }
  })
  it('sends an Anthropic workspace header for model discovery, connection tests and messages', async () => {
    const provider: ResolvedProvider = { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://example.test/v1', apiKey: 'test-only-key', requireApiKey: true, anthropicWorkspaceId: 'wrkspc_test123' }
    const calls: string[] = []
    const fetcher: typeof fetch = async (url, init) => {
      calls.push(String(url))
      const headers = new Headers(init?.headers)
      expect(headers.get('anthropic-workspace-id')).toBe('wrkspc_test123')
      expect(headers.get('x-api-key')).toBe('test-only-key')
      expect(headers.get('anthropic-version')).toBe('2023-06-01')
      return String(url).endsWith('/models') ? new Response(JSON.stringify({ data: [{ id: 'claude-sonnet-5' }] })) : sse([{ delta: { type: 'text_delta', text: 'ok' } }])
    }
    await listProviderModels(provider, undefined, fetcher)
    await testProviderConnection(provider, undefined, fetcher)
    await invokeProvider(provider, { providerId: 'anthropic', model: 'claude-sonnet-5', messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, fetcher)
    expect(calls).toEqual(['https://example.test/v1/models', 'https://example.test/v1/models', 'https://example.test/v1/messages'])
  })

  it('omits workspace headers for single-workspace keys and other protocols', async () => {
    for (const protocol of ['anthropic', 'openai-compatible', 'gemini'] as const) {
      await testProviderConnection({ id: 'test', name: 'Test', protocol, baseUrl: 'https://example.test', apiKey: 'test-only', requireApiKey: true, anthropicWorkspaceId: protocol === 'anthropic' ? '' : 'wrkspc_other' }, undefined, async (_url, init) => {
        expect(new Headers(init?.headers).has('anthropic-workspace-id')).toBe(false)
        return new Response(JSON.stringify({ data: [], models: [] }))
      })
    }
  })

  it('explains how to recover from a missing Anthropic workspace without hiding the request ID', async () => {
    const error = await testProviderConnection({ id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://example.test', apiKey: 'test-only', requireApiKey: true }, undefined, async () => new Response(JSON.stringify({ error: { message: 'anthropic-workspace-id is required when authenticating with an identity-linked API key; send the id of the workspace this request acts in.' } }), { status: 400, headers: { 'request-id': 'req_workspace' } })).catch(error => error)
    expect(error.message).toContain('Anthropic 工作区 ID')
    expect(error.message).toContain('设置 → 工作区')
    expect(error.message).toContain('req_workspace')
    expect(error.message).not.toContain('identity-linked')
  })

  for (const { provider: id, models, profile } of MODEL_PARAMETER_PROFILES) {
    if (profile.reasoning?.kind !== 'effort') continue
    it.each(models)(`serializes every documented ${id} effort level for %s`, async (model) => {
      const protocol = id === 'anthropic' ? 'anthropic' : id === 'google' ? 'gemini' : 'openai-compatible'
      for (const level of profile.reasoning!.levels!) {
        let body: Record<string, any> = {}
        await invokeProvider({ id, name: id, protocol, baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }, { providerId: id, model, parameters: { reasoningLevel: level }, messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async (_url, init) => {
          body = JSON.parse(String(init?.body))
          return sse([protocol === 'anthropic' ? { delta: { type: 'text_delta', text: 'ok' } } : protocol === 'gemini' ? { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } : id === 'openai' ? { type: 'response.output_text.delta', delta: 'ok' } : { choices: [{ delta: { content: 'ok' } }] }])
        })
        if (id === 'anthropic') { expect(body.output_config).toEqual({ effort: level }); expect(body.thinking).toEqual({ type: 'adaptive' }) }
        else if (id === 'google') expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: level.toUpperCase(), includeThoughts: true })
        else if (id === 'openai') expect(body.reasoning).toEqual({ effort: level, summary: 'auto' })
        else if (['deepseek', 'zai'].includes(id)) {
          expect(body.thinking).toEqual({ type: level === 'none' ? 'disabled' : 'enabled' })
          expect(body.reasoning_effort).toBe(level === 'none' ? undefined : level)
        } else expect(body.reasoning_effort).toBe(level)
      }
    })
  }

  it.each([
    ['openai/gpt-5.6-sol', ['max', 'xhigh', 'high', 'medium', 'low', 'none'], 'medium'],
    ['anthropic/claude-sonnet-5', ['max', 'xhigh', 'high', 'medium', 'low'], 'high'],
    ['google/gemini-3.7-flash', ['high', 'medium', 'low'], 'medium'],
    ['deepseek/deepseek-v4-flash-0731', ['max', 'high', 'low'], 'high'],
    ['z-ai/glm-5.3', ['max', 'high', 'low'], 'max'],
    ['moonshotai/kimi-k3', ['max', 'high', 'low'], 'max']
  ] as const)('round-trips discovered reasoning for OpenRouter %s and its variants', async (model, levels, defaultEffort) => {
    const ids = [model, `${model}:batch`, `~${model}-latest`]
    const provider: ResolvedProvider = { id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }
    const catalog = await listProviderModels(provider, undefined, async () => new Response(JSON.stringify({ data: ids.map((id) => ({ id, supported_parameters: ['reasoning', 'max_tokens'], reasoning: { supported_efforts: levels, default_effort: defaultEffort } })) })))
    for (const id of ids) for (const level of levels) {
      let body: Record<string, unknown> = {}
      await invokeProvider({ ...provider, modelMetadata: catalog.metadata }, { providerId: provider.id, model: id, parameters: { reasoningLevel: level }, messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async (_url, init) => { body = JSON.parse(String(init?.body)); return sse([{ choices: [{ delta: { content: 'ok' } }] }]) })
      expect(body.reasoning).toEqual({ effort: level })
      expect(body.reasoning_effort).toBeUndefined()
      expect(body.thinking).toBeUndefined()
      expect(body.generationConfig).toBeUndefined()
      expect(modelParameterProfile('openrouter', id).reasoning?.default).toBe(defaultEffort)
    }
  })

  it('preserves discovered on/off controls and mandatory reasoning', async () => {
    const provider: ResolvedProvider = { id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }
    const catalog = await listProviderModels(provider, undefined, async () => new Response(JSON.stringify({ data: [
      { id: 'z-ai/glm-5.1', reasoning: { mandatory: false, default_enabled: true } },
      { id: 'deepseek/deepseek-r1', reasoning: { mandatory: true } }
    ] })))
    let body: Record<string, unknown> = {}
    await invokeProvider({ ...provider, modelMetadata: catalog.metadata }, { providerId: provider.id, model: 'z-ai/glm-5.1', parameters: { reasoningLevel: 'none' }, messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async (_url, init) => { body = JSON.parse(String(init?.body)); return sse([{ choices: [{ delta: { content: 'ok' } }] }]) })
    expect(body.reasoning).toEqual({ enabled: false })
    expect(modelParameterProfile('openrouter', 'deepseek/deepseek-r1').reasoning?.kind).toBe('always-on')
  })
  it.each([
    ['deepseek', 'deepseek-v4-flash', { reasoningLevel: 'none' }, { thinking: { type: 'disabled' } }],
    ['zai', 'glm-5.3', { reasoningLevel: 'max' }, { reasoning_effort: 'max', thinking: { type: 'enabled' }, top_p: .95 }],
    ['kimi', 'kimi-k3', {}, { reasoning_effort: 'max', max_completion_tokens: 131072 }],
    ['openrouter', 'deepseek/deepseek-v4-flash-0731', { reasoningLevel: 'high' }, { reasoning: { effort: 'high' } }],
    ['openrouter', 'google/gemini-2.5-pro', { reasoningBudget: 2048 }, { reasoning: { max_tokens: 2048 } }]
  ])('serializes %s / %s using its documented wire format', async (id, model, parameters, expected) => {
    let body: Record<string, unknown> = {}
    await invokeProvider({ id, name: id, protocol: 'openai-compatible', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }, { providerId: id, model, parameters, messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async (_url, init) => {
      body = JSON.parse(String(init?.body))
      return sse([{ choices: [{ delta: { content: 'ok' } }] }])
    })
    expect(body).toMatchObject(expected)
    if (id === 'kimi') { expect(body.temperature).toBeUndefined(); expect(body.top_p).toBeUndefined(); expect(body.thinking).toBeUndefined() }
    if (id === 'openrouter') { expect(body.thinking).toBeUndefined(); expect(body.reasoning_effort).toBeUndefined() }
  })
  it('omits max tokens for -1 and rejects invalid values before HTTP', async () => {
    const provider: ResolvedProvider = { id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }
    let calls = 0
    let body: Record<string, unknown> = {}
    const fetchMock: typeof fetch = async (_url, init) => { calls++; body = JSON.parse(String(init?.body)); return sse([{ choices: [{ delta: { content: 'ok' } }] }]) }
    const request = { providerId: 'openrouter', model: 'openai/gpt-5.6-sol', messages: [{ role: 'user' as const, content: 'test' }] }
    await invokeProvider(provider, { ...request, parameters: { maxTokens: -1 } }, () => {}, undefined, fetchMock)
    expect(body.max_tokens).toBeUndefined()
    await expect(invokeProvider(provider, { ...request, parameters: { maxTokens: -2 } }, () => {}, undefined, fetchMock)).rejects.toThrow('输出上限（词元）')
    expect(calls).toBe(1)
  })
  it('surfaces provider error details and request IDs', async () => {
    await expect(invokeProvider(
      { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false },
      { providerId: 'openai', model: 'gpt-5.6-sol', messages: [{ role: 'user', content: 'test' }] },
      () => {},
      undefined,
      async () => new Response(JSON.stringify({ error: { message: 'Unsupported parameter: reasoning_effort' } }), { status: 400, headers: { 'x-request-id': 'req_123' } })
    )).rejects.toThrow('OpenAI 请求失败 (400)：Unsupported parameter: reasoning_effort · req_123')
  })
  it('accepts provider-native custom parameters for an unmaintained Claude model', async () => {
    let body: Record<string, unknown> = {}
    await invokeProvider({ id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }, { providerId: 'anthropic', model: 'claude-haiku-4-5', messages: [{ role: 'user', content: 'test' }], parameters: { maxTokens: 64000, customParameters: { thinking: { type: 'enabled', budget_tokens: 4096 } } } }, () => {}, undefined, async (_url, init) => {
      body = JSON.parse(String(init?.body)); return sse([{ delta: { type: 'text_delta', text: 'ok' } }])
    })
    expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 4096 })
    expect(body.max_tokens).toBe(64000)
  })
  it('applies custom parameters after maintained defaults', async () => {
    let body: Record<string, unknown> = {}
    await invokeProvider({ id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }, { providerId: 'anthropic', model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'test' }], parameters: { maxTokens: 4096, reasoningLevel: 'high', customParameters: { max_tokens: 8192, output_config: { effort: 'low' } } } }, () => {}, undefined, async (_url, init) => {
      body = JSON.parse(String(init?.body)); return sse([{ delta: { type: 'text_delta', text: 'ok' } }])
    })
    expect(body.max_tokens).toBe(8192)
    expect(body.thinking).toEqual({ type: 'adaptive' })
    expect(body.output_config).toEqual({ effort: 'low' })
  })
  it('sends Gemini dynamic budget and excludes thought text from output', async () => {
    let body: Record<string, unknown> = {}
    const result = await invokeProvider({ id: 'google', name: 'Gemini', protocol: 'gemini', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }, { providerId: 'google', model: 'gemini-2.5-pro', messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async (_url, init) => {
      body = JSON.parse(String(init?.body)); return sse([{ candidates: [{ content: { parts: [{ thought: true, text: 'summary' }, { text: 'answer' }] } }] }])
    })
    expect(body.generationConfig).toMatchObject({ thinkingConfig: { thinkingBudget: -1 }, maxOutputTokens: 65536 })
    expect(result.content).toBe('answer')
    expect(result.parts).toEqual([{ type: 'reasoning_summary', text: 'summary' }, { type: 'output_text', text: 'answer' }])
    expect(result.providerState?.format).toBe('gemini-parts')
  })

  it('parses OpenAI reasoning summaries while keeping encrypted reasoning in provider state', async () => {
    const result = await invokeProvider({ id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', apiKey: '', requireApiKey: false }, { providerId: 'openai', model: 'gpt-5.6-sol', messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async () => sse([
      { type: 'response.reasoning_summary_text.delta', delta: 'short summary' },
      { type: 'response.output_text.delta', delta: 'answer' },
      { type: 'response.output_item.done', item: { type: 'reasoning', encrypted_content: 'opaque' } },
      { type: 'response.completed', response: { id: 'resp_state', output: [] } }
    ]))
    expect(result.parts).toEqual([{ type: 'reasoning_summary', text: 'short summary' }, { type: 'output_text', text: 'answer' }])
    expect(result.providerState).toEqual({ format: 'openai-responses', data: [{ type: 'reasoning', encrypted_content: 'opaque' }] })
    expect(result.content).not.toContain('opaque')
  })

  it('keeps medium reasoning but omits returned thinking state for structured helpers', async () => {
    let openAiBody: Record<string, any> = {}
    const openAi = await invokeProvider({ id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', apiKey: '', requireApiKey: false }, {
      providerId: 'openai', model: 'gpt-5.6-sol', responseMode: 'structured', parameters: { reasoningLevel: 'medium' }, messages: [{ role: 'user', content: 'Return JSON' }]
    }, () => {}, undefined, async (_url, init) => {
      openAiBody = JSON.parse(String(init?.body)); return sse([{ type: 'response.output_text.delta', delta: '{"ok":true}' }, { type: 'response.completed', response: { id: 'unused', output: [] } }])
    })
    expect(openAiBody.include).toBeUndefined()
    expect(openAiBody.reasoning).toEqual({ effort: 'medium' })
    expect(openAiBody.text).toMatchObject({ format: { type: 'json_object' } })
    expect(openAi.content).toBe('{"ok":true}')
    expect(openAi.parts).toBeUndefined()
    expect(openAi.providerState).toBeUndefined()
    expect(openAi.externalSessionId).toBeUndefined()

    let openRouterBody: Record<string, any> = {}
    const openRouter = await invokeProvider({ id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false, modelMetadata: { 'helper/model': { reasoning: { supportedEfforts: ['medium'] } } } }, {
      providerId: 'openrouter', model: 'helper/model', responseMode: 'structured', parameters: { reasoningLevel: 'medium' }, messages: [{ role: 'user', content: 'Return JSON' }]
    }, () => {}, undefined, async (_url, init) => {
      openRouterBody = JSON.parse(String(init?.body)); return sse([{ choices: [{ delta: { reasoning: 'hidden', reasoning_details: [{ id: 'unused' }], content: '{"ok":true}' } }] }])
    })
    expect(openRouterBody.response_format).toEqual({ type: 'json_object' })
    expect(openRouterBody.stream_options).toBeUndefined()
    expect(openRouterBody.reasoning).toEqual({ effort: 'medium', exclude: true })
    expect(openRouter.parts).toBeUndefined()
    expect(openRouter.providerState).toBeUndefined()

    let geminiBody: Record<string, any> = {}
    const gemini = await invokeProvider({ id: 'google', name: 'Gemini', protocol: 'gemini', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }, {
      providerId: 'google', model: 'gemini-3.7-flash', responseMode: 'structured', parameters: { reasoningLevel: 'medium' }, messages: [{ role: 'user', content: 'Return JSON' }]
    }, () => {}, undefined, async (_url, init) => {
      geminiBody = JSON.parse(String(init?.body)); return sse([{ candidates: [{ content: { parts: [{ thought: true, text: 'hidden' }, { text: '{"ok":true}' }] } }] }])
    })
    expect(geminiBody.generationConfig).toMatchObject({ responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'MEDIUM', includeThoughts: false } })
    expect(gemini.parts).toBeUndefined()
    expect(gemini.providerState).toBeUndefined()
  })

  it('preserves Claude thinking signatures and exposes thinking separately', async () => {
    const result = await invokeProvider({ id: 'anthropic', name: 'Claude', protocol: 'anthropic', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }, { providerId: 'anthropic', model: 'claude-sonnet-5', parameters: { maxTokens: 1024 }, messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async () => sse([
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'reason' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'signed' } },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'answer' } }
    ]))
    expect(result.parts).toEqual([{ type: 'reasoning', text: 'reason' }, { type: 'output_text', text: 'answer' }])
    expect(result.providerState).toEqual({ format: 'anthropic-content', data: [{ type: 'thinking', thinking: 'reason', signature: 'signed' }, { type: 'text', text: 'answer' }] })
  })

  it('round-trips OpenRouter reasoning_details without mixing them into final text', async () => {
    const provider: ResolvedProvider = { id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }
    const result = await invokeProvider(provider, { providerId: 'openrouter', model: 'test/model', messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async () => sse([{ choices: [{ delta: { reasoning: 'reason', reasoning_details: [{ type: 'reasoning.text', text: 'reason', id: 'r1' }], content: 'answer' } }] }]))
    expect(result.parts).toEqual([{ type: 'reasoning', text: 'reason' }, { type: 'output_text', text: 'answer' }])
    let body: any
    await invokeProvider(provider, { providerId: 'openrouter', model: 'test/model', messages: [{ role: 'assistant', content: result.content, providerState: result.providerState }, { role: 'user', content: 'continue' }] }, () => {}, undefined, async (_url, init) => { body = JSON.parse(String(init?.body)); return sse([{ choices: [{ delta: { content: 'ok' } }] }]) })
    expect(body.messages[0].reasoning_details).toEqual([{ type: 'reasoning.text', text: 'reason', id: 'r1' }])
    expect(body.messages[0].providerState).toBeUndefined()
  })
  it('uses the OpenAI Responses stream format and preserves continuation state', async () => {
    let body: Record<string, unknown> = {}
    let requestUrl = ''
    const provider: ResolvedProvider = { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', apiKey: 'secret', requireApiKey: true }
    const result = await invokeProvider(provider, {
      providerId: 'openai',
      model: 'gpt-5.6-sol',
      messages: [{ role: 'user', content: 'Hello' }],
      parameters: { temperature: 0.4, maxTokens: 1024, reasoningLevel: 'high' }
    }, () => undefined, undefined, async (url, init) => {
      requestUrl = String(url)
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return sse([{ type: 'response.output_text.delta', delta: 'Hello' }, { type: 'response.output_text.delta', delta: '!' }, { type: 'response.completed', response: { id: 'resp_123', usage: { input_tokens: 4, output_tokens: 2 }, output: [] } }])
    })
    expect(result.content).toBe('Hello!')
    expect(result.externalSessionId).toBe('resp_123')
    expect(requestUrl).toBe('https://api.openai.com/v1/responses')
    expect(body.temperature).toBeUndefined()
    expect(body.max_output_tokens).toBe(1024)
    expect(body.store).toBe(false)
    expect(body.include).toEqual(['reasoning.encrypted_content'])
    expect(body.reasoning).toEqual({ effort: 'high', summary: 'auto' })
  })

  it('serializes image parts for OpenAI-compatible, Anthropic, and Gemini protocols', async () => {
    const message = { role: 'user' as const, content: [{ type: 'text' as const, text: 'Describe' }, { type: 'image' as const, name: 'photo.png', mimeType: 'image/png', dataBase64: 'AAAA' }] }
    const cases = [
      { id: 'openai', protocol: 'openai-compatible' as const, model: 'gpt-5.6-sol', expected: (body: any) => body.input[0].content[1].image_url },
      { id: 'anthropic', protocol: 'anthropic' as const, model: 'claude-sonnet-5', expected: (body: any) => body.messages[0].content[1].source.media_type },
      { id: 'google', protocol: 'gemini' as const, model: 'gemini-3.7-flash', expected: (body: any) => body.contents[0].parts[1].inlineData.mimeType }
    ]
    for (const item of cases) {
      let body: any
      await invokeProvider({ id: item.id, name: item.id, protocol: item.protocol, baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }, { providerId: item.id, model: item.model, messages: [message] }, () => {}, undefined, async (_url, init) => {
        body = JSON.parse(String(init?.body))
        return sse([item.protocol === 'anthropic' ? { delta: { type: 'text_delta', text: 'ok' } } : item.protocol === 'gemini' ? { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } : item.id === 'openai' ? { type: 'response.output_text.delta', delta: 'ok' } : { choices: [{ delta: { content: 'ok' } }] }])
      })
      expect(item.expected(body)).toContain(item.protocol === 'openai-compatible' ? 'data:image/png;base64,' : 'image/png')
    }
  })

  it('maps system messages and streaming deltas to the Anthropic Messages API', async () => {
    let requestUrl = ''
    let body: Record<string, unknown> = {}
    let headers: HeadersInit | undefined
    const provider: ResolvedProvider = { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'secret', requireApiKey: true }
    const result = await invokeProvider(provider, {
      providerId: 'anthropic',
      model: 'claude-sonnet-5',
      messages: [{ role: 'system', content: 'Be concise.' }, { role: 'user', content: 'Hello' }]
    }, () => undefined, undefined, async (url, init) => {
      requestUrl = String(url)
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      headers = init?.headers
      return sse([{ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } }])
    })
    expect(requestUrl).toBe('https://api.anthropic.com/v1/messages')
    expect(body.system).toBe('Be concise.')
    expect(headers).toMatchObject({ 'x-api-key': 'secret', 'anthropic-version': '2023-06-01' })
    expect(result.content).toBe('Hi')
  })

  it('uses Gemini contents, systemInstruction, and SSE response parts', async () => {
    let body: Record<string, unknown> = {}
    const provider: ResolvedProvider = { id: 'google', name: 'Google Gemini', protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: 'secret', requireApiKey: true }
    const result = await invokeProvider(provider, {
      providerId: 'google',
      model: 'gemini-3.6-flash',
      messages: [{ role: 'system', content: 'Be concise.' }, { role: 'user', content: 'Hello' }]
    }, () => undefined, undefined, async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return sse([{ candidates: [{ content: { parts: [{ text: 'Hi' }] } }] }])
    })
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Be concise.' }] })
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'Hello' }] }])
    expect(result.content).toBe('Hi')
  })

  it('validates an OpenRouter key before loading its model list', async () => {
    const requests: Array<{ url: string; headers?: HeadersInit }> = []
    const provider: ResolvedProvider = { id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'secret', requireApiKey: true }
    const models = await testProviderConnection(provider, undefined, async (url, init) => {
      requests.push({ url: String(url), headers: init?.headers })
      if (String(url).endsWith('/key')) return new Response(JSON.stringify({ data: { label: 'AgentFlow' } }), { status: 200 })
      return new Response(JSON.stringify({ data: [{ id: 'anthropic/claude-sonnet-4' }] }), { status: 200 })
    })
    expect(requests.map((request) => request.url)).toEqual([
      'https://openrouter.ai/api/v1/key',
      'https://openrouter.ai/api/v1/models'
    ])
    expect(requests[0]?.headers).toMatchObject({ Authorization: 'Bearer secret' })
    expect(models.models).toEqual(['anthropic/claude-sonnet-4'])
  })

  it('retains OpenRouter model capabilities and uses the fetched effort contract for HTTP', async () => {
    const model = '~deepseek/deepseek-v4-flash-latest'
    const provider: ResolvedProvider = { id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }
    const catalog = await listProviderModels(provider, undefined, async () => new Response(JSON.stringify({ data: [{ id: model, reasoning: { supported_efforts: ['max', 'high', 'low'], default_effort: 'high', mandatory: true }, supported_parameters: ['reasoning', 'max_tokens'], top_provider: { max_completion_tokens: 131072 }, default_parameters: {} }] })))
    expect(catalog.models).toEqual([model])
    expect(catalog.metadata[model]?.reasoning?.supportedEfforts).toEqual(['max', 'high', 'low'])
    let body: Record<string, unknown> = {}
    let calls = 0
    const fetchMock: typeof fetch = async (_url, init) => { calls++; body = JSON.parse(String(init?.body)); return sse([{ choices: [{ delta: { content: 'ok' } }] }]) }
    const resolved = { ...provider, modelMetadata: catalog.metadata }
    const request = { providerId: provider.id, model, messages: [{ role: 'user' as const, content: 'test' }] }
    await invokeProvider(resolved, request, () => {}, undefined, fetchMock)
    expect(body.reasoning).toEqual({ effort: 'high' })
    expect(body.max_tokens).toBeUndefined()
    expect(body.temperature).toBeUndefined()
    await expect(invokeProvider(resolved, { ...request, parameters: { reasoningLevel: 'none' } }, () => {}, undefined, fetchMock)).rejects.toThrow('推理强度')
    expect(calls).toBe(1)
  })

  it('reads Gemini outputTokenLimit as the provider default and omits it for -1', async () => {
    const provider: ResolvedProvider = { id: 'google', name: 'Gemini', protocol: 'gemini', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }
    const catalog = await listProviderModels(provider, undefined, async () => new Response(JSON.stringify({ models: [{ name: 'models/gemini-3.7-flash', outputTokenLimit: 65536, supportedGenerationMethods: ['generateContent'] }] })))
    expect(catalog.metadata['gemini-3.7-flash']).toEqual({ maxOutputTokens: 65536, defaultMaxTokens: 65536 })
    let body: Record<string, any> = {}
    await invokeProvider({ ...provider, modelMetadata: catalog.metadata }, { providerId: 'google', model: 'gemini-3.7-flash', parameters: { maxTokens: -1 }, messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async (_url, init) => {
      body = JSON.parse(String(init?.body)); return sse([{ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }])
    })
    expect(body.generationConfig.maxOutputTokens).toBeUndefined()
  })

  it('maps Claude -1 to its model limit instead of sending an illegal negative value', async () => {
    let body: Record<string, unknown> = {}
    await invokeProvider({ id: 'anthropic', name: 'Claude', protocol: 'anthropic', baseUrl: 'https://example.test', apiKey: '', requireApiKey: false }, { providerId: 'anthropic', model: 'claude-sonnet-5', parameters: { maxTokens: -1 }, messages: [{ role: 'user', content: 'test' }] }, () => {}, undefined, async (_url, init) => {
      body = JSON.parse(String(init?.body)); return sse([{ delta: { type: 'text_delta', text: 'ok' } }])
    })
    expect(body.max_tokens).toBe(128000)
  })
})
