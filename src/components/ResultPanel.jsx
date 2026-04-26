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
    <div className="relative inline-flex h-[120px] w-[120px] items-center justify-center group/score">
      <svg className="h-full w-full" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="44" className="fill-transparent stroke-slate-200 dark:stroke-slate-700" strokeWidth="12" />
        <circle cx="60" cy="60" r="44" className="fill-transparent" strokeWidth="12" strokeLinecap="round"
          stroke={strokeColor} strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1.1s ease-out, stroke 0.3s ease' }}
          transform="rotate(-90 60 60)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{normalizedValue}%</span>
        <span className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Score</span>
      </div>
      
      {/* Tooltip hover */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/score:block z-[100] w-48">
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

const ResultPanel = ({ scorePercent, explanation, suggestions, difficulty, strengths = [], improvements = [], recommendedGuideIds = [], onRetry, onReset, onNewRandom, mode, eloDelta = null }) => {
  const { t, lang } = useLang()
  const [sharing, setSharing] = useState(false)
  const safeScore = Math.max(0, Math.min(100, Number(scorePercent) || 0))
  const difficultyConfig = getDifficultyConfig(difficulty)
  const isPass = safeScore >= difficultyConfig.minPassScore
  const recommendedGuides = GUIDE_LIBRARY.filter(g => recommendedGuideIds?.includes(g.id))

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
      ctx.fillText(isPass ? (lang === 'en' ? '✓ Level Passed' : '✓ Nivel Superado') : (lang === 'en' ? '✗ Keep Trying' : '✗ Sigue intentando'), rx + 14, 104)

      // Difficulty
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      ctx.roundRect(rx, 128, 90, 30, 15)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '13px system-ui, sans-serif'
      ctx.fillText(difficultyConfig.label, rx + 14, 148)

      // Strengths
      if (strengths.length > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.fillText(lang === 'en' ? 'STRENGTHS' : 'FORTALEZAS', rx, 195)
        strengths.slice(0, 2).forEach((s, i) => {
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
        const iy = strengths.length > 0 ? 295 : 195
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

      {/* ── Score + análisis ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 flex flex-col items-center gap-2">
            <ScoreCircle value={safeScore} />
            {eloDelta !== null && (
              <div className="relative group/elo-stat">
                <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
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
                      {eloDelta >= 0 ? '▲' : '▼'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold leading-none ${
                      eloDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                    }`}>
                      {eloDelta >= 0 ? '+' : ''}{eloDelta}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                      ELO
                    </span>
                  </div>
                </div>
                
                {/* Tooltip hover */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/elo-stat:block z-[100] w-52">
                  <div className="rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-2 text-xs shadow-xl border border-slate-700 dark:border-slate-600">
                    <p className="font-semibold text-slate-100 mb-1">Sistema ELO</p>
                    <p className="text-slate-300 dark:text-slate-400 leading-relaxed">
                      Tu rating cambia según tu desempeño. Scores altos en desafíos difíciles dan más puntos.
                    </p>
                  </div>
                  <div className="mx-auto w-2 h-2 rotate-45 bg-slate-800 dark:bg-slate-700 border-r border-b border-slate-700 dark:border-slate-600 -mt-1" />
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{t('aiAnalysis')}</p>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {explanation || t('analysisUnavailable')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Fortalezas + Mejoras + Guías en una sola card ── */}
      {(strengths.length > 0 || improvements.length > 0 || recommendedGuides.length > 0) && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 space-y-2.5">
          {strengths.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-1">{t('strengths')}</p>
              <div className="flex flex-wrap gap-1">
                {strengths.map((s, i) => (
                  <span key={i} className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">{s}</span>
                ))}
              </div>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-1">{t('improvements')}</p>
              <div className="flex flex-wrap gap-1">
                {improvements.map((m, i) => (
                  <span key={i} className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">{m}</span>
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
      <div className="flex gap-2">
        {onRetry && !isPass && (
          <button type="button" onClick={onRetry}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700">
            {lang === 'en' ? 'Retry' : 'Reintentar'}
          </button>
        )}
        {(onNewRandom || (onReset && !onNewRandom)) && (
          <button
            type="button"
            onClick={onNewRandom || onReset}
            className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-white transition"
            style={{ backgroundColor: 'rgb(var(--color-accent))' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent-2))'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent))'}
          >
            {onNewRandom
              ? (lang === 'en' ? 'New image' : 'Nueva imagen')
              : (lang === 'en' ? 'Play again' : 'Jugar de nuevo')}
          </button>
        )}
      </div>

    </div>
  )
}

export default ResultPanel
