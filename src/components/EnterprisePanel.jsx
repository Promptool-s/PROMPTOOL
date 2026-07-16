import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useLang } from '../contexts/LangContext'
import Header from './Header'
import Footer from './Footer'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { proxyImg } from '../utils/imgProxy'
import { nowAR } from '../utils/dateAR'
import ChallengeCreatorModal from './ChallengeCreatorModal'
import { sanitizeText } from '../utils/inputSanitizer'
import GUIDE_LIBRARY from '../data/guides'
import { chatRateLimiter } from '../utils/rateLimiter'

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

const EMPTY_GUIDE_FORM = {
  type: 'catalog',
  guide_id: '',
  custom_title: '',
  custom_summary: '',
  custom_accent: 'violet',
  custom_url: '',
  custom_lesson_title: '',
  custom_lesson_blocks: [{ heading: '', body: '', bullets: [] }],
  custom_lesson_takeaway: '',
  custom_quiz_enabled: false,
  custom_quiz_question: '',
  custom_quiz_options: ['', '', '', ''],
  custom_quiz_correct: 0,
  custom_quiz_explanation: '',
  custom_steps: [''],
  custom_drills: [''],
  custom_checkpoints: [''],
  target: 'all',
  note: '',
  due_date: '',
}

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
    contentType: 'image', // image | code | document
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
    evalInstructions: '',
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

  // ── Guías asignadas ──────────────────────────────────────────────────────
  const [enterpriseGuides, setEnterpriseGuides] = useState([])
  const [guideAssignments, setGuideAssignments] = useState([])
  const [loadingGuides, setLoadingGuides] = useState(false)
  const [guideForm, setGuideForm] = useState(EMPTY_GUIDE_FORM)
  const [savingGuide, setSavingGuide] = useState(false)
  const [guideStatus, setGuideStatus] = useState(null) // null | 'ok' | 'error'
  const [guideModalOpen, setGuideModalOpen] = useState(false)
  const [memberProgress, setMemberProgress] = useState({}) // { user_id: { guide_id: { lesson_ack, quiz_passed, checkpoints } } }

  // Filtros del dashboard
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
  // Ref so outside-effect code can call fetchCompanyData without it being in scope
  const fetchCompanyDataRef = useRef(null)
  // Chatbot member autocomplete
  const [chatSuggestions, setChatSuggestions] = useState([])
  const [chatSuggestionMode, setChatSuggestionMode] = useState(null) // 'rename' | 'role' | 'remove'

  // ── Guías: fetch, crear, eliminar ────────────────────────────────────────
  // Las asignaciones se guardan en usuarios.training_config->guide_assignments (JSONB)
  // para no requerir una tabla nueva.

  const fetchGuideAssignments = async (cid) => {
    const compId = cid || companyData?.id_usuario
    if (!compId) return
    setLoadingGuides(true)
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('training_config')
        .eq('id_usuario', compId)
        .maybeSingle()
      const assignments = data?.training_config?.guide_assignments || []
      setGuideAssignments(assignments)
    } catch { /* silent */ } finally {
      setLoadingGuides(false)
    }
  }

  const fetchMemberProgress = async (memberIds) => {
    // El progreso de guías se lee de training_config->guide_progress de cada miembro
    if (!memberIds?.length) return
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('id_usuario, training_config')
        .in('id_usuario', memberIds)
      const map = {}
      ;(data || []).forEach(row => {
        const progress = row.training_config?.guide_progress || {}
        map[row.id_usuario] = progress
      })
      setMemberProgress(map)
    } catch { /* silent */ }
  }

  const saveGuideAssignment = async () => {
    if (!companyData?.id_usuario) return
    if (guideForm.type === 'catalog' && !guideForm.guide_id) {
      setGuideStatus('validation'); return
    }
    if (guideForm.type === 'custom' && !guideForm.custom_title.trim()) {
      setGuideStatus('validation'); return
    }
    setSavingGuide(true)
    setGuideStatus(null)
    try {
      // Construir objeto de guía personalizada con estructura completa
      let customGuideData = null
      if (guideForm.type === 'custom') {
        const blocks = guideForm.custom_lesson_blocks
          .filter(b => b.heading.trim() || b.body.trim() || b.bullets.some(x => x.trim()))
          .map(b => ({
            heading: b.heading.trim(),
            ...(b.body.trim() ? { body: b.body.trim() } : {}),
            ...(b.bullets.filter(x => x.trim()).length > 0 ? { bullets: b.bullets.filter(x => x.trim()) } : {}),
          }))

        const quizOptions = guideForm.custom_quiz_options.map(o => o.trim()).filter(Boolean)
        const quiz = guideForm.custom_quiz_enabled && guideForm.custom_quiz_question.trim() && quizOptions.length >= 2
          ? {
              question: guideForm.custom_quiz_question.trim(),
              options: quizOptions,
              correctIndex: Math.min(guideForm.custom_quiz_correct, quizOptions.length - 1),
              ...(guideForm.custom_quiz_explanation.trim() ? { explanation: guideForm.custom_quiz_explanation.trim() } : {}),
            }
          : undefined

        customGuideData = {
          title: guideForm.custom_title.trim(),
          ...(guideForm.custom_summary.trim() ? { summary: guideForm.custom_summary.trim() } : {}),
          accent: guideForm.custom_accent || 'violet',
          ...(guideForm.custom_url.trim() ? { custom_url: guideForm.custom_url.trim() } : {}),
          ...(blocks.length > 0 ? {
            lesson: {
              title: guideForm.custom_lesson_title.trim() || guideForm.custom_title.trim(),
              blocks,
              ...(guideForm.custom_lesson_takeaway.trim() ? { takeaway: guideForm.custom_lesson_takeaway.trim() } : {}),
              ...(quiz ? { quiz } : {}),
            }
          } : {}),
          steps: guideForm.custom_steps.filter(s => s.trim()),
          drills: guideForm.custom_drills.filter(s => s.trim()),
          checkpoints: guideForm.custom_checkpoints.filter(s => s.trim()),
        }
      }

      const newAssignment = {
        id: crypto.randomUUID(),
        guide_id: guideForm.type === 'catalog' ? guideForm.guide_id : 'custom',
        custom_title: guideForm.type === 'custom' ? guideForm.custom_title.trim() : null,
        custom_guide_data: customGuideData,
        custom_body: guideForm.type === 'custom' ? (guideForm.custom_summary.trim() || null) : null,
        custom_url: guideForm.type === 'custom' ? (guideForm.custom_url.trim() || null) : null,
        target_user_id: guideForm.target === 'all' ? null : guideForm.target,
        note: guideForm.note.trim() || null,
        due_date: guideForm.due_date || null,
        created_at: new Date().toISOString(),
      }

      const { data: current } = await supabase
        .from('usuarios')
        .select('training_config')
        .eq('id_usuario', companyData.id_usuario)
        .maybeSingle()

      const existing = current?.training_config || {}
      const updatedAssignments = [...(existing.guide_assignments || []), newAssignment]

      const { error } = await supabase
        .from('usuarios')
        .update({
          training_config: { ...existing, guide_assignments: updatedAssignments }
        })
        .eq('id_usuario', companyData.id_usuario)

      if (error) throw error

      // ── Notificaciones ───────────────────────────────────────────────────
      const guideTitle = guideForm.type === 'catalog'
        ? (GUIDE_LIBRARY.find(g => g.id === guideForm.guide_id)?.title || guideForm.guide_id)
        : guideForm.custom_title.trim()
      const companyName = companyData.company_name || (lang === 'en' ? 'Your company' : 'Tu empresa')
      const notifPayload = []
      const targets = guideForm.target === 'all' ? teamUsers : teamUsers.filter(m => m.id_usuario === guideForm.target)
      targets.forEach(m => {
        notifPayload.push({
          target_user_id: m.id_usuario,
          target_email: m.email || null,
          title: lang === 'en' ? 'New guide assigned' : 'Nueva guía asignada',
          message: lang === 'en'
            ? `${companyName} assigned you: "${guideTitle}"${guideForm.note ? ` — ${guideForm.note}` : ''}`
            : `${companyName} te asignó: "${guideTitle}"${guideForm.note ? ` — ${guideForm.note}` : ''}`,
          guide_slug: guideForm.type === 'catalog' ? `guia-${guideForm.guide_id}` : null,
          guide_url: guideForm.type === 'catalog' ? `/guides#guia-${guideForm.guide_id}` : '/guides',
        })
      })
      if (notifPayload.length > 0) {
        await supabase.from('guide_suggestions').insert(notifPayload)
      }

      setGuideAssignments(updatedAssignments)
      setGuideStatus('ok')
      setGuideForm(EMPTY_GUIDE_FORM)
      setGuideModalOpen(false)
    } catch (err) {
      setGuideStatus('db_error:' + (err?.message || 'unknown'))
    } finally {
      setSavingGuide(false)
    }
  }

  const deleteGuideAssignment = async (id) => {
    try {
      const updated = guideAssignments.filter(a => a.id !== id)
      const { data: current } = await supabase
        .from('usuarios')
        .select('training_config')
        .eq('id_usuario', companyData.id_usuario)
        .maybeSingle()
      const existing = current?.training_config || {}
      await supabase
        .from('usuarios')
        .update({ training_config: { ...existing, guide_assignments: updated } })
        .eq('id_usuario', companyData.id_usuario)
      setGuideAssignments(updated)
    } catch { /* silent */ }
  }

  // Additional guide state for assignment modal
  const [editingGuide, setEditingGuide] = useState(null)
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

        // Auto-heal: enterprise users created before company_name was required
        if (company && company.user_type === 'enterprise' && !company.company_name) {
          const fallbackName = user.user_metadata?.nombre || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Mi Empresa'
          await supabase
            .from('usuarios')
            .update({ company_name: fallbackName, nombre_display: fallbackName })
            .eq('id_usuario', user.id)
          company.company_name = fallbackName
          company.nombre_display = fallbackName
        }

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
            .select('id_imagen, url_image, image_diff, image_theme, fecha, prompt_original, challenge_description, challenge_time_limit, challenge_max_attempts, challenge_min_words, challenge_start_date, challenge_end_date, challenge_visibility, challenge_points, challenge_tags, challenge_hints, challenge_evaluation_mode, challenge_eval_instructions, challenge_content_type')
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
              .select('id_intento, id_usuario, id_imagen, puntaje_similitud, prompt_usuario, strengths, improvements, fecha_hora, modo, visualElements, styleAtmosphere, technicalDetails, clarity')
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

          // Fetch guide assignments y progreso de miembros
          await fetchGuideAssignments(company.id_usuario)
          if ((members || []).length > 0) {
            await fetchMemberProgress((members || []).map(m => m.id_usuario))
          }
        }
      } catch {
        // fetch company data failed silently
      } finally {
        setLoading(false)
      }
    }

    fetchCompanyDataRef.current = fetchCompanyData
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
    // Pass message directly to avoid stale closure issue with chatInput state
    sendChatMessage(message)
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
    const trimmedName = newRoleForm.name.trim()
    if (!trimmedName) return
    // Prevent duplicate role names (case-insensitive)
    if (customRoles.some(r => r.role_name?.toLowerCase() === trimmedName.toLowerCase())) {
      setRoleError({ userId: null, msg: lang === 'en' ? `Role "${trimmedName}" already exists.` : `El rol "${trimmedName}" ya existe.` })
      setTimeout(() => setRoleError(null), 3000)
      return
    }

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
      await Promise.all([fetchCustomRoles(), fetchCompanyDataRef.current?.()])
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

      const companyName = companyData?.company_name || user.user_metadata?.nombre_display || user.email
      const joinUrl = existingUser?.id_usuario
        ? `https://promptool.app/?join=${user.id}`
        : `https://promptool.app/?invite=${user.id}&email=${encodeURIComponent(inviteEmail.trim())}`

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const inviteRes = await fetch('/api/send-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({
            recipientEmail: inviteEmail.trim(),
            companyName,
            inviterName: companyName,
            joinUrl,
            isExistingUser: !!existingUser?.id_usuario,
          }),
        })
        if (!inviteRes.ok) {
          console.error('[send-invite] HTTP error:', inviteRes.status)
        }
      } catch (_) {}

      setInviteEmail('')
      setInviteMessage('')
      setEnterpriseActionStatus(lang === 'en' ? 'Invitation sent.' : 'Invitación enviada.')
      fetchEnterpriseRequests()
    } catch {
      setEnterpriseActionStatus(lang === 'en' ? 'Could not send invitation.' : 'No se pudo enviar la invitación.')
    }
  }

  const PLAN_LIMITS = { starter: 15, team: 50 }
  const getCurrentPlanLimit = () => {
    const count = teamUsers.length
    if (count <= 15) return PLAN_LIMITS.starter
    if (count <= 50) return PLAN_LIMITS.team
    return Infinity
  }

  const updateEnterpriseRequestStatus = async (request, status) => {
    if (!request?.id) return
    if (status === 'accepted') {
      const limit = getCurrentPlanLimit()
      if (limit !== Infinity && teamUsers.length >= limit) {
        const msg = lang === 'en'
          ? `Your current plan supports up to ${limit} members. Upgrade to accept more.`
          : `Tu plan actual soporta hasta ${limit} miembros. Actualizá el plan para aceptar más.`
        setEnterpriseActionStatus(msg)
        return
      }
    }
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
    // Capture original role BEFORE optimistic update so we can revert correctly
    const originalRole = teamUsers.find(u => u.id_usuario === userId)?.company_role ?? null
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
      // Revert to captured original role
      setTeamUsers(prev => prev.map(u => u.id_usuario === userId ? { ...u, company_role: originalRole } : u))
      setRoleError({ userId, msg: err?.message || (lang === 'en' ? 'Could not assign role.' : 'No se pudo asignar el rol.') })
      setTimeout(() => setRoleError(null), 3000)
    }
  }

  const removeMember = async (userId) => {
    // Prevent admin from removing themselves
    if (userId === user?.id) return
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
      // Sanitize: strip HTML-injectable chars, cap length at 60
      const newName = editingName.value.trim().slice(0, 60).replace(/[<>"'`]/g, '')
      if (!newName) return
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
      contentType: 'image',
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
      evalInstructions: '',
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
      contentType: challenge.challenge_content_type || 'image',
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
      evalInstructions: challenge.challenge_eval_instructions || '',
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
        ? 'Complete content, prompt and theme.'
        : 'Completa el contenido, prompt y temática.')
      return
    }

    setCreatingChallenge(true)
    const uploadLabel = challengeForm.contentType === 'image'
      ? (lang === 'en' ? 'Uploading image...' : 'Subiendo imagen...')
      : (lang === 'en' ? 'Uploading file...' : 'Subiendo archivo...')
    setChallengeStatus(uploadLabel)
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
        challenge_eval_instructions: challengeForm.evalInstructions.trim() || null,
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
        challenge_eval_instructions: challengeForm.evalInstructions.trim() || null,
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

      // Create notifications for assigned members
      const notifications = selectedMembersForAssignment.map(memberId => ({
        target_user_id: memberId,
        target_email: null,
        title: lang === 'en' ? 'New Guide Assigned' : 'Nueva Guía Asignada',
        message: lang === 'en' 
          ? `You have been assigned the guide "${selectedGuideForAssignment.title}". ${assignmentNotes.trim() ? `Note: ${assignmentNotes.trim()}` : ''}`
          : `Se te ha asignado la guía "${selectedGuideForAssignment.title}". ${assignmentNotes.trim() ? `Nota: ${assignmentNotes.trim()}` : ''}`,
        guide_slug: null,
        guide_url: `/guides?enterprise_guide=${selectedGuideForAssignment.id}`,
        created_at: new Date().toISOString()
      }))

      // Insert notifications
      try {
        await supabase.from('guide_suggestions').insert(notifications)
      } catch (notifError) {
        console.warn('Could not create notifications:', notifError)
        // Don't fail the assignment if notifications fail
      }

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

    const uiLang = lang === 'en' ? 'English' : 'Spanish (español rioplatense)'
    const offTopicMsg = lang === 'en'
      ? 'I focus on team analytics only. Ask me about member performance, scores, or management actions.'
      : 'Me enfoco solo en el análisis del equipo. Preguntame sobre rendimiento, scores o acciones de gestión.'

    return `You are a focused team analytics assistant for ${companyName} on a prompt engineering training platform. You provide data-driven insights and execute management actions ONLY.

LANGUAGE: Always respond in ${uiLang}. Never switch languages regardless of what the user writes.

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
- Create role: <action>{"action":"create_role","roleName":"<role name>","description":"<optional description>","color":"<hex color>"}</action>
- Delete role: <action>{"action":"delete_role","roleName":"<exact role name>"}</action>

AVAILABLE ROLES:
${customRoles.map(r => `- ${r.role_name}: ${r.role_description || 'Custom role'} (color: ${r.role_color})`).join('\n')}
${customRoles.length === 0 ? '- No custom roles defined yet' : ''}

ROLE MANAGEMENT RULES:
- You CAN create new roles with any name (avoid duplicates)
- You CAN delete existing custom roles (this removes them from all members)
- You CAN assign any role name (if it doesn't exist, it will be created automatically)
- Default colors: #8b5cf6 (purple), #3b82f6 (blue), #f59e0b (amber), #ef4444 (red), #10b981 (emerald)
- When creating roles, suggest appropriate colors based on the role type

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
- Filtered Users: ${dashboardFilters.selectedMember === 'all' ? teamUsers.length : teamUsers.filter(u => u.id_usuario === dashboardFilters.selectedMember).length}
- Filtered Attempts: ${Object.values(challengeAttempts).flat().filter(a => teamUsers.some(u => u.id_usuario === a.id_usuario)).length}
- Challenge-specific attempts: ${dashboardFilters.selectedChallenge !== 'all' ? (challengeAttempts[dashboardFilters.selectedChallenge] || []).length : 'N/A'}

RESPONSE RULES:
- Be direct and factual
- No emojis or decorative symbols
- Focus on actionable insights
- If asked about forbidden topics, say: "${offTopicMsg}"
- Keep responses concise and data-focused`
  }

  const sendChatMessage = async (messageOverride = null) => {
    const raw = (messageOverride !== null ? messageOverride : chatInput).trim()
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
          // Remove action block from content but keep the descriptive text
          const cleanContent = assistantContent.replace(/<action>[\s\S]*?<\/action>/, '').trim()
          
          // Only add the message if there's actual content (not just whitespace)
          if (cleanContent && cleanContent.length > 0) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: cleanContent }])
          }

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
              const customRoleNames = customRoles.map(r => (r.role_name || '').toLowerCase())
              const builtInRoles = ['manager', 'analyst', 'trainee', 'observer', '']
              const requestedRole = String(actionData.role ?? '').trim()
              const isValidRole = builtInRoles.includes(requestedRole.toLowerCase()) ||
                customRoleNames.includes(requestedRole.toLowerCase())
              const role = isValidRole ? requestedRole : null
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
          } else if (actionData.action === 'create_role' && actionData.roleName) {
            // Create new custom role
            try {
              const { error } = await supabase.rpc('create_custom_role', {
                role_name: actionData.roleName.trim(),
                role_description: actionData.description?.trim() || null,
                role_color: actionData.color || '#6b7280'
              })
              
              if (error) throw error
              
              // Refresh custom roles
              await fetchCustomRoles()
              
              // Add success message to chat
              setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: lang === 'en' 
                  ? `Role "${actionData.roleName}" created successfully.`
                  : `Rol "${actionData.roleName}" creado correctamente.`
              }])
            } catch (error) {
              setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: lang === 'en' 
                  ? `Could not create role: ${error.message}`
                  : `No se pudo crear el rol: ${error.message}`
              }])
            }
          } else if (actionData.action === 'delete_role' && actionData.roleName) {
            // Delete custom role
            try {
              const { error } = await supabase.rpc('delete_custom_role', {
                role_name: actionData.roleName.trim()
              })
              
              if (error) throw error
              
              // Refresh custom roles and team users
              await Promise.all([fetchCustomRoles(), fetchCompanyDataRef.current?.()])
              
              // Add success message to chat
              setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: lang === 'en' 
                  ? `Role "${actionData.roleName}" deleted successfully.`
                  : `Rol "${actionData.roleName}" eliminado correctamente.`
              }])
            } catch (error) {
              setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: lang === 'en' 
                  ? `Could not delete role: ${error.message}`
                  : `No se pudo eliminar el rol: ${error.message}`
              }])
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
      icon: 'requests',
      badge: enterpriseRequests.filter(r => r.status === 'requested').length || null,
    },
    { id: 'challenges', label: lang === 'en' ? 'Challenges' : 'Desafíos', icon: 'challenges' },
    { id: 'subscription', label: lang === 'en' ? 'Plan' : 'Plan', icon: 'subscription' },
  ]

  const renderDashboard = () => {
    // ── Filters ──
    const filteredUsers = dashboardFilters.selectedMember === 'all'
      ? teamUsers
      : teamUsers.filter(u => u.id_usuario === dashboardFilters.selectedMember)

    // Filtrar intentos por desafío específico si está seleccionado
    const timeCutoff = dashboardFilters.timeRange !== 'all'
      ? new Date(Date.now() - parseInt(dashboardFilters.timeRange, 10) * 86400000).toISOString()
      : null

    const filteredAttempts = (() => {
      const base = dashboardFilters.selectedChallenge === 'all'
        ? Object.values(challengeAttempts).flat()
        : (challengeAttempts[dashboardFilters.selectedChallenge] || [])
      return timeCutoff ? base.filter(a => a.fecha_hora && a.fecha_hora >= timeCutoff) : base
    })()

    // Filtrar intentos por miembros seleccionados
    const memberFilteredAttempts = filteredAttempts.filter(a =>
      filteredUsers.some(u => u.id_usuario === a.id_usuario)
    )

    // ── KPI calculations ──
    // When a time cutoff OR a specific challenge is selected, compute KPIs from attempt data
    // rather than the all-time DB columns (promedio_score, total_intentos, etc.)
    const memberCount = filteredUsers.length
    const usingTimeFilter = !!timeCutoff  // keep for backward compat references
    const usingAttemptData = !!timeCutoff || dashboardFilters.selectedChallenge !== 'all'

    // Build per-user stats from filtered attempts when time/challenge filter is active
    const userAttemptStats = usingAttemptData
      ? filteredUsers.reduce((acc, u) => {
          const userAttempts = memberFilteredAttempts.filter(a => a.id_usuario === u.id_usuario)
          acc[u.id_usuario] = {
            count: userAttempts.length,
            avgScore: userAttempts.length > 0
              ? Math.round(userAttempts.reduce((s, a) => s + (a.puntaje_similitud || 0), 0) / userAttempts.length)
              : 0,
          }
          return acc
        }, {})
      : null

    const activeMembers = usingAttemptData
      ? filteredUsers.filter(u => (userAttemptStats[u.id_usuario]?.count || 0) > 0).length
      : filteredUsers.filter(u => (u.total_intentos || 0) > 0).length
    const inactiveMembers = memberCount - activeMembers

    const avgScore = memberCount > 0
      ? usingAttemptData
        ? (() => {
            const active = filteredUsers.filter(u => (userAttemptStats[u.id_usuario]?.count || 0) > 0)
            return active.length > 0
              ? Math.round(active.reduce((s, u) => s + (userAttemptStats[u.id_usuario]?.avgScore || 0), 0) / active.length)
              : 0
          })()
        : Math.round(filteredUsers.reduce((s, u) => s + (u.promedio_score || 0), 0) / memberCount)
      : 0

    const avgElo = memberCount > 0
      ? Math.round(filteredUsers.reduce((s, u) => s + (u.elo_rating || 1000), 0) / memberCount)
      : 1000

    const totalAttempts = usingAttemptData
      ? memberFilteredAttempts.length
      : filteredUsers.reduce((s, u) => s + (u.total_intentos || 0), 0)
    const participationRate = memberCount > 0 ? Math.round((activeMembers / memberCount) * 100) : 0

    // Recruiter-specific stats
    const topElo = filteredUsers.length > 0 ? Math.max(...filteredUsers.map(u => u.elo_rating || 1000)) : 0

    // When attempt-level data is active, derive per-user score metrics from filtered attempts
    // (covers both time-range filter and specific-challenge filter)
    const getUserFilteredScore = (userId) => {
      if (usingAttemptData && userAttemptStats?.[userId]) {
        return userAttemptStats[userId].avgScore
      }
      const attempts = memberFilteredAttempts.filter(a => a.id_usuario === userId)
      if (attempts.length === 0) return null
      return Math.round(attempts.reduce((s, a) => s + (a.puntaje_similitud || 0), 0) / attempts.length)
    }
    const getUserApproval = (userId) => {
      if (!usingAttemptData) return (filteredUsers.find(u => u.id_usuario === userId)?.porcentaje_aprobacion || 0)
      const attempts = memberFilteredAttempts.filter(a => a.id_usuario === userId)
      if (attempts.length === 0) return 0
      const passing = attempts.filter(a => (a.puntaje_similitud || 0) >= 50).length
      return Math.round((passing / attempts.length) * 100)
    }

    const consistentMembers = filteredUsers.filter(u => getUserApproval(u.id_usuario) >= 70).length
    const highPerformers = filteredUsers.filter(u => {
      const sc = usingAttemptData
        ? getUserFilteredScore(u.id_usuario)
        : (u.promedio_score || 0)
      return (sc ?? 0) >= 70
    }).length
    const avgApproval = memberCount > 0
      ? Math.round(filteredUsers.reduce((s, u) => s + getUserApproval(u.id_usuario), 0) / memberCount)
      : 0

    // Score distribution — use attempt-level data when filter is active
    const getEffectiveScore = (u) => usingAttemptData
      ? (getUserFilteredScore(u.id_usuario) ?? 0)
      : (u.promedio_score || 0)
    const scoreDist = [
      { name: lang === 'en' ? 'High ≥70%' : 'Alto ≥70%', value: filteredUsers.filter(u => getEffectiveScore(u) >= 70).length, color: '#10b981' },
      { name: lang === 'en' ? 'Mid 50–69%' : 'Medio 50–69%', value: filteredUsers.filter(u => getEffectiveScore(u) >= 50 && getEffectiveScore(u) < 70).length, color: '#f59e0b' },
      { name: lang === 'en' ? 'Low <50%' : 'Bajo <50%', value: filteredUsers.filter(u => getEffectiveScore(u) > 0 && getEffectiveScore(u) < 50).length, color: '#ef4444' },
      { name: lang === 'en' ? 'No data' : 'Sin datos', value: filteredUsers.filter(u => getEffectiveScore(u) === 0).length, color: '#cbd5e1' },
    ].filter(d => d.value > 0)

    // Challenge participation — respect timeCutoff
    const challengeParticipation = challenges.slice(0, 6).map((ch, chIdx) => {
      const attempts = (challengeAttempts[ch.id_imagen] || []).filter(a =>
        filteredUsers.some(u => u.id_usuario === a.id_usuario) &&
        (!timeCutoff || (a.fecha_hora && a.fecha_hora >= timeCutoff))
      )
      const uniqueUsers = new Set(attempts.map(a => a.id_usuario)).size
      const avgCh = attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + (a.puntaje_similitud || 0), 0) / attempts.length)
        : 0
      return {
        id: ch.id_imagen,  // use stable id for React keys
        name: ch.image_theme || `#${ch.id_imagen.slice(0, 4)}`,
        participants: uniqueUsers,
        avgScore: avgCh,
      }
    })

    // Weekly activity — derived from memberFilteredAttempts so it responds to all filters
    const weeklyMap = {}
    memberFilteredAttempts.forEach(a => {
      if (!a.fecha_hora) return
      const day = a.fecha_hora.slice(0, 10) // YYYY-MM-DD
      if (!weeklyMap[day]) weeklyMap[day] = { scores: [], count: 0 }
      weeklyMap[day].count++
      weeklyMap[day].scores.push(a.puntaje_similitud || 0)
    })
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d.toISOString().slice(0, 10)
    })
    const weeklyData = last7Days.map(day => {
      const entry = weeklyMap[day]
      const scores = entry?.scores || []
      return {
        label: new Date(day + 'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'es-AR', { weekday: 'short' }),
        intentos: entry?.count || 0,
        score: scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
      }
    })

    // Top 5 by ELO (filtered)
    const top5 = [...filteredUsers]
      .sort((a, b) => (b.elo_rating || 1000) - (a.elo_rating || 1000))
      .slice(0, 5)

    // Needs coaching (respects active filters)
    const needsAttention = [...filteredUsers]
      .filter(u => {
        const attempts = usingAttemptData
          ? (userAttemptStats?.[u.id_usuario]?.count || 0)
          : (u.total_intentos || 0)
        const score = usingAttemptData
          ? (getUserFilteredScore(u.id_usuario) ?? 100)
          : (u.promedio_score || 0)
        return attempts > 0 && score < 55
      })
      .map(u => ({
        ...u,
        _filteredScore: usingAttemptData ? (getUserFilteredScore(u.id_usuario) ?? 0) : (u.promedio_score || 0),
      }))
      .sort((a, b) => a._filteredScore - b._filteredScore)
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
        ? needsAttention.map(u => `${u.company_display_name || u.nombre_display || u.nombre || u.email} (${u._filteredScore ?? u.promedio_score ?? 0}%)`).join(' · ')
        : needsAttention.map(u => `${u.company_display_name || u.nombre_display || u.nombre || u.email} (${u._filteredScore ?? u.promedio_score ?? 0}%)`).join(' · '),
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
    const belowTarget = usingAttemptData
      ? filteredUsers.filter(u => (userAttemptStats?.[u.id_usuario]?.count || 0) > 0 && (getUserFilteredScore(u.id_usuario) ?? 100) < 70).length
      : filteredUsers.filter(u => (u.total_intentos||0) > 0 && (u.promedio_score||0) < 70).length
    const belowTargetPct = activeMembers > 0 ? Math.round(belowTarget / activeMembers * 100) : 0

    return (
    <div className="flex flex-col xl:flex-row gap-6 items-start">
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
              <option value="all">{lang === 'en' ? 'All time' : 'Todo el tiempo'}</option>
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

        {/* ── ZONE 1: KPI strip — 6 cards with context ── */}
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          {lang === 'en'
            ? 'Score, participation and ELO are based on all-time data. Activity and trend charts reflect the selected period.'
            : 'Score, participación y ELO son datos históricos totales. Actividad y gráficos de tendencia reflejan el periodo seleccionado.'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Score vs target */}
          <div className={`rounded-xl border p-4 ${avgScore >= 70 ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20' : avgScore >= 50 ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{lang === 'en' ? 'Avg Score' : 'Score Prom.'}</p>
            <p className={`text-2xl font-bold tabular-nums ${avgScore >= 70 ? 'text-emerald-600' : avgScore >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{avgScore}%</p>
            <p className="text-[10px] text-slate-500 mt-1">{lang === 'en' ? 'Target: 70% · all-time' : 'Objetivo: 70% · historico'}</p>
            <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(avgScore, 100)}%`, backgroundColor: avgScore >= 70 ? '#10b981' : avgScore >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>
          {/* Participation */}
          <div className={`rounded-xl border p-4 ${participationRate >= 70 ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20' : participationRate >= 40 ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{usingAttemptData ? (lang === 'en' ? 'Active in period' : 'Activos en período') : (lang === 'en' ? 'Ever Active' : 'Jugaron alguna vez')}</p>
            <p className={`text-2xl font-bold tabular-nums ${participationRate >= 70 ? 'text-emerald-600' : participationRate >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{participationRate}%</p>
            <p className="text-[10px] text-slate-500 mt-1">{activeMembers}/{memberCount} {lang === 'en' ? 'have played' : 'han jugado'}</p>
            <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${participationRate}%`, backgroundColor: participationRate >= 70 ? '#10b981' : participationRate >= 40 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>
          {/* Improving */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{lang === 'en' ? 'Improving' : 'Mejorando'}</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{improvingCount}</p>
            <p className="text-[10px] text-slate-500 mt-1">{lang === 'en' ? 'vs. prior attempt' : 'vs. intento anterior'}</p>
          </div>
          {/* Below target */}
          <div className={`rounded-xl border p-4 ${belowTarget > 0 ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{lang === 'en' ? 'Below target' : 'Bajo objetivo'}</p>
            <p className={`text-2xl font-bold tabular-nums ${belowTarget > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{belowTargetPct}%</p>
            <p className="text-[10px] text-slate-500 mt-1">{belowTarget} {lang === 'en' ? `member${belowTarget !== 1 ? 's' : ''} <70%` : `miembro${belowTarget !== 1 ? 's' : ''} <70%`}</p>
          </div>
          {/* ELO */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">ELO {lang === 'en' ? 'Avg' : 'Prom.'}</p>
            <p className="text-2xl font-bold tabular-nums text-violet-600">{avgElo}</p>
            <p className="text-[10px] text-slate-500 mt-1">{lang === 'en' ? `Top: ${topElo}` : `Top: ${topElo}`}</p>
          </div>
          {/* Avg approval rate */}
          <div className={`rounded-xl border p-4 ${avgApproval >= 70 ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{lang === 'en' ? 'Pass rate' : 'Tasa de aprobación'}</p>
            <p className={`text-2xl font-bold tabular-nums ${avgApproval >= 70 ? 'text-emerald-600' : avgApproval >= 50 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}`}>{avgApproval}%</p>
            <p className="text-[10px] text-slate-500 mt-1">{consistentMembers} {lang === 'en' ? `member${consistentMembers !== 1 ? 's' : ''} ≥70%` : `miembro${consistentMembers !== 1 ? 's' : ''} ≥70%`}</p>
          </div>
        </div>

        {/* ── ZONE 2: Actionable insights feed ── */}
        {insights.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                {lang === 'en' ? 'Insights & Actions' : 'Insights y Acciones'}
              </p>
              <span className="text-[10px] text-slate-400">{insights.length} {lang === 'en' ? 'signals' : 'señales'}</span>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {insights.map((ins, i) => {
                const isWarn = ins.type === 'warning'
                const isRec  = ins.type === 'recommendation'
                const dotColor = isWarn ? 'bg-rose-500' : isRec ? 'bg-amber-400' : 'bg-emerald-500'
                const titleColor = isWarn ? 'text-rose-700 dark:text-rose-400' : isRec ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                const action = isWarn
                  ? (lang === 'en' ? '→ Act now' : '→ Actuar')
                  : isRec
                    ? (lang === 'en' ? '→ Review' : '→ Revisar')
                    : null
                return (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
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

        {/* ── ZONE 2.5: Full member breakdown table ── */}
        {filteredUsers.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {lang === 'en' ? 'Member Breakdown' : 'Detalle por miembro'}
              </p>
              <span className="text-[10px] text-slate-400">{lang === 'en' ? 'All-time · click to view profile' : 'Historico · clic para ver perfil'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-slate-800">
                    <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-44">{lang === 'en' ? 'Member' : 'Miembro'}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">ELO</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Avg score' : 'Score'}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Pass rate' : 'Aprobación'}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Attempts' : 'Intentos'}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Streak' : 'Racha'}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Trend' : 'Tendencia'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {[...filteredUsers].sort((a, b) => (b.elo_rating || 1000) - (a.elo_rating || 1000)).map(u => {
                    const name = u.company_display_name || u.nombre_display || u.nombre || u.email
                    const profileHref = u.username ? `/user/${u.username}` : `/perfil?id=${u.id_usuario}`
                    const trend = memberTrends.find(t => t.name === name)
                    const hasAttempts = (u.total_intentos || 0) > 0
                    const score = u.promedio_score ?? null
                    const approval = u.porcentaje_aprobacion ?? null
                    return (
                      <tr key={u.id_usuario} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <a href={profileHref} className="flex items-center gap-2 group">
                            <div className="h-6 w-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                              {u.avatar_url
                                ? <img src={u.avatar_url} alt={name} className="h-full w-full object-cover" />
                                : <span className="text-[9px] font-bold text-slate-500">{name.substring(0,2).toUpperCase()}</span>}
                            </div>
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[110px] group-hover:text-violet-600 transition-colors">{name}</span>
                          </a>
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-violet-600 tabular-nums">{u.elo_rating || 1000}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {hasAttempts && score !== null
                            ? <span className={`font-semibold ${score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-rose-500'}`}>{score}%</span>
                            : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {hasAttempts && approval !== null
                            ? <span className={`font-semibold ${approval >= 70 ? 'text-emerald-600' : 'text-amber-500'}`}>{approval}%</span>
                            : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-400 tabular-nums">{u.total_intentos || 0}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {(u.racha_actual || 0) > 0
                            ? <span className="text-amber-600 font-semibold">{u.racha_actual}d</span>
                            : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {trend
                            ? <span className={`font-bold text-[11px] ${trend.delta > 0 ? 'text-emerald-600' : trend.delta < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                {trend.delta > 0 ? `+${trend.delta}` : trend.delta === 0 ? '=' : trend.delta}
                              </span>
                            : <span className="text-slate-300 dark:text-slate-600 text-[11px]">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
                          <p className={`font-medium mt-0.5 ${d.avg >= 70 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {d.avg >= 70
                              ? <span className="inline-flex items-center gap-1"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>{lang === 'en' ? 'On target' : 'En objetivo'}</span>
                              : `${70 - d.avg}pts ${lang === 'en' ? 'below target' : 'bajo objetivo'}`}
                          </p>
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
          <div className={`grid gap-4 ${visibleCharts.topPerformers && visibleCharts.needsCoaching ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {visibleCharts.topPerformers && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    {lang === 'en' ? 'Top Performers' : 'Mejores'}
                  </p>
                  <button onClick={() => setActiveTab('leaderboard')} className="text-[10px] text-violet-500 hover:text-violet-700 font-medium">{lang === 'en' ? 'Full ranking →' : 'Ranking completo →'}</button>
                </div>
                {top5.length === 0
                  ? <p className="text-xs text-slate-400 px-4 py-6 text-center">{lang === 'en' ? 'No data yet' : 'Sin datos aún'}</p>
                  : <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {top5.map((u, idx) => {
                        const name = u.company_display_name || u.nombre_display || u.nombre || u.email
                        const profileHref = u.username ? `/user/${u.username}` : `/perfil?id=${u.id_usuario}`
                        const medalColors = ['text-amber-400', 'text-slate-400', 'text-amber-700']
                        const medal = idx < 3
                          ? <svg className={`h-4 w-4 shrink-0 ${medalColors[idx]}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          : null
                        const trend = memberTrends.find(t => t.name === name)
                        return (
                          <a key={u.id_usuario} href={profileHref} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <span className="w-5 shrink-0 flex items-center justify-center">{medal || <span className="text-xs font-bold text-slate-300">{idx+1}</span>}</span>
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
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                    {lang==='en'?'At Risk':'En Riesgo'}
                  </p>
                  {belowTarget>0&&<span className="text-[10px] font-semibold text-rose-600 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">{belowTargetPct}% {lang==='en'?'below target':'bajo objetivo'}</span>}
                </div>
                {needsAttention.length===0&&inactiveMembers===0
                  ? <p className="text-xs text-emerald-600 font-medium px-4 py-6 text-center flex items-center justify-center gap-1.5">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                      {lang==='en'?'All active members above 55%':'Todos los activos sobre 55%'}
                    </p>
                  : <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {needsAttention.map(u => {
                        const name = u.company_display_name||u.nombre_display||u.nombre||u.email
                        const profileHref = u.username?`/user/${u.username}`:`/perfil?id=${u.id_usuario}`
                        const trend = memberTrends.find(t=>t.name===name)
                        const displayScore = u._filteredScore ?? u.promedio_score ?? 0
                        const gap = 70 - displayScore
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
                              <p className="text-xs font-bold text-rose-500">{displayScore}%</p>
                              <div className="flex items-center gap-1 mt-1">
                                {trend&&trend.delta!==0&&<span className={`text-[9px] font-bold ${trend.delta>0?'text-emerald-500':'text-rose-500'}`}>{trend.delta>0?`+${trend.delta}`:trend.delta}</span>}
                                <button
                                  onClick={() => sendReviewMessage(name, `Low performance: ${u._filteredScore ?? u.promedio_score ?? 0}% average score`)}
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
                          <svg className="h-4 w-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">{inactiveMembers} {usingAttemptData ? (lang==='en'?`member${inactiveMembers>1?'s':''} no activity in period`:`miembro${inactiveMembers>1?'s':''} sin actividad en el período`) : (lang==='en'?`member${inactiveMembers>1?'s':''} never attempted`:`miembro${inactiveMembers>1?'s':''} sin intentos`)}</p>
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
          <div className={`grid gap-4 grid-cols-1 ${[visibleCharts.distribution&&scoreDist.length>0, visibleCharts.weeklyActivity, visibleCharts.challengeParticipation&&challengeParticipation.length>0].filter(Boolean).length >= 3 ? 'md:grid-cols-3' : [visibleCharts.distribution&&scoreDist.length>0, visibleCharts.weeklyActivity, visibleCharts.challengeParticipation&&challengeParticipation.length>0].filter(Boolean).length === 2 ? 'md:grid-cols-2' : ''}`}>
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
                      <div key={ch.id || ch.name}>
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
      <div className="w-full xl:w-96 shrink-0 xl:sticky xl:top-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col" style={{ height: '560px' }}>
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
                  lang === 'en' ? 'Create role "Team Lead"' : 'Crear rol "Team Lead"',
                  lang === 'en' ? 'Delete role "Observer"' : 'Eliminar rol "Observer"',
                  lang === 'en' ? 'Show team performance summary' : 'Mostrar resumen del equipo',
                  lang === 'en' ? 'Assign role "Manager" to @' : 'Asignar rol "Manager" a @',
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

            {chatMessages.map((msg, idx) => {
              const displayContent = msg.content.replace(/<action>[\s\S]*?<\/action>/g, '').trim()
              if (!displayContent) return null
              return (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                  }`}>
                    {displayContent}
                  </div>
                </div>
              )
            })}

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
      { id: 'approval', label: lang === 'en' ? 'Approval' : 'Aprobación',  get: u => u.porcentaje_aprobacion || 0, fmt: v => `${v}%` },
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
                              {savingName ? '…' : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>}
                              </button>
                              <button onClick={() => setEditingName(null)} className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] text-slate-500">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
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

  const renderGuides = () => {
    const ACCENT_COLORS = {
      indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
      violet: 'bg-violet-50 border-violet-200 text-violet-700',
      amber: 'bg-amber-50 border-amber-200 text-amber-700',
      rose: 'bg-rose-50 border-rose-200 text-rose-700',
      emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      fuchsia: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700',
      orange: 'bg-orange-50 border-orange-200 text-orange-700',
      red: 'bg-red-50 border-red-200 text-red-700',
      blue: 'bg-blue-50 border-blue-200 text-blue-700',
      lime: 'bg-lime-50 border-lime-200 text-lime-700',
    }

    // Agrupar asignaciones: globales (target_user_id=null) y por usuario
    const globalAssignments = guideAssignments.filter(a => !a.target_user_id)
    const userAssignments = guideAssignments.filter(a => !!a.target_user_id)

    // Calcular progreso por guía
    const getProgressForGuide = (guideId) => {
      const total = teamUsers.length
      if (!total) return { done: 0, total: 0, pct: 0 }
      let done = 0
      teamUsers.forEach(m => {
        const p = memberProgress[m.id_usuario]?.[guideId]
        if (p?.lesson_ack) done++
      })
      return { done, total, pct: Math.round((done / total) * 100) }
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {lang === 'en' ? 'Guide Assignments' : 'Asignación de Guías'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'en'
                ? 'Assign learning guides from the catalog or create custom ones for your team.'
                : 'Asigná guías del catálogo o creá guías personalizadas para tu equipo.'}
            </p>
          </div>
          <button
            onClick={() => { setGuideForm({ type: 'catalog', guide_id: '', custom_title: '', custom_body: '', custom_url: '', target: 'all', note: '', due_date: '' }); setGuideStatus(null); setGuideModalOpen(true) }}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {lang === 'en' ? 'Assign guide' : 'Asignar guía'}
          </button>
        </div>

        {loadingGuides ? (
          <div className="py-12 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600 mx-auto" />
          </div>
        ) : guideAssignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
            <svg className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {lang === 'en' ? 'No guides assigned yet.' : 'Todavía no hay guías asignadas.'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {lang === 'en' ? 'Click "Assign guide" to get started.' : 'Hacé clic en "Asignar guía" para empezar.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Asignaciones globales (para todo el equipo) */}
            {globalAssignments.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                  {lang === 'en' ? 'For the whole team' : 'Para todo el equipo'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {globalAssignments.map(a => {
                    const catalogGuide = GUIDE_LIBRARY.find(g => g.id === a.guide_id)
                    const isCustom = a.guide_id === 'custom'
                    const title = isCustom ? a.custom_title : catalogGuide?.title
                    const accent = catalogGuide?.accent || 'violet'
                    const accentCls = ACCENT_COLORS[accent] || ACCENT_COLORS.violet
                    const progress = catalogGuide ? getProgressForGuide(a.guide_id) : null

                    return (
                      <div key={a.id} className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
                        {/* Badge tipo */}
                        <div className="flex items-start justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${isCustom ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400' : accentCls}`}>
                            {isCustom ? (lang === 'en' ? 'Custom' : 'Personalizada') : (lang === 'en' ? 'Catalog' : 'Catálogo')}
                          </span>
                          <button
                            onClick={() => deleteGuideAssignment(a.id)}
                            className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition"
                            title={lang === 'en' ? 'Remove' : 'Eliminar'}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{title}</p>
                          {catalogGuide && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{catalogGuide.summary}</p>}
                          {isCustom && a.custom_body && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{a.custom_body}</p>}
                          {a.custom_url && (
                            <a href={a.custom_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              {lang === 'en' ? 'Open link' : 'Abrir enlace'}
                            </a>
                          )}
                        </div>

                        {a.note && (
                          <p className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 italic">
                            "{a.note}"
                          </p>
                        )}

                        {a.due_date && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {lang === 'en' ? 'Due' : 'Vence'}: {new Date(a.due_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}

                        {/* Barra de progreso del equipo */}
                        {progress && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">{lang === 'en' ? 'Team progress' : 'Progreso del equipo'}</span>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{progress.done}/{progress.total}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                                style={{ width: `${progress.pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Asignaciones individuales */}
            {userAssignments.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                  {lang === 'en' ? 'Individual assignments' : 'Asignaciones individuales'}
                </p>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Member' : 'Miembro'}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Guide' : 'Guía'}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Progress' : 'Progreso'}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{lang === 'en' ? 'Due' : 'Vence'}</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {userAssignments.map(a => {
                        const member = teamUsers.find(m => m.id_usuario === a.target_user_id)
                        const catalogGuide = GUIDE_LIBRARY.find(g => g.id === a.guide_id)
                        const isCustom = a.guide_id === 'custom'
                        const title = isCustom ? a.custom_title : catalogGuide?.title
                        const progress = memberProgress[a.target_user_id]?.[a.guide_id]
                        const memberName = member?.company_display_name || member?.nombre_display || member?.nombre || member?.username || a.target_user_id?.slice(0, 8)

                        return (
                          <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {member?.avatar_url
                                  ? <img src={proxyImg(member.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover" />
                                  : <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-[10px] font-bold text-violet-600">{memberName?.slice(0,2).toUpperCase()}</div>
                                }
                                <span className="font-medium text-slate-700 dark:text-slate-200 text-xs">{memberName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-1">{title}</p>
                              {isCustom && <span className="text-[10px] text-amber-600 dark:text-amber-400">{lang === 'en' ? 'Custom' : 'Personalizada'}</span>}
                            </td>
                            <td className="px-4 py-3">
                              {progress?.lesson_ack ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                                  {lang === 'en' ? 'Read' : 'Leída'}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">{lang === 'en' ? 'Pending' : 'Pendiente'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[11px] text-slate-400 dark:text-slate-500">
                              {a.due_date ? new Date(a.due_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' }) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => deleteGuideAssignment(a.id)}
                                className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal asignar guía */}
        {guideModalOpen && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setGuideModalOpen(false)}>
            <div className={`w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl ${guideForm.type === 'custom' ? 'max-w-2xl' : 'max-w-lg'}`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {lang === 'en' ? 'Assign a guide' : 'Asignar una guía'}
                </h3>
                <button onClick={() => setGuideModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Tipo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
                    {lang === 'en' ? 'Guide type' : 'Tipo de guía'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'catalog', label: lang === 'en' ? 'From catalog' : 'Del catálogo', svg: <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg> },
                      { value: 'custom', label: lang === 'en' ? 'Custom' : 'Personalizada', svg: <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setGuideForm(f => ({ ...EMPTY_GUIDE_FORM, type: opt.value, target: f.target, note: f.note, due_date: f.due_date }))}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition text-left ${
                          guideForm.type === opt.value
                            ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {opt.svg}{opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catálogo */}
                {guideForm.type === 'catalog' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
                      {lang === 'en' ? 'Select guide' : 'Seleccionar guía'}
                    </label>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {GUIDE_LIBRARY.map(g => (
                        <button
                          key={g.id}
                          onClick={() => setGuideForm(f => ({ ...f, guide_id: g.id }))}
                          className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                            guideForm.guide_id === g.id
                              ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30'
                              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{g.title}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{g.summary}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personalizada — editor completo */}
                {guideForm.type === 'custom' && (
                  <div className="space-y-5">

                    {/* ── Identidad ── */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Identity' : 'Identidad'}</p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{lang === 'en' ? 'Title *' : 'Título *'}</label>
                        <input type="text" value={guideForm.custom_title}
                          onChange={e => setGuideForm(f => ({ ...f, custom_title: e.target.value }))}
                          placeholder={lang === 'en' ? 'e.g. Brand voice guidelines' : 'Ej: Guía de tono de marca'}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{lang === 'en' ? 'Summary (shown in sidebar)' : 'Resumen (visible en el sidebar)'}</label>
                        <input type="text" value={guideForm.custom_summary}
                          onChange={e => setGuideForm(f => ({ ...f, custom_summary: e.target.value }))}
                          placeholder={lang === 'en' ? 'One-line description of this guide' : 'Descripción breve de la guía'}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{lang === 'en' ? 'Color accent' : 'Color de acento'}</label>
                        <div className="flex flex-wrap gap-2">
                          {['violet','indigo','cyan','emerald','amber','rose','orange','fuchsia','blue','teal'].map(c => {
                            const cls = { violet:'bg-violet-500', indigo:'bg-indigo-500', cyan:'bg-cyan-500', emerald:'bg-emerald-500', amber:'bg-amber-500', rose:'bg-rose-500', orange:'bg-orange-500', fuchsia:'bg-fuchsia-500', blue:'bg-blue-500', teal:'bg-teal-500' }
                            return (
                              <button key={c} type="button" onClick={() => setGuideForm(f => ({ ...f, custom_accent: c }))}
                                className={`h-7 w-7 rounded-full ${cls[c]} transition ring-offset-2 ${guideForm.custom_accent === c ? 'ring-2 ring-slate-700 dark:ring-slate-200' : 'opacity-60 hover:opacity-100'}`}
                                title={c} />
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{lang === 'en' ? 'External link (optional)' : 'Enlace externo (opcional)'}</label>
                        <input type="url" value={guideForm.custom_url}
                          onChange={e => setGuideForm(f => ({ ...f, custom_url: e.target.value }))}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                      </div>
                    </div>

                    {/* ── Lección ── */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Lesson' : 'Lección'}</p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{lang === 'en' ? 'Lesson title' : 'Título de la lección'}</label>
                        <input type="text" value={guideForm.custom_lesson_title}
                          onChange={e => setGuideForm(f => ({ ...f, custom_lesson_title: e.target.value }))}
                          placeholder={lang === 'en' ? 'e.g. Lesson: How to write for our brand' : 'Ej: Lección: Cómo escribir para nuestra marca'}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                      </div>

                      {/* Bloques de lección */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{lang === 'en' ? 'Content blocks (collapsible cards)' : 'Bloques de contenido (tarjetas colapsables)'}</p>
                        {guideForm.custom_lesson_blocks.map((block, bi) => (
                          <div key={bi} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'en' ? `Block ${bi + 1}` : `Bloque ${bi + 1}`}</span>
                              {guideForm.custom_lesson_blocks.length > 1 && (
                                <button type="button" onClick={() => setGuideForm(f => ({ ...f, custom_lesson_blocks: f.custom_lesson_blocks.filter((_, i) => i !== bi) }))}
                                  className="text-slate-300 hover:text-rose-500 transition">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                              )}
                            </div>
                            <input type="text" value={block.heading}
                              onChange={e => setGuideForm(f => { const b = [...f.custom_lesson_blocks]; b[bi] = { ...b[bi], heading: e.target.value }; return { ...f, custom_lesson_blocks: b } })}
                              placeholder={lang === 'en' ? 'Block heading' : 'Título del bloque'}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-violet-400" />
                            <textarea rows={3} value={block.body}
                              onChange={e => setGuideForm(f => { const b = [...f.custom_lesson_blocks]; b[bi] = { ...b[bi], body: e.target.value }; return { ...f, custom_lesson_blocks: b } })}
                              placeholder={lang === 'en' ? 'Block content (paragraph)' : 'Contenido del bloque (párrafo)'}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-violet-400 resize-none" />
                            {/* Bullets */}
                            <div className="space-y-1.5">
                              <p className="text-[11px] text-slate-400">{lang === 'en' ? 'Bullet points (optional)' : 'Puntos de lista (opcional)'}</p>
                              {(block.bullets || []).map((bullet, bui) => (
                                <div key={bui} className="flex gap-1.5">
                                  <input type="text" value={bullet}
                                    onChange={e => setGuideForm(f => { const b = [...f.custom_lesson_blocks]; const buls = [...(b[bi].bullets || [])]; buls[bui] = e.target.value; b[bi] = { ...b[bi], bullets: buls }; return { ...f, custom_lesson_blocks: b } })}
                                    placeholder={`• ${lang === 'en' ? 'Bullet point' : 'Punto'} ${bui + 1}`}
                                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-violet-400" />
                                  <button type="button" onClick={() => setGuideForm(f => { const b = [...f.custom_lesson_blocks]; b[bi] = { ...b[bi], bullets: (b[bi].bullets || []).filter((_, i) => i !== bui) }; return { ...f, custom_lesson_blocks: b } })}
                                    className="text-slate-300 hover:text-rose-500 transition px-1">
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                  </button>
                                </div>
                              ))}
                              <button type="button" onClick={() => setGuideForm(f => { const b = [...f.custom_lesson_blocks]; b[bi] = { ...b[bi], bullets: [...(b[bi].bullets || []), ''] }; return { ...f, custom_lesson_blocks: b } })}
                                className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                                + {lang === 'en' ? 'Add bullet' : 'Agregar punto'}
                              </button>
                            </div>
                          </div>
                        ))}
                        <button type="button"
                          onClick={() => setGuideForm(f => ({ ...f, custom_lesson_blocks: [...f.custom_lesson_blocks, { heading: '', body: '', bullets: [] }] }))}
                          className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-2 text-xs font-semibold text-slate-500 hover:border-violet-400 hover:text-violet-600 transition">
                          + {lang === 'en' ? 'Add block' : 'Agregar bloque'}
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{lang === 'en' ? 'Key idea (takeaway)' : 'Idea clave (takeaway)'}</label>
                        <input type="text" value={guideForm.custom_lesson_takeaway}
                          onChange={e => setGuideForm(f => ({ ...f, custom_lesson_takeaway: e.target.value }))}
                          placeholder={lang === 'en' ? 'The one thing to remember from this lesson' : 'Lo más importante de esta lección'}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                      </div>
                    </div>

                    {/* ── Quiz ── */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Quiz (optional)' : 'Quiz (opcional)'}</p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={guideForm.custom_quiz_enabled}
                            onChange={e => setGuideForm(f => ({ ...f, custom_quiz_enabled: e.target.checked }))}
                            className="h-4 w-4 accent-violet-600" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{lang === 'en' ? 'Enable' : 'Activar'}</span>
                        </label>
                      </div>

                      {guideForm.custom_quiz_enabled && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{lang === 'en' ? 'Question' : 'Pregunta'}</label>
                            <input type="text" value={guideForm.custom_quiz_question}
                              onChange={e => setGuideForm(f => ({ ...f, custom_quiz_question: e.target.value }))}
                              placeholder={lang === 'en' ? 'What is the main goal of...?' : '¿Cuál es el objetivo principal de...?'}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">{lang === 'en' ? 'Options (mark the correct one)' : 'Opciones (marcá la correcta)'}</label>
                            {guideForm.custom_quiz_options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input type="radio" name="quiz_correct" checked={guideForm.custom_quiz_correct === oi}
                                  onChange={() => setGuideForm(f => ({ ...f, custom_quiz_correct: oi }))}
                                  className="h-4 w-4 accent-violet-600 shrink-0" />
                                <input type="text" value={opt}
                                  onChange={e => setGuideForm(f => { const o = [...f.custom_quiz_options]; o[oi] = e.target.value; return { ...f, custom_quiz_options: o } })}
                                  placeholder={`${lang === 'en' ? 'Option' : 'Opción'} ${oi + 1}${guideForm.custom_quiz_correct === oi ? ' (correct)' : ''}`}
                                  className={`flex-1 rounded-xl border px-3 py-1.5 text-sm outline-none focus:border-violet-400 bg-slate-50 dark:bg-slate-800 ${guideForm.custom_quiz_correct === oi ? 'border-emerald-300 dark:border-emerald-700' : 'border-slate-200 dark:border-slate-700'}`} />
                              </div>
                            ))}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{lang === 'en' ? 'Explanation (shown after answering)' : 'Explicación (se muestra al responder)'}</label>
                            <input type="text" value={guideForm.custom_quiz_explanation}
                              onChange={e => setGuideForm(f => ({ ...f, custom_quiz_explanation: e.target.value }))}
                              placeholder={lang === 'en' ? 'Why is that the correct answer?' : '¿Por qué esa es la respuesta correcta?'}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Pasos ── */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Steps' : 'Pasos'}</p>
                      {guideForm.custom_steps.map((step, si) => (
                        <div key={si} className="flex gap-1.5 items-center">
                          <span className="text-xs font-bold text-slate-300 w-5 text-right shrink-0">{si + 1}</span>
                          <input type="text" value={step}
                            onChange={e => setGuideForm(f => { const s = [...f.custom_steps]; s[si] = e.target.value; return { ...f, custom_steps: s } })}
                            placeholder={lang === 'en' ? `Step ${si + 1}` : `Paso ${si + 1}`}
                            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-violet-400" />
                          {guideForm.custom_steps.length > 1 && (
                            <button type="button" onClick={() => setGuideForm(f => ({ ...f, custom_steps: f.custom_steps.filter((_, i) => i !== si) }))}
                              className="text-slate-300 hover:text-rose-500 transition">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setGuideForm(f => ({ ...f, custom_steps: [...f.custom_steps, ''] }))}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                        + {lang === 'en' ? 'Add step' : 'Agregar paso'}
                      </button>
                    </div>

                    {/* ── Ejercicios ── */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Drills / Exercises' : 'Ejercicios'}</p>
                      {guideForm.custom_drills.map((drill, di) => (
                        <div key={di} className="flex gap-1.5 items-center">
                          <input type="text" value={drill}
                            onChange={e => setGuideForm(f => { const d = [...f.custom_drills]; d[di] = e.target.value; return { ...f, custom_drills: d } })}
                            placeholder={lang === 'en' ? `Exercise ${di + 1}` : `Ejercicio ${di + 1}`}
                            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-violet-400" />
                          {guideForm.custom_drills.length > 1 && (
                            <button type="button" onClick={() => setGuideForm(f => ({ ...f, custom_drills: f.custom_drills.filter((_, i) => i !== di) }))}
                              className="text-slate-300 hover:text-rose-500 transition">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setGuideForm(f => ({ ...f, custom_drills: [...f.custom_drills, ''] }))}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                        + {lang === 'en' ? 'Add exercise' : 'Agregar ejercicio'}
                      </button>
                    </div>

                    {/* ── Checkpoints ── */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Checklist' : 'Checklist'}</p>
                      <p className="text-[11px] text-slate-400">{lang === 'en' ? 'Items the employee marks as done' : 'Ítems que el empleado marca como completados'}</p>
                      {guideForm.custom_checkpoints.map((cp, ci) => (
                        <div key={ci} className="flex gap-1.5 items-center">
                          <input type="text" value={cp}
                            onChange={e => setGuideForm(f => { const c = [...f.custom_checkpoints]; c[ci] = e.target.value; return { ...f, custom_checkpoints: c } })}
                            placeholder={lang === 'en' ? `Checkpoint ${ci + 1}` : `Checkpoint ${ci + 1}`}
                            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-violet-400" />
                          {guideForm.custom_checkpoints.length > 1 && (
                            <button type="button" onClick={() => setGuideForm(f => ({ ...f, custom_checkpoints: f.custom_checkpoints.filter((_, i) => i !== ci) }))}
                              className="text-slate-300 hover:text-rose-500 transition">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setGuideForm(f => ({ ...f, custom_checkpoints: [...f.custom_checkpoints, ''] }))}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                        + {lang === 'en' ? 'Add checkpoint' : 'Agregar checkpoint'}
                      </button>
                    </div>

                  </div>
                )}

                {/* Destinatario */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
                    {lang === 'en' ? 'Assign to' : 'Asignar a'}
                  </label>
                  <select
                    value={guideForm.target}
                    onChange={e => setGuideForm(f => ({ ...f, target: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-violet-400"
                  >
                    <option value="all">{lang === 'en' ? 'Whole team' : 'Todo el equipo'}</option>
                    {teamUsers.map(m => (
                      <option key={m.id_usuario} value={m.id_usuario}>
                        {m.company_display_name || m.nombre_display || m.nombre || m.username}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nota */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">
                    {lang === 'en' ? 'Note for the employee (optional)' : 'Nota para el empleado (opcional)'}
                  </label>
                  <input
                    type="text"
                    value={guideForm.note}
                    onChange={e => setGuideForm(f => ({ ...f, note: e.target.value }))}
                    placeholder={lang === 'en' ? 'e.g. Complete before next sprint' : 'Ej: Completar antes del próximo sprint'}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-violet-400"
                  />
                </div>

                {/* Fecha límite */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">
                    {lang === 'en' ? 'Due date (optional)' : 'Fecha límite (opcional)'}
                  </label>
                  <input
                    type="date"
                    value={guideForm.due_date}
                    onChange={e => setGuideForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-violet-400"
                  />
                </div>

                {guideStatus === 'validation' && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {lang === 'en' ? 'Please fill in all required fields.' : 'Completá los campos requeridos.'}
                  </p>
                )}
                {guideStatus?.startsWith('db_error') && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {lang === 'en' ? 'Could not save. The feature may not be set up in the database yet — run the migration first.' : 'No se pudo guardar. Es posible que la migración de base de datos no se haya ejecutado aún.'}
                    <span className="block mt-0.5 font-mono opacity-60">{guideStatus.replace('db_error:', '')}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setGuideModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"

                >
                  {lang === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  onClick={saveGuideAssignment}
                  disabled={savingGuide}
                  className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition disabled:opacity-50"
                >
                  {savingGuide ? '...' : (lang === 'en' ? 'Assign' : 'Asignar')}
                </button>
              </div>
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
  }

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

  const renderSubscription = () => {
    const memberCount = teamUsers.length
    const BETA_END = new Date('2026-09-01')
    const now = new Date()
    const daysLeft = Math.max(0, Math.ceil((BETA_END - now) / (1000 * 60 * 60 * 24)))
    const betaActive = now < BETA_END

    const PLANS = [
      {
        id: 'starter',
        name: 'Starter',
        limit: 15,
        price: lang === 'en' ? '$29/mo' : '$29/mes',
        features: lang === 'en'
          ? ['Up to 15 members', 'Basic dashboard', 'Custom challenges', 'Custom roles', 'AI chatbot', 'Internal tournaments']
          : ['Hasta 15 miembros', 'Dashboard básico', 'Desafíos personalizados', 'Roles personalizados', 'Chatbot IA', 'Torneos internos'],
      },
      {
        id: 'team',
        name: 'Team',
        limit: 50,
        price: lang === 'en' ? '$79/mo' : '$79/mes',
        popular: true,
        features: lang === 'en'
          ? ['Up to 50 members', 'Full analytics dashboard', 'Custom & AI challenges', 'Assignable guides', 'Custom roles', 'Internal ranking']
          : ['Hasta 50 miembros', 'Dashboard con analytics completo', 'Desafíos personalizados e IA', 'Guías asignables con seguimiento', 'Roles personalizados', 'Ranking interno'],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        limit: Infinity,
        price: lang === 'en' ? 'Custom' : 'A medida',
        features: lang === 'en'
          ? ['Unlimited members', 'Everything in Team', 'Internal tournaments', 'Advanced admin panel', 'Custom onboarding', 'Priority support']
          : ['Miembros ilimitados', 'Todo del plan Team', 'Torneos internos', 'Panel de admin avanzado', 'Onboarding personalizado', 'Soporte prioritario'],
      },
    ]

    const currentPlan = memberCount <= 15 ? 'starter' : memberCount <= 50 ? 'team' : 'enterprise'

    return (
      <div className="space-y-6 pb-12">
        {/* Beta banner */}
        {betaActive && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {lang === 'en' ? 'Beta — Free until September 1, 2026' : 'Beta — Gratis hasta el 1 de septiembre de 2026'}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {lang === 'en'
                    ? `${daysLeft} days left. All features are unlocked at no cost during the beta period.`
                    : `${daysLeft} días restantes. Todas las funcionalidades están desbloqueadas sin costo durante la beta.`}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shrink-0">
              {lang === 'en' ? 'Active' : 'Activo'}
            </span>
          </div>
        )}

        {/* Current plan summary */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            {lang === 'en' ? 'Current plan' : 'Plan actual'}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-violet-600 dark:text-violet-400">
                  {PLANS.find(p => p.id === currentPlan)?.name}
                </span>
                {betaActive && (
                  <span className="rounded-full border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {lang === 'en' ? 'Beta free' : 'Beta gratis'}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'en'
                  ? `${memberCount} member${memberCount !== 1 ? 's' : ''} · determined by team size`
                  : `${memberCount} miembro${memberCount !== 1 ? 's' : ''} · determinado por el tamaño del equipo`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {betaActive ? (lang === 'en' ? '$0/mo' : '$0/mes') : PLANS.find(p => p.id === currentPlan)?.price}
              </p>
              {betaActive && (
                <p className="text-xs text-slate-400 line-through">
                  {PLANS.find(p => p.id === currentPlan)?.price}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Plan comparison */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            {lang === 'en' ? 'All plans' : 'Todos los planes'}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isActive = plan.id === currentPlan
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-5 flex flex-col gap-4 transition ${
                    isActive
                      ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-400 dark:ring-violet-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{plan.name}</span>
                      {isActive && (
                        <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                          {lang === 'en' ? 'Current' : 'Actual'}
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">{plan.price}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {plan.limit === Infinity
                        ? (lang === 'en' ? 'Unlimited members' : 'Miembros ilimitados')
                        : (lang === 'en' ? `Up to ${plan.limit} members` : `Hasta ${plan.limit} miembros`)}
                    </p>
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        {/* Post-beta note */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {lang === 'en' ? 'After the beta period' : 'Después de la beta'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {lang === 'en'
              ? 'Billing will begin after September 1, 2026. Your plan will be determined automatically based on your team size. We\'ll notify you before any charges.'
              : 'La facturación comenzará después del 1 de septiembre de 2026. Tu plan se determinará automáticamente según el tamaño de tu equipo. Te avisaremos antes de cualquier cobro.'}
          </p>
          <a
            href="mailto:soporte@promptool.app"
            className="mt-3 inline-flex items-center text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
          >
            {lang === 'en' ? 'Contact us about pricing →' : 'Contactarnos sobre precios →'}
          </a>
        </div>
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
        {settingsStatus === 'ok' && <span className="text-sm text-emerald-600 flex items-center gap-1"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>{lang === 'en' ? 'Saved' : 'Guardado'}</span>}
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
                  <p className="text-[11px] uppercase tracking-wide text-amber-600 font-semibold flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {lang === 'en' ? 'Awaiting response' : 'Esperando respuesta'}
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
          <p className="mt-4 text-slate-600">{lang === 'en' ? 'Loading...' : 'Cargando...'}</p>
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
              {tab.icon === 'guides' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
              {tab.icon === 'settings' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              {tab.icon === 'challenges' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
              {tab.icon === 'requests' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>}
              {tab.icon === 'subscription' && <svg className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
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
          {activeTab === 'subscription' && renderSubscription()}
        </div>
      </main>

      <Footer />

      {challengeModalOpen && (
        <ChallengeCreatorModal
          open={challengeModalOpen}
          onClose={closeChallengeModal}
          challengeForm={challengeForm}
          setChallengeForm={setChallengeForm}
          challengeImageFile={challengeImageFile}
          setChallengeImageFile={setChallengeImageFile}
          challengeImagePreview={challengeImagePreview}
          setChallengeImagePreview={setChallengeImagePreview}
          onSubmit={createChallenge}
          creatingChallenge={creatingChallenge}
          challengeStatus={challengeStatus}
          lang={lang}
          companyIndustry={companyData?.industry_type || 'general'}
          isEditing={!!editingChallenge}
        />
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


