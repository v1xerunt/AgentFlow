import { numericRequirement } from '@agentflow/core/localization'
import { localizeAppMessage, reasoningLabel } from '@agentflow/core/localization'
import { useLanguage } from './language'
import { t } from '@agentflow/core/localization'
import { useEffect, useId, useState } from 'react'
import { BookmarkPlus, Check, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { effectiveModelParameters, modelParameterIssues, modelParameterProfile, type ModelParameterProfile, type NumericParameterRule } from '@agentflow/core'
import type { AgentParameters } from '@agentflow/schema'
import { MenuSelect } from './MenuSelect'
import { useAgentLibrary } from './AgentLibraryContext'

const labels: Record<string, string> = { get temperature() { return t('Temperature') }, get topP() { return t('Top-P') }, get topK() { return t('Top-K') }, get maxTokens() { return t("Maximum output tokens") }, get reasoningBudget() { return t("Reasoning budget · Tokens") }, get presencePenalty() { return t('Presence penalty') }, get frequencyPenalty() { return t('Frequency penalty') }, get seed() { return t('Seed') } }

interface ParameterEditorProps { provider: string; model: string; parameters?: AgentParameters; disabled?: boolean; customParametersEnabled?: boolean; showReasoning?: boolean; onChange: (value: AgentParameters) => void }

function ReasoningFields({ profile, values, disabled, onChange, onInvalidChange }: { profile: ModelParameterProfile; values: AgentParameters; disabled?: boolean; onChange: (patch: Partial<AgentParameters>) => void; onInvalidChange?: (invalid: boolean) => void }) {
  const language = useLanguage()

  const id = useId()
  const levels = profile.reasoning?.levels ?? []
  const choices = profile.reasoning?.default ? levels : ['default', ...levels]
  const current = values.reasoningLevel ?? profile.reasoning?.default ?? 'default'
  const label = profile.reasoning?.kind === 'toggle' ? t("Reasoning mode") : t("Reasoning effort")
  const displayLevel = (level: string) => level === 'default' ? t("Default") : reasoningLabel(level)
  const budget = profile.numeric.reasoningBudget
  if (!levels.length && !budget) return null
  return <div className="reasoning-fields">{levels.length ? <div className="reasoning-control">
    <label htmlFor={id}><span>{label}</span><strong>{displayLevel(current)}</strong></label>
    <input id={id} aria-label={label} type="range" min={0} max={choices.length - 1} step={1} value={Math.max(0, choices.indexOf(current))} aria-valuetext={current === 'default' ? t("Server default") : displayLevel(current)} disabled={disabled} onChange={(event) => { const next = choices[Number(event.target.value)]; onChange({ reasoningLevel: next === 'default' ? undefined : next, reasoningBudget: undefined }) }} />
    <div className="effort-ticks" aria-hidden="true">{choices.map((level) => <span key={level}>{displayLevel(level)}</span>)}</div>
  </div> : null}{budget ? <div className="parameter-field"><ParameterNumber label={labels.reasoningBudget!} value={values.reasoningBudget} rule={budget} disabled={disabled} placeholder={t("Model default")} onInvalidChange={onInvalidChange} onChange={(reasoningBudget) => onChange({ reasoningBudget })} />{budget.specialValues?.length ? <small>{budget.specialValues.map((value) => value === -1 ? t("-1 for dynamic budget") : t("0 to disable reasoning")).join(' · ')}</small> : null}</div> : null}</div>
}

export function ModelReasoningControl({ provider, model, parameters, disabled, onChange }: Pick<ParameterEditorProps, 'provider' | 'model' | 'parameters' | 'disabled' | 'onChange'>) {
  const language = useLanguage()

  const { defaults } = useAgentLibrary()
  const profile = modelParameterProfile(provider, model)
  const values = effectiveModelParameters(provider, model, parameters, defaults(provider, model))
  return <ReasoningFields profile={profile} values={values} disabled={disabled} onChange={(patch) => onChange({ ...parameters, ...patch })} />
}

export function ModelParametersEditor({ provider, model, parameters, disabled, customParametersEnabled = true, showReasoning = true, onChange }: ParameterEditorProps) {
  const language = useLanguage()

  const { library, defaults, saveDefaults, savePreset, removePreset, ready } = useAgentLibrary()
  const [message, setMessage] = useState('')
  const [presetName, setPresetName] = useState('')
  const [naming, setNaming] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('')
  const [saving, setSaving] = useState(false)
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({})
  const [resetVersion, setResetVersion] = useState(0)
  const hasInvalidDraft = Object.values(invalidFields).some(Boolean)
  const profile = modelParameterProfile(provider, model)
  const values = effectiveModelParameters(provider, model, parameters, defaults(provider, model))
  const issues = modelParameterIssues(provider, model, values)
  const presets = library.parameterPresets.filter((item) => item.providerId === provider && item.model === model)
  const thinking = values.reasoningLevel ? values.reasoningLevel !== 'none' : (values.reasoningBudget ?? 0) !== 0
  useEffect(() => { setMessage(''); setSelectedPreset(''); setNaming(false) }, [provider, model])
  const change = (patch: Partial<AgentParameters>) => { setMessage(''); setSelectedPreset(''); onChange({ ...parameters, ...patch }) }
  const save = async (action: () => Promise<void>, success: string) => {
    setSaving(true)
    try { await action(); setMessage(success); setNaming(false); setPresetName('') }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }
  const replaceParameters = (next: AgentParameters) => { setInvalidFields({}); setResetVersion((value) => value + 1); onChange(next) }
  return <div className="model-parameters">
    <div className="parameter-presets"><MenuSelect ariaLabel={t("Load model parameter preset")} value={selectedPreset} placeholder={t("Load parameter preset")} disabled={disabled || !ready} options={[{ value: 'model-default', label: t("Defaults for this model") }, ...presets.map((item) => ({ value: item.id, label: item.name }))]} onChange={(id) => { if (id === 'model-default') { replaceParameters(effectiveModelParameters(provider, model, {}, defaults(provider, model))); setSelectedPreset(id); setMessage(t("Model defaults applied")); return } const preset = presets.find((item) => item.id === id); if (preset) { replaceParameters(structuredClone(preset.parameters)); setSelectedPreset(id); setMessage(t("Applied “{0}”", [preset.name])) } }} />{presets.some((item) => item.id === selectedPreset) ? <button className="icon-button" type="button" aria-label={t("Delete this parameter preset")} disabled={disabled || saving} onClick={() => void save(async () => { await removePreset(selectedPreset); setSelectedPreset('') }, t("Parameter preset deleted"))}><Trash2 size={14} /></button> : null}</div>
    {showReasoning ? <ReasoningFields profile={profile} values={values} disabled={disabled} onChange={change} onInvalidChange={(invalid) => setInvalidFields((current) => ({ ...current, reasoningBudget: invalid }))} /> : null}
    <div className="parameter-grid">{Object.entries(profile.numeric).filter(([key]) => key !== 'reasoningBudget').map(([key, rule]) => {
      const inactive = profile.samplingOnlyWithoutThinking && thinking && ['temperature', 'topP', 'topK', 'presencePenalty', 'frequencyPenalty'].includes(key)
      const raw = values[key as keyof AgentParameters]
      return <div key={key + resetVersion} className={`parameter-field ${key === 'maxTokens' || key === 'reasoningBudget' ? 'parameter-field--wide' : ''}`}>
        <ParameterNumber label={labels[key] ?? key} value={typeof raw === 'number' ? raw : undefined} rule={rule} disabled={disabled || rule.fixed || inactive} placeholder={rule.default === undefined ? t("Provider default") : undefined} onInvalidChange={(invalid) => setInvalidFields((current) => current[key] === invalid ? current : { ...current, [key]: invalid })} onChange={(value) => change({ [key]: value })} />
        {key === 'maxTokens' ? <small>{t("-1 uses the model setting")}</small> : rule.fixed ? <small>{t("Fixed by provider")}</small> : inactive ? <small>{t("Unused in the current reasoning mode")}</small> : null}
      </div>
    })}</div>
    {profile.verbosity ? <div className="field"><span>{t("Response detail")}</span><MenuSelect ariaLabel={t("Verbosity")} value={values.verbosity} disabled={disabled} options={['low', 'medium', 'high'].map((value) => ({ value, label: reasoningLabel(value) }))} onChange={(verbosity) => change({ verbosity: verbosity as AgentParameters['verbosity'] })} /></div> : null}
    {profile.stopSequences ? <StopSequenceField values={values.stopSequences ?? []} disabled={disabled} onChange={(stopSequences) => change({ stopSequences })} /> : null}
    {customParametersEnabled && provider !== 'subscription:deepseek-web' ? <CustomParametersField key={`custom-${provider}-${model}-${resetVersion}`} value={values.customParameters} disabled={disabled} onInvalidChange={(invalid) => setInvalidFields((current) => current.customParameters === invalid ? current : { ...current, customParameters: invalid })} onChange={(customParameters) => change({ customParameters })} /> : null}
    {profile.note || profile.source ? <p className="field-help">{profile.note ? localizeAppMessage(profile.note) : null}{profile.source ? <> <a href={profile.source} target="_blank" rel="noreferrer">{t("Parameter documentation")}</a></> : null}</p> : null}
    {issues.length ? <p className="parameter-error" role="alert">{issues.join(t('; '))}</p> : null}
    <div className="parameter-actions"><button type="button" className="quiet-button" disabled={disabled || saving || !ready || !!issues.length || hasInvalidDraft} onClick={() => void save(() => saveDefaults(provider, model, values), t("Saved as defaults for this model"))}><Save size={14} />{t("Set as model defaults")}</button><button type="button" className="quiet-button" disabled={disabled || saving || !ready || !!issues.length || hasInvalidDraft} onClick={() => setNaming(!naming)}><BookmarkPlus size={14} />{t("Save as preset")}</button><button type="button" className="quiet-button" disabled={disabled} onClick={() => { replaceParameters(effectiveModelParameters(provider, model)); setSelectedPreset(''); setMessage(t("Initial app parameters restored")) }}><RotateCcw size={13} />{t("Reset")}</button></div>
    {naming ? <form className="preset-name-form" onSubmit={(event) => { event.preventDefault(); if (presetName.trim()) void save(() => savePreset(provider, model, presetName, values), t("Model parameter preset saved")) }}><input aria-label={t("Parameter preset name")} autoFocus placeholder={t("Preset name")} value={presetName} onChange={(event) => setPresetName(event.target.value)} /><button className="secondary-button" type="submit" disabled={!presetName.trim() || saving || hasInvalidDraft || !!issues.length}><Check size={14} />{t("Save preset")}</button></form> : null}
    {message ? <p className="field-help" role="status">{localizeAppMessage(message)}</p> : null}
  </div>
}

function CustomParametersField({ value, disabled, onChange, onInvalidChange }: { value?: Record<string, unknown>; disabled?: boolean; onChange: (value: Record<string, unknown> | undefined) => void; onInvalidChange: (invalid: boolean) => void }) {
  const language = useLanguage()

  const [rows, setRows] = useState(() => Object.entries(value ?? {}).map(([key, item], index) => ({ id: `custom-${index}`, key, value: stringifyCustomValue(item) })))
  const [nextId, setNextId] = useState(rows.length)
  const keys = rows.map((row) => row.key.trim()).filter(Boolean)
  const invalid = keys.length !== rows.length || new Set(keys).size !== keys.length
  useEffect(() => { onInvalidChange(invalid) }, [invalid])
  const commit = (next: typeof rows) => {
    setRows(next)
    const nextKeys = next.map((row) => row.key.trim()).filter(Boolean)
    if (nextKeys.length !== next.length || new Set(nextKeys).size !== nextKeys.length) return
    const parameters = Object.fromEntries(next.map((row) => [row.key.trim(), parseCustomValue(row.value)]))
    onChange(next.length ? parameters : undefined)
  }
  const add = () => {
    const id = `custom-${nextId}`
    setNextId((current) => current + 1)
    setRows((current) => [...current, { id, key: '', value: '' }])
  }
  return <div className="field custom-parameters-field"><div className="custom-parameters-heading"><span>{t("Custom request parameters")}</span><button className="icon-button" type="button" aria-label={t("Add custom request parameter")} title={t("Add parameter")} disabled={disabled} onClick={add}><Plus size={14} /></button></div>{rows.length ? <div className="custom-parameter-list">{rows.map((row, index) => <div className="custom-parameter-row" key={row.id}><input aria-label={t("Parameter {0} name", [index + 1])} disabled={disabled} placeholder={t("Parameter name")} value={row.key} onChange={(event) => commit(rows.map((candidate) => candidate.id === row.id ? { ...candidate, key: event.target.value } : candidate))} /><input aria-label={t("Parameter {0} value", [index + 1])} disabled={disabled} placeholder={t("Value")} value={row.value} onChange={(event) => commit(rows.map((candidate) => candidate.id === row.id ? { ...candidate, value: event.target.value } : candidate))} /><button className="icon-button" type="button" aria-label={t("Delete parameter {0}", [row.key || index + 1])} disabled={disabled} onClick={() => commit(rows.filter((candidate) => candidate.id !== row.id))}><X size={13} /></button></div>)}</div> : null}{invalid ? <small className="parameter-error" role="alert">{t("Parameter names must be nonempty and unique.")}</small> : null}</div>
}

function stringifyCustomValue(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function parseCustomValue(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return Number(trimmed)
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { return JSON.parse(trimmed) as unknown } catch { return value }
  }
  return value
}

function ParameterNumber({ label, value, rule, disabled, placeholder, onChange, onInvalidChange }: { label: string; value?: number; rule: NumericParameterRule; disabled?: boolean; placeholder?: string; onChange: (value: number | undefined) => void; onInvalidChange?: (invalid: boolean) => void }) {
  const language = useLanguage()

  const [draft, setDraft] = useState(value?.toString() ?? '')
  useEffect(() => setDraft(value?.toString() ?? ''), [value])
  const valid = (number: number) => Number.isFinite(number) && (!rule.integer || Number.isInteger(number)) && (rule.specialValues?.includes(number) || (number >= rule.min && (rule.max === undefined || number <= rule.max)))
  const invalid = !disabled && !!draft && !valid(Number(draft))
  useEffect(() => { onInvalidChange?.(invalid) }, [invalid])
  return <label className="field"><span>{label}</span><input type="number" aria-label={label} aria-invalid={invalid} value={draft} disabled={disabled} placeholder={placeholder} min={Math.min(rule.min, ...(rule.specialValues ?? []))} max={rule.max} step={rule.integer ? 1 : .05} onChange={(event) => {
    const text = event.target.value
    setDraft(text)
    if (text === '') return
    const number = Number(text)
    if (valid(number)) onChange(number)
  }} onBlur={() => { if (!draft.trim()) { onChange(undefined); setDraft(value?.toString() ?? rule.default?.toString() ?? '') } }} />{invalid ? <small className="parameter-error" role="alert">{t('Not saved: enter {0}.', [numericRequirement(rule)])}</small> : null}</label>
}

function StopSequenceField({ values, disabled, onChange }: { values: string[]; disabled?: boolean; onChange: (values: string[]) => void }) {
  const language = useLanguage()

  const serialized = values.join('\n')
  const [draft, setDraft] = useState(serialized)
  useEffect(() => setDraft(serialized), [serialized])
  const tooMany = draft.split('\n').filter(Boolean).length > 4
  return <label className="field"><span>{t("Stop sequences · One per line, up to 4")}</span><textarea aria-label={t("Stop sequences")} rows={2} value={draft} disabled={disabled} onChange={(event) => { const text = event.target.value; setDraft(text); const lines = text.split('\n').filter(Boolean); if (lines.length <= 4) onChange(lines) }} />{tooMany ? <small role="alert" className="parameter-error">{t("Not saved: up to 4 stop sequences are allowed.")}</small> : null}</label>
}
