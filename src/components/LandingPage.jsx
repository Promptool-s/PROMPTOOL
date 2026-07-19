import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { landingEditorial } from '../data/siteContent'
import { copy, detectLang } from './landing/landingCopy'
import { scrollBus } from './landing/scrollBus'
import CommunitySlideshow from './landing/CommunitySlideshow'
import InteractiveDemo from './landing/InteractiveDemo'
import PromptTypingField from './landing/PromptTypingField'
import { AnimatedStats, StatsChart, OrgIcon, GLASS, FOCUS } from './landing/widgets'

gsap.registerPlugin(ScrollTrigger)

const SECTION_IDS = ['hero', 'how', 'progress', 'community', 'tournaments', 'guides', 'teams', 'profiles', 'start']

// Big outlined section numeral — parallax-scrubbed by ScrollTrigger.
const Numeral = ({ n, side = 'right' }) => (
  <span
    data-numeral
    aria-hidden="true"
    className={`pointer-events-none select-none absolute top-1/2 -translate-y-1/2 font-black leading-none text-transparent text-[30vw] lg:text-[15rem] ${side === 'right' ? 'right-[-4%]' : 'left-[-4%]'}`}
    style={{ WebkitTextStroke: '1.5px rgba(8,145,178,0.15)' }}
  >
    {n}
  </span>
)

const Tag = ({ children }) => (
  <p data-reveal className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-700">{children}</p>
)

// Mock app-window chrome — echoes the floating prompt cards in the background
const WindowCard = ({ label, children, className = '' }) => (
  <div className={`overflow-hidden rounded-2xl ${GLASS} ${className}`}>
    <div className="flex items-center gap-1.5 border-b border-slate-900/[0.06] bg-white/60 px-4 py-2.5">
      <span className="h-2 w-2 rounded-full bg-rose-300" aria-hidden="true" />
      <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden="true" />
      <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
      <span className="ml-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
    </div>
    <div className="p-5 sm:p-6">{children}</div>
  </div>
)

const CheckItem = ({ children, small = false }) => (
  <li data-reveal className={`flex items-start gap-3 leading-relaxed ${small ? 'text-sm' : 'text-base'}`}>
    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-cyan-500/15" aria-hidden="true">
      <svg className="h-3 w-3 text-cyan-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
    <span className="text-slate-600">{children}</span>
  </li>
)

const GUIDE_LEVEL_STYLES = [
  'bg-emerald-500/10 text-emerald-700',
  'bg-amber-500/10 text-amber-700',
  'bg-violet-500/10 text-violet-700',
]

const BTN_PRIMARY = `inline-flex items-center justify-center rounded-lg bg-cyan-500 px-8 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400 active:scale-[0.98] ${FOCUS}`
const BTN_GHOST = `inline-flex items-center justify-center rounded-lg border border-slate-900/15 px-8 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-900/[0.04] active:scale-[0.98] ${FOCUS}`

