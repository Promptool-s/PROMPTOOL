import { useEffect, useState, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'

// ── Scroll reveal ──────────────────────────────────────────────────────────
const useReveal = () => {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

const Reveal = ({ children, className = '', delay = 0 }) => {
  const [ref, visible] = useReveal()
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

// ── Feature icon ───────────────────────────────────────────────────────────
const FeatureIcon = ({ type, dark }) => {
  const cls = `h-5 w-5 ${dark ? 'text-violet-400' : 'text-violet-600'}`
  const icons = {
    chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
    book: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
    users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    badge: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  }
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={icons[type]} />
    </svg>
  )
}

// ── Plans data ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter',
    desc: 'Para equipos pequeños que quieren empezar a medir el nivel de prompting de su equipo.',
    limit: 'Hasta 15 miembros',
    features: [
      'Dashboard básico del equipo',
      'Desafíos del catálogo global',
      'Guías del catálogo',
      'Invitación por link',
      'Ranking interno',
    ],
    excluded: [
      'Desafíos con imágenes propias',
      'Roles personalizados',
      'Chatbot IA',
      'Torneos internos',
    ],
    popular: false,
    cta: 'Empezar gratis',
  },
  {
    name: 'Team',
    desc: 'Para equipos que necesitan herramientas de entrenamiento completas y seguimiento real.',
    limit: 'Hasta 50 miembros',
    features: [
      'Dashboard completo con analytics',
      'Desafíos con imágenes propias o IA',
      'Guías asignables con seguimiento',
      'Roles personalizados',
      'Ranking interno + comparativas',
      'Chatbot IA de análisis',
    ],
    excluded: [
      'Torneos internos',
      'Onboarding personalizado',
    ],
    popular: true,
    cta: 'Empezar gratis',
  },
  {
    name: 'Enterprise',
    desc: 'Para organizaciones grandes con necesidades específicas de entrenamiento en IA.',
    limit: 'Miembros ilimitados',
    features: [
      'Todo lo del plan Team',
      'Torneos internos',
      'Panel de admin avanzado',
      'Onboarding personalizado',
      'Soporte prioritario',
      'Evaluación configurable por desafío',
    ],
    excluded: [],
    popular: false,
    cta: 'Hablar con ventas',
  },
]

const CUSTOM_FEATURES = [
  { key: 'customChallenges', label: 'Desafíos personalizados' },
  { key: 'guidesAssignable', label: 'Guías asignables' },
  { key: 'customRoles', label: 'Roles personalizados' },
  { key: 'chatbotIA', label: 'Chatbot IA' },
  { key: 'tournaments', label: 'Torneos internos' },
  { key: 'advancedAnalytics', label: 'Analytics avanzado' },
]

