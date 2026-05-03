import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useLang } from '../contexts/LangContext'
import Header from './Header'
import Footer from './Footer'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { proxyImg } from '../utils/imgProxy'
import { nowAR } from '../utils/dateAR'
import { sanitizeText } from '../utils/inputSanitizer'
import { chatRateLimiter } from '../utils/rateLimiter'

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

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
  const [lbSort, setLbSort] = useState('elo')
  // Role assignment feedback
  const [roleError, setRoleError] = useState(null) // { userId, msg }

  // Filtros del dashboard - se cargan desde la BD
  const [dashboardFilters, setDashboardFilters] = useState({
    timeRange: '30', // 7, 30, 90, 'all'
    selectedMember: 'all', // 'all' o id_usuario
    difficulty: 'all', // 'all', 'Easy', 'Medium', 'Hard'
    metric: 'score', // 'score', 'elo', 'attempts', 'improvement'
    selectedChallenge: 'all', // 'all' o id_imagen específico
  })
  
  // Estado para filtros por desafío específico
  const [challengeStatsModal, setChallengeStatsModal] = useState(null) // { challengeId, challengeName }
  const [challengeStatsData, setChallengeStatsData] = useState([])
  const [loadingChallengeStats, setLoadingChallengeStats] = useState(false)
  
  // Estado para roles personalizados
  const [customRoles, setCustomRoles] = useState([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [newRoleForm, setNewRoleForm] = useState({
    name: '',
    description: '',
    color: '#6b7280'
  })

  // Chart visibility toggles
  const [showChartPicker, setShowChartPicker] = useState(false)
  const [visibleCharts, setVisibleCharts] = useState({
    scoreTrend: true,
    distribution: true,
    weeklyActivity: true,
    challengeParticipation: true,
    skillBreakdown: true,
    topPerformers: true,
    needsCoaching: true,
  })

  // Chatbot state
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)
  const chatEndRef = useRef(null)
  // Chatbot member autocomplete
  const [chatSuggestions, setChatSuggestions] = useState([])
  const [chatSuggestionMode, setChatSuggestionMode] = useState(null) // 'rename' | 'role' | 'remove'

  // Enterprise Guides state
  const [enterpriseGuides, setEnterpriseGuides] = useState([])
  const [loadingGuides, setLoadingGuides] = useState(false)
  const [guideModalOpen, setGuideModalOpen] = useState(false)
  const [editingGuide, setEditingGuide] = useState(null)
  const [guideForm, setGuideForm] = useState({
    title: '',
    summary: '',
    content: {
      lesson: {
        title: '',
        blocks: []
      },
      steps: [],
      checkpoints: [],
      quiz: null
    },
    accent: 'indigo',
    keywords: []
  })
  const [guideStatus, setGuideStatus] = useState(null)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [selectedGuideForAssignment, setSelectedGuideForAssignment] = useState(null)
  const [selectedMembersForAssignment, setSelectedMembersForAssignment] = useState([])
  const [assignmentDueDate, setAssignmentDueDate] = useState('')
  const [assignmentNotes, setAssignmentNotes] = useState('')

  const fetchChallenges = async () => {
    if (!companyData?.id_usuario) return
    setLoadingChallenges(true)
    try {
      const { data, error } = await supabase
        .from('imagenes_ia')
        .select('id_imagen, url_image, image_diff, image_theme, fecha, prompt_original, challenge_description, challenge_time_limit, challenge_max_attempts, challenge_min_words, challenge_start_date, challenge_end_date, challenge_visibility, challenge_points, challenge_tags, challenge_hints, challenge_evaluation_mode')
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
          .select('company_name, user_type, id_usuario, bio, social_website, settings_allowed_diffs, industry_type, tournament_enabled, default_challenge_type, default_challenge_mode, performance_metrics, training_config, dashboard_filters')
          .eq('id_usuario', user.id)
          .maybeSingle()

        if (error) throw error
        setCompanyData(company)
        
        // Cargar filtros guardados del dashboard
        if (company?.dashboard_filters) {
          setDashboardFilters(prev => ({ ...prev, ...company.dashboard_filters }))
        }
        
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
            .select('id_usuario, nombre, nombre_display, company_display_name, username, avatar_url, email, elo_rating, total_intentos, promedio_score, porcentaje_aprobacion, racha_actual, company_role, company_joined_at, created_at')
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
            .select('id_imagen, url_image, image_diff, image_theme, fecha, prompt_original, challenge_description, challenge_time_limit, challenge_max_attempts, challenge_min_words, challenge_start_date, challenge_end_date, challenge_visibility, challenge_points, challenge_tags, challenge_hints, challenge_evaluation_mode')
            .eq('company_id', company.id_usuario)
            .order('fecha', { ascending: false })
          setChallenges(chs || [])

          // Fetch custom roles
          const { data: roles } = await supabase
            .from('custom_roles')
            .select('*')
            .eq('company_id', company.id_usuario)
            .order('role_name')
          setCustomRoles(roles || [])

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

  // Guardar filtros del dashboard en la BD cuando cambien
  const saveDashboardFilters = async (newFilters) => {
    if (!user?.id) return
    try {
      await supabase
        .from('usuarios')
        .update({ dashboard_filters: newFilters })
        .eq('id_usuario', user.id)
    } catch (error) {
      console.error('Error saving dashboard filters:', error)
    }
  }

  // Actualizar filtros y guardarlos
  const updateDashboardFilters = (updates) => {
    const newFilters = { ...dashboardFilters, ...updates }
    setDashboardFilters(newFilters)
    saveDashboardFilters(newFilters)
  }

  // Obtener estadísticas detalladas de un desafío específico
  const fetchChallengeStats = async (challengeId, challengeName) => {
    if (!companyData?.id_usuario) return
    setLoadingChallengeStats(true)
    setChallengeStatsModal({ challengeId, challengeName })
    
    try {
      const { data, error } = await supabase
        .from('challenge_attempts_detailed')
        .select('*')
        .eq('id_imagen', challengeId)
        .eq('company_id', companyData.id_usuario)
        .order('fecha_hora', { ascending: false })
      
      if (error) throw error
      setChallengeStatsData(data || [])
    } catch (error) {
      console.error('Error fetching challenge stats:', error)
      setChallengeStatsData([])
    } finally {
      setLoadingChallengeStats(false)
    }
  }

  // Función para enviar mensaje de revisión al chatbot
  const sendReviewMessage = (memberName, context) => {
    const message = lang === 'en' 
      ? `Please provide more information about ${memberName}'s performance. ${context}`
      : `Por favor proporciona más información sobre el rendimiento de ${memberName}. ${context}`
    
    setChatInput(message)
    // Auto-enviar el mensaje
    setTimeout(() => {
      sendChatMessage()
    }, 100)
  }

  // Obtener roles personalizados de la empresa
  const fetchCustomRoles = async () => {
    if (!companyData?.id_usuario) return
    setLoadingRoles(true)
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .eq('company_id', companyData.id_usuario)
        .order('role_name')
      
      if (error) throw error
      setCustomRoles(data || [])
    } catch (error) {
      console.error('Error fetching custom roles:', error)
      setCustomRoles([])
    } finally {
      setLoadingRoles(false)
    }
  }

  // Crear rol personalizado
  const createCustomRole = async () => {
    if (!newRoleForm.name.trim()) return
    
    try {
      const { error } = await supabase.rpc('create_custom_role', {
        role_name: newRoleForm.name.trim(),
        role_description: newRoleForm.description.trim() || null,
        role_color: newRoleForm.color
      })
      
      if (error) throw error
      
      // Refrescar lista de roles
      await fetchCustomRoles()
      
      // Resetear formulario
      setNewRoleForm({ name: '', description: '', color: '#6b7280' })
      setRoleModalOpen(false)
    } catch (error) {
      console.error('Error creating role:', error)
      alert(error.message || (lang === 'en' ? 'Could not create role' : 'No se pudo crear el rol'))
    }
  }

  // Eliminar rol personalizado
  const deleteCustomRole = async (roleName) => {
    if (!confirm(lang === 'en' 
      ? `Delete role "${roleName}"? This will remove it from all members.`
      : `¿Eliminar rol "${roleName}"? Esto lo quitará de todos los miembros.`
    )) return
    
    try {
      const { error } = await supabase.rpc('delete_custom_role', {
        role_name: roleName
      })
      
      if (error) throw error
      
      // Refrescar lista de roles y miembros
      await Promise.all([fetchCustomRoles(), fetchCompanyData()])
    } catch (error) {
      console.error('Error deleting role:', error)
      alert(error.message || (lang === 'en' ? 'Could not delete role' : 'No se pudo eliminar el rol'))
    }
  }

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
        .select('id_usuario, nombre, nombre_display, company_display_name, username, avatar_url, email, elo_rating, total_intentos, promedio_score, porcentaje_aprobacion, racha_actual, company_role, company_joined_at, created_at')
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
    // Optimistic update
    setTeamUsers(prev => prev.map(u => u.id_usuario === userId ? { ...u, company_role: role || null } : u))
    setRoleError(null)
    try {
      const { error } = await supabase.rpc('assign_company_role', {
        target_user_id: userId,
        role: role || '',
      })
      if (error) throw error
    } catch (err) {
      // Revert optimistic update on failure
      setTeamUsers(prev => prev.map(u => u.id_usuario === userId ? { ...u, company_role: u.company_role } : u))
      setRoleError({ userId, msg: err?.message || (lang === 'en' ? 'Could not assign role.' : 'No se pudo asignar el rol.') })
      setTimeout(() => setRoleError(null), 3000)
    }
  }

  const removeMember = async (userId) => {
    setRemovingId(userId)
    try {
      const { error } = await supabase.rpc('remove_team_member', { target_user_id: userId })
      if (error) throw error
      setTeamUsers(prev => prev.filter(u => u.id_usuario !== userId))
      setConfirmRemove(null)
    } catch (err) {
      setRoleError({ userId, msg: err?.message || (lang === 'en' ? 'Could not remove member.' : 'No se pudo eliminar el miembro.') })
      setTimeout(() => setRoleError(null), 3000)
    } finally {
      setRemovingId(null)
    }
  }

  const saveMemberName = async () => {
    if (!editingName || !editingName.value.trim()) return
    setSavingName(true)
    try {
      const newName = editingName.value.trim()
      // Use RPC to set company_display_name — does NOT touch the user's real nombre/nombre_display
      const { error } = await supabase.rpc('set_company_display_name', {
        target_user_id: editingName.id,
        display_name: newName,
      })
      if (error) throw error
      setTeamUsers(prev => prev.map(u =>
        u.id_usuario === editingName.id ? { ...u, company_display_name: newName } : u
      ))
      setEditingName(null)
    } catch (err) {
      setRoleError({ userId: editingName.id, msg: err?.message || (lang === 'en' ? 'Could not rename.' : 'No se pudo renombrar.') })
      setTimeout(() => setRoleError(null), 3000)
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

  // ── Enterprise Guides Functions ──────────────────────────────────────────

  const fetchEnterpriseGuides = async () => {
    if (!companyData?.id_usuario) return
    setLoadingGuides(true)
    try {
      const { data, error } = await supabase
        .from('enterprise_guides')
        .select('*')
        .eq('company_id', companyData.id_usuario)
        .order('created_at', { ascending: false })
      if (error) throw error
      setEnterpriseGuides(data || [])
    } catch (error) {
      console.error('Error fetching guides:', error)
      setEnterpriseGuides([])
    } finally {
      setLoadingGuides(false)
    }
  }

  const resetGuideForm = () => {
    setGuideForm({
      title: '',
      summary: '',
      content: {
        lesson: {
          title: '',
          blocks: []
        },
        steps: [],
        checkpoints: [],
        quiz: null
      },
      accent: 'indigo',
      keywords: []
    })
    setGuideStatus(null)
  }

  const openGuideModal = () => {
    resetGuideForm()
    setEditingGuide(null)
    setGuideModalOpen(true)
  }

  const openEditGuideModal = (guide) => {
    setGuideForm({
      title: guide.title || '',
      summary: guide.summary || '',
      content: guide.content || {
        lesson: { title: '', blocks: [] },
        steps: [],
        checkpoints: [],
        quiz: null
      },
      accent: guide.accent || 'indigo',
      keywords: guide.keywords || []
    })
    setEditingGuide(guide)
    setGuideModalOpen(true)
  }

  const closeGuideModal = () => {
    setGuideModalOpen(false)
    resetGuideForm()
    setEditingGuide(null)
  }

  const createGuide = async (event) => {
    event.preventDefault()
    
    if (!guideForm.title.trim()) {
      setGuideStatus(lang === 'en' ? 'Title is required.' : 'El título es requerido.')
      return
    }

    try {
      setGuideStatus(lang === 'en' ? 'Creating guide...' : 'Creando guía...')
      
      const { data, error } = await supabase.rpc('create_enterprise_guide', {
        title: guideForm.title.trim(),
        summary: guideForm.summary.trim() || null,
        content: guideForm.content,
        accent: guideForm.accent,
        keywords: guideForm.keywords.filter(k => k.trim())
      })

      if (error) throw error

      setGuideStatus(lang === 'en' ? 'Guide created successfully.' : 'Guía creada correctamente.')
      fetchEnterpriseGuides()
      setTimeout(() => closeGuideModal(), 1000)
    } catch (error) {
      console.error('Error creating guide:', error)
      setGuideStatus(error.message || (lang === 'en' ? 'Could not create guide.' : 'No se pudo crear la guía.'))
    }
  }

  const updateGuide = async (event) => {
    event.preventDefault()
    
    if (!guideForm.title.trim()) {
      setGuideStatus(lang === 'en' ? 'Title is required.' : 'El título es requerido.')
      return
    }

    try {
      setGuideStatus(lang === 'en' ? 'Updating guide...' : 'Actualizando guía...')
      
      const { error } = await supabase
        .from('enterprise_guides')
        .update({
          title: guideForm.title.trim(),
          summary: guideForm.summary.trim() || null,
          content: guideForm.content,
          accent: guideForm.accent,
          keywords: guideForm.keywords.filter(k => k.trim()),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingGuide.id)

      if (error) throw error

      setGuideStatus(lang === 'en' ? 'Guide updated successfully.' : 'Guía actualizada correctamente.')
      fetchEnterpriseGuides()
      setTimeout(() => closeGuideModal(), 1000)
    } catch (error) {
      console.error('Error updating guide:', error)
      setGuideStatus(error.message || (lang === 'en' ? 'Could not update guide.' : 'No se pudo actualizar la guía.'))
    }
  }

  const deleteGuide = async (guideId) => {
    if (!confirm(lang === 'en' ? 'Delete this guide? This action cannot be undone.' : '¿Eliminar esta guía? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('enterprise_guides')
        .delete()
        .eq('id', guideId)

      if (error) throw error

      fetchEnterpriseGuides()
    } catch (error) {
      console.error('Error deleting guide:', error)
      alert(error.message || (lang === 'en' ? 'Could not delete guide.' : 'No se pudo eliminar la guía.'))
    }
  }

  const openAssignmentModal = (guide) => {
    setSelectedGuideForAssignment(guide)
    setSelectedMembersForAssignment([])
    setAssignmentDueDate('')
    setAssignmentNotes('')
    setAssignmentModalOpen(true)
  }

  const closeAssignmentModal = () => {
    setAssignmentModalOpen(false)
    setSelectedGuideForAssignment(null)
    setSelectedMembersForAssignment([])
    setAssignmentDueDate('')
    setAssignmentNotes('')
  }

  const assignGuideToMembers = async () => {
    if (!selectedGuideForAssignment || selectedMembersForAssignment.length === 0) {
      alert(lang === 'en' ? 'Please select at least one team member.' : 'Por favor selecciona al menos un miembro del equipo.')
      return
    }

    try {
      const { data, error } = await supabase.rpc('assign_guide_to_members', {
        guide_id: selectedGuideForAssignment.id,
        member_ids: selectedMembersForAssignment,
        due_date: assignmentDueDate || null,
        notes: assignmentNotes.trim() || null
      })

      if (error) throw error

      alert(lang === 'en' 
        ? `Guide assigned to ${data} member${data !== 1 ? 's' : ''}.`
        : `Guía asignada a ${data} miembro${data !== 1 ? 's' : ''}.`
      )
      closeAssignmentModal()
    } catch (error) {
      console.error('Error assigning guide:', error)
      alert(error.message || (lang === 'en' ? 'Could not assign guide.' : 'No se pudo asignar la guía.'))
    }
  }

  // Fetch guides when company data is available
  useEffect(() => {
    if (companyData?.id_usuario) {
      fetchEnterpriseGuides()
    }
  }, [companyData?.id_usuario])

  // Build team context string for the chatbot system prompt
  const buildTeamContext = () => {
    const companyName = companyData?.company_name || 'the company'
    const memberCount = teamUsers.length
    const activeCount = teamUsers.filter(u => (u.total_intentos || 0) > 0).length
    const avgScore = memberCount > 0
      ? Math.round(teamUsers.reduce((s, u) => s + (u.promedio_score || 0), 0) / memberCount)
      : 0
    const avgElo = memberCount > 0
      ? Math.round(teamUsers.reduce((s, u) => s + (u.elo_rating || 1000), 0) / memberCount)
      : 1000
    const totalAttempts = teamUsers.reduce((s, u) => s + (u.total_intentos || 0), 0)
    const topPerformer = [...teamUsers].sort((a, b) => (b.elo_rating || 1000) - (a.elo_rating || 1000))[0]
    const lowestPerformer = [...teamUsers].filter(u => (u.total_intentos || 0) > 0).sort((a, b) => (a.promedio_score || 0) - (b.promedio_score || 0))[0]
    const inactiveMembers = teamUsers.filter(u => (u.total_intentos || 0) === 0)
    const challengeCount = challenges.length

    const memberSummaries = teamUsers.slice(0, 20).map(u =>
      `- "${u.company_display_name || u.nombre_display || u.nombre || u.email}" → id:${u.id_usuario} | ELO:${u.elo_rating || 1000} | score:${u.promedio_score ?? 'N/A'}% | attempts:${u.total_intentos || 0} | streak:${u.racha_actual || 0}d | role:${u.company_role || 'none'}`
    ).join('\n')

    return `You are a focused team analytics assistant for ${companyName} on a prompt engineering training platform. You provide data-driven insights and execute management actions ONLY.

LANGUAGE RULE: Always respond in the exact same language the user writes in. No exceptions.

STRICT SCOPE: You ONLY handle:
1. Team performance questions (scores, ELO, attempts, streaks)
2. Member management actions (rename, assign roles, remove)
3. Challenge and participation analytics
4. Direct greetings and thanks (keep brief)

FORBIDDEN TOPICS: Refuse anything outside team management:
- General knowledge, recipes, jokes, trivia, weather, news
- Programming help, technical tutorials
- Personal advice, life coaching
- Any topic not directly related to THIS team's performance data

CRITICAL ACTION RULES:
- When asked to rename, assign role, or remove a member, find them in the MEMBERS list below
- Use the exact id from the list in your action JSON
- If you find the member, execute the action immediately
- If name is ambiguous, ask which specific member
- Always emit action block AND confirmation text

AVAILABLE ACTIONS:
- Rename: <action>{"action":"rename","userId":"<exact id>","newName":"<new name>"}</action>
- Assign role: <action>{"action":"assign_role","userId":"<exact id>","role":"<role name>"}</action>
- Remove: <action>{"action":"remove_member","userId":"<exact id>"}</action>
- Filter by challenge: <action>{"action":"filter_challenge","challengeId":"<challenge id>"}</action>
- Show challenge stats: <action>{"action":"show_challenge_stats","challengeId":"<challenge id>"}</action>

AVAILABLE ROLES:
${customRoles.map(r => `- ${r.role_name}: ${r.role_description || 'Custom role'}`).join('\n')}
${customRoles.length === 0 ? '- No custom roles defined yet' : ''}

NOTE: You can assign ANY role name. If the role doesn't exist, it will be created automatically.

TEAM DATA:
- Company: ${companyName}
- Members: ${memberCount} total (${activeCount} active, ${inactiveMembers.length} inactive)
- Avg ELO: ${avgElo} | Avg score: ${avgScore}% | Total attempts: ${totalAttempts}
- Challenges: ${challengeCount}
${topPerformer ? `- Top performer: ${topPerformer.company_display_name || topPerformer.nombre_display || topPerformer.nombre || topPerformer.email} (ELO ${topPerformer.elo_rating || 1000})` : ''}
${lowestPerformer ? `- Needs attention: ${lowestPerformer.company_display_name || lowestPerformer.nombre_display || lowestPerformer.nombre || lowestPerformer.email} (${lowestPerformer.promedio_score ?? 'N/A'}%)` : ''}
${inactiveMembers.length > 0 ? `- Inactive members: ${inactiveMembers.map(u => u.company_display_name || u.nombre_display || u.nombre || u.email).join(', ')}` : ''}

MEMBERS (name -> id | stats):
${memberSummaries}

CHALLENGE PERFORMANCE:
${challenges.slice(0, 5).map(ch => {
  const attempts = (challengeAttempts[ch.id_imagen] || []).filter(a => teamUsers.some(u => u.id_usuario === a.id_usuario))
  const uniqueUsers = new Set(attempts.map(a => a.id_usuario)).size
  const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + (a.puntaje_similitud || 0), 0) / attempts.length) : 0
  return `- "${ch.image_theme || 'Challenge'}" (${ch.image_diff}) [ID: ${ch.id_imagen}]: ${uniqueUsers}/${memberCount} participated, ${avgScore}% avg, ${attempts.length} total attempts`
}).join('\n')}

CURRENT FILTERS:
- Time Range: ${dashboardFilters.timeRange} days
- Selected Member: ${dashboardFilters.selectedMember === 'all' ? 'All members' : teamUsers.find(u => u.id_usuario === dashboardFilters.selectedMember)?.company_display_name || dashboardFilters.selectedMember}
- Selected Challenge: ${dashboardFilters.selectedChallenge === 'all' ? 'All challenges' : challenges.find(ch => ch.id_imagen === dashboardFilters.selectedChallenge)?.image_theme || dashboardFilters.selectedChallenge}

FILTERED DATA SUMMARY:
- Filtered Users: ${filteredUsers.length}
- Filtered Attempts: ${memberFilteredAttempts.length}
- Challenge-specific attempts: ${dashboardFilters.selectedChallenge !== 'all' ? (challengeAttempts[dashboardFilters.selectedChallenge] || []).length : 'N/A'}

RESPONSE RULES:
- Be direct and factual
- No emojis or decorative symbols
- Focus on actionable insights
- If asked about forbidden topics, say: "I focus on team analytics only. Ask me about member performance, scores, or management actions."
- Keep responses concise and data-focused`
  }

  const sendChatMessage = async () => {
    const raw = chatInput.trim()
    if (!raw || chatLoading) return

    // Rate limiting check
    const rateLimitResult = chatRateLimiter.canMakeRequest(user?.id || 'anonymous')
    if (!rateLimitResult.allowed) {
      setChatError(rateLimitResult.message)
      return
    }

    // Sanitize input
    const { valid, sanitized, error: sanitizeError } = sanitizeText(raw, 800)
    if (!valid) {
      setChatError(sanitizeError || (lang === 'en' ? 'Invalid input.' : 'Entrada inválida.'))
      return
    }

    // Client-side off-topic guard — block anything not related to team management
    const lower = sanitized.toLowerCase()
    const injectionPatterns = [
      /ignore (previous|all|your) (instructions?|rules?|prompt)/i,
      /you are now|act as (a |an )?(different|new|other)|pretend (you are|to be)/i,
      /jailbreak|dan mode|developer mode|unrestricted mode/i,
      /forget (your|all) (instructions?|rules?|context)/i,
    ]
    
    // Más estricto con off-topic - solo permitir team management
    const teamKeywords = ['team', 'equipo', 'member', 'miembro', 'score', 'elo', 'performance', 'rendimiento', 'challenge', 'desafio', 'role', 'rol', 'assign', 'asignar', 'rename', 'renombrar', 'remove', 'eliminar', 'stats', 'estadisticas']
    const hasTeamKeyword = teamKeywords.some(keyword => lower.includes(keyword))
    const isGreeting = /^(hi|hello|hola|gracias|thanks|thank you)$/i.test(sanitized.trim())
    
    const offTopicPatterns = [
      /\b(receta|recipe|cocinar|cooking|comida|food)\b/i,
      /\b(chiste|joke|cuéntame|tell me a)\b/i,
      /\b(capital|país|country|ciudad|city)\b/i,
      /\b(tiempo|weather|clima|temperature)\b/i,
      /\b(noticias|news|política|politics)\b/i,
      /\b(programación|programming|código|code|javascript|python)\b/i,
      /\b(matemáticas|math|calculate|calcular)\b/i,
    ]
    
    const isInjection = injectionPatterns.some(p => p.test(lower))
    const isOffTopic = !isInjection && !hasTeamKeyword && !isGreeting && (
      offTopicPatterns.some(p => p.test(lower)) || 
      sanitized.length > 50 // Mensajes largos sin keywords del equipo
    )

    if (isInjection || isOffTopic) {
      const refusal = isInjection
        ? (lang === 'en' ? 'That\'s not something I can do.' : 'Eso no es algo que pueda hacer.')
        : (lang === 'en' ? 'I focus on team analytics only. Ask me about member performance, scores, or management actions.' : 'Me enfoco solo en análisis del equipo. Preguntame sobre rendimiento de miembros, scores o acciones de gestión.')
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: sanitized },
        { role: 'assistant', content: refusal },
      ])
      setChatInput('')
      return
    }

    const userMsg = { role: 'user', content: sanitized }
    const updatedMessages = [...chatMessages, userMsg]
    setChatMessages(updatedMessages)
    setChatInput('')
    setChatError(null)
    setChatLoading(true)

    try {
      const systemPrompt = buildTeamContext()
      const payload = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...updatedMessages.slice(-10), // keep last 10 turns for context window
        ],
        temperature: 0.5,
        max_tokens: 500,
      }

      const res = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 429) {
          throw new Error(lang === 'en' ? 'Too many requests. Please wait a moment.' : 'Demasiadas solicitudes. Espera un momento.')
        }
        throw new Error(errorData.error?.message || 'Groq API error')
      }

      const data = await res.json()
      const assistantContent = data.choices?.[0]?.message?.content || ''

      // Parse and execute any action blocks returned by the AI
      const actionMatch = assistantContent.match(/<action>([\s\S]*?)<\/action>/)
      if (actionMatch) {
        try {
          const actionData = JSON.parse(actionMatch[1].trim())
          const cleanContent = assistantContent.replace(/<action>[\s\S]*?<\/action>/, '').trim()
          setChatMessages(prev => [...prev, { role: 'assistant', content: cleanContent }])

          if (actionData.action === 'rename' && actionData.userId && actionData.newName) {
            // Security: verify user belongs to this team
            const isMember = teamUsers.some(u => u.id_usuario === actionData.userId)
            if (isMember) {
              const { sanitized: safeName } = sanitizeText(actionData.newName, 50)
              if (safeName) {
                // Use RPC — only sets company_display_name, never touches real nombre
                await supabase.rpc('set_company_display_name', {
                  target_user_id: actionData.userId,
                  display_name: safeName,
                })
                setTeamUsers(prev => prev.map(u =>
                  u.id_usuario === actionData.userId ? { ...u, company_display_name: safeName } : u
                ))
              }
            }
          } else if (actionData.action === 'assign_role' && actionData.userId) {
            // Security: verify user belongs to this team
            const isMember = teamUsers.some(u => u.id_usuario === actionData.userId)
            if (isMember) {
              const validRoles = ['manager', 'analyst', 'trainee', 'observer', '']
              const role = validRoles.includes(actionData.role) ? actionData.role : null
              await supabase.rpc('assign_company_role', {
                target_user_id: actionData.userId,
                role: role || '',
              })
              setTeamUsers(prev => prev.map(u =>
                u.id_usuario === actionData.userId ? { ...u, company_role: role || null } : u
              ))
            }
          } else if (actionData.action === 'remove_member' && actionData.userId) {
            // Security: verify user belongs to this team
            const isMember = teamUsers.some(u => u.id_usuario === actionData.userId)
            if (isMember) {
              await supabase.rpc('remove_team_member', { target_user_id: actionData.userId })
              setTeamUsers(prev => prev.filter(u => u.id_usuario !== actionData.userId))
            }
          } else if (actionData.action === 'filter_challenge' && actionData.challengeId) {
            // Filter dashboard by specific challenge
            const challengeExists = challenges.some(ch => ch.id_imagen === actionData.challengeId)
            if (challengeExists) {
              updateDashboardFilters({ selectedChallenge: actionData.challengeId })
              setActiveTab('dashboard')
            }
          } else if (actionData.action === 'show_challenge_stats' && actionData.challengeId) {
            // Show detailed challenge statistics
            const challenge = challenges.find(ch => ch.id_imagen === actionData.challengeId)
            if (challenge) {
              fetchChallengeStats(actionData.challengeId, challenge.image_theme || 'Challenge')
            }
          }
        } catch {
          // action parse/execute failed — still show the message
          setChatMessages(prev => [...prev, { role: 'assistant', content: assistantContent.replace(/<action>[\s\S]*?<\/action>/, '').trim() }])
        }
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: assistantContent }])
      }
    } catch (err) {
      const errorMsg = err.message.includes('Too many requests') 
        ? err.message
        : (lang === 'en' ? 'Could not reach AI. Try again.' : 'No se pudo conectar con la IA. Intentá de nuevo.')
      setChatError(errorMsg)
    } finally {
      setChatLoading(false)
    }
  }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  const tabs = [
    { id: 'dashboard', label: lang === 'en' ? 'Dashboard' : 'Dashboard', icon: 'dashboard' },
    { id: 'leaderboard', label: lang === 'en' ? 'Leaderboard' : 'Ranking', icon: 'leaderboard' },
    { id: 'users', label: lang === 'en' ? 'Team' : 'Equipo', icon: 'users' },
    { id: 'guides', label: lang === 'en' ? 'Guides' : 'Guías', icon: 'guides' },
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
    // ── Filters ──
    const filteredUsers = dashboardFilters.selectedMember === 'all'
      ? teamUsers
      : teamUsers.filter(u => u.id_usuario === dashboardFilters.selectedMember)

    // Filtrar intentos por desafío específico si está seleccionado
    const filteredAttempts = dashboardFilters.selectedChallenge === 'all'
      ? Object.values(challengeAttempts).flat()
      : (challengeAttempts[dashboardFilters.selectedChallenge] || [])

    // Filtrar intentos por miembros seleccionados
    const memberFilteredAttempts = filteredAttempts.filter(a =>
      filteredUsers.some(u => u.id_usuario === a.id_usuario)
    )

    // ── KPI calculations ──
    const memberCount = filteredUsers.length
    const activeMembers = filteredUsers.filter(u => (u.total_intentos || 0) > 0).length
    const inactiveMembers = memberCount - activeMembers
    const avgScore = memberCount > 0
      ? Math.round(filteredUsers.reduce((s, u) => s + (u.promedio_score || 0), 0) / memberCount)
      : 0
    const avgElo = memberCount > 0
      ? Math.round(filteredUsers.reduce((s, u) => s + (u.elo_rating || 1000), 0) / memberCount)
      : 1000
    const totalAttempts = filteredUsers.reduce((s, u) => s + (u.total_intentos || 0), 0)
    const participationRate = memberCount > 0 ? Math.round((activeMembers / memberCount) * 100) : 0

    // Recruiter-specific stats
    const topElo = filteredUsers.length > 0 ? Math.max(...filteredUsers.map(u => u.elo_rating || 1000)) : 0
    const bestStreak = filteredUsers.length > 0 ? Math.max(...filteredUsers.map(u => u.racha_actual || 0)) : 0
    const consistentMembers = filteredUsers.filter(u => (u.porcentaje_aprobacion || 0) >= 70).length
    const highPerformers = filteredUsers.filter(u => (u.promedio_score || 0) >= 70).length
    const avgApproval = memberCount > 0
      ? Math.round(filteredUsers.reduce((s, u) => s + (u.porcentaje_aprobacion || 0), 0) / memberCount)
      : 0

    // Score distribution
    const scoreDist = [
      { name: lang === 'en' ? 'High ≥70%' : 'Alto ≥70%', value: filteredUsers.filter(u => (u.promedio_score || 0) >= 70).length, color: '#10b981' },
      { name: lang === 'en' ? 'Mid 50–69%' : 'Medio 50–69%', value: filteredUsers.filter(u => (u.promedio_score || 0) >= 50 && (u.promedio_score || 0) < 70).length, color: '#f59e0b' },
      { name: lang === 'en' ? 'Low <50%' : 'Bajo <50%', value: filteredUsers.filter(u => (u.promedio_score || 0) > 0 && (u.promedio_score || 0) < 50).length, color: '#ef4444' },
      { name: lang === 'en' ? 'No data' : 'Sin datos', value: filteredUsers.filter(u => !u.promedio_score).length, color: '#cbd5e1' },
    ].filter(d => d.value > 0)

    // Challenge participation
    const challengeParticipation = challenges.slice(0, 6).map(ch => {
      const attempts = (challengeAttempts[ch.id_imagen] || []).filter(a =>
        filteredUsers.some(u => u.id_usuario === a.id_usuario)
      )
      const uniqueUsers = new Set(attempts.map(a => a.id_usuario)).size
      const avgCh = attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + (a.puntaje_similitud || 0), 0) / attempts.length)
        : 0
      return {
        name: ch.image_theme || `#${ch.id_imagen.slice(0, 4)}`,
        participants: uniqueUsers,
        avgScore: avgCh,
      }
    })

    // Weekly activity (last 7 days from teamProgressData)
    const weeklyData = teamProgressData.slice(-7).map(d => ({
      label: d.label,
      intentos: d.count,
      score: d.avg,
    }))

    // Top 5 by ELO (filtered)
    const top5 = [...filteredUsers]
      .sort((a, b) => (b.elo_rating || 1000) - (a.elo_rating || 1000))
      .slice(0, 5)

    // Needs coaching (filtered)
    const needsAttention = [...filteredUsers]
      .filter(u => (u.total_intentos || 0) > 0 && (u.promedio_score || 0) < 55)
      .sort((a, b) => (a.promedio_score || 0) - (b.promedio_score || 0))
      .slice(0, 4)

    // ── Skill breakdown from filtered attempts ──
    const allAttempts = memberFilteredAttempts
    const criteriaKeys = ['visualElements', 'styleAtmosphere', 'technicalDetails', 'clarity']
    const criteriaLabels = {
      visualElements:   lang === 'en' ? 'Visual'    : 'Visual',
      styleAtmosphere:  lang === 'en' ? 'Style'     : 'Estilo',
      technicalDetails: lang === 'en' ? 'Technical' : 'Técnico',
      clarity:          lang === 'en' ? 'Clarity'   : 'Claridad',
    }
    const criteriaAvgs = criteriaKeys.map(key => {
      const vals = allAttempts
        .map(a => a[key] ?? a.criteria?.[key] ?? null)
        .filter(v => v !== null && !isNaN(v))
      const avg = vals.length > 0 ? Math.round(vals.reduce((s, v) => s + Number(v), 0) / vals.length) : null
      return { key, label: criteriaLabels[key], avg }
    })
    const hasCriteriaData = criteriaAvgs.some(c => c.avg !== null)

    const skillData = hasCriteriaData
      ? criteriaAvgs.map(c => ({ ...c, avg: c.avg ?? 0 }))
      : (() => {
          const scores = allAttempts.map(a => a.puntaje_similitud || 0).filter(s => s > 0)
          if (scores.length === 0) return []
          const base = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
          return [
            { key: 'visualElements',   label: criteriaLabels.visualElements,   avg: Math.min(100, base + 3) },
            { key: 'styleAtmosphere',  label: criteriaLabels.styleAtmosphere,  avg: Math.min(100, base - 2) },
            { key: 'technicalDetails', label: criteriaLabels.technicalDetails, avg: Math.min(100, base - 5) },
            { key: 'clarity',          label: criteriaLabels.clarity,          avg: Math.min(100, base + 1) },
          ]
        })()

    const radarData = skillData.map(s => ({ subject: s.label, value: s.avg, fullMark: 100 }))

    // ── Rich insights from attempt data ──
    const insights = []

    // 1. Skill-based insights
    if (skillData.length > 0) {
      const sorted = [...skillData].sort((a, b) => b.avg - a.avg)
      const best = sorted[0]
      const worst = sorted[sorted.length - 1]
      if (best) insights.push({
        type: 'highlight',
        title: lang === 'en' ? `${best.label} is the team's strongest skill` : `${best.label} es la habilidad más fuerte`,
        body: lang === 'en'
          ? `Team averages ${best.avg}% on ${best.label.toLowerCase()} — consistently above other criteria.`
          : `El equipo promedia ${best.avg}% en ${best.label.toLowerCase()} — por encima del resto de criterios.`,
      })
      if (worst && worst.avg < 65) insights.push({
        type: 'recommendation',
        title: lang === 'en' ? `${worst.label} needs work` : `${worst.label} necesita trabajo`,
        body: lang === 'en'
          ? `Only ${worst.avg}% avg — ${best.avg - worst.avg} points below the top skill. Assign targeted challenges.`
          : `Solo ${worst.avg}% promedio — ${best.avg - worst.avg} puntos por debajo de la habilidad más fuerte. Asignar desafíos específicos.`,
      })
    }

    // 2. Per-member improvement/drop detection (compare first vs last attempt per user)
    const memberTrends = filteredUsers.map(u => {
      const uAttempts = allAttempts
        .filter(a => a.id_usuario === u.id_usuario)
        .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
      if (uAttempts.length < 2) return null
      const first = uAttempts[0].puntaje_similitud || 0
      const last  = uAttempts[uAttempts.length - 1].puntaje_similitud || 0
      const delta = last - first
      return { name: u.company_display_name || u.nombre_display || u.nombre || u.email, delta, last }
    }).filter(Boolean)

    const improved = memberTrends.filter(t => t.delta >= 10).sort((a, b) => b.delta - a.delta)
    const dropped  = memberTrends.filter(t => t.delta <= -10).sort((a, b) => a.delta - b.delta)

    if (improved.length > 0) {
      const top = improved[0]
      insights.push({
        type: 'highlight',
        title: lang === 'en' ? `${top.name} improved +${top.delta}pts` : `${top.name} mejoró +${top.delta}pts`,
        body: lang === 'en'
          ? `Went from ${top.last - top.delta}% to ${top.last}% — strongest growth in the team.`
          : `Pasó de ${top.last - top.delta}% a ${top.last}% — el mayor crecimiento del equipo.`,
      })
    }
    if (dropped.length > 0) {
      const worst = dropped[0]
      insights.push({
        type: 'warning',
        title: lang === 'en' ? `${worst.name} dropped ${worst.delta}pts` : `${worst.name} bajó ${worst.delta}pts`,
        body: lang === 'en'
          ? `Score went from ${worst.last - worst.delta}% to ${worst.last}% — check in with this member.`
          : `Score bajó de ${worst.last - worst.delta}% a ${worst.last}% — revisar con este miembro.`,
      })
    }

    // 3. Participation / risk warnings
    if (needsAttention.length > 0) insights.push({
      type: 'warning',
      title: lang === 'en'
        ? `${needsAttention.length} member${needsAttention.length > 1 ? 's' : ''} below 55%`
        : `${needsAttention.length} miembro${needsAttention.length > 1 ? 's' : ''} bajo 55%`,
      body: lang === 'en'
        ? needsAttention.map(u => `${u.company_display_name || u.nombre_display || u.nombre || u.email} (${u.promedio_score ?? 0}%)`).join(' · ')
        : needsAttention.map(u => `${u.company_display_name || u.nombre_display || u.nombre || u.email} (${u.promedio_score ?? 0}%)`).join(' · '),
    })
    if (inactiveMembers > 0) insights.push({
      type: 'warning',
      title: lang === 'en'
        ? `${inactiveMembers} member${inactiveMembers > 1 ? 's' : ''} with no activity`
        : `${inactiveMembers} miembro${inactiveMembers > 1 ? 's' : ''} sin actividad`,
      body: lang === 'en' ? 'No attempts recorded. Consider sending a challenge.' : 'Sin intentos registrados. Considerá asignar un desafío.',
    })

    // 4. Positive team signal
    if (participationRate >= 80 && avgScore >= 70) insights.push({
      type: 'highlight',
      title: lang === 'en' ? 'Strong team performance' : 'Equipo con buen rendimiento',
      body: lang === 'en'
        ? `${participationRate}% participation · ${avgScore}% avg score — team is on track.`
        : `${participationRate}% participación · ${avgScore}% score promedio — el equipo va bien.`,
    })

    // 5. Top challenge by attempts
    const topChallenge = challenges.map(ch => ({
      ch,
      count: (challengeAttempts[ch.id_imagen] || []).filter(a => filteredUsers.some(u => u.id_usuario === a.id_usuario)).length,
    })).sort((a, b) => b.count - a.count)[0]
    if (topChallenge?.count > 0) insights.push({
      type: 'highlight',
      title: lang === 'en' ? `Most attempted: "${topChallenge.ch.image_theme || 'Challenge'}"` : `Más intentado: "${topChallenge.ch.image_theme || 'Desafío'}"`,
      body: lang === 'en'
        ? `${topChallenge.count} attempt${topChallenge.count !== 1 ? 's' : ''} — your team's most engaged challenge.`
        : `${topChallenge.count} intento${topChallenge.count !== 1 ? 's' : ''} — el desafío con más participación.`,
    })

    // 6. Role distribution
    const roleCounts = { manager: 0, analyst: 0, trainee: 0, observer: 0, none: 0 }
    filteredUsers.forEach(u => { roleCounts[u.company_role || 'none']++ })
    const assignedCount = filteredUsers.filter(u => u.company_role).length
    if (assignedCount > 0) insights.push({
      type: 'recommendation',
      title: lang === 'en' ? 'Role distribution' : 'Distribución de roles',
      body: Object.entries(roleCounts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · '),
    })

    // ── Improvement rate: members who improved last 2 attempts ──
    const improvingCount = filteredUsers.filter(u => {
      const ua = allAttempts.filter(a => a.id_usuario === u.id_usuario).sort((a,b) => new Date(a.fecha_hora)-new Date(b.fecha_hora))
      if (ua.length < 2) return false
      return (ua[ua.length-1].puntaje_similitud||0) > (ua[ua.length-2].puntaje_similitud||0)
    }).length

    // ── Avg attempts per active member (efficiency proxy) ──
    const avgAttemptsPerActive = activeMembers > 0 ? Math.round(totalAttempts / activeMembers) : 0

    // ── Score target (70%) gap ──
    const belowTarget = filteredUsers.filter(u => (u.total_intentos||0) > 0 && (u.promedio_score||0) < 70).length
    const belowTargetPct = activeMembers > 0 ? Math.round(belowTarget / activeMembers * 100) : 0

    return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-4">

        {/* ── Filters row ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{lang === 'en' ? 'Period' : 'Periodo'}</label>
            <select
              value={dashboardFilters.timeRange}
              onChange={e => updateDashboardFilters({ timeRange: e.target.value })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              <option value="7">{lang === 'en' ? 'Last 7 days' : 'Últimos 7 días'}</option>
              <option value="30">{lang === 'en' ? 'Last 30 days' : 'Últimos 30 días'}</option>
              <option value="90">{lang === 'en' ? 'Last 90 days' : 'Últimos 90 días'}</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{lang === 'en' ? 'Member' : 'Miembro'}</label>
            <select
              value={dashboardFilters.selectedMember}
              onChange={e => updateDashboardFilters({ selectedMember: e.target.value })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-400 max-w-[160px]"
            >
              <option value="all">{lang === 'en' ? 'All members' : 'Todos'}</option>
              {teamUsers.map(u => (
                <option key={u.id_usuario} value={u.id_usuario}>
                  {u.company_display_name || u.nombre_display || u.nombre || u.email}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{lang === 'en' ? 'Challenge' : 'Desafío'}</label>
            <select
              value={dashboardFilters.selectedChallenge}
              onChange={e => updateDashboardFilters({ selectedChallenge: e.target.value })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-400 max-w-[160px]"
            >
              <option value="all">{lang === 'en' ? 'All challenges' : 'Todos'}</option>
              {challenges.map(ch => (
                <option key={ch.id_imagen} value={ch.id_imagen}>
                  {ch.image_theme || `#${ch.id_imagen.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>
          {(dashboardFilters.selectedMember !== 'all' || dashboardFilters.selectedChallenge !== 'all') && (
            <button
              onClick={() => updateDashboardFilters({ selectedMember: 'all', selectedChallenge: 'all' })}
              className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
            >
              {lang === 'en' ? 'Clear filters' : 'Limpiar filtros'}
            </button>
          )}
          
          {/* Indicador de filtros activos */}
          {(dashboardFilters.selectedMember !== 'all' || dashboardFilters.selectedChallenge !== 'all') && (
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              {lang === 'en' ? 'Filtered view' : 'Vista filtrada'}
            </div>
          )}
          {/* Chart picker toggle button — inline, no floating dropdown */}
          <button
            onClick={() => setShowChartPicker(v => !v)}
            className={`ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              showChartPicker
                ? 'border-violet-400 text-violet-600 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-violet-300 hover:text-violet-600'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {lang === 'en' ? 'Charts' : 'Gráficos'}
            <svg className={`h-3 w-3 transition-transform ${showChartPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Chart picker panel — inline, no absolute positioning */}
        {showChartPicker && (
          <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400 mb-2.5">
              {lang === 'en' ? 'Show / hide charts' : 'Mostrar / ocultar gráficos'}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {[
                { key: 'skillBreakdown',        label: lang === 'en' ? 'Skill Breakdown' : 'Habilidades' },
                { key: 'scoreTrend',             label: lang === 'en' ? 'Score Trend' : 'Tendencia Score' },
                { key: 'distribution',           label: lang === 'en' ? 'Score Distribution' : 'Distribución' },
                { key: 'weeklyActivity',         label: lang === 'en' ? 'Weekly Activity' : 'Actividad Semanal' },
                { key: 'challengeParticipation', label: lang === 'en' ? 'Challenge Participation' : 'Participación Desafíos' },
                { key: 'topPerformers',          label: lang === 'en' ? 'Top Performers' : 'Mejores' },
                { key: 'needsCoaching',          label: lang === 'en' ? 'Needs Coaching' : 'Necesitan Apoyo' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleCharts[key]}
                    onChange={e => setVisibleCharts(v => ({ ...v, [key]: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── ZONE 1: KPI strip — 5 cards with context ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Score vs target */}
          <div className={`rounded-xl border p-4 ${avgScore >= 70 ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20' : avgScore >= 50 ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{lang === 'en' ? 'Avg Score' : 'Score Prom.'}</p>
            <p className={`text-2xl font-bold tabular-nums ${avgScore >= 70 ? 'text-emerald-600' : avgScore >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{avgScore}%</p>
            <p className="text-[10px] text-slate-500 mt-1">{lang === 'en' ? 'Target: 70%' : 'Objetivo: 70%'}</p>
            <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(avgScore, 100)}%`, backgroundColor: avgScore >= 70 ? '#10b981' : avgScore >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>
          {/* Participation */}
          <div className={`rounded-xl border p-4 ${participationRate >= 70 ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20' : participationRate >= 40 ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{lang === 'en' ? 'Participation' : 'Participación'}</p>
            <p className={`text-2xl font-bold tabular-nums ${participationRate >= 70 ? 'text-emerald-600' : participationRate >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{participationRate}%</p>
            <p className="text-[10px] text-slate-500 mt-1">{activeMembers}/{memberCount} {lang === 'en' ? 'active' : 'activos'}</p>
            <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${participationRate}%`, backgroundColor: participationRate >= 70 ? '#10b981' : participationRate >= 40 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>
          {/* Improving */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{lang === 'en' ? 'Improving' : 'Mejorando'}</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{improvingCount}</p>
            <p className="text-[10px] text-slate-500 mt-1">{lang === 'en' ? 'last 2 attempts ↑' : 'últimos 2 intentos ↑'}</p>
          </div>
          {/* Below target */}
          <div className={`rounded-xl border p-4 ${belowTarget > 0 ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{lang === 'en' ? 'Below 70%' : 'Bajo 70%'}</p>
            <p className={`text-2xl font-bold tabular-nums ${belowTarget > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{belowTargetPct}%</p>
            <p className="text-[10px] text-slate-500 mt-1">{belowTarget} {lang === 'en' ? `member${belowTarget !== 1 ? 's' : ''}` : `miembro${belowTarget !== 1 ? 's' : ''}`}</p>
          </div>
          {/* ELO */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">ELO {lang === 'en' ? 'Avg' : 'Prom.'}</p>
            <p className="text-2xl font-bold tabular-nums text-violet-600">{avgElo}</p>
            <p className="text-[10px] text-slate-500 mt-1">{lang === 'en' ? `Best: ${topElo}` : `Mejor: ${topElo}`}</p>
          </div>
        </div>

        {/* ── ZONE 2: Actionable insights feed ── */}
        {insights.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lang === 'en' ? '⚡ Insights & Actions' : '⚡ Insights y Acciones'}</p>
              <span className="text-[10px] text-slate-400">{insights.length} {lang === 'en' ? 'signals' : 'señales'}</span>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {insights.map((ins, i) => {
                const isWarn = ins.type === 'warning'
                const isRec  = ins.type === 'recommendation'
                const icon   = isWarn ? '🔴' : isRec ? '🟡' : '🟢'
                const titleColor = isWarn ? 'text-rose-700 dark:text-rose-400' : isRec ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                const action = isWarn
                  ? (lang === 'en' ? '→ Act now' : '→ Actuar')
                  : isRec
                    ? (lang === 'en' ? '→ Review' : '→ Revisar')
                    : null
                return (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className="text-sm mt-0.5 shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold leading-snug ${titleColor}`}>{ins.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{ins.body}</p>
                    </div>
                    {action && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setActiveTab('users')}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition ${isWarn ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100' : 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100'}`}
                        >
                          {action}
                        </button>
                        {(ins.type === 'warning' || ins.type === 'recommendation') && (
                          <button
                            onClick={() => sendReviewMessage('team', ins.title)}
                            className="text-[10px] font-semibold px-2 py-1 rounded-lg transition text-violet-600 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100"
                          >
                            {lang === 'en' ? 'Ask AI' : 'Preguntar IA'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ZONE 3: Main chart — Score trend (protagonist) + Skill breakdown side by side ── */}
        {(teamProgressData.some(d => d.avg !== null) || skillData.length > 0) && visibleCharts.scoreTrend && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Score trend — 2/3 width, prominent */}
            {teamProgressData.some(d => d.avg !== null) && (
              <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{lang === 'en' ? 'Score Trend' : 'Tendencia de Score'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{lang === 'en' ? 'Daily team average · target 70%' : 'Promedio diario del equipo · objetivo 70%'}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums">{totalAttempts} {lang === 'en' ? 'total attempts' : 'intentos totales'}</span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={teamProgressData.filter(d => d.avg !== null)} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {/* Target line at 70% */}
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow text-xs">
                          <p className="text-slate-400 mb-0.5">{d.date}</p>
                          <p className="font-bold text-violet-600">{d.avg}% <span className="font-normal text-slate-400">avg</span></p>
                          <p className="text-slate-400">{d.count} {lang === 'en' ? 'attempts' : 'intentos'}</p>
                          <p className={`font-medium mt-0.5 ${d.avg >= 70 ? 'text-emerald-600' : 'text-rose-500'}`}>{d.avg >= 70 ? (lang === 'en' ? '✓ On target' : '✓ En objetivo') : `${70 - d.avg}pts ${lang === 'en' ? 'below target' : 'bajo objetivo'}`}</p>
                        </div>
                      )
                    }} />
                    <Area type="monotone" dataKey="avg" stroke="#7c3aed" strokeWidth={2} fill="url(#gradScore)" dot={false} activeDot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Skill breakdown — 1/3 width */}
            {skillData.length > 0 && visibleCharts.skillBreakdown && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">{lang === 'en' ? 'Skill Breakdown' : 'Habilidades'}</p>
                <p className="text-xs text-slate-400 mb-4">{lang === 'en' ? 'Team avg per criterion' : 'Promedio por criterio'}</p>
                <div className="space-y-3.5">
                  {skillData.map(s => {
                    const gap = 70 - s.avg
                    const barColor = s.avg >= 70 ? '#10b981' : s.avg >= 50 ? '#f59e0b' : '#ef4444'
                    const textColor = s.avg >= 70 ? 'text-emerald-600' : s.avg >= 50 ? 'text-amber-500' : 'text-rose-500'
                    return (
                      <div key={s.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{s.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold tabular-nums ${textColor}`}>{s.avg}%</span>
                            {gap > 0 && <span className="text-[10px] text-rose-400">-{gap}</span>}
                          </div>
                        </div>
                        <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.avg}%`, backgroundColor: barColor }} />
                          {/* Target marker at 70% */}
                          <div className="absolute top-0 bottom-0 w-px bg-slate-400/50" style={{ left: '70%' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-3 border-t border-slate-100 dark:border-slate-800 pt-2">{lang === 'en' ? `${allAttempts.length} attempts · target line at 70%` : `${allAttempts.length} intentos · línea objetivo en 70%`}</p>
              </div>
            )}
          </div>
        )}

        {/* ── ZONE 4: Ranking — Top performers + At risk (side by side, clickable) ── */}
        {(visibleCharts.topPerformers || visibleCharts.needsCoaching) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleCharts.topPerformers && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">🏆 {lang === 'en' ? 'Top Performers' : 'Mejores'}</p>
                  <button onClick={() => setActiveTab('leaderboard')} className="text-[10px] text-violet-500 hover:text-violet-700 font-medium">{lang === 'en' ? 'Full ranking →' : 'Ranking completo →'}</button>
                </div>
                {top5.length === 0
                  ? <p className="text-xs text-slate-400 px-4 py-6 text-center">{lang === 'en' ? 'No data yet' : 'Sin datos aún'}</p>
                  : <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {top5.map((u, idx) => {
                        const name = u.company_display_name || u.nombre_display || u.nombre || u.email
                        const profileHref = u.username ? `/user/${u.username}` : `/perfil?id=${u.id_usuario}`
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                        const trend = memberTrends.find(t => t.name === name)
                        return (
                          <a key={u.id_usuario} href={profileHref} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <span className="text-sm w-5 shrink-0 text-center">{medal || <span className="text-xs font-bold text-slate-300">{idx+1}</span>}</span>
                            <div className="h-7 w-7 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                              {u.avatar_url ? <img src={proxyImg(u.avatar_url)} alt={name} className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-slate-500">{name.substring(0,2).toUpperCase()}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-violet-600 transition-colors">{name}</p>
                              <p className="text-[10px] text-slate-400">{u.total_intentos||0} {lang==='en'?'att.':'int.'} · {u.racha_actual||0}d streak</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-violet-600">{u.elo_rating||1000}</p>
                              <div className="flex items-center gap-1 justify-end">
                                <p className={`text-[10px] font-semibold ${(u.promedio_score||0)>=70?'text-emerald-600':'text-amber-500'}`}>{u.promedio_score??'-'}%</p>
                                {trend&&trend.delta!==0&&<span className={`text-[9px] font-bold ${trend.delta>0?'text-emerald-500':'text-rose-500'}`}>{trend.delta>0?`+${trend.delta}`:trend.delta}</span>}
                              </div>
                            </div>
                          </a>
                        )
                      })}
                    </div>
                }
              </div>
            )}
            {visibleCharts.needsCoaching && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-rose-100 dark:border-rose-900/30 flex items-center justify-between bg-rose-50 dark:bg-rose-950/20">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">⚠️ {lang==='en'?'At Risk':'En Riesgo'}</p>
                  {belowTarget>0&&<span className="text-[10px] font-semibold text-rose-600 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">{belowTargetPct}% {lang==='en'?'below target':'bajo objetivo'}</span>}
                </div>
                {needsAttention.length===0&&inactiveMembers===0
                  ? <p className="text-xs text-emerald-600 font-medium px-4 py-6 text-center">✓ {lang==='en'?'All active members above 55%':'Todos los activos sobre 55%'}</p>
                  : <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {needsAttention.map(u => {
                        const name = u.company_display_name||u.nombre_display||u.nombre||u.email
                        const profileHref = u.username?`/user/${u.username}`:`/perfil?id=${u.id_usuario}`
                        const trend = memberTrends.find(t=>t.name===name)
                        const gap = 70-(u.promedio_score||0)
                        return (
                          <a key={u.id_usuario} href={profileHref} className="flex items-center gap-3 px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors group">
                            <div className="h-7 w-7 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                              {u.avatar_url?<img src={proxyImg(u.avatar_url)} alt={name} className="h-full w-full object-cover"/>:<span className="text-[10px] font-bold text-slate-500">{name.substring(0,2).toUpperCase()}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-rose-600 transition-colors">{name}</p>
                              <p className="text-[10px] text-rose-400">{gap}pts {lang==='en'?'to reach target':'para llegar al objetivo'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-rose-500">{u.promedio_score??0}%</p>
                              <div className="flex items-center gap-1 mt-1">
                                {trend&&trend.delta!==0&&<span className={`text-[9px] font-bold ${trend.delta>0?'text-emerald-500':'text-rose-500'}`}>{trend.delta>0?`+${trend.delta}`:trend.delta}</span>}
                                <button
                                  onClick={() => sendReviewMessage(name, `Low performance: ${u.promedio_score??0}% average score`)}
                                  className="text-[9px] text-violet-600 hover:text-violet-700 font-medium ml-1"
                                >
                                  {lang === 'en' ? 'Ask' : 'IA'}
                                </button>
                              </div>
                            </div>
                          </a>
                        )
                      })}
                      {inactiveMembers>0&&(
                        <div className="px-4 py-2.5 flex items-center gap-2">
                          <span className="text-sm">😴</span>
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">{inactiveMembers} {lang==='en'?`member${inactiveMembers>1?'s':''} never attempted`:`miembro${inactiveMembers>1?'s':''} sin intentos`}</p>
                          <button onClick={()=>setActiveTab('requests')} className="ml-auto text-[10px] text-amber-600 font-semibold hover:underline">{lang==='en'?'Invite →':'Invitar →'}</button>
                        </div>
                      )}
                    </div>
                }
              </div>
            )}
          </div>
        )}

        {/* ── ZONE 5: Activity + Distribution + Challenge reach ── */}
        {(visibleCharts.distribution||visibleCharts.weeklyActivity||visibleCharts.challengeParticipation)&&(
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scoreDist.length>0&&visibleCharts.distribution&&(
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">{lang==='en'?'Score Distribution':'Distribución'}</p>
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width={80} height={80}>
                    <PieChart>
                      <Pie data={scoreDist} cx="50%" cy="50%" innerRadius={24} outerRadius={38} dataKey="value" strokeWidth={0}>
                        {scoreDist.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
                      </Pie>
                      <Tooltip content={({active,payload})=>{if(!active||!payload?.length)return null;return<div className="rounded-lg border border-slate-200 bg-white px-2 py-1 shadow text-xs"><p className="font-medium">{payload[0].name}</p><p className="text-slate-500">{payload[0].value}</p></div>}}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1">
                    {scoreDist.map(d=>(
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{backgroundColor:d.color}}/><span className="text-[10px] text-slate-500 dark:text-slate-400">{d.name}</span></div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {weeklyData.some(d=>d.intentos>0)&&visibleCharts.weeklyActivity&&(
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{lang==='en'?'Weekly Activity':'Actividad Semanal'}</p>
                <p className="text-[10px] text-slate-400 mb-3">{lang==='en'?'Attempts last 7 days':'Intentos últimos 7 días'}</p>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={weeklyData} margin={{top:0,right:4,left:-24,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                    <XAxis dataKey="label" tick={{fontSize:9,fill:'#94a3b8'}} tickLine={false} axisLine={false}/>
                    <YAxis tick={{fontSize:9,fill:'#94a3b8'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                    <Tooltip content={({active,payload})=>{if(!active||!payload?.length)return null;return<div className="rounded-lg border border-slate-200 bg-white dark:bg-slate-800 px-2 py-1.5 shadow text-xs"><p className="text-slate-500">{payload[0].payload.label}</p><p className="font-semibold text-emerald-600">{payload[0].value} {lang==='en'?'att.':'int.'}</p></div>}}/>
                    <Bar dataKey="intentos" fill="#10b981" radius={[2,2,0,0]} maxBarSize={20}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {challengeParticipation.length>0&&visibleCharts.challengeParticipation&&(
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{lang==='en'?'Challenge Reach':'Alcance Desafíos'}</p>
                <p className="text-[10px] text-slate-400 mb-3">{lang==='en'?'Members per challenge':'Miembros por desafío'}</p>
                <div className="space-y-2">
                  {challengeParticipation.slice(0,5).map(ch=>{
                    const pct=memberCount>0?Math.round(ch.participants/memberCount*100):0
                    return(
                      <div key={ch.name}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{ch.name}</span>
                          <span className="text-[10px] font-semibold text-violet-600 shrink-0">{ch.participants}/{memberCount}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-violet-500 transition-all" style={{width:`${pct}%`}}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* RIGHT COLUMN: AI Chatbot */}
      <div className="w-80 xl:w-96 shrink-0 sticky top-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col" style={{ height: '680px' }}>
          <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{lang === 'en' ? 'Team Assistant' : 'Asistente de Equipo'}</p>
              <p className="text-[11px] text-slate-400">{lang === 'en' ? 'Manage your team with AI' : 'Gestioná tu equipo con IA'}</p>
            </div>
            {chatMessages.length > 0 && (
              <button
                onClick={() => { setChatMessages([]); setChatError(null) }}
                className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 transition shrink-0"
              >
                {lang === 'en' ? 'Clear' : 'Limpiar'}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {chatMessages.length === 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-3">
                  {lang === 'en' ? 'Ask anything about your team' : 'Pregunta lo que quieras sobre tu equipo'}
                </p>
                {[
                  lang === 'en' ? 'Who is my top performer?' : '¿Quién es mi mejor miembro?',
                  lang === 'en' ? 'Who needs coaching?' : '¿Quién necesita apoyo?',
                  lang === 'en' ? 'Show team performance summary' : 'Mostrar resumen del equipo',
                  lang === 'en' ? 'Filter by challenge "Salamanca 32"' : 'Filtrar por desafío "Salamanca 32"',
                  lang === 'en' ? 'Show stats for challenge ID' : 'Mostrar estadísticas del desafío',
                  lang === 'en' ? 'Assign role "Team Lead" to @' : 'Asignar rol "Team Lead" a @',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setChatInput(suggestion)}
                    className="w-full text-left text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-600 dark:text-slate-400 hover:border-violet-300 hover:text-violet-700 dark:hover:text-violet-400 transition"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3 py-2.5 flex gap-1 items-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {chatError && (
              <p className="text-[11px] text-rose-500 text-center">{chatError}</p>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="px-3 pb-3 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <form
              onSubmit={e => { e.preventDefault(); sendChatMessage() }}
              className="flex gap-2 items-end"
            >
              <div className="flex-1 relative">
                <textarea
                  value={chatInput}
                  onChange={e => {
                    const val = e.target.value
                    setChatInput(val)
                    // Autocomplete: detect rename/role/remove commands and @ mentions
                    const lower = val.toLowerCase()
                    const renameMatch = lower.match(/(?:renombrar?|rename)\s+(.*)$/i)
                    const roleMatch = lower.match(/(?:asignar?\s+rol|assign\s+role)\s+(?:"([^"]+)"|(\w+))\s+(?:a\s+)?(.*)$/i)
                    const removeMatch = lower.match(/(?:eliminar?|remove|quitar)\s+(.*)$/i)
                    const atMentionMatch = val.match(/@(\w*)$/) // @ al final del texto
                    
                    let partial = ''
                    let mode = null
                    
                    if (atMentionMatch) {
                      // @ mention autocompletado
                      partial = atMentionMatch[1] || ''
                      mode = 'mention'
                    } else if (renameMatch) {
                      partial = renameMatch[1].trim()
                      mode = 'rename'
                    } else if (roleMatch) {
                      // Para comandos de rol, buscar después de "a" o "to"
                      const afterRole = roleMatch[3] || ''
                      partial = afterRole.trim()
                      mode = 'role'
                    } else if (removeMatch) {
                      partial = removeMatch[1].trim()
                      mode = 'remove'
                    }
                    
                    if (mode && (partial.length >= 0 || mode === 'mention')) {
                      setChatSuggestionMode(mode)
                      const filtered = teamUsers.filter(u => {
                        const displayName = (u.company_display_name || u.nombre_display || u.nombre || '').toLowerCase()
                        const username = (u.username || '').toLowerCase()
                        const email = (u.email || '').toLowerCase()
                        const searchTerm = partial.toLowerCase()
                        
                        return mode === 'mention' ? 
                          (partial === '' || displayName.includes(searchTerm) || username.includes(searchTerm) || email.includes(searchTerm)) :
                          (displayName.includes(searchTerm) || username.includes(searchTerm) || email.includes(searchTerm))
                      }).slice(0, 5)
                      setChatSuggestions(filtered)
                    } else {
                      setChatSuggestions([])
                      setChatSuggestionMode(null)
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setChatSuggestions([]); setChatSuggestionMode(null) }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (chatSuggestions.length === 0) sendChatMessage()
                    }
                  }}
                  placeholder={lang === 'en' ? 'Ask about your team...' : 'Pregunta sobre tu equipo...'}
                  rows={2}
                  maxLength={800}
                  className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
                {/* Member autocomplete dropdown */}
                {chatSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden z-50">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400 border-b border-slate-100 dark:border-slate-800">
                      {chatSuggestionMode === 'mention' ? (lang === 'en' ? 'Select member to mention' : 'Seleccionar miembro para mencionar') :
                       chatSuggestionMode === 'rename' ? (lang === 'en' ? 'Select member to rename' : 'Seleccioná miembro a renombrar') :
                       chatSuggestionMode === 'role'   ? (lang === 'en' ? 'Select member for role' : 'Seleccioná miembro para rol') :
                                                         (lang === 'en' ? 'Select member to remove' : 'Seleccioná miembro a eliminar')}
                    </p>
                    {chatSuggestions.map(u => {
                      const displayName = u.company_display_name || u.nombre_display || u.nombre || u.email
                      const username = u.username ? `@${u.username}` : null
                      const role = u.company_role
                      const stats = `ELO: ${u.elo_rating || 1000} | Score: ${u.promedio_score ?? 0}%`
                      
                      return (
                        <button
                          key={u.id_usuario}
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault()
                            // Replace the partial name in the input with the full name
                            const lower = chatInput.toLowerCase()
                            
                            if (chatSuggestionMode === 'mention') {
                              // Para @ mentions, reemplazar desde el @
                              const atIndex = chatInput.lastIndexOf('@')
                              if (atIndex >= 0) {
                                const beforeAt = chatInput.slice(0, atIndex)
                                setChatInput(beforeAt + '@' + displayName + ' ')
                              } else {
                                setChatInput(chatInput + '@' + displayName + ' ')
                              }
                            } else {
                              // Lógica existente para comandos
                              const renameIdx = lower.search(/(?:renombrar?|rename)\s+/i)
                              const roleIdx = lower.search(/(?:asignar?\s+rol|assign\s+role)\s+/i)
                              const removeIdx = lower.search(/(?:eliminar?|remove|quitar)\s+/i)
                              
                              if (renameIdx >= 0) {
                                const beforeName = chatInput.slice(0, renameIdx)
                                const renameCmd = chatInput.slice(renameIdx).match(/(?:renombrar?|rename)\s+/i)?.[0] || ''
                                setChatInput(beforeName + renameCmd + displayName + ' ')
                              } else if (roleIdx >= 0) {
                                // Para roles, insertar después de "a" o "to"
                                const beforeRole = chatInput.slice(0, roleIdx)
                                const roleMatch = chatInput.slice(roleIdx).match(/(?:asignar?\s+rol|assign\s+role)\s+(?:"([^"]+)"|(\w+))\s+(?:a\s+)?/i)
                                if (roleMatch) {
                                  const roleCmd = roleMatch[0]
                                  setChatInput(beforeRole + roleCmd + displayName)
                                } else {
                                  setChatInput(chatInput + displayName + ' ')
                                }
                              } else if (removeIdx >= 0) {
                                const beforeName = chatInput.slice(0, removeIdx)
                                const removeCmd = chatInput.slice(removeIdx).match(/(?:eliminar?|remove|quitar)\s+/i)?.[0] || ''
                                setChatInput(beforeName + removeCmd + displayName)
                              } else {
                                setChatInput(chatInput + displayName + ' ')
                              }
                            }
                            
                            setChatSuggestions([])
                            setChatSuggestionMode(null)
                          }}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition text-left"
                        >
                          <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                            {u.avatar_url
                              ? <img src={proxyImg(u.avatar_url)} alt={displayName} className="h-full w-full object-cover" />
                              : <span className="text-[10px] font-bold text-slate-500">{displayName.substring(0,2).toUpperCase()}</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate">{displayName}</span>
                              {role && (
                                <span 
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                                  style={{
                                    backgroundColor: customRoles.find(r => r.role_name === role)?.role_color + '20' || '#6b728020',
                                    borderColor: customRoles.find(r => r.role_name === role)?.role_color + '40' || '#6b728040',
                                    color: customRoles.find(r => r.role_name === role)?.role_color || '#6b7280',
                                    border: '1px solid'
                                  }}
                                >
                                  {role}
                                </span>
                              )}
                            </div>
                            {username && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{username}</div>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5">{stats}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="h-9 w-9 shrink-0 rounded-xl bg-violet-600 flex items-center justify-center text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-slate-300 dark:text-slate-600">{chatInput.length}/800</p>
              <p className="text-[10px] text-slate-400">
                {(() => {
                  const rateLimitResult = chatRateLimiter.checkLimit(user?.id || 'anonymous')
                  return `${rateLimitResult.remaining || 0}/10 ${lang === 'en' ? 'requests' : 'consultas'}`
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    )
  }

  const renderLeaderboard = () => {
    const sortOptions = [
      { id: 'elo',      label: 'ELO',                          get: u => u.elo_rating || 1000,          fmt: v => v },
      { id: 'score',    label: lang === 'en' ? 'Avg Score' : 'Score Prom.', get: u => u.promedio_score || 0, fmt: v => `${v}%` },
      { id: 'attempts', label: lang === 'en' ? 'Attempts' : 'Intentos',    get: u => u.total_intentos || 0, fmt: v => v },
      { id: 'streak',   label: lang === 'en' ? 'Streak' : 'Racha',         get: u => u.racha_actual || 0,   fmt: v => `${v}d` },
      { id: 'approval', label: lang === 'en' ? 'Approval' : 'Aprobacion',  get: u => u.porcentaje_aprobacion || 0, fmt: v => `${v}%` },
    ]
    const current = sortOptions.find(s => s.id === lbSort) || sortOptions[0]
    const sorted = [...teamUsers].sort((a, b) => current.get(b) - current.get(a))
    const maxVal = sorted.length > 0 ? current.get(sorted[0]) || 1 : 1

    const roleColors = {
      manager:  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
      analyst:  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
      trainee:  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
      observer: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    }

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'en' ? 'Team Ranking' : 'Ranking del Equipo'}
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {lang === 'en' ? `${teamUsers.length} members` : `${teamUsers.length} miembros`}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {sortOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setLbSort(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  lbSort === opt.id
                    ? 'bg-violet-600 text-white'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-violet-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {teamUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center">
            <p className="text-slate-400 text-sm">{lang === 'en' ? 'No members yet' : 'Sin miembros aun'}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            {sorted.map((u, idx) => {
              const name = u.company_display_name || u.nombre_display || u.nombre || u.username || u.email
              const val = current.get(u)
              const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0
              const profileHref = u.username ? `/user/${u.username}` : `/perfil?id=${u.id_usuario}`
              const podium = idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-slate-300 dark:text-slate-600'
              return (
                <div key={u.id_usuario} className={`flex items-center gap-3 px-4 py-3 ${idx < sorted.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                  <span className={`text-sm font-bold w-6 shrink-0 text-center ${podium}`}>{idx + 1}</span>
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                    {u.avatar_url
                      ? <img src={proxyImg(u.avatar_url)} alt={name} className="h-full w-full object-cover" />
                      : <span className="text-[10px] font-bold text-slate-500">{name.substring(0,2).toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <a href={profileHref} className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate hover:text-violet-600">{name}</a>
                      {u.company_role && (
                        <span 
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                          style={{
                            backgroundColor: customRoles.find(r => r.role_name === u.company_role)?.role_color + '20' || '#f1f5f920',
                            borderColor: customRoles.find(r => r.role_name === u.company_role)?.role_color + '40' || '#f1f5f940',
                            color: customRoles.find(r => r.role_name === u.company_role)?.role_color || '#6b7280',
                            border: '1px solid'
                          }}
                        >
                          {u.company_role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-violet-600 shrink-0 w-14 text-right">{current.fmt(val)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right hidden sm:block">
                    <p className="text-[10px] text-slate-400">{u.total_intentos || 0} {lang === 'en' ? 'att.' : 'int.'}</p>
                    <p className="text-[10px] text-slate-400">{u.racha_actual || 0}d</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderUsers = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {lang === 'en' ? 'Team Members' : 'Miembros del Equipo'}
            <span className="ml-2 text-sm font-normal text-slate-400">({teamUsers.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{lang === 'en' ? 'Manage names, roles and access' : 'Gestioná nombres, roles y acceso'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRoleModalOpen(true)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            {lang === 'en' ? 'Manage Roles' : 'Gestionar Roles'}
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition"
          >
            + {lang === 'en' ? 'Invite' : 'Invitar'}
          </button>
        </div>
      </div>

      {teamUsers.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-slate-400 text-sm">{lang === 'en' ? 'No team members yet' : 'No hay miembros en el equipo'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Member' : 'Miembro'}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Role' : 'Rol'}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ELO</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Score' : 'Score'}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Attempts' : 'Intentos'}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{lang === 'en' ? 'Actions' : 'Acciones'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {teamUsers.map((member) => {
                const displayName = member.company_display_name || member.nombre_display || member.nombre || member.username || member.email
                const profileHref = member.username ? `/user/${member.username}` : `/perfil?id=${member.id_usuario}`
                const isEditingThis = editingName?.id === member.id_usuario
                const isConfirmingRemove = confirmRemove === member.id_usuario

                return (
                  <tr key={member.id_usuario} className={isConfirmingRemove ? 'bg-rose-50 dark:bg-rose-950/20' : ''}>
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
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
                                onKeyDown={e => { if (e.key === 'Enter') saveMemberName(); if (e.key === 'Escape') setEditingName(null) }}
                                className="w-28 rounded-lg border border-violet-400 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 dark:bg-slate-800 dark:text-slate-100"
                              />
                              <button onClick={saveMemberName} disabled={savingName} className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-60">
                                {savingName ? '…' : '✓'}
                              </button>
                              <button onClick={() => setEditingName(null)} className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] text-slate-500">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group/name">
                              <a href={profileHref} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-violet-600 truncate max-w-[110px]">{displayName}</a>
                              <button
                                onClick={() => setEditingName({ id: member.id_usuario, value: displayName })}
                                className="opacity-0 group-hover/name:opacity-100 transition text-slate-400 hover:text-slate-600"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </div>
                          )}
                          <p className="text-[11px] text-slate-400 truncate max-w-[130px]">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <select
                        value={member.company_role || ''}
                        onChange={e => assignRole(member.id_usuario, e.target.value || null)}
                        className={`rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer ${
                          member.company_role ? 
                            (customRoles.find(r => r.role_name === member.company_role)?.role_color ? 
                              `border-slate-300 text-slate-700 bg-slate-50` : 
                              'border-slate-300 text-slate-700 bg-slate-50') : 
                            'border-slate-200 dark:border-slate-700 text-slate-400 bg-white dark:bg-slate-900'
                        }`}
                        style={member.company_role ? {
                          backgroundColor: customRoles.find(r => r.role_name === member.company_role)?.role_color + '20',
                          borderColor: customRoles.find(r => r.role_name === member.company_role)?.role_color + '40',
                          color: customRoles.find(r => r.role_name === member.company_role)?.role_color || '#374151'
                        } : {}}
                      >
                        <option value="">{lang === 'en' ? '— No role' : '— Sin rol'}</option>
                        {customRoles.map(role => (
                          <option key={role.id} value={role.role_name}>{role.role_name}</option>
                        ))}
                      </select>
                      {roleError?.userId === member.id_usuario && (
                        <p className="text-[10px] text-rose-500 mt-1">{roleError.msg}</p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm font-semibold text-violet-600">{member.elo_rating || 1000}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{member.promedio_score != null ? `${member.promedio_score}%` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{member.total_intentos || 0}</td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {isConfirmingRemove ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-rose-600 font-medium">{lang === 'en' ? 'Remove?' : '¿Eliminar?'}</span>
                          <button onClick={() => removeMember(member.id_usuario)} disabled={removingId === member.id_usuario} className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-60">
                            {removingId === member.id_usuario ? '…' : (lang === 'en' ? 'Yes' : 'Sí')}
                          </button>
                          <button onClick={() => setConfirmRemove(null)} className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] text-slate-500">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <a href={profileHref} className="text-xs text-violet-600 hover:text-violet-700 font-medium">{lang === 'en' ? 'View' : 'Ver'}</a>
                          <span className="text-slate-200 dark:text-slate-700">|</span>
                          <button onClick={() => setConfirmRemove(member.id_usuario)} className="text-xs text-rose-500 hover:text-rose-700 font-medium transition">
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

  const renderGuides = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {lang === 'en' ? 'Enterprise Guides' : 'Guías Empresariales'}
            <span className="ml-2 text-sm font-normal text-slate-400">({enterpriseGuides.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === 'en' ? 'Create and assign custom training guides to your team' : 'Crea y asigna guías de entrenamiento personalizadas a tu equipo'}
          </p>
        </div>
        <button
          onClick={openGuideModal}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition"
        >
          + {lang === 'en' ? 'Create Guide' : 'Crear Guía'}
        </button>
      </div>

      {loadingGuides ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
          <p className="text-slate-400 text-sm mt-2">{lang === 'en' ? 'Loading guides...' : 'Cargando guías...'}</p>
        </div>
      ) : enterpriseGuides.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">{lang === 'en' ? 'No guides created yet' : 'No hay guías creadas aún'}</p>
          <p className="text-slate-400 text-xs mt-1">{lang === 'en' ? 'Create your first guide to start training your team' : 'Crea tu primera guía para comenzar a entrenar a tu equipo'}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {enterpriseGuides.map((guide) => {
            const accentColors = {
              indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
              cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
              violet: 'border-violet-200 bg-violet-50 text-violet-700',
              amber: 'border-amber-200 bg-amber-50 text-amber-700',
              rose: 'border-rose-200 bg-rose-50 text-rose-700',
              emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
              slate: 'border-slate-200 bg-slate-50 text-slate-700',
              fuchsia: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
              orange: 'border-orange-200 bg-orange-50 text-orange-700',
              red: 'border-red-200 bg-red-50 text-red-700',
              teal: 'border-teal-200 bg-teal-50 text-teal-700',
              blue: 'border-blue-200 bg-blue-50 text-blue-700',
              lime: 'border-lime-200 bg-lime-50 text-lime-700'
            }
            const accentClass = accentColors[guide.accent] || accentColors.indigo

            return (
              <div key={guide.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className={`px-4 py-3 border-b ${accentClass}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate">{guide.title}</h4>
                      {guide.summary && (
                        <p className="text-xs mt-1 opacity-80 line-clamp-2">{guide.summary}</p>
                      )}
                    </div>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${guide.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {guide.status === 'published' ? (lang === 'en' ? 'Published' : 'Publicada') : (lang === 'en' ? 'Draft' : 'Borrador')}
                    </span>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span>{lang === 'en' ? 'Created' : 'Creada'} {new Date(guide.created_at).toLocaleDateString()}</span>
                    {guide.keywords && guide.keywords.length > 0 && (
                      <span>{guide.keywords.length} {lang === 'en' ? 'keywords' : 'palabras clave'}</span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => openAssignmentModal(guide)}
                      className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 transition"
                    >
                      {lang === 'en' ? 'Assign' : 'Asignar'}
                    </button>
                    <button
                      onClick={() => openEditGuideModal(guide)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                    >
                      {lang === 'en' ? 'Edit' : 'Editar'}
                    </button>
                    <button
                      onClick={() => deleteGuide(guide.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-100 transition"
                    >
                      {lang === 'en' ? 'Delete' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Guide Creation/Edit Modal */}
      {guideModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingGuide ? (lang === 'en' ? 'Edit Guide' : 'Editar Guía') : (lang === 'en' ? 'Create Guide' : 'Crear Guía')}
              </h3>
            </div>
            
            <form onSubmit={editingGuide ? updateGuide : createGuide} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'en' ? 'Title' : 'Título'} *
                </label>
                <input
                  type="text"
                  value={guideForm.title}
                  onChange={(e) => setGuideForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={lang === 'en' ? 'Enter guide title...' : 'Ingresa el título de la guía...'}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'en' ? 'Summary' : 'Resumen'}
                </label>
                <textarea
                  value={guideForm.summary}
                  onChange={(e) => setGuideForm(prev => ({ ...prev, summary: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={lang === 'en' ? 'Brief description of what this guide covers...' : 'Breve descripción de lo que cubre esta guía...'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'en' ? 'Lesson Title' : 'Título de la Lección'}
                </label>
                <input
                  type="text"
                  value={guideForm.content.lesson.title}
                  onChange={(e) => setGuideForm(prev => ({
                    ...prev,
                    content: {
                      ...prev.content,
                      lesson: { ...prev.content.lesson, title: e.target.value }
                    }
                  }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={lang === 'en' ? 'Main lesson title...' : 'Título principal de la lección...'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'en' ? 'Keywords' : 'Palabras Clave'}
                </label>
                <input
                  type="text"
                  value={guideForm.keywords.join(', ')}
                  onChange={(e) => setGuideForm(prev => ({
                    ...prev,
                    keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                  }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={lang === 'en' ? 'keyword1, keyword2, keyword3...' : 'palabra1, palabra2, palabra3...'}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'en' ? 'Separate keywords with commas' : 'Separa las palabras clave con comas'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'en' ? 'Color Theme' : 'Tema de Color'}
                </label>
                <select
                  value={guideForm.accent}
                  onChange={(e) => setGuideForm(prev => ({ ...prev, accent: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="indigo">Indigo</option>
                  <option value="violet">Violet</option>
                  <option value="blue">Blue</option>
                  <option value="cyan">Cyan</option>
                  <option value="teal">Teal</option>
                  <option value="emerald">Emerald</option>
                  <option value="lime">Lime</option>
                  <option value="amber">Amber</option>
                  <option value="orange">Orange</option>
                  <option value="red">Red</option>
                  <option value="rose">Rose</option>
                  <option value="fuchsia">Fuchsia</option>
                  <option value="slate">Slate</option>
                </select>
              </div>

              {guideStatus && (
                <div className={`p-3 rounded-lg text-sm ${guideStatus.includes('successfully') || guideStatus.includes('correctamente') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {guideStatus}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeGuideModal}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  {lang === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition"
                >
                  {editingGuide ? (lang === 'en' ? 'Update Guide' : 'Actualizar Guía') : (lang === 'en' ? 'Create Guide' : 'Crear Guía')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {assignmentModalOpen && selectedGuideForAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {lang === 'en' ? 'Assign Guide' : 'Asignar Guía'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">{selectedGuideForAssignment.title}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'en' ? 'Select Team Members' : 'Seleccionar Miembros del Equipo'}
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                  {teamUsers.map((member) => {
                    const displayName = member.company_display_name || member.nombre_display || member.nombre || member.email
                    const isSelected = selectedMembersForAssignment.includes(member.id_usuario)
                    
                    return (
                      <label key={member.id_usuario} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMembersForAssignment(prev => [...prev, member.id_usuario])
                            } else {
                              setSelectedMembersForAssignment(prev => prev.filter(id => id !== member.id_usuario))
                            }
                          }}
                          className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-slate-300 rounded"
                        />
                        <div className="h-6 w-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                          {member.avatar_url ? (
                            <img src={proxyImg(member.avatar_url)} alt={displayName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-slate-500">{displayName.substring(0,2).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">{displayName}</span>
                        {member.company_role && (
                          <span className="ml-auto text-xs text-slate-400">{member.company_role}</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'en' ? 'Due Date (Optional)' : 'Fecha Límite (Opcional)'}
                </label>
                <input
                  type="date"
                  value={assignmentDueDate}
                  onChange={(e) => setAssignmentDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'en' ? 'Notes (Optional)' : 'Notas (Opcional)'}
                </label>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={lang === 'en' ? 'Additional instructions or context...' : 'Instrucciones adicionales o contexto...'}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeAssignmentModal}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  {lang === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={assignGuideToMembers}
                  disabled={selectedMembersForAssignment.length === 0}
                  className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {lang === 'en' ? 'Assign Guide' : 'Asignar Guía'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderChallenges = () => {
    const diffColors = {
      easy: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      medium: 'text-amber-700 bg-amber-50 border-amber-200',
      hard: 'text-rose-700 bg-rose-50 border-rose-200',
    }
    return (
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
          <p className="text-sm text-slate-400 mt-1">{lang === 'en' ? 'Create challenges to assign to your team' : 'Creá desafíos para asignar a tu equipo'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((ch) => {
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
                  <button
                    onClick={() => fetchChallengeStats(ch.id_imagen, ch.image_theme || 'Challenge')}
                    className="absolute top-2 right-12 h-8 w-8 flex items-center justify-center rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-slate-600 dark:text-slate-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/70 dark:hover:text-blue-400 transition shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                    title={lang === 'en' ? 'View stats' : 'Ver estadísticas'}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${diffClass}`}>{ch.image_diff || 'Medium'}</span>
                    {ch.image_theme && (
                      <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5 truncate max-w-[120px]">{ch.image_theme}</span>
                    )}
                  </div>
                  {ch.prompt_original && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{ch.prompt_original}</p>}
                  <p className="text-[11px] text-slate-400">
                    {ch.fecha ? new Date(ch.fecha).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
    )
  }

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
              {tab.icon === 'guides' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
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
          {activeTab === 'guides' && renderGuides()}
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
                {editingChallenge 
                  ? (lang === 'en' ? 'Edit challenge' : 'Editar desafío')
                  : (lang === 'en' ? 'Create custom challenge' : 'Crear desafío personalizado')
                }
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

      {/* Modal de estadísticas de desafío */}
      {challengeStatsModal && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setChallengeStatsModal(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {lang === 'en' ? 'Challenge Statistics' : 'Estadísticas del Desafío'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {challengeStatsModal.challengeName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChallengeStatsModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div className="overflow-y-auto px-5 py-4 flex-1">
              {loadingChallengeStats ? (
                <div className="flex justify-center py-12">
                  <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
                </div>
              ) : challengeStatsData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">
                    {lang === 'en' ? 'No attempts for this challenge yet.' : 'Aún no hay intentos para este desafío.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Resumen */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {lang === 'en' ? 'Total Attempts' : 'Intentos Totales'}
                      </p>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{challengeStatsData.length}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {lang === 'en' ? 'Unique Users' : 'Usuarios Únicos'}
                      </p>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {new Set(challengeStatsData.map(d => d.id_usuario)).size}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {lang === 'en' ? 'Avg Score' : 'Score Promedio'}
                      </p>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {Math.round(challengeStatsData.reduce((s, d) => s + (d.puntaje_similitud || 0), 0) / challengeStatsData.length)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {lang === 'en' ? 'Best Score' : 'Mejor Score'}
                      </p>
                      <p className="text-xl font-bold text-emerald-600">
                        {Math.max(...challengeStatsData.map(d => d.puntaje_similitud || 0))}%
                      </p>
                    </div>
                  </div>

                  {/* Lista de intentos */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {lang === 'en' ? 'All Attempts' : 'Todos los Intentos'}
                      </h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {challengeStatsData.map((attempt, idx) => {
                        const memberName = attempt.company_display_name || attempt.nombre_display || attempt.nombre || attempt.email
                        const scoreColor = (attempt.puntaje_similitud || 0) >= 70 ? 'text-emerald-600' : 
                                         (attempt.puntaje_similitud || 0) >= 50 ? 'text-amber-600' : 'text-rose-600'
                        return (
                          <div key={attempt.id_intento} className={`px-4 py-3 ${idx < challengeStatsData.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                                  {attempt.avatar_url ? (
                                    <img src={proxyImg(attempt.avatar_url)} alt={memberName} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="text-xs font-bold text-slate-500">{memberName.substring(0,2).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{memberName}</p>
                                    <span className={`text-sm font-bold ${scoreColor}`}>{attempt.puntaje_similitud || 0}%</span>
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                                    "{attempt.prompt_usuario}"
                                  </p>
                                  {attempt.strengths && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">
                                      <strong>{lang === 'en' ? 'Strengths:' : 'Fortalezas:'}</strong> {attempt.strengths}
                                    </p>
                                  )}
                                  {attempt.improvements && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      <strong>{lang === 'en' ? 'Improvements:' : 'Mejoras:'}</strong> {attempt.improvements}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs text-slate-400">
                                  {new Date(attempt.fecha_hora).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { 
                                    day: 'numeric', 
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                <button
                                  onClick={() => sendReviewMessage(memberName, `Challenge: ${challengeStatsModal.challengeName}, Score: ${attempt.puntaje_similitud}%`)}
                                  className="mt-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                                >
                                  {lang === 'en' ? 'Ask AI' : 'Preguntar IA'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de gestión de roles */}
      {roleModalOpen && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setRoleModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {lang === 'en' ? 'Manage Custom Roles' : 'Gestionar Roles Personalizados'}
              </h3>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div className="overflow-y-auto px-5 py-4 flex-1">
              {/* Crear nuevo rol */}
              <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  {lang === 'en' ? 'Create New Role' : 'Crear Nuevo Rol'}
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={newRoleForm.name}
                    onChange={e => setNewRoleForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={lang === 'en' ? 'Role name' : 'Nombre del rol'}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={newRoleForm.description}
                    onChange={e => setNewRoleForm(f => ({ ...f, description: e.target.value }))}
                    placeholder={lang === 'en' ? 'Description (optional)' : 'Descripción (opcional)'}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                  />
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newRoleForm.color}
                      onChange={e => setNewRoleForm(f => ({ ...f, color: e.target.value }))}
                      className="w-12 h-10 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <button
                      onClick={createCustomRole}
                      disabled={!newRoleForm.name.trim()}
                      className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {lang === 'en' ? 'Create' : 'Crear'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de roles existentes */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  {lang === 'en' ? 'Existing Roles' : 'Roles Existentes'}
                </h4>
                {loadingRoles ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
                  </div>
                ) : customRoles.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                    {lang === 'en' ? 'No custom roles created yet.' : 'Aún no hay roles personalizados.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customRoles.map(role => {
                      const usersWithRole = teamUsers.filter(u => u.company_role === role.role_name).length
                      return (
                        <div key={role.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full border border-slate-300"
                              style={{ backgroundColor: role.role_color }}
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {role.role_name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {role.role_description || (lang === 'en' ? 'No description' : 'Sin descripción')}
                                {usersWithRole > 0 && ` • ${usersWithRole} ${lang === 'en' ? 'member' : 'miembro'}${usersWithRole !== 1 ? 's' : ''}`}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteCustomRole(role.role_name)}
                            className="text-xs text-rose-500 hover:text-rose-700 font-medium transition"
                          >
                            {lang === 'en' ? 'Delete' : 'Eliminar'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnterprisePanel


