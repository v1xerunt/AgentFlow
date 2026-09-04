import { t } from './localization'
import type { ModelInvocationRequest, ModelInvocationResult, ModelInvoker, ModelOutputFile } from './llm'

export const MODEL_TIMEOUT_MS = 180_000
export const AGENT_TOOL_TIMEOUT_MS = 600_000

function hasFileContent(file: ModelOutputFile) {
  return file && typeof file.name === 'string' && file.name.trim() && typeof file.relativePath === 'string' && file.relativePath.trim()
    && (file.mode === 'text' ? typeof file.content === 'string' && file.content.trim() : file.mode === 'attachment' && file.size > 0)
}

export function validateModelResponse(result: ModelInvocationResult, requireFiles = false) {
  if (!result || typeof result.content !== 'string' || result.files !== undefined && !Array.isArray(result.files)) {
    throw new Error(t('The provider returned an invalid response'))
  }
  const files = result.files?.some(hasFileContent)
  if (requireFiles && !files) throw new Error(t('The Agent did not return any usable output files'))
  if (!result.content.trim() && !files) throw new Error(t('The provider completed the response without returning text'))
}

/** Bound each request and discard late results even when the connector ignores cancellation. */
export async function invokeModelSafely(invoke: ModelInvoker, request: ModelInvocationRequest, onDelta?: (delta: string) => void, signal?: AbortSignal, timeoutMs = request.providerId.startsWith('agent-tool:') || request.providerId.startsWith('subscription:') && request.providerId !== 'subscription:deepseek-web' ? AGENT_TOOL_TIMEOUT_MS : MODEL_TIMEOUT_MS) {
  signal?.throwIfAborted()
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', forwardAbort, { once: true })
  let rejectAbort: () => void = () => {}
  let finished = false
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason)
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  const timer = setTimeout(() => controller.abort(new Error(t('Model request timed out after {0} seconds', [Math.ceil(timeoutMs / 1000)]))), timeoutMs)
  try {
    const result = await Promise.race([
      invoke(request, delta => { if (!finished && !controller.signal.aborted) onDelta?.(delta) }, controller.signal),
      cancelled
    ])
    controller.signal.throwIfAborted()
    validateModelResponse(result, Boolean(request.outputDirectory))
    return result
  } finally {
    finished = true
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
    controller.signal.removeEventListener('abort', rejectAbort)
  }
}
