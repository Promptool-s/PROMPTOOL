import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useTheme } from '../contexts/ThemeContext'
import { proxyImg } from '../utils/imgProxy'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ── Language detection by browser/location ────────────────────────────────
const detectLang = () => {
  const stored = localStorage.getItem('lang')
  if (stored) return stored
  const nav = navigator.language || navigator.languages?.[0] || 'es'
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en'
}

const copy = {
  es: {
    badge: 'Nuevo desafío cada día',
    h1a: 'Descifra el prompt.',
    h1b: 'Domina la IA.',
    sub: 'Un juego diario donde recreas el prompt de una imagen generada por IA. Obtienes score y feedback real para mejorar cada día.',
    cta1: 'Empezar',
    cta2: 'Iniciar sesión',
    stat1: 'intentos', stat2: 'usuarios', stat3: 'imágenes',
    howTag: 'Cómo funciona',
    howTitle: 'Tres pasos, un desafío diario',
    steps: [
      { n: '01', t: 'Ves la imagen', d: 'Cada día hay una imagen nueva generada por IA. Tu misión: adivinar el prompt que la creó.' },
      { n: '02', t: 'Escribes tu prompt', d: 'Describes la imagen con tus palabras. Puedes intentarlo varias veces para mejorar tu score.' },
      { n: '03', t: 'Recibes feedback', d: 'La IA compara tu prompt con el original y te da un score detallado con sugerencias reales.' },
    ],
    progressTag: 'Tu progreso',
    progressTitle: 'Sigue tu evolución día a día',
    progressDesc: 'Cada intento queda registrado. Ves tu score promedio, tu mejor marca, tu racha activa y cómo mejoras con el tiempo. No es solo un juego, es una herramienta de práctica real.',
    statsLabels: ['Score promedio', 'Racha actual', 'Mejor intento', 'Posición global'],
    chartTitle: 'Score esta semana',
    chartSub: '+39 puntos de mejora',
    chartNote: 'Datos de ejemplo — el tuyo se genera con tus intentos reales',
    communityTag: 'Comunidad',
    communityTitle: 'Ranking global, progreso real',
    communityDesc: 'Cada partida suma a tu posición en el leaderboard. La liga competitiva se reinicia cada mes y el mejor prompter obtiene una badge exclusiva en su perfil.',
    communityItems: ['Leaderboard mensual con ranking ELO', 'Perfiles públicos con historial y stats', 'Badges y medallas por logros', 'Comparación directa entre usuarios'],
    tourTag: 'Torneos y eventos',
    tourTitle: 'Torneos cada 15 días',
    tourDesc: 'Además del desafío diario, hay torneos periódicos con formato sprint. Compites contra otros en un tiempo limitado con imágenes de mayor dificultad.',
    tourItems: ['Formato sprint: 5 imágenes en 24 horas', 'Medallas exclusivas por edición', 'Premio premium para el ganador', 'Badge permanente en el perfil'],
    tourLive: 'En curso', tourEnds: 'Finaliza en 2 días', tourName: 'Prompt Sprint #2',
    tourCardDesc: '5 imágenes, dificultad alta, 24 horas para completar. El ganador se lleva una medalla exclusiva y suscripción premium.',
    tourParticipants: 'participantes',
    guidesTag: 'Guías',
    guidesTitle: 'Aprende a escribir mejores prompts',
    guidesDesc: 'No es solo jugar. Hay una sección de guías con técnicas reales de prompting: cómo describir estilos, composición, iluminación, referencias artísticas y más.',
    guidesItems: ['Técnicas de descripción visual', 'Estilos artísticos y referencias', 'Composición y encuadre', 'Prompts para distintos modelos de IA'],
    guidesLink: 'Ver guías',
    guides: [
      { t: 'Cómo describir estilos artísticos', tag: 'Básico', time: '5 min' },
      { t: 'Composición y perspectiva en prompts', tag: 'Intermedio', time: '8 min' },
      { t: 'Referencias de iluminación y color', tag: 'Avanzado', time: '10 min' },
    ],
    orgTag: 'Para organizaciones',
    orgTitle: 'Útil para empresas y colegios',
    orgDesc: 'PromptTool no es solo para uso individual. Equipos de trabajo y aulas pueden usarlo como herramienta de entrenamiento en IA generativa.',
    orgCards: [
      { icon: 'building', t: 'Equipos de trabajo', d: 'Crea una empresa, invita a tu equipo y sigue el progreso de cada miembro desde un panel centralizado.' },
      { icon: 'graduation', t: 'Aulas y colegios', d: 'Ideal para clases de tecnología o diseño. Los estudiantes aprenden prompting de forma práctica y medible.' },
      { icon: 'chart', t: 'Panel de analytics', d: 'Ves quién jugó, cuánto mejoró, scores promedio del equipo y comparativas entre miembros.' },
      { icon: 'target', t: 'Desafíos internos', d: 'Los admins pueden crear desafíos exclusivos para su organización con imágenes propias.' },
      { icon: 'link', t: 'Invitación por link', d: 'Suma miembros con un link de invitación. Sin fricción, sin configuración compleja.' },
      { icon: 'trophy', t: 'Ranking interno', d: 'Cada empresa tiene su propio ranking. Competencia sana dentro del equipo.' },
    ],
    profileTag: 'Perfiles',
    profileTitle: 'Tu perfil, tu historial',
    profileDesc: 'Cada usuario tiene un perfil público con su historial de intentos, stats, medallas ganadas y posición en el ranking. Puedes personalizar tu bio, links sociales y colores.',
    profileItems: ['Historial completo de intentos', 'Medallas y badges desbloqueadas', 'Stats: ELO, promedio, racha, mejor score', 'Links a redes sociales y portfolio', 'Perfil personalizable con color de acento'],
    profileMember: 'Miembro desde enero 2025',
    ctaTitle: '¿Listo para empezar?',
    ctaDesc: 'Tu primer desafío te espera.',
    ctaPlay: 'Jugar ahora',
    ctaSignup: 'Crear cuenta',
    community: 'Comunidad',
    noSlides: 'Las mejores jugadas de la comunidad aparecerán aquí.',
  },
  en: {
    badge: 'New challenge every day',
    h1a: 'Decode the prompt.',
    h1b: 'Master AI.',
    sub: 'A daily game where you recreate the prompt of an AI-generated image. Get a real score and feedback to improve every day.',
    cta1: 'Get started',
    cta2: 'Sign in',
    stat1: 'attempts', stat2: 'users', stat3: 'images',
    howTag: 'How it works',
    howTitle: 'Three steps, one daily challenge',
    steps: [
      { n: '01', t: 'See the image', d: 'Every day there is a new AI-generated image. Your mission: guess the prompt that created it.' },
      { n: '02', t: 'Write your prompt', d: 'Describe the image in your own words. You can try multiple times to improve your score.' },
      { n: '03', t: 'Get feedback', d: 'The AI compares your prompt to the original and gives you a detailed score with real suggestions.' },
    ],
    progressTag: 'Your progress',
    progressTitle: 'Track your evolution day by day',
    progressDesc: 'Every attempt is recorded. See your average score, best mark, active streak and how you improve over time. Not just a game — a real practice tool.',
    statsLabels: ['Avg score', 'Current streak', 'Best attempt', 'Global rank'],
    chartTitle: 'Score this week',
    chartSub: '+39 point improvement',
    chartNote: 'Sample data — yours is generated from your real attempts',
    communityTag: 'Community',
    communityTitle: 'Global ranking, real progress',
    communityDesc: 'Every game counts toward your leaderboard position. The competitive league resets monthly and the top prompter earns an exclusive badge on their profile.',
    communityItems: ['Monthly leaderboard with ELO ranking', 'Public profiles with history and stats', 'Badges and medals for achievements', 'Head-to-head comparison between users'],
    tourTag: 'Tournaments & events',
    tourTitle: 'Tournaments every 15 days',
    tourDesc: 'Beyond the daily challenge, there are periodic sprint-format tournaments. Compete against others in a time-limited format with harder images.',
    tourItems: ['Sprint format: 5 images in 24 hours', 'Exclusive medals per edition', 'Premium prize for the winner', 'Permanent badge on profile'],
    tourLive: 'Live', tourEnds: 'Ends in 2 days', tourName: 'Prompt Sprint #2',
    tourCardDesc: '5 images, hard difficulty, 24 hours to complete. The winner gets an exclusive medal and a premium subscription.',
    tourParticipants: 'participants',
    guidesTag: 'Guides',
    guidesTitle: 'Learn to write better prompts',
    guidesDesc: 'Not just a game. There is a guides section with real prompting techniques: how to describe styles, composition, lighting, artistic references and more.',
    guidesItems: ['Visual description techniques', 'Artistic styles and references', 'Composition and framing', 'Prompts for different AI models'],
    guidesLink: 'View guides',
    guides: [
      { t: 'How to describe artistic styles', tag: 'Basic', time: '5 min' },
      { t: 'Composition and perspective in prompts', tag: 'Intermediate', time: '8 min' },
      { t: 'Lighting and color references', tag: 'Advanced', time: '10 min' },
    ],
    orgTag: 'For organizations',
    orgTitle: 'Built for teams and schools',
    orgDesc: 'PromptTool is not just for individual use. Work teams and classrooms can use it as a generative AI training tool.',
    orgCards: [
      { icon: 'building', t: 'Work teams', d: 'Create a company, invite your team and track each member\'s progress from a centralized dashboard.' },
      { icon: 'graduation', t: 'Classrooms & schools', d: 'Great for technology or design classes. Students learn prompting in a practical, measurable way.' },
      { icon: 'chart', t: 'Analytics dashboard', d: 'See who played, how much they improved, team average scores and member comparisons.' },
      { icon: 'target', t: 'Internal challenges', d: 'Admins can create exclusive challenges for their organization with custom images.' },
      { icon: 'link', t: 'Invite by link', d: 'Add members with an invite link. No friction, no complex setup.' },
      { icon: 'trophy', t: 'Internal ranking', d: 'Each company has its own ranking. Healthy competition within the team.' },
    ],
    profileTag: 'Profiles',
    profileTitle: 'Your profile, your history',
    profileDesc: 'Every user has a public profile with their attempt history, stats, earned medals and ranking position. Customize your bio, social links and accent color.',
    profileItems: ['Full attempt history', 'Unlocked medals and badges', 'Stats: ELO, average, streak, best score', 'Social and portfolio links', 'Customizable profile with accent color'],
    profileMember: 'Member since January 2025',
    ctaTitle: 'Ready to start?',
    ctaDesc: 'Your first challenge is waiting.',
    ctaPlay: 'Play now',
    ctaSignup: 'Create account',
    community: 'Community',
    noSlides: 'The best community plays will appear here.',
  }
}

