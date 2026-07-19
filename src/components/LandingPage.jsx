import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { landingEditorial } from '../data/siteContent'
import { copy, detectLang } from './landing/landingCopy'
import { scrollBus } from './landing/scrollBus'
import CommunitySlideshow from './landing/CommunitySlideshow'
import InteractiveDemo from './landing/InteractiveDemo'
import { AnimatedStats, StatsChart, OrgIcon, GLASS, FOCUS } from './landing/widgets'

gsap.registerPlugin(ScrollTrigger)

// The three.js scene is code-split so the HTML content paints first
const LandingScene = lazy(() => import('./landing/LandingScene'))

const SECTION_IDS = ['hero', 'how', 'progress', 'community', 'tournaments', 'guides', 'teams', 'profiles', 'start']

const supportsWebGL = () => {
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch (_) {
    return false
  }
}

// Big outlined section numeral — HTML layer of the hybrid composition,
// parallax-scrubbed by ScrollTrigger over the WebGL panel behind it.
const Numeral = ({ n, side = 'right' }) => (
  <span
    data-numeral
    aria-hidden="true"
    className={`pointer-events-none select-none absolute top-1/2 -translate-y-1/2 font-black leading-none text-transparent text-[30vw] lg:text-[15rem] ${side === 'right' ? 'right-[-4%]' : 'left-[-4%]'}`}
    style={{ WebkitTextStroke: '1.5px rgba(103,232,249,0.14)' }}
  >
    {n}
  </span>
)

const Tag = ({ children }) => (
  <p data-reveal className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">{children}</p>
)

const Bullet = ({ children, small = false }) => (
  <li className={`flex items-center gap-3 leading-relaxed ${small ? 'text-sm' : 'text-base'}`}>
    <span className={`rounded-full bg-cyan-400 shrink-0 ${small ? 'h-1.5 w-1.5' : 'h-2 w-2'}`} aria-hidden="true" />
    <span className="text-slate-300">{children}</span>
  </li>
)

const BTN_PRIMARY = `inline-flex items-center justify-center rounded-lg bg-cyan-500 px-8 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 active:scale-[0.98] ${FOCUS}`
const BTN_GHOST = `inline-flex items-center justify-center rounded-lg border border-white/15 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5 active:scale-[0.98] ${FOCUS}`