const LandingPage = ({ onOpenAuth, onTryApp, onEnterprise }) => {
  const [lang] = useState(detectLang)
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [activeSection, setActiveSection] = useState(0)
  const rootRef = useRef(null)
  const sectionRefs = useRef([])
  const lenisRef = useRef(null)
  const c = copy[lang]
  const ed = landingEditorial[lang] || landingEditorial.es

  // The landing owns a light theme; force light so modals opened on top
  // (auth) match, and restore the user's theme on unmount.
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => { if (hadDark) root.classList.add('dark') }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = e => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => { mq.removeEventListener('change', onChange); window.removeEventListener('resize', onResize) }
  }, [])

  // ── Smooth scroll: Lenis synced to the GSAP ticker (single RAF loop). ────
  // With reduced motion we keep native scrolling and only track progress.
  useEffect(() => {
    if (reducedMotion) {
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        scrollBus.progress = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0
      }
      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    })
    lenisRef.current = lenis
    const onScroll = (l) => {
      scrollBus.progress = l.progress || 0
      scrollBus.velocity = l.velocity || 0
      ScrollTrigger.update()
    }
    lenis.on('scroll', onScroll)
    const tick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [reducedMotion])

  // ── ScrollTriggers: active-section tracking, reveals, numeral parallax ───
  useEffect(() => {
    const ctx = gsap.context(() => {
      sectionRefs.current.forEach((el, i) => {
        if (!el) return
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 45%',
          onToggle: (self) => {
            if (self.isActive) {
              scrollBus.section = i
              setActiveSection(i)
            }
          },
        })
        if (!reducedMotion) {
          if (i > 0) {
            const items = el.querySelectorAll('[data-reveal]')
            if (items.length) {
              gsap.fromTo(items,
                { opacity: 0, y: 36 },
                {
                  opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.09,
                  scrollTrigger: { trigger: el, start: 'top 70%', toggleActions: 'play none none reverse' },
                }
              )
            }
          }
          const num = el.querySelector('[data-numeral]')
          if (num) {
            gsap.fromTo(num,
              { yPercent: 16 },
              { yPercent: -16, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } }
            )
          }
        }
      })

      // Hero intro: masked line reveal + staggered fade
      if (!reducedMotion) {
        gsap.fromTo('[data-hero-line]', { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 0.15 })
        gsap.fromTo('[data-hero-fade]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.1, delay: 0.55 })
      }
    }, rootRef)
    return () => ctx.revert()
  }, [reducedMotion])

  const goTo = (id) => {
    const target = document.getElementById(id)
    if (!target) return
    if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.2 })
    else target.scrollIntoView({ block: 'start' })
  }

  const setSectionRef = (i) => (el) => { sectionRefs.current[i] = el }

  return (
    <div ref={rootRef} className="relative min-h-screen bg-[#f8fafc] text-slate-900 antialiased" style={{ overflowX: 'clip' }}>
      <a href="#main-content" className={`sr-only focus:not-sr-only fixed left-4 top-4 z-30 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 ${FOCUS}`}>
        {c.skipToContent}
      </a>

      {/* ── Layer 0a: soft aurora tint over the light base ── */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 50% at 18% 8%, rgba(34,211,238,0.14), transparent 60%),' +
            'radial-gradient(50% 45% at 85% 90%, rgba(124,58,237,0.10), transparent 60%)',
        }}
      />

      {/* ── Layer 0b: floating prompts typing themselves ── */}
      <PromptTypingField lang={lang} animate={!reducedMotion} isMobile={isMobile} />
      <p className="sr-only">{c.sceneDescription}</p>

      {/* ── Section nav rail — desktop only ── */}
      <nav aria-label={lang === 'en' ? 'Page sections' : 'Secciones de la página'} className="fixed right-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2.5 lg:flex">
        {c.sectionLabels.map((label, i) => (
          <div key={i} className="group relative flex items-center justify-end">
            <span className="pointer-events-none absolute right-6 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {label}
            </span>
            <button
              type="button"
              onClick={() => goTo(SECTION_IDS[i])}
              aria-label={label}
              aria-current={i === activeSection ? 'true' : undefined}
              className={`rounded-full transition-all duration-300 ${FOCUS} ${
                i === activeSection ? 'h-6 w-2 bg-cyan-600' : 'h-2 w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          </div>
        ))}
      </nav>

      <main id="main-content" className="relative z-10">

        {/* ── 01 · HERO ── */}
        <section id="hero" ref={setSectionRef(0)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="01" side="left" />
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="space-y-6 lg:space-y-8">
                <div data-hero-fade className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-600/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-600" aria-hidden="true" />
                    {c.badge}
                  </span>
                </div>
                <h1 aria-label={`${c.h1a} ${c.h1b}`} className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-7xl">
                  <span aria-hidden="true" className="block overflow-hidden pb-1"><span data-hero-line className="block">{c.h1a}</span></span>
                  <span aria-hidden="true" className="block overflow-hidden pb-1"><span data-hero-line className="block bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">{c.h1b}</span></span>
                </h1>
                <p data-hero-fade className="max-w-md text-base leading-relaxed text-slate-600 lg:text-lg">{c.sub}</p>
                <div data-hero-fade className="flex flex-wrap gap-3 lg:gap-4">
                  <button type="button" onClick={onTryApp} className={BTN_PRIMARY}>{c.cta1}</button>
                  <button type="button" onClick={onOpenAuth} className={BTN_GHOST}>{c.cta2}</button>
                </div>
                <div data-hero-fade className="flex items-center gap-3 pt-1">
                  <div className="h-px max-w-[4rem] flex-1 bg-slate-900/10" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={onEnterprise}
                    className={`group inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-4 py-1.5 text-xs font-semibold text-slate-500 transition-all hover:border-violet-500/60 hover:bg-violet-500/10 hover:text-violet-700 ${FOCUS}`}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {c.forCompanies}
                    <svg className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="h-px flex-1 bg-slate-900/10" aria-hidden="true" />
                </div>
              </div>
              <div data-hero-fade className={`relative hidden overflow-hidden rounded-2xl p-6 lg:block lg:h-[520px] ${GLASS}`}>
                <div className="relative h-full">
                  <CommunitySlideshow lang={lang} />
                </div>
              </div>
            </div>
            <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 lg:block">
              <button
                type="button"
                onClick={() => goTo('how')}
                aria-label={c.scrollDown}
                className={`group flex h-11 w-11 items-center justify-center rounded-full border border-cyan-600/40 bg-white/70 backdrop-blur-sm transition hover:border-cyan-600 hover:bg-cyan-500/10 ${FOCUS} ${reducedMotion ? '' : 'animate-bounce'}`}
              >
                <svg className="h-5 w-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* ── 02 · HOW IT WORKS ── */}
        <section id="how" ref={setSectionRef(1)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="02" side="right" />
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-8 text-center lg:mb-10">
              <Tag>{c.howTag}</Tag>
              <h2 data-reveal className="mb-3 text-3xl font-bold lg:text-4xl">{c.howTitle}</h2>
              <p data-reveal className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 lg:text-lg">{c.howDesc}</p>
            </div>
            <div data-reveal>
              <InteractiveDemo lang={lang} />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {c.steps.map(({ n, t, d }) => (
                <div key={n} data-reveal className={`rounded-xl p-5 ${GLASS}`}>
                  <p className="mb-2 text-xs font-black tabular-nums text-cyan-700">{n}</p>
                  <p className="mb-1.5 text-sm font-semibold text-slate-900">{t}</p>
                  <p className="text-xs leading-5 text-slate-500">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 03 · PROGRESS — stats dashboard mock in a window panel ── */}
        <section id="progress" ref={setSectionRef(2)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="03" side="left" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <Tag>{c.progressTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold lg:text-4xl">{c.progressTitle}</h2>
              <p data-reveal className="mb-8 text-base leading-relaxed text-slate-600 lg:text-lg">{c.progressDesc}</p>
              <div data-reveal className="flex flex-wrap gap-2">
                {c.statsLabels.map(label => (
                  <span key={label} className="rounded-full border border-slate-900/10 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div data-reveal>
              <WindowCard label={lang === 'en' ? 'your-stats' : 'tus-stats'}>
                <AnimatedStats stats={[
                  { value: '74%', label: c.statsLabels[0], color: 'text-emerald-600', desc: lang === 'en' ? 'Average similarity across all attempts' : 'Similitud promedio en todos los intentos' },
                  { value: '12d', label: c.statsLabels[1], color: 'text-amber-600', desc: lang === 'en' ? 'Consecutive days playing' : 'Días consecutivos jugando' },
                  { value: '96%', label: c.statsLabels[2], color: 'text-cyan-700', desc: lang === 'en' ? 'Your highest score achieved' : 'Tu puntaje más alto logrado' },
                  { value: '#38', label: c.statsLabels[3], color: 'text-sky-600', desc: lang === 'en' ? 'Your position in the global ranking' : 'Tu posición en el ranking global' }
                ]} />
                <div className="mt-5 border-t border-slate-900/[0.06] pt-5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">{c.chartTitle}</p>
                  <p className="mb-5 text-2xl font-bold text-slate-900">{c.chartSub}</p>
                  <StatsChart ariaLabel={`${c.chartTitle} — ${c.chartSub}`} />
                  <p className="mt-4 text-[11px] leading-4 text-slate-500">{c.chartNote}</p>
                </div>
              </WindowCard>
            </div>
          </div>
        </section>

        {/* ── 04 · COMMUNITY — leaderboard rows with score bars ── */}
        <section id="community" ref={setSectionRef(3)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="04" side="right" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <div>
              <Tag>{c.communityTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold lg:text-4xl">{c.communityTitle}</h2>
              <p data-reveal className="mb-6 text-base leading-relaxed text-slate-600 lg:text-lg">{c.communityDesc}</p>
              <ul className="space-y-4">
                {c.communityItems.map(item => (
                  <CheckItem key={item}>{item}</CheckItem>
                ))}
              </ul>
            </div>
            <div data-reveal>
              <WindowCard label="ranking">
                <ol className="space-y-2.5">
                  {[['alex_p', 94, 1420, 1], ['marta_r', 88, 1380, 2], ['juandev', 83, 1310, 3], ['sofia_m', 79, 1270, 4]].map(([name, score, elo, rank]) => (
                    <li key={name} className="flex items-center gap-3.5 rounded-xl border border-slate-900/[0.05] bg-white/60 px-4 py-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums ${
                        rank === 1 ? 'bg-amber-400/20 text-amber-700' : rank === 2 ? 'bg-slate-400/20 text-slate-600' : rank === 3 ? 'bg-orange-400/20 text-orange-700' : 'bg-slate-200/70 text-slate-500'
                      }`}>{rank}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                          <p className="shrink-0 text-xs font-bold tabular-nums text-cyan-700">{score}%</p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-900/[0.06]" aria-hidden="true">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500" style={{ width: `${score}%` }} />
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{elo} ELO</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </WindowCard>
            </div>
          </div>
        </section>

        {/* ── 05 · TOURNAMENTS — event card with gradient ring ── */}
        <section id="tournaments" ref={setSectionRef(4)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="05" side="right" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <div data-reveal className="rounded-2xl bg-gradient-to-br from-cyan-500/50 via-sky-400/25 to-violet-500/50 p-[1.5px] shadow-xl shadow-violet-500/10">
              <div className="space-y-5 rounded-[15px] bg-white/90 p-6 backdrop-blur-md sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700">
                    <span className={`h-1.5 w-1.5 rounded-full bg-cyan-600 ${reducedMotion ? '' : 'animate-pulse'}`} aria-hidden="true" />
                    {c.tourLive}
                  </span>
                  <span className="rounded-full bg-slate-900/[0.04] px-3 py-1 text-xs font-medium text-slate-500">{c.tourEnds}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/15" aria-hidden="true">
                    <OrgIcon type="trophy" />
                  </span>
                  <p className="text-xl font-bold text-slate-900">{c.tourName}</p>
                </div>
                <p className="text-base leading-relaxed text-slate-600">{c.tourCardDesc}</p>
                <div className="flex items-center gap-3 border-t border-slate-900/[0.06] pt-4">
                  <div className="flex -space-x-2">
                    {['A', 'B', 'C', 'D'].map(l => (
                      <div key={l} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-xs font-bold text-cyan-700">{l}</div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">+48 {c.tourParticipants}</span>
                </div>
              </div>
            </div>
            <div>
              <Tag>{c.tourTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold lg:text-4xl">{c.tourTitle}</h2>
              <p data-reveal className="mb-6 text-base leading-relaxed text-slate-600 lg:text-lg">{c.tourDesc}</p>
              <ul className="space-y-4">
                {c.tourItems.map(item => (
                  <CheckItem key={item}>{item}</CheckItem>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── 06 · GUIDES — numbered article rows with level chips ── */}
        <section id="guides" ref={setSectionRef(5)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="06" side="left" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <Tag>{c.guidesTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold">{c.guidesTitle}</h2>
              <p data-reveal className="mb-6 text-base leading-7 text-slate-600">{c.guidesDesc}</p>
              <ul className="mb-6 space-y-3">
                {c.guidesItems.map(item => (
                  <CheckItem key={item} small>{item}</CheckItem>
                ))}
              </ul>
              <a data-reveal href="/guides" className={`inline-flex items-center gap-2 rounded text-sm font-semibold text-cyan-700 transition hover:text-cyan-600 ${FOCUS}`}>
                {c.guidesLink}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </a>
            </div>
            <div className="space-y-3">
              {c.guides.map(({ t, tag, time }, i) => (
                <div key={t} data-reveal className={`group flex items-center gap-4 rounded-xl p-4 transition hover:border-cyan-600/30 hover:bg-white hover:shadow-lg hover:shadow-cyan-500/5 ${GLASS}`}>
                  <span className="w-8 shrink-0 text-center font-mono text-lg font-black tabular-nums text-slate-300 transition-colors group-hover:text-cyan-600" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{t}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${GUIDE_LEVEL_STYLES[i] || GUIDE_LEVEL_STYLES[0]}`}>{tag}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                        </svg>
                        {time}
                      </span>
                    </div>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 07 · ORGANIZATIONS — gradient icon tiles ── */}
        <section id="teams" ref={setSectionRef(6)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="07" side="right" />
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-8 max-w-2xl lg:mb-12">
              <Tag>{c.orgTag}</Tag>
              <h2 data-reveal className="mb-3 text-2xl font-bold lg:text-3xl">{c.orgTitle}</h2>
              <p data-reveal className="text-sm leading-7 text-slate-600 lg:text-base">{c.orgDesc}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {c.orgCards.map(({ icon, t, d }) => (
                <div key={t} data-reveal className={`group h-full rounded-xl p-4 transition duration-300 hover:border-cyan-600/25 hover:bg-white hover:shadow-lg hover:shadow-cyan-500/10 lg:p-6 ${GLASS}`}>
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/15 to-violet-500/15 transition-colors group-hover:from-cyan-500/25 group-hover:to-violet-500/25 lg:h-10 lg:w-10 lg:rounded-xl">
                    <OrgIcon type={icon} />
                  </div>
                  <p className="mb-1.5 text-sm font-semibold text-slate-900 lg:text-base">{t}</p>
                  <p className="text-xs leading-5 text-slate-500 lg:text-sm lg:leading-6">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 08 · PROFILES — profile card with banner + overlapping avatar ── */}
        <section id="profiles" ref={setSectionRef(7)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="08" side="left" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <Tag>{c.profileTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold">{c.profileTitle}</h2>
              <p data-reveal className="mb-6 text-base leading-7 text-slate-600">{c.profileDesc}</p>
              <ul className="space-y-3">
                {c.profileItems.map(item => (
                  <CheckItem key={item} small>{item}</CheckItem>
                ))}
              </ul>
            </div>
            <div data-reveal className={`overflow-hidden rounded-2xl ${GLASS}`}>
              <div className="h-20 bg-gradient-to-r from-cyan-500/25 via-sky-400/15 to-violet-500/25" aria-hidden="true" />
              <div className="px-6 pb-6">
                <div className="-mt-7 mb-4 flex items-end gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-base font-bold text-cyan-700 shadow-md ring-4 ring-white">AP</div>
                  <div className="pb-0.5">
                    <p className="font-bold leading-tight text-slate-900">alex_prompter</p>
                    <p className="text-xs text-slate-500">{c.profileMember}</p>
                  </div>
                </div>
                <div className="mb-5 flex gap-2">
                  {[{ label: '#1', color: 'text-amber-700 bg-amber-500/10' }, { label: '14d', color: 'text-orange-700 bg-orange-500/10' }, { label: 'ELO', color: 'text-cyan-700 bg-cyan-500/10' }].map(({ label, color }) => (
                    <span key={label} className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${color}`}>{label}</span>
                  ))}
                </div>
                <div className="mb-5 grid grid-cols-3 gap-3">
                  {[['1420', 'ELO'], ['81%', lang === 'en' ? 'Avg' : 'Prom.'], ['14d', lang === 'en' ? 'Streak' : 'Racha']].map(([v, l]) => (
                    <div key={l} className="rounded-xl border border-slate-900/[0.06] bg-white/70 p-3 text-center">
                      <p className="text-lg font-black tabular-nums text-cyan-700">{v}</p>
                      <p className="text-[11px] text-slate-500">{l}</p>
                    </div>
                  ))}
                </div>
                <StatsChart ariaLabel={c.chartTitle} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 09 · CTA + EDITORIAL — gradient CTA panel, editorial below ── */}
        <section id="start" ref={setSectionRef(8)} className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="09" side="right" />
          <div className="mx-auto w-full max-w-3xl space-y-8">
            <div data-reveal className="relative overflow-hidden rounded-3xl border border-slate-900/10 bg-white/80 px-6 py-12 text-center shadow-xl shadow-cyan-500/10 backdrop-blur-md sm:px-12 sm:py-14">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(70% 90% at 50% 0%, rgba(34,211,238,0.12), transparent 65%),' +
                    'radial-gradient(50% 60% at 85% 100%, rgba(124,58,237,0.10), transparent 60%)',
                }}
              />
              <div className="relative space-y-5">
                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                  <span className="bg-gradient-to-r from-slate-900 via-cyan-700 to-violet-700 bg-clip-text text-transparent">{c.ctaTitle}</span>
                </h2>
                <p className="mx-auto max-w-md text-base text-slate-600 sm:text-lg">{c.ctaDesc}</p>
                <div className="flex flex-wrap justify-center gap-4 pt-2">
                  <button type="button" onClick={onTryApp} className={BTN_PRIMARY}>{c.ctaPlay}</button>
                  <button type="button" onClick={onOpenAuth} className={BTN_GHOST}>{c.ctaSignup}</button>
                  <button
                    type="button"
                    onClick={onEnterprise}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border border-violet-600/50 px-8 py-3.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-500/10 active:scale-[0.98] ${FOCUS}`}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {c.forTeamsCta}
                  </button>
                </div>
              </div>
            </div>
            <div data-reveal className="rounded-2xl border border-slate-900/[0.07] bg-white/60 p-6 text-left backdrop-blur-sm sm:p-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-700">{ed.tag}</p>
              <h2 className="mb-4 text-xl font-bold text-slate-900 sm:text-2xl">{ed.title}</h2>
              <div className="space-y-3">
                {ed.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-7 text-slate-600 sm:text-base">{p}</p>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-4">
                {ed.links.map(({ href, label }) => (
                  <a key={href} href={href} className={`rounded text-sm font-semibold text-cyan-700 underline underline-offset-2 transition hover:text-cyan-600 ${FOCUS}`}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

export default LandingPage
