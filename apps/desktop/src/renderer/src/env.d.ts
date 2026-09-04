/// <reference types="vite/client" />

import type { DesktopWorkspaceApi } from '../../shared/workspace'

declare global {
  interface Window {
    agentflowDesktop?: DesktopWorkspaceApi & {
    platform: string
    versions: {
      electron: string
      chrome: string
    }
    }
  }
}

export {}
