import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useLang } from '../contexts/LangContext'
import { proxyImg } from '../utils/imgProxy'

const CompanyPanel = ({ user, companyData, onClose, onLeft }) => {
  const { lang } = useLang()
  const [activeTab, setActiveTab] = useState('leaderboard')
  const [members, setMembers] = useState([])
  const [challenges, setChallenges] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [loadingChallenges, setLoadingChallenges] = useState(true)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const panelRef = useRef(null)

  const companyName = companyData?.company_name || companyData?.nombre_display || 'Mi Empresa'
  const companyAvatar = companyData?.avatar_url
  const companyVerified = companyData?.verified

  useEffect(() => {
    if (!companyData?.id_usuario) return
    fetchMembers()
    fetchChallenges()
  }, [companyData?.id_usuario])

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const fetchMembers = async () => {
    setLoadingMembers(true)
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('id_usuario, nombre, nombre_display, username, avatar_url, elo_rating, total_intentos, promedio_score, porcentaje_aprobacion, racha_actual, company_role')
        .eq('company_id', companyData.id_usuario)
        .order('elo_rating', { ascending: false })
      setMembers(data || [])
    } catch {
      // fetch members failed silently
    } finally {
      setLoadingMembers(false)
    }
  }

  const fetchChallenges = async () => {
    setLoadingChallenges(true)
    try {
      const { data } = await supabase
        .from('imagenes_ia')
        .select('id_imagen, url_image, image_diff, image_theme, fecha')
        .eq('company_id', companyData.id_usuario)
        .order('fecha', { ascending: false })
      setChallenges(data || [])
    } catch {
      // fetch challenges failed silently
    } finally {
      setLoadingChallenges(false)
    }
  }

  const myRank = members.findIndex(m => m.id_usuario === user?.id) + 1
  const myData = members.find(m => m.id_usuario === user?.id)

  const handleLeave = async () => {
    setLeaving(true)
    try {
      const { error } = await supabase.rpc('leave_company')
      if (error) throw error
      onClose()
      if (onLeft) onLeft()
      // Recargar la página para reflejar el cambio en el header
      window.location.reload()
    } catch {
      setLeaving(false)
      setConfirmLeave(false)
    }
  }

  const diffColor = (d) => {
    if (!d) return 'text-slate-500 bg-slate-100'
    const l = d.toLowerCase()
    if (l === 'easy') return 'text-emerald-700 bg-emerald-50'
    if (l === 'hard') return 'text-rose-700 bg-rose-50'
    return 'text-amber-700 bg-amber-50'
  }

  const tabs = [
    { id: 'leaderboard', label: lang === 'en' ? 'Leaderboard' : 'Ranking', icon: '🏆' },
    { id: 'challenges', label: lang === 'en' ? 'Challenges' : 'Desafíos', icon: '🎯' },
    { id: 'stats', label: lang === 'en' ? 'Stats' : 'Estadísticas', icon: '📊' },
  ]

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden"
      >
        {/* Header del panel */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-xl overflow-hidden bg-violet-100 flex items-center justify-center border border-violet-200">
              {companyAvatar
                ? <img src={companyAvatar} alt={companyName} className="h-full w-full object-cover" />
                : <span className="text-sm font-bold text-violet-600">{companyName.substring(0, 2).toUpperCase()}</span>
              }
            </div>
            {companyVerified && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 ring-2 ring-white">
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z"/>
                </svg>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 truncate">{companyName}</h2>
              {companyVerified && (
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-1.5 py-0.5">
                  {lang === 'en' ? 'Verified' : 'Verificada'}
                </span>
              )}
            </div>
            {myData && (
              <p className="text-xs text-slate-500">
                {myData.company_role
                  ? `${myData.company_role} · `
                  : ''}
                {myRank > 0
                  ? (lang === 'en' ? `#${myRank} in ranking` : `#${myRank} en el ranking`)
                  : (lang === 'en' ? 'Member' : 'Miembro')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setConfirmLeave(true)}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 transition"
              title={lang === 'en' ? 'Leave company' : 'Salir de la empresa'}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">{lang === 'en' ? 'Leave' : 'Salir'}</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Confirmación de salida */}
        {confirmLeave && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-3xl">
            <div className="text-center px-8 py-6 max-w-xs">
              <div className="text-4xl mb-3">🚪</div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {lang === 'en' ? 'Leave company?' : '¿Salir de la empresa?'}
              </h3>
              <p className="text-sm text-slate-500 mb-5">
                {lang === 'en'
                  ? `You will no longer be a member of ${companyName}. You can request to join again later.`
                  : `Dejarás de ser miembro de ${companyName}. Podés volver a solicitar el ingreso más adelante.`}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setConfirmLeave(false)}
                  disabled={leaving}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  {lang === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  onClick={handleLeave}
                  disabled={leaving}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-60 flex items-center gap-2"
                >
                  {leaving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                  {leaving
                    ? (lang === 'en' ? 'Leaving...' : 'Saliendo...')
                    : (lang === 'en' ? 'Leave' : 'Salir')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0 px-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* ── LEADERBOARD ── */}
          {activeTab === 'leaderboard' && (
            <div className="p-4 space-y-2">
              {loadingMembers ? (
                <div className="flex justify-center py-12">
                  <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
                </div>
              ) : members.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-12">
                  {lang === 'en' ? 'No members yet.' : 'Aún no hay miembros.'}
                </p>
              ) : members.map((member, idx) => {
                const isMe = member.id_usuario === user?.id
                const name = member.nombre_display || member.nombre || member.username || 'Usuario'
                const href = member.username ? `/user/${member.username}` : `/perfil?id=${member.id_usuario}`
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                return (
                  <div
                    key={member.id_usuario}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                      isMe
                        ? 'bg-violet-50 border border-violet-200'
                        : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    {/* Posición */}
                    <div className="w-7 shrink-0 text-center">
                      {medal
                        ? <span className="text-lg">{medal}</span>
                        : <span className="text-sm font-bold text-slate-400">#{idx + 1}</span>
                      }
                    </div>

                    {/* Avatar */}
                    <div className="h-9 w-9 rounded-full overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center border border-slate-200">
                      {member.avatar_url
                        ? <img src={proxyImg(member.avatar_url)} alt={name} className="h-full w-full object-cover" />
                        : <span className="text-xs font-bold text-slate-500">{name.substring(0, 2).toUpperCase()}</span>
                      }
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <a href={href} className="text-sm font-semibold text-slate-900 hover:text-violet-600 truncate">
                          {name}
                        </a>
                        {isMe && (
                          <span className="text-[10px] font-bold text-violet-600 bg-violet-100 rounded-full px-1.5 py-0.5 shrink-0">
                            {lang === 'en' ? 'You' : 'Tú'}
                          </span>
                        )}
                        {member.company_role && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5 shrink-0 hidden sm:inline">
                            {member.company_role}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {member.total_intentos ?? 0} {lang === 'en' ? 'attempts' : 'intentos'}
                        {member.promedio_score ? ` · ${lang === 'en' ? 'avg' : 'prom'} ${member.promedio_score}` : ''}
                      </p>
                    </div>

                    {/* ELO */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-violet-600">{member.elo_rating ?? 1000}</p>
                      <p className="text-[10px] text-slate-400">ELO</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── DESAFÍOS ── */}
          {activeTab === 'challenges' && (
            <div className="p-4 space-y-3">
              {loadingChallenges ? (
                <div className="flex justify-center py-12">
                  <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
                </div>
              ) : challenges.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-2xl mb-2">🎯</p>
                  <p className="text-sm font-medium text-slate-600">
                    {lang === 'en' ? 'No challenges yet' : 'Aún no hay desafíos'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'en'
                      ? 'Your company admin will create challenges for the team'
                      : 'El admin de tu empresa creará desafíos para el equipo'}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">
                    {challenges.length} {lang === 'en' ? 'challenges available' : 'desafíos disponibles'}
                  </p>
                  {challenges.map((ch) => (
                    <div key={ch.id_imagen} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 hover:border-violet-300 hover:bg-violet-50/30 transition group">
                      {/* Thumbnail */}
                      <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                        {ch.url_image
                          ? <img src={ch.url_image} alt="challenge" className="h-full w-full object-cover" />
                          : <div className="h-full w-full flex items-center justify-center text-2xl">🖼️</div>
                        }
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${diffColor(ch.image_diff)}`}>
                            {ch.image_diff || 'Medium'}
                          </span>
                          {ch.image_theme && (
                            <span className="text-[11px] text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                              {ch.image_theme}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {ch.fecha
                            ? new Date(ch.fecha).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </p>
                      </div>

                      {/* Botón jugar - solo si NO es organizador */}
                      {companyData?.user_type !== 'enterprise' && (
                        <a
                          href={`/?challenge=${ch.id_imagen}`}
                          className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition group-hover:shadow-md"
                        >
                          {lang === 'en' ? 'Play' : 'Jugar'}
                        </a>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── STATS ── */}
          {activeTab === 'stats' && (
            <div className="p-4 space-y-4">
              {loadingMembers ? (
                <div className="flex justify-center py-12">
                  <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
                </div>
              ) : (
                <>
                  {/* Stats globales del equipo */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                      {lang === 'en' ? 'Team Overview' : 'Resumen del Equipo'}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        {
                          label: lang === 'en' ? 'Members' : 'Miembros',
                          value: members.length,
                          icon: '👥',
                          color: 'text-violet-600',
                        },
                        {
                          label: lang === 'en' ? 'Avg ELO' : 'ELO Prom.',
                          value: members.length
                            ? Math.round(members.reduce((s, m) => s + (m.elo_rating || 1000), 0) / members.length)
                            : '—',
                          icon: '⚡',
                          color: 'text-indigo-600',
                        },
                        {
                          label: lang === 'en' ? 'Avg Score' : 'Score Prom.',
                          value: (() => {
                            const w = members.filter(m => m.promedio_score)
                            return w.length ? Math.round(w.reduce((s, m) => s + m.promedio_score, 0) / w.length) : '—'
                          })(),
                          icon: '🎯',
                          color: 'text-emerald-600',
                        },
                        {
                          label: lang === 'en' ? 'Total Attempts' : 'Intentos',
                          value: members.reduce((s, m) => s + (m.total_intentos || 0), 0),
                          icon: '🔥',
                          color: 'text-amber-600',
                        },
                      ].map(({ label, value, icon, color }) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                          <p className="text-xl mb-1">{icon}</p>
                          <p className={`text-2xl font-bold ${color}`}>{value}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mi posición */}
                  {myData && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                        {lang === 'en' ? 'My Stats' : 'Mis Stats'}
                      </p>
                      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden bg-violet-200 shrink-0 flex items-center justify-center">
                            {myData.avatar_url
                              ? <img src={proxyImg(myData.avatar_url)} alt="" className="h-full w-full object-cover" />
                              : <span className="text-sm font-bold text-violet-600">
                                  {(myData.nombre_display || myData.nombre || 'U').substring(0, 2).toUpperCase()}
                                </span>
                            }
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {myData.nombre_display || myData.nombre || myData.username}
                            </p>
                            <p className="text-xs text-violet-600 font-medium">
                              #{myRank} {lang === 'en' ? 'in team' : 'en el equipo'}
                              {myData.company_role ? ` · ${myData.company_role}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'ELO', value: myData.elo_rating ?? 1000 },
                            { label: lang === 'en' ? 'Avg' : 'Prom.', value: myData.promedio_score ?? '—' },
                            { label: lang === 'en' ? 'Attempts' : 'Intentos', value: myData.total_intentos ?? 0 },
                          ].map(({ label, value }) => (
                            <div key={label} className="rounded-xl bg-white border border-violet-100 p-2.5 text-center">
                              <p className="text-base font-bold text-violet-700">{value}</p>
                              <p className="text-[10px] text-slate-500">{label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top 3 */}
                  {members.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                        {lang === 'en' ? 'Top Performers' : 'Mejores del Equipo'}
                      </p>
                      <div className="space-y-2">
                        {members.slice(0, 3).map((m, i) => {
                          const name = m.nombre_display || m.nombre || m.username || 'Usuario'
                          const medals = ['🥇', '🥈', '🥉']
                          return (
                            <div key={m.id_usuario} className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                              <span className="text-lg shrink-0">{medals[i]}</span>
                              <div className="h-7 w-7 rounded-full overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center">
                                {m.avatar_url
                                  ? <img src={proxyImg(m.avatar_url)} alt={name} className="h-full w-full object-cover" />
                                  : <span className="text-[10px] font-bold text-slate-500">{name.substring(0,2).toUpperCase()}</span>
                                }
                              </div>
                              <p className="text-sm font-medium text-slate-800 flex-1 truncate">{name}</p>
                              <p className="text-sm font-bold text-violet-600 shrink-0">{m.elo_rating ?? 1000}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default CompanyPanel
