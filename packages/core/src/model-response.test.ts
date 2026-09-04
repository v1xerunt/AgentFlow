import { afterEach, describe, expect, it, vi } from 'vitest'
import { invokeModelSafely, validateModelResponse } from './model-response'
import type { ModelInvocationRequest, ModelInvocationResult } from './llm'

const request: ModelInvocationRequest = { providerId: 'test', model: 'test', messages: [] }
const response = (content: string): ModelInvocationResult => ({ providerId: 'test', model: 'test', content })

afterEach(() => vi.useRealTimers())
describe('model response guard', () => {
  it.each(['', '  \n\t'])('rejects empty text %j', content => {
    expect(() => validateModelResponse(response(content))).toThrow()
  })
  it('requires usable output, including files for a Result node', () => {
    expect(() => validateModelResponse(undefined as unknown as ModelInvocationResult)).toThrow()
    expect(() => validateModelResponse(response('Done'), true)).toThrow()
    const file = { name: 'report.md', relativePath: 'report.md', mode: 'text' as const, content: '# Report', mimeType: 'text/markdown', size: 8 }
    expect(() => validateModelResponse({ ...response(''), files: [file] }, true)).not.toThrow()
    expect(() => validateModelResponse({ ...response(''), files: [{ ...file, content: ' ' }] })).toThrow()
    expect(() => validateModelResponse({ ...response(''), files: [{ ...file, mode: 'attachment', size: 3 }] }, true)).not.toThrow()
  })
  it('times out a connector that ignores cancellation and ignores its late output', async () => {
    vi.useFakeTimers()
    let resolve!: (result: ModelInvocationResult) => void
    let delta!: (text: string) => void
    let signal!: AbortSignal
    const onDelta = vi.fn()
    const pending = invokeModelSafely((_request, callback, guardedSignal) => {
      delta = callback!; signal = guardedSignal!
      return new Promise(done => { resolve = done })
    }, request, onDelta, undefined, 20)
    const assertion = expect(pending).rejects.toThrow(/超时|timed out/)
    await vi.advanceTimersByTimeAsync(20)
    await assertion
    expect(signal.aborted).toBe(true)
    delta('late'); resolve(response('late'))
    expect(onDelta).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('preserves provider errors and cancels immediately with the caller', async () => {
    const error = new Error('HTTP 429')
    await expect(invokeModelSafely(async () => { throw error }, request)).rejects.toBe(error)
    const controller = new AbortController()
    const pending = invokeModelSafely(() => new Promise(() => {}), request, undefined, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
