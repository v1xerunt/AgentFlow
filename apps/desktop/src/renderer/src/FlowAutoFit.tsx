import { useLanguage } from './language'
import { useEffect, useRef } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import type { GraphDefinition } from '@agentflow/schema'

export const FLOW_FIT_OPTIONS = { padding: .22, minZoom: .1, maxZoom: 1.2 }

export function FlowAutoFit({ nodes }: { nodes: GraphDefinition['nodes'] }) {
  const language = useLanguage()

  const { fitView, viewportInitialized } = useReactFlow()
  const width = useStore((state) => state.width)
  const height = useStore((state) => state.height)
  const measuredIds = useStore((state) => [...state.nodeLookup.values()]
    .filter((node) => node.measured?.width && node.measured?.height)
    .map((node) => node.id).join('\0'))
  const previous = useRef(new Set(Object.keys(nodes)))
  const pending = useRef(new Set<string>())
  const initialFit = useRef(true)

  useEffect(() => {
    for (const [id, node] of Object.entries(nodes)) {
      if (node.type === 'agent' && !previous.current.has(id)) pending.current.add(id)
    }
    previous.current = new Set(Object.keys(nodes))
    for (const id of pending.current) if (!nodes[id]) pending.current.delete(id)
    const measured = new Set(measuredIds.split('\0'))
    const nodeIds = Object.keys(nodes)
    // The initial Input can be measured before the rest of the Flow is ready.
    if (!viewportInitialized || !width || !height || !nodeIds.length || !nodeIds.every((id) => measured.has(id))) return
    if (!initialFit.current && !pending.current.size) return
    const frame = requestAnimationFrame(() => {
      const firstFit = initialFit.current
      initialFit.current = false
      pending.current.clear()
      void fitView({ ...FLOW_FIT_OPTIONS, duration: firstFit || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240 })
    })
    return () => cancelAnimationFrame(frame)
  }, [nodes, measuredIds, fitView, viewportInitialized, width, height])

  return null
}
