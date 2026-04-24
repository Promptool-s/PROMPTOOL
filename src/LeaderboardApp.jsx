import { useEffect, useState, useRef } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import { supabase } from './supabaseClient'
import { useLang } from './contexts/LangContext'
import { useAuth } from './hooks/useAuth'
import { getRank } from './services/eloService'
import { proxyImg } from './utils/imgProxy'

const TOP_COLORS = ['#f59e0b', '#94a3b8', '#b45309']

function RankArrow({ current, previous, isTop1 }) {
  if (!previous || previous === current) return null
  const delta = previous - current // positivo = subió, negativo = bajó
  const up = delta > 0

  if (isTop1) {
    // Top 1 siempre amarillo
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-500">
        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d={up ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
        {Math.abs(delta)}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${up ? 'text-emerald-500' : 'text-rose-400'}`}>
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d={up ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
      {Math.abs(delta)}
    </span>
  )
}

function LeaderboardApp() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('elo_rating')
  const [myRank, setMyRank] = useState(null)
  const [myAttempts, setMyAttempts] = useState(null) // null = no cargado aún
  const [compareA, setCompareA] = useState(null)
  const [compareB, setCompareB] = useState(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [searchA, setSearchA] = useState('')
  const [searchB, setSearchB] = useState('')
  const myRowRef = useRef(null)

  const cols = [
    { key: 'elo_rating',           label: 'ELO',                                    suffix: '',  tableOnly: false },
    { key: 'promedio_score',       label: lang === 'en' ? 'Avg'      : 'Promedio',  suffix: '%', tableOnly: false },
    { key: 'mejor_score',          label: lang === 'en' ? 'Best'     : 'Mejor',     suffix: '%', tableOnly: false },
    { key: 'total_intentos',       label: lang === 'en' ? 'Attempts' : 'Intentos',  suffix: '',  tableOnly: false },
    { key: 'porcentaje_aprobacion',label: lang === 'en' ? 'Approval' : 'Aprobación',suffix: '%', tableOnly: false },
    { key: 'racha_actual',         label: lang === 'en' ? 'Streak'   : 'Racha',     suffix: '',  tableOnly: true, hidden: true },
  ]
  const tableCols = cols.filter(c => !c.tableOnly)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      // Sincronizar ranked_count del usuario logueado
      if (user) {
        const { count } = await supabase
          .from('intentos')
          .select('id_intento', { count: 'exact', head: true })
          .eq('id_usuario', user.id)
          .eq('is_ranked', true)
        if (count !== null) {
          await supabase.from('usuarios').update({ ranked_count: count }).eq('id_usuario', user.id)
        }
      }

      const { data } = await supabase
        .from('usuarios')
        .select('id_usuario, nombre, nombre_display, username, avatar_url, promedio_score, mejor_score, total_intentos, porcentaje_aprobacion, racha_actual, rank_anterior, elo_rating')
        .eq('adminstate', false)
        .gte('ranked_count', 5)
        .order(sortBy, { ascending: false })
        .limit(100)

      const list = data || []
      setPlayers(list)

      // Actualizar rank_anterior solo una vez por día para que el delta sea visible
      if (list.length > 0) {
        const today = new Date().toDateString()
        const lastUpdate = localStorage.getItem('rankUpdateDate')
        if (lastUpdate !== today) {
          localStorage.setItem('rankUpdateDate', today)
          for (let i = 0; i < list.length; i++) {
            const p = list[i]
            const newRank = i + 1
            if (p.rank_anterior !== newRank) {
              supabase.from('usuarios').update({ rank_anterior: newRank }).eq('id_usuario', p.id_usuario)
            }
          }
        }
      }

      if (user) {
        const idx = list.findIndex(p => p.id_usuario === user.id)
        setMyRank(idx >= 0 ? idx + 1 : null)

        // Si no aparece en la tabla, contar intentos rankeados directamente
        if (idx < 0) {
          const { count } = await supabase
            .from('intentos')
            .select('id_intento', { count: 'exact', head: true })
            .eq('id_usuario', user.id)
            .eq('is_ranked', true)
          setMyAttempts(count ?? 0)
        } else {
          setMyAttempts(null)
        }
      }

      setLoading(false)
    }
    fetchLeaderboard()
  }, [sortBy, user])

  // Scroll al propio usuario
  useEffect(() => {
    if (myRowRef.current) {
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [players])

  const getDisplayName = (p) => p?.nombre_display || p?.nombre || p?.username || 'User'
  const getProfileUrl = (p) => p?.username ? `/user/${p.username}` : `/usuario.html?id=${p?.id_usuario}`
  const getAvatar = (p) => p?.avatar_url ? proxyImg(p.avatar_url) : null

  const getScoreColor = (val, key) => {
    if (key === 'total_intentos' || key === 'racha_actual') return 'text-slate-700'
    return val >= 70 ? 'text-emerald-600' : val >= 50 ? 'text-amber-500' : 'text-rose-500'
  }

  const filteredForSearch = (query) =>
    players.filter(p => {
      const name = getDisplayName(p).toLowerCase()
      const user = (p.username || '').toLowerCase()
      return name.includes(query.toLowerCase()) || user.includes(query.toLowerCase())
    }).slice(0, 8)

  // ── Compare panel ──
  const ComparePanel = () => {
    if (!compareA || !compareB) return null
    return (
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">
            {lang === 'en' ? 'Comparison' : 'Comparación'}
          </p>
          <button onClick={() => { setCompareA(null); setCompareB(null); setCompareOpen(false) }}
            className="text-xs text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr]">
          {/* Player A */}
          <div className="p-5 text-center border-r border-slate-100">
            <a href={getProfileUrl(compareA)} className="inline-flex flex-col items-center gap-2 hover:opacity-80 transition">
              <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 flex items-center justify-center">
                {getAvatar(compareA)
                  ? <img src={getAvatar(compareA)} alt="" className="h-full w-full object-cover" />
                  : <span className="text-lg font-bold text-slate-500">{getDisplayName(compareA).substring(0,2).toUpperCase()}</span>
                }
              </div>
              <p className="text-sm font-semibold text-slate-800">{getDisplayName(compareA)}</p>
              {compareA.username && <p className="text-xs text-slate-400">@{compareA.username}</p>}
            </a>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center px-4">
            <span className="text-xs font-bold text-slate-400">VS</span>
          </div>

          {/* Player B */}
          <div className="p-5 text-center border-l border-slate-100">
            <a href={getProfileUrl(compareB)} className="inline-flex flex-col items-center gap-2 hover:opacity-80 transition">
              <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 flex items-center justify-center">
                {getAvatar(compareB)
                  ? <img src={getAvatar(compareB)} alt="" className="h-full w-full object-cover" />
                  : <span className="text-lg font-bold text-slate-500">{getDisplayName(compareB).substring(0,2).toUpperCase()}</span>
                }
              </div>
              <p className="text-sm font-semibold text-slate-800">{getDisplayName(compareB)}</p>
              {compareB.username && <p className="text-xs text-slate-400">@{compareB.username}</p>}
            </a>
          </div>
        </div>

        {/* Stats comparison */}
        <div className="border-t border-slate-100">
          {cols.map(col => {
            const a = compareA[col.key] || 0
            const b = compareB[col.key] || 0
            const aWins = a > b
            const bWins = b > a
            const maxVal = Math.max(a, b, 1)
            return (
              <div key={col.key} className="grid grid-cols-[1fr_6rem_1fr] items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0">
                {/* A bar */}
                <div className="flex items-center gap-2 justify-end">
                  <span className={`text-sm font-bold ${aWins ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {a}{col.suffix}
                  </span>
                  <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${aWins ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      style={{ width: `${(a / maxVal) * 100}%`, marginLeft: 'auto' }} />
                  </div>
                </div>

                {/* Label */}
                <p className="text-xs font-semibold text-center text-slate-500 uppercase tracking-wide">{col.label}</p>

                {/* B bar */}
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${bWins ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      style={{ width: `${(b / maxVal) * 100}%` }} />
                  </div>
                  <span className={`text-sm font-bold ${bWins ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {b}{col.suffix}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Player picker ──
  const PlayerPicker = ({ label, value, search, setSearch, onSelect }) => {
    const results = search.length > 0 ? filteredForSearch(search) : []
    return (
      <div className="relative flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        {value ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-200 flex items-center justify-center">
              {getAvatar(value)
                ? <img src={getAvatar(value)} alt="" className="h-full w-full object-cover" />
                : <span className="text-xs font-bold text-slate-500">{getDisplayName(value).substring(0,2).toUpperCase()}</span>
              }
            </div>
            <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{getDisplayName(value)}</span>
            <button onClick={() => { onSelect(null); setSearch('') }} className="text-slate-400 hover:text-slate-700 text-xs">✕</button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'en' ? 'Search prompter...' : 'Buscar prompter...'}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                {results.map(p => (
                  <button key={p.id_usuario} onClick={() => { onSelect(p); setSearch('') }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                    <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-slate-100 flex items-center justify-center">
                      {getAvatar(p)
                        ? <img src={getAvatar(p)} alt="" className="h-full w-full object-cover" />
                        : <span className="text-xs font-bold text-slate-500">{getDisplayName(p).substring(0,2).toUpperCase()}</span>
                      }
                    </div>
                    <span className="truncate">{getDisplayName(p)}</span>
                    {p.username && <span className="text-xs text-slate-400 ml-auto">@{p.username}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
              {lang === 'en' ? 'Resets every month' : 'Se reinicia cada mes'}
            </p>
            <h1 className="text-3xl font-bold text-slate-900">
              {lang === 'en'
                ? `Competitive League — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                : `Liga Competitiva — ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`
              }
            </h1>
            <p className="mt-1 text-sm text-slate-500">{t('leaderboardDesc')}</p>
            <p className="mt-2 text-sm text-slate-600 flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              {lang === 'en'
                ? 'The #1 prompter at the end of the month earns an exclusive badge on their profile.'
                : 'El prompter #1 al final del mes gana una badge exclusiva en su perfil.'}
            </p>
            {myRank && (
              <p className="mt-2 text-sm font-semibold text-indigo-600">
                {lang === 'en' ? `Your rank: #${myRank}` : `Tu posición: #${myRank}`}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              {lang === 'en'
                ? `Resets on: ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                : `Próximo reset: ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' })}`
              }
            </p>
          </div>

          {/* Lado derecho — botón comparar + counter */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            <button
              onClick={() => setCompareOpen(o => !o)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition border ${
                compareOpen
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {lang === 'en' ? 'Compare prompters' : 'Comparar prompters'}
            </button>
            {user && myAttempts !== null && myAttempts < 5 && (
              <div className="text-right">
                <p className="text-4xl font-bold tabular-nums text-slate-900 leading-none">
                  {myAttempts}<span className="text-slate-300">/5</span>
                </p>
                <p className="mt-1 text-xs text-slate-500 font-medium">
                  {lang === 'en' ? 'ranked games to join the league' : 'partidas rankeadas para entrar a la liga'}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {lang === 'en'
                    ? 'Play with the ⚡ Ranked toggle on'
                    : 'Jugá con el toggle ⚡ Rankeado activado'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Compare panel */}
        {compareOpen && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex gap-4 flex-wrap">
              <PlayerPicker
                label={lang === 'en' ? 'Prompter 1' : 'Prompter 1'}
                value={compareA} search={searchA} setSearch={setSearchA} onSelect={setCompareA}
              />
              <PlayerPicker
                label={lang === 'en' ? 'Prompter 2' : 'Prompter 2'}
                value={compareB} search={searchB} setSearch={setSearchB} onSelect={setCompareB}
              />
            </div>
            {compareA && compareB && <ComparePanel />}
          </div>
        )}

        {/* Sort tabs */}
        <div className="flex gap-2 flex-wrap">
          {cols.map(col => (
            <button key={col.key} onClick={() => setSortBy(col.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                sortBy === col.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {col.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* Header skeleton */}
            <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem_5.5rem] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-3 rounded-full bg-slate-200 animate-pulse" />
              ))}
            </div>
            {/* Row skeletons */}
            {[...Array(10)].map((_, i) => (
              <div key={i} className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem_5.5rem] gap-3 items-center px-5 py-3.5 border-b border-slate-100 last:border-0">
                <div className="h-4 w-4 rounded-full bg-slate-200 animate-pulse mx-auto" />
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-28 rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-2.5 w-16 rounded-full bg-slate-100 animate-pulse" />
                  </div>
                </div>
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-4 w-10 rounded-full bg-slate-100 animate-pulse ml-auto" />
                ))}
              </div>
            ))}
          </div>
        ) : players.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-500">{t('noPlayers')}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem_5.5rem_5.5rem] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>#</span>
              <span>{lang === 'en' ? 'Prompter' : 'Prompter'}</span>
              {tableCols.map(c => (
                <span key={c.key} className={`text-right ${sortBy === c.key ? 'text-slate-700' : ''}`}>{c.label}</span>
              ))}
            </div>

            {players.map((p, i) => {
              const rank = i + 1
              const isMe = user && p.id_usuario === user.id
              const isTop3 = rank <= 3

              return (
                <div
                  key={p.id_usuario}
                  ref={isMe ? myRowRef : null}
                  className={`grid grid-cols-[3rem_1fr_5rem_5rem_5rem_5.5rem_5.5rem] gap-3 items-center px-5 py-3 border-b border-slate-100 last:border-0 transition ${
                    isMe ? 'bg-indigo-50 border-l-2 border-l-indigo-400' : isTop3 ? 'bg-amber-50/30' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center">
                    {rank === 1 ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill={TOP_COLORS[0]}>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        <RankArrow current={rank} previous={p.rank_anterior} isTop1={true} />
                      </div>
                    ) : rank <= 3 ? (
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill={TOP_COLORS[rank-1]}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    ) : p.rank_anterior && p.rank_anterior !== rank ? (
                      // Reemplazar número por flecha gris con delta
                      <span className="inline-flex flex-col items-center gap-0">
                        <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={p.rank_anterior > rank ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                        </svg>
                        <span className="text-[10px] font-semibold text-slate-400 leading-none">
                          {Math.abs(p.rank_anterior - rank)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-slate-400 w-5 text-center">{rank}</span>
                    )}
                  </div>

                  {/* Player */}
                  <a href={getProfileUrl(p)} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ${
                      rank === 1 ? 'ring-2 ring-amber-400' : rank === 2 ? 'ring-2 ring-slate-400' : rank === 3 ? 'ring-2 ring-amber-700' : 'border border-slate-200'
                    }`}>
                      {getAvatar(p)
                        ? <img src={getAvatar(p)} alt="" className="h-full w-full object-cover" />
                        : <span className="text-xs font-bold text-slate-500">{getDisplayName(p).substring(0,2).toUpperCase()}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isMe ? 'text-indigo-700' : 'text-slate-800'}`}>
                        {getDisplayName(p)} {isMe && <span className="text-xs font-normal text-indigo-400">(tú)</span>}
                      </p>
                      {p.username && <p className="text-xs text-slate-400">@{p.username}</p>}
                    </div>
                  </a>

                  {/* Stats */}
                  {tableCols.map(col => {
                    const val = p[col.key] || 0
                    const isActive = sortBy === col.key
                    if (col.key === 'elo_rating') {
                      const rank = getRank(val || 1000)
                      return (
                        <span key={col.key} className="text-right text-sm font-bold tabular-nums" style={{ color: isActive ? rank.color : undefined }}>
                          <span className={isActive ? '' : 'text-slate-400'}>{val || 1000}</span>
                        </span>
                      )
                    }
                    return (
                      <span key={col.key} className={`text-right text-sm font-bold ${isActive ? getScoreColor(val, col.key) : 'text-slate-400'}`}>
                        {val}{col.suffix}
                      </span>
                    )
                  })}
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

export default LeaderboardApp
