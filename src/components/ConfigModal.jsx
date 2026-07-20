import { useState, useEffect, useCallback, useRef } from 'react'
import { useLang } from '../contexts/LangContext'
import { api } from '../lib/apiClient'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'

// ── Visual mode definitions ────────────────────────────────────────────────
export const VISUAL_MODES = {
  default: { id: 'default', label: 'Default',  desc: { es: 'Estilo estándar de la app',       en: 'Standard app style' } },
  sakura:  { id: 'sakura',  label: 'Sakura',   desc: { es: 'Estética suave con tonos rosados', en: 'Soft aesthetic with pink tones' } },
  retro:   { id: 'retro',   label: '8-bit',    desc: { es: 'UI estilo retro arcade',           en: 'Retro arcade-style UI' } },
  hacker:  { id: 'hacker',  label: 'Terminal', desc: { es: 'Interfaz tipo consola',            en: 'Console-style interface' } },
}

// ── Privacy defaults ───────────────────────────────────────────────────────
const PRIVACY_DEFAULTS = { hideFromRanking: false, incognitoMode: false, noPromptHistory: false }
const loadPrivacy = () => {
  try {
    const s = localStorage.getItem('pt_privacy')
    return s ? { ...PRIVACY_DEFAULTS, ...JSON.parse(s) } : { ...PRIVACY_DEFAULTS }
  } catch { return { ...PRIVACY_DEFAULTS } }
}

// ── General defaults ───────────────────────────────────────────────────────
const GENERAL_DEFAULTS = {
  soundEnabled: true,
  animationsEnabled: true,
  compactMode: false,
  showEloOnProfile: true,
  autoRevealAfterMax: false,
}
const loadGeneral = () => {
  try {
    const s = localStorage.getItem('pt_general')
    return s ? { ...GENERAL_DEFAULTS, ...JSON.parse(s) } : { ...GENERAL_DEFAULTS }
  } catch { return { ...GENERAL_DEFAULTS } }
}

export const loadVisualMode = () => localStorage.getItem('pt_visual_mode') || 'default'
export const saveVisualMode  = (m) => localStorage.setItem('pt_visual_mode', m)

// ── Sync al backend (antes: upsert directo a user_preferences) ───────────────
const syncPrefsToDb = async (userId, prefs) => {
  if (!userId) return
  try {
    await api.put('/usuarios/me/preferencias', prefs)
  } catch { /* localStorage is source of truth */ }
}

// ── Toggle ─────────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, id, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    id={id}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      width: 48,
      height: 28,
      borderRadius: 999,
      border: 'none',
      padding: 3,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'background-color 0.2s',
      backgroundColor: checked ? '#1e293b' : '#cbd5e1',
      flexShrink: 0,
      minWidth: 48,
    }}
  >
    <span style={{
      display: 'block',
      width: 22,
      height: 22,
      borderRadius: '50%',
      backgroundColor: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      transition: 'transform 0.2s',
      transform: checked ? 'translateX(20px)' : 'translateX(0px)',
    }} />
  </button>
)

