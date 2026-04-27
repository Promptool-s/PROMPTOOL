import { useState, useEffect, useCallback, useRef } from 'react'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'

// ── Visual mode definitions ────────────────────────────────────────────────
export const VISUAL_MODES = {
  default: { id: 'default', label: 'Default',   desc: { es: 'Estilo estándar de la app',        en: 'Standard app style' } },
  sakura:  { id: 'sakura',  label: 'Sakura',    desc: { es: 'Estética suave con tonos rosados',  en: 'Soft aesthetic with pink tones' } },
  retro:   { id: 'retro',   label: '8-bit',     desc: { es: 'UI estilo retro arcade',            en: 'Retro arcade-style UI' } },
  hacker:  { id: 'hacker',  label: 'Terminal',  desc: { es: 'Interfaz tipo consola',             en: 'Console-style interface' } },
}

// ── Privacy defaults ───────────────────────────────────────────────────────
const PRIVACY_DEFAULTS = {
  hideFromRanking: false,
  incognitoMode: false,
  noPromptHistory: false,
}

const loadPrivacy = () => {
  try {
    const stored = localStorage.getItem('pt_privacy')
    return stored ? { ...PRIVACY_DEFAULTS, ...JSON.parse(stored) } : { ...PRIVACY_DEFAULTS }
  } catch { return { ...PRIVACY_DEFAULTS } }
}

export const loadVisualMode = () => localStorage.getItem('pt_visual_mode') || 'default'
export const saveVisualMode  = (m) => localStorage.setItem('pt_visual_mode', m)

// ── Sync preferences to Supabase ──────────────────────────────────────────
const syncPrefsToDb = async (userId, prefs) => {
  if (!userId) return
  try {
    await supabase.from('user_preferences').upsert(
      [{ user_id: userId, ...prefs, updated_at: new Date().toISOString() }],
      { onConflict: 'user_id' }
    )
  } catch { /* silent — localStorage is the source of truth */ }
}

// ── Toggle ─────────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, id }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    id={id}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 focus-visible:ring-slate-500 ${
      checked
        ? 'bg-slate-800 dark:bg-slate-300'
        : 'bg-slate-300 dark:bg-slate-600'
    }`}
  >
    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ${
      checked
        ? 'translate-x-4 bg-white dark:bg-slate-900'
        : 'translate-x-0 bg-white dark:bg-slate-400'
    }`} />
  </button>
)

