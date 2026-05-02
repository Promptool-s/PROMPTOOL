import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAdmin } from '../hooks/useAdmin'
import { useDev } from '../hooks/useDev'
import { useTheme } from '../contexts/ThemeContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../supabaseClient'
import AuthModal from './AuthModal'
import CompanyPanel from './CompanyPanel'
import { proxyImg } from '../utils/imgProxy'

const Header = ({ companyRefreshKey = 0 }) => {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { isDev } = useDev(user?.id)
  const { theme, setTheme } = useTheme()
  const { lang, changeLang, t } = useLang()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('main')
  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm, setPwForm] = useState({ newPw: '', confirmPw: '' })
  const [pwStatus, setPwStatus] = useState(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [profileUsername, setProfileUsername] = useState(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [notificationActionLoading, setNotificationActionLoading] = useState(null)
  const [companyData, setCompanyData] = useState(null)   // empresa a la que pertenece el usuario
  const [companyPanelOpen, setCompanyPanelOpen] = useState(false)
  const notificationRef = useRef(null)
  const closeTimer = useRef(null)
  const searchRef = useRef(null)
  const searchTimer = useRef(null)

  // Fetch username del usuario logueado para construir la URL del perfil
  useEffect(() => {
    if (!user) { setProfileUsername(null); setCompanyData(null); return }
    supabase
      .from('usuarios')
      .select('username, company_id')
      .eq('id_usuario', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileUsername(data?.username || null)
        if (data?.company_id) {
          supabase
            .from('usuarios')
            .select('id_usuario, company_name, nombre_display, avatar_url, verified')
            .eq('id_usuario', data.company_id)
            .maybeSingle()
            .then(({ data: co }) => setCompanyData(co || null))
        } else {
          setCompanyData(null)
        }
      })
  }, [user?.id, companyRefreshKey])

  const profileHref = profileUsername ? `/user/${profileUsername}` : `/usuario.html?id=${user?.id || ''}`

  // Close search on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false)
      if (notificationRef.current && !notificationRef.current.contains(e.target)) setNotificationOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const getNotificationStatusLabel = (status) => {
    if (status === 'pending') return lang === 'en' ? 'Pending' : 'Pendiente'
    if (status === 'requested') return lang === 'en' ? 'Requested' : 'Solicitada'
    if (status === 'accepted') return lang === 'en' ? 'Accepted' : 'Aceptada'
    if (status === 'rejected') return lang === 'en' ? 'Rejected' : 'Rechazada'
    return status || (lang === 'en' ? 'Update' : 'Actualización')
  }

  const getInvitationNotificationText = (invitation, isCompany, isReceiver) => {
    const companyName = invitation.company_name || (lang === 'en' ? 'Company' : 'Empresa')
    if (isCompany) {
      if (invitation.status === 'requested') {
        return {
          title: lang === 'en' ? 'Join request' : 'Solicitud de ingreso',
          body: lang === 'en'
            ? `${invitation.user_email || 'A user'} wants to join your company`
            : `${invitation.user_email || 'Un usuario'} quiere unirse a tu empresa`,
        }
      }
      return {
        title: lang === 'en' ? 'Company request' : 'Solicitud de empresa',
        body: lang === 'en'
          ? `${invitation.user_email || 'User'} status: ${getNotificationStatusLabel(invitation.status)}`
          : `${invitation.user_email || 'Usuario'} estado: ${getNotificationStatusLabel(invitation.status)}`,
      }
    }
    if (isReceiver) {
      if (invitation.status === 'requested') {
        return {
          title: lang === 'en' ? 'Join request sent' : 'Solicitud enviada',
          body: lang === 'en'
            ? `Your request to join ${companyName} is pending`
            : `Tu solicitud para unirte a ${companyName} está pendiente`,
        }
      }
      return {
        title: lang === 'en' ? 'Invitation received' : 'Invitación recibida',
        body: lang === 'en'
          ? `${companyName} sent you an invitation (${getNotificationStatusLabel(invitation.status)})`
          : `${companyName} te envió una invitación (${getNotificationStatusLabel(invitation.status)})`,
      }
    }
    return {
      title: lang === 'en' ? 'Invitation update' : 'Actualización de invitación',
      body: lang === 'en'
        ? `${companyName} invitation is ${getNotificationStatusLabel(invitation.status)}`
        : `La invitación de ${companyName} está ${getNotificationStatusLabel(invitation.status)}`,
    }
  }

  const fetchNotifications = async () => {
    if (!user) { setNotifications([]); return }
    setLoadingNotifications(true)
    try {
      const { data: myProfile } = await supabase
        .from('usuarios')
        .select('id_usuario, user_type, company_name')
        .eq('id_usuario', user.id)
        .maybeSingle()

      const { data: invitationRows } = await supabase
        .from('team_invitations')
        .select('id, company_id, user_id, user_email, status, message, created_at, sender:usuarios!team_invitations_company_id_fkey(company_name, nombre_display, avatar_url, verified)')
        .or(`company_id.eq.${user.id},user_id.eq.${user.id},user_email.eq.${user.email}`)
        .order('created_at', { ascending: false })
        .limit(30)

      const { data: readRows } = await supabase
        .from('notification_reads')
        .select('source_type, source_id')
        .eq('user_id', user.id)

      let guideRows = []
      try {
        const { data } = await supabase
          .from('guide_suggestions')
          .select('id, target_user_id, target_email, title, message, guide_slug, guide_url, created_at')
          .or(`target_user_id.eq.${user.id},target_email.eq.${user.email}`)
          .order('created_at', { ascending: false })
          .limit(30)
        guideRows = data || []
      } catch (_) {
        guideRows = []
      }

      let challengeRows = []
      try {
        const { data } = await supabase
          .from('challenge_notifications')
          .select('id, challenge_id, company_id, title, message, created_at, imagenes_ia(id_imagen, url_image, image_theme, image_diff), usuarios!challenge_notifications_company_id_fkey(company_name, avatar_url, verified)')
          .eq('target_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30)
        challengeRows = data || []
      } catch (_) {
        challengeRows = []
      }

      const readSet = new Set((readRows || []).map(r => `${r.source_type}:${r.source_id}`))
      const items = []

      ;(invitationRows || []).forEach((inv) => {
        const isCompany = inv.company_id === user.id
        const isReceiver = inv.user_id === user.id || (!!user.email && inv.user_email === user.email)
        // Nombre de la empresa: si soy el receptor, viene del join; si soy la empresa, del perfil propio
        const senderCompanyName = inv.sender?.company_name || inv.sender?.nombre_display
        const resolvedCompanyName = isCompany ? myProfile?.company_name : (senderCompanyName || myProfile?.company_name)
        const copy = getInvitationNotificationText({
          ...inv,
          company_name: resolvedCompanyName,
          sender_avatar: inv.sender?.avatar_url,
          sender_verified: inv.sender?.verified,
        }, isCompany, isReceiver)
        const sourceType = 'team_invitation'
        const sourceId = String(inv.id)
        const sourceKey = `${sourceType}:${sourceId}`
        const canRespond =
          (isCompany && inv.status === 'requested') ||
          (isReceiver && inv.status === 'pending')
        items.push({
          id: `inv-${inv.id}`,
          sourceType,
          sourceId,
          read: readSet.has(sourceKey),
          createdAt: inv.created_at,
          title: copy.title,
          body: copy.body,
          invitation: { ...inv, company_name: resolvedCompanyName },
          senderAvatar: inv.sender?.avatar_url || null,
          senderVerified: inv.sender?.verified || false,
          actionUrl: isCompany ? `/?tab=requests` : `/perfil?id=${inv.company_id}`,
          canRespond,
        })
      })

      ;(guideRows || []).forEach((g) => {
        const sourceType = 'guide_suggestion'
        const sourceId = String(g.id)
        const sourceKey = `${sourceType}:${sourceId}`
        // Detectar si es una respuesta a un reporte (enviada desde AdminApp)
        const isReportResponse = g.title === 'Respuesta a tu reporte' || g.title === 'Report response'
        items.push({
          id: `guide-${g.id}`,
          sourceType,
          sourceId,
          read: readSet.has(sourceKey),
          createdAt: g.created_at,
          title: isReportResponse
            ? (lang === 'en' ? 'Response to your report' : 'Respuesta a tu reporte')
            : (g.title || (lang === 'en' ? 'Guide suggestion' : 'Sugerencia de guía')),
          body: g.message || (lang === 'en' ? 'You have a recommended guide.' : 'Tienes una guía recomendada.'),
          actionUrl: g.guide_url || (g.guide_slug ? `/guides#${g.guide_slug}` : null),
          guide: g,
          isReportResponse,
        })
      })

      ;(challengeRows || []).forEach((c) => {
        const sourceType = 'challenge_notification'
        const sourceId = String(c.id)
        const sourceKey = `${sourceType}:${sourceId}`
        const companyName = c.usuarios?.company_name || (lang === 'en' ? 'Your company' : 'Tu empresa')
        const challengeTheme = c.imagenes_ia?.image_theme || (lang === 'en' ? 'Challenge' : 'Desafío')
        items.push({
          id: `challenge-${c.id}`,
          sourceType,
          sourceId,
          read: readSet.has(sourceKey),
          createdAt: c.created_at,
          title: c.title || (lang === 'en' ? 'New challenge available' : 'Nuevo desafío disponible'),
          body: c.message || (lang === 'en' ? `${companyName} created a new challenge: ${challengeTheme}` : `${companyName} creó un nuevo desafío: ${challengeTheme}`),
          actionUrl: `/?challenge=${c.challenge_id}`,
          senderAvatar: c.usuarios?.avatar_url || null,
          senderVerified: c.usuarios?.verified || false,
          challengeImage: c.imagenes_ia?.url_image || null,
          challengeDiff: c.imagenes_ia?.image_diff || null,
        })
      })

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setNotifications(items)
    } catch {
      setNotifications([])
    } finally {
      setLoadingNotifications(false)
    }
  }

  const markNotificationRead = async (item) => {
    if (!user || !item || item.read) return
    try {
      await supabase.from('notification_reads').upsert([{
        user_id: user.id,
        source_type: item.sourceType,
        source_id: item.sourceId,
      }], { onConflict: 'user_id,source_type,source_id' })
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))
    } catch {
      // mark read failed silently
    }
  }

  const markAllNotificationsRead = async () => {
    if (!user) return
    const unread = notifications.filter(n => !n.read)
    if (!unread.length) return
    try {
      await supabase.from('notification_reads').upsert(
        unread.map(n => ({ user_id: user.id, source_type: n.sourceType, source_id: n.sourceId })),
        { onConflict: 'user_id,source_type,source_id' },
      )
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {
      // mark all read failed silently
    }
  }

  const handleInvitationAction = async (item, status) => {
    if (!item?.invitation || !user) return
    setNotificationActionLoading(item.id + status)
    try {
      const invitation = item.invitation

      if (status === 'accepted') {
        // Usar RPC con SECURITY DEFINER — maneja el update de status y company_id
        const isCompanyAccepting = invitation.company_id === user.id
        const rpcName = isCompanyAccepting ? 'accept_team_invitation' : 'accept_company_invite'
        const { error: rpcError } = await supabase.rpc(rpcName, { invitation_id: invitation.id })
        if (rpcError) throw rpcError
      } else {
        // Rechazar: update directo (solo cambia status, no necesita SECURITY DEFINER)
        const { error } = await supabase
          .from('team_invitations')
          .update({ status })
          .eq('id', invitation.id)
        if (error) throw error
      }

      setNotifications(prev => prev.map(n => n.id === item.id
        ? { ...n, read: true, invitation: { ...n.invitation, status }, body: getInvitationNotificationText(
            { ...n.invitation, status, company_name: n.invitation.company?.company_name },
            n.invitation.company_id === user.id,
            n.invitation.user_id === user.id || (!!user.email && n.invitation.user_email === user.email),
          ).body }
        : n))
      await markNotificationRead(item)
    } catch {
      // invitation action failed silently
    } finally {
      setNotificationActionLoading(null)
    }
  }

  const formatNotificationDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  useEffect(() => {
    if (!user) return
    fetchNotifications()
  }, [user?.id, user?.email, lang])

  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return }
    setSearchOpen(true)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const { data: users } = await supabase
          .from('usuarios')
          .select('id_usuario, nombre, nombre_display, username, avatar_url')
          .or(`username.ilike.%${q}%,nombre.ilike.%${q}%,nombre_display.ilike.%${q}%`)
          .limit(5)
        setSearchResults(users || [])
      } catch (_) {}
      setSearchLoading(false)
    }, 300)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirmPw) { setPwStatus('mismatch'); return }
    if (pwForm.newPw.length < 6) { setPwStatus('short'); return }
    setPwStatus('saving')
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    if (error) { setPwStatus('error'); return }
    setPwStatus('ok')
    setPwForm({ newPw: '', confirmPw: '' })
    setShowPwForm(false)
    setTimeout(() => setPwStatus(null), 2000)
  }

  const handleChangeEmail = async (e) => {
    e.preventDefault()
    if (!newEmail.includes('@')) { setEmailStatus('invalid'); return }
    setEmailStatus('saving')
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) { setEmailStatus('error'); return }
    setEmailStatus('ok')
    setNewEmail('')
    setShowEmailForm(false)
    setTimeout(() => setEmailStatus(null), 3000)
  }

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setUserMenuOpen(true)
  }
  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => {
      setUserMenuOpen(false)
      setActiveSection('main')
    }, 200)
  }

  const getUserAvatar = () => {
    if (user?.user_metadata?.avatar_url) {
      return <img src={proxyImg(user.user_metadata.avatar_url)} alt="Avatar" className="h-full w-full object-cover" />
    }
    const name = user?.user_metadata?.nombre || user?.email || 'U'
    return <span className="text-sm font-semibold text-slate-700">{name.substring(0, 2).toUpperCase()}</span>
  }

  const getUserName = () => {
    if (!user) return ''
    return user.user_metadata?.nombre || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  }

  const Icon = ({ d, className = 'h-4 w-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )

  const navLinks = [
    { href: '/guides', label: t('guides') },
    { href: '/leaderboard', label: t('leaderboard') },
    { href: '/tournaments', label: t('challenges') },
    ...(isAdmin ? [{ href: '/admin', label: t('tables'), className: 'text-purple-600 font-semibold' }] : []),
    ...(!isAdmin && isDev ? [{ href: '/admin', label: t('tables'), className: 'text-sky-500 font-semibold' }] : []),
  ]

  return (
    <>
      <header className="sticky top-0 z-[100] border-b border-slate-200/90 bg-white/95 backdrop-blur-xl transition-shadow duration-300 ease-out hover:shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">

          {/* Logo */}
          <a href="/" className="shrink-0 flex items-center gap-2 transition-opacity hover:opacity-80">
            <span className="text-lg font-bold tracking-tight text-slate-900">Promp<span style={{ color: 'rgb(var(--color-accent))' }}>Tool</span></span>
          </a>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div ref={searchRef} className="relative w-56">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 transition focus-within:border-slate-400 focus-within:bg-white">              <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => searchQuery && setSearchOpen(true)}
                placeholder={
                  document.documentElement.classList.contains('mode-hacker')
                    ? (lang === 'en' ? '> SEARCH_USER_' : '> BUSCAR_USUARIO_')
                    : document.documentElement.classList.contains('mode-retro')
                    ? (lang === 'en' ? 'FIND USER...' : 'BUSCAR...')
                    : (lang === 'en' ? 'Search users...' : 'Buscar usuarios...')
                }
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              {searchLoading && (
                <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              )}
            </div>

            {searchOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-[300] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                {searchResults.length > 0 ? (
                  <>
                    <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {lang === 'en' ? 'Users' : 'Usuarios'}
                    </p>
                    {searchResults.map(u => {
                      const name = u.nombre_display || u.nombre || u.username || 'User'
                      const href = u.username ? `/user/${u.username}` : `/usuario.html?id=${u.id_usuario}`
                      return (
                        <a key={u.id_usuario} href={href}
                          onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                            {u.avatar_url
                              ? <img src={proxyImg(u.avatar_url)} alt={name} className="h-full w-full object-cover" />
                              : <span className="text-xs font-semibold text-slate-600">{name.substring(0, 2).toUpperCase()}</span>
                            }
                          </div>
                          <div>
                            <p className="font-medium leading-tight">{name}</p>
                            {u.username && <p className="text-xs text-slate-400">@{u.username}</p>}
                          </div>
                        </a>
                      )
                    })}
                  </>
                ) : !searchLoading ? (
                  <p className="px-3 py-3 text-sm text-slate-400">
                    {lang === 'en' ? 'No users found' : 'Sin resultados'}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Nav links */}
          <nav className="hidden items-center gap-1 text-sm text-slate-600 md:flex">
            {navLinks.map(({ href, label, className: cls }) => (
              <a key={href} href={href}
                className={`rounded-lg px-3 py-1.5 transition-all hover:bg-slate-100 hover:text-slate-900 ${cls || ''}`}>
                {label}
              </a>
            ))}
          </nav>

          {/* Avatar o login */}
          <div className="flex shrink-0 items-center gap-2">
            {loading ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-100">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              </div>
            ) : user ? (
              <>
                {/* Botón de empresa — solo si el usuario pertenece a una */}
                {companyData && (
                  <button
                    onClick={() => setCompanyPanelOpen(true)}
                    className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition group"
                    title={companyData.company_name || companyData.nombre_display}
                  >
                    <div className="relative h-5 w-5 rounded-md overflow-hidden bg-violet-100 shrink-0 flex items-center justify-center">
                      {companyData.avatar_url
                        ? <img src={proxyImg(companyData.avatar_url)} alt="" className="h-full w-full object-cover" />
                        : <span className="text-[9px] font-bold text-violet-600">
                            {(companyData.company_name || companyData.nombre_display || 'E').substring(0, 2).toUpperCase()}
                          </span>
                      }
                    </div>
                    <span className="max-w-[100px] truncate">
                      {companyData.company_name || companyData.nombre_display}
                    </span>
                    {companyData.verified && (
                      <svg className="h-3.5 w-3.5 text-violet-500 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z"/>
                      </svg>
                    )}
                  </button>
                )}

                <div ref={notificationRef} className="relative z-[205] mr-1">
                  <button
                    onClick={() => {
                      const next = !notificationOpen
                      setNotificationOpen(next)
                      if (next) fetchNotifications()
                    }}
                    className="relative flex h-9 w-9 items-center justify-center text-slate-500 transition hover:text-slate-700"
                    title={lang === 'en' ? 'Inbox' : 'Bandeja'}
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute right-0 top-0 inline-flex min-w-[14px] translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-3 text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notificationOpen && (
                    <div className="absolute right-0 top-11 z-[206] w-[24rem] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{lang === 'en' ? 'Inbox' : 'Bandeja'}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {lang === 'en'
                              ? `${unreadCount} unread`
                              : `${unreadCount} sin leer`}
                          </p>
                        </div>
                        <button
                          onClick={markAllNotificationsRead}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          {lang === 'en' ? 'Mark all read' : 'Marcar todo leído'}
                        </button>
                      </div>

                      <div className="max-h-[28rem] overflow-y-auto">
                        {loadingNotifications ? (
                          <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                            {lang === 'en' ? 'Loading notifications...' : 'Cargando notificaciones...'}
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                            {lang === 'en' ? 'No notifications yet.' : 'Aún no tienes notificaciones.'}
                          </div>
                        ) : notifications.map((item) => (
                          <div key={item.id} className={`border-b border-slate-100 dark:border-slate-800 px-4 py-3 last:border-b-0 ${item.read ? 'bg-white dark:bg-slate-900' : 'bg-indigo-50/40 dark:bg-indigo-950/30'}`}>
                            <div className="mb-1 flex items-start gap-2.5">
                              {item.challengeImage ? (
                                <div className="relative shrink-0 mt-0.5">
                                  <img src={item.challengeImage} alt="" className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                                  {item.challengeDiff && (
                                    <span className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                      item.challengeDiff.toLowerCase() === 'easy' ? 'bg-emerald-500 text-white' :
                                      item.challengeDiff.toLowerCase() === 'hard' ? 'bg-rose-500 text-white' :
                                      'bg-amber-500 text-white'
                                    }`}>
                                      {item.challengeDiff}
                                    </span>
                                  )}
                                </div>
                              ) : item.senderAvatar ? (
                                <div className="relative shrink-0 mt-0.5">
                                  <img src={proxyImg(item.senderAvatar)} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                                  {item.senderVerified && (
                                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-600 ring-1 ring-white dark:ring-slate-900" title="Verificado">
                                      <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="currentColor"><path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z"/></svg>
                                    </span>
                                  )}
                                </div>
                              ) : item.isReportResponse ? (
                                /* Report response icon */
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 mt-0.5">
                                  <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.body}</p>
                                  </div>
                                  {!item.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatNotificationDate(item.createdAt)}</p>
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.actionUrl && !item.isReportResponse && (
                                <a
                                  href={item.actionUrl}
                                  onClick={() => markNotificationRead(item)}
                                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                                    item.sourceType === 'challenge_notification'
                                      ? 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  {item.sourceType === 'challenge_notification'
                                    ? (lang === 'en' ? 'Play challenge' : 'Jugar desafío')
                                    : (lang === 'en' ? 'Open guide' : 'Abrir guía')}
                                </a>
                              )}

                              {!item.read && (
                                <button
                                  onClick={() => markNotificationRead(item)}
                                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  {lang === 'en' ? 'Mark read' : 'Marcar leído'}
                                </button>
                              )}

                              {item.canRespond && (
                                <>
                                  <button
                                    onClick={() => handleInvitationAction(item, 'accepted')}
                                    disabled={notificationActionLoading === item.id + 'accepted'}
                                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    {lang === 'en' ? 'Accept' : 'Aceptar'}
                                  </button>
                                  <button
                                    onClick={() => handleInvitationAction(item, 'rejected')}
                                    disabled={notificationActionLoading === item.id + 'rejected'}
                                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60"
                                  >
                                    {lang === 'en' ? 'Reject' : 'Rechazar'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative z-[201]" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                <a href={profileHref}
                  className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-100 transition-all hover:shadow-md border-2 ${isAdmin ? 'border-purple-400 hover:border-purple-500' : 'border-slate-200 hover:border-slate-300'}`}>
                  {getUserAvatar()}
                </a>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 top-11 z-[202] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="absolute -top-3 left-0 right-0 h-3" />

                    {activeSection === 'main' && (
                      <>
                        <div className="flex items-center gap-3 border-b border-slate-100 p-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${isAdmin ? 'border-purple-400' : 'border-slate-200'} bg-slate-100`}>
                            {getUserAvatar()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{getUserName()}</p>
                            <p className="truncate text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>

                        <div className="p-1.5 space-y-0.5">
                          <a href={profileHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                            <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            {t('viewProfile')}
                          </a>
                          <button onClick={() => setActiveSection('settings')}
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                            <span className="flex items-center gap-3">
                              <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              {t('settings')}
                            </span>
                            <Icon d="M9 5l7 7-7 7" className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                          {isAdmin && (
                            <a href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-purple-600 transition hover:bg-purple-50">
                              <Icon d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                              {t('adminPanel')}
                            </a>
                          )}
                        </div>

                        <div className="border-t border-slate-100 p-1.5">
                          <button onClick={() => { signOut(); setUserMenuOpen(false) }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50">
                            <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            {t('signOut')}
                          </button>
                        </div>
                      </>
                    )}

                    {activeSection === 'settings' && (
                      <>
                        <div className="flex items-center gap-2 border-b border-slate-100 p-3">
                          <button onClick={() => setActiveSection('main')}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100">
                            <Icon d="M15 19l-7-7 7-7" className="h-4 w-4" />
                          </button>
                          <p className="text-sm font-semibold text-slate-800">{t('settingsTitle')}</p>
                        </div>

                        <div className="p-3 space-y-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('theme')}</p>
                            <div className="flex gap-2">
                              {['light', 'dark'].map(th => (
                                <button key={th} onClick={() => setTheme(th)}
                                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${theme === th ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                  {th === 'light'
                                    ? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                                    : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                                  }
                                  {t(th)}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('language')}</p>
                            <div className="flex gap-2">
                              {[['es', 'Español'], ['en', 'English']].map(([l, label]) => (
                                <button key={l} onClick={() => changeLang(l)}
                                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${lang === l ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <button type="button" onClick={() => { setShowPwForm(f => !f); setPwStatus(null) }}
                              className="flex w-full items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 hover:text-slate-700 transition">
                              <span>{t('changePassword')}</span>
                              <Icon d={showPwForm ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} className="h-3.5 w-3.5" />
                            </button>
                            {showPwForm && (
                              <form onSubmit={handleChangePassword} className="space-y-2">
                                <input type="password" placeholder={t('newPassword')} value={pwForm.newPw}
                                  onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-slate-400"
                                  minLength={6} required />
                                <input type="password" placeholder={t('confirmPassword')} value={pwForm.confirmPw}
                                  onChange={e => setPwForm(f => ({ ...f, confirmPw: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-slate-400"
                                  minLength={6} required />
                                {pwStatus === 'mismatch' && <p className="text-xs text-rose-600">{t('passwordMismatch')}</p>}
                                {pwStatus === 'short' && <p className="text-xs text-rose-600">{t('passwordShort')}</p>}
                                {pwStatus === 'error' && <p className="text-xs text-rose-600">{t('passwordError')}</p>}
                                {pwStatus === 'ok' && <p className="text-xs text-emerald-600">{t('passwordChanged')}</p>}
                                <button type="submit" disabled={pwStatus === 'saving'}
                                  className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">
                                  {pwStatus === 'saving' ? '...' : t('save')}
                                </button>
                              </form>
                            )}
                          </div>

                          <div>
                            <button type="button" onClick={() => { setShowEmailForm(f => !f); setEmailStatus(null) }}
                              className="flex w-full items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 hover:text-slate-700 transition">
                              <span>{lang === 'en' ? 'Change email' : 'Cambiar email'}</span>
                              <Icon d={showEmailForm ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} className="h-3.5 w-3.5" />
                            </button>
                            {showEmailForm && (
                              <form onSubmit={handleChangeEmail} className="space-y-2">
                                <input type="email" placeholder={lang === 'en' ? 'New email address' : 'Nuevo email'} value={newEmail}
                                  onChange={e => setNewEmail(e.target.value)}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-slate-400"
                                  required />
                                {emailStatus === 'invalid' && <p className="text-xs text-rose-600">{lang === 'en' ? 'Invalid email' : 'Email inválido'}</p>}
                                {emailStatus === 'error' && <p className="text-xs text-rose-600">{lang === 'en' ? 'Error updating email' : 'Error al actualizar el email'}</p>}
                                {emailStatus === 'ok' && <p className="text-xs text-emerald-600">{lang === 'en' ? 'Check your inbox to confirm.' : 'Revisá tu bandeja para confirmar.'}</p>}
                                <button type="submit" disabled={emailStatus === 'saving'}
                                  className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">
                                  {emailStatus === 'saving' ? '...' : t('save')}
                                </button>
                              </form>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-slate-100 p-1.5">
                          <button onClick={() => { signOut(); setUserMenuOpen(false) }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50">
                            <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            {t('signOut')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                </div>
              </>
            ) : (
              <button onClick={() => setAuthModalOpen(true)}
                className="flex h-9 items-center justify-center rounded-xl border border-transparent px-4 text-sm font-semibold text-white transition-all"
                style={{ backgroundColor: 'rgb(var(--color-accent))' }}>
                {t('signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithEmail={signInWithEmail}
        onSignUpWithEmail={signUpWithEmail}
      />

      {companyPanelOpen && companyData && (
        <CompanyPanel
          user={user}
          companyData={companyData}
          onClose={() => setCompanyPanelOpen(false)}
        />
      )}
    </>
  )
}

export default Header
