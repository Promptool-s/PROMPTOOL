import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { copy } from './landingCopy'
import { GLASS, FOCUS } from './widgets'

// ── Prompt Quality Lab ─────────────────────────────────────────────────────
// Hero hook: a two-panel split (prompt editor ↑ / AI render ↓) wired to a
// single switch. "Sin PrompTool" shows a vague one-liner and a blurry,
// inconsistent render; "Con PrompTool" expands it into prompt-engineering
// blocks and the render resolves sharp. The point is made visually — no copy.
//
// Both render treatments are always mounted and cross-faded on opacity only,
// so the expensive blur/saturate filter is rasterized once instead of being
// animated per frame.

const AUTOPLAY_MS = 5000
const SCORE = { off: 34, on: 96 }

// Sitting-cat silhouette — the "subject" of the prompt, legible in both
// treatments so the sharpness delta reads as the same image, not two images.
const CAT_BODY = 'M50 93 C29 93 21 80 21 67 C21 55 27 47 33 43 L29 24 L42 35 C47 33 53 33 58 35 L71 24 L67 43 C73 47 79 55 79 67 C79 80 71 93 50 93 Z'
const CAT_TAIL = 'M79 79 C91 78 95 65 88 56'

const Artwork = ({ degraded }) => (
  <div
    className="absolute inset-0"
    style={{
      background: degraded
        ? 'radial-gradient(120% 80% at 30% 20%, rgba(251,146,60,0.30), transparent 55%),' +
          'radial-gradient(100% 90% at 76% 86%, rgba(124,58,237,0.32), transparent 60%),' +
          'linear-gradient(160deg, #141a2e, #23213f 55%, #141a2e)'
        : 'radial-gradient(120% 80% at 28% 18%, rgba(251,146,60,0.55), transparent 55%),' +
          'radial-gradient(100% 90% at 78% 88%, rgba(124,58,237,0.60), transparent 60%),' +
          'linear-gradient(160deg, #080d21, #1e1b4b 55%, #080d21)',
    }}
  >
    {/* Starfield — only the sharp treatment gets it (the blur would eat it) */}
    {!degraded && (
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(1.5px 1.5px at 18% 24%, #fff, transparent),' +
            'radial-gradient(1px 1px at 62% 30%, rgba(255,255,255,0.9), transparent),' +
            'radial-gradient(1.5px 1.5px at 42% 74%, #fff, transparent),' +
            'radial-gradient(1px 1px at 84% 60%, rgba(255,255,255,0.8), transparent),' +
            'radial-gradient(1px 1px at 30% 52%, rgba(255,255,255,0.85), transparent),' +
            'radial-gradient(1.5px 1.5px at 74% 18%, #fff, transparent),' +
            'radial-gradient(1px 1px at 54% 88%, rgba(255,255,255,0.8), transparent)',
        }}
      />
    )}
    {/* Milky Way band */}
    <div
      className="absolute inset-0"
      style={{
        background: degraded
          ? 'linear-gradient(115deg, transparent 40%, rgba(199,210,254,0.10) 50%, transparent 60%)'
          : 'linear-gradient(115deg, transparent 42%, rgba(199,210,254,0.28) 50%, transparent 58%)',
      }}
    />
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id={degraded ? 'catFillOff' : 'catFillOn'} x1="0" y1="0" x2="0.6" y2="1">
          {degraded ? (
            <>
              <stop offset="0%" stopColor="#3b3552" />
              <stop offset="100%" stopColor="#1b1930" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="55%" stopColor="#c2410c" />
              <stop offset="100%" stopColor="#3b1d55" />
            </>
          )}
        </linearGradient>
      </defs>
      <g
        transform="translate(50 78) scale(0.62) translate(-50 -60)"
        fill={`url(#${degraded ? 'catFillOff' : 'catFillOn'})`}
        stroke={degraded ? 'none' : 'rgba(196,181,253,0.85)'}
        strokeWidth={degraded ? 0 : 1.6}
        strokeLinejoin="round"
      >
        <path d={CAT_TAIL} fill="none" stroke={degraded ? '#2a2740' : 'rgba(196,181,253,0.85)'} strokeWidth={degraded ? 5 : 4.5} strokeLinecap="round" />
        <path d={CAT_BODY} />
      </g>
    </svg>
  </div>
)