// ── Tab button ─────────────────────────────────────────────────────────────
const TabBtn = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
      active
        ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-slate-700 dark:hover:text-slate-200'
    }`}
  >
    {icon}
    {label}
  </button>
)

// ── Section label ──────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
    {children}
  </p>
)

// ── Setting row ────────────────────────────────────────────────────────────
const SettingRow = ({ title, desc, children, badge }) => (
  <div className="flex items-start justify-between gap-4 bg-white dark:bg-slate-800/70 px-4 py-3.5">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">{title}</p>
        {badge}
      </div>
      {desc && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{desc}</p>}
    </div>
    <div className="shrink-0 pt-0.5">{children}</div>
  </div>
)

// ── Icons ──────────────────────────────────────────────────────────────────
const IcoGeneral  = () => <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
const IcoPrivacy  = () => <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
const IcoVisual   = () => <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
const IcoReport   = () => <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>

// ── Main ConfigModal ───────────────────────────────────────────────────────
const ConfigModal = ({
  open, onClose, imageId = null,
  mode, difficulty, availableDiffs, onSave, onModeChange, onDifficultyChange,
}) => {
  const { lang, changeLang } = useLang()
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const syncTimer = useRef(null)

  const [tab, setTab]           = useState('general')
  const [privacy, setPrivacy]   = useState(loadPrivacy)
  const [general, setGeneral]   = useState(loadGeneral)
  const [visualMode, setVisualMode] = useState(loadVisualMode)

  // Report state
  const [reportTarget, setReportTarget] = useState('image')
  const [reportReason, setReportReason] = useState('')
  const [reportStatus, setReportStatus] = useState('idle')

  const es = lang !== 'en'

  // ── Persist general settings ──
  useEffect(() => {
    localStorage.setItem('pt_general', JSON.stringify(general))
    window.dispatchEvent(new CustomEvent('pt:general-change', { detail: general }))
    // Apply compact mode
    document.documentElement.classList.toggle('mode-compact', !!general.compactMode)
    // Apply animations
    document.documentElement.classList.toggle('reduce-motion', !general.animationsEnabled)
  }, [general])

  // ── Persist privacy ──
  useEffect(() => {
    localStorage.setItem('pt_privacy', JSON.stringify(privacy))
    window.dispatchEvent(new CustomEvent('pt:privacy-change', { detail: privacy }))
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

  // ── Load prefs from DB on open ──
  useEffect(() => {
    if (!open || !user?.id) return
    api.get('/usuarios/me/preferencias')
      .then((data) => {
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
      .catch(() => { /* sin prefs guardadas o error transitorio */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id])

  // Reset report on tab change
  useEffect(() => { setReportStatus('idle'); setReportReason('') }, [tab])

  const handlePrivacyToggle  = useCallback((key) => setPrivacy(p => ({ ...p, [key]: !p[key] })), [])
  const handleGeneralToggle  = useCallback((key) => setGeneral(p => ({ ...p, [key]: !p[key] })), [])

  const handleSendReport = async () => {
    if (!reportReason) return
    setReportStatus('sending')
    try {
      await api.post('/reportes', {
        target_type: reportTarget,
        target_id: reportTarget === 'image' ? (imageId || null) : null,
        reason: reportReason,
      })
    } catch {
      const pending = JSON.parse(localStorage.getItem('pt_pending_reports') || '[]')
      pending.push({ reporter_id: user?.id || null, target_type: reportTarget, target_id: imageId || null, reason: reportReason, ts: Date.now() })
      localStorage.setItem('pt_pending_reports', JSON.stringify(pending))
    }
    setReportStatus('sent')
    setTimeout(() => { setReportStatus('idle'); setReportReason('') }, 3000)
  }

  if (!open) return null

  const imageReasons = es
    ? [{ id: 'inappropriate', label: 'Contenido inapropiado' }, { id: 'incoherent', label: 'Incoherente con el prompt' }, { id: 'visual_bug', label: 'Bug visual' }]
    : [{ id: 'inappropriate', label: 'Inappropriate content' }, { id: 'incoherent', label: 'Incoherent with prompt' }, { id: 'visual_bug', label: 'Visual bug' }]
  const promptReasons = es
    ? [{ id: 'bad_eval', label: 'Evaluación incorrecta' }, { id: 'ambiguous', label: 'Prompt ambiguo' }]
    : [{ id: 'bad_eval', label: 'Incorrect evaluation' }, { id: 'ambiguous', label: 'Ambiguous prompt' }]
  const reasons = reportTarget === 'image' ? imageReasons : promptReasons

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#111318] rounded-t-2xl sm:rounded-2xl shadow-2xl dark:shadow-black/80 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh] border-0 sm:border border-slate-200 dark:border-slate-700/80">

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
            type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
            aria-label="Close"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0 overflow-x-auto bg-white dark:bg-[#111318]">
          <TabBtn active={tab === 'general'} onClick={() => setTab('general')} icon={<IcoGeneral />} label={es ? 'General' : 'General'} />
          <TabBtn active={tab === 'privacy'} onClick={() => setTab('privacy')} icon={<IcoPrivacy />} label={es ? 'Privacidad' : 'Privacy'} />
          <TabBtn active={tab === 'visual'}  onClick={() => setTab('visual')}  icon={<IcoVisual />}  label={es ? 'Visual' : 'Visual'} />
          <TabBtn active={tab === 'report'}  onClick={() => setTab('report')}  icon={<IcoReport />}  label={es ? 'Reportar' : 'Report'} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 bg-slate-50 dark:bg-[#0d0f14]">

          {/* ── GENERAL ── */}
          {tab === 'general' && (
            <div className="space-y-5">

              {/* Apariencia */}
              <div>
                <SectionLabel>{es ? 'Apariencia' : 'Appearance'}</SectionLabel>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                  {/* Dark mode */}
                  <SettingRow
                    title={es ? 'Modo oscuro' : 'Dark mode'}
                    desc={es ? 'Cambia entre tema claro y oscuro' : 'Switch between light and dark theme'}
                  >
                    <Toggle
                      id="toggle-dark"
                      checked={theme === 'dark'}
                      onChange={(v) => setTheme(v ? 'dark' : 'light')}
                    />
                  </SettingRow>
                  {/* Compact mode */}
                  <SettingRow
                    title={es ? 'Modo compacto' : 'Compact mode'}
                    desc={es ? 'Reduce el espaciado para ver más contenido' : 'Reduces spacing to show more content'}
                  >
                    <Toggle id="toggle-compact" checked={general.compactMode} onChange={() => handleGeneralToggle('compactMode')} />
                  </SettingRow>
                  {/* Animations */}
                  <SettingRow
                    title={es ? 'Animaciones' : 'Animations'}
                    desc={es ? 'Desactivar puede mejorar el rendimiento' : 'Disabling may improve performance'}
                  >
                    <Toggle id="toggle-anim" checked={general.animationsEnabled} onChange={() => handleGeneralToggle('animationsEnabled')} />
                  </SettingRow>
                </div>
              </div>

              {/* Idioma */}
              <div>
                <SectionLabel>{es ? 'Idioma' : 'Language'}</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {[{ code: 'es', label: '🇦🇷 Español' }, { code: 'en', label: '🇺🇸 English' }].map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => changeLang(code)}
                      className={`rounded-xl border py-3 text-sm font-semibold transition ${
                        lang === code
                          ? 'border-transparent bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800/60 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Juego */}
              <div>
                <SectionLabel>{es ? 'Juego' : 'Gameplay'}</SectionLabel>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                  {/* Sonido */}
                  <SettingRow
                    title={es ? 'Sonido' : 'Sound'}
                    desc={es ? 'Efectos de sonido al recibir resultados' : 'Sound effects when receiving results'}
                  >
                    <Toggle id="toggle-sound" checked={general.soundEnabled} onChange={() => handleGeneralToggle('soundEnabled')} />
                  </SettingRow>
                  {/* ELO en perfil */}
                  <SettingRow
                    title={es ? 'Mostrar ELO en perfil' : 'Show ELO on profile'}
                    desc={es ? 'Muestra tu puntuación ELO en tu perfil público' : 'Shows your ELO rating on your public profile'}
                  >
                    <Toggle id="toggle-elo" checked={general.showEloOnProfile} onChange={() => handleGeneralToggle('showEloOnProfile')} />
                  </SettingRow>
                  {/* Auto-reveal */}
                  <SettingRow
                    title={es ? 'Revelar prompt automáticamente' : 'Auto-reveal prompt'}
                    desc={es ? 'Muestra el prompt original al agotar los intentos' : 'Shows the original prompt when attempts run out'}
                  >
                    <Toggle id="toggle-reveal" checked={general.autoRevealAfterMax} onChange={() => handleGeneralToggle('autoRevealAfterMax')} />
                  </SettingRow>
                </div>
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                {es ? 'Los cambios se aplican de inmediato y se guardan localmente.' : 'Changes apply immediately and are saved locally.'}
              </p>
            </div>
          )}

          {/* ── PRIVACY ── */}
          {tab === 'privacy' && (
            <div className="space-y-4">
              <SectionLabel>{es ? 'Visibilidad y datos' : 'Visibility & data'}</SectionLabel>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                <SettingRow
                  title={es ? 'Ocultar del ranking' : 'Hide from ranking'}
                  desc={es ? 'Tu username no aparece en el leaderboard público' : "Your username won't appear on the public leaderboard"}
                >
                  <Toggle id="toggle-ranking" checked={privacy.hideFromRanking} onChange={() => handlePrivacyToggle('hideFromRanking')} />
                </SettingRow>
                <SettingRow
                  title={es ? 'Modo incógnito' : 'Incognito mode'}
                  desc={mode === 'challenge'
                    ? (es ? 'Los desafíos de empresa siempre registran tu actividad' : 'Company challenges always record your activity')
                    : (es ? 'No se actualiza tu puntuación ni aparecés en rankings. Ideal para practicar.' : "Score won't update, you won't appear in rankings. Ideal for practice.")}
                  badge={privacy.incognitoMode && mode !== 'challenge' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700/60 px-1.5 py-0.5 rounded-md">
                      <span className="h-1 w-1 rounded-full bg-amber-500 animate-pulse inline-block" />
                      {es ? 'Activo' : 'On'}
                    </span>
                  )}
                >
                  <Toggle
                    id="toggle-incognito"
                    checked={mode === 'challenge' ? false : privacy.incognitoMode}
                    onChange={mode === 'challenge' ? () => {} : () => handlePrivacyToggle('incognitoMode')}
                    disabled={mode === 'challenge'}
                  />
                </SettingRow>
                <SettingRow
                  title={es ? 'No guardar historial' : "Don't save history"}
                  desc={es ? 'Omite guardar tus prompts en el historial de tu perfil' : "Skips saving your prompts in your profile history"}
                >
                  <Toggle id="toggle-history" checked={privacy.noPromptHistory} onChange={() => handlePrivacyToggle('noPromptHistory')} />
                </SettingRow>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{user ? (es ? 'Sincronizado con tu cuenta' : 'Synced with your account') : (es ? 'Guardado localmente — iniciá sesión para sincronizar' : 'Saved locally — sign in to sync')}</span>
              </div>
            </div>
          )}

          {/* ── VISUAL ── */}
          {tab === 'visual' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>{es ? 'Modo visual' : 'Visual mode'}</SectionLabel>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/50 px-2 py-0.5 rounded-md">Beta</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                {Object.values(VISUAL_MODES).map(vm => {
                  const active = visualMode === vm.id
                  return (
                    <button
                      key={vm.id} type="button" onClick={() => setVisualMode(vm.id)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition ${
                        active ? 'bg-slate-800 dark:bg-white' : 'bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-semibold leading-snug ${active ? 'text-white dark:text-slate-900' : 'text-slate-800 dark:text-slate-100'}`}>{vm.label}</p>
                        <p className={`text-xs mt-0.5 leading-relaxed ${active ? 'text-slate-300 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>{vm.desc[lang] || vm.desc.es}</p>
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
                {es ? 'Los modos visuales son experimentales. Algunos elementos pueden no adaptarse completamente.' : 'Visual modes are experimental. Some elements may not fully adapt.'}
              </p>
            </div>
          )}

          {/* ── REPORT ── */}
          {tab === 'report' && (
            <div className="space-y-4">
              <SectionLabel>{es ? 'Tipo de reporte' : 'Report type'}</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[{ id: 'image', label: es ? 'Imagen' : 'Image' }, { id: 'prompt', label: 'Prompt' }].map(opt => (
                  <button key={opt.id} type="button" onClick={() => { setReportTarget(opt.id); setReportReason('') }}
                    className={`rounded-lg border py-2.5 text-sm font-semibold transition ${
                      reportTarget === opt.id
                        ? 'border-transparent bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                        : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300 bg-white dark:bg-slate-800/60'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
              <div>
                <SectionLabel>{es ? 'Motivo' : 'Reason'}</SectionLabel>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                  {reasons.map(r => (
                    <button key={r.id} type="button" onClick={() => setReportReason(r.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition ${
                        reportReason === r.id
                          ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${reportReason === r.id ? 'bg-white dark:bg-slate-800' : 'bg-slate-300 dark:bg-slate-500'}`} />
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {reportStatus === 'sent' ? (
                <div className="flex items-center gap-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-4 py-3">
                  <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{es ? 'Reporte enviado. Gracias.' : 'Report sent. Thank you.'}</p>
                </div>
              ) : (
                <button type="button" disabled={!reportReason || reportStatus === 'sending'} onClick={handleSendReport}
                  className="w-full rounded-xl bg-slate-800 dark:bg-white hover:bg-slate-900 dark:hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed text-white dark:text-slate-900 font-semibold py-3 text-sm transition flex items-center justify-center gap-2"
                >
                  {reportStatus === 'sending'
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                    : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  }
                  {reportStatus === 'sending' ? (es ? 'Enviando...' : 'Sending...') : (es ? 'Enviar reporte' : 'Send report')}
                </button>
              )}
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
