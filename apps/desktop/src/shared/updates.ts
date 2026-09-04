export interface UpdatePreferences { autoCheck: boolean; autoDownload: boolean }
export type UpdatePhase = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'error'
export type UpdateLimitation = 'development' | 'unsigned-mac' | 'linux-package' | null
export interface UpdateState {
  currentVersion: string
  latestVersion?: string
  phase: UpdatePhase
  preferences: UpdatePreferences
  canCheck: boolean
  canInstall: boolean
  limitation: UpdateLimitation
  progress?: number
  checkedAt?: string
  error?: 'no-release' | 'network'
}
export interface DesktopUpdatesApi {
  getUpdateState(): Promise<UpdateState>
  setUpdatePreferences(value: UpdatePreferences): Promise<UpdateState>
  checkForUpdates(): Promise<UpdateState>
  downloadUpdate(): Promise<UpdateState>
  installUpdate(): Promise<void>
  openUpdateRelease(): Promise<void>
  onUpdateState(callback: (state: UpdateState) => void): () => void
}