// ── Scroll reveal hook ─────────────────────────────────────────────────────
const useReveal = () => {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.12 })
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

// ── Blocked words ──────────────────────────────────────────────────────────
const BLOCKED_WORDS = ['nude','naked','porn','sex','nsfw','explicit','gore','blood','violence','kill','murder','hate','racist','drug','weapon','desnud','porno','sexo','sangre','matar','odio','droga']
const isPromptOk = (p) => {
  if (!p || typeof p !== 'string') return false
  const l = p.toLowerCase()
  if (BLOCKED_WORDS.some(w => l.includes(w))) return false
  return p.trim().split(/\s+/).length > 10
}

// ── Slideshow ──────────────────────────────────────────────────────────────
const Slide = ({ item, visible }) => (
  <div className={`absolute inset-0 flex flex-col transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
    <div className="relative flex-1 overflow-hidden rounded-2xl select-none" onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>
      <img src={proxyImg(item.url_image)} alt="" className="h-full w-full object-cover pointer-events-none" draggable={false} loading="lazy" />
      <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-slate-950/90 to-transparent" />
    </div>
    <div className="mt-3 space-y-2 px-1 select-none" onCopy={e => e.preventDefault()}>
      <div className="flex items-center gap-2.5">
        {item.avatar_url
          ? <img src={proxyImg(item.avatar_url)} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-black/10 pointer-events-none" draggable={false} />
          : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/30 text-xs font-bold text-violet-500">{(item.username || '?')[0].toUpperCase()}</div>
        }
        <span className="text-xs font-medium text-slate-400 dark:text-slate-400">{item.username || 'Anonymous'}</span>
        {item.is_dev && (
          <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-400 uppercase tracking-wide">DEV</span>
        )}
        {item.score != null && <span className="ml-auto rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-400">{item.score}%</span>}
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400 italic">"{item.prompt_usuario}"</p>
    </div>
  </div>
)

const Dots = ({ total, current, onSelect, dark }) => (
  <div className="flex items-center justify-center gap-1.5 pt-1">
    {Array.from({ length: total }).map((_, i) => (
      <button key={i} onClick={() => onSelect(i)} aria-label={`Slide ${i + 1}`}
        className={`rounded-full transition-all duration-300 ${i === current ? 'h-1.5 w-5 bg-violet-500' : `h-1.5 w-1.5 ${dark ? 'bg-white/20 hover:bg-white/40' : 'bg-slate-300 hover:bg-slate-400'}`}`} />
    ))}
  </div>
)

const CommunitySlideshow = ({ dark, lang }) => {
  const [slides, setSlides] = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)
  const c = copy[lang]

  useEffect(() => {
    const fetch = async () => {
      try {
        // Fetch a larger pool with varied users, score >= 70
        const { data, error } = await supabase
          .from('intentos')
          .select('prompt_usuario, puntaje_similitud, id_usuario, id_imagen, imagenes_ia(url_image), usuarios(username, avatar_url, devstate)')
          .gte('puntaje_similitud', 70)
          .not('prompt_usuario', 'is', null)
          .order('fecha_hora', { ascending: false })
          .limit(200)

        if (error || !data) return

        // Group by user, pick best per user, then shuffle
        const byUser = {}
        for (const row of data) {
          if (!row.imagenes_ia?.url_image) continue
          if (!isPromptOk(row.prompt_usuario)) continue
          const uid = row.id_usuario || row.usuarios?.username || Math.random()
          if (!byUser[uid] || row.puntaje_similitud > byUser[uid].puntaje_similitud) {
            byUser[uid] = row
          }
        }

        const pool = Object.values(byUser)
        // Shuffle
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]]
        }

        setSlides(pool.slice(0, 10).map(row => ({
          url_image: row.imagenes_ia.url_image,
          prompt_usuario: row.prompt_usuario,
          score: row.puntaje_similitud,
          username: row.usuarios?.username || null,
          avatar_url: row.usuarios?.avatar_url || null,
          is_dev: row.usuarios?.devstate === true,
        })))
      } catch (_) {}
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  useEffect(() => {
    if (slides.length < 2) return
    timerRef.current = setInterval(() => setCurrent(p => (p + 1) % slides.length), 4500)
    return () => clearInterval(timerRef.current)
  }, [slides.length])

  const goTo = (i) => {
    clearInterval(timerRef.current)
    setCurrent(i)
    timerRef.current = setInterval(() => setCurrent(p => (p + 1) % slides.length), 4500)
  }

  if (loading) return <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" /></div>
  if (!slides.length) return <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">{c.noSlides}</div>

  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{c.community}</p>
      <div className="relative flex-1">{slides.map((item, i) => <Slide key={i} item={item} visible={i === current} />)}</div>
      {slides.length > 1 && <Dots total={slides.length} current={current} onSelect={goTo} dark={dark} />}
    </div>
  )
}

// ── Chart ──────────────────────────────────────────────────────────────────
const CHART_DATA = [
  { day: 'M', score: 42 }, { day: 'T', score: 55 }, { day: 'W', score: 51 },
  { day: 'T', score: 68 }, { day: 'F', score: 63 }, { day: 'S', score: 74 },
  { day: 'S', score: 81 },
]

const StatsChart = ({ dark }) => (
  <ResponsiveContainer width="100%" height={110}>
    <AreaChart data={CHART_DATA} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
        </linearGradient>
      </defs>
      <XAxis dataKey="day" tick={{ fontSize: 10, fill: dark ? '#475569' : '#94a3b8' }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 10, fill: dark ? '#475569' : '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
      <Tooltip contentStyle={{ background: dark ? '#1e293b' : '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }} formatter={v => [`${v}%`, 'Score']} />
      <Area type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2} fill="url(#sg)" dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }} />
    </AreaChart>
  </ResponsiveContainer>
)

// ── Org icons (no emoji) ───────────────────────────────────────────────────
const OrgIcon = ({ type, dark }) => {
  const cls = `h-5 w-5 ${dark ? 'text-violet-400' : 'text-violet-600'}`
  const paths = {
    building: 'M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9',
    graduation: 'M12 14l9-5-9-5-9 5 9 5zm0 0v6m-4-3.5l4 2 4-2',
    chart: 'M3 3v18h18M7 16l4-4 4 4 4-6',
    target: 'M12 12m-3 0a3 3 0 106 0 3 3 0 00-6 0M12 2v2m0 16v2M2 12h2m16 0h2',
    link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    trophy: 'M8 21h8m-4-4v4M5 3h14l-1 7a5 5 0 01-10 0L5 3zm0 0H3m16 0h2',
  }
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {paths[type].split('M').filter(Boolean).map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={`M${d}`} />
      ))}
    </svg>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
const LandingPage = ({ onOpenAuth, onTryApp }) => {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [lang] = useState(detectLang)
  const [showScrollIndicator, setShowScrollIndicator] = useState(true)
  const c = copy[lang]

  // Ocultar indicador de scroll cuando el usuario hace scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollIndicator(window.scrollY < 100)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const base = dark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'
  const card = dark ? 'border-white/10 bg-slate-900' : 'border-slate-100 bg-slate-50'
  const muted = dark ? 'text-slate-300' : 'text-slate-500'
  const subtle = dark ? 'text-slate-400' : 'text-slate-400'

  return (
    <div className={base}>

      {/* ── HERO ── */}
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs ${dark ? 'border-white/12 bg-white/4 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {c.badge}
            </span>
            <div className="space-y-4">
              <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                {c.h1a}{' '}<span className="text-violet-500">{c.h1b}</span>
              </h1>
              <p className={`max-w-md text-base leading-7 ${muted}`}>{c.sub}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onTryApp} className="inline-flex items-center justify-center rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition">{c.cta1}</button>
              <button type="button" onClick={onOpenAuth} className={`inline-flex items-center justify-center rounded-full border px-7 py-3 text-sm font-semibold transition ${dark ? 'border-white/20 text-white hover:bg-white/6' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{c.cta2}</button>
            </div>
          </div>
          <div className={`relative overflow-hidden rounded-3xl border p-5 shadow-xl lg:h-[520px] ${card}`}>
            <div className="relative h-full">
              <CommunitySlideshow dark={dark} lang={lang} />
            </div>
          </div>
        </div>
        
        {/* Scroll indicator - solo chevron, más grande y centrado */}
        <div 
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 animate-bounce-subtle transition-opacity duration-500 ${
            showScrollIndicator ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <svg 
            className={`h-8 w-8 ${dark ? 'text-slate-600' : 'text-slate-400'}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-violet-400' : 'text-violet-600'}`}>{c.howTag}</p>
            <h2 className="text-3xl font-bold mb-12">{c.howTitle}</h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-3">
            {c.steps.map(({ n, t, d }, i) => (
              <Reveal key={n} delay={i * 100}>
                <div className={`rounded-2xl border p-6 h-full ${card}`}>
                  <p className="text-5xl font-black text-violet-500/20 mb-4 leading-none">{n}</p>
                  <p className="font-semibold mb-2">{t}</p>
                  <p className={`text-sm leading-6 ${muted}`}>{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROGRESS ── */}
      <div className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
          <Reveal>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-violet-400' : 'text-violet-600'}`}>{c.progressTag}</p>
            <h2 className="text-3xl font-bold mb-4">{c.progressTitle}</h2>
            <p className={`text-base leading-7 mb-8 ${muted}`}>{c.progressDesc}</p>
            <div className="grid grid-cols-2 gap-3">
              {[['74%', c.statsLabels[0], 'text-emerald-500'], ['12d', c.statsLabels[1], 'text-amber-500'], ['96%', c.statsLabels[2], 'text-violet-500'], ['#38', c.statsLabels[3], 'text-sky-500']].map(([v, l, col]) => (
                <div key={l} className={`rounded-xl border p-4 ${card}`}>
                  <p className={`text-2xl font-bold ${col}`}>{v}</p>
                  <p className={`text-xs mt-1 ${subtle}`}>{l}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className={`rounded-2xl border p-6 ${card}`}>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${subtle}`}>{c.chartTitle}</p>
              <p className="text-2xl font-bold mb-4">{c.chartSub}</p>
              <StatsChart dark={dark} />
              <p className={`text-xs mt-3 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{c.chartNote}</p>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── COMMUNITY ── */}
      <div className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
          <Reveal>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-violet-400' : 'text-violet-600'}`}>{c.communityTag}</p>
            <h2 className="text-3xl font-bold mb-4">{c.communityTitle}</h2>
            <p className={`text-base leading-7 mb-6 ${muted}`}>{c.communityDesc}</p>
            <ul className="space-y-3">
              {c.communityItems.map(item => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                  <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid grid-cols-2 gap-3">
              {[['alex_p', '94%', 1420, 1], ['marta_r', '88%', 1380, 2], ['juandev', '83%', 1310, 3], ['sofia_m', '79%', 1270, 4]].map(([name, score, elo, rank]) => (
                <div key={name} className={`rounded-xl border p-4 flex items-center gap-3 ${card}`}>
                  <span className={`text-base font-black tabular-nums ${rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-amber-700 dark:text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}>#{rank}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate dark:text-slate-200">{name}</p>
                    <p className={`text-xs ${subtle}`}>{score} · {elo} ELO</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── TOURNAMENTS ── */}
      <div className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
          <Reveal>
            <div className={`rounded-2xl border p-6 space-y-4 ${card}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-semibold px-2.5 py-0.5">{c.tourLive}</span>
                <span className={`text-xs ${subtle}`}>{c.tourEnds}</span>
              </div>
              <p className="text-lg font-bold">{c.tourName}</p>
              <p className={`text-sm leading-6 ${muted}`}>{c.tourCardDesc}</p>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex -space-x-2">
                  {['A','B','C','D'].map(l => (
                    <div key={l} className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-violet-400 bg-violet-500/15 ${dark ? 'border-slate-900' : 'border-white'}`}>{l}</div>
                  ))}
                </div>
                <span className={`text-xs ${subtle}`}>+48 {c.tourParticipants}</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-violet-400' : 'text-violet-600'}`}>{c.tourTag}</p>
            <h2 className="text-3xl font-bold mb-4">{c.tourTitle}</h2>
            <p className={`text-base leading-7 mb-6 ${muted}`}>{c.tourDesc}</p>
            <ul className="space-y-3">
              {c.tourItems.map(item => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                  <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>

      {/* ── GUIDES ── */}
      <div className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
          <Reveal>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-violet-400' : 'text-violet-600'}`}>{c.guidesTag}</p>
            <h2 className="text-3xl font-bold mb-4">{c.guidesTitle}</h2>
            <p className={`text-base leading-7 mb-6 ${muted}`}>{c.guidesDesc}</p>
            <ul className="space-y-3 mb-6">
              {c.guidesItems.map(item => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                  <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                </li>
              ))}
            </ul>
            <a href="/guides" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-500 hover:text-violet-400 transition">
              {c.guidesLink}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </a>
          </Reveal>
          <Reveal delay={100}>
            <div className="space-y-3">
              {c.guides.map(({ t, tag, time }, i) => (
                <div key={t} className={`rounded-xl border p-4 flex items-center gap-4 ${card}`}>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-violet-500/12' : 'bg-violet-50'}`}>
                    <svg className="h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{t}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${subtle}`}>{tag}</span>
                      <span className={`text-xs ${subtle}`}>·</span>
                      <div className="flex items-center gap-1">
                        <img 
                          src="https://media.tenor.com/nEoz_3Q6_1YAAAAj/hourglass-time.gif" 
                          alt="" 
                          className={`h-3 w-3 ${dark ? 'brightness-75' : 'brightness-100'}`}
                        />
                        <span className={`text-xs ${subtle}`}>{time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── ORGANIZATIONS ── */}
      <div className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-2xl mb-14">
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-violet-400' : 'text-violet-600'}`}>{c.orgTag}</p>
              <h2 className="text-3xl font-bold mb-4">{c.orgTitle}</h2>
              <p className={`text-base leading-7 ${muted}`}>{c.orgDesc}</p>
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {c.orgCards.map(({ icon, t, d }, i) => (
              <Reveal key={t} delay={i * 60}>
                <div className={`rounded-2xl border p-6 h-full ${card}`}>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${dark ? 'bg-violet-500/12' : 'bg-violet-50'}`}>
                    <OrgIcon type={icon} dark={dark} />
                  </div>
                  <p className="font-semibold mb-2">{t}</p>
                  <p className={`text-sm leading-6 ${muted}`}>{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROFILES ── */}
      <div className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
          <Reveal>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-violet-400' : 'text-violet-600'}`}>{c.profileTag}</p>
            <h2 className="text-3xl font-bold mb-4">{c.profileTitle}</h2>
            <p className={`text-base leading-7 mb-6 ${muted}`}>{c.profileDesc}</p>
            <ul className="space-y-3">
              {c.profileItems.map(item => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                  <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100}>
            <div className={`rounded-2xl border p-6 ${card}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center text-base font-bold text-violet-500">AP</div>
                <div>
                  <p className="font-bold dark:text-slate-100">alex_prompter</p>
                  <p className={`text-xs ${subtle}`}>{c.profileMember}</p>
                  <div className="flex gap-2 mt-1.5">
                    {[
                      { label: '#1', color: 'text-amber-400 bg-amber-400/10' },
                      { label: '14d', color: 'text-orange-400 bg-orange-400/10' },
                      { label: 'ELO', color: 'text-violet-400 bg-violet-400/10' },
                    ].map(({ label, color }) => (
                      <span key={label} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>{label}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[['1420', 'ELO'], ['81%', lang === 'en' ? 'Avg' : 'Prom.'], ['14d', lang === 'en' ? 'Streak' : 'Racha']].map(([v, l]) => (
                  <div key={l} className={`rounded-xl p-3 text-center ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-100'}`}>
                    <p className="text-base font-bold text-violet-500">{v}</p>
                    <p className={`text-[11px] ${subtle}`}>{l}</p>
                  </div>
                ))}
              </div>
              <StatsChart dark={dark} />
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div className="text-center space-y-6">
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
                {c.ctaTitle}
              </h2>
              <p className={`text-lg max-w-md mx-auto ${muted}`}>
                {c.ctaDesc}
              </p>
              <div className="flex flex-wrap gap-4 justify-center pt-4">
                <button 
                  type="button" 
                  onClick={onTryApp} 
                  className="inline-flex items-center justify-center rounded-full bg-violet-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-600/25 hover:shadow-xl hover:shadow-violet-600/30"
                >
                  {c.ctaPlay}
                </button>
                <button 
                  type="button" 
                  onClick={onOpenAuth} 
                  className={`inline-flex items-center justify-center rounded-full border-2 px-8 py-3.5 text-base font-semibold transition ${
                    dark 
                      ? 'border-white/20 text-white hover:bg-white/10' 
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {c.ctaSignup}
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

    </div>
  )
}

export default LandingPage
