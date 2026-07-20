import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAdmin } from '../hooks/useAdmin'
import { useDev } from '../hooks/useDev'
import { useTheme } from '../contexts/ThemeContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../supabaseClient'
import { api } from '../lib/apiClient'
import AuthModal from './AuthModal'
import CompanyPanel from './CompanyPanel'
import SettingsModal from './SettingsModal'
import { proxyImg } from '../utils/imgProxy'

const BrandedAvatar = ({ className = 'h-full w-full' }) => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="40" height="40" fill="#e2e8f0" />
    <circle cx="20" cy="15" r="8" fill="#94a3b8" />
    <path d="M4 40 Q4 28 20 28 Q36 28 36 40Z" fill="#94a3b8" />
  </svg>
)

const UserAvatar = ({ avatarUrl, className = 'h-full w-full object-cover' }) => {
  const [imgError, setImgError] = useState(false)
  if (avatarUrl && !imgError) {
    return <img src={avatarUrl} alt="Avatar" className={className} onError={() => setImgError(true)} />
  }
  return <BrandedAvatar />
}

const Header = ({ companyRefreshKey = 0, onOpenSettings }) => {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { isDev } = useDev(user?.id)
  const { theme, setTheme } = useTheme()
  const { lang, changeLang, t } = useLang()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dbAvatarUrl, setDbAvatarUrl] = useState(null)
  const notificationRef = useRef(null)
  const closeTimer = useRef(null)
  const searchRef = useRef(null)
  const searchTimer = useRef(null)

  // Fetch username del usuario logueado para construir la URL del perfil
  useEffect(() => {
    if (!user) { setProfileUsername(null); setCompanyData(null); setDbAvatarUrl(null); return }
    supabase
      .from('usuarios')
      .select('username, company_id, avatar_url')
      .eq('id_usuario', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileUsername(data?.username || null)
        setDbAvatarUrl(data?.avatar_url || null)
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
      await api.post('/notificaciones/leidas', {
        items: [{ source_type: item.sourceType, source_id: item.sourceId }],
      })
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
      await api.post('/notificaciones/leidas', {
        items: unread.map(n => ({ source_type: n.sourceType, source_id: n.sourceId })),
      })
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
        // El backend elige la RPC correcta (empresa vs receptor) server-side.
        await api.post(`/enterprise/invitaciones/${invitation.id}/aceptar`)
      } else {
        await api.patch(`/enterprise/invitaciones/${invitation.id}`, { status })
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

  const getUserAvatar = () => (
    <UserAvatar avatarUrl={dbAvatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture} />
  )

  const getUserName = () => {
    if (!user) return ''
    return user.user_metadata?.nombre || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  }

  const Icon = ({ d, className = 'h-4 w-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )

  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  const isNavActive = (href) => {
    if (href === '/') return currentPath === '/' || currentPath === ''
    return currentPath === href || currentPath.startsWith(`${href}/`)
  }

  const NavLink = ({ href, label, className: cls = '', mobile = false }) => {
    const active = isNavActive(href)
    return (
      <a
        href={href}
        aria-current={active ? 'page' : undefined}
        onClick={mobile ? () => setMobileMenuOpen(false) : undefined}
        className={[
          'relative text-sm transition-colors',
          mobile ? 'flex w-full items-center px-3 py-2' : 'px-2 py-1',
          active
            ? 'font-semibold text-slate-900'
            : `font-normal text-slate-500 hover:text-slate-800 ${cls || ''}`,
        ].join(' ')}
      >
        {label}
        {active && (
          <span
            aria-hidden="true"
            className={`header-nav-underline pointer-events-none absolute h-px rounded-full ${
              mobile ? 'left-3 right-3 bottom-1' : 'left-1 right-1 -bottom-0.5'
            }`}
          />
        )}
      </a>
    )
  }

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
            <img src="/favicon.png" alt="PrompTool" className="h-7 w-7 object-contain" />
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <span className="text-lg font-bold tracking-tight text-slate-900">Promp<span style={{ color: 'rgb(var(--color-accent))' }}>Tool</span></span>
          </a>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search — botón en móvil, barra en desktop */}
          <div ref={searchRef} className="relative">
            {/* Mobile search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex sm:hidden h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label={lang === 'en' ? 'Search users' : 'Buscar usuarios'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Desktop search bar */}
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 transition focus-within:border-slate-400 focus-within:bg-white w-44 md:w-56">
              <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

            {/* Search modal/dropdown — full screen en mobile */}
            {searchOpen && (
              <div className="fixed sm:absolute inset-0 sm:inset-auto sm:left-0 sm:right-0 sm:top-full sm:mt-1 z-[300] sm:rounded-xl bg-white sm:border sm:border-slate-200 sm:shadow-xl overflow-hidden">
                {/* Mobile header */}
                <div className="sm:hidden flex items-center gap-3 border-b border-slate-200 px-4 py-3 bg-white sticky top-0">
                  <button
                    onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={e => handleSearch(e.target.value)}
                      placeholder={lang === 'en' ? 'Search users...' : 'Buscar usuarios...'}
                      className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                    />
                    {searchLoading && (
                      <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                    )}
                  </div>
                </div>

                {/* Results */}
                <div className="max-h-[calc(100vh-5rem)] sm:max-h-96 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <>
                      <p className="px-3 pt-3 sm:pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {lang === 'en' ? 'Users' : 'Usuarios'}
                      </p>
                      {searchResults.map(u => {
                        const name = u.nombre_display || u.nombre || u.username || 'User'
                        const href = u.username ? `/user/${u.username}` : `/usuario.html?id=${u.id_usuario}`
                        return (
                          <a key={u.id_usuario} href={href}
                            onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                            className="flex items-center gap-3 px-3 py-3 sm:py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 active:bg-slate-100">
                            <div className="flex h-10 w-10 sm:h-7 sm:w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                              {u.avatar_url
                                ? <img src={proxyImg(u.avatar_url)} alt={name} className="h-full w-full object-cover" />
                                : <span className="text-sm sm:text-xs font-semibold text-slate-600">{name.substring(0, 2).toUpperCase()}</span>
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
                    <p className="px-3 py-8 text-center text-sm text-slate-400">
                      {searchQuery ? (lang === 'en' ? 'No users found' : 'Sin resultados') : (lang === 'en' ? 'Type to search...' : 'Escribe para buscar...')}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Nav links */}
          <nav className="hidden items-center gap-2 md:flex">
            {navLinks.map(({ href, label, className: cls }) => (
              <NavLink key={href} href={href} label={label} className={cls} />
            ))}
          </nav>

          {/* Hamburger — solo mobile */}
          <button
            onClick={() => setMobileMenuOpen(f => !f)}
            className="flex md:hidden h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen
              ? <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              : <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            }
          </button>

          {/* Avatar o login */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {loading ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-100">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              </div>
            ) : user ? (
              <>
                {/* Botón de empresa — solo si el usuario pertenece a una */}
                {companyData && (
                  <button
                    onClick={() => setCompanyPanelOpen(true)}
                    className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition group"
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
                    <span className="max-w-[120px] truncate">
                      {companyData.company_name || companyData.nombre_display}
                    </span>
                    {companyData.verified && (
                      <svg className="h-3.5 w-3.5 text-violet-500 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z"/>
                      </svg>
                    )}
                  </button>
                )}

                {/* Botón de configuración */}
                {onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200"
                    title={lang === 'en' ? 'Settings' : 'Configuración'}
                    aria-label={lang === 'en' ? 'Settings' : 'Configuración'}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}

                <div ref={notificationRef} className="relative z-[205]">
                  <button
                    onClick={() => {
                      const next = !notificationOpen
                      setNotificationOpen(next)
                      if (next) fetchNotifications()
                    }}
                    className="relative flex h-10 w-10 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 rounded-full active:bg-slate-200"
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
                    <div className="fixed sm:absolute inset-x-2 top-[4.5rem] sm:inset-x-auto sm:right-0 sm:top-11 z-[206] w-auto sm:w-96 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
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
                              ) : item.sourceType === 'guide_suggestion' ? (
                                /* Guide assigned icon */
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 mt-0.5">
                                  <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
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
                  className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 transition-all hover:shadow-md border-2 ${isAdmin ? 'border-purple-400 hover:border-purple-500' : 'border-slate-200 hover:border-slate-300'}`}>
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
                          <button onClick={() => { setSettingsOpen(true); setUserMenuOpen(false) }}
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

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <>
          {/* Overlay — cierra el menú al tocar fuera */}
          <div
            className="md:hidden fixed inset-0 z-[98] bg-black/20"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed inset-x-0 top-[57px] z-[99] border-t border-slate-200 bg-white shadow-xl" style={{ maxHeight: 'calc(100dvh - 57px)', overflowY: 'auto' }}>
          <div className="px-4 py-3 space-y-3">
            {/* Búsqueda móvil */}
            <div className="relative">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition focus-within:border-slate-400 focus-within:bg-white">
                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder={lang === 'en' ? 'Search users...' : 'Buscar usuarios...'}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
                {searchLoading && (
                  <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                )}
              </div>

              {searchOpen && searchQuery && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
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
                            onClick={() => { setSearchOpen(false); setSearchQuery(''); setMobileMenuOpen(false) }}
                            className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 transition active:bg-slate-100">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                              {u.avatar_url
                                ? <img src={proxyImg(u.avatar_url)} alt={name} className="h-full w-full object-cover" />
                                : <span className="text-xs font-semibold text-slate-600">{name.substring(0, 2).toUpperCase()}</span>
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium leading-tight truncate">{name}</p>
                              {u.username && <p className="text-xs text-slate-400 truncate">@{u.username}</p>}
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

            {/* Botón de empresa móvil */}
            {user && companyData && (
              <button
                onClick={() => { setCompanyPanelOpen(true); setMobileMenuOpen(false) }}
                className="flex w-full items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-medium text-violet-700 transition active:bg-violet-100"
              >
                <div className="relative h-6 w-6 rounded-md overflow-hidden bg-violet-100 shrink-0 flex items-center justify-center">
                  {companyData.avatar_url
                    ? <img src={proxyImg(companyData.avatar_url)} alt="" className="h-full w-full object-cover" />
                    : <span className="text-[9px] font-bold text-violet-600">
                        {(companyData.company_name || companyData.nombre_display || 'E').substring(0, 2).toUpperCase()}
                      </span>
                  }
                </div>
                <span className="flex-1 truncate text-left">
                  {companyData.company_name || companyData.nombre_display}
                </span>
                {companyData.verified && (
                  <svg className="h-4 w-4 text-violet-500 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z"/>
                  </svg>
                )}
              </button>
            )}

            {/* Navegación */}
            <nav className="space-y-1">
              {navLinks.map(({ href, label, className: cls }) => (
                <NavLink key={href} href={href} label={label} className={cls} mobile />
              ))}
            </nav>

            {/* Botones de acción móvil */}
            {user ? (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <a href={profileHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition active:bg-slate-50">
                  <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  {t('viewProfile')}
                </a>
                <button
                  onClick={() => { setMobileMenuOpen(false); onOpenSettings?.() }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition active:bg-slate-50">
                  <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  {t('settings')}
                </button>
                <button
                  onClick={() => { signOut(); setMobileMenuOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-600 transition active:bg-rose-50">
                  <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  {t('signOut')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setMobileMenuOpen(false); setAuthModalOpen(true) }}
                className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition active:opacity-80"
                style={{ backgroundColor: 'rgb(var(--color-accent))' }}
              >
                {t('signIn')}
              </button>
            )}
          </div>
        </div>
        </>
      )}

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

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        signOut={signOut}
      />
    </>
  )
}

export default Header
