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
    howTitle: 'Mira cómo funciona en tiempo real',
    howDesc: 'Esta es una demostración real del juego. Observa cómo se escribe un prompt, se envía y se compara con el original.',
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
    howTitle: 'See how it works in real time',
    howDesc: 'This is a real demonstration of the game. Watch how a prompt is written, submitted, and compared to the original.',
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
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />
    </div>
    <div className="mt-3 space-y-2 px-1 select-none" onCopy={e => e.preventDefault()}>
      <div className="flex items-center gap-2.5">
        {item.avatar_url
          ? <img src={proxyImg(item.avatar_url)} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-black/10 pointer-events-none" draggable={false} />
          : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/30 text-xs font-bold text-cyan-500">{(item.username || '?')[0].toUpperCase()}</div>
        }
        <span className="text-xs font-medium text-slate-400 dark:text-slate-400">{item.username || 'Anonymous'}</span>
        {item.is_dev && (
          <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-400 uppercase tracking-wide">DEV</span>
        )}
        {item.score != null && <span className="ml-auto rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-400">{item.score}%</span>}
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400 italic">"{item.prompt_usuario}"</p>
    </div>
  </div>
)

const Dots = ({ total, current, onSelect, dark }) => (
  <div className="flex items-center justify-center gap-1.5 pt-1">
    {Array.from({ length: total }).map((_, i) => (
      <button key={i} onClick={() => onSelect(i)} aria-label={`Slide ${i + 1}`}
        className={`rounded-full transition-all duration-300 ${i === current ? 'h-1.5 w-5 bg-cyan-500' : `h-1.5 w-1.5 ${dark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-300 hover:bg-slate-400'}`}`} />
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
          .limit(500)

        if (error || !data) return

        // Group by user, pick best per user
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
        
        // Shuffle the entire pool using Fisher-Yates
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]]
        }

        // Take random 10 from shuffled pool
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

  if (loading) return <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" /></div>
  if (!slides.length) return <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">{c.noSlides}</div>

  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{c.community}</p>
      <div className="relative flex-1">{slides.map((item, i) => <Slide key={i} item={item} visible={i === current} />)}</div>
      {slides.length > 1 && <Dots total={slides.length} current={current} onSelect={goTo} dark={dark} />}
    </div>
  )
}

// ── Animated Stats Component ──────────────────────────────────────────────
const AnimatedStats = ({ stats, dark }) => {
  const [isVisible, setIsVisible] = useState(false)
  const statsRef = useRef(null)
  const card = dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
  const subtle = dark ? 'text-slate-500' : 'text-slate-500'
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 }
    )
    
    if (statsRef.current) {
      observer.observe(statsRef.current)
    }
    
    return () => observer.disconnect()
  }, [isVisible])
  
  return (
    <div ref={statsRef} className="grid grid-cols-2 gap-4">
      {stats.map((stat, i) => (
        <div 
          key={stat.label} 
          className={`rounded-xl border p-5 ${card} group relative transition-all duration-300 hover:scale-105 hover:shadow-lg ${
            isVisible ? 'animate-in fade-in slide-in-from-bottom-4' : 'opacity-0'
          }`}
          style={{ animationDelay: `${i * 100}ms`, animationDuration: '600ms', animationFillMode: 'both' }}
          title={stat.desc}
        >
          <p className={`text-3xl font-bold ${stat.color} transition-transform duration-300 group-hover:scale-110`}>
            {stat.value}
          </p>
          <p className={`text-sm mt-2 ${subtle}`}>{stat.label}</p>
          
          {/* Tooltip on hover */}
          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 ${
            dark ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-white'
          } shadow-lg z-10`}>
            {stat.desc}
            <div className={`absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent ${
              dark ? 'border-t-slate-700' : 'border-t-slate-800'
            }`} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Chart ──────────────────────────────────────────────────────────────────
const CHART_DATA = [
  { day: 'M', score: 42 }, { day: 'T', score: 55 }, { day: 'W', score: 51 },
  { day: 'T', score: 68 }, { day: 'F', score: 63 }, { day: 'S', score: 74 },
  { day: 'S', score: 81 },
]

const StatsChart = ({ dark }) => {
  const [isVisible, setIsVisible] = useState(false)
  const chartRef = useRef(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 }
    )
    
    if (chartRef.current) {
      observer.observe(chartRef.current)
    }
    
    return () => observer.disconnect()
  }, [isVisible])
  
  return (
    <div ref={chartRef}>
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
          <Area 
            type="monotone" 
            dataKey="score" 
            stroke="#7c3aed" 
            strokeWidth={2} 
            fill="url(#sg)" 
            dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }} 
            isAnimationActive={isVisible}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Org icons (no emoji) ───────────────────────────────────────────────────
const OrgIcon = ({ type, dark }) => {
  const cls = `h-5 w-5 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`
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

// ── Interactive Demo Component ────────────────────────────────────────────
const InteractiveDemo = ({ dark, lang }) => {
  const [step, setStep] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0, visible: false })
  const [showComparison, setShowComparison] = useState(false)
  const [score, setScore] = useState(0)
  const [isClicking, setIsClicking] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const demoRef = useRef(null)
  
  // Datos reales de ejemplo - gato astronauta
  const demoImage = 'https://image-generator.com/assets/img/ai-generated-image-main.png'
  const userPrompt = 'Orange cat in astronaut suit in space with stars and Earth behind'
  const targetScore = 73
  
  const card = dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
  const muted = dark ? 'text-slate-400' : 'text-slate-600'
  
  // Sugerencias de mejora
  const improvements = lang === 'en' ? [
    'Add more details about the cat\'s appearance (breed, size, expression)',
    'Specify the lighting style (cinematic, natural, dramatic)',
    'Describe the astronaut suit in more detail',
    'Mention the art style (photorealistic, digital art, illustration)'
  ] : [
    'Agrega más detalles sobre la apariencia del gato (raza, tamaño, expresión)',
    'Especifica el estilo de iluminación (cinematográfica, natural, dramática)',
    'Describe el traje de astronauta con más detalle',
    'Menciona el estilo artístico (fotorrealista, arte digital, ilustración)'
  ]
  
  // Guías recomendadas
  const recommendedGuides = lang === 'en' ? [
    { title: 'How to describe artistic styles', tag: 'Basic' },
    { title: 'Visual description techniques', tag: 'Intermediate' },
    { title: 'Prompts for image generation', tag: 'Advanced' }
  ] : [
    { title: 'Cómo describir estilos artísticos', tag: 'Básico' },
    { title: 'Técnicas de descripción visual', tag: 'Intermedio' },
    { title: 'Prompts para generación de imágenes', tag: 'Avanzado' }
  ]
  
  // Intersection Observer para detectar cuando la demo es visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 }
    )
    
    if (demoRef.current) {
      observer.observe(demoRef.current)
    }
    
    return () => observer.disconnect()
  }, [isVisible])
  
  // Reset y loop de animación
  useEffect(() => {
    if (!isVisible) return
    
    const resetTimer = setTimeout(() => {
      setStep(0)
      setTypedText('')
      setCursorPos({ x: 0, y: 0, visible: false })
      setShowComparison(false)
      setScore(0)
      setIsClicking(false)
    }, 18000) // 18 segundos total (reducido de 19)
    
    return () => clearTimeout(resetTimer)
  }, [step, isVisible])
  
  useEffect(() => {
    if (!isVisible) return
    
    if (step === 0) {
      const timer = setTimeout(() => setStep(1), 1000)
      return () => clearTimeout(timer)
    }
    
    if (step === 1) {
      if (typedText.length < userPrompt.length) {
        const timer = setTimeout(() => {
          setTypedText(userPrompt.slice(0, typedText.length + 1))
        }, 25)
        return () => clearTimeout(timer)
      } else {
        setTimeout(() => setStep(2), 400)
      }
    }
    
    if (step === 2) {
      setCursorPos({ x: 0, y: 0, visible: true })
      const timer = setTimeout(() => {
        setCursorPos({ x: 50, y: 100, visible: true })
        setTimeout(() => setStep(3), 600)
      }, 200)
      return () => clearTimeout(timer)
    }
    
    if (step === 3) {
      setIsClicking(true)
      setTimeout(() => {
        setIsClicking(false)
        setCursorPos({ x: 50, y: 100, visible: false })
        setTimeout(() => {
          setShowComparison(true)
          setStep(4)
        }, 100)
      }, 150)
    }
    
    if (step === 4) {
      if (score < targetScore) {
        const timer = setTimeout(() => {
          setScore(prev => Math.min(prev + 3, targetScore))
        }, 25)
        return () => clearTimeout(timer)
      }
    }
  }, [step, typedText, score, isVisible])
  
  return (
    <div ref={demoRef} className={`rounded-2xl border p-6 lg:p-8 ${card} relative overflow-hidden`}>
      <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Left: Image - altura fija para evitar estiramiento */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${muted}`}>
              {lang === 'en' ? 'Today\'s Challenge' : 'Desafío de hoy'}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-500 font-semibold">
              {lang === 'en' ? 'Daily' : 'Diario'}
            </span>
          </div>
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900">
            <img 
              src={demoImage} 
              alt="Demo challenge" 
              className="w-full h-full object-cover object-center"
              loading="lazy"
              style={{ objectPosition: '50% 35%' }}
            />
          </div>
        </div>
        
        {/* Right: Prompt input and comparison */}
        <div className="space-y-3">
          <div className="space-y-2">
            <label className={`text-xs font-semibold ${muted}`}>
              {lang === 'en' ? 'Your prompt' : 'Tu prompt'}
            </label>
            <div className={`relative rounded-xl border ${dark ? 'border-slate-600 bg-slate-900' : 'border-slate-300 bg-white'} p-2.5 ${showComparison ? 'min-h-[60px]' : 'min-h-[100px]'} transition-all duration-300`}>
              <p className="text-sm leading-relaxed">
                {typedText}
                {step === 1 && <span className="inline-block w-0.5 h-4 bg-cyan-500 animate-pulse ml-0.5" />}
              </p>
            </div>
          </div>
          
          {/* Submit button - solo visible antes del resultado */}
          {!showComparison && (
            <div className="relative">
              <button 
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  step >= 2 
                    ? `bg-cyan-600 text-white shadow-lg shadow-cyan-500/30 ${isClicking ? 'scale-95 shadow-cyan-500/50' : 'scale-100'}` 
                    : dark 
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                }`}
                disabled={step < 2}
              >
                {lang === 'en' ? 'Submit prompt' : 'Enviar prompt'}
              </button>
              
              {/* Animated cursor */}
              {cursorPos.visible && (
                <div 
                  className="absolute pointer-events-none transition-all duration-700 ease-out z-10"
                  style={{ 
                    left: `${cursorPos.x}%`, 
                    top: `${cursorPos.y}%`,
                    transform: `translate(-25%, -25%) ${isClicking ? 'scale(0.9)' : 'scale(1)'}`
                  }}
                >
                  <svg className="w-6 h-6 drop-shadow-lg transition-transform" viewBox="0 0 24 24" fill="none">
                    <path d="M5.5 3.5L18.5 12L11 13.5L8.5 20.5L5.5 3.5Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M11 13.5L14.5 17" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </div>
          )}
          
          {/* Comparison result */}
          {showComparison && (
            <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Score badge */}
              <div className={`rounded-xl border p-3 ${
                score >= 70 
                  ? dark ? 'border-emerald-800 bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50'
                  : dark ? 'border-amber-800 bg-amber-900/20' : 'border-amber-200 bg-amber-50'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-semibold ${
                    score >= 70
                      ? dark ? 'text-emerald-400' : 'text-emerald-700'
                      : dark ? 'text-amber-400' : 'text-amber-700'
                  }`}>
                    {lang === 'en' ? 'Similarity Score' : 'Score de similitud'}
                  </span>
                  <span className={`text-2xl font-black ${
                    score >= 70
                      ? dark ? 'text-emerald-400' : 'text-emerald-600'
                      : dark ? 'text-amber-400' : 'text-amber-600'
                  }`}>
                    {score}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out ${
                      score >= 70
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : 'bg-gradient-to-r from-amber-500 to-amber-400'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
              
              {/* Suggestions for improvement */}
              <div className={`rounded-xl border p-3 ${dark ? 'border-cyan-800 bg-cyan-900/20' : 'border-cyan-200 bg-cyan-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-3.5 h-3.5 text-cyan-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className={`text-xs font-semibold ${dark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                    {lang === 'en' ? 'How to improve' : 'Cómo mejorar'}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {improvements.map((improvement, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                      <span className="text-cyan-500 shrink-0 mt-0.5">•</span>
                      <span className={dark ? 'text-slate-300' : 'text-slate-700'}>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Recommended guides */}
              <div className={`rounded-xl border p-3 ${dark ? 'border-blue-800 bg-blue-900/20' : 'border-blue-200 bg-blue-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  <span className={`text-xs font-semibold ${dark ? 'text-blue-400' : 'text-blue-700'}`}>
                    {lang === 'en' ? 'Recommended guides' : 'Guías recomendadas'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {recommendedGuides.map((guide, i) => (
                    <div key={i} className={`flex items-center justify-between text-xs p-2 rounded-lg ${dark ? 'bg-slate-800/50' : 'bg-white/50'}`}>
                      <span className={`${dark ? 'text-slate-300' : 'text-slate-700'} text-xs leading-tight`}>{guide.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${dark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                        {guide.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
const LandingPage = ({ onOpenAuth, onTryApp }) => {
  const { theme } = useTheme()
  const dark = false // La landing siempre en modo claro
  const [lang] = useState(detectLang)
  const [currentSection, setCurrentSection] = useState(0)
  const containerRef = useRef(null)
  const sectionRefs = useRef([])
  const isScrolling = useRef(false)
  const currentIdx = useRef(0)
  const c = copy[lang]

  const TOTAL_SECTIONS = 9

  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

  const animateScrollTo = (targetIdx) => {
    const container = containerRef.current
    if (!container || isScrolling.current) return
    const from = container.scrollTop
    const to = targetIdx * container.clientHeight
    if (Math.abs(from - to) < 2) return
    isScrolling.current = true
    currentIdx.current = targetIdx
    setCurrentSection(targetIdx)
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
        isScrolling.current = false
      }
    }
    requestAnimationFrame(step)
  }

  // Wheel: una sección por evento
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

  // Touch: swipe vertical
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

  const scrollTo = (i) => animateScrollTo(i)

  const base = dark ? 'bg-slate-900 text-white' : 'bg-gray-50 text-slate-900'
  const card = dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
  const muted = dark ? 'text-slate-400' : 'text-slate-600'
  const subtle = dark ? 'text-slate-500' : 'text-slate-500'

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Dots de navegación lateral */}
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2.5">
        {Array.from({ length: TOTAL_SECTIONS }).map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={`Sección ${i + 1}`}
            className={`rounded-full transition-all duration-300 ${
              i === currentSection
                ? 'h-6 w-2 bg-cyan-500'
                : `h-2 w-2 ${dark ? 'bg-slate-600 hover:bg-slate-400' : 'bg-slate-300 hover:bg-slate-500'}`
            }`}
          />
        ))}
      </div>

      {/* Contenedor — scroll controlado por JS */}
      <div
        ref={containerRef}
        className={`h-full overflow-y-scroll ${base}`}
        style={{ overscrollBehavior: 'none' }}
      >

        {/* ── HERO ── */}
        <section style={{ minHeight: '100vh' }}
          className="relative flex items-center px-6 py-20 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <div className="space-y-8">
                <div className="space-y-6">
                  <h1 className="text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                    {c.h1a}{' '}<span className="text-cyan-500">{c.h1b}</span>
                  </h1>
                  <p className={`max-w-md text-lg leading-relaxed ${muted}`}>{c.sub}</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button type="button" onClick={onTryApp} className="inline-flex items-center justify-center rounded-lg bg-cyan-600 px-8 py-3.5 text-sm font-semibold text-white hover:bg-cyan-700 transition">
                    {c.cta1}
                  </button>
                  <button type="button" onClick={onOpenAuth} className={`inline-flex items-center justify-center rounded-lg border px-8 py-3.5 text-sm font-semibold transition ${dark ? 'border-slate-700 text-white hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                    {c.cta2}
                  </button>
                </div>
              </div>
              <div className={`relative overflow-hidden rounded-2xl border p-6 lg:h-[520px] ${card}`}>
                <div className="relative h-full">
                  <CommunitySlideshow dark={dark} lang={lang} />
                </div>
              </div>
            </div>
            {/* Flecha hacia abajo */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
              <button onClick={() => scrollTo(1)} className={`${dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'} transition`}>
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section style={{ minHeight: '100vh' }}
          className="flex items-center px-6 py-20 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="text-center mb-12">
              <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>{c.howTag}</p>
              <h2 className="text-4xl font-bold mb-4">{c.howTitle}</h2>
              <p className={`text-lg leading-relaxed max-w-2xl mx-auto ${muted}`}>{c.howDesc}</p>
            </div>
            <InteractiveDemo dark={dark} lang={lang} />
          </div>
        </section>

        {/* ── PROGRESS ── */}
        <section style={{ minHeight: '100vh' }}
          className="flex items-center px-6 py-20 lg:px-8">
          <div className="mx-auto w-full max-w-6xl grid gap-20 lg:grid-cols-2 items-center">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>{c.progressTag}</p>
              <h2 className="text-4xl font-bold mb-6">{c.progressTitle}</h2>
              <p className={`text-lg leading-relaxed mb-10 ${muted}`}>{c.progressDesc}</p>
              <AnimatedStats stats={[
                { value: '74%', label: c.statsLabels[0], color: 'text-emerald-500', desc: lang === 'en' ? 'Average similarity across all attempts' : 'Similitud promedio en todos los intentos' },
                { value: '12d', label: c.statsLabels[1], color: 'text-amber-500', desc: lang === 'en' ? 'Consecutive days playing' : 'Días consecutivos jugando' },
                { value: '96%', label: c.statsLabels[2], color: 'text-cyan-500', desc: lang === 'en' ? 'Your highest score achieved' : 'Tu puntaje más alto logrado' },
                { value: '#38', label: c.statsLabels[3], color: 'text-sky-500', desc: lang === 'en' ? 'Your position in the global ranking' : 'Tu posición en el ranking global' }
              ]} dark={dark} />
            </div>
            <div className={`rounded-2xl border p-8 ${card}`}>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${subtle}`}>{c.chartTitle}</p>
              <p className="text-3xl font-bold mb-6">{c.chartSub}</p>
              <StatsChart dark={dark} />
            </div>
          </div>
        </section>

        {/* ── COMMUNITY ── */}
        <section style={{ minHeight: '100vh' }}
          className="flex items-center px-6 py-20 lg:px-8">
          <div className="mx-auto w-full max-w-6xl grid gap-20 lg:grid-cols-2 items-center">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>{c.communityTag}</p>
              <h2 className="text-4xl font-bold mb-6">{c.communityTitle}</h2>
              <p className={`text-lg leading-relaxed mb-8 ${muted}`}>{c.communityDesc}</p>
              <ul className="space-y-4">
                {c.communityItems.map(item => (
                  <li key={item} className="flex items-center gap-3 text-base leading-relaxed">
                    <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                    <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[['alex_p', '94%', 1420, 1], ['marta_r', '88%', 1380, 2], ['juandev', '83%', 1310, 3], ['sofia_m', '79%', 1270, 4]].map(([name, score, elo, rank]) => (
                <div key={name} className={`rounded-xl border p-5 flex items-center gap-3 ${card}`}>
                  <span className={`text-lg font-black tabular-nums ${rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-amber-700 dark:text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}>#{rank}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate dark:text-slate-200">{name}</p>
                    <p className={`text-xs leading-relaxed ${subtle}`}>{score} · {elo} ELO</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TOURNAMENTS ── */}
        <section style={{ minHeight: '100vh' }}
          className="flex items-center px-6 py-20 lg:px-8">
          <div className="mx-auto w-full max-w-6xl grid gap-20 lg:grid-cols-2 items-center">
            <div className={`rounded-2xl border p-8 space-y-5 ${card}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-cyan-500/15 text-cyan-500 text-xs font-semibold px-3 py-1">{c.tourLive}</span>
                <span className={`text-xs ${subtle}`}>{c.tourEnds}</span>
              </div>
              <p className="text-xl font-bold">{c.tourName}</p>
              <p className={`text-base leading-relaxed ${muted}`}>{c.tourCardDesc}</p>
              <div className="flex items-center gap-3 pt-2">
                <div className="flex -space-x-2">
                  {['A','B','C','D'].map(l => (
                    <div key={l} className={`h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-cyan-400 bg-cyan-500/15 ${dark ? 'border-slate-900' : 'border-white'}`}>{l}</div>
                  ))}
                </div>
                <span className={`text-xs ${subtle}`}>+48 {c.tourParticipants}</span>
              </div>
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>{c.tourTag}</p>
              <h2 className="text-4xl font-bold mb-6">{c.tourTitle}</h2>
              <p className={`text-lg leading-relaxed mb-8 ${muted}`}>{c.tourDesc}</p>
              <ul className="space-y-4">
                {c.tourItems.map(item => (
                  <li key={item} className="flex items-center gap-3 text-base leading-relaxed">
                    <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                    <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── GUIDES ── */}
        <section style={{ minHeight: '100vh' }}
          className="flex items-center px-6 py-20 lg:px-8">
          <div className="mx-auto w-full max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>{c.guidesTag}</p>
              <h2 className="text-3xl font-bold mb-4">{c.guidesTitle}</h2>
              <p className={`text-base leading-7 mb-6 ${muted}`}>{c.guidesDesc}</p>
              <ul className="space-y-3 mb-6">
                {c.guidesItems.map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shrink-0" />
                    <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="/guides" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-500 hover:text-cyan-400 transition">
                {c.guidesLink}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </a>
            </div>
            <div className="space-y-3">
              {c.guides.map(({ t, tag, time }) => (
                <div key={t} className={`rounded-xl border p-4 flex items-center gap-4 ${card}`}>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-cyan-500/15' : 'bg-cyan-100'}`}>
                    <svg className="h-5 w-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{t}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${subtle}`}>{tag}</span>
                      <span className={`text-xs ${subtle}`}>·</span>
                      <span className={`text-xs ${subtle}`}>{time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ORGANIZATIONS ── */}
        <section style={{ minHeight: '100vh' }}
          className="flex items-center px-6 py-20 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl mb-12">
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>{c.orgTag}</p>
              <h2 className="text-3xl font-bold mb-4">{c.orgTitle}</h2>
              <p className={`text-base leading-7 ${muted}`}>{c.orgDesc}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {c.orgCards.map(({ icon, t, d }) => (
                <div key={t} className={`rounded-2xl border p-6 h-full ${card}`}>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${dark ? 'bg-cyan-500/15' : 'bg-cyan-100'}`}>
                    <OrgIcon type={icon} dark={dark} />
                  </div>
                  <p className="font-semibold mb-2">{t}</p>
                  <p className={`text-sm leading-6 ${muted}`}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PROFILES ── */}
        <section style={{ minHeight: '100vh' }}
          className="flex items-center px-6 py-20 lg:px-8">
          <div className="mx-auto w-full max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>{c.profileTag}</p>
              <h2 className="text-3xl font-bold mb-4">{c.profileTitle}</h2>
              <p className={`text-base leading-7 mb-6 ${muted}`}>{c.profileDesc}</p>
              <ul className="space-y-3">
                {c.profileItems.map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shrink-0" />
                    <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`rounded-2xl border p-6 ${card}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-base font-bold text-cyan-500">AP</div>
                <div>
                  <p className="font-bold dark:text-slate-100">alex_prompter</p>
                  <p className={`text-xs ${subtle}`}>{c.profileMember}</p>
                  <div className="flex gap-2 mt-1.5">
                    {[{ label: '#1', color: 'text-amber-400 bg-amber-400/10' }, { label: '14d', color: 'text-orange-400 bg-orange-400/10' }, { label: 'ELO', color: 'text-cyan-400 bg-cyan-400/10' }].map(({ label, color }) => (
                      <span key={label} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>{label}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[['1420', 'ELO'], ['81%', lang === 'en' ? 'Avg' : 'Prom.'], ['14d', lang === 'en' ? 'Streak' : 'Racha']].map(([v, l]) => (
                  <div key={l} className={`rounded-xl p-3 text-center ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-100'}`}>
                    <p className="text-base font-bold text-cyan-500">{v}</p>
                    <p className={`text-[11px] ${subtle}`}>{l}</p>
                  </div>
                ))}
              </div>
              <StatsChart dark={dark} />
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{ minHeight: '100vh' }}
          className="flex items-center justify-center px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-4xl text-center space-y-6">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">{c.ctaTitle}</h2>
            <p className={`text-lg max-w-md mx-auto ${muted}`}>{c.ctaDesc}</p>
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <button type="button" onClick={onTryApp}
                className="inline-flex items-center justify-center rounded-lg bg-cyan-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-cyan-700 transition">
                {c.ctaPlay}
              </button>
              <button type="button" onClick={onOpenAuth}
                className={`inline-flex items-center justify-center rounded-lg border-2 px-8 py-3.5 text-base font-semibold transition ${dark ? 'border-slate-700 text-white hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                {c.ctaSignup}
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}


export default LandingPage
