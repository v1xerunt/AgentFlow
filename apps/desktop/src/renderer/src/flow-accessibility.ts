import type { AriaLabelConfig } from '@xyflow/react'
import { t } from '@agentflow/core/localization'

export function flowAccessibilityLabels(): AriaLabelConfig {
  return {
    'node.a11yDescription.default': t('Press Enter or Space to select a node. Use arrow keys to move it. Press Delete to remove it and Escape to cancel.'),
    'node.a11yDescription.keyboardDisabled': t('Select a node with Enter or Space. Press Escape to cancel.'),
    'node.a11yDescription.ariaLiveMessage': ({ x, y }) => t('Node moved to x {0}, y {1}.', [x, y]),
    'edge.a11yDescription.default': t('Press Enter or Space to select a link. Press Delete to remove it and Escape to cancel.'),
    'controls.ariaLabel': t('Flow actions'),
    'controls.zoomIn.ariaLabel': t('Zoom in'),
    'controls.zoomOut.ariaLabel': t('Zoom out'),
    'controls.fitView.ariaLabel': t('Fit view'),
    'controls.interactive.ariaLabel': t('Toggle interactivity'),
    'minimap.ariaLabel': t('Flow overview'),
    'handle.ariaLabel': t('Connection handle')
  }
}
