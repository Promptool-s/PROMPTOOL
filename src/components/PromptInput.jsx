import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import flameLitGif from '../assets/flame-lit.gif'

const normalizeDifficulty = (difficulty = 'Medium') => difficulty.toLowerCase()

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

const PromptInput = ({ promptUsuario, setPromptUsuario, onSubmit, isLoading, disabled = false, mode, difficulty, onTimingChange, paused = false, isRanked = true, onToggleRanked = null, streak = 0, imageId = null, onDifficultyChange = null, onModeChange = null, onNewRandom = null, availableDiffs = [], personalizedTime = null }) => {
  const { t, lang } = useLang()
  const [startedAt, setStartedAt] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [pausedElapsed, setPausedElapsed] = useState(0)
  const [showShortWarning, setShowShortWarning] = useState(false)
  const [restoredDraft, setRestoredDraft] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const timerConfig = useMemo(() => getTimerConfig(mode, difficulty, personalizedTime), [mode, difficulty, personalizedTime])

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
    if (!promptUsuario.trim()) { setStartedAt(null); setElapsedSeconds(0); setPausedElapsed(0) }
  }, [promptUsuario])

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

  return (
    <form className="space-y-2.5" onSubmit={e => {
      if (wordsCount < 5 && !showShortWarning) {
        e.preventDefault()
        setShowShortWarning(true)
        return
      }
      setShowShortWarning(false)
      clearDraft()
      onSubmit(e)
    }}>
      {restoredDraft && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {lang === 'en' ? 'Draft restored' : 'Borrador restaurado'}
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('writePrompt')}</label>
        {streak >= 2 && (
          <div className="flex items-center gap-0.5">
            <img src={flameLitGif} alt="" className="h-6 w-6 object-contain" />
            <span className="text-base font-black tabular-nums translate-y-px" style={{ color: '#fb923c', letterSpacing: '-0.02em' }}>{streak}</span>
          </div>
        )}
      </div>
      
      <div className="relative">
        <textarea
          value={promptUsuario}
          onChange={(e) => {
            if (!startedAt && e.target.value.trim() && !paused) setStartedAt(Date.now())
            setPromptUsuario(e.target.value)
            if (showShortWarning) setShowShortWarning(false)
          }}
          onCopy={handleAntiPaste} onPaste={handleAntiPaste} onCut={handleAntiPaste}
          onDrop={handleAntiPaste} onKeyDown={handleKeyDown}
          rows="3"
          placeholder={t('promptPlaceholder')}
          disabled={disabled}
          className="w-full min-h-[100px] resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-3 pr-12 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition focus:border-slate-400 dark:focus:border-slate-500 focus:ring-0 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400"
        />
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-slate-900/5 dark:bg-slate-100/10 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
          {wordsCount} {lang === 'en' ? 'words' : 'palabras'}
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
                        ? 'One image per day, same for all players. Compare your score with the community. Resets at midnight.'
                        : 'Una imagen por día, igual para todos los jugadores. Compará tu score con la comunidad. Se renueva a medianoche.'}
                    </p>
                    <p className="text-slate-400">{lang === 'en' ? 'Click to switch to Random.' : 'Click para cambiar a Aleatorio.'}</p>
                  </>
                ) : mode === 'random' ? (
                  <>
                    <p className="font-semibold text-violet-300">{lang === 'en' ? 'Random mode' : 'Modo aleatorio'}</p>
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
                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
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
                    <p className="font-semibold text-violet-300">{lang === 'en' ? 'Ranked mode ON' : 'Modo rankeado ACTIVADO'}</p>
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

        {onNewRandom && mode === 'random' && (
          <button
            type="button"
            onClick={onNewRandom}
            title={t('newRandom')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 ml-auto"
          >
            <span className="font-semibold text-slate-700 dark:text-slate-300">{lang === 'en' ? 'New image' : 'Nueva imagen'}</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
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
