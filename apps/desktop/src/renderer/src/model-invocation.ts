import { t } from '@agentflow/core/localization'
import { invokeModelSafely } from '@agentflow/core'
import type { DesktopLlmApi, DesktopModelInvocationRequest } from '../../shared/llm'

export async function invokeDesktopModel(
  api: DesktopLlmApi,
  request: Omit<DesktopModelInvocationRequest, 'requestId'>,
  onDelta?: (delta: string) => void,
  signal?: AbortSignal
) {
  return invokeModelSafely((_request, delta, guardedSignal) => invokeDesktopRequest(api, request, delta, guardedSignal), request, onDelta, signal)
}

async function invokeDesktopRequest(
  api: DesktopLlmApi,
  request: Omit<DesktopModelInvocationRequest, 'requestId'>,
  onDelta?: (delta: string) => void,
  signal?: AbortSignal
) {
  signal?.throwIfAborted()
  const requestId = `llm_${crypto.randomUUID()}`
  let abort: (() => void) | undefined
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => { api.cancelModel(requestId); reject(new DOMException(t("Stopped"), 'AbortError')) }
    signal?.addEventListener('abort', abort, { once: true })
  })
  try {
    const result = await Promise.race([
      api.invokeModel({ ...request, requestId }, (delta) => { if (!signal?.aborted) onDelta?.(delta) }),
      cancelled
    ])
    signal?.throwIfAborted()
    return result
  } finally { if (abort) signal?.removeEventListener('abort', abort) }
}
