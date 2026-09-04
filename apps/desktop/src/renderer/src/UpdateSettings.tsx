import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { t } from '@agentflow/core/localization'
import type { UpdateState } from '../../shared/updates'

export function UpdateSettings() {
  const [state, setState] = useState<UpdateState>()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const api = window.agentflowDesktop
  useEffect(() => {
    if (!api?.getUpdateState) return
    let active = true, received = false
    const off = api.onUpdateState(next => { received = true; if (active) setState(next) })
    void api.getUpdateState().then(next => { if (active && !received) setState(next) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false; off() }
  }, [api])
  const action = async (run: () => Promise<unknown>) => { setFailed(false); try { await run() } catch { setFailed(true) } }
  const busy = state?.phase === 'checking' || state?.phase === 'downloading'
  return <section className="settings-group settings-group--first" aria-label={t('App updates')}>
    <div className="settings-group-heading settings-group-heading--stacked"><div className="settings-group-heading-copy"><h2>{t('App updates')}</h2></div><p>{t('Get new versions from the official GitHub release.')}</p></div>
    {state ? <>
      <p className="field-help">{t('Current version: {0}', [state.currentVersion])}</p>
      <div className="update-status" role="status" aria-live="polite">
        {state.phase === 'idle' ? t('Ready to check for updates.') :
          state.phase === 'checking' ? t('Checking for updates…') :
          state.phase === 'current' ? t('You are using the latest version.') :
          state.phase === 'available' ? t('Version {0} is available.', [state.latestVersion ?? '']) :
          state.phase === 'downloading' ? t('Downloading update… {0}%', [Math.round(state.progress ?? 0)]) :
          state.phase === 'downloaded' ? t('Version {0} is ready. It will install when you quit.', [state.latestVersion ?? '']) :
          state.error === 'no-release' ? t('No published update is available yet. Try again later.') : t('Could not check or download the update. Check your connection and try again.')}
      </div>
      {state.phase === 'downloading' ? <progress aria-label={t('Update download progress')} max={100} value={state.progress ?? 0} style={{ width: '100%', accentColor: '#357456' }} /> : null}
      {state.limitation ? <p className="field-help">{state.limitation === 'development' ? t('Update checks are available in the installed desktop app.') : state.limitation === 'unsigned-mac' ? t('This macOS build requires a manual update. Download the new version from Releases.') : t('Update this Linux package using your package installer, or use the AppImage for automatic updates.')}</p> : null}
      <label className="update-option"><input type="checkbox" checked={state.preferences.autoCheck} disabled={saving || !state.canCheck} onChange={event => {
        const value = event.target.checked; setSaving(true)
        void action(async () => setState(await api!.setUpdatePreferences({ ...state.preferences, autoCheck: value }))).finally(() => setSaving(false))
      }} /><span>{t('Automatically check for updates')}<small>{t('Check once after startup.')}</small></span></label>
      <label className="update-option"><input type="checkbox" checked={state.preferences.autoDownload} disabled={saving || !state.canInstall} onChange={event => {
        const value = event.target.checked; setSaving(true)
        void action(async () => setState(await api!.setUpdatePreferences({ ...state.preferences, autoDownload: value }))).finally(() => setSaving(false))
      }} /><span>{t('Automatically download updates')}<small>{t('Downloaded updates install on exit, after your work is saved.')}</small></span></label>
      <div className="update-actions">
        <button type="button" disabled={busy || !state.canCheck || state.phase === 'downloaded'} onClick={() => void action(() => api!.checkForUpdates())}><RefreshCw size={14} className={state.phase === 'checking' ? 'spin' : undefined}/>{t('Check for updates')}</button>
        {state.canInstall && state.latestVersion && ['available', 'error'].includes(state.phase) ? <button type="button" onClick={() => void action(() => api!.downloadUpdate())}><Download size={14}/>{t('Download update')}</button> : null}
        {state.phase === 'downloaded' ? <button type="button" onClick={() => void action(() => api!.installUpdate())}>{t('Quit and install update')}</button> : null}
        <button type="button" onClick={() => void action(() => api!.openUpdateRelease())}>{t('View releases')}</button>
      </div>
    </> : <p className="field-help">{t('Update checks are available in the installed desktop app.')}</p>}
    {failed ? <p role="alert" className="parameter-error">{t('Could not complete the update action. Try again.')}</p> : null}
  </section>
}
