import { afterEach, describe, expect, it, vi } from 'vitest'
import { playTutorialRun, tutorialDelay, tutorialRunOrder } from './tutorial-playback'
import { endTutorial, publishTutorialNode, setTutorialStep, tutorialGraph } from './tutorial-project'
import { createDefaultWorkspaceState, startTutorial } from './workspace-store'

afterEach(() => vi.useRealTimers())

describe('tutorial playback', () => {
  it('starts at Input and publishes outputs only as each node completes', async () => {
    vi.useFakeTimers()
    let state = setTutorialStep(startTutorial(createDefaultWorkspaceState()), 7)
    const graph = state.graphs.find((graph) => graph.id === state.activeGraphId)!.definition
    const events: string[] = []
    const run = playTutorialRun(graph, 'local', new AbortController().signal, (playback, status) => {
      events.push(`${playback.nodeId}:${status}`)
      if (status === 'completed') state = publishTutorialNode(state, playback.nodeId, 8)
    })
    expect(events).toEqual(['brief:running'])
    await vi.advanceTimersByTimeAsync(300)
    expect(state.artifacts).toHaveLength(0)
    expect(events).toHaveLength(1)
    await vi.runAllTimersAsync()
    expect(await run).toBe(true)
    expect(events).toEqual(tutorialRunOrder(graph, 'local').flatMap((id) => [`${id}:running`, `${id}:completed`]))
    expect(state.artifacts.map((artifact) => artifact.nodeId)).toEqual(['analyst', 'writer', 'reviewer', 'reviser', 'result'])
    expect(state.tutorial?.step).toBe(7)
  })

  it('includes a local reviewer Result before revision and stops without publishing after Skip', async () => {
    vi.useFakeTimers()
    const graph = tutorialGraph(7, 'codex', { provider: 'agent-tool:claude-code', model: 'sonnet' })
    const order = tutorialRunOrder(graph, 'local')
    expect(order.indexOf('output_reviewer')).toBe(order.indexOf('reviewer') + 1)
    expect(order.indexOf('reviser')).toBe(order.indexOf('output_reviewer') + 1)
    let state = startTutorial(createDefaultWorkspaceState())
    state.tutorial!.reviewer = { provider: 'agent-tool:claude-code', model: 'sonnet' }
    state = setTutorialStep(state, 7)
    const controller = new AbortController(), status = vi.fn()
    const run = playTutorialRun(graph, 'local', controller.signal, (playback, nodeStatus) => {
      status(playback, nodeStatus)
      if (nodeStatus === 'completed') state = publishTutorialNode(state, playback.nodeId, 8)
    })
    await vi.advanceTimersByTimeAsync(800)
    controller.abort()
    state = endTutorial(state, 'skipped')
    const final = structuredClone(state)
    const count = status.mock.calls.length
    await vi.runAllTimersAsync()
    expect(await run).toBe(false)
    expect(status).toHaveBeenCalledTimes(count)
    expect(state).toEqual(final)
    expect(state.artifacts.some((artifact) => artifact.nodeId === 'delivery')).toBe(true)
    expect(publishTutorialNode(state, 'result', 8)).toEqual(final)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels generation delays and runs only the final Agent for the brief', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const delay = tutorialDelay(1200, controller.signal)
    controller.abort()
    expect(await delay).toBe(false)
    const status = vi.fn()
    const run = playTutorialRun(tutorialGraph(10), 'delivery', new AbortController().signal, status)
    expect(status).toHaveBeenCalledTimes(1)
    await vi.runAllTimersAsync()
    expect(await run).toBe(true)
    expect(status.mock.calls.map(([playback, state]) => [playback.nodeId, state])).toEqual([['delivery', 'running'], ['delivery', 'completed']])
  })
})