// ── Tab button ─────────────────────────────────────────────────────────────
const TabBtn = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
      active
        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
    }`}
  >
    {label}
  </button>
)

// ── Section label ──────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
    {children}
  </p>
)

// ── Main ConfigModal ───────────────────────────────────────────────────────
const ConfigModal = ({
  open,
  onClose,
  imageId = null,
  // legacy game config props (kept for backward compat)
  mode, difficulty, availableDiffs, onSave, onModeChange, onDifficultyChange,
}) => {
  const { lang } = useLang()
  const { user } = useAuth()
  const syncTimer = useRef(null)

  const [tab, setTab] = useState('privacy')
  const [privacy, setPrivacy] = useState(loadPrivacy)
  const [visualMode, setVisualMode] = useState(loadVisualMode)

  // Report state
  const [reportTarget, setReportTarget] = useState('image')
  const [reportReason, setReportReason] = useState('')
  const [reportStatus, setReportStatus] = useState('idle') // 'idle' | 'sending' | 'sent'

  const es = lang !== 'en'

  // ── Persist privacy: localStorage immediately, DB debounced ──
  useEffect(() => {
    localStorage.setItem('pt_privacy', JSON.stringify(privacy))
    window.dispatchEvent(new CustomEvent('pt:privacy-change', { detail: privacy }))
    // Debounce DB sync 800ms
    clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      syncPrefsToDb(user?.id, {
        hide_from_ranking: privacy.hideFromRanking,
        incognito_mode: privacy.incognitoMode,
        no_prompt_history: privacy.noPromptHistory,
        visual_mode: visualMode,
      })
    }, 800)
    return () => clearTimeout(syncTimer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privacy])

  // ── Persist visual mode ──
  useEffect(() => {
    saveVisualMode(visualMode)
    applyVisualMode(visualMode)
    clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      syncPrefsToDb(user?.id, {
        hide_from_ranking: privacy.hideFromRanking,
        incognito_mode: privacy.incognitoMode,
        no_prompt_history: privacy.noPromptHistory,
        visual_mode: visualMode,
      })
    }, 800)
    return () => clearTimeout(syncTimer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualMode])

  // ── Load prefs from DB on open (if user is logged in) ──
  useEffect(() => {
    if (!open || !user?.id) return
    supabase
      .from('user_preferences')
      .select('hide_from_ranking, incognito_mode, no_prompt_history, visual_mode')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const p = {
          hideFromRanking: data.hide_from_ranking ?? false,
          incognitoMode:   data.incognito_mode   ?? false,
          noPromptHistory: data.no_prompt_history ?? false,
        }
        setPrivacy(p)
        localStorage.setItem('pt_privacy', JSON.stringify(p))
        if (data.visual_mode) {
          setVisualMode(data.visual_mode)
          saveVisualMode(data.visual_mode)
          applyVisualMode(data.visual_mode)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id])

  // Reset report on tab change
  useEffect(() => {
    setReportStatus('idle')
    setReportReason('')
  }, [tab])

  const handlePrivacyToggle = useCallback((key) => {
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleSendReport = async () => {
    if (!reportReason) return
    setReportStatus('sending')
    try {
      const { error } = await supabase.from('user_reports').insert([{
        reporter_id: user?.id || null,
        target_type: reportTarget,
        target_id: reportTarget === 'image' ? (imageId || null) : null,
        reason: reportReason,
      }])
      if (error) throw error
    } catch {
      // Fallback to localStorage
      const pending = JSON.parse(localStorage.getItem('pt_pending_reports') || '[]')
      pending.push({ reporter_id: user?.id || null, target_type: reportTarget, target_id: imageId || null, reason: reportReason, ts: Date.now() })
      localStorage.setItem('pt_pending_reports', JSON.stringify(pending))
    }
    setReportStatus('sent')
    setTimeout(() => { setReportStatus('idle'); setReportReason('') }, 3000)
  }

  if (!open) return null

  const imageReasons = es
    ? [
        { id: 'inappropriate', label: 'Contenido inapropiado' },
        { id: 'incoherent',    label: 'Incoherente con el prompt' },
        { id: 'visual_bug',    label: 'Bug visual' },
      ]
    : [
        { id: 'inappropriate', label: 'Inappropriate content' },
        { id: 'incoherent',    label: 'Incoherent with prompt' },
        { id: 'visual_bug',    label: 'Visual bug' },
      ]

  const promptReasons = es
    ? [
        { id: 'bad_eval',  label: 'Evaluación incorrecta' },
        { id: 'ambiguous', label: 'Prompt ambiguo' },
      ]
    : [
        { id: 'bad_eval',  label: 'Incorrect evaluation' },
        { id: 'ambiguous', label: 'Ambiguous prompt' },
      ]

  const reasons = reportTarget === 'image' ? imageReasons : promptReasons

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#111318] rounded-t-2xl sm:rounded-2xl shadow-2xl dark:shadow-black/80 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[82vh] border-0 sm:border border-slate-200 dark:border-slate-700/80">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {es ? 'Panel de control' : 'Control panel'}
            </p>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-tight">
              {es ? 'Configuración' : 'Settings'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition"
            aria-label="Close"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0 overflow-x-auto bg-white dark:bg-[#111318]">
          <TabBtn active={tab === 'privacy'} onClick={() => setTab('privacy')} label={es ? 'Privacidad' : 'Privacy'} />
          <TabBtn active={tab === 'report'}  onClick={() => setTab('report')}  label={es ? 'Reportar' : 'Report'} />
          <TabBtn active={tab === 'visual'}  onClick={() => setTab('visual')}  label={es ? 'Visual' : 'Visual'} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 bg-slate-50 dark:bg-[#0d0f14]">

          {/* ── PRIVACY ── */}
          {tab === 'privacy' && (
            <div className="space-y-4">
              <SectionLabel>{es ? 'Visibilidad y datos' : 'Visibility & data'}</SectionLabel>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                {/* Hide from ranking */}
                <div className="flex items-start justify-between gap-4 bg-white dark:bg-slate-800/70 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
                      {es ? 'Ocultar del ranking' : 'Hide from ranking'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {es
                        ? 'Tu username no aparece en el leaderboard público'
                        : "Your username won't appear on the public leaderboard"}
                    </p>
                  </div>
                  <Toggle id="toggle-ranking" checked={privacy.hideFromRanking} onChange={() => handlePrivacyToggle('hideFromRanking')} />
                </div>

                {/* Incognito */}
                <div className="flex items-start justify-between gap-4 bg-white dark:bg-slate-800/70 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
                        {es ? 'Modo incógnito' : 'Incognito mode'}
                      </p>
                      {privacy.incognitoMode && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700/60 px-1.5 py-0.5 rounded-md">
                          <span className="h-1 w-1 rounded-full bg-amber-500 animate-pulse inline-block" />
                          {es ? 'Activo' : 'On'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {es
                        ? 'No se guarda actividad ni progreso mientras esté activo'
                        : 'No activity or progress is saved while active'}
                    </p>
                  </div>
                  <Toggle id="toggle-incognito" checked={privacy.incognitoMode} onChange={() => handlePrivacyToggle('incognitoMode')} />
                </div>

                {/* No history */}
                <div className="flex items-start justify-between gap-4 bg-white dark:bg-slate-800/70 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
                      {es ? 'No guardar historial' : "Don't save history"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {es
                        ? 'Tus prompts no quedan registrados en tu perfil'
                        : "Your prompts won't be stored in your profile"}
                    </p>
                  </div>
                  <Toggle id="toggle-history" checked={privacy.noPromptHistory} onChange={() => handlePrivacyToggle('noPromptHistory')} />
                </div>
              </div>

              {/* Sync note */}
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>
                  {user
                    ? (es ? 'Sincronizado con tu cuenta' : 'Synced with your account')
                    : (es ? 'Guardado localmente — iniciá sesión para sincronizar' : 'Saved locally — sign in to sync')}
                </span>
              </div>
            </div>
          )}

          {/* ── REPORT ── */}
          {tab === 'report' && (
            <div className="space-y-4">
              <SectionLabel>{es ? 'Tipo de reporte' : 'Report type'}</SectionLabel>

              {/* Target */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'image',  label: es ? 'Imagen' : 'Image' },
                  { id: 'prompt', label: 'Prompt' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setReportTarget(opt.id); setReportReason('') }}
                    className={`rounded-lg border py-2.5 text-sm font-medium transition ${
                      reportTarget === opt.id
                        ? 'border-slate-800 dark:border-slate-300 bg-slate-800 dark:bg-slate-300 text-white dark:text-slate-900'
                        : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 bg-white dark:bg-slate-800/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Reasons */}
              <div>
                <SectionLabel>{es ? 'Motivo' : 'Reason'}</SectionLabel>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                  {reasons.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReportReason(r.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition ${
                        reportReason === r.id
                          ? 'bg-slate-800 dark:bg-slate-300 text-white dark:text-slate-900'
                          : 'bg-white dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        reportReason === r.id ? 'bg-white dark:bg-slate-900' : 'bg-slate-300 dark:bg-slate-500'
                      }`} />
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Send */}
              {reportStatus === 'sent' ? (
                <div className="flex items-center gap-2.5 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 px-4 py-3">
                  <svg className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {es ? 'Reporte enviado. Gracias.' : 'Report sent. Thank you.'}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!reportReason || reportStatus === 'sending'}
                  onClick={handleSendReport}
                  className="w-full rounded-xl bg-slate-800 dark:bg-slate-200 hover:bg-slate-900 dark:hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-white dark:text-slate-900 font-semibold py-3 text-sm transition flex items-center justify-center gap-2"
                >
                  {reportStatus === 'sending' ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                  {reportStatus === 'sending'
                    ? (es ? 'Enviando...' : 'Sending...')
                    : (es ? 'Enviar reporte' : 'Send report')}
                </button>
              )}
            </div>
          )}

          {/* ── VISUAL ── */}
          {tab === 'visual' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>{es ? 'Modo visual' : 'Visual mode'}</SectionLabel>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/50 px-2 py-0.5 rounded-md">
                  Beta
                </span>
              </div>

              {/* Mode list */}
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                {Object.values(VISUAL_MODES).map(vm => {
                  const active = visualMode === vm.id
                  return (
                    <button
                      key={vm.id}
                      type="button"
                      onClick={() => setVisualMode(vm.id)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition ${
                        active
                          ? 'bg-slate-800 dark:bg-slate-300'
                          : 'bg-white dark:bg-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-semibold leading-snug ${active ? 'text-white dark:text-slate-900' : 'text-slate-800 dark:text-slate-100'}`}>
                          {vm.label}
                        </p>
                        <p className={`text-xs mt-0.5 leading-relaxed ${active ? 'text-slate-400 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
                          {vm.desc[lang] || vm.desc.es}
                        </p>
                      </div>
                      {active && (
                        <svg className="h-4 w-4 text-white dark:text-slate-900 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                {es
                  ? 'Los modos visuales son experimentales. Algunos elementos pueden no adaptarse completamente.'
                  : 'Visual modes are experimental. Some elements may not fully adapt.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Visual mode applier ────────────────────────────────────────────────────
export function applyVisualMode(mode) {
  const root = document.documentElement
  root.classList.remove('mode-sakura', 'mode-retro', 'mode-hacker')
  if (mode && mode !== 'default') root.classList.add(`mode-${mode}`)
}

export default ConfigModal
