import type { GraphDefinition } from '@agentflow/schema'
import { tutorialReviewerSource } from './tutorial-project'

export type TutorialPlayback = { nodeId: string; previousNodeId?: string; index: number; total: number }

export function tutorialRunOrder(graph: GraphDefinition, target: 'local' | 'delivery') {
  const reviewerSource = tutorialReviewerSource(graph)
  return (target === 'delivery' ? ['delivery'] : ['brief', 'analyst', 'writer', 'reviewer', ...(reviewerSource === 'reviewer' ? [] : [reviewerSource]), 'reviser', 'local', 'result']).filter((id) => graph.nodes[id])
}

export function tutorialDelay(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(false); return }
    const finish = (completed: boolean) => { clearTimeout(timer); signal.removeEventListener('abort', abort); resolve(completed) }
    const abort = () => finish(false)
    const timer = setTimeout(() => finish(true), ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

export async function playTutorialRun(graph: GraphDefinition, target: 'local' | 'delivery', signal: AbortSignal, onStatus: (playback: TutorialPlayback, status: 'running' | 'completed') => void): Promise<boolean> {
  const order = tutorialRunOrder(graph, target)
  for (const [index, nodeId] of order.entries()) {
    if (signal.aborted) return false
    const playback = { nodeId, previousNodeId: order[index - 1], index, total: order.length }
    onStatus(playback, 'running')
    const node = graph.nodes[nodeId]!
    const duration = node.type === 'input' ? 700 : node.type === 'output' ? 600 : nodeId === 'local' || nodeId === 'delivery' ? 1500 : 1100
    if (!await tutorialDelay(duration, signal) || signal.aborted) return false
    onStatus(playback, 'completed')
  }
  return true
}