const PromptQualityLab = ({ lang, animate = true, className = '' }) => {
  const t = copy[lang].heroLab
  const [on, setOn] = useState(false)
  const [live, setLive] = useState(false) // in viewport → autoplay allowed
  const lockedRef = useRef(false) // user took over; stop autoplaying
  const rootRef = useRef(null)
  const editorRef = useRef(null)
  const scoreRef = useRef(null)

  // Autoplay the comparison while visible, until the user interacts.
  useEffect(() => {
    const el = rootRef.current
    if (!el || !animate) return
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [animate])

  useEffect(() => {
    if (!animate || !live || lockedRef.current) return
    const id = setInterval(() => {
      if (lockedRef.current) return
      setOn(v => !v)
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [animate, live])

  // Prompt panel: blocks snap in staggered on "con", the weak line fades on "sin".
  useEffect(() => {
    if (!animate) return
    const scope = editorRef.current
    if (!scope) return
    const ctx = gsap.context(() => {
      if (on) {
        gsap.fromTo('[data-block]',
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.055 }
        )
      } else {
        gsap.fromTo('[data-weak]', { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' })
      }
    }, scope)
    return () => ctx.revert()
  }, [on, animate])

  // Score counter — driven through textContent so React never re-renders here.
  useEffect(() => {
    const el = scoreRef.current
    if (!el) return
    const target = on ? SCORE.on : SCORE.off
    if (!animate) { el.textContent = `${target}%`; return }
    const o = { n: parseInt(el.textContent, 10) || 0 }
    const tween = gsap.to(o, {
      n: target, duration: 0.9, ease: 'power2.out',
      onUpdate: () => { el.textContent = `${Math.round(o.n)}%` },
    })
    return () => tween.kill()
  }, [on, animate])

  const select = (next) => { lockedRef.current = true; setOn(next) }

  return (
    <div ref={rootRef} className={`flex flex-col overflow-hidden rounded-2xl ${GLASS} ${className}`}>

      {/* ── Switch ── */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-900/[0.06] bg-white/60 px-3 py-2.5 sm:px-4">
        <div
          role="group"
          aria-label={t.switchLabel}
          className="relative flex w-full max-w-[19rem] rounded-full bg-slate-900/[0.05] p-1"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm ring-1 ring-slate-900/[0.06] ${
              animate ? 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
            } ${on ? 'translate-x-full' : 'translate-x-0'}`}
          />
          {[t.off, t.on].map((label, i) => {
            const active = (i === 1) === on
            return (
              <button
                key={label}
                type="button"
                onClick={() => select(i === 1)}
                aria-pressed={active}
                className={`relative z-10 flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs ${FOCUS} ${
                  active ? (i === 1 ? 'text-cyan-700' : 'text-slate-700') : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="hidden shrink-0 text-[11px] text-slate-400 xl:block">{t.hint}</p>
      </div>

      {/* ── Panel 1 · the prompt ── */}
      <div ref={editorRef} className="border-b border-slate-900/[0.06] px-4 py-3.5 sm:px-5">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t.editorLabel}</span>
          <span className="h-px flex-1 bg-slate-900/[0.06]" aria-hidden="true" />
          <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${on ? 'bg-cyan-500/10 text-cyan-700' : 'bg-slate-900/[0.05] text-slate-400'}`}>
            {on ? `${t.blocks.length} · blocks` : '1 · line'}
          </span>
        </div>

        {/* No aria-live here on purpose: autoplay would re-announce the whole
            block list every few seconds. The switch's pressed state and the
            render's aria-label carry the meaning instead. */}
        <div className="min-h-[8.25rem] sm:min-h-[9rem]">
          {on ? (
            <ul className="space-y-1.5">
              {t.blocks.map(({ k, v }) => (
                <li key={k} data-block className="flex items-baseline gap-2">
                  <span className="w-[4.75rem] shrink-0 rounded bg-violet-500/10 px-1.5 py-0.5 text-center font-mono text-[9px] font-bold uppercase tracking-wider text-violet-700 sm:w-[5.5rem] sm:text-[10px]">
                    {k}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-[11px] leading-5 text-slate-700 sm:text-xs">{v}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p data-weak className="font-mono text-[13px] leading-6 text-slate-400 sm:text-sm">
              <span className="mr-2 select-none text-slate-300">›</span>
              {t.weakPrompt}
              <span className={`ml-1 inline-block h-3.5 w-[2px] translate-y-[2px] bg-slate-400 ${animate ? 'animate-pulse' : ''}`} aria-hidden="true" />
            </p>
          )}
        </div>
      </div>

      {/* ── Panel 2 · what the AI returns ── */}
      <div className="relative min-h-0 flex-1">
        <div
          role="img"
          aria-label={on ? t.onAlt : t.offAlt}
          className="absolute inset-0 overflow-hidden bg-[#0b1026]"
        >
          {/* Degraded treatment — static blur, cross-faded (never animated) */}
          <div
            aria-hidden={on}
            className={`absolute inset-0 ${animate ? 'transition-opacity duration-700 ease-out' : ''} ${on ? 'opacity-0' : 'opacity-100'}`}
            style={{ filter: 'blur(7px) saturate(0.45) contrast(0.85)', transform: 'scale(1.1)' }}
          >
            <Artwork degraded />
          </div>
          {/* Banding / glitch streaks, degraded state only */}
          <div
            aria-hidden="true"
            className={`absolute inset-0 mix-blend-overlay ${animate ? 'transition-opacity duration-700 ease-out' : ''} ${on ? 'opacity-0' : 'opacity-60'}`}
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 1px, transparent 5px)' }}
          />

          {/* Resolved treatment */}
          <div
            aria-hidden={!on}
            className={`absolute inset-0 ${animate ? 'transition-opacity duration-700 ease-out' : ''} ${on ? 'opacity-100' : 'opacity-0'}`}
          >
            <Artwork />
          </div>

          {/* Vignette keeps the chips readable over both treatments */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(2,6,23,0.72) 0%, transparent 42%, rgba(2,6,23,0.35) 100%)' }}
          />

          {/* Status chip */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-sm">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-amber-400'} ${animate && !on ? 'animate-pulse' : ''}`}
            />
            <span className="text-[10px] font-semibold text-white/90">{on ? t.onStatus : t.offStatus}</span>
          </div>

          {/* Score + attribute chips */}
          <div className="absolute inset-x-3 bottom-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {(on ? t.onTags : t.offTags).map(tag => (
                <span
                  key={tag}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
                    on ? 'bg-cyan-400/20 text-cyan-100' : 'bg-white/10 text-white/55'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="rounded-xl bg-black/40 px-3 py-2 backdrop-blur-md">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{t.scoreLabel}</span>
                <span
                  ref={scoreRef}
                  className={`text-lg font-black tabular-nums ${on ? 'text-emerald-300' : 'text-amber-300'}`}
                >
                  {SCORE.off}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${
                    on ? 'bg-gradient-to-r from-cyan-400 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'
                  } ${animate ? 'transition-[width] duration-[900ms] ease-out' : ''}`}
                  style={{ width: `${on ? SCORE.on : SCORE.off}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromptQualityLab
