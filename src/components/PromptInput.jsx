import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import flameLitGif from '../assets/flame-lit.gif'
import { sanitizePrompt } from '../utils/inputSanitizer'
import { useTypingBehavior } from '../hooks/useTypingBehavior'

const normalizeDifficulty = (difficulty = 'Medium') => difficulty.toLowerCase()

// Read incognito state from localStorage (set by ConfigModal)
const getIncognitoActive = () => {
  try {
    const p = JSON.parse(localStorage.getItem('pt_privacy') || '{}')
    return !!p.incognitoMode
  } catch { return false }
}

const getTimerConfig = (mode = 'random', difficulty = 'Medium', personalizedTime = null) => {
  // Si hay tiempo personalizado, usarlo
  if (personalizedTime && personalizedTime > 0) {
    const normalized = normalizeDifficulty(difficulty)
    const targetWords = normalized === 'easy' ? 12 : normalized === 'hard' ? 24 : 18
    const graceSeconds = Math.round(personalizedTime * 0.25) // 25% del tiempo como gracia
    return { recommendedSeconds: personalizedTime, targetWords, graceSeconds }
  }
  
  // Tiempos por defecto
  const normalized = normalizeDifficulty(difficulty)
  const isDaily = mode === 'daily'
  if (normalized === 'easy') return isDaily
    ? { recommendedSeconds: 120, targetWords: 12, graceSeconds: 30 }
    : { recommendedSeconds: 150, targetWords: 14, graceSeconds: 40 }
  if (normalized === 'hard') return isDaily
    ? { recommendedSeconds: 240, targetWords: 24, graceSeconds: 60 }
    : { recommendedSeconds: 270, targetWords: 28, graceSeconds: 60 }
  // Medium
  return isDaily
    ? { recommendedSeconds: 180, targetWords: 18, graceSeconds: 45 }
    : { recommendedSeconds: 210, targetWords: 20, graceSeconds: 50 }
}

const formatTime = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

const PromptInput = ({ promptUsuario, setPromptUsuario, onSubmit, isLoading, disabled = false, mode, difficulty, onTimingChange, paused = false, isRanked = true, onToggleRanked = null, streak = 0, imageId = null, onDifficultyChange = null, onModeChange = null, onNewRandom = null, availableDiffs = [], personalizedTime = null, onOpenConfig = null, showAnticheatWarning = false, attemptsIndicator = null }) => {
  const { t, lang } = useLang()
  const [startedAt, setStartedAt] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [pausedElapsed, setPausedElapsed] = useState(0)
  const [showShortWarning, setShowShortWarning] = useState(false)
  const [restoredDraft, setRestoredDraft] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [incognitoActive, setIncognitoActive] = useState(getIncognitoActive)
  const timerConfig = useMemo(() => getTimerConfig(mode, difficulty, personalizedTime), [mode, difficulty, personalizedTime])
  const { onTextChange: trackTyping, getReport: getTypingReport, reset: resetTyping } = useTypingBehavior()

  // Listen for privacy changes from ConfigModal
  useEffect(() => {
    const handler = (e) => setIncognitoActive(!!e.detail?.incognitoMode)
    window.addEventListener('pt:privacy-change', handler)
    return () => window.removeEventListener('pt:privacy-change', handler)
  }, [])

  const DRAFT_KEY = `promptdraft_${imageId || 'noimg'}`
  const DRAFT_TTL = 5 * 60 * 1000

  useEffect(() => {
    if (!imageId || promptUsuario.trim()) return
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (!saved) return
      const { text, elapsed, savedAt } = JSON.parse(saved)
      if (savedAt && Date.now() - savedAt > DRAFT_TTL) {
        localStorage.removeItem(DRAFT_KEY)
        return
      }
      if (text?.trim()) {
        setPromptUsuario(text)
        if (elapsed > 0) {
          setPausedElapsed(elapsed)
          setElapsedSeconds(elapsed)
        }
        setRestoredDraft(true)
        setTimeout(() => setRestoredDraft(false), 3000)
      }
    } catch { /* silencioso */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId])

  useEffect(() => {
    if (!imageId || !promptUsuario.trim() || submitted) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: promptUsuario, elapsed: elapsedSeconds, savedAt: Date.now() }))
    } catch { /* silencioso */ }
  }, [promptUsuario, elapsedSeconds, DRAFT_KEY, imageId, submitted])

  const clearDraft = () => {
    setSubmitted(true)
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* silencioso */ }
  }

  useEffect(() => {
    if (!startedAt || paused) return
    const id = window.setInterval(() => {
      setElapsedSeconds(pausedElapsed + Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [startedAt, paused, pausedElapsed])

  useEffect(() => {
    if (!startedAt) return
    if (paused) {
      setPausedElapsed(prev => prev + Math.floor((Date.now() - startedAt) / 1000))
      setStartedAt(null)
    } else {
      setStartedAt(Date.now())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  useEffect(() => {
    if (!promptUsuario.trim()) { setStartedAt(null); setElapsedSeconds(0); setPausedElapsed(0); resetTyping() }
  }, [promptUsuario, resetTyping])

  const estimatedSeconds = timerConfig.recommendedSeconds
  const remainingSeconds = Math.max(0, estimatedSeconds - elapsedSeconds)
  const wordsCount = promptUsuario.trim().split(/\s+/).filter(Boolean).length
  const overtimeSeconds = Math.max(0, elapsedSeconds - estimatedSeconds)
  const penaltyStartSeconds = estimatedSeconds + timerConfig.graceSeconds
  const penaltyOvertimeSeconds = Math.max(0, elapsedSeconds - penaltyStartSeconds)
  const remainingRatio = estimatedSeconds > 0 ? remainingSeconds / estimatedSeconds : 0

  useEffect(() => {
    if (!onTimingChange) return
    onTimingChange({ elapsedSeconds, recommendedSeconds: estimatedSeconds, overtimeSeconds, graceSeconds: timerConfig.graceSeconds, penaltyStartSeconds, penaltyOvertimeSeconds })
  }, [elapsedSeconds, estimatedSeconds, overtimeSeconds, timerConfig.graceSeconds, penaltyStartSeconds, penaltyOvertimeSeconds, onTimingChange])

  const handleAntiPaste = (e) => e.preventDefault()
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && ['c','v','x','Insert'].includes(e.key)) e.preventDefault()
    if (e.shiftKey && e.key === 'Insert') e.preventDefault()
  }

  const timeBadgeClass = overtimeSeconds > 0 ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
    : remainingRatio > 0.66 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
    : remainingRatio > 0.33 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'

  // ── Tech terms detection ──────────────────────────────────────────────────
  const TECH_TERMS = [
    { term: 'bokeh',          label: 'Bokeh' },
    { term: 'cinematic',      label: 'Cinematic' },
    { term: 'volumetric',     label: 'Volumetric lighting' },
    { term: 'depth of field', label: 'Depth of field' },
    { term: '4k',             label: '4K' },
    { term: '8k',             label: '8K' },
    { term: 'hdr',            label: 'HDR' },
    { term: 'photorealistic', label: 'Photorealistic' },
    { term: 'fotoreal',       label: 'Fotorrealista' },
    { term: 'render',         label: 'Render' },
    { term: 'rim light',      label: 'Rim light' },
    { term: 'god rays',       label: 'God rays' },
    { term: 'golden hour',    label: 'Golden hour' },
    { term: 'hora dorada',    label: 'Hora dorada' },
    { term: 'composition',    label: 'Composition' },
    { term: 'composición',    label: 'Composición' },
    { term: 'atmosphere',     label: 'Atmosphere' },
    { term: 'atmósfera',      label: 'Atmósfera' },
    { term: 'dramatic',       label: 'Dramatic' },
    { term: 'ethereal',       label: 'Ethereal' },
    { term: 'detailed',       label: 'Detailed' },
    { term: 'detallado',      label: 'Detallado' },
    { term: 'sharp focus',    label: 'Sharp focus' },
    { term: 'soft light',     label: 'Soft light' },
    { term: 'luz suave',      label: 'Luz suave' },
    { term: 'macro',          label: 'Macro' },
    { term: 'wide angle',     label: 'Wide angle' },
    { term: 'gran angular',   label: 'Gran angular' },
    { term: 'oil painting',   label: 'Oil painting' },
    { term: 'watercolor',     label: 'Watercolor' },
    { term: 'acuarela',       label: 'Acuarela' },
    { term: 'concept art',    label: 'Concept art' },
    { term: 'unreal engine',  label: 'Unreal Engine' },
    { term: 'octane',         label: 'Octane render' },
    { term: 'subsurface',     label: 'Subsurface scattering' },
  ]
  const promptLower = promptUsuario.toLowerCase()
  const techMatched = TECH_TERMS.filter(({ term }) => promptLower.includes(term))
  const techCount = techMatched.length

  // ── Focus analysis ────────────────────────────────────────────────────────
  const SUBJECT_WORDS = [
    'man', 'woman', 'person', 'girl', 'boy', 'child', 'warrior', 'knight', 'wizard',
    'hombre', 'mujer', 'persona', 'chica', 'chico', 'niño', 'niña', 'guerrero', 'mago',
    'cat', 'dog', 'animal', 'creature', 'monster', 'dragon', 'robot', 'alien',
    'gato', 'perro', 'animal', 'criatura', 'monstruo', 'dragón',
    'face', 'portrait', 'figure', 'character', 'hero', 'villain',
    'cara', 'retrato', 'figura', 'personaje', 'héroe',
  ]
  const ENVIRONMENT_WORDS = [
    'forest', 'city', 'mountain', 'ocean', 'desert', 'jungle', 'space', 'sky',
    'bosque', 'ciudad', 'montaña', 'océano', 'desierto', 'selva', 'espacio', 'cielo',
    'street', 'room', 'building', 'landscape', 'background', 'environment', 'scene',
    'calle', 'habitación', 'edificio', 'paisaje', 'fondo', 'ambiente', 'escena',
    'field', 'valley', 'river', 'lake', 'beach', 'cave', 'ruins',
    'campo', 'valle', 'río', 'lago', 'playa', 'cueva', 'ruinas',
  ]
  const VISUAL_WORDS = [
    'light', 'shadow', 'color', 'bright', 'dark', 'glow', 'neon', 'vivid',
    'luz', 'sombra', 'color', 'brillante', 'oscuro', 'brillo', 'neón', 'vívido',
    'style', 'aesthetic', 'mood', 'tone', 'palette', 'texture', 'pattern',
    'estilo', 'estética', 'ambiente', 'tono', 'paleta', 'textura', 'patrón',
    'cinematic', 'dramatic', 'ethereal', 'moody', 'vibrant', 'pastel',
    'cinemático', 'dramático', 'etéreo', 'vibrante',
  ]

  const words = promptUsuario.toLowerCase().split(/\s+/).filter(Boolean)
  const subjectScore = words.filter(w => SUBJECT_WORDS.some(s => w.includes(s))).length
  const envScore = words.filter(w => ENVIRONMENT_WORDS.some(s => w.includes(s))).length
  const visualScore = words.filter(w => VISUAL_WORDS.some(s => w.includes(s))).length + techCount * 0.5

  const getFocusLabel = () => {
    const total = subjectScore + envScore + visualScore
    if (total === 0) return lang === 'en' ? 'No focus yet' : 'Sin foco aún'
    const max = Math.max(subjectScore, envScore, visualScore)
    const isBalanced = max <= total * 0.45
    if (isBalanced) return lang === 'en' ? 'Balanced' : 'Balanceado'
    if (max === subjectScore) return lang === 'en' ? 'Very focused on subject' : 'Muy centrado en sujeto'
    if (max === envScore) return lang === 'en' ? 'Very focused on environment' : 'Muy centrado en entorno'
    return lang === 'en' ? 'Very visual' : 'Muy visual'
  }

  // Target values from timerConfig
  const targetWords = timerConfig.targetWords
  const targetChars = Math.round(targetWords * 6.5) // ~6.5 chars/word average
  const targetTech = normalizeDifficulty(difficulty) === 'easy' ? 2 : normalizeDifficulty(difficulty) === 'hard' ? 5 : 3

  return (
    <form className="space-y-2.5" onSubmit={e => {
      e.preventDefault()
      
      // Sanitize prompt before submission
      const promptResult = sanitizePrompt(promptUsuario)
      if (!promptResult.valid) {
        setShowShortWarning(true)
        return
      }

      if (wordsCount < 5 && !showShortWarning) {
        setShowShortWarning(true)
        return
      }
      
      setShowShortWarning(false)
      clearDraft()
      onSubmit(e, getTypingReport(promptUsuario))
    }}>
      {restoredDraft && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {lang === 'en' ? 'Draft restored' : 'Borrador restaurado'}
        </div>
      )}
      
      <div className="flex items-center justify-between mb-1">
        <label className="block text-lg font-bold text-slate-800 dark:text-slate-200">{t('writePrompt')}</label>
        <div className="flex items-center gap-2">
          {streak >= 2 && (
            <div className="flex items-center gap-0.5">
              <img src={flameLitGif} alt="" className="h-6 w-6 object-contain" />
              <span className="text-base font-black tabular-nums translate-y-px" style={{ color: '#fb923c', letterSpacing: '-0.02em' }}>{streak}</span>
            </div>
          )}
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              title={lang === 'en' ? 'Settings' : 'Configuración'}
              className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Aviso anti-trampa — solo en modo random */}
      {showAnticheatWarning && (
        <div className="flex items-start gap-2.5 rounded-xl border-2 border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/50 px-3.5 py-2.5 shadow-sm">
          <svg className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
            {lang === 'en'
              ? 'Copying, pasting or switching windows will change the image. Write your prompt without leaving this tab.'
              : 'Copiar, pegar o cambiar de ventana cambia la imagen. Escribí tu prompt sin salir de esta pestaña.'}
          </p>
        </div>
      )}
      
      {/* Indicador de pistas - entre el warning y el textarea */}
      {attemptsIndicator}
      
      {/* Incognito banner — standalone, above the textarea */}
      {incognitoActive && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
          <svg className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300 leading-none flex-1">
            {lang === 'en'
              ? "Incognito mode — this attempt won't be saved"
              : 'Modo incógnito — este intento no se guardará'}
          </span>
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition shrink-0"
            >
              {lang === 'en' ? 'Disable' : 'Desactivar'}
            </button>
          )}
        </div>
      )}

      {/* Textarea + stats footer integrados en un solo contenedor */}
      <div className={`rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 transition focus-within:border-slate-400 dark:focus-within:border-slate-600 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <textarea
          value={promptUsuario}
          onChange={(e) => {
            const newValue = e.target.value
            if (newValue.length > 2000) return
            trackTyping(promptUsuario, newValue)
            if (!startedAt && newValue.trim() && !paused) setStartedAt(Date.now())
            setPromptUsuario(newValue)
            if (showShortWarning) setShowShortWarning(false)
          }}
          onCopy={handleAntiPaste} onPaste={handleAntiPaste} onCut={handleAntiPaste}
          onDrop={handleAntiPaste} onKeyDown={handleKeyDown}
          rows="3"
          placeholder={t('promptPlaceholder')}
          disabled={disabled}
          maxLength={2000}
          className="w-full min-h-[100px] resize-none rounded-t-xl bg-transparent px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400"
        />
        {/* Footer de stats — separado por borde superior, mismo ancho que el textarea */}
        <div className="flex items-center gap-4 border-t border-slate-100 dark:border-slate-700/60 px-4 py-2">
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
            {lang === 'en' ? 'Words' : 'Palabras'}{' '}
            <span className="font-semibold text-slate-600 dark:text-slate-300">{wordsCount}</span>
            <span className="text-slate-300 dark:text-slate-600 select-none"> / {targetWords}</span>
          </span>
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
            {lang === 'en' ? 'Chars' : 'Caracteres'}{' '}
            <span className="font-semibold text-slate-600 dark:text-slate-300">{promptUsuario.length}</span>
            <span className="text-slate-300 dark:text-slate-600 select-none"> / {targetChars}</span>
          </span>
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
            {lang === 'en' ? 'Tech terms' : 'Términos técnicos'}{' '}
            <span className="font-semibold text-slate-600 dark:text-slate-300">{techCount}</span>
            <span className="text-slate-300 dark:text-slate-600 select-none"> / {targetTech}</span>
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto">
            {lang === 'en' ? 'Focus' : 'Foco'}{' '}
            <span className="font-semibold text-slate-600 dark:text-slate-300">{getFocusLabel()}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {onModeChange ? (
          <div className="relative group">
            <button
              type="button"
              onClick={onModeChange}
              className="group/btn inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 transition hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <span className="text-slate-400 dark:text-slate-500">{t('mode')}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{mode === 'daily' ? t('daily') : mode === 'challenge' ? (lang === 'en' ? 'Challenge' : 'Desafío') : t('random')}</span>
              <svg className="h-3 w-3 text-slate-400 dark:text-slate-500 group-hover/btn:text-slate-600 dark:group-hover/btn:text-slate-300 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-60">
              <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-xl space-y-1.5">
                {mode === 'daily' ? (
                  <>
                    <p className="font-semibold text-sky-300">{lang === 'en' ? 'Daily mode' : 'Modo diario'}</p>
                    <p className="text-slate-300 leading-relaxed">
                      {lang === 'en'
                        ? 'One image per day, same for all players. You only get one attempt. Compare your score with the community. Resets at midnight.'
                        : 'Una imagen por día, igual para todos los jugadores. Solo tenés un intento. Compará tu score con la comunidad. Se renueva a medianoche.'}
                    </p>
                    <p className="text-slate-400">{lang === 'en' ? 'Click to switch to Random.' : 'Click para cambiar a Aleatorio.'}</p>
                  </>
                ) : mode === 'random' ? (
                  <>
                    <p className="font-semibold text-cyan-300">{lang === 'en' ? 'Random mode' : 'Modo aleatorio'}</p>
                    <p className="text-slate-300 leading-relaxed">
                      {lang === 'en'
                        ? 'A random image from the library. Play as many times as you want and practice at your own pace.'
                        : 'Una imagen aleatoria de la biblioteca. Jugá todas las veces que quieras y practicá a tu ritmo.'}
                    </p>
                    <p className="text-slate-400">{lang === 'en' ? 'Click to switch to Daily.' : 'Click para cambiar a Diario.'}</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-amber-300">{lang === 'en' ? 'Challenge mode' : 'Modo desafío'}</p>
                    <p className="text-slate-300 leading-relaxed">
                      {lang === 'en'
                        ? 'A challenge created by a company or team. Your result may be visible to the challenge creator.'
                        : 'Un desafío creado por una empresa o equipo. Tu resultado puede ser visible para el creador del desafío.'}
                    </p>
                  </>
                )}
              </div>
              <div className="ml-3 h-2 w-2 rotate-45 bg-slate-900 -mt-1" />
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5">
            <span className="text-slate-400 dark:text-slate-500">{t('mode')}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{mode === 'daily' ? t('daily') : mode === 'challenge' ? (lang === 'en' ? 'Challenge' : 'Desafío') : t('random')}</span>
          </span>
        )}

        {onDifficultyChange && availableDiffs.length > 1 ? (
          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                const diffs = availableDiffs
                const current = diffs.findIndex(d => d.toLowerCase() === (difficulty || 'Medium').toLowerCase())
                const next = diffs[(current + 1) % diffs.length]
                onDifficultyChange(next)
              }}
              className="group/btn inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 transition hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <span className="text-slate-400 dark:text-slate-500">{t('difficulty')}</span>
              <span className={`font-semibold transition ${
                normalizeDifficulty(difficulty) === 'easy' ? 'text-emerald-600 dark:text-emerald-500' :
                normalizeDifficulty(difficulty) === 'hard' ? 'text-rose-600 dark:text-rose-500' :
                'text-amber-600 dark:text-amber-500'
              }`}>{difficulty}</span>
              <svg className="h-3 w-3 text-slate-400 dark:text-slate-500 group-hover/btn:text-slate-600 dark:group-hover/btn:text-slate-300 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-60">
              <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-xl space-y-1.5">
                {normalizeDifficulty(difficulty) === 'easy' ? (
                  <>
                    <p className="font-semibold text-emerald-400">{lang === 'en' ? 'Easy' : 'Fácil'}</p>
                    <p className="text-slate-300 leading-relaxed">
                      {lang === 'en'
                        ? 'Simple images with clear subjects. Shorter prompts work well. Pass score: 55%.'
                        : 'Imágenes simples con sujetos claros. Prompts cortos funcionan bien. Score para pasar: 55%.'}
                    </p>
                  </>
                ) : normalizeDifficulty(difficulty) === 'hard' ? (
                  <>
                    <p className="font-semibold text-rose-400">{lang === 'en' ? 'Hard' : 'Difícil'}</p>
                    <p className="text-slate-300 leading-relaxed">
                      {lang === 'en'
                        ? 'Complex images with many details, lighting and style. Requires precise and detailed prompts. Pass score: 82%.'
                        : 'Imágenes complejas con muchos detalles, iluminación y estilo. Requiere prompts precisos y detallados. Score para pasar: 82%.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-amber-400">{lang === 'en' ? 'Medium' : 'Medio'}</p>
                    <p className="text-slate-300 leading-relaxed">
                      {lang === 'en'
                        ? 'Balanced images. Describe the subject, environment and style. Pass score: 70%.'
                        : 'Imágenes balanceadas. Describí el sujeto, ambiente y estilo. Score para pasar: 70%.'}
                    </p>
                  </>
                )}
                <p className="text-slate-400">{lang === 'en' ? 'Click to cycle difficulty.' : 'Click para cambiar dificultad.'}</p>
              </div>
              <div className="ml-3 h-2 w-2 rotate-45 bg-slate-900 -mt-1" />
            </div>
          </div>
        ) : (
          <div className="relative group">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 cursor-default">
              <span className="text-slate-400 dark:text-slate-500">{t('difficulty')}</span>
              <span className={`font-semibold ${
                normalizeDifficulty(difficulty) === 'easy' ? 'text-emerald-600 dark:text-emerald-500' :
                normalizeDifficulty(difficulty) === 'hard' ? 'text-rose-600 dark:text-rose-500' :
                'text-amber-600 dark:text-amber-500'
              }`}>{difficulty}</span>
            </span>
            {mode === 'daily' && (
              <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-60">
                <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-xl space-y-1.5">
                  <p className="font-semibold text-sky-300">{lang === 'en' ? 'Fixed difficulty' : 'Dificultad fija'}</p>
                  <p className="text-slate-300 leading-relaxed">
                    {lang === 'en'
                      ? 'In Daily mode the difficulty is set by the image of the day — you can\'t change it. Switch to Random mode to choose your own difficulty.'
                      : 'En el modo Diario la dificultad la define la imagen del día, no podés cambiarla. Cambiá a modo Aleatorio para elegir la dificultad.'}
                  </p>
                  {normalizeDifficulty(difficulty) === 'easy' && (
                    <p className="text-emerald-400">{lang === 'en' ? 'Today: Easy — pass score 55%.' : 'Hoy: Fácil — score para pasar 55%.'}</p>
                  )}
                  {normalizeDifficulty(difficulty) === 'medium' && (
                    <p className="text-amber-400">{lang === 'en' ? 'Today: Medium — pass score 70%.' : 'Hoy: Medio — score para pasar 70%.'}</p>
                  )}
                  {normalizeDifficulty(difficulty) === 'hard' && (
                    <p className="text-rose-400">{lang === 'en' ? 'Today: Hard — pass score 82%.' : 'Hoy: Difícil — score para pasar 82%.'}</p>
                  )}
                </div>
                <div className="ml-3 h-2 w-2 rotate-45 bg-slate-900 -mt-1" />
              </div>
            )}
          </div>
        )}

        <div className="relative group">
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 cursor-default ${timeBadgeClass}`}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">{formatTime(remainingSeconds)}</span>
          </span>
          <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-64">
            <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-xl space-y-1.5">
              <p className="font-semibold text-sky-300">{lang === 'en' ? 'Recommended time' : 'Tiempo recomendado'}</p>
              <p className="text-slate-300 leading-relaxed">
                {lang === 'en'
                  ? `You have ${formatTime(estimatedSeconds)} to write your prompt. Going over starts a grace period, then a score penalty kicks in.`
                  : `Tenés ${formatTime(estimatedSeconds)} para escribir tu prompt. Si te pasás, hay un período de gracia y luego se aplica una penalización al score.`}
              </p>
              {overtimeSeconds > 0 && penaltyOvertimeSeconds === 0 && (
                <p className="text-amber-400 font-medium">
                  {lang === 'en'
                    ? `Grace period: ${formatTime(timerConfig.graceSeconds - overtimeSeconds)} left before penalty.`
                    : `Período de gracia: ${formatTime(timerConfig.graceSeconds - overtimeSeconds)} antes de penalización.`}
                </p>
              )}
              {penaltyOvertimeSeconds > 0 && (
                <p className="text-rose-400 font-medium">
                  {lang === 'en'
                    ? `Penalty active — ${formatTime(penaltyOvertimeSeconds)} over limit.`
                    : `Penalización activa — ${formatTime(penaltyOvertimeSeconds)} sobre el límite.`}
                </p>
              )}
              <p className="text-slate-400">
                {lang === 'en'
                  ? 'Time adapts to your history as you play more.'
                  : 'El tiempo se adapta a tu historial a medida que jugás más.'}
              </p>
            </div>
            <div className="ml-3 h-2 w-2 rotate-45 bg-slate-900 -mt-1" />
          </div>
        </div>

        {onToggleRanked && (
          <div className="relative group">
            <button
              type="button"
              onClick={() => onToggleRanked(!isRanked)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                isRanked
                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-semibold">
                {isRanked
                  ? (lang === 'en' ? 'Ranked' : 'Rankeado')
                  : (lang === 'en' ? 'Unranked' : 'Sin rankeo')}
              </span>
            </button>
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-56">
              <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-xl space-y-1.5">
                {isRanked ? (
                  <>
                    <p className="font-semibold text-cyan-300">{lang === 'en' ? 'Ranked mode ON' : 'Modo rankeado ACTIVADO'}</p>
                    <p className="text-slate-300 leading-relaxed">
                      {lang === 'en'
                        ? 'This game counts toward your ELO and the leaderboard. You need 5 ranked games to appear in the league.'
                        : 'Esta partida cuenta para tu ELO y la leaderboard. Necesitás 5 partidas rankeadas para aparecer en la liga.'}
                    </p>
                    <p className="text-slate-400">{lang === 'en' ? 'Click to play without affecting your rank.' : 'Click para jugar sin afectar tu ranking.'}</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-slate-400">{lang === 'en' ? 'Unranked mode' : 'Modo sin rankeo'}</p>
                    <p className="text-slate-300 leading-relaxed">
                      {lang === 'en'
                        ? 'This game won\'t affect your ELO or leaderboard position. Good for practicing without pressure.'
                        : 'Esta partida no afecta tu ELO ni tu posición en la liga. Ideal para practicar sin presión.'}
                    </p>
                    <p className="text-slate-400">{lang === 'en' ? 'Click to play ranked.' : 'Click para jugar rankeado.'}</p>
                  </>
                )}
              </div>
              <div className="ml-3 h-2 w-2 rotate-45 bg-slate-900 -mt-1" />
            </div>
          </div>
        )}

        {/* New image button — active in random, locked in daily */}
        {(onNewRandom || mode === 'daily') && (
          <div className="relative group/newimg ml-auto">
            {mode === 'daily' ? (
              /* ── Locked state (daily mode) ── */
              <span
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-1.5 cursor-not-allowed select-none opacity-60"
                aria-disabled="true"
              >
                <span className="font-semibold text-slate-400 dark:text-slate-500 text-xs">
                  {lang === 'en' ? 'New image' : 'Nueva imagen'}
                </span>
                {/* Lock icon */}
                <svg className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
            ) : (
              /* ── Active state (random mode) ── */
              <button
                type="button"
                onClick={onNewRandom}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                  {lang === 'en' ? 'New image' : 'Nueva imagen'}
                </span>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden group-hover/newimg:block z-50 w-64">
              <div className="rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 px-3.5 py-3 text-xs text-white shadow-xl space-y-1.5">
                {mode === 'daily' ? (
                  <>
                    <div className="flex items-center gap-1.5 mb-1">
                      <svg className="h-3 w-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <p className="font-semibold text-slate-200">
                        {lang === 'en' ? 'Locked in Daily mode' : 'Bloqueado en modo Diario'}
                      </p>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      {lang === 'en'
                        ? 'The daily challenge has one fixed image for all players. You only get one opportunity — that\'s what makes it fair.'
                        : 'El desafío diario tiene una imagen fija para todos los jugadores. Solo tenés una oportunidad — eso es lo que lo hace justo.'}
                    </p>
                    <p className="text-slate-500 pt-0.5 border-t border-slate-700">
                      {lang === 'en'
                        ? 'Switch to Random mode to get new images freely.'
                        : 'Cambiá a modo Aleatorio para obtener imágenes nuevas libremente.'}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-300 leading-relaxed">
                    {lang === 'en'
                      ? 'Get a new random image from the library. Your current progress will be lost.'
                      : 'Obtené una nueva imagen aleatoria de la biblioteca. Tu progreso actual se perderá.'}
                  </p>
                )}
              </div>
              <div className="mr-3 h-2 w-2 rotate-45 bg-slate-900 dark:bg-slate-950 border-r border-b border-slate-700 -mt-1 ml-auto" />
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">{t('promptRecommendation')}</p>

      {overtimeSeconds > 0 && penaltyOvertimeSeconds === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          {t('mode') === 'Modo'
            ? `Tiempo superado. ${formatTime(timerConfig.graceSeconds - overtimeSeconds)} antes de penalización.`
            : `Time exceeded. ${formatTime(timerConfig.graceSeconds - overtimeSeconds)} before penalty.`}
        </p>
      )}
      {penaltyOvertimeSeconds > 0 && (
        <p className="text-xs text-rose-600 dark:text-rose-500">
          {t('mode') === 'Modo'
            ? `Penalización activa — ${formatTime(penaltyOvertimeSeconds)} extra.`
            : `Penalty active — ${formatTime(penaltyOvertimeSeconds)} over.`}
        </p>
      )}

      {showShortWarning && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
            {lang === 'en' ? 'Your prompt is very short' : 'Tu prompt es muy corto'}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
            {lang === 'en'
              ? `Only ${wordsCount} word${wordsCount !== 1 ? 's' : ''}. A good prompt usually has 10+ words with visual details, style and lighting. Submit anyway?`
              : `Solo ${wordsCount} palabra${wordsCount !== 1 ? 's' : ''}. Un buen prompt suele tener 10+ palabras con detalles visuales, estilo e iluminación. ¿Enviar igual?`}
          </p>
        </div>
      )}

      <button type="submit" disabled={isLoading || disabled}
        className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: 'rgb(var(--color-accent))' }}
        onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent-2))')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent))')}>
        {isLoading ? t('analyzing') : disabled ? t('noImageAvailable') : t('analyzeWithAI')}
      </button>
    </form>
  )
}

export default PromptInput