// ── Main ───────────────────────────────────────────────────────────────────
const EnterpriseLanding = ({ onBack, onOpenAuth }) => {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  const [currentSection, setCurrentSection] = useState(0)
  const containerRef = useRef(null)
  const isScrolling = useRef(false)
  const currentIdx = useRef(0)

  // Custom plan state
  const [members, setMembers] = useState(25)
  const [customFeatures, setCustomFeatures] = useState({
    customChallenges: true,
    guidesAssignable: true,
    customRoles: false,
    chatbotIA: false,
    tournaments: false,
    advancedAnalytics: false,
  })

  const TOTAL_SECTIONS = 8

  const bg = dark ? 'bg-slate-900 text-white' : 'bg-gray-50 text-slate-900'
  const card = dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
  const muted = dark ? 'text-slate-400' : 'text-slate-600'
  const subtle = dark ? 'text-slate-500' : 'text-slate-500'
  const accentText = dark ? 'text-violet-400' : 'text-violet-600'

  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

  const getSectionTop = (targetIdx) => {
    const container = containerRef.current
    if (!container) return 0
    const sections = container.querySelectorAll(':scope > section')
    return sections[targetIdx]?.offsetTop ?? targetIdx * container.clientHeight
  }

  const animateScrollTo = (targetIdx) => {
    const container = containerRef.current
    if (!container || isScrolling.current) return
    const from = container.scrollTop
    const to = getSectionTop(targetIdx)
    if (Math.abs(from - to) < 2) return
    isScrolling.current = true
    currentIdx.current = targetIdx
    setCurrentSection(targetIdx)
    container.style.scrollSnapType = 'none'
    const duration = 750
    const start = performance.now()
    const step = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      container.scrollTop = from + (to - from) * easeInOutCubic(progress)
      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        container.scrollTop = to
        container.style.scrollSnapType = 'y mandatory'
        isScrolling.current = false
      }
    }
    requestAnimationFrame(step)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let wheelTimeout = null
    const onWheel = (e) => {
      e.preventDefault()
      if (isScrolling.current) return
      clearTimeout(wheelTimeout)
      wheelTimeout = setTimeout(() => {
        const next = e.deltaY > 0
          ? Math.min(currentIdx.current + 1, TOTAL_SECTIONS - 1)
          : Math.max(currentIdx.current - 1, 0)
        animateScrollTo(next)
      }, 30)
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => { container.removeEventListener('wheel', onWheel); clearTimeout(wheelTimeout) }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let touchStartY = 0
    const onTouchStart = (e) => { touchStartY = e.touches[0].clientY }
    const onTouchEnd = (e) => {
      if (isScrolling.current) return
      const delta = touchStartY - e.changedTouches[0].clientY
      if (Math.abs(delta) < 40) return
      const next = delta > 0
        ? Math.min(currentIdx.current + 1, TOTAL_SECTIONS - 1)
        : Math.max(currentIdx.current - 1, 0)
      animateScrollTo(next)
    }
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onScroll = () => {
      if (isScrolling.current) return
      const sections = container.querySelectorAll(':scope > section')
      const mid = container.scrollTop + container.clientHeight / 2
      let closest = 0
      sections.forEach((s, i) => {
        if (s.offsetTop <= mid) closest = i
      })
      if (closest !== currentIdx.current) {
        currentIdx.current = closest
        setCurrentSection(closest)
      }
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (i) => animateScrollTo(i)

  const activeFeatureCount = Object.values(customFeatures).filter(Boolean).length

  const getCustomPlanLabel = () => {
    if (members <= 15 && activeFeatureCount <= 2) return 'Starter personalizado'
    if (members <= 50 && activeFeatureCount <= 4) return 'Team personalizado'
    return 'Enterprise personalizado'
  }

  const complexityPct = Math.min(Math.round((members / 500) * 60 + (activeFeatureCount / 6) * 40), 100)

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Nav dots */}
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2.5">
        {Array.from({ length: TOTAL_SECTIONS }).map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={`Sección ${i + 1}`}
            className={`rounded-full transition-all duration-300 ${
              i === currentSection
                ? 'h-6 w-2 bg-violet-500'
                : `h-2 w-2 ${dark ? 'bg-slate-600 hover:bg-slate-400' : 'bg-slate-300 hover:bg-slate-500'}`
            }`}
          />
        ))}
      </div>

      <div
        ref={containerRef}
        className={`h-full overflow-y-scroll ${bg}`}
        style={{ overscrollBehavior: 'none', scrollSnapType: 'y mandatory', touchAction: 'none' }}
      >

        {/* ── HERO ── */}
        <section style={{ height: '100svh', overflowY: 'hidden', scrollSnapAlign: 'start' }} className="relative flex items-center px-4 py-20 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onBack}
            className={`absolute top-6 left-4 sm:left-6 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Volver</span>
          </button>

          <div className="mx-auto w-full max-w-5xl text-center space-y-6 sm:space-y-8">
            {/* Beta pill */}
            <Reveal>
              <div className="flex justify-center">
                <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold ${
                  dark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Gratis durante la beta — hasta el 20 de junio de 2026
                </div>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="flex justify-center">
                <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold ${
                  dark ? 'border-violet-500/40 bg-violet-500/10 text-violet-400' : 'border-violet-200 bg-violet-50 text-violet-600'
                }`}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Para empresas y equipos
                </span>
              </div>
            </Reveal>

            <Reveal delay={160}>
              <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-7xl">
                Tu equipo necesita hablar{' '}
                <span className="text-violet-500">el nuevo idioma del mundo tech</span>
              </h1>
            </Reveal>

            <Reveal delay={240}>
              <p className={`max-w-2xl mx-auto text-base sm:text-lg leading-relaxed ${muted}`}>
                Las empresas que lideran hoy son las que ya saben comunicarse con la IA. PrompTool entrena a tu equipo en prompting — y te muestra en tiempo real quién avanza, quién se queda atrás y qué tan cerca están de los objetivos que vos definís.
              </p>
            </Reveal>

            <Reveal delay={320}>
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-6 py-3 sm:px-8 sm:py-3.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
                >
                  Empezar gratis
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo(1)}
                  className={`inline-flex items-center justify-center rounded-lg border px-6 py-3 sm:px-8 sm:py-3.5 text-sm font-semibold transition ${
                    dark ? 'border-slate-700 text-white hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Ver cómo funciona ↓
                </button>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <div className="flex flex-wrap justify-center gap-3">
                {['Ves quién mejora y quién no', 'Definís los objetivos vos', 'El equipo práctica en el día a día'].map(stat => (
                  <div
                    key={stat}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-medium ${
                      dark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                    {stat}
                  </div>
                ))}
              </div>
            </Reveal>

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
              <button
                onClick={() => scrollTo(1)}
                className={`group flex h-10 w-10 items-center justify-center rounded-full border-2 border-violet-400 bg-white/80 shadow-md backdrop-blur-sm transition hover:bg-violet-500 hover:border-violet-500 animate-bounce ${dark ? 'bg-slate-800/80' : 'bg-white/80'}`}
              >
                <svg className="h-5 w-5 text-violet-500 transition group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section style={{ height: '100svh', overflowY: 'hidden', scrollSnapAlign: 'start' }} className="flex items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Reveal>
              <div className="mb-10 sm:mb-14">
                <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accentText}`}>Lo que obtenés</p>
                <h2 className="text-3xl sm:text-4xl font-bold">De "no sé cómo va el equipo" a datos reales</h2>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: 'chart', title: 'Ves quién avanza y quién no', desc: 'Score promedio, ELO, participación activa y tendencias de cada miembro — en tiempo real. Sabés exactamente quién cumple los objetivos y quién necesita atención.' },
                { icon: 'bolt', title: 'Desafíos con tu contenido', desc: 'Cargá tus propias imágenes y creá desafíos que reflejen el trabajo real de tu empresa. Dificultad, tiempo y intentos configurables.' },
                { icon: 'book', title: 'Guías asignables con seguimiento', desc: 'Asigná guías con fecha límite a todo el equipo o a roles específicos. Ves quién las completó, quién no empezó y qué tanto aprendieron.' },
                { icon: 'users', title: 'Roles y accesos claros', desc: 'Invitá por email o link. Asigná roles (manager, analista, trainee) y controlá qué puede ver cada uno dentro del panel.' },
                { icon: 'badge', title: 'Ranking interno que motiva', desc: 'Tu equipo compite entre sí con un leaderboard propio. Métricas comparativas que generan competencia sana y compromiso real.' },
                { icon: 'chat', title: 'Chatbot IA para el manager', desc: 'Preguntale en lenguaje natural cómo va el equipo, quién necesita refuerzo o qué desafíos generar. La IA actúa sobre el panel.' },
              ].map(({ icon, title, desc }, i) => (
                <Reveal key={title} delay={i * 60}>
                  <div className={`rounded-2xl border p-5 sm:p-6 h-full ${card}`}>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${dark ? 'bg-violet-500/15' : 'bg-violet-100'}`}>
                      <FeatureIcon type={icon} dark={dark} />
                    </div>
                    <p className="font-semibold mb-2">{title}</p>
                    <p className={`text-sm leading-6 ${muted}`}>{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── DASHBOARD PREVIEW ── */}
        <section style={{ height: '100svh', overflowY: 'hidden', scrollSnapAlign: 'start' }} className="flex items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl grid gap-12 lg:gap-20 lg:grid-cols-2 items-center">
            <Reveal>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accentText}`}>Panel de control</p>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">Sabés exactamente cómo está tu equipo — sin tener que preguntar</h2>
                <p className={`text-base sm:text-lg leading-relaxed mb-8 ${muted}`}>
                  Un dashboard centralizado donde ves en segundos si tu equipo está alcanzando el nivel que necesitás. Sin reportes manuales, sin suposiciones.
                </p>
                <ul className="space-y-3 sm:space-y-4">
                  {[
                    'Score promedio con objetivo configurable — sabés si están donde tienen que estar',
                    'Tasa de participación activa y alertas de miembros inactivos',
                    'Detección automática de quién está por debajo del target',
                    'Evolución individual para ver quién mejora semana a semana',
                    'Insights generados con IA para tomar decisiones rápido',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm sm:text-base leading-relaxed">
                      <span className={`mt-2 h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0`} />
                      <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${card}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">Dashboard del equipo</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${dark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>En vivo</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: '74%', label: 'Score prom.', color: 'text-emerald-500' },
                    { value: '83%', label: 'Participación', color: 'text-amber-500' },
                    { value: '6', label: 'Mejorando', color: 'text-violet-500' },
                    { value: '1240', label: 'ELO prom.', color: 'text-sky-500' },
                  ].map(({ value, label, color }) => (
                    <div key={label} className={`rounded-xl p-3 sm:p-4 ${dark ? 'bg-slate-900 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                      <p className={`text-xl sm:text-2xl font-black ${color}`}>{value}</p>
                      <p className={`text-xs mt-1 ${subtle}`}>{label}</p>
                    </div>
                  ))}
                </div>
                <div className={`rounded-xl p-4 ${dark ? 'bg-slate-900 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                  <p className={`text-xs font-semibold mb-3 ${subtle}`}>Miembros destacados</p>
                  <div className="space-y-2.5">
                    {[['maria_g', '91%', 1380], ['carlos_r', '84%', 1290], ['ana_p', '78%', 1210]].map(([name, score, elo]) => (
                      <div key={name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${dark ? 'bg-violet-600' : 'bg-violet-500'}`}>
                            {name[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-500 font-semibold">{score}</span>
                          <span className={`text-xs ${subtle}`}>{elo} ELO</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── CHALLENGES ── */}
        <section style={{ height: '100svh', overflowY: 'hidden', scrollSnapAlign: 'start' }} className="flex items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl grid gap-12 lg:gap-20 lg:grid-cols-2 items-center">
            <Reveal>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accentText}`}>Práctica real</p>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">Que practiquen con los casos que vos elegís</h2>
                <p className={`text-base sm:text-lg leading-relaxed mb-8 ${muted}`}>
                  Creá desafíos con imágenes de tu industria o generá nuevas con IA. El equipo practica prompting en contextos reales — no ejercicios genéricos — y vos ves quién lo domina.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[
                    'Imagen propia o generada por IA',
                    'Dificultad: Easy / Medium / Hard',
                    'Tiempo límite configurable',
                    'Intentos máximos',
                    'Visibilidad: privado o público',
                    'Evaluación configurable',
                    'Hints para guiar al equipo',
                    'Puntos y recompensas',
                  ].map(label => (
                    <div key={label} className={`flex items-start gap-2 rounded-xl border p-2.5 sm:p-3 text-xs sm:text-sm ${card}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0 mt-1" />
                      <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${card}`}>
                <p className="font-bold text-sm">Nuevo desafío</p>
                <div className={`rounded-xl border p-4 space-y-3 ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
                  <div className={`h-28 sm:h-32 rounded-lg flex flex-col items-center justify-center border-2 border-dashed ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                    <svg className={`h-7 w-7 mb-1.5 ${subtle}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className={`text-xs ${subtle}`}>Subir imagen</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[['Dificultad', 'Medium'], ['Tiempo', '3 min'], ['Intentos', '3'], ['Visibilidad', 'Privado']].map(([k, v]) => (
                      <div key={k} className={`rounded-lg p-2 ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                        <p className={`text-[10px] ${subtle}`}>{k}</p>
                        <p className="text-xs font-semibold mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button type="button" className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition">
                  Publicar desafío
                </button>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── GUIDES ── */}
        <section style={{ height: '100svh', overflowY: 'hidden', scrollSnapAlign: 'start' }} className="flex items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl grid gap-12 lg:gap-20 lg:grid-cols-2 items-center">
            <Reveal>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accentText}`}>Formación estructurada</p>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">Que aprendan siguiendo el camino que vos trazaste</h2>
                <p className={`text-base sm:text-lg leading-relaxed mb-8 ${muted}`}>
                  Asigná guías del catálogo o creá las tuyas con lecciones, quizzes y checkpoints. Definís una fecha límite, y el dashboard te muestra quién terminó, quién no empezó y qué tanto entendieron.
                </p>
                <ul className="space-y-3 sm:space-y-4">
                  {[
                    'Lecciones con texto, imágenes y video',
                    'Quiz de comprensión con corrección automática',
                    'Pasos guiados con checkpoints',
                    'Fecha límite y recordatorios',
                    'Asignación por rol o miembro individual',
                    'Progreso visible en el dashboard',
                  ].map(label => (
                    <li key={label} className="flex items-center gap-3 text-sm sm:text-base leading-relaxed">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                      <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className={`rounded-2xl border p-5 sm:p-6 space-y-3 ${card}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">Guía: Prompt Engineering Básico</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${dark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-50 text-violet-700'}`}>Asignada</span>
                </div>
                {[
                  { type: 'Lección', title: 'Introducción al prompting', done: true },
                  { type: 'Quiz', title: 'Conceptos básicos', done: true },
                  { type: 'Pasos', title: 'Tu primer prompt', done: false },
                  { type: 'Checklist', title: 'Revisión final', done: false },
                ].map(({ type, title, done }) => (
                  <div
                    key={title}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      done
                        ? dark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50'
                        : dark ? 'border-slate-700 bg-slate-900' : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500' : dark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      {done ? (
                        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <div className={`h-2 w-2 rounded-full ${dark ? 'bg-slate-500' : 'bg-slate-400'}`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${done ? 'text-emerald-500' : subtle}`}>{type}</p>
                      <p className="text-sm font-medium truncate">{title}</p>
                    </div>
                  </div>
                ))}
                <div className={`rounded-xl p-3 ${dark ? 'bg-slate-900 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs ${subtle}`}>Progreso del equipo</span>
                    <span className="text-xs font-semibold text-violet-500">50%</span>
                  </div>
                  <div className={`h-1.5 rounded-full ${dark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <div className="h-1.5 w-1/2 rounded-full bg-violet-500" />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section style={{ height: '100svh', overflowY: 'hidden', scrollSnapAlign: 'start' }} className="flex items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Reveal>
              <div className="text-center mb-10 sm:mb-14">
                <div className="flex justify-center mb-5">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold ${
                    dark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Gratis hasta el 20 de junio de 2026 — Estamos en beta
                  </div>
                </div>
                <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accentText}`}>Planes</p>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">Elegí tu plan</h2>
                <p className={`text-base sm:text-lg max-w-xl mx-auto ${muted}`}>
                  Probá el sistema completo sin costo hasta el lanzamiento oficial.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
              {PLANS.map((plan, i) => (
                <Reveal key={plan.name} delay={i * 80}>
                  <div className={`relative rounded-2xl border p-6 sm:p-7 flex flex-col h-full ${card} ${plan.popular ? (dark ? 'ring-2 ring-violet-500' : 'ring-2 ring-violet-500') : ''}`}>
                    {plan.popular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="bg-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                          Más popular
                        </span>
                      </div>
                    )}

                    <div className="mb-6">
                      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                      <p className={`text-sm leading-relaxed mb-3 ${muted}`}>{plan.desc}</p>
                      <span className={`text-xs font-semibold ${accentText}`}>{plan.limit}</span>
                    </div>

                    <div className={`rounded-xl border p-4 text-center mb-6 ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
                      <p className="text-2xl font-black">Beta</p>
                      <p className={`text-xs mt-1 ${subtle}`}>Gratis hasta el 20 jun 2026</p>
                    </div>

                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <svg className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className={dark ? 'text-slate-300' : 'text-slate-700'}>{f}</span>
                        </li>
                      ))}
                      {plan.excluded.map(f => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <svg className="h-4 w-4 shrink-0 mt-0.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className={subtle}>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={plan.name === 'Enterprise' ? () => window.location.href = 'mailto:hola@promptool.ai' : onOpenAuth}
                      className={`w-full rounded-lg py-2.5 text-sm font-semibold transition ${
                        plan.popular
                          ? 'bg-violet-600 text-white hover:bg-violet-700'
                          : dark
                            ? 'border border-slate-700 text-slate-300 hover:bg-slate-700'
                            : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {plan.cta}
                    </button>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CUSTOM PLAN BUILDER ── */}
        <section style={{ height: '100svh', overflowY: 'hidden', scrollSnapAlign: 'start' }} className="flex items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-4xl">
            <Reveal>
              <div className="text-center mb-10">
                <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accentText}`}>Plan a medida</p>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">¿Ningún plan te convence?</h2>
                <p className={`text-base sm:text-lg ${muted}`}>
                  Configurá tu plan ideal según el tamaño de tu equipo y las funciones que necesitás.
                </p>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className={`rounded-2xl border p-6 sm:p-8 ${card}`}>
                {/* Members slider */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-semibold text-sm sm:text-base">Miembros del equipo</label>
                    <span className="text-2xl font-black text-violet-500">{members}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    step="5"
                    value={members}
                    onChange={e => setMembers(Number(e.target.value))}
                    className="w-full accent-violet-500 h-2 rounded-lg cursor-pointer"
                  />
                  <div className={`flex justify-between text-xs mt-2 ${subtle}`}>
                    <span>5</span><span>100</span><span>250</span><span>500</span>
                  </div>
                </div>

                {/* Feature toggles */}
                <div className="mb-8">
                  <p className="font-semibold mb-4 text-sm sm:text-base">Funciones</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {CUSTOM_FEATURES.map(({ key, label }) => (
                      <label
                        key={key}
                        className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition select-none ${
                          customFeatures[key]
                            ? dark ? 'border-violet-500/40 bg-violet-500/10' : 'border-violet-300 bg-violet-50'
                            : dark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className={`text-sm font-medium ${customFeatures[key] ? accentText : ''}`}>{label}</span>
                        <input
                          type="checkbox"
                          checked={customFeatures[key]}
                          onChange={e => setCustomFeatures(f => ({ ...f, [key]: e.target.checked }))}
                          className="accent-violet-500 h-4 w-4 cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Result card */}
                <div className={`rounded-xl border p-5 sm:p-6 ${dark ? 'border-violet-500/30 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${accentText}`}>Tu plan estimado</p>
                  <p className="text-xl sm:text-2xl font-black mb-1">{getCustomPlanLabel()}</p>
                  <p className={`text-sm ${muted}`}>{members} miembros · {activeFeatureCount} función{activeFeatureCount !== 1 ? 'es' : ''} activa{activeFeatureCount !== 1 ? 's' : ''}</p>

                  <div className="mt-4 mb-1">
                    <div className={`h-2 rounded-full overflow-hidden ${dark ? 'bg-slate-700' : 'bg-violet-200'}`}>
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all duration-500"
                        style={{ width: `${complexityPct}%` }}
                      />
                    </div>
                  </div>
                  <p className={`text-xs mb-4 ${subtle}`}>Complejidad del plan: {complexityPct}%</p>

                  <div className={`rounded-lg border p-3 text-center mb-4 ${dark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50'}`}>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">Gratis</p>
                    <p className={`text-xs mt-0.5 ${subtle}`}>Hasta el 20 de junio de 2026 — Beta</p>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="w-full inline-flex items-center justify-center rounded-lg bg-violet-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
                  >
                    Crear cuenta enterprise
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{ height: '100svh', overflowY: 'hidden', scrollSnapAlign: 'start' }} className="flex items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center space-y-6">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
                Tu equipo puede hablar el idioma de la IA.<br className="hidden sm:block" /> ¿Cuándo empezamos?
              </h2>
              <p className={`text-base sm:text-lg max-w-md mx-auto ${muted}`}>
                Creá tu cuenta enterprise hoy, invitá a tu equipo y en minutos empezás a ver quién avanza y quién necesita refuerzo.
              </p>
              <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold ${
                dark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Gratis hasta el 20 de junio de 2026
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-4 justify-center pt-2">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-8 py-3.5 text-sm sm:text-base font-semibold text-white hover:bg-violet-700 transition"
                >
                  Crear cuenta enterprise
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className={`inline-flex items-center justify-center rounded-lg border-2 px-6 sm:px-8 py-3.5 text-sm sm:text-base font-semibold transition ${
                    dark ? 'border-slate-700 text-white hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Volver a la landing
                </button>
              </div>
              <p className={`text-sm ${subtle}`}>Sin tarjeta de crédito · Sin configuración compleja.</p>
            </div>
          </Reveal>
        </section>

      </div>
    </div>
  )
}

export default EnterpriseLanding
