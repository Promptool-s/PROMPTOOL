import { useEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import { supabase } from './supabaseClient'
import { useAuth } from './hooks/useAuth'
import { useLang } from './contexts/LangContext'
import AuthModal from './components/AuthModal'
import firstAttemptSvg from './assets/medals/first_attempt.svg'
import { proxyImg } from './utils/imgProxy'

function Countdown({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState({})

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate) - new Date()
      if (diff <= 0) return setTimeLeft({ expired: true })
      setTimeLeft({
        days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (timeLeft.expired) return <span className="text-emerald-600 font-semibold">Live now!</span>

  return (
    <div className="flex items-center gap-3">
      {[
        { val: timeLeft.days,    label: 'd' },
        { val: timeLeft.hours,   label: 'h' },
        { val: timeLeft.minutes, label: 'm' },
        { val: timeLeft.seconds, label: 's' },
      ].map(({ val, label }) => (
        <div key={label} className="flex flex-col items-center">
          <span className="text-2xl font-bold text-slate-900 tabular-nums w-10 text-center">
            {String(val ?? 0).padStart(2, '0')}
          </span>
          <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        </div>
      ))}
    </div>
  )
}

const STATUS_STYLES = {
  upcoming: 'bg-amber-100 text-amber-700',
  active:   'bg-emerald-100 text-emerald-700',
  finished: 'bg-slate-100 text-slate-500',
}

function TournamentsApp() {
  const { lang } = useLang()
  const { user, loading: authLoading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(null)
  const [registered, setRegistered] = useState({}) // id_torneo → bool
  const [leaderboards, setLeaderboards] = useState({}) // id_torneo → []
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const fetchTournaments = async () => {
      const { data } = await supabase
        .from('torneos')
        .select('*')
        .order('fecha_inicio', { ascending: true })
      setTournaments(data || [])

      // Check registration for each tournament
      if (user && data?.length) {
        const ids = data.map(t => t.id_torneo)
        const { data: regs } = await supabase
          .from('torneo_participantes')
          .select('id_torneo')
          .eq('id_usuario', user.id)
          .in('id_torneo', ids)
        const regMap = {}
        regs?.forEach(r => { regMap[r.id_torneo] = true })
        setRegistered(regMap)
      }

      setLoading(false)
    }
    fetchTournaments()
  }, [user])

  const fetchLeaderboard = async (id_torneo) => {
    const { data } = await supabase
      .from('torneo_participantes')
      .select('id_usuario, score_total, intentos_completados, usuarios(nombre, nombre_display, username, avatar_url)')
      .eq('id_torneo', id_torneo)
      .order('score_total', { ascending: false })
      .limit(20)
    setLeaderboards(prev => ({ ...prev, [id_torneo]: data || [] }))
  }

  const handleRegister = async (id_torneo) => {
    if (!user) return alert(lang === 'en' ? 'Sign in to register' : 'Iniciá sesión para inscribirte')
    setRegistering(id_torneo)
    try {
      const { error } = await supabase
        .from('torneo_participantes')
        .insert([{ id_torneo, id_usuario: user.id }])
      if (error) throw error
      setRegistered(prev => ({ ...prev, [id_torneo]: true }))
    } catch (err) {
      alert(err.message)
    } finally {
      setRegistering(null)
    }
  }

  const toggleExpand = (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    fetchLeaderboard(id)
  }

  const getDisplayName = (u) => u?.nombre_display || u?.nombre || u?.username || 'User'

  const statusLabel = (s) => {
    if (s === 'upcoming') return lang === 'en' ? 'Upcoming' : 'Próximo'
    if (s === 'active')   return lang === 'en' ? 'Live' : 'En curso'
    return lang === 'en' ? 'Finished' : 'Finalizado'
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
          </svg>
          <h2 className="text-xl font-semibold text-slate-800">
            {lang === 'en' ? 'Sign in to access tournaments' : 'Iniciá sesión para acceder a los torneos'}
          </h2>
          <p className="text-sm text-slate-500 max-w-xs">
            {lang === 'en'
              ? 'Tournaments are available to registered users only.'
              : 'Los torneos están disponibles solo para usuarios registrados.'}
          </p>
          <button onClick={() => setAuthOpen(true)}
            className="mt-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition"
            style={{ backgroundColor: 'rgb(var(--color-accent))' }}>
            {lang === 'en' ? 'Sign in' : 'Iniciar sesión'}
          </button>
        </main>
        <Footer />
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)}
          onSignInWithGoogle={signInWithGoogle}
          onSignInWithEmail={signInWithEmail}
          onSignUpWithEmail={signUpWithEmail} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
            {lang === 'en' ? 'Every 15 days' : 'Cada 15 días'}
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            {lang === 'en' ? 'Tournaments' : 'Torneos'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {lang === 'en'
              ? 'Compete against other players in timed prompt challenges.'
              : 'Competí contra otros jugadores en desafíos de prompts cronometrados.'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-500">
              {lang === 'en' ? 'No tournaments yet. Check back soon.' : 'No hay torneos todavía. Volvé pronto.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tournaments.map(t => {
              const isUpcoming = t.estado === 'upcoming'
              const isActive   = t.estado === 'active'
              const isFinished = t.estado === 'finished'
              const isReg      = registered[t.id_torneo]
              const isExpanded = expanded === t.id_torneo

              return (
                <div key={t.id_torneo}
                  className={`rounded-2xl border bg-white overflow-hidden transition ${
                    isActive ? 'border-emerald-300 shadow-md' : 'border-slate-200'
                  }`}>

                  {/* Active banner */}
                  {isActive && (
                    <div className="bg-emerald-500 px-5 py-2 text-xs font-bold text-white uppercase tracking-widest text-center">
                      {lang === 'en' ? 'Tournament in progress' : 'Torneo en curso'}
                    </div>
                  )}

                  {/* First tournament exclusivity banner */}
                  {t.nombre.includes('#1') && !isFinished && (
                    <div className="bg-gradient-to-r from-amber-500 to-yellow-400 px-5 py-2.5 text-center">
                      <p className="text-xs font-bold text-white uppercase tracking-widest">
                        {lang === 'en'
                          ? 'First official tournament — exclusive medal, never awarded again'
                          : 'Primer torneo oficial — medalla exclusiva, nunca se volverá a otorgar'}
                      </p>
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[t.estado]}`}>
                            {statusLabel(t.estado)}
                          </span>
                          {t.formato && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500 font-medium">
                              {t.formato}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">{t.nombre}</h2>
                        {t.descripcion && (
                          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{t.descripcion}</p>
                        )}

                        {/* Format details */}
                        {t.formato === 'sprint' && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-center">
                              <p className="text-lg font-bold text-slate-900">5</p>
                              <p className="text-xs text-slate-500">{lang === 'en' ? 'images' : 'imágenes'}</p>
                            </div>
                            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-center">
                              <p className="text-lg font-bold text-rose-700">Hard</p>
                              <p className="text-xs text-rose-500">{lang === 'en' ? 'difficulty' : 'dificultad'}</p>
                            </div>
                            <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-center">
                              <p className="text-lg font-bold text-indigo-700">24h</p>
                              <p className="text-xs text-indigo-500">{lang === 'en' ? 'to play' : 'para jugar'}</p>
                            </div>
                          </div>
                        )}
                        {t.premio_descripcion && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">
                              {lang === 'en' ? 'Prize' : 'Premio'}
                            </p>
                            <div className="space-y-2">
                              {/* Medal highlight */}
                              <div className="flex items-start gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2.5">
                                <img src={firstAttemptSvg} alt="medal" className="h-8 w-8 shrink-0" />
                                <div>
                                  <p className="text-sm font-bold text-slate-900">
                                    {lang === 'en' ? 'Exclusive "Prompt Sprint #1" Medal' : 'Medalla exclusiva "Prompt Sprint #1"'}
                                  </p>
                                  <p className="text-xs text-amber-700 font-semibold mt-0.5">
                                    {lang === 'en'
                                      ? 'Only 1 edition — will never be awarded again'
                                      : 'Solo 1 edición — nunca se volverá a otorgar'}
                                  </p>
                                </div>
                              </div>
                              {/* Premium */}
                              <div className="flex items-center gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                                  <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">
                                    {lang === 'en' ? '3-month Premium subscription' : 'Suscripción Premium 3 meses'}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {lang === 'en' ? 'For the winner' : 'Para el ganador'}
                                  </p>
                                </div>
                              </div>
                              {/* Permanent badge */}
                              <div className="flex items-center gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100">
                                  <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">
                                    {lang === 'en' ? 'Permanent badge on profile' : 'Badge permanente en el perfil'}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {lang === 'en' ? 'Visible forever' : 'Visible para siempre'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right side */}
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        {isUpcoming && (
                          <div className="text-right">
                            <p className="text-xs text-slate-400 mb-2">
                              {lang === 'en' ? 'Starts in' : 'Empieza en'}
                            </p>
                            <Countdown targetDate={t.fecha_inicio} />
                          </div>
                        )}

                        <div className="text-right text-xs text-slate-400">
                          <p>{new Date(t.fecha_inicio).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          <p>→ {new Date(t.fecha_fin).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>

                        {(isUpcoming || isActive) && (
                          isReg ? (
                            <span className="rounded-xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
                              {lang === 'en' ? 'Registered' : 'Inscripto'}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRegister(t.id_torneo)}
                              disabled={registering === t.id_torneo}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition disabled:opacity-50"
                            >
                              {registering === t.id_torneo
                                ? '...'
                                : lang === 'en' ? 'Register' : 'Inscribirme'}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Expand leaderboard */}
                    <button
                      onClick={() => toggleExpand(t.id_torneo)}
                      className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                    >
                      <svg className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {lang === 'en' ? 'Leaderboard' : 'Tabla de posiciones'}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 rounded-xl border border-slate-100 overflow-hidden">
                        {!leaderboards[t.id_torneo] ? (
                          <div className="py-6 text-center text-sm text-slate-400">Loading...</div>
                        ) : leaderboards[t.id_torneo].length === 0 ? (
                          <div className="py-6 text-center text-sm text-slate-400">
                            {lang === 'en' ? 'No participants yet' : 'Sin participantes todavía'}
                          </div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400">#</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400">
                                  {lang === 'en' ? 'Player' : 'Jugador'}
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-400">Score</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-400">
                                  {lang === 'en' ? 'Attempts' : 'Intentos'}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {leaderboards[t.id_torneo].map((p, i) => {
                                const u = p.usuarios
                                const isMe = user && p.id_usuario === user.id
                                return (
                                  <tr key={p.id_usuario}
                                    className={`border-b border-slate-50 ${isMe ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                    <td className="px-4 py-2.5 text-sm font-bold text-slate-400">{i + 1}</td>
                                    <td className="px-4 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 overflow-hidden rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                          {u?.avatar_url
                                            ? <img src={proxyImg(u.avatar_url)} alt="" className="h-full w-full object-cover" />
                                            : <span className="text-xs font-bold text-slate-500">{getDisplayName(u).substring(0,2).toUpperCase()}</span>
                                          }
                                        </div>
                                        <span className={`text-sm font-medium ${isMe ? 'text-indigo-700' : 'text-slate-700'}`}>
                                          {getDisplayName(u)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-slate-800">{p.score_total}%</td>
                                    <td className="px-4 py-2.5 text-right text-slate-500">{p.intentos_completados}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default TournamentsApp
