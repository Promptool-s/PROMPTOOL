import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useLang } from '../contexts/LangContext'
import Header from './Header'
import Footer from './Footer'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { proxyImg } from '../utils/imgProxy'
import { nowAR } from '../utils/dateAR'

const EnterprisePanel = ({ user }) => {
  const { lang } = useLang()
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') || 'dashboard'
  })
  const [companyData, setCompanyData] = useState(null)
  const [teamUsers, setTeamUsers] = useState([])
  const [enterpriseRequests, setEnterpriseRequests] = useState([])
  const [enterpriseLoadingRequests, setEnterpriseLoadingRequests] = useState(false)
  const [enterpriseActionStatus, setEnterpriseActionStatus] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [challengeModalOpen, setChallengeModalOpen] = useState(false)
  const [creatingChallenge, setCreatingChallenge] = useState(false)
  const [challengeStatus, setChallengeStatus] = useState(null)
  const [challengeForm, setChallengeForm] = useState({
    prompt: '',
    difficulty: 'Medium',
    theme: '',
    description: '',
    timeLimit: 180, // segundos
    maxAttempts: 0, // 0 = ilimitado
    minWords: 10,
    startDate: '',
    endDate: '',
    visibility: 'private', // private | public
    points: 100,
    tags: [],
    hints: ['', '', ''],
    evaluationMode: 'standard', // standard | strict | flexible
  })
  const [challengeImageFile, setChallengeImageFile] = useState(null)
  const [challengeImagePreview, setChallengeImagePreview] = useState(null)
  const [loading, setLoading] = useState(true)
  // Gestión de miembros
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [editingName, setEditingName] = useState(null)
  const [savingName, setSavingName] = useState(false)
  // Settings
  const [settingsForm, setSettingsForm] = useState({
    company_name: '',
    bio: '',
    website: '',
    allowed_diffs: ['Easy', 'Medium', 'Hard'],
    industry_type: 'marketing',
    tournament_enabled: false,
    default_challenge_type: 'standard',
    default_challenge_mode: 'static',
    performance_metrics: {
      trackTimePerAttempt: true,
      trackImprovementRate: true,
      trackKeywordEffectiveness: true,
      trackDepartmentComparison: true,
      generateWeeklyReports: false,
      generateMonthlyReports: true
    },
    training_config: {
      enableProgressTracking: true,
      enablePeerReview: false,
      enableManagerApproval: false,
      defaultFeedbackLevel: 'immediate',
      enableCertificates: false,
      enableLeaderboards: true,
      leaderboardScope: 'company'
    }
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsStatus, setSettingsStatus] = useState(null)
  // Cancelar invitación
  const [cancellingId, setCancellingId] = useState(null)
  const [copyLinkStatus, setCopyLinkStatus] = useState(null) // null | 'copied'
  // Analytics de progreso
  const [teamProgressData, setTeamProgressData] = useState([]) // intentos del equipo agrupados por día
  // Desafíos
  const [challenges, setChallenges] = useState([])
  const [loadingChallenges, setLoadingChallenges] = useState(false)
  // Intentos por desafío
  const [challengeAttempts, setChallengeAttempts] = useState({}) // { id_imagen: [intentos] }
  const [loadingAttempts, setLoadingAttempts] = useState(false)
  const [expandedChallenge, setExpandedChallenge] = useState(null) // id_imagen expandido
  const [expandedMember, setExpandedMember] = useState(null)       // { challengeId, userId }
  const [editingChallenge, setEditingChallenge] = useState(null)   // challenge being edited
  
  // Filtros del dashboard
  const [dashboardFilters, setDashboardFilters] = useState({
    timeRange: '30', // 7, 30, 90, 'all'
    selectedMember: 'all', // 'all' o id_usuario
    difficulty: 'all', // 'all', 'Easy', 'Medium', 'Hard'
    metric: 'score', // 'score', 'elo', 'attempts', 'improvement'
  })

  const fetchChallenges = async () => {
    if (!companyData?.id_usuario) return
    setLoadingChallenges(true)
    try {
      const { data, error } = await supabase
        .from('imagenes_ia')
        .select('id_imagen, url_image, image_diff, image_theme, fecha, prompt_original')
        .eq('company_id', companyData.id_usuario)
        .order('fecha', { ascending: false })
      if (error) throw error
      setChallenges(data || [])
    } catch {
      // fetch challenges failed silently
    } finally {
      setLoadingChallenges(false)
    }
  }

  const fetchChallengeAttempts = async () => {
    if (!companyData?.id_usuario || challenges.length === 0 || teamUsers.length === 0) return
    setLoadingAttempts(true)
    try {
      const challengeIds = challenges.map(c => c.id_imagen)
      const memberIds = teamUsers.map(m => m.id_usuario)

      const { data, error } = await supabase
        .from('intentos')
        .select('id_intento, id_usuario, id_imagen, puntaje_similitud, prompt_usuario, strengths, improvements, fecha_hora, modo')
        .in('id_imagen', challengeIds)
        .in('id_usuario', memberIds)
        .order('fecha_hora', { ascending: false })

      if (error) throw error

      // Agrupar por id_imagen
      const grouped = {}
      ;(data || []).forEach(intento => {
        if (!grouped[intento.id_imagen]) grouped[intento.id_imagen] = []
        grouped[intento.id_imagen].push(intento)
      })
      setChallengeAttempts(grouped)
    } catch {
      // fetch challenge attempts failed silently
    } finally {
      setLoadingAttempts(false)
    }
  }

  // Fetch company data
  useEffect(() => {
    if (!user) return
    const fetchCompanyData = async () => {
      try {
        const { data: company, error } = await supabase
          .from('usuarios')
          .select('company_name, user_type, id_usuario, bio, social_website, settings_allowed_diffs, industry_type, tournament_enabled, default_challenge_type, default_challenge_mode, performance_metrics, training_config')
          .eq('id_usuario', user.id)
          .maybeSingle()

        if (error) throw error
        setCompanyData(company)
        if (company) {
          setSettingsForm({
            company_name: company.company_name || '',
            bio: company.bio || '',
            website: company.social_website || '',
            allowed_diffs: company.settings_allowed_diffs || ['Easy', 'Medium', 'Hard'],
            industry_type: company.industry_type || 'marketing',
            tournament_enabled: company.tournament_enabled || false,
            default_challenge_type: company.default_challenge_type || 'standard',
            default_challenge_mode: company.default_challenge_mode || 'static',
            performance_metrics: company.performance_metrics || {
              trackTimePerAttempt: true,
              trackImprovementRate: true,
              trackKeywordEffectiveness: true,
              trackDepartmentComparison: true,
              generateWeeklyReports: false,
              generateMonthlyReports: true
            },
            training_config: company.training_config || {
              enableProgressTracking: true,
              enablePeerReview: false,
              enableManagerApproval: false,
              defaultFeedbackLevel: 'immediate',
              enableCertificates: false,
              enableLeaderboards: true,
              leaderboardScope: 'company'
            }
          })
        }        
        // Fetch team members (users under this company)
        if (company) {
          const { data: members } = await supabase
            .from('usuarios')
            .select('id_usuario, nombre, nombre_display, username, avatar_url, email, elo_rating, total_intentos, promedio_score, porcentaje_aprobacion, racha_actual, company_role, company_joined_at, created_at')
            .eq('company_id', company.id_usuario)
            .order('elo_rating', { ascending: false })
          setTeamUsers(members || [])

          // Fetch progreso del equipo — últimos 30 días de intentos de miembros
          if ((members || []).length > 0) {
            const memberIds = (members || []).map(m => m.id_usuario)
            const since = new Date()
            since.setDate(since.getDate() - 29)
            const { data: progressData } = await supabase
              .from('intentos')
              .select('id_usuario, puntaje_similitud, fecha_hora')
              .in('id_usuario', memberIds)
              .gte('fecha_hora', since.toISOString())
              .order('fecha_hora', { ascending: true })

            // Agrupar por día: promedio de score del equipo
            const byDay = {}
            ;(progressData || []).forEach(i => {
              const day = i.fecha_hora.slice(0, 10)
              if (!byDay[day]) byDay[day] = []
              byDay[day].push(i.puntaje_similitud || 0)
            })
            const days = []
            for (let d = 0; d < 30; d++) {
              const date = new Date(since)
              date.setDate(date.getDate() + d)
              const key = date.toISOString().slice(0, 10)
              const scores = byDay[key] || []
              days.push({
                date: key,
                label: date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
                avg: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
                count: scores.length,
              })
            }
            setTeamProgressData(days)
          }

          // Fetch challenges
          const { data: chs } = await supabase
            .from('imagenes_ia')
            .select('id_imagen, url_image, image_diff, image_theme, fecha, prompt_original')
            .eq('company_id', company.id_usuario)
            .order('fecha', { ascending: false })
          setChallenges(chs || [])

          // Fetch intentos de esos desafíos por miembros del equipo
          if ((chs || []).length > 0 && (members || []).length > 0) {
            const challengeIds = (chs || []).map(c => c.id_imagen)
            const memberIds = (members || []).map(m => m.id_usuario)
            const { data: attemptsData } = await supabase
              .from('intentos')
              .select('id_intento, id_usuario, id_imagen, puntaje_similitud, prompt_usuario, strengths, improvements, fecha_hora, modo')
              .in('id_imagen', challengeIds)
              .in('id_usuario', memberIds)
              .order('fecha_hora', { ascending: false })
            const grouped = {}
            ;(attemptsData || []).forEach(intento => {
              if (!grouped[intento.id_imagen]) grouped[intento.id_imagen] = []
              grouped[intento.id_imagen].push(intento)
            })
            setChallengeAttempts(grouped)
          }
        }
      } catch {
        // fetch company data failed silently
      } finally {
        setLoading(false)
      }
    }

    fetchCompanyData()
  }, [user?.id])

  const fetchEnterpriseRequests = async () => {
    if (!user?.id) return
    setEnterpriseLoadingRequests(true)
    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('id, user_email, user_id, status, message, created_at, usuarios!team_invitations_user_id_fkey(nombre, nombre_display, username, avatar_url)')
        .eq('company_id', user.id)
        .order('created_at', { ascending: false })
      if (error) {
        // Fallback sin join si la FK no existe
        const { data: fallback, error: fallbackErr } = await supabase
          .from('team_invitations')
          .select('id, user_email, user_id, status, message, created_at')
          .eq('company_id', user.id)
          .order('created_at', { ascending: false })
        if (fallbackErr) throw fallbackErr
        setEnterpriseRequests(fallback || [])
      } else {
        setEnterpriseRequests(data || [])
      }
    } catch {
      setEnterpriseRequests([])
    } finally {
      setEnterpriseLoadingRequests(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    fetchEnterpriseRequests()
  }, [user?.id])

  const sendEnterpriseInvite = async (event) => {
    event.preventDefault()
    if (!inviteEmail.trim()) {
      setEnterpriseActionStatus(lang === 'en' ? 'Enter an email.' : 'Ingresa un email.')
      return
    }
    setEnterpriseActionStatus(lang === 'en' ? 'Sending invitation...' : 'Enviando invitación...')
    try {
      const { data: existingUser } = await supabase
        .from('usuarios')
        .select('id_usuario')
        .eq('email', inviteEmail.trim())
        .maybeSingle()

      // Verificar si ya es miembro de esta empresa
      if (existingUser?.id_usuario) {
        const { data: alreadyMember } = await supabase
          .from('usuarios')
          .select('company_id')
          .eq('id_usuario', existingUser.id_usuario)
          .maybeSingle()
        if (alreadyMember?.company_id === user.id) {
          setEnterpriseActionStatus(lang === 'en' ? 'This user is already a member.' : 'Este usuario ya es miembro.')
          return
        }

        // Verificar si ya tiene una invitación pendiente o aceptada
        const { data: existingInvite } = await supabase
          .from('team_invitations')
          .select('id, status')
          .eq('company_id', user.id)
          .eq('user_id', existingUser.id_usuario)
          .in('status', ['pending', 'accepted', 'requested'])
          .maybeSingle()
        if (existingInvite) {
          const msg = existingInvite.status === 'pending'
            ? (lang === 'en' ? 'An invitation is already pending for this user.' : 'Ya hay una invitación pendiente para este usuario.')
            : existingInvite.status === 'accepted'
              ? (lang === 'en' ? 'This user is already a member.' : 'Este usuario ya es miembro.')
              : (lang === 'en' ? 'This user already requested to join.' : 'Este usuario ya solicitó unirse.')
          setEnterpriseActionStatus(msg)
          return
        }
      }

      const payload = {
        company_id: user.id,
        user_email: inviteEmail.trim(),
        user_id: existingUser?.id_usuario || null,
        status: 'pending',
        message: inviteMessage.trim(),
      }

      const { error } = await supabase.from('team_invitations').insert([payload])
      if (error) throw error

      setInviteEmail('')
      setInviteMessage('')
      setEnterpriseActionStatus(lang === 'en' ? 'Invitation sent.' : 'Invitación enviada.')
      fetchEnterpriseRequests()
    } catch {
      setEnterpriseActionStatus(lang === 'en' ? 'Could not send invitation.' : 'No se pudo enviar la invitación.')
    }
  }

  const updateEnterpriseRequestStatus = async (request, status) => {
    if (!request?.id) return
    try {
      if (status === 'accepted') {
        // Usar RPC con SECURITY DEFINER para poder escribir company_id en el usuario
        const { error } = await supabase.rpc('accept_team_invitation', { invitation_id: request.id })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('team_invitations')
          .update({ status })
          .eq('id', request.id)
        if (error) throw error
      }

      setEnterpriseActionStatus(
        status === 'accepted'
          ? (lang === 'en' ? 'Request accepted.' : 'Solicitud aceptada.')
          : (lang === 'en' ? 'Request rejected.' : 'Solicitud rechazada.'),
      )

      // Refrescar lista de miembros
      const { data: members } = await supabase
        .from('usuarios')
        .select('id_usuario, nombre, nombre_display, username, avatar_url, email, elo_rating, total_intentos, promedio_score, porcentaje_aprobacion, racha_actual, company_role, company_joined_at, created_at')
        .eq('company_id', user.id)
        .order('elo_rating', { ascending: false })
      setTeamUsers(members || [])

      fetchEnterpriseRequests()
    } catch {
      setEnterpriseActionStatus(lang === 'en' ? 'Could not update request.' : 'No se pudo actualizar la solicitud.')
    }
  }

  const cancelEnterpriseInvite = async (requestId) => {
    setCancellingId(requestId)
    try {
      const { error } = await supabase.from('team_invitations').delete().eq('id', requestId)
      if (error) throw error
      setEnterpriseActionStatus(lang === 'en' ? 'Invitation cancelled.' : 'Invitación cancelada.')
      fetchEnterpriseRequests()
    } catch {
      setEnterpriseActionStatus(lang === 'en' ? 'Could not cancel invitation.' : 'No se pudo cancelar la invitación.')
    } finally {
      setCancellingId(null)
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    setSettingsStatus(null)
    try {
      const updates = {
        company_name: settingsForm.company_name.trim(),
        bio: settingsForm.bio.trim(),
        social_website: settingsForm.website.trim(),
        settings_allowed_diffs: settingsForm.allowed_diffs,
        industry_type: settingsForm.industry_type,
        tournament_enabled: settingsForm.tournament_enabled,
        default_challenge_type: settingsForm.default_challenge_type,
        default_challenge_mode: settingsForm.default_challenge_mode,
        performance_metrics: settingsForm.performance_metrics,
        training_config: settingsForm.training_config,
      }
      const { error } = await supabase.from('usuarios').update(updates).eq('id_usuario', user.id)
      if (error) throw error
      setCompanyData(prev => ({ ...prev, ...updates }))
      setSettingsStatus('ok')
      setTimeout(() => setSettingsStatus(null), 2500)
    } catch {
      setSettingsStatus('error')
    } finally {
      setSavingSettings(false)
    }
  }

  const assignRole = async (userId, role) => {
    try {
      const { error } = await supabase.rpc('assign_company_role', {
        target_user_id: userId,
        role,
      })
      if (error) throw error
      setTeamUsers(prev => prev.map(u => u.id_usuario === userId ? { ...u, company_role: role || null } : u))
    } catch {
      // assign role failed silently
    }
  }

  const removeMember = async (userId) => {
    setRemovingId(userId)
    try {
      const { error } = await supabase.rpc('remove_team_member', { target_user_id: userId })
      if (error) throw error
      setTeamUsers(prev => prev.filter(u => u.id_usuario !== userId))
      setConfirmRemove(null)
    } catch {
      // remove member failed silently
    } finally {
      setRemovingId(null)
    }
  }

  const saveMemberName = async () => {
    if (!editingName || !editingName.value.trim()) return
    setSavingName(true)
    try {
      const { error } = await supabase.rpc('rename_team_member', {
        target_user_id: editingName.id,
        new_display_name: editingName.value.trim(),
      })
      if (error) throw error
      setTeamUsers(prev => prev.map(u =>
        u.id_usuario === editingName.id ? { ...u, nombre_display: editingName.value.trim() } : u
      ))
      setEditingName(null)
    } catch {
      // rename member failed silently
    } finally {
      setSavingName(false)
    }
  }

  const resetChallengeForm = () => {
    setChallengeForm({
      prompt: '',
      difficulty: 'Medium',
      theme: '',
      description: '',
      timeLimit: 180,
      maxAttempts: 0,
      minWords: 10,
      startDate: '',
      endDate: '',
      visibility: 'private',
      points: 100,
      tags: [],
      hints: ['', '', ''],
      evaluationMode: 'standard',
    })
    setChallengeImageFile(null)
    setChallengeImagePreview(null)
    setChallengeStatus(null)
  }

  const openChallengeModal = () => {
    resetChallengeForm()
    setEditingChallenge(null)
    setChallengeModalOpen(true)
  }

  const openEditChallengeModal = (challenge) => {
    // Load challenge data into form
    setChallengeForm({
      prompt: challenge.prompt_original || '',
      difficulty: challenge.image_diff || 'Medium',
      theme: challenge.image_theme || '',
      description: challenge.challenge_description || '',
      timeLimit: challenge.challenge_time_limit || 180,
      maxAttempts: challenge.challenge_max_attempts || 0,
      minWords: challenge.challenge_min_words || 10,
      startDate: challenge.challenge_start_date || '',
      endDate: challenge.challenge_end_date || '',
      visibility: challenge.challenge_visibility || 'private',
      points: challenge.challenge_points || 100,
      tags: challenge.challenge_tags || [],
      hints: challenge.challenge_hints || ['', '', ''],
      evaluationMode: challenge.challenge_evaluation_mode || 'standard',
    })
    setChallengeImagePreview(challenge.url_image)
    setEditingChallenge(challenge)
    setChallengeModalOpen(true)
  }

  const closeChallengeModal = () => {
    setChallengeModalOpen(false)
  }

  const handleChallengeImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setChallengeImageFile(file)
    setChallengeImagePreview(URL.createObjectURL(file))
  }

  const createChallenge = async (event) => {
    event.preventDefault()
    
    // If editing, update instead of create
    if (editingChallenge) {
      return updateChallenge(event)
    }
    
    if (!challengeImageFile || !challengeForm.prompt.trim() || !challengeForm.theme.trim()) {
      setChallengeStatus(lang === 'en'
        ? 'Complete image, prompt and theme.'
        : 'Completa imagen, prompt y temática.')
      return
    }

    setCreatingChallenge(true)
    setChallengeStatus(lang === 'en' ? 'Uploading image...' : 'Subiendo imagen...')
    try {
      const ext = (challengeImageFile.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/${Date.now()}-challenge.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('enterprise-challenges')
        .upload(path, challengeImageFile, { upsert: false })
      if (uploadError) throw new Error(`Storage: ${uploadError.message}`)

      const { data: publicData } = supabase.storage
        .from('enterprise-challenges')
        .getPublicUrl(path)
      const imageUrl = publicData.publicUrl

      setChallengeStatus(lang === 'en' ? 'Saving challenge...' : 'Guardando desafío...')

      const payload = {
        url_image: imageUrl,
        prompt_original: challengeForm.prompt.trim(),
        image_diff: challengeForm.difficulty,
        image_theme: challengeForm.theme.trim(),
        fecha: nowAR(),
        company_id: companyData?.id_usuario || user.id,
        // Nuevos campos de personalización
        challenge_description: challengeForm.description.trim() || null,
        challenge_time_limit: challengeForm.timeLimit,
        challenge_max_attempts: challengeForm.maxAttempts || null,
        challenge_min_words: challengeForm.minWords,
        challenge_start_date: challengeForm.startDate || null,
        challenge_end_date: challengeForm.endDate || null,
        challenge_visibility: challengeForm.visibility,
        challenge_points: challengeForm.points,
        challenge_tags: challengeForm.tags.filter(t => t.trim()),
        challenge_hints: challengeForm.hints.filter(h => h.trim()),
        challenge_evaluation_mode: challengeForm.evaluationMode,
      }

      const { error: insertError } = await supabase.from('imagenes_ia').insert([payload])
      if (insertError) throw new Error(`DB: ${insertError.message}`)

      setChallengeStatus(lang === 'en' ? 'Challenge created successfully.' : 'Desafío creado correctamente.')
      fetchChallenges()
      setTimeout(() => closeChallengeModal(), 1000)
    } catch (err) {
      setChallengeStatus(err?.message || (lang === 'en' ? 'Could not create challenge.' : 'No se pudo crear el desafío.'))
    } finally {
      setCreatingChallenge(false)
    }
  }

  const updateChallenge = async (event) => {
    event.preventDefault()
    if (!challengeForm.prompt.trim() || !challengeForm.theme.trim()) {
      setChallengeStatus(lang === 'en'
        ? 'Complete prompt and theme.'
        : 'Completa prompt y temática.')
      return
    }

    setCreatingChallenge(true)
    setChallengeStatus(lang === 'en' ? 'Updating challenge...' : 'Actualizando desafío...')
    try {
      let imageUrl = editingChallenge.url_image

      // If new image uploaded, upload it
      if (challengeImageFile) {
        const ext = (challengeImageFile.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/${Date.now()}-challenge.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('enterprise-challenges')
          .upload(path, challengeImageFile, { upsert: false })
        if (uploadError) throw new Error(`Storage: ${uploadError.message}`)

        const { data: publicData } = supabase.storage
          .from('enterprise-challenges')
          .getPublicUrl(path)
        imageUrl = publicData.publicUrl
      }

      const payload = {
        url_image: imageUrl,
        prompt_original: challengeForm.prompt.trim(),
        image_diff: challengeForm.difficulty,
        image_theme: challengeForm.theme.trim(),
        challenge_description: challengeForm.description.trim() || null,
        challenge_time_limit: challengeForm.timeLimit,
        challenge_max_attempts: challengeForm.maxAttempts || null,
        challenge_min_words: challengeForm.minWords,
        challenge_start_date: challengeForm.startDate || null,
        challenge_end_date: challengeForm.endDate || null,
        challenge_visibility: challengeForm.visibility,
        challenge_points: challengeForm.points,
        challenge_tags: challengeForm.tags.filter(t => t.trim()),
        challenge_hints: challengeForm.hints.filter(h => h.trim()),
        challenge_evaluation_mode: challengeForm.evaluationMode,
      }

      const { error: updateError } = await supabase
        .from('imagenes_ia')
        .update(payload)
        .eq('id_imagen', editingChallenge.id_imagen)
      if (updateError) throw new Error(`DB: ${updateError.message}`)

      setChallengeStatus(lang === 'en' ? 'Challenge updated successfully.' : 'Desafío actualizado correctamente.')
      fetchChallenges()
      setTimeout(() => closeChallengeModal(), 1000)
    } catch (err) {
      setChallengeStatus(err?.message || (lang === 'en' ? 'Could not update challenge.' : 'No se pudo actualizar el desafío.'))
    } finally {
      setCreatingChallenge(false)
    }
  }

  const tabs = [
    { id: 'dashboard', label: lang === 'en' ? 'Dashboard' : 'Dashboard', icon: 'dashboard' },
    { id: 'leaderboard', label: lang === 'en' ? 'Leaderboard' : 'Ranking', icon: 'leaderboard' },
    { id: 'users', label: lang === 'en' ? 'Team' : 'Equipo', icon: 'users' },
    { id: 'settings', label: lang === 'en' ? 'Settings' : 'Configuración', icon: 'settings' },
    {
      id: 'requests',
      label: lang === 'en' ? 'Requests' : 'Solicitudes',
      icon: '📥',
      badge: enterpriseRequests.filter(r => r.status === 'requested').length || null,
    },
    { id: 'challenges', label: lang === 'en' ? 'Challenges' : 'Desafíos', icon: 'challenges' },
  ]

  const renderDashboard = () => {
    const scoreColor = (s) => s >= 70 ? 'text-emerald-500' : s >= 50 ? 'text-amber-500' : 'text-rose-500'
    const scoreBg = (s) => s >= 70 ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' : s >= 50 ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
    const diffBadge = (d) => {
      const l = (d || '').toLowerCase()
      if (l === 'easy') return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
      if (l === 'hard') return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
      return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
    }

    // Filtrar datos según selección
    const filteredUsers = dashboardFilters.selectedMember === 'all' 
      ? teamUsers 
      : teamUsers.filter(u => u.id_usuario === dashboardFilters.selectedMember)

    // Calcular stats filtradas
    const avgScore = filteredUsers.length > 0
      ? Math.round(filteredUsers.reduce((sum, u) => sum + (u.promedio_score || 0), 0) / filteredUsers.length)
      : 0
    const avgElo = filteredUsers.length > 0
      ? Math.round(filteredUsers.reduce((sum, u) => sum + (u.elo_rating || 1000), 0) / filteredUsers.length)
      : 1000
    const totalAttempts = filteredUsers.reduce((sum, u) => sum + (u.total_intentos || 0), 0)
    const activeMembers = filteredUsers.filter(u => (u.total_intentos || 0) > 0).length

    return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {lang === 'en' ? 'Filters' : 'Filtros'}
          </h3>
          <button
            onClick={() => setDashboardFilters({ timeRange: '30', selectedMember: 'all', difficulty: 'all', metric: 'score' })}
            className="text-xs text-violet-600 hover:text-violet-700 font-medium"
          >
            {lang === 'en' ? 'Reset' : 'Restablecer'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Rango de tiempo */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              {lang === 'en' ? 'Time Range' : 'Período'}
            </label>
            <select
              value={dashboardFilters.timeRange}
              onChange={e => setDashboardFilters(f => ({ ...f, timeRange: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="7">{lang === 'en' ? 'Last 7 days' : 'Últimos 7 días'}</option>
              <option value="30">{lang === 'en' ? 'Last 30 days' : 'Últimos 30 días'}</option>
              <option value="90">{lang === 'en' ? 'Last 90 days' : 'Últimos 90 días'}</option>
              <option value="all">{lang === 'en' ? 'All time' : 'Todo el tiempo'}</option>
            </select>
          </div>

          {/* Miembro */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              {lang === 'en' ? 'Team Member' : 'Miembro'}
            </label>
            <select
              value={dashboardFilters.selectedMember}
              onChange={e => setDashboardFilters(f => ({ ...f, selectedMember: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="all">{lang === 'en' ? 'All members' : 'Todos los miembros'}</option>
              {teamUsers.map(u => (
                <option key={u.id_usuario} value={u.id_usuario}>
                  {u.nombre_display || u.nombre || u.email}
                </option>
              ))}
            </select>
          </div>

          {/* Dificultad */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              {lang === 'en' ? 'Difficulty' : 'Dificultad'}
            </label>
            <select
              value={dashboardFilters.difficulty}
              onChange={e => setDashboardFilters(f => ({ ...f, difficulty: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="all">{lang === 'en' ? 'All difficulties' : 'Todas'}</option>
              <option value="Easy">{lang === 'en' ? 'Easy' : 'Fácil'}</option>
              <option value="Medium">{lang === 'en' ? 'Medium' : 'Medio'}</option>
              <option value="Hard">{lang === 'en' ? 'Hard' : 'Difícil'}</option>
            </select>
          </div>

          {/* Métrica */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              {lang === 'en' ? 'Primary Metric' : 'Métrica Principal'}
            </label>
            <select
              value={dashboardFilters.metric}
              onChange={e => setDashboardFilters(f => ({ ...f, metric: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="score">{lang === 'en' ? 'Score' : 'Puntaje'}</option>
              <option value="elo">ELO</option>
              <option value="attempts">{lang === 'en' ? 'Attempts' : 'Intentos'}</option>
              <option value="improvement">{lang === 'en' ? 'Improvement' : 'Mejora'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            {dashboardFilters.selectedMember === 'all' 
              ? (lang === 'en' ? 'Team Members' : 'Miembros')
              : (lang === 'en' ? 'Selected' : 'Seleccionado')}
          </p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{filteredUsers.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {activeMembers} {lang === 'en' ? 'active' : 'activos'}
          </p>
        </div>
        
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            {lang === 'en' ? 'Avg ELO' : 'ELO Promedio'}
          </p>
          <p className="text-3xl font-bold text-violet-600">{avgElo}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'en' ? 'Rating' : 'Calificación'}
          </p>
        </div>
        
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            {lang === 'en' ? 'Avg Score' : 'Score Promedio'}
          </p>
          <p className={`text-3xl font-bold ${scoreColor(avgScore)}`}>{avgScore}%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'en' ? 'Performance' : 'Rendimiento'}
          </p>
        </div>
        
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            {lang === 'en' ? 'Total Attempts' : 'Intentos'}
          </p>
          <p className="text-3xl font-bold text-emerald-600">{totalAttempts}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'en' ? 'All time' : 'Histórico'}
          </p>
        </div>
      </div>

      {/* Gráfico de progreso del equipo */}
      {teamProgressData.some(d => d.avg !== null) && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {lang === 'en' ? 'Team Progress' : 'Progreso del Equipo'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'en' ? 'Average score — last 30 days' : 'Score promedio — últimos 30 días'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-violet-600">
                {(() => {
                  const withData = teamProgressData.filter(d => d.avg !== null)
                  return withData.length ? Math.round(withData.reduce((s, d) => s + d.avg, 0) / withData.length) : '—'
                })()}%
              </p>
              <p className="text-xs text-slate-400">{lang === 'en' ? 'period avg' : 'promedio del período'}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={teamProgressData.filter(d => d.avg !== null)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="teamGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs space-y-0.5">
                      <p className="font-semibold text-slate-500">{d.date}</p>
                      <p className="font-bold text-violet-600">{d.avg}%</p>
                      <p className="text-slate-400">{d.count} {lang === 'en' ? 'attempts' : 'intentos'}</p>
                    </div>
                  )
                }}
              />
              <Area type="monotone" dataKey="avg" stroke="#7c3aed" strokeWidth={2}
                fill="url(#teamGrad)" dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }}
                activeDot={{ r: 5 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>

          {/* Mini stats del período */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              {
                label: lang === 'en' ? 'Best day' : 'Mejor día',
                value: (() => { const m = teamProgressData.filter(d => d.avg !== null).reduce((best, d) => d.avg > (best?.avg ?? 0) ? d : best, null); return m ? `${m.avg}%` : '—' })(),
              },
              {
                label: lang === 'en' ? 'Total attempts' : 'Intentos totales',
                value: teamProgressData.reduce((s, d) => s + d.count, 0),
              },
              {
                label: lang === 'en' ? 'Active days' : 'Días activos',
                value: teamProgressData.filter(d => d.count > 0).length,
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-center">
                <p className="text-base font-bold text-slate-800 dark:text-slate-100">{value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top performers */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {lang === 'en' ? 'Top Performers' : 'Mejores Desempeños'}
        </h3>
        <div className="space-y-3">
          {[...teamUsers]
            .sort((a, b) => (b.elo_rating || 1000) - (a.elo_rating || 1000))
            .slice(0, 5)
            .map((u) => (
              <div key={u.id_usuario} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                    {u.avatar_url
                      ? <img src={proxyImg(u.avatar_url)} alt="" className="h-full w-full object-cover" />
                      : <span className="text-xs font-bold text-slate-500">{(u.nombre_display || u.nombre || 'U').substring(0,2).toUpperCase()}</span>
                    }
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{u.nombre_display || u.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-violet-600">{u.elo_rating || 1000}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{u.total_intentos ?? 0} {lang === 'en' ? 'attempts' : 'intentos'}</p>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Análisis por desafío */}
      {challenges.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {lang === 'en' ? 'Challenge Analysis' : 'Análisis por Desafío'}
          </h3>
          <p className="text-sm text-slate-500 mb-5">
            {lang === 'en' ? 'How each member performed on each challenge' : 'Cómo le fue a cada miembro en cada desafío'}
          </p>

          <div className="space-y-4">
            {challenges.map(ch => {
              const attempts = challengeAttempts[ch.id_imagen] || []
              const isExpanded = expandedChallenge === ch.id_imagen

              // Agrupar intentos por usuario (tomar el mejor)
              const byUser = {}
              attempts.forEach(a => {
                if (!byUser[a.id_usuario] || a.puntaje_similitud > byUser[a.id_usuario].best.puntaje_similitud) {
                  if (!byUser[a.id_usuario]) byUser[a.id_usuario] = { best: a, all: [] }
                  byUser[a.id_usuario].best = a
                }
                if (!byUser[a.id_usuario]) byUser[a.id_usuario] = { best: a, all: [] }
                byUser[a.id_usuario].all = [...(byUser[a.id_usuario]?.all || []), a]
              })

              // Reconstruir correctamente
              const userStats = {}
              attempts.forEach(a => {
                if (!userStats[a.id_usuario]) userStats[a.id_usuario] = { all: [], best: null }
                userStats[a.id_usuario].all.push(a)
                if (!userStats[a.id_usuario].best || a.puntaje_similitud > userStats[a.id_usuario].best.puntaje_similitud) {
                  userStats[a.id_usuario].best = a
                }
              })

              const participantCount = Object.keys(userStats).length
              const avgScore = participantCount > 0
                ? Math.round(Object.values(userStats).reduce((s, u) => s + u.best.puntaje_similitud, 0) / participantCount)
                : null

              return (
                <div key={ch.id_imagen} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {/* Header del desafío */}
                  <button
                    type="button"
                    onClick={() => setExpandedChallenge(isExpanded ? null : ch.id_imagen)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                  >
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200">
                      {ch.url_image
                        ? <img src={ch.url_image} alt="" className="h-full w-full object-cover" />
                        : <div className="h-full w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                          </div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${diffBadge(ch.image_diff)}`}>
                          {ch.image_diff || 'Medium'}
                        </span>
                        {ch.image_theme && (
                          <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5">{ch.image_theme}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{ch.prompt_original}</p>
                    </div>
                    <div className="shrink-0 text-right mr-2">
                      <p className="text-xs text-slate-500 mb-0.5">
                        {participantCount}/{teamUsers.length} {lang === 'en' ? 'played' : 'jugaron'}
                      </p>
                      {avgScore !== null && (
                        <p className={`text-lg font-bold ${scoreColor(avgScore)}`}>{avgScore}%</p>
                      )}
                      {participantCount === 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">{lang === 'en' ? 'No attempts' : 'Sin intentos'}</p>
                      )}
                    </div>
                    <svg
                      className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 dark:border-slate-800">
                      {/* Miembros que jugaron */}
                      {teamUsers.map(member => {
                        const mStats = userStats[member.id_usuario]
                        const memberName = member.nombre_display || member.nombre || member.username || member.email
                        const memberKey = `${ch.id_imagen}-${member.id_usuario}`
                        const isMemberExpanded = expandedMember === memberKey

                        if (!mStats) {
                          // No jugó
                          return (
                            <div key={member.id_usuario} className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 dark:border-slate-800 last:border-0 bg-slate-50/50 dark:bg-slate-800/50">
                              <div className="h-7 w-7 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                                {member.avatar_url
                                  ? <img src={proxyImg(member.avatar_url)} alt="" className="h-full w-full object-cover" />
                                  : <span className="text-[10px] font-bold text-slate-400">{memberName.substring(0,2).toUpperCase()}</span>
                                }
                              </div>
                              <p className="text-sm text-slate-400 dark:text-slate-500 flex-1">{memberName}</p>
                              <span className="text-xs text-slate-400 italic">{lang === 'en' ? 'Not attempted' : 'Sin intentar'}</span>
                            </div>
                          )
                        }

                        const best = mStats.best
                        const totalAttempts = mStats.all.length

                        return (
                          <div key={member.id_usuario} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                            {/* Fila del miembro */}
                            <button
                              type="button"
                              onClick={() => setExpandedMember(isMemberExpanded ? null : memberKey)}
                              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                            >
                              <div className="h-7 w-7 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                                {member.avatar_url
                                  ? <img src={proxyImg(member.avatar_url)} alt="" className="h-full w-full object-cover" />
                                  : <span className="text-[10px] font-bold text-slate-500">{memberName.substring(0,2).toUpperCase()}</span>
                                }
                              </div>
                              <p className="text-sm font-medium text-slate-800 flex-1">{memberName}</p>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                  {totalAttempts} {totalAttempts === 1 ? (lang === 'en' ? 'attempt' : 'intento') : (lang === 'en' ? 'attempts' : 'intentos')}
                                </span>
                                <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full border ${scoreBg(best.puntaje_similitud)} ${scoreColor(best.puntaje_similitud)}`}>
                                  {best.puntaje_similitud}%
                                </span>
                                <svg
                                  className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isMemberExpanded ? 'rotate-180' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {/* Detalle del miembro expandido */}
                            {isMemberExpanded && (
                              <div className="px-5 pb-4 space-y-3 bg-slate-50/60 dark:bg-slate-800/60">
                                {mStats.all.map((intento, idx) => (
                                  <div key={intento.id_intento} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-slate-500">
                                        {lang === 'en' ? `Attempt ${mStats.all.length - idx}` : `Intento ${mStats.all.length - idx}`}
                                        {idx === 0 && mStats.all.length > 1 && (
                                          <span className="ml-1.5 text-violet-600">{lang === 'en' ? '(best)' : '(mejor)'}</span>
                                        )}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                          {new Date(intento.fecha_hora).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className={`text-sm font-bold px-2 py-0.5 rounded-full border ${scoreBg(intento.puntaje_similitud)} ${scoreColor(intento.puntaje_similitud)}`}>
                                          {intento.puntaje_similitud}%
                                        </span>
                                      </div>
                                    </div>

                                    {intento.prompt_usuario && (
                                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 px-3 py-2.5">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Prompt</p>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">"{intento.prompt_usuario}"</p>
                                      </div>
                                    )}

                                    {(intento.strengths?.length > 0 || intento.improvements?.length > 0) && (
                                      <div className="grid grid-cols-2 gap-2">
                                        {intento.strengths?.length > 0 && (
                                          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-3 py-2">
                                            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-1.5">
                                              {lang === 'en' ? 'Strengths' : 'Fortalezas'}
                                            </p>
                                            <ul className="space-y-1">
                                              {intento.strengths.slice(0, 3).map((s, i) => (
                                                <li key={i} className="text-[11px] text-emerald-800 dark:text-emerald-300 flex gap-1.5 leading-snug">
                                                  <span className="text-emerald-500 shrink-0 mt-px">✓</span>{s}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {intento.improvements?.length > 0 && (
                                          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-3 py-2">
                                            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-1.5">
                                              {lang === 'en' ? 'To improve' : 'A mejorar'}
                                            </p>
                                            <ul className="space-y-1">
                                              {intento.improvements.slice(0, 3).map((s, i) => (
                                                <li key={i} className="text-[11px] text-amber-800 dark:text-amber-300 flex gap-1.5 leading-snug">
                                                  <span className="text-amber-500 shrink-0 mt-px">↑</span>{s}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
    )
  }

  const renderLeaderboard = () => {
    // Categorías de ranking
    const categories = [
      { 
        id: 'elo', 
        label: lang === 'en' ? 'Highest ELO' : 'Mayor ELO',
        getValue: (u) => u.elo_rating || 1000,
        format: (v) => v,
        color: 'violet'
      },
      { 
        id: 'score', 
        label: lang === 'en' ? 'Best Average Score' : 'Mejor Promedio',
        getValue: (u) => u.promedio_score || 0,
        format: (v) => `${v}%`,
        color: 'emerald'
      },
      { 
        id: 'attempts', 
        label: lang === 'en' ? 'Most Attempts' : 'Más Intentos',
        getValue: (u) => u.total_intentos || 0,
        format: (v) => v,
        color: 'amber'
      },
      { 
        id: 'streak', 
        label: lang === 'en' ? 'Longest Streak' : 'Mayor Racha',
        getValue: (u) => u.racha_actual || 0,
        format: (v) => `${v}d`,
        color: 'rose'
      },
    ]

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'en' ? 'Organization Leaderboard' : 'Tabla de la Organización'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'en' ? 'Top performers in each category' : 'Mejores en cada categoría'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {categories.map(category => {
            const sorted = [...teamUsers].sort((a, b) => category.getValue(b) - category.getValue(a))
            const top3 = sorted.slice(0, 3)
            
            const colorClasses = {
              violet: 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20',
              emerald: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20',
              amber: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20',
              rose: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20',
            }
            
            const textColorClasses = {
              violet: 'text-violet-600 dark:text-violet-400',
              emerald: 'text-emerald-600 dark:text-emerald-400',
              amber: 'text-amber-600 dark:text-amber-400',
              rose: 'text-rose-600 dark:text-rose-400',
            }

            return (
              <div key={category.id} className={`rounded-2xl border p-5 ${colorClasses[category.color]}`}>
                <h4 className={`text-sm font-semibold mb-4 ${textColorClasses[category.color]}`}>
                  {category.label}
                </h4>
                <div className="space-y-3">
                  {top3.map((user, idx) => {
                    const name = user.nombre_display || user.nombre || user.username || user.email
                    const value = category.getValue(user)
                    const medals = [
                      <svg key="1" className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
                      <svg key="2" className="h-4 w-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
                      <svg key="3" className="h-4 w-4 text-amber-700" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
                    ]
                    
                    return (
                      <div key={user.id_usuario} className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
                        <span className="text-lg shrink-0">{medals[idx]}</span>
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                          {user.avatar_url
                            ? <img src={proxyImg(user.avatar_url)} alt={name} className="h-full w-full object-cover" />
                            : <span className="text-xs font-bold text-slate-500">{name.substring(0,2).toUpperCase()}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                        <p className={`text-lg font-bold shrink-0 ${textColorClasses[category.color]}`}>
                          {category.format(value)}
                        </p>
                      </div>
                    )
                  })}
                  
                  {top3.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                      {lang === 'en' ? 'No data yet' : 'Sin datos aún'}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabla completa de ranking */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'en' ? 'Complete Ranking' : 'Ranking Completo'}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Member' : 'Miembro'}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Avg' : 'Prom.'}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Attempts' : 'Intentos'}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Streak' : 'Racha'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...teamUsers]
                  .sort((a, b) => (b.elo_rating || 1000) - (a.elo_rating || 1000))
                  .map((user, idx) => {
                    const name = user.nombre_display || user.nombre || user.username || user.email
                    const profileHref = user.username ? `/user/${user.username}` : `/perfil?id=${user.id_usuario}`
                    
                    return (
                      <tr key={user.id_usuario} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-slate-400">#{idx + 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                              {user.avatar_url
                                ? <img src={proxyImg(user.avatar_url)} alt={name} className="h-full w-full object-cover" />
                                : <span className="text-xs font-bold text-slate-500">{name.substring(0,2).toUpperCase()}</span>
                              }
                            </div>
                            <div className="min-w-0">
                              <a href={profileHref} className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-violet-600 truncate block">
                                {name}
                              </a>
                              <p className="text-xs text-slate-400 truncate">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-violet-600">{user.elo_rating || 1000}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{user.promedio_score ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{user.total_intentos || 0}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{user.racha_actual || 0}d</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {lang === 'en' ? 'Team Members' : 'Miembros del Equipo'}
          <span className="ml-2 text-sm font-normal text-slate-400">({teamUsers.length})</span>
        </h3>
        <button
          onClick={() => setActiveTab('requests')}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition"
        >
          + {lang === 'en' ? 'Invite User' : 'Invitar Usuario'}
        </button>
      </div>

      {teamUsers.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">{lang === 'en' ? 'No team members yet' : 'No hay miembros en el equipo'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Member' : 'Miembro'}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ELO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Avg' : 'Prom.'}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Attempts' : 'Intentos'}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Actions' : 'Acciones'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {teamUsers.map((member) => {
                const displayName = member.nombre_display || member.nombre || member.username || member.email
                const profileHref = member.username ? `/user/${member.username}` : `/perfil?id=${member.id_usuario}`
                const isEditingThis = editingName?.id === member.id_usuario
                const isConfirmingRemove = confirmRemove === member.id_usuario

                return (
                  <tr key={member.id_usuario} className={`transition ${isConfirmingRemove ? 'bg-rose-50' : 'hover:bg-slate-50'}`}>

                    {/* Nombre — editable inline */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center border border-slate-200">
                          {member.avatar_url
                            ? <img src={proxyImg(member.avatar_url)} alt={displayName} className="h-full w-full object-cover" />
                            : <span className="text-xs font-bold text-slate-500">{displayName?.substring(0,2).toUpperCase()}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          {isEditingThis ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                autoFocus
                                type="text"
                                value={editingName.value}
                                onChange={e => setEditingName(n => ({ ...n, value: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveMemberName()
                                  if (e.key === 'Escape') setEditingName(null)
                                }}
                                className="w-32 rounded-lg border border-violet-400 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                              />
                              <button
                                onClick={saveMemberName}
                                disabled={savingName}
                                className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                              >
                                {savingName ? '…' : '✓'}
                              </button>
                              <button
                                onClick={() => setEditingName(null)}
                                className="rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 dark:bg-slate-800"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group/name">
                              <a href={profileHref} className="text-sm font-medium text-slate-900 hover:text-violet-600 truncate max-w-[120px]">
                                {displayName}
                              </a>
                              <button
                                onClick={() => setEditingName({ id: member.id_usuario, value: displayName })}
                                className="opacity-0 group-hover/name:opacity-100 transition text-slate-400 hover:text-slate-600"
                                title={lang === 'en' ? 'Rename' : 'Renombrar'}
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            </div>
                          )}
                          <p className="text-[11px] text-slate-400 truncate">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm font-semibold text-violet-600">{member.elo_rating || 1000}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{member.promedio_score ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{member.total_intentos || 0}</td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      {isConfirmingRemove ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-rose-600 font-medium mr-1">
                            {lang === 'en' ? 'Remove?' : '¿Eliminar?'}
                          </span>
                          <button
                            onClick={() => removeMember(member.id_usuario)}
                            disabled={removingId === member.id_usuario}
                            className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                          >
                            {removingId === member.id_usuario ? '…' : (lang === 'en' ? 'Yes' : 'Sí')}
                          </button>
                          <button
                            onClick={() => setConfirmRemove(null)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 dark:bg-slate-800"
                          >
                            {lang === 'en' ? 'No' : 'No'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <a href={profileHref} className="text-xs font-medium text-violet-600 hover:text-violet-700">
                            {lang === 'en' ? 'View' : 'Ver'}
                          </a>
                          <span className="text-slate-200">|</span>
                          <button
                            onClick={() => setConfirmRemove(member.id_usuario)}
                            className="text-xs font-medium text-rose-500 hover:text-rose-700 transition"
                          >
                            {lang === 'en' ? 'Remove' : 'Eliminar'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderChallenges = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {lang === 'en' ? 'Custom Challenges' : 'Desafíos Personalizados'}
          {challenges.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">({challenges.length})</span>
          )}
        </h3>
        <button
          type="button"
          onClick={openChallengeModal}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition"
        >
          + {lang === 'en' ? 'Create Challenge' : 'Crear Desafío'}
        </button>
      </div>

      {loadingChallenges ? (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
        </div>
      ) : challenges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <p className="text-slate-600 font-medium">{lang === 'en' ? 'No custom challenges yet' : 'Aún no hay desafíos personalizados'}</p>
          <p className="text-sm text-slate-400 mt-1">
            {lang === 'en' ? 'Create challenges to assign to your team' : 'Creá desafíos para asignar a tu equipo'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((ch) => {
            const diffColors = {
              easy: 'text-emerald-700 bg-emerald-50 border-emerald-200',
              medium: 'text-amber-700 bg-amber-50 border-amber-200',
              hard: 'text-rose-700 bg-rose-50 border-rose-200',
            }
            const diff = (ch.image_diff || 'medium').toLowerCase()
            const diffClass = diffColors[diff] || diffColors.medium
            return (
              <div key={ch.id_imagen} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:border-violet-300 hover:shadow-md transition group">
                <div className="h-40 bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                  {ch.url_image
                    ? <img src={ch.url_image} alt="challenge" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="h-full w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                        <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                      </div>
                  }
                  {/* Settings gear icon - top right of image, slightly below */}
                  <button
                    onClick={() => openEditChallengeModal(ch)}
                    className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-slate-600 dark:text-slate-400 hover:bg-violet-100 hover:text-violet-600 dark:hover:bg-violet-900/70 dark:hover:text-violet-400 transition shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                    title={lang === 'en' ? 'Edit challenge' : 'Editar desafío'}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 relative">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${diffClass}`}>
                      {ch.image_diff || 'Medium'}
                    </span>
                    {ch.image_theme && (
                      <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5 truncate max-w-[120px]">
                        {ch.image_theme}
                      </span>
                    )}
                  </div>
                  {ch.prompt_original && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{ch.prompt_original}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {ch.fecha ? new Date(ch.fecha).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const renderSettings = () => (
    <div className="space-y-5">
      {/* Información Básica */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Columna Izquierda - Info de la empresa */}
        <div className="space-y-5">
          {/* Nombre + web + descripción */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            <div className="px-5 py-4">
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                {lang === 'en' ? 'Company name' : 'Nombre de la empresa'}
              </label>
              <input
                type="text"
                value={settingsForm.company_name}
                onChange={e => setSettingsForm(f => ({ ...f, company_name: e.target.value }))}
                className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400"
                placeholder={lang === 'en' ? 'Your company name' : 'Nombre de tu empresa'}
              />
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                {lang === 'en' ? 'Website' : 'Sitio web'}
              </label>
              <input
                type="url"
                value={settingsForm.website}
                onChange={e => setSettingsForm(f => ({ ...f, website: e.target.value }))}
                className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400"
                placeholder="https://empresa.com"
              />
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                {lang === 'en' ? 'Description' : 'Descripción'}
              </label>
              <textarea
                value={settingsForm.bio}
                onChange={e => setSettingsForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 outline-none resize-none placeholder:text-slate-400"
                placeholder={lang === 'en' ? 'What does your company do?' : '¿A qué se dedica tu empresa?'}
              />
            </div>
          </div>

          {/* Dificultades + Industria */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              {lang === 'en' ? 'Allowed difficulties' : 'Dificultades permitidas'}
            </p>
            <div className="flex gap-2 mb-4">
              {[
                { key: 'Easy',   label: lang === 'en' ? 'Easy' : 'Fácil',   on: 'bg-emerald-500 text-white border-emerald-500', off: 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400' },
                { key: 'Medium', label: lang === 'en' ? 'Medium' : 'Medio',  on: 'bg-amber-500 text-white border-amber-500',    off: 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400' },
                { key: 'Hard',   label: lang === 'en' ? 'Hard' : 'Difícil',  on: 'bg-rose-500 text-white border-rose-500',      off: 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400' },
              ].map(({ key, label, on, off }) => {
                const active = settingsForm.allowed_diffs.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSettingsForm(f => ({
                      ...f,
                      allowed_diffs: active ? f.allowed_diffs.filter(d => d !== key) : [...f.allowed_diffs, key],
                    }))}
                    className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition ${active ? on : off}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {lang === 'en' ? 'Industry Type' : 'Tipo de Industria'}
              </label>
              <select
                value={settingsForm.industry_type || 'marketing'}
                onChange={e => setSettingsForm(f => ({ ...f, industry_type: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="marketing">{lang === 'en' ? 'Marketing & Advertising' : 'Marketing y Publicidad'}</option>
                <option value="ecommerce">{lang === 'en' ? 'E-commerce & Retail' : 'E-commerce y Retail'}</option>
                <option value="education">{lang === 'en' ? 'Education & Training' : 'Educación y Capacitación'}</option>
                <option value="tech">{lang === 'en' ? 'Technology & Software' : 'Tecnología y Software'}</option>
                <option value="healthcare">{lang === 'en' ? 'Healthcare & Wellness' : 'Salud y Bienestar'}</option>
                <option value="realestate">{lang === 'en' ? 'Real Estate & Architecture' : 'Bienes Raíces y Arquitectura'}</option>
                <option value="food">{lang === 'en' ? 'Food & Beverage' : 'Alimentos y Bebidas'}</option>
                <option value="design">{lang === 'en' ? 'Design & Creative' : 'Diseño y Creatividad'}</option>
                <option value="other">{lang === 'en' ? 'Other' : 'Otro'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Columna Derecha - Configuraciones avanzadas */}
        <div className="space-y-5">
          {/* Torneos + Desafíos por defecto */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {lang === 'en' ? 'Tournaments' : 'Torneos'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {lang === 'en' ? 'Enable competitive tournaments' : 'Habilitar torneos competitivos'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsForm(f => ({ ...f, tournament_enabled: !f.tournament_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settingsForm.tournament_enabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settingsForm.tournament_enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === 'en' ? 'Default Challenge Type' : 'Tipo de Desafío por Defecto'}
                </label>
                <select
                  value={settingsForm.default_challenge_type || 'standard'}
                  onChange={e => setSettingsForm(f => ({ ...f, default_challenge_type: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="standard">{lang === 'en' ? 'Standard' : 'Estándar'}</option>
                  <option value="creativity">{lang === 'en' ? 'Creativity' : 'Creatividad'}</option>
                  <option value="speed_challenge">{lang === 'en' ? 'Speed' : 'Velocidad'}</option>
                  <option value="color_matching">{lang === 'en' ? 'Color Matching' : 'Colores'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === 'en' ? 'Difficulty Mode' : 'Modo de Dificultad'}
                </label>
                <select
                  value={settingsForm.default_challenge_mode || 'static'}
                  onChange={e => setSettingsForm(f => ({ ...f, default_challenge_mode: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="static">{lang === 'en' ? 'Static' : 'Estático'}</option>
                  <option value="adaptive">{lang === 'en' ? 'Adaptive' : 'Adaptativo'}</option>
                  <option value="progressive">{lang === 'en' ? 'Progressive' : 'Progresivo'}</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {settingsForm.default_challenge_mode === 'adaptive' && (lang === 'en' 
                    ? 'Adjusts to performance'
                    : 'Se ajusta al desempeño')}
                  {settingsForm.default_challenge_mode === 'progressive' && (lang === 'en'
                    ? 'Increases each round'
                    : 'Aumenta cada ronda')}
                  {settingsForm.default_challenge_mode === 'static' && (lang === 'en'
                    ? 'Fixed difficulty'
                    : 'Dificultad fija')}
                </p>
              </div>
            </div>
          </div>

          {/* Métricas y Training compactos */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              {lang === 'en' ? 'Tracking & Training' : 'Seguimiento y Capacitación'}
            </p>
            
            <div className="space-y-2">
              {[
                { key: 'trackTimePerAttempt', label: lang === 'en' ? 'Track time' : 'Rastrear tiempo', metric: true },
                { key: 'trackImprovementRate', label: lang === 'en' ? 'Track improvement' : 'Rastrear mejora', metric: true },
                { key: 'generateMonthlyReports', label: lang === 'en' ? 'Monthly reports' : 'Reportes mensuales', metric: true },
                { key: 'enableProgressTracking', label: lang === 'en' ? 'Progress tracking' : 'Seguimiento de progreso', metric: false },
                { key: 'enableLeaderboards', label: lang === 'en' ? 'Leaderboards' : 'Rankings', metric: false },
              ].map(({ key, label, metric }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={metric ? (settingsForm.performance_metrics?.[key] ?? true) : (settingsForm.training_config?.[key] ?? true)}
                    onChange={e => setSettingsForm(f => ({
                      ...f,
                      [metric ? 'performance_metrics' : 'training_config']: {
                        ...(metric ? f.performance_metrics : f.training_config),
                        [key]: e.target.checked
                      }
                    }))}
                    className="rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Guardar */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveSettings}
          disabled={savingSettings}
          className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition disabled:opacity-60 flex items-center gap-2"
        >
          {savingSettings && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {savingSettings ? (lang === 'en' ? 'Saving...' : 'Guardando...') : (lang === 'en' ? 'Save' : 'Guardar')}
        </button>
        {settingsStatus === 'ok' && <span className="text-sm text-emerald-600">✓ {lang === 'en' ? 'Saved' : 'Guardado'}</span>}
        {settingsStatus === 'error' && <span className="text-sm text-rose-600">{lang === 'en' ? 'Could not save' : 'No se pudo guardar'}</span>}
      </div>
    </div>
  )

  const renderRequests = () => {
    const inviteLink = `${window.location.origin}/?invite=${companyData?.id_usuario}`

    const copyInviteLink = async () => {
      try {
        await navigator.clipboard.writeText(inviteLink)
        setCopyLinkStatus('copied')
        setTimeout(() => setCopyLinkStatus(null), 2000)
      } catch {
        // fallback
        const el = document.createElement('textarea')
        el.value = inviteLink
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        setCopyLinkStatus('copied')
        setTimeout(() => setCopyLinkStatus(null), 2000)
      }
    }

    return (
    <div className="space-y-5">
      {/* Link de invitación */}
      <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200 mb-1">
              {lang === 'en' ? 'Invite link' : 'Link de invitación'}
            </p>
            <p className="text-xs text-violet-600 dark:text-violet-400">
              {lang === 'en'
                ? 'Anyone with this link who is logged in will join your company automatically.'
                : 'Cualquier persona logueada que abra este link se une a tu empresa automáticamente.'}
            </p>
          </div>
          <button
            onClick={copyInviteLink}
            className={`shrink-0 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              copyLinkStatus === 'copied'
                ? 'bg-emerald-600 text-white'
                : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            {copyLinkStatus === 'copied' ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {lang === 'en' ? 'Copied!' : '¡Copiado!'}
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {lang === 'en' ? 'Copy link' : 'Copiar link'}
              </>
            )}
          </button>
        </div>
        <div className="mt-3 rounded-lg bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-700 px-3 py-2">
          <p className="text-xs text-slate-500 font-mono truncate">{inviteLink}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {lang === 'en' ? 'Incoming Requests' : 'Solicitudes Entrantes'}
        </h3>
        {enterpriseLoadingRequests ? (
          <p className="text-slate-600">{lang === 'en' ? 'Loading requests...' : 'Cargando solicitudes...'}</p>
        ) : enterpriseRequests.filter(r => r.status === 'requested').length > 0 ? (
          <div className="space-y-3">
            {enterpriseRequests.filter(r => r.status === 'requested').map((request) => {
              const userInfo = request.usuarios
              const displayName = userInfo?.nombre_display || userInfo?.nombre || userInfo?.username || request.user_email
              const avatarUrl = userInfo?.avatar_url
              const profileHref = userInfo?.username
                ? `/user/${userInfo.username}`
                : request.user_id ? `/perfil?id=${request.user_id}` : null
              return (
                <div key={request.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-slate-500">{displayName?.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      {profileHref ? (
                        <a href={profileHref} className="font-semibold text-slate-900 text-sm hover:text-violet-600 truncate block">
                          {displayName}
                        </a>
                      ) : (
                        <p className="font-semibold text-slate-900 text-sm truncate">{displayName}</p>
                      )}
                      <p className="text-[11px] text-slate-400 truncate">{request.user_email}</p>
                    </div>
                  </div>
                  {request.message && (
                    <p className="text-xs text-slate-600 italic mb-2 bg-white rounded-lg px-2 py-1.5 border border-slate-200">
                      "{request.message}"
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mb-2">
                    {new Date(request.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateEnterpriseRequestStatus(request, 'accepted')}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      {lang === 'en' ? 'Accept' : 'Aceptar'}
                    </button>
                    <button
                      onClick={() => updateEnterpriseRequestStatus(request, 'rejected')}
                      className="rounded-full border border-slate-300 dark:border-slate-600 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      {lang === 'en' ? 'Reject' : 'Rechazar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-slate-600">{lang === 'en' ? 'No incoming requests yet.' : 'No hay solicitudes entrantes aún.'}</p>
        )}
        {enterpriseActionStatus && (
          <p className="mt-3 text-sm font-medium text-slate-700">{enterpriseActionStatus}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {lang === 'en' ? 'Pending Invitations' : 'Invitaciones Pendientes'}
        </h3>
        {enterpriseLoadingRequests ? (
          <p className="text-slate-600">{lang === 'en' ? 'Loading invitations...' : 'Cargando invitaciones...'}</p>
        ) : enterpriseRequests.filter(r => r.status === 'pending').length > 0 ? (
          <div className="space-y-3">
            {enterpriseRequests.filter(r => r.status === 'pending').map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{request.user_email}</p>
                {request.message && (
                  <p className="text-xs text-slate-500 mt-1 italic">"{request.message}"</p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wide text-amber-600 font-semibold">
                    ⏳ {lang === 'en' ? 'Awaiting response' : 'Esperando respuesta'}
                  </p>
                  <button
                    onClick={() => cancelEnterpriseInvite(request.id)}
                    disabled={cancellingId === request.id}
                    className="text-[11px] text-rose-500 hover:text-rose-700 font-medium transition disabled:opacity-50"
                  >
                    {cancellingId === request.id
                      ? (lang === 'en' ? 'Cancelling...' : 'Cancelando...')
                      : (lang === 'en' ? 'Cancel' : 'Cancelar')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600">{lang === 'en' ? 'No pending invitations.' : 'No hay invitaciones pendientes.'}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {lang === 'en' ? 'Invite a User' : 'Invitar a un Usuario'}
        </h3>
        <form onSubmit={sendEnterpriseInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'User email' : 'Email del usuario'}</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm"
              placeholder={lang === 'en' ? 'user@example.com' : 'usuario@ejemplo.com'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'Message' : 'Mensaje'}</label>
            <textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm resize-none"
              placeholder={lang === 'en' ? 'Optional note for the invite' : 'Nota opcional para la invitación'}
            />
          </div>
          <button type="submit" className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition">
            {lang === 'en' ? 'Send Invitation' : 'Enviar Invitación'}
          </button>
          {enterpriseActionStatus && <p className="text-sm text-slate-600 dark:text-slate-400">{enterpriseActionStatus}</p>}
        </form>
      </div>
    </div>
    </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 dark:border-slate-600 border-t-violet-600 mx-auto" />
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {lang === 'en' ? 'Enterprise Dashboard' : 'Panel de Empresa'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">{companyData?.company_name}</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-700 dark:border-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 font-medium transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-violet-600 text-violet-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {tab.icon === 'dashboard' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              {tab.icon === 'leaderboard' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
              {tab.icon === 'users' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              {tab.icon === 'settings' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              {tab.icon === 'challenges' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
              {tab.label}
              {tab.badge ? (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'leaderboard' && renderLeaderboard()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'requests' && renderRequests()}
          {activeTab === 'challenges' && renderChallenges()}
        </div>
      </main>

      <Footer />

      {challengeModalOpen && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={closeChallengeModal}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header fijo */}
            <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {lang === 'en' ? 'Create custom challenge' : 'Crear desafío personalizado'}
              </h3>
              <button
                type="button"
                onClick={closeChallengeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="overflow-y-auto px-5 py-4 flex-1">
              <form id="challenge-form" onSubmit={createChallenge} className="space-y-3.5">
                {/* Imagen */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Challenge image' : 'Imagen del desafío'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleChallengeImageChange}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                    required
                  />
                  {challengeImagePreview && (
                    <img src={challengeImagePreview} alt="preview" className="mt-2 h-32 w-full rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                  )}
                </div>

                {/* Prompt original */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Original prompt' : 'Prompt original'} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={challengeForm.prompt}
                    onChange={(e) => setChallengeForm(f => ({ ...f, prompt: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs resize-none dark:bg-slate-800 dark:text-slate-100"
                    placeholder={lang === 'en' ? 'Describe the expected image prompt...' : 'Describe el prompt esperado de la imagen...'}
                    required
                  />
                </div>

                {/* Descripción extendida */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Description (optional)' : 'Descripción (opcional)'}
                  </label>
                  <textarea
                    value={challengeForm.description}
                    onChange={(e) => setChallengeForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs resize-none dark:bg-slate-800 dark:text-slate-100"
                    placeholder={lang === 'en' ? 'Additional context or instructions...' : 'Contexto adicional o instrucciones...'}
                  />
                </div>

                {/* Dificultad y Temática */}
                <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Difficulty' : 'Dificultad'} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={challengeForm.difficulty}
                    onChange={(e) => setChallengeForm(f => ({ ...f, difficulty: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Theme' : 'Temática'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={challengeForm.theme}
                    onChange={(e) => setChallengeForm(f => ({ ...f, theme: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                    placeholder={lang === 'en' ? 'e.g. Cyberpunk city' : 'Ej: Ciudad cyberpunk'}
                    required
                  />
                </div>
              </div>

              {/* Tiempo límite, Intentos máximos, Palabras mínimas */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Time limit (sec)' : 'Tiempo límite (seg)'}
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="600"
                    value={challengeForm.timeLimit}
                    onChange={(e) => setChallengeForm(f => ({ ...f, timeLimit: parseInt(e.target.value) || 180 }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Max attempts' : 'Intentos máx'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={challengeForm.maxAttempts}
                    onChange={(e) => setChallengeForm(f => ({ ...f, maxAttempts: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                    placeholder="0 = ∞"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Min words' : 'Palabras mín'}
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={challengeForm.minWords}
                    onChange={(e) => setChallengeForm(f => ({ ...f, minWords: parseInt(e.target.value) || 10 }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Fechas de inicio y fin */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Start date (optional)' : 'Fecha inicio (opcional)'}
                  </label>
                  <input
                    type="datetime-local"
                    value={challengeForm.startDate}
                    onChange={(e) => setChallengeForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'End date (optional)' : 'Fecha fin (opcional)'}
                  </label>
                  <input
                    type="datetime-local"
                    value={challengeForm.endDate}
                    onChange={(e) => setChallengeForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Visibilidad, Puntos, Modo de evaluación */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Visibility' : 'Visibilidad'}
                  </label>
                  <select
                    value={challengeForm.visibility}
                    onChange={(e) => setChallengeForm(f => ({ ...f, visibility: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="private">{lang === 'en' ? 'Private (team only)' : 'Privado (solo equipo)'}</option>
                    <option value="public">{lang === 'en' ? 'Public' : 'Público'}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Points' : 'Puntos'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="10"
                    value={challengeForm.points}
                    onChange={(e) => setChallengeForm(f => ({ ...f, points: parseInt(e.target.value) || 100 }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? 'Evaluation' : 'Evaluación'}
                  </label>
                  <select
                    value={challengeForm.evaluationMode}
                    onChange={(e) => setChallengeForm(f => ({ ...f, evaluationMode: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="standard">{lang === 'en' ? 'Standard' : 'Estándar'}</option>
                    <option value="strict">{lang === 'en' ? 'Strict' : 'Estricto'}</option>
                    <option value="flexible">{lang === 'en' ? 'Flexible' : 'Flexible'}</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {lang === 'en' ? 'Tags (comma separated)' : 'Tags (separados por coma)'}
                </label>
                <input
                  type="text"
                  value={challengeForm.tags.join(', ')}
                  onChange={(e) => setChallengeForm(f => ({ ...f, tags: e.target.value.split(',').map(t => t.trim()) }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                  placeholder={lang === 'en' ? 'e.g. landscape, nature, sunset' : 'Ej: paisaje, naturaleza, atardecer'}
                />
              </div>

              {/* Hints/Pistas */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {lang === 'en' ? 'Hints (optional)' : 'Pistas (opcional)'}
                </label>
                <div className="space-y-2">
                  {challengeForm.hints.map((hint, i) => (
                    <input
                      key={i}
                      type="text"
                      value={hint}
                      onChange={(e) => {
                        const newHints = [...challengeForm.hints]
                        newHints[i] = e.target.value
                        setChallengeForm(f => ({ ...f, hints: newHints }))
                      }}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs dark:bg-slate-800 dark:text-slate-100"
                      placeholder={`${lang === 'en' ? 'Hint' : 'Pista'} ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              {challengeStatus && (
                <p className="text-xs text-slate-600 dark:text-slate-400">{challengeStatus}</p>
              )}
              </form>
            </div>

            {/* Footer fijo */}
            <div className="flex items-center justify-end gap-2 p-5 pt-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={closeChallengeModal}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {lang === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                type="submit"
                form="challenge-form"
                disabled={creatingChallenge}
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {creatingChallenge
                  ? (lang === 'en' ? 'Creating...' : 'Creando...')
                  : (lang === 'en' ? 'Create challenge' : 'Crear desafío')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnterprisePanel

