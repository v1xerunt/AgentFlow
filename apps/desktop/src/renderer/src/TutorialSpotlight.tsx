import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import type { GraphDefinition } from '@agentflow/schema'
import { resolveGuideAction, type GuideAction, type GuideTarget } from './tutorial-targets'
import type { TutorialPlayback } from './tutorial-playback'
import './tutorial.css'

type Box = { x: number; y: number; width: number; height: number; kind?: GuideTarget['kind']; selector: string }
type Trace = { path: string; transform: string }
type Layout = { action: GuideAction; boxes: Box[]; trace?: Trace; width: number; height: number }

function visibleBox(element: Element, target: GuideTarget): Box | undefined {
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  let left = Math.max(0, rect.left), top = Math.max(0, rect.top), right = Math.min(innerWidth, rect.right), bottom = Math.min(innerHeight, rect.bottom)
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect()
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right) }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom) }
  }
  if (right - left < 6 || bottom - top < 6) return
  const padding = target.kind === 'preview' ? 0 : 4
  return { x: left - padding, y: top - padding, width: right - left + padding * 2, height: bottom - top + padding * 2, ...target }
}
const matches = (target: EventTarget | null, selectors: string[]) => target instanceof Element && selectors.some((selector) => target.closest(selector))
const card = '.tutorial-spotlight__card'