const LandingPage = ({ onOpenAuth, onTryApp, onEnterprise }) => {
  const [lang] = useState(detectLang)
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [webglOk] = useState(() => typeof window !== 'undefined' && supportsWebGL())
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [activeSection, setActiveSection] = useState(0)
  const rootRef = useRef(null)
  const sectionRefs = useRef([])
  const lenisRef = useRef(null)
  const c = copy[lang]
  const ed = landingEditorial[lang] || landingEditorial.es

  // The landing owns a dark immersive theme; force the dark class so modals
  // opened on top (auth) match, and restore the user's theme on unmount.
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.add('dark')
    return () => { if (!hadDark) root.classList.remove('dark') }
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
    <div ref={rootRef} className="relative min-h-screen bg-[#020617] text-slate-100 antialiased" style={{ overflowX: 'clip' }}>
      <a href="#main-content" className={`sr-only focus:not-sr-only fixed left-4 top-4 z-30 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 ${FOCUS}`}>
        {c.skipToContent}
      </a>

      {/* ── Layer 0a: CSS aurora — always on, doubles as the no-WebGL fallback ── */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 50% at 18% 8%, rgba(34,211,238,0.09), transparent 60%),' +
            'radial-gradient(50% 45% at 85% 90%, rgba(124,58,237,0.10), transparent 60%)',
        }}
      />

      {/* ── Layer 0b: WebGL article corridor ── */}
      {webglOk && (
        <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none">
          <Suspense fallback={null}>
            <LandingScene animated={!reducedMotion} isMobile={isMobile} />
          </Suspense>
        </div>
      )}
      <p className="sr-only">{c.sceneDescription}</p>

      {/* ── Section nav rail — desktop only ── */}
      <nav aria-label={lang === 'en' ? 'Page sections' : 'Secciones de la página'} className="fixed right-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2.5 lg:flex">
        {c.sectionLabels.map((label, i) => (
          <div key={i} className="group relative flex items-center justify-end">
            <span className="pointer-events-none absolute right-6 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {label}
            </span>
            <button
              type="button"
              onClick={() => goTo(SECTION_IDS[i])}
              aria-label={label}
              aria-current={i === activeSection ? 'true' : undefined}
              className={`rounded-full transition-all duration-300 ${FOCUS} ${
                i === activeSection ? 'h-6 w-2 bg-cyan-400' : 'h-2 w-2 bg-slate-600 hover:bg-slate-400'
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
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" aria-hidden="true" />
                    {c.badge}
                  </span>
                </div>
                <h1 aria-label={`${c.h1a} ${c.h1b}`} className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-7xl">
                  <span aria-hidden="true" className="block overflow-hidden pb-1"><span data-hero-line className="block">{c.h1a}</span></span>
                  <span aria-hidden="true" className="block overflow-hidden pb-1"><span data-hero-line className="block bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">{c.h1b}</span></span>
                </h1>
                <p data-hero-fade className="max-w-md text-base leading-relaxed text-slate-300 lg:text-lg">{c.sub}</p>
                <div data-hero-fade className="flex flex-wrap gap-3 lg:gap-4">
                  <button type="button" onClick={onTryApp} className={BTN_PRIMARY}>{c.cta1}</button>
                  <button type="button" onClick={onOpenAuth} className={BTN_GHOST}>{c.cta2}</button>
                </div>
                <div data-hero-fade className="flex items-center gap-3 pt-1">
                  <div className="h-px max-w-[4rem] flex-1 bg-white/10" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={onEnterprise}
                    className={`group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-semibold text-slate-400 transition-all hover:border-violet-400/50 hover:bg-violet-500/10 hover:text-violet-300 ${FOCUS}`}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {c.forCompanies}
                    <svg className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="h-px flex-1 bg-white/10" aria-hidden="true" />
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
                className={`group flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/40 bg-white/[0.04] backdrop-blur-sm transition hover:border-cyan-400 hover:bg-cyan-500/20 ${FOCUS} ${reducedMotion ? '' : 'animate-bounce'}`}
              >
                <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
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
              <p data-reveal className="mx-auto max-w-2xl text-base leading-relaxed text-slate-300 lg:text-lg">{c.howDesc}</p>
            </div>
            <div data-reveal>
              <InteractiveDemo lang={lang} />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {c.steps.map(({ n, t, d }) => (
                <div key={n} data-reveal className={`rounded-xl p-5 ${GLASS}`}>
                  <p className="mb-2 text-xs font-black tabular-nums text-cyan-400">{n}</p>
                  <p className="mb-1.5 text-sm font-semibold text-white">{t}</p>
                  <p className="text-xs leading-5 text-slate-400">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 03 · PROGRESS ── */}
        <section id="progress" ref={setSectionRef(2)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="03" side="left" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <div>
              <Tag>{c.progressTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold lg:text-4xl">{c.progressTitle}</h2>
              <p data-reveal className="mb-6 text-base leading-relaxed text-slate-300 lg:text-lg">{c.progressDesc}</p>
              <div data-reveal>
                <AnimatedStats stats={[
                  { value: '74%', label: c.statsLabels[0], color: 'text-emerald-400', desc: lang === 'en' ? 'Average similarity across all attempts' : 'Similitud promedio en todos los intentos' },
                  { value: '12d', label: c.statsLabels[1], color: 'text-amber-400', desc: lang === 'en' ? 'Consecutive days playing' : 'Días consecutivos jugando' },
                  { value: '96%', label: c.statsLabels[2], color: 'text-cyan-400', desc: lang === 'en' ? 'Your highest score achieved' : 'Tu puntaje más alto logrado' },
                  { value: '#38', label: c.statsLabels[3], color: 'text-sky-400', desc: lang === 'en' ? 'Your position in the global ranking' : 'Tu posición en el ranking global' }
                ]} />
              </div>
            </div>
            <div data-reveal className={`rounded-2xl p-8 ${GLASS}`}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{c.chartTitle}</p>
              <p className="mb-6 text-3xl font-bold">{c.chartSub}</p>
              <StatsChart ariaLabel={`${c.chartTitle} — ${c.chartSub}`} />
              <p className="mt-4 text-[11px] leading-4 text-slate-500">{c.chartNote}</p>
            </div>
          </div>
        </section>

        {/* ── 04 · COMMUNITY ── */}
        <section id="community" ref={setSectionRef(3)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="04" side="right" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <div>
              <Tag>{c.communityTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold lg:text-4xl">{c.communityTitle}</h2>
              <p data-reveal className="mb-6 text-base leading-relaxed text-slate-300 lg:text-lg">{c.communityDesc}</p>
              <ul className="space-y-4">
                {c.communityItems.map(item => (
                  <li key={item} data-reveal className="flex items-center gap-3 text-base leading-relaxed">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-400" aria-hidden="true" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[['alex_p', '94%', 1420, 1], ['marta_r', '88%', 1380, 2], ['juandev', '83%', 1310, 3], ['sofia_m', '79%', 1270, 4]].map(([name, score, elo, rank]) => (
                <div key={name} data-reveal className={`flex items-center gap-3 rounded-xl p-5 ${GLASS}`}>
                  <span className={`text-lg font-black tabular-nums ${rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-slate-500'}`}>#{rank}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{name}</p>
                    <p className="text-xs leading-relaxed text-slate-400 tabular-nums">{score} · {elo} ELO</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 05 · TOURNAMENTS ── */}
        <section id="tournaments" ref={setSectionRef(4)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="05" side="right" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <div data-reveal className={`space-y-5 rounded-2xl p-8 ${GLASS}`}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-400">
                  <span className={`h-1.5 w-1.5 rounded-full bg-cyan-400 ${reducedMotion ? '' : 'animate-pulse'}`} aria-hidden="true" />
                  {c.tourLive}
                </span>
                <span className="text-xs text-slate-400">{c.tourEnds}</span>
              </div>
              <p className="text-xl font-bold text-white">{c.tourName}</p>
              <p className="text-base leading-relaxed text-slate-300">{c.tourCardDesc}</p>
              <div className="flex items-center gap-3 pt-2">
                <div className="flex -space-x-2">
                  {['A', 'B', 'C', 'D'].map(l => (
                    <div key={l} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-cyan-500/15 text-xs font-bold text-cyan-400">{l}</div>
                  ))}
                </div>
                <span className="text-xs text-slate-400">+48 {c.tourParticipants}</span>
              </div>
            </div>
            <div>
              <Tag>{c.tourTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold lg:text-4xl">{c.tourTitle}</h2>
              <p data-reveal className="mb-6 text-base leading-relaxed text-slate-300 lg:text-lg">{c.tourDesc}</p>
              <ul className="space-y-4">
                {c.tourItems.map(item => (
                  <li key={item} data-reveal className="flex items-center gap-3 text-base leading-relaxed">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-400" aria-hidden="true" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── 06 · GUIDES ── */}
        <section id="guides" ref={setSectionRef(5)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="06" side="left" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <Tag>{c.guidesTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold">{c.guidesTitle}</h2>
              <p data-reveal className="mb-6 text-base leading-7 text-slate-300">{c.guidesDesc}</p>
              <ul className="mb-6 space-y-3">
                {c.guidesItems.map(item => (
                  <li key={item} data-reveal className="flex items-center gap-3 text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" aria-hidden="true" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
              <a data-reveal href="/guides" className={`inline-flex items-center gap-2 rounded text-sm font-semibold text-cyan-400 transition hover:text-cyan-300 ${FOCUS}`}>
                {c.guidesLink}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </a>
            </div>
            <div className="space-y-3">
              {c.guides.map(({ t, tag, time }) => (
                <div key={t} data-reveal className={`flex items-center gap-4 rounded-xl p-4 transition hover:bg-white/[0.07] ${GLASS}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15">
                    <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{t}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-slate-400">{tag}</span>
                      <span className="text-xs text-slate-500" aria-hidden="true">·</span>
                      <span className="text-xs text-slate-400">{time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 07 · ORGANIZATIONS ── */}
        <section id="teams" ref={setSectionRef(6)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="07" side="right" />
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-8 max-w-2xl lg:mb-12">
              <Tag>{c.orgTag}</Tag>
              <h2 data-reveal className="mb-3 text-2xl font-bold lg:text-3xl">{c.orgTitle}</h2>
              <p data-reveal className="text-sm leading-7 text-slate-300 lg:text-base">{c.orgDesc}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {c.orgCards.map(({ icon, t, d }) => (
                <div key={t} data-reveal className={`h-full rounded-xl p-4 transition hover:bg-white/[0.07] lg:p-6 ${GLASS}`}>
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 lg:h-10 lg:w-10 lg:rounded-xl">
                    <OrgIcon type={icon} />
                  </div>
                  <p className="mb-1.5 text-sm font-semibold text-white lg:text-base">{t}</p>
                  <p className="text-xs leading-5 text-slate-400 lg:text-sm lg:leading-6">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 08 · PROFILES ── */}
        <section id="profiles" ref={setSectionRef(7)} className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="08" side="left" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <Tag>{c.profileTag}</Tag>
              <h2 data-reveal className="mb-4 text-3xl font-bold">{c.profileTitle}</h2>
              <p data-reveal className="mb-6 text-base leading-7 text-slate-300">{c.profileDesc}</p>
              <ul className="space-y-3">
                {c.profileItems.map(item => (
                  <li key={item} data-reveal className="flex items-center gap-3 text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" aria-hidden="true" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal className={`rounded-2xl p-6 ${GLASS}`}>
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 text-base font-bold text-cyan-400">AP</div>
                <div>
                  <p className="font-bold text-white">alex_prompter</p>
                  <p className="text-xs text-slate-400">{c.profileMember}</p>
                  <div className="mt-1.5 flex gap-2">
                    {[{ label: '#1', color: 'text-amber-400 bg-amber-400/10' }, { label: '14d', color: 'text-orange-400 bg-orange-400/10' }, { label: 'ELO', color: 'text-cyan-400 bg-cyan-400/10' }].map(({ label, color }) => (
                      <span key={label} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>{label}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {[['1420', 'ELO'], ['81%', lang === 'en' ? 'Avg' : 'Prom.'], ['14d', lang === 'en' ? 'Streak' : 'Racha']].map(([v, l]) => (
                  <div key={l} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                    <p className="text-base font-bold tabular-nums text-cyan-400">{v}</p>
                    <p className="text-[11px] text-slate-400">{l}</p>
                  </div>
                ))}
              </div>
              <StatsChart ariaLabel={c.chartTitle} />
            </div>
          </div>
        </section>

        {/* ── 09 · CTA + EDITORIAL ── */}
        <section id="start" ref={setSectionRef(8)} className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 py-16 lg:px-8">
          <Numeral n="09" side="right" />
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <div data-reveal className={`mb-4 rounded-2xl p-6 text-left sm:p-8 ${GLASS}`}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">{ed.tag}</p>
              <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">{ed.title}</h2>
              <div className="space-y-3">
                {ed.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-7 text-slate-300 sm:text-base">{p}</p>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-4">
                {ed.links.map(({ href, label }) => (
                  <a key={href} href={href} className={`rounded text-sm font-semibold text-cyan-400 underline underline-offset-2 transition hover:text-cyan-300 ${FOCUS}`}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
            <h2 data-reveal className="text-3xl font-black tracking-tight sm:text-4xl">{c.ctaTitle}</h2>
            <p data-reveal className="mx-auto max-w-md text-base text-slate-300 sm:text-lg">{c.ctaDesc}</p>
            <div data-reveal className="flex flex-wrap justify-center gap-4 pt-2">
              <button type="button" onClick={onTryApp} className={BTN_PRIMARY}>{c.ctaPlay}</button>
              <button type="button" onClick={onOpenAuth} className={BTN_GHOST}>{c.ctaSignup}</button>
              <button
                type="button"
                onClick={onEnterprise}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-violet-500/60 px-8 py-3.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/10 active:scale-[0.98] ${FOCUS}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {c.forTeamsCta}
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

export default LandingPage
