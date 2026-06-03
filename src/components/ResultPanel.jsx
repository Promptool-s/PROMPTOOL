import { useEffect, useState } from 'react'
import GUIDE_LIBRARY from '../data/guides'
import { useLang } from '../contexts/LangContext'

const ScoreCircle = ({ value }) => {
  const [animatedValue, setAnimatedValue] = useState(0)
  const normalizedValue = Math.min(100, Math.max(0, animatedValue ?? 0))
  const circumference = 2 * Math.PI * 44
  const dashOffset = circumference * (1 - normalizedValue / 100)
  const strokeColor = normalizedValue >= 60 ? '#16a34a' : '#ef4444'

  useEffect(() => {
    setAnimatedValue(0)
    const id = window.requestAnimationFrame(() => setAnimatedValue(value ?? 0))
    return () => window.cancelAnimationFrame(id)
  }, [value])

  return (
    <div className="relative inline-flex h-[90px] w-[90px] sm:h-[120px] sm:w-[120px] items-center justify-center group/score">
      <svg className="h-full w-full" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="44" className="fill-transparent stroke-slate-200 dark:stroke-slate-700" strokeWidth="12" />
        <circle cx="60" cy="60" r="44" className="fill-transparent" strokeWidth="12" strokeLinecap="round"
          stroke={strokeColor} strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1.1s ease-out, stroke 0.3s ease' }}
          transform="rotate(-90 60 60)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100">{normalizedValue}%</span>
        <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-500 dark:text-slate-400">Score</span>
      </div>
      
      {/* Tooltip hover — solo desktop */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden sm:group-hover/score:block z-[100] w-48">
        <div className="rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-2 text-xs shadow-xl border border-slate-700 dark:border-slate-600">
          <p className="font-semibold text-slate-100 mb-1">Score de similitud</p>
          <p className="text-slate-300 dark:text-slate-400 leading-relaxed">
            Mide qué tan parecido es tu prompt al original.
          </p>
        </div>
        <div className="mx-auto w-2 h-2 rotate-45 bg-slate-800 dark:bg-slate-700 border-r border-b border-slate-700 dark:border-slate-600 -mt-1" />
      </div>
    </div>
  )
}

const getDifficultyConfig = (difficulty = 'Medium') => {
  switch (difficulty) {
    case 'Hard': return { minPassScore: 82, label: 'Hard' }
    case 'Easy': return { minPassScore: 55, label: 'Easy' }
    default:     return { minPassScore: 70, label: 'Medium' }
  }
}

const ResultPanel = ({ scorePercent, explanation, suggestions, difficulty, strengths = [], improvements = [], recommendedGuideIds = [], onRetry, onReset, onNewRandom, onRevealPrompt, mode, eloDelta = null, aiCheatDetected = null, user = null, onOpenAuth = null, isGuestLastAttempt = false, guestDemoPrompt = undefined }) => {
  const { t, lang } = useLang()
  const [sharing, setSharing] = useState(false)
  const [showDemoPrompt, setShowDemoPrompt] = useState(false)
  const safeScore = Math.max(0, Math.min(100, Number(scorePercent) || 0))
  const difficultyConfig = getDifficultyConfig(difficulty)
  const isPass = safeScore >= difficultyConfig.minPassScore
  const isMastered = safeScore >= 93
  const recommendedGuides = GUIDE_LIBRARY.filter(g => recommendedGuideIds?.includes(g.id))

  // Filtrar strengths que no tienen sentido con scores muy bajos
  const filteredStrengths = safeScore < 20 ? [] : strengths

  const handleShare = async () => {
    setSharing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 420
      const ctx = canvas.getContext('2d')

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 800, 420)
      grad.addColorStop(0, '#0f172a')
      grad.addColorStop(1, '#1e1b4b')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 800, 420)

      // Subtle grid pattern
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 1
      for (let x = 0; x < 800; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 420); ctx.stroke() }
      for (let y = 0; y < 420; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke() }

      // Score circle
      const cx = 200, cy = 210, r = 110
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 16
      ctx.stroke()

      const scoreColor = safeScore >= 70 ? '#10b981' : safeScore >= 50 ? '#f59e0b' : '#ef4444'
      const angle = (safeScore / 100) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, angle)
      ctx.strokeStyle = scoreColor
      ctx.lineWidth = 16
      ctx.lineCap = 'round'
      ctx.stroke()

      // Score text
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 64px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${safeScore}%`, cx, cy + 12)
      ctx.font = '16px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText('SCORE', cx, cy + 38)

      // Right side content
      const rx = 380
      // Brand
      ctx.font = 'bold 14px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.textAlign = 'left'
      ctx.fillText('PROMPTOOL', rx, 60)

      // Result badge
      const badgeColor = isPass ? '#10b981' : '#ef4444'
      ctx.fillStyle = badgeColor + '33'
      ctx.beginPath()
      ctx.roundRect(rx, 80, isPass ? 140 : 160, 36, 18)
      ctx.fill()
      ctx.fillStyle = badgeColor
      ctx.font = 'bold 14px system-ui, sans-serif'
      ctx.fillText(isPass ? (lang === 'en' ? 'Level Passed' : 'Nivel Superado') : (lang === 'en' ? 'Keep Trying' : 'Sigue intentando'), rx + 14, 104)

      // Difficulty
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      ctx.roundRect(rx, 128, 90, 30, 15)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '13px system-ui, sans-serif'
      ctx.fillText(difficultyConfig.label, rx + 14, 148)

      // Strengths
      if (filteredStrengths.length > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.fillText(lang === 'en' ? 'STRENGTHS' : 'FORTALEZAS', rx, 195)
        filteredStrengths.slice(0, 2).forEach((s, i) => {
          ctx.fillStyle = '#10b981' + '33'
          ctx.beginPath()
          ctx.roundRect(rx, 205 + i * 38, Math.min(s.length * 8 + 24, 360), 30, 15)
          ctx.fill()
          ctx.fillStyle = '#6ee7b7'
          ctx.font = '12px system-ui, sans-serif'
          ctx.fillText(s.length > 38 ? s.substring(0, 38) + '…' : s, rx + 12, 225 + i * 38)
        })
      }

      // Improvements
      if (improvements.length > 0) {
        const iy = filteredStrengths.length > 0 ? 295 : 195
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.fillText(lang === 'en' ? 'TO IMPROVE' : 'A MEJORAR', rx, iy)
        improvements.slice(0, 1).forEach((m, i) => {
          ctx.fillStyle = '#ef4444' + '22'
          ctx.beginPath()
          ctx.roundRect(rx, iy + 10 + i * 38, Math.min(m.length * 8 + 24, 360), 30, 15)
          ctx.fill()
          ctx.fillStyle = '#fca5a5'
          ctx.font = '12px system-ui, sans-serif'
          ctx.fillText(m.length > 38 ? m.substring(0, 38) + '…' : m, rx + 12, iy + 30 + i * 38)
        })
      }

      // Bottom URL
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '13px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('promptool.app', 780, 400)

      // Download
      const link = document.createElement('a')
      link.download = `promptool-score-${safeScore}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      // share/download failed silently
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-2.5 animate-in fade-in duration-300">

      {/* ── Penalización por uso de IA detectado ── */}
      {aiCheatDetected && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              {lang === 'en' ? 'AI-assisted writing detected' : 'Escritura asistida por IA detectada'}
            </p>
          </div>
          <p className="text-xs text-rose-600 dark:text-rose-500 leading-relaxed">
            {lang === 'en'
              ? `Your typing pattern doesn't match natural human writing. A ${aiCheatDetected.penalty}-point penalty was applied to your score.`
              : `Tu patrón de escritura no coincide con escritura humana natural. Se aplicó una penalización de ${aiCheatDetected.penalty} puntos a tu score.`}
          </p>
          {aiCheatDetected.severity === 'high' && (
            <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400">
              {lang === 'en'
                ? 'Repeated detections may result in account restrictions.'
                : 'Detecciones repetidas pueden resultar en restricciones de cuenta.'}
            </p>
          )}
        </div>
      )}

      {/* ── Score + análisis ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
          <div className="shrink-0 flex flex-col items-center gap-2">
            <ScoreCircle value={safeScore} />
            {eloDelta !== null && (
              <div className="relative group/elo-stat">
                <div className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 ${
                  eloDelta >= 0 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800'
                }`}>
                  <div className={`flex items-center justify-center w-5 h-5 rounded ${
                    eloDelta >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-rose-100 dark:bg-rose-900/40'
                  }`}>
                    <span className={`text-xs font-bold ${
                      eloDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {eloDelta >= 0 ? '+' : '-'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold leading-none ${
                      eloDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                    }`}>
                      {eloDelta >= 0 ? '+' : ''}{eloDelta}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                      Rating
                    </span>
                  </div>
                </div>
                
                {/* Tooltip hover — solo desktop */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden sm:group-hover/elo-stat:block z-[100] w-52">
                  <div className="rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-2 text-xs shadow-xl border border-slate-700 dark:border-slate-600">
                    <p className="font-semibold text-slate-100 mb-1">Tu puntuación</p>
                    <p className="text-slate-300 dark:text-slate-400 leading-relaxed">
                      Sube cuando acertás bien y baja si el score es bajo. Empieza en 1000 — más de 1200 es experto.
                    </p>
                  </div>
                  <div className="mx-auto w-2 h-2 rotate-45 bg-slate-800 dark:bg-slate-700 border-r border-b border-slate-700 dark:border-slate-600 -mt-1" />
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 text-center sm:text-left">{t('aiAnalysis')}</p>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 text-center sm:text-left">
              {explanation || t('analysisUnavailable')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Fortalezas + Mejoras + Guías en una sola card ── */}
      {(filteredStrengths.length > 0 || improvements.length > 0 || recommendedGuides.length > 0) && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 space-y-2.5">
          {filteredStrengths.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-1">{t('strengths')}</p>
              <div className="flex flex-wrap gap-1">
                {filteredStrengths.map((s, i) => (
                  <span key={i} className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 capitalize">{s}</span>
                ))}
              </div>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-1">{t('improvements')}</p>
              <div className="flex flex-wrap gap-1">
                {improvements.map((m, i) => (
                  <span key={i} className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 capitalize">{m}</span>
                ))}
              </div>
            </div>
          )}
          {recommendedGuides.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-500 mb-1">{t('learnMore')}</p>
              <div className="flex flex-wrap gap-1">
                {recommendedGuides.map((guide) => (
                  <a key={guide.id} href={`/guides.html#guia-${guide.id}`}
                    className="rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800 px-1.5 py-0.5 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition">
                    {guide.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Acciones ── */}
      <div className="flex flex-col gap-2">

        {/* Cuando vence la imagen (≥93%): opciones especiales */}
        {isMastered && user && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
              <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              {lang === 'en' ? 'Image mastered!' : '¡Imagen dominada!'}
            </p>
          </div>
        )}

        {/* Guest — último intento (4to): registrarse o ver prompt */}
        {isGuestLastAttempt && (
          <div className="rounded-2xl border border-cyan-200 dark:border-cyan-800/60 bg-cyan-50 dark:bg-cyan-950/40 px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-cyan-800 dark:text-cyan-300">
              {lang === 'en' ? 'You used all 4 demo attempts!' : '¡Usaste los 4 intentos de prueba!'}
            </p>
            <p className="text-xs text-cyan-700 dark:text-cyan-400 leading-relaxed">
              {lang === 'en'
                ? 'Create a free account to keep playing with unlimited images, track your progress and compete on the leaderboard.'
                : 'Creá una cuenta gratis para seguir jugando con imágenes ilimitadas, ver tu progreso y competir en el ranking.'}
            </p>
          </div>
        )}

        {/* Prompt revelado de la demo */}
        {isGuestLastAttempt && showDemoPrompt && guestDemoPrompt && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {lang === 'en' ? 'Original prompt' : 'Prompt original'}
            </p>
            <p
              className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-none italic"
              onCopy={e => e.preventDefault()}
              onContextMenu={e => e.preventDefault()}
            >
              "{guestDemoPrompt}"
            </p>
          </div>
        )}

        {/* Banner upsell para guests — compacto en mobile */}
        {!user && !isGuestLastAttempt && (
          <div className="rounded-2xl border border-violet-200 dark:border-violet-800/60 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 px-3 sm:px-4 py-2.5 sm:py-3.5">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                <svg className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" fill="none" viewBox="-3 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-bold text-violet-800 dark:text-violet-200 leading-tight">
                  {lang === 'en' ? 'Create account for unlimited images' : 'Creá cuenta para imágenes ilimitadas'}
                </p>
                <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-1">
                  {(lang === 'en'
                    ? ['Unlimited', 'Stats', 'Leaderboard']
                    : ['Ilimitado', 'Estadísticas', 'Ranking']
                  ).map(f => (
                    <span key={f} className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] text-violet-700 dark:text-violet-300 font-medium">
                      <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {isGuestLastAttempt ? (
            /* Guest en último intento: registrarse o ver prompt */
            <>
              {!showDemoPrompt && (
                <button
                  type="button"
                  onClick={() => setShowDemoPrompt(true)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 transition active:bg-slate-50 dark:active:bg-slate-700 min-h-[44px]"
                >
                  {lang === 'en' ? 'See original prompt' : 'Ver prompt original'}
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition active:opacity-80 min-h-[44px]"
                style={{ backgroundColor: 'rgb(var(--color-accent))' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent-2))'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent))'}
              >
                {lang === 'en' ? 'Create free account' : 'Crear cuenta gratis'}
              </button>
            </>
          ) : !user ? (
            /* Guest con intentos restantes — puede reintentar + CTA nueva imagen */
            <>
              {onRetry && safeScore < 93 && (
                <button type="button" onClick={onRetry}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 transition active:bg-slate-50 dark:active:bg-slate-700 min-h-[44px]">
                  {lang === 'en' ? 'Retry' : 'Reintentar'}
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition active:opacity-80 min-h-[44px]"
                style={{ backgroundColor: 'rgb(var(--color-accent))' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent-2))'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent))'}
              >
                {lang === 'en' ? 'Try another image →' : 'Probar otra imagen →'}
              </button>
            </>
          ) : isMastered ? (
            /* Usuario logueado, venció la imagen */
            <>
              {onRevealPrompt && (
                <button
                  type="button"
                  onClick={onRevealPrompt}
                  className="flex-1 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400 transition active:bg-emerald-50 dark:active:bg-emerald-900/20 min-h-[44px]"
                >
                  {lang === 'en' ? 'See original prompt' : 'Ver prompt original'}
                </button>
              )}
              {(onNewRandom || (onReset && !onNewRandom)) && (
                <button
                  type="button"
                  onClick={onNewRandom || onReset}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition active:opacity-80 min-h-[44px]"
                  style={{ backgroundColor: 'rgb(var(--color-accent))' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent-2))'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent))'}
                >
                  {lang === 'en' ? 'New image' : 'Nueva imagen'}
                </button>
              )}
            </>
          ) : (
            /* Usuario logueado, no venció aún */
            <>
              {onRetry && safeScore < 93 && (
                <button type="button" onClick={onRetry}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 transition active:bg-slate-50 dark:active:bg-slate-700 min-h-[44px]">
                  {lang === 'en' ? 'Retry' : 'Reintentar'}
                </button>
              )}
              {(onNewRandom || (onReset && !onNewRandom)) && (
                <button
                  type="button"
                  onClick={onNewRandom || onReset}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition active:opacity-80 min-h-[44px]"
                  style={{ backgroundColor: 'rgb(var(--color-accent))' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent-2))'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent))'}
                >
                  {onNewRandom
                    ? (lang === 'en' ? 'New image' : 'Nueva imagen')
                    : (lang === 'en' ? 'Play again' : 'Jugar de nuevo')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  )
}

export default ResultPanel