export function TutorialSpotlight({ step, graph, surface, overview, playback, building, onOverviewDone, onBack, onSkip }: {
  step: number; graph: GraphDefinition; surface: string; overview: boolean; playback?: TutorialPlayback; building?: 'flow' | 'prompts'; onOverviewDone: () => void; onBack: () => void; onSkip: () => void
}) {
  const language = useLanguage()

  const [layout, setLayout] = useState<Layout>(() => ({ action: resolveGuideAction(step, graph, surface, overview), boxes: [], width: innerWidth, height: innerHeight }))
  const [retry, setRetry] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef(false)
  const lastRetry = useRef(0)
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let frame = 0, previous = '', lastAction = ''
    const policy = () => resolveGuideAction(step, graph, surface, overview, playback, building)
    const reinforce = () => {
      if (Date.now() - lastRetry.current < 250) return
      lastRetry.current = Date.now(); setRetry((value) => value + 1)
    }
    const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); reinforce() }
    const allowed = (event: Event, action = policy()) => matches(event.target, [card, ...action.allowed])
    const down = (event: Event) => {
      const action = policy()
      if (action.drag && !matches(event.target, [card])) {
        if (!matches(event.target, [action.drag[0]])) { block(event); return }
        drag.current = true; setDragging(true); return
      }
      if (!allowed(event, action)) block(event)
    }
    const up = (event: Event) => {
      if (!drag.current) return
      const action = policy()
      if (action.drag && !matches(event.target, [action.drag[1]])) reinforce()
      // Let React Flow finish the gesture, including cancellation on empty canvas.
      drag.current = false; setDragging(false)
    }
    const click = (event: Event) => { if (!allowed(event)) block(event) }
    const scroll = (event: Event) => { if (!matches(event.target, [...(policy().scroll ?? []), card])) { event.preventDefault(); event.stopImmediatePropagation() } }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const selectors = [...policy().allowed, `${card} button`]
        const targets = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)]))].filter((element) => !element.matches(':disabled') && element.matches('button,input,textarea,[tabindex]') && visibleBox(element, { selector: '' }))
        if (targets.length) {
          event.preventDefault(); event.stopImmediatePropagation()
          const index = targets.indexOf(document.activeElement as HTMLElement)
          targets[(index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length]!.focus({ preventScroll: true })
        }
        return
      }
      const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
      if (!allowed(event) || (event.ctrlKey || event.metaKey || event.altKey) && !(editing && !event.altKey && /^[acvxz]$/i.test(event.key))) block(event)
    }
    const focus = (event: FocusEvent) => {
      if (allowed(event)) return
      requestAnimationFrame(() => {
        if (matches(document.activeElement, [card, ...policy().allowed])) return
        const target = policy().allowed.flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)]).find((element) => element.matches('button,input,textarea') && visibleBox(element, { selector: '' }))
        target?.focus({ preventScroll: true })
      })
    }
    const update = () => {
      const action = policy()
      const boxes = action.targets.flatMap((target) => {
        const element = [...document.querySelectorAll(target.selector)].find((element) => visibleBox(element, target))
        const box = element && visibleBox(element, target)
        return box ? [box] : []
      })
      const element = action.edge ? document.querySelector<SVGPathElement>(action.edge) : null
      const matrix = element?.getScreenCTM()
      const trace = element && matrix ? { path: element.getAttribute('d') ?? '', transform: `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})` } : undefined
      const next = { action, boxes, trace, width: innerWidth, height: innerHeight }, signature = JSON.stringify(next)
      if (signature !== previous) { previous = signature; setLayout(next) }
      if (action.id !== lastAction) {
        lastAction = action.id
        if (action.id === 'run-flow') document.querySelector('[data-section-key="agent-prompts"] .inspector-section__body')?.scrollIntoView({ block: 'start', inline: 'nearest' })
        const target = action.targets.find((target) => target.kind !== 'preview')
        if (target && !target.kind) document.querySelector(target.selector)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
      frame = requestAnimationFrame(update)
    }
    update()
    document.addEventListener('pointerdown', down, true); document.addEventListener('mousedown', down, true)
    document.addEventListener('pointerup', up, true); document.addEventListener('mouseup', up, true)
    document.addEventListener('click', click, true); document.addEventListener('dblclick', click, true); document.addEventListener('contextmenu', block, true)
    document.addEventListener('dragstart', block, true); document.addEventListener('drop', block, true)
    document.addEventListener('keydown', key, true); document.addEventListener('focusin', focus, true)
    document.addEventListener('wheel', scroll, { capture: true, passive: false })
    window.addEventListener('agentflow:tutorial-refocus', reinforce)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', down, true); document.removeEventListener('mousedown', down, true)
      document.removeEventListener('pointerup', up, true); document.removeEventListener('mouseup', up, true)
      document.removeEventListener('click', click, true); document.removeEventListener('dblclick', click, true); document.removeEventListener('contextmenu', block, true)
      document.removeEventListener('dragstart', block, true); document.removeEventListener('drop', block, true)
      document.removeEventListener('keydown', key, true); document.removeEventListener('focusin', focus, true)
      document.removeEventListener('wheel', scroll, true); window.removeEventListener('agentflow:tutorial-refocus', reinforce)
    }
  }, [step, graph, surface, overview, playback, building])

  const width = Math.min(292, layout.width - 32), height = overview ? 215 : 195
  const slots = [{ x: layout.width - width - 18, y: 76 }, { x: 18, y: 76 }, { x: 18, y: Math.max(76, layout.height - height - 88) }, { x: layout.width - width - 18, y: Math.max(76, layout.height - height - 88) }]
  const overlap = (slot: { x: number; y: number }) => layout.boxes.reduce((sum, box) => sum + Math.max(0, Math.min(slot.x + width + 12, box.x + box.width) - Math.max(slot.x - 12, box.x)) * Math.max(0, Math.min(slot.y + height + 12, box.y + box.height) - Math.max(slot.y - 12, box.y)), 0)
  const position = slots.sort((a, b) => overlap(a) - overlap(b))[0]!
  const points = layout.boxes.filter((box) => box.kind === 'point').map((box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }))
  const [from, to] = points
  const dragPath = from && to ? `M ${from.x} ${from.y} C ${from.x + 42} ${from.y}, ${to.x - 42} ${to.y}, ${to.x} ${to.y}` : undefined
  const chapter = [1, 2, 3, 3, 3, 3, 4, 5, 6, 6, 6, 7, 7][step]
  return <div className="tutorial-spotlight" data-guide-step={step} data-guide-action={layout.action.id} data-guide-retry={retry}>
    <svg className="tutorial-spotlight__mask" width={layout.width} height={layout.height} aria-hidden="true">
      <defs>
        <mask id="tutorial-cutouts"><rect width="100%" height="100%" fill="white" />{layout.boxes.map((box, index) => <rect key={index} x={box.x} y={box.y} width={box.width} height={box.height} rx={box.kind === 'point' ? 30 : 7} fill="black" />)}{layout.trace ? <path d={layout.trace.path} transform={layout.trace.transform} stroke="black" strokeWidth="10" vectorEffect="non-scaling-stroke" fill="none" /> : null}</mask>
        <marker id="tutorial-direction" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="none" stroke="#c4dd89" strokeWidth="1.5" /></marker>
      </defs>
      <rect width="100%" height="100%" fill="rgba(19,24,28,.58)" mask="url(#tutorial-cutouts)" />
      <g key={`${layout.action.id}-${retry}`} className={retry ? 'tutorial-refocus' : undefined}>
        {layout.trace ? <path className="tutorial-link-trace" d={layout.trace.path} transform={layout.trace.transform} vectorEffect="non-scaling-stroke" /> : null}
        {dragPath && !dragging ? <><path className="tutorial-drag-path" d={dragPath} markerEnd="url(#tutorial-direction)" />{!reducedMotion ? <circle key={dragPath} r="3" fill="#e3f3b9"><animateMotion dur="1.8s" repeatCount="indefinite" path={dragPath} /></circle> : null}</> : null}
        {layout.boxes.filter((box) => box.kind !== 'preview').map((box, index) => box.kind === 'point' ? <g key={index} data-guide-target={box.selector}><circle className="tutorial-point-ring" cx={box.x + box.width / 2} cy={box.y + box.height / 2} r="10" /><circle className="tutorial-point-pulse" style={{ animationDelay: `${index * .25}s` }} cx={box.x + box.width / 2} cy={box.y + box.height / 2} r="14" /></g> : <rect key={index} className="tutorial-button-ring" data-guide-target={box.selector} x={box.x} y={box.y} width={box.width} height={box.height} rx="7" />)}
      </g>
    </svg>
    <aside className="tutorial-spotlight__card" style={{ left: position.x, top: position.y, width }} aria-label={t("Interactive tutorial")}>
      <button className="tutorial-close" type="button" onClick={onSkip} aria-label={t("Skip tutorial")}><X size={15} /></button>
      <div aria-live="polite"><h2>{layout.action.title}</h2><p>{layout.action.text}</p></div>
      {overview ? <button type="button" className="tutorial-overview-done" onClick={onOverviewDone}>{t("Add a review Agent")}</button> : null}
      <div className="tutorial-spotlight__footer"><button type="button" disabled={step === 0 || Boolean(playback || building)} onClick={onBack}><ArrowLeft size={13} />{t("Back")}</button><span>{chapter} / 7</span><button type="button" onClick={onSkip}>{t("Skip")}</button></div>
    </aside>
  </div>
}
