import { t } from '@agentflow/core/localization'
import { linkSourceIds, type GraphDefinition } from '@agentflow/schema'
import { tutorialReviewerSource } from './tutorial-project'
import type { TutorialPlayback } from './tutorial-playback'

export type GuideTarget = { selector: string; kind?: 'point' | 'preview' }
export type GuideAction = {
  id: string; title: string; text: string; targets: GuideTarget[]; allowed: string[]; scroll?: string[]
  drag?: [string, string]; edge?: string
}
export const guideHandle = (id: string, direction: 'source' | 'target') => `.react-flow__node[data-id="${id}"] .react-flow__handle.${direction}`
const one = (id: string, title: string, text: string, selector: string): GuideAction => ({ id, title, text, targets: [{ selector }], allowed: [selector] })

export function resolveGuideAction(step: number, graph: GraphDefinition, surface: string, overview: boolean, playback?: TutorialPlayback, building?: 'flow' | 'prompts'): GuideAction {
  if (building) return { id: `building-${building}`, title: building === 'flow' ? t("Generating Flow") : t("Filling review prompts"), text: building === 'flow' ? t("Assigning roles from the description and writing their tasks.") : t("Writing input and output requirements from upstream content and review responsibilities."), targets: [{ selector: building === 'flow' ? '.flow-generation-dialog' : '[aria-labelledby="prompt-autofill-title"]', kind: 'preview' }], allowed: [] }
  if (playback) {
    const node = graph.nodes[playback.nodeId]!
    const link = graph.links.find((link) => link.targetId === playback.nodeId)
    const edgeId = node.type === 'output' ? `agent-output-edge::${node.ownerAgentId}::${playback.nodeId}` : link?.type === 'merge' ? `${link.id}::${linkSourceIds(link).at(-1)}` : link?.id
    return { id: `running-${playback.nodeId}`, title: node.type === 'input' ? t("Reading customer feedback") : node.type === 'output' ? t("Saving result files") : t("Running: {0}", [node.name]), text: `${playback.index + 1} / ${playback.total} · ${playback.index + 1 === playback.total ? t("Results will be available when complete.") : t("When this node finishes, its result follows the link to the next step.")}`, targets: [{ selector: `.react-flow__node[data-id="${playback.nodeId}"]`, kind: 'preview' }], allowed: [], edge: edgeId ? `.react-flow__edge[data-id="${edgeId}"] .react-flow__edge-path` : undefined }
  }
  if (overview) return { id: 'overview', title: t("Flow generated"), text: t("Inputs, planning, brief design, and local analysis are ready, with prompts for each Agent. Add an independent reviewer next."), targets: [{ selector: '.react-flow', kind: 'preview' }], allowed: [] }
  if (step === 0 && document.querySelector('.flow-generation-dialog')) {
    const preview = Boolean(document.querySelector('.flow-generation-preview'))
    return { ...one(preview ? 'apply-flow' : 'preview-flow', preview ? t("Place the Flow on the canvas") : t("See a description become a Flow"), preview ? t("Click “Apply Flow” to see the complete process.") : t("Click “Generate preview” to turn customer feedback into a weekly brief."), '.flow-generation-actions .primary-button'), scroll: ['.flow-generation-dialog'] }
  }
  if (step === 6 && document.querySelector('[aria-labelledby="prompt-autofill-title"]')) return { ...one('confirm-autofill', t("Complete the review Agent’s prompts"), t("Click “Fill blank and default prompts” to define review requirements for the new Agent."), '[aria-labelledby="prompt-autofill-title"] .secondary-button'), scroll: ['[aria-labelledby="prompt-autofill-title"]'] }
  if (step === 7 && document.querySelector('.run-confirmation-dialog')) return { ...one('confirm-run', t("Confirm execution order"), t("The merge joins the plan and revised design. Click “Run Flow” to execute in order from the inputs."), '.run-confirmation-dialog .flow-run-confirm'), scroll: ['.run-confirmation-dialog'] }
  if (step === 7) {
    const section = '[data-section-key="agent-prompts"]'
    const toggle = `${section} .inspector-section__toggle`
    if (document.querySelector(toggle)?.getAttribute('aria-expanded') === 'false') return { ...one('view-prompts', t("Inspect the generated prompts"), t("Click “Prompts” to inspect the reviewer’s role, input, and output requirements."), toggle), scroll: ['.inspector'] }
    return { ...one('run-flow', t("Review requirements are ready"), t("System defines the role, Input describes the material to review, and Output specifies the format. Review them, then click “Run Flow”."), '[data-tutorial="run-flow"]'), targets: [{ selector: `${section} .inspector-section__body`, kind: 'preview' }, { selector: '[data-tutorial="run-flow"]' }], scroll: ['.inspector'] }
  }
  if (step === 9 && surface === 'document') return { ...one('return-to-flow', t("Statistics files are ready to use"), t("Click the back arrow at the top left to pass these results to the brief Agent."), '.document-header [data-return-flow]'), targets: [{ selector: '.document-reading', kind: 'preview' }, { selector: '.document-header [data-return-flow]' }], scroll: ['.document-body'] }
  if (step === 1 && document.querySelector('.node-library-panel')) {
    const row = document.querySelector('.node-library-item:hover') ?? document.activeElement?.closest('.node-library-item')
    const selector = row ? '.node-library-item:hover, .node-library-item:focus' : '.node-library-item'
    return { ...one('choose-model', t("Choose a review model"), t("Select a model for the review Agent. You can search the list first."), selector), allowed: ['.node-library-item', '.library-search input', '.node-library-group__toggle'], scroll: ['.node-library-items'] }
  }
  if (step === 2 || step === 4 || (step === 9 && surface === 'graph')) {
    const source = step === 2 ? 'writer' : step === 4 ? tutorialReviewerSource(graph) : 'result'
    const target = step === 2 ? 'reviewer' : step === 4 ? 'reviser' : 'delivery'
    const handles: [string, string] = [guideHandle(source, 'source'), guideHandle(target, 'target')]
    return {
      id: `connect-${source}`, title: step === 2 ? t("Connect brief design to review") : step === 4 ? t("Send review feedback to the author") : t("Send statistics to the brief Agent"),
      text: t("Drag from the highlighted dot on the right of “{0}” to the dot on the left of “{1}”, following the arrow.", [graph.nodes[source]?.name ?? source, graph.nodes[target]?.name ?? target]),
      targets: handles.map((selector) => ({ selector, kind: 'point' })), allowed: handles, drag: handles
    }
  }
  if (step === 3 || step === 5) {
    const relation = step === 3 ? 'review' : 'revise'
    const label = step === 3 ? t('Review') : t('Revise')
    const link = graph.links.find((link) => link.targetId === (step === 3 ? 'reviewer' : 'reviser'))
    const trigger = `[data-link-id="${link?.id}"] .menu-select__trigger`
    const option = `.menu-select__option[data-value="${relation}"]`
    const open = document.querySelector(trigger)?.getAttribute('aria-expanded') === 'true'
    return {
      ...one(`relation-${relation}-${open ? 'option' : 'trigger'}`, step === 3 ? t("Set this link to review") : t("Revise from review feedback"), open ? t("Click “{0}”.", [label]) : t("Click the highlighted link-type button and choose “{0}”.", [label]), open ? option : trigger),
      edge: `.react-flow__edge[data-id="${link?.id}"] .react-flow__edge-path`
    }
  }
  if (step === 8) {
    const section = '[data-section-key="output-files"] .inspector-section__toggle'
    if (document.querySelector(section)?.getAttribute('aria-expanded') === 'false') return one('expand-files', t("Inspect statistics files"), t("Click “Files” to expand the local Agent’s output."), section)
    return { ...one('open-findings', t("Read the statistics"), t("Click the open icon beside findings.md to read the report."), '.inspector [data-node-file$="findings.md"] [data-output-open]'), scroll: ['.inspector'] }
  }
  if (step === 11) {
    if (surface === 'document') return { ...one('read-brief', t("Your weekly brief is ready"), t("Read the overall rating, customer feedback, and two actions for next week. Then click the back arrow to open connection settings."), '.document-header [data-return-flow]'), targets: [{ selector: '.document-reading', kind: 'preview' }, { selector: '.document-header [data-return-flow]' }], scroll: ['.document-body'] }
    const toggle = '[data-section-key="agent-output"] .inspector-section__toggle'
    if (document.querySelector(toggle)?.getAttribute('aria-expanded') === 'false') return { ...one('expand-brief', t("View the final brief"), t("Click “Output” to expand the weekly brief."), toggle), scroll: ['.inspector'] }
    return { ...one('open-brief', t("Open the final brief"), t("Click the open icon to read the one-page brief."), '.inspector .output-preview-actions [data-output-open]'), scroll: ['.inspector'] }
  }
  const actions: Record<number, GuideAction> = {
    0: one('generate-flow', t("Start with a description"), t("Click “Generate Flow from description” to turn 8 customer interviews into a one-page weekly brief."), '[data-tutorial="generate-flow"]'),
    1: one('open-models', t("Add a review Agent"), t("Click “Models” to add an independent reviewer to the brief."), '[data-tutorial="models"]'),
    6: one('autofill', t("Autofill the new Agent’s prompts"), t("Click “Autofill prompts” to complete the reviewer’s role and output requirements."), '[data-tutorial="autofill"]'),
    10: one('run-delivery', t("Generate the weekly brief"), t("Click “Run Agent” to write the brief from the connected statistics."), '.agent-primary-actions button:nth-child(2)'),
    12: one('open-settings', t("Start using your own connections"), t("Click “Settings” to add model services or local Agent tools and start your own task."), '.sidebar-settings')
  }
  return actions[step] ?? actions[0]!
}
