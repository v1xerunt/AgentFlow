import { useLanguage } from './language'
import { useEffect } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { tutorialReviewerSource } from './tutorial-project'
import { linkSourceIds, type GraphDefinition } from '@agentflow/schema'
import type { TutorialPlayback } from './tutorial-playback'

const focusByStep = [
  ['brief'], ['analyst', 'writer'], ['writer', 'reviewer'], ['writer', 'reviewer'],
  ['reviewer', 'reviser'], ['reviewer', 'reviser'], ['reviewer'], ['reviewer'],
  ['local', 'result'], ['result', 'delivery'], ['result', 'delivery'], ['delivery'], ['delivery']
]

export function TutorialViewport({ overview, step, graph, selectedLinkId, playback }: { overview: boolean; step: number; graph: GraphDefinition; selectedLinkId: string | null; playback?: TutorialPlayback }) {
  const language = useLanguage()

  const { fitView } = useReactFlow()
  const measuredIds = useStore((state) => [...state.nodeLookup.values()].filter((node) => node.measured?.width && node.measured?.height).map((node) => node.id).join(','))
  const width = useStore((state) => state.width)
  const height = useStore((state) => state.height)
  const link = graph.links.find((candidate) => candidate.id === selectedLinkId)
  const ids = (playback ? [playback.previousNodeId, playback.nodeId].filter((id): id is string => Boolean(id)) : overview ? Object.keys(graph.nodes) : step === 4 ? [tutorialReviewerSource(graph), 'reviser'] : link ? [...linkSourceIds(link), link.targetId] : focusByStep[step]!).filter((id) => graph.nodes[id]).join(',')
  const initialized = ids.split(',').every((id) => measuredIds.split(',').includes(id))
  useEffect(() => {
    if (!initialized) return
    const frame = requestAnimationFrame(() => void fitView({ nodes: ids.split(',').map((id) => ({ id })), padding: overview ? .15 : .32, minZoom: .1, maxZoom: 1, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220 }))
    return () => cancelAnimationFrame(frame)
  }, [fitView, initialized, ids, width, height, overview])
  return null
}
