import { useTheme } from '../contexts/ThemeContext'

const EnterpriseLanding = ({ onBack }) => {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  const bg = dark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'
  const card = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
  const muted = dark ? 'text-slate-400' : 'text-slate-500'
  const subtle = dark ? 'text-slate-500' : 'text-slate-400'
  const accent = 'text-violet-500'
  const accentBg = dark ? 'bg-violet-500/10' : 'bg-violet-50'

  const features = [
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'Dashboard de analytics',
      desc: 'Seguimiento en tiempo real del progreso de cada miembro. Score promedio, ELO, participación, tendencias y alertas automáticas.',
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Desafíos personalizados',
      desc: 'Crea desafíos con tus propias imágenes. Configura dificultad, tiempo límite, intentos máximos y visibilidad.',
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
      title: 'Guías asignables',
      desc: 'Asigna guías del catálogo o crea las tuyas propias con lecciones, quiz, pasos y checkpoints. Con fecha límite y notificaciones.',
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: 'Gestión de equipo',
      desc: 'Invita miembros por email o link. Asigna roles (manager, analyst, trainee), renombra en contexto de empresa y gestiona el acceso.',
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      title: 'Ranking interno',
      desc: 'Cada empresa tiene su propio leaderboard. Competencia sana dentro del equipo con ELO y métricas comparativas.',
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      title: 'Chatbot IA',
      desc: 'Asistente de IA integrado para analizar el rendimiento del equipo, sugerir acciones y gestionar miembros por lenguaje natural.',
    },
  ]

  const challengeFeatures = [
    { label: 'Imagen propia o generada por IA' },
    { label: 'Dificultad: Easy / Medium / Hard' },
    { label: 'Tiempo límite configurable' },
    { label: 'Intentos máximos' },
    { label: 'Visibilidad: privado o público' },
    { label: 'Evaluación: estándar, estricta o flexible' },
    { label: 'Hints para guiar al equipo' },
    { label: 'Puntos y recompensas' },
  ]

  const guideFeatures = [
    { label: 'Lecciones con texto, imágenes y video' },
    { label: 'Quiz de comprensión con corrección automática' },
    { label: 'Pasos guiados con checkpoints' },
    { label: 'Fecha límite y recordatorios' },
    { label: 'Asignación por rol o miembro' },
    { label: 'Progreso visible en el dashboard' },
  ]

  return (
    <div className={`min-h-screen ${bg}`}>

      {/* ── HERO ── */}
      <section
        style={{ minHeight: '100vh' }}
        className="relative flex items-center px-6 py-20 lg:px-8"
      >
        {/* Botón volver */}
        <button
          type="button"
          onClick={onBack}
          className={`absolute top-6 left-6 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            dark
              ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
              : 'border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>

        <div className="mx-auto w-full max-w-5xl text-center space-y-8">
          {/* Badge */}
          <div className="flex justify-center">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold ${
                dark
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-400'
                  : 'border-violet-200 bg-violet-50 text-violet-600'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Para empresas y equipos
            </span>
          </div>

          <h1 className="text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Entrena a tu equipo en{' '}
            <span className="text-violet-500">IA generativa</span>
          </h1>

          <p className={`max-w-2xl mx-auto text-lg leading-relaxed ${muted}`}>
            PrompTool Enterprise es la plataforma de entrenamiento en prompt engineering para equipos. Mide el progreso, crea desafíos propios y forma a tu equipo con herramientas reales.
          </p>

          <div className="flex flex-wrap gap-4 justify-center pt-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-violet-700 transition"
            >
              Solicitar demo
            </button>
            <a
              href="#features"
              className={`inline-flex items-center justify-center rounded-lg border-2 px-8 py-3.5 text-base font-semibold transition ${
                dark
                  ? 'border-slate-700 text-white hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Ver cómo funciona ↓
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-6 pt-4">
            {['Dashboard en tiempo real', 'Desafíos personalizados', 'Guías asignables'].map((stat) => (
              <div
                key={stat}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
                  dark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                {stat}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        id="features"
        style={{ minHeight: '100vh' }}
        className="flex items-center px-6 py-20 lg:px-8"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="text-center mb-14">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accent}`}>
              Funcionalidades
            </p>
            <h2 className="text-4xl font-bold">Todo lo que necesita tu equipo</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon, title, desc }) => (
              <div
                key={title}
                className={`rounded-2xl border p-6 ${card}`}
              >
                <div
                  className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${accentBg} ${accent}`}
                >
                  {icon}
                </div>
                <p className="font-semibold mb-2">{title}</p>
                <p className={`text-sm leading-6 ${muted}`}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DASHBOARD PREVIEW ── */}
      <section
        style={{ minHeight: '100vh' }}
        className="flex items-center px-6 py-20 lg:px-8"
      >
        <div className="mx-auto w-full max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accent}`}>
              Panel de control
            </p>
            <h2 className="text-4xl font-bold mb-6">Visibilidad total del equipo</h2>
            <p className={`text-lg leading-relaxed mb-8 ${muted}`}>
              Un dashboard centralizado con todas las métricas que necesitas para tomar decisiones sobre el entrenamiento de tu equipo.
            </p>
            <ul className="space-y-4">
              {[
                'Score promedio del equipo con objetivo configurable (70%)',
                'Tasa de participación y miembros activos',
                'Detección automática de miembros en riesgo',
                'Tendencias de mejora por miembro',
                'Insights y recomendaciones automáticas con IA',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-base leading-relaxed">
                  <span className="mt-2 h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                  <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup dashboard */}
          <div className={`rounded-2xl border p-6 space-y-4 ${card}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-sm">Dashboard del equipo</p>
              <span className={`text-xs px-2 py-1 rounded-full ${accentBg} ${accent} font-semibold`}>
                En vivo
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl p-4 ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                <p className="text-2xl font-black text-emerald-500">74%</p>
                <p className={`text-xs mt-1 ${subtle}`}>Score Prom.</p>
              </div>
              <div className={`rounded-xl p-4 ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                <p className="text-2xl font-black text-amber-500">83%</p>
                <p className={`text-xs mt-1 ${subtle}`}>Participación</p>
              </div>
              <div className={`rounded-xl p-4 ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                <p className="text-2xl font-black text-violet-500">6</p>
                <p className={`text-xs mt-1 ${subtle}`}>Mejorando</p>
              </div>
              <div className={`rounded-xl p-4 ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
                <p className="text-2xl font-black text-sky-500">1240</p>
                <p className={`text-xs mt-1 ${subtle}`}>ELO Prom.</p>
              </div>
            </div>
            <div className={`rounded-xl p-4 ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
              <p className={`text-xs font-semibold mb-3 ${subtle}`}>Miembros destacados</p>
              <div className="space-y-2">
                {[['maria_g', '91%', 1380], ['carlos_r', '84%', 1290], ['ana_p', '78%', 1210]].map(([name, score, elo]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-500 font-semibold">{score}</span>
                      <span className={`text-xs ${subtle}`}>{elo} ELO</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CHALLENGES ── */}
      <section
        style={{ minHeight: '100vh' }}
        className="flex items-center px-6 py-20 lg:px-8"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accent}`}>
                Desafíos
              </p>
              <h2 className="text-4xl font-bold mb-6">Crea desafíos a medida</h2>
              <p className={`text-lg leading-relaxed mb-8 ${muted}`}>
                Diseña desafíos con tus propias imágenes o genera nuevas con IA. Configura cada parámetro para adaptarlo al nivel y objetivos de tu equipo.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {challengeFeatures.map(({ label }) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${card}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                    <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockup challenge creator */}
            <div className={`rounded-2xl border p-6 space-y-4 ${card}`}>
              <p className="font-bold text-sm">Nuevo desafío</p>
              <div className={`rounded-xl border p-4 space-y-3 ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}>
                <div className={`h-32 rounded-lg flex items-center justify-center ${dark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <svg className={`h-8 w-8 ${subtle}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[['Dificultad', 'Medium'], ['Tiempo', '3 min'], ['Intentos', '3'], ['Visibilidad', 'Privado']].map(([k, v]) => (
                    <div key={k} className={`rounded-lg p-2 ${dark ? 'bg-slate-900' : 'bg-white border border-slate-200'}`}>
                      <p className={`text-[10px] ${subtle}`}>{k}</p>
                      <p className="text-xs font-semibold mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
              >
                Publicar desafío
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── GUIDES ── */}
      <section
        style={{ minHeight: '100vh' }}
        className="flex items-center px-6 py-20 lg:px-8"
      >
        <div className="mx-auto w-full max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${accent}`}>
              Guías
            </p>
            <h2 className="text-4xl font-bold mb-6">Forma a tu equipo con guías propias</h2>
            <p className={`text-lg leading-relaxed mb-8 ${muted}`}>
              Crea guías de aprendizaje estructuradas con lecciones, quizzes y checkpoints. Asígnalas a tu equipo con fecha límite y sigue el progreso desde el dashboard.
            </p>
            <ul className="space-y-4">
              {guideFeatures.map(({ label }) => (
                <li key={label} className="flex items-center gap-3 text-base leading-relaxed">
                  <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                  <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup guía */}
          <div className={`rounded-2xl border p-6 space-y-3 ${card}`}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">Guía: Prompt Engineering Básico</p>
              <span className={`text-xs px-2 py-1 rounded-full ${accentBg} ${accent} font-semibold`}>
                Asignada
              </span>
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
                    : dark ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'
                }`}
              >
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                    done ? 'bg-emerald-500' : dark ? 'bg-slate-700' : 'bg-slate-200'
                  }`}
                >
                  {done ? (
                    <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-[10px] font-bold ${subtle}`}>○</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${done ? 'text-emerald-500' : subtle}`}>
                    {type}
                  </p>
                  <p className="text-sm font-medium truncate">{title}</p>
                </div>
              </div>
            ))}
            <div className={`rounded-xl p-3 ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs ${subtle}`}>Progreso</span>
                <span className="text-xs font-semibold text-violet-500">50%</span>
              </div>
              <div className={`h-1.5 rounded-full ${dark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <div className="h-1.5 w-1/2 rounded-full bg-violet-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section
        style={{ minHeight: '100vh' }}
        className="flex items-center justify-center px-6 py-20 lg:px-8"
      >
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
            ¿Listo para entrenar a tu equipo?
          </h2>
          <p className={`text-lg max-w-md mx-auto ${muted}`}>
            Crea tu cuenta enterprise, invita a tu equipo y empieza a medir el progreso desde el primer día.
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-10 py-4 text-base font-semibold text-white hover:bg-violet-700 transition"
            >
              Crear cuenta enterprise
            </button>
            <button
              type="button"
              onClick={onBack}
              className={`inline-flex items-center justify-center rounded-lg border-2 px-8 py-3.5 text-base font-semibold transition ${
                dark
                  ? 'border-slate-700 text-white hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Volver a la landing
            </button>
          </div>
          <p className={`text-sm ${subtle}`}>Sin tarjeta de crédito. Sin configuración compleja.</p>
        </div>
      </section>

    </div>
  )
}

export default EnterpriseLanding
