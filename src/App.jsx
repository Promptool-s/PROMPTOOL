import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Header from './components/Header'
import Footer from './components/Footer'
import ImageCard from './components/ImageCard'
import LandingPage from './components/LandingPage'
import AuthModal from './components/AuthModal'
import EnterprisePanel from './components/EnterprisePanel'
import PromptInput from './components/PromptInput'
import ResultPanel from './components/ResultPanel'
import { comparePrompts } from './services/geminiService'
import { analyzePlagiarism, checkSuspension } from './services/plagiarismService'
import { calculateElo } from './services/eloService'
import { getRecommendedGuides } from './data/guides'
import { supabase } from './supabaseClient'
import { useAuth } from './hooks/useAuth'
import { useLang } from './contexts/LangContext'
import { proxyImg } from './utils/imgProxy'
import { nowAR } from './utils/dateAR'

// Columnas reales: id_imagen, url_image, prompt_original, seed, fecha, image_diff, image_theme
const normalizeImageData = (row) => {
  if (!row) return null
  return {
    id_imagen: row.id_imagen ?? null,
    url_image: row.url_image ? proxyImg(row.url_image) : null,
    prompt_original: row.prompt_original ?? '',
    seed: row.seed ?? null,
    fecha: row.fecha ?? null,
    image_diff: row.image_diff ?? 'Medium',
    image_theme: row.image_theme ?? '',
  }
}

const normalizeDifficulty = (difficulty = 'Medium') => difficulty.toLowerCase()

const formatDuration = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

const getTimePenalty = ({ elapsedSeconds = 0, recommendedSeconds = 0 }, difficulty = 'Medium', mode = 'random') => {
  if (!recommendedSeconds || elapsedSeconds <= recommendedSeconds) {
    return { penalty: 0, message: '' }
  }
  const overtimeSeconds = elapsedSeconds - recommendedSeconds
  const overtimeRatio = overtimeSeconds / Math.max(recommendedSeconds, 1)
  const nd = normalizeDifficulty(difficulty)
  const difficultyFactor = nd === 'easy' ? 0.85 : nd === 'hard' ? 1.2 : 1.05
  const modeFactor = mode === 'daily' ? 1.12 : 0.95
  const penalty = Math.min(30, Math.max(4, Math.round((overtimeRatio * 22 + overtimeSeconds / 18) * difficultyFactor * modeFactor)))
  return {
    penalty,
    message: `Tardaste demasiado (${formatDuration(overtimeSeconds)} extra). Se descontaron ${penalty} puntos por exceder el tiempo recomendado.`,
  }
}

/**
 * Calcula tiempo recomendado personalizado basado en el historial del usuario
 * @param {string} userId - ID del usuario
 * @param {string} difficulty - Dificultad del desafío
 * @returns {Promise<number>} - Tiempo recomendado en segundos
 */
const getPersonalizedTime = async (userId, difficulty = 'Medium') => {
  // Tiempos base por dificultad (fallback)
  const baseTime = {
    easy: 90,
    medium: 150,
    hard: 240
  }
  
  const nd = normalizeDifficulty(difficulty)
  const defaultTime = baseTime[nd] || baseTime.medium

  if (!userId) return defaultTime

  try {
    // Obtener últimos 15 intentos del usuario en esta dificultad
    const { data: attempts } = await supabase
      .from('intentos')
      .select('tiempo_respuesta, puntaje_similitud, imagenes_ia!inner(image_diff)')
      .eq('id_usuario', userId)
      .eq('imagenes_ia.image_diff', difficulty)
      .not('tiempo_respuesta', 'is', null)
      .order('fecha_hora', { ascending: false })
      .limit(15)

    if (!attempts || attempts.length < 3) {
      // No hay suficiente historial, usar tiempo base
      return defaultTime
    }

    // Calcular tiempo promedio del usuario en esta dificultad
    const validTimes = attempts
      .map(a => a.tiempo_respuesta)
      .filter(t => t > 0 && t < 600) // filtrar outliers (más de 10 min)
    
    if (validTimes.length === 0) return defaultTime

    const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length

    // Calcular score promedio para ajustar
    const avgScore = attempts.reduce((sum, a) => sum + (a.puntaje_similitud || 0), 0) / attempts.length

    // Ajustar tiempo basado en performance:
    // - Si el usuario tiene buen score (>70), darle menos tiempo (es eficiente)
    // - Si tiene score bajo (<50), darle más tiempo (necesita más tiempo para pensar)
    let adjustedTime = avgTime
    if (avgScore >= 70) {
      adjustedTime = avgTime * 0.9 // 10% menos tiempo
    } else if (avgScore < 50) {
      adjustedTime = avgTime * 1.15 // 15% más tiempo
    }

    // Asegurar que esté dentro de rangos razonables
    const minTime = baseTime[nd] * 0.6
    const maxTime = baseTime[nd] * 1.8
    
    return Math.round(Math.max(minTime, Math.min(maxTime, adjustedTime)))
  } catch (error) {
    console.error('Error calculating personalized time:', error)
    return defaultTime
  }
}

function App() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const { t, lang } = useLang()
  const [showLanding, setShowLanding] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [userType, setUserType] = useState(null)
  const [userTypeLoading, setUserTypeLoading] = useState(false)
  const [userStreak, setUserStreak] = useState(0)
  const [promptUsuario, setPromptUsuario] = useState('')
  const [aiExplanation, setAiExplanation] = useState('')
  const [scorePercent, setScorePercent] = useState(null)
  const [eloDelta, setEloDelta] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [mode, setMode] = useState('random')
  const [difficulty, setDifficulty] = useState('Medium')
  const [imageData, setImageData] = useState(null)
  const [imageStatus, setImageStatus] = useState('loading')
  const [analyzing, setAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState('')
  const [strengths, setStrengths] = useState([])
  const [improvements, setImprovements] = useState([])
  const [timingData, setTimingData] = useState({ elapsedSeconds: 0, recommendedSeconds: 0, overtimeSeconds: 0 })
  const [timePenaltyMessage, setTimePenaltyMessage] = useState('')
  const [availableDiffs, setAvailableDiffs] = useState([])
  const [dailyDone, setDailyDone] = useState(false)
  const [suspensionInfo, setSuspensionInfo] = useState(null)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  // Para no logueados: límite de 1 partida diaria (guardada en sessionStorage)
  const [guestDailyDone, setGuestDailyDone] = useState(() => {
    const stored = sessionStorage.getItem('guestDailyDate')
    return stored === new Date().toDateString()
  })
  // Modo desafío de empresa
  const [challengeCompany, setChallengeCompany] = useState(null) // { company_name, avatar_url, verified }
  const challengeId = new URLSearchParams(window.location.search).get('challenge')
  const inviteCompanyId = new URLSearchParams(window.location.search).get('invite')
  const [inviteState, setInviteState] = useState(null)
  const [inviteCompany, setInviteCompany] = useState(null)
  const [imageAttempts, setImageAttempts] = useState(0)
  const [revealPrompt, setRevealPrompt] = useState(false)
  const [promptRevealed, setPromptRevealed] = useState(false)
  const [attemptHistory, setAttemptHistory] = useState([]) // [{score, prompt, strengths, improvements}]
  const MAX_ATTEMPTS_BEFORE_UNLOCK = 4
  const [isRanked, setIsRanked] = useState(true) // toggle modo rankeado
  const [personalizedTime, setPersonalizedTime] = useState(null) // tiempo personalizado basado en historial
  const recommendedGuideIds = getRecommendedGuides(improvements, suggestions)

  // Resetear intentos y reveal cuando cambia la imagen
  useEffect(() => {
    setImageAttempts(0)
    setRevealPrompt(false)
    setPromptRevealed(false)
    setAttemptHistory([])
  }, [imageData?.id_imagen])
  useEffect(() => {
    if (!user?.id || !imageData) return
    
    const loadPersonalizedTime = async () => {
      const time = await getPersonalizedTime(user.id, imageData.image_diff || difficulty)
      setPersonalizedTime(time)
    }
    
    loadPersonalizedTime()
  }, [user?.id, imageData?.image_diff, difficulty])

  // Cargar desafío de empresa si viene con ?challenge=ID
  useEffect(() => {
    if (!challengeId) return
    setShowLanding(false)
    setImageStatus('loading')
    const loadChallenge = async () => {
      try {
        const { data, error } = await supabase
          .from('imagenes_ia')
          .select('*, company_id')
          .eq('id_imagen', challengeId)
          .maybeSingle()
        if (error || !data) { setImageStatus('error'); return }
        setImageData(normalizeImageData(data))
        setDifficulty(data.image_diff || 'Medium')
        setMode('challenge')
        setImageStatus('ok')
        // Cargar datos de la empresa
        if (data.company_id) {
          const { data: co } = await supabase
            .from('usuarios')
            .select('company_name, nombre_display, avatar_url, verified')
            .eq('id_usuario', data.company_id)
            .maybeSingle()
          setChallengeCompany(co || null)
        }
      } catch (err) {
        setImageStatus('error')
      }
    }
    loadChallenge()
  }, [challengeId])

  // Manejar link de invitación ?invite=COMPANY_ID
  useEffect(() => {
    if (!inviteCompanyId) return

    // Cargar datos de la empresa para mostrar en el banner
    const loadInviteCompany = async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('company_name, nombre_display, avatar_url')
        .eq('id_usuario', inviteCompanyId)
        .eq('user_type', 'enterprise')
        .maybeSingle()
      setInviteCompany(data || null)
    }
    loadInviteCompany()

    if (!user) {
      // No logueado — mostrar banner + modal de login
      setInviteState('prompt_login')
      setAuthModalOpen(true)
      return
    }

    // Logueado — unirse automáticamente
    const joinCompany = async () => {
      setInviteState('loading')
      try {
        const { error } = await supabase.rpc('join_company_by_link', { p_company_id: inviteCompanyId })
        if (error) {
          if (error.message?.includes('Already member')) {
            setInviteState('already')
          } else {
            setInviteState('error')
          }
        } else {
          setInviteState('joined')
          // Limpiar URL sin recargar
          window.history.replaceState({}, '', '/')
        }
      } catch (e) {
        setInviteState('error')
      }
    }
    joinCompany()
  }, [inviteCompanyId, user?.id])

  // Verificar suspensión al cargar
  useEffect(() => {
    if (!user) return
    checkSuspension(user.id).then(result => {
      if (!result.allowed) setSuspensionInfo(result)
    })
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      setUserType(null)
      setUserTypeLoading(false)
      return
    }

    const fetchUserType = async () => {
      setUserTypeLoading(true)
      const { data } = await supabase
        .from('usuarios')
        .select('user_type, racha_actual')
        .eq('id_usuario', user.id)
        .maybeSingle()
      setUserType(data?.user_type || 'individual')
      setUserStreak(data?.racha_actual || 0)
      setUserTypeLoading(false)
    }
    fetchUserType()
  }, [user?.id])

  useEffect(() => {
    if (user) setShowLanding(false)
  }, [user])

  // Cuando el usuario se loguea, asignar todos los intentos pendientes de guest
  useEffect(() => {
    if (!user) return
    // Array de intentos (nuevo formato)
    const pendingList = sessionStorage.getItem('guestAttempts')
    if (pendingList) {
      try {
        const attempts = JSON.parse(pendingList)
        if (Array.isArray(attempts) && attempts.length > 0) {
          supabase.from('intentos').insert(attempts.map(a => ({ ...a, id_usuario: user.id })))
            .then(() => sessionStorage.removeItem('guestAttempts'))
        }
      } catch { sessionStorage.removeItem('guestAttempts') }
    }
    // Compatibilidad con el formato viejo (un solo intento)
    const pending = sessionStorage.getItem('pendingAttempt')
    if (pending) {
      try {
        const attempt = JSON.parse(pending)
        supabase.from('intentos').insert([{ ...attempt, id_usuario: user.id }])
          .then(() => sessionStorage.removeItem('pendingAttempt'))
      } catch { sessionStorage.removeItem('pendingAttempt') }
    }
  }, [user?.id])

  // Fetch inicial: extrae las dificultades disponibles en la BD
  useEffect(() => {
    const fetchFilters = async () => {
      const { data } = await supabase
        .from('imagenes_ia')
        .select('image_diff')
        .is('company_id', null)

      if (!data) return
      const diffOrder = ['Easy', 'Medium', 'Hard']
      const found = [...new Set(data.map((r) => r.image_diff).filter(Boolean))]
      setAvailableDiffs(diffOrder.filter((d) => found.includes(d)))
    }
    fetchFilters()
  }, [])

  // Verificar si el usuario ya hizo el modo diario hoy (solo al montar o cambiar usuario)
  useEffect(() => {
    if (!user) {
      setDailyDone(false)
      setMode('daily')
      return
    }
    const dailyKey = `dailyDoneDate_${user.id}`
    const checkDaily = async () => {
      const stored = localStorage.getItem(dailyKey)
      if (stored === new Date().toDateString()) {
        setDailyDone(true)
        if (!submitted) { setMode('random') }
        return
      }
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('intentos')
        .select('id_intento')
        .eq('id_usuario', user.id)
        .eq('modo', 'daily')
        .gte('fecha_hora', hoy.toISOString())
        .limit(1)
      const done = !!(data && data.length > 0)
      setDailyDone(done)
      if (done) {
        localStorage.setItem(dailyKey, new Date().toDateString())
        if (!submitted) { setMode('random') }
      }
    }
    checkDaily()
  }, [user?.id])

  // Fetch de la imagen activa
  useEffect(() => {
    // Si hay un desafío de empresa activo, no cargar imagen normal
    if (challengeId) return

    let cancelled = false

    const fetchImageData = async () => {
      setImageStatus('loading')

      try {
        let query = supabase.from('imagenes_ia').select('*').is('company_id', null)

        if (mode === 'daily') {
          const hoy = new Date()
          hoy.setHours(23, 59, 59, 999)
          query = query
            .lte('fecha', hoy.toISOString())
            .order('fecha', { ascending: false })
            .limit(1)
        } else {
          if (difficulty) query = query.eq('image_diff', difficulty)
        }

        const { data, error } = await query
        if (cancelled) return
        if (error) throw error

        if (!data || data.length === 0) {
          setImageStatus('empty')
          return
        }

        let rows = data.map(normalizeImageData)

        if (mode === 'random') {
          const dailyId = [...rows].sort((a, b) =>
            new Date(b.fecha) - new Date(a.fecha)
          )[0]?.id_imagen
          const withoutDaily = rows.filter(r => r.id_imagen !== dailyId)
          if (withoutDaily.length > 0) rows = withoutDaily
        }

        if (cancelled) return

        const selected = mode === 'daily'
          ? rows[0]
          : rows[Math.floor(Math.random() * rows.length)]

        // Preload la imagen para que el browser la descargue antes del render
        if (selected?.url_image) {
          const link = document.createElement('link')
          link.rel = 'preload'
          link.as = 'image'
          link.href = selected.url_image
          document.head.appendChild(link)
        }

        setImageData(selected)
        setImageStatus('ok')
      } catch (err) {
        if (!cancelled) {
          setImageStatus('error')
        }
      }
    }

    fetchImageData()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, difficulty])

  // Precargar imagen del día siguiente (solo en modo daily, una vez)
  useEffect(() => {
    if (mode !== 'daily' || challengeId) return
    const prefetch = async () => {
      try {
        const manana = new Date()
        manana.setDate(manana.getDate() + 1)
        manana.setHours(23, 59, 59, 999)
        const { data } = await supabase
          .from('imagenes_ia')
          .select('url_image')
          .is('company_id', null)
          .lte('fecha', manana.toISOString())
          .order('fecha', { ascending: false })
          .limit(2) // limit 2: [0] = hoy, [1] = mañana
        const nextUrl = data?.[1]?.url_image
        if (nextUrl) {
          const img = new Image()
          img.src = nextUrl
        }
      } catch { /* silencioso */ }
    }
    prefetch()
  }, [mode, challengeId])

  // El modo ya se inicializa correctamente desde localStorage en el useState — no hace falta useEffect

  const hasImage = imageStatus === 'ok' && imageData !== null
  const isDisabled = !hasImage || (mode === 'daily' && (user ? dailyDone : guestDailyDone))

  const handleSubmit = async (event) => {
    event.preventDefault()
    const submittedPrompt = promptUsuario.trim()
    if (!submittedPrompt || !hasImage) return

    const promptReferencia = imageData?.prompt_original
    if (!promptReferencia) return

    // Verificar suspensión antes de procesar
    if (user) {
      const suspension = await checkSuspension(user.id)
      if (!suspension.allowed) { setSuspensionInfo(suspension); return }
    }

    setAnalyzing(true)
    setSubmitted(true)

    try {
      const result = await comparePrompts(submittedPrompt, promptReferencia, imageData?.image_diff ?? difficulty, lang)
      const timePenalty = getTimePenalty(timingData, imageData?.image_diff ?? difficulty, mode)
      const finalScore = Math.max(0, (result.score ?? 0) - timePenalty.penalty)

      setScorePercent(finalScore)
      setAiExplanation(result.explanation)
      setSuggestions(result.suggestions)
      setStrengths(result.strengths ?? [])
      setImprovements(result.improvements ?? [])
      setTimePenaltyMessage(timePenalty.message)
      setImageAttempts(prev => prev + 1)
      setAttemptHistory(prev => [...prev, {
        score: finalScore,
        prompt: submittedPrompt,
        strengths: result.strengths ?? [],
        improvements: result.improvements ?? [],
      }])

      const { error: dbError } = await supabase
        .from('intentos')
        .insert([{
          prompt_usuario: submittedPrompt,
          puntaje_similitud: finalScore,
          id_imagen: imageData.id_imagen,
          id_usuario: user?.id || null,
          fecha_hora: nowAR(),
          strengths: result.strengths ?? [],
          improvements: result.improvements ?? [],
          modo: mode === 'challenge' ? 'challenge' : mode,
          elo_delta: null, // se actualiza abajo si hay usuario
          is_ranked: !challengeId && isRanked,
          tiempo_respuesta: timingData.elapsedSeconds > 0 ? timingData.elapsedSeconds : null,
        }])

      if (dbError) { /* silencioso — el usuario igual ve el resultado */ }
      else {
        // Guardar intento en sessionStorage para guests (se asigna al registrarse)
        if (!user) {
          try {
            const existing = JSON.parse(sessionStorage.getItem('guestAttempts') || '[]')
            existing.push({
              prompt_usuario: submittedPrompt,
              puntaje_similitud: finalScore,
              id_imagen: imageData.id_imagen,
              fecha_hora: nowAR(),
              strengths: result.strengths ?? [],
              improvements: result.improvements ?? [],
              modo: mode === 'challenge' ? 'challenge' : mode,
              is_ranked: false, // guests no tienen ELO
              tiempo_respuesta: timingData.elapsedSeconds > 0 ? timingData.elapsedSeconds : null,
            })
            sessionStorage.setItem('guestAttempts', JSON.stringify(existing))
          } catch { /* silencioso */ }
        }
        // Incrementar total_intentos (y ranked_count si aplica) en la BD
        if (user) {
          supabase.from('usuarios')
            .select('total_intentos, ranked_count')
            .eq('id_usuario', user.id)
            .maybeSingle()
            .then(({ data }) => {
              const updates = { total_intentos: (data?.total_intentos ?? 0) + 1 }
              if (!challengeId && isRanked) {
                updates.ranked_count = (data?.ranked_count ?? 0) + 1
              }
              supabase.from('usuarios').update(updates).eq('id_usuario', user.id)
            })
        }

        if (mode === 'daily') {
          if (user) {
            setDailyDone(true)
            localStorage.setItem(`dailyDoneDate_${user.id}`, new Date().toDateString())
          }
          else {
            sessionStorage.setItem('guestDailyDate', new Date().toDateString())
            setGuestDailyDone(true)
            sessionStorage.setItem('pendingAttempt', JSON.stringify({
              prompt_usuario: submittedPrompt,
              puntaje_similitud: finalScore,
              id_imagen: imageData.id_imagen,
              fecha_hora: nowAR(),
              strengths: result.strengths ?? [],
              improvements: result.improvements ?? [],
              modo: mode,
            }))
          }
        }

        // Actualizar ELO del usuario logueado — no aplica en desafíos de empresa ni en modo no rankeado
        if (user && !challengeId && isRanked) {
          try {
            const { data: userData } = await supabase
              .from('usuarios')
              .select('elo_rating, total_intentos')
              .eq('id_usuario', user.id)
              .maybeSingle()

            const currentElo = userData?.elo_rating ?? 1000

            // Contar solo intentos rankeados para el threshold de 5
            const { count: rankedCount } = await supabase
              .from('intentos')
              .select('id_intento', { count: 'exact', head: true })
              .eq('id_usuario', user.id)
              .eq('is_ranked', true)

            const totalAttempts = rankedCount ?? 0

            // No calcular ELO hasta tener 5 intentos rankeados
            if (totalAttempts < 5) {
              // Awaiting placement — no ELO yet
            } else {
              const { newElo, delta } = calculateElo({
                userElo: currentElo,
                totalAttempts,
                score: finalScore,
                difficulty: imageData?.image_diff ?? difficulty,
                timing: {
                  elapsedSeconds: timingData.elapsedSeconds,
                  recommendedSeconds: timingData.recommendedSeconds,
                  penaltyOvertimeSeconds: timingData.penaltyOvertimeSeconds ?? 0,
                },
              })

              await supabase
                .from('usuarios')
                .update({ elo_rating: newElo })
                .eq('id_usuario', user.id)

              // Guardar delta en el intento más reciente
              await supabase
                .from('intentos')
                .update({ elo_delta: delta })
                .eq('id_usuario', user.id)
                .eq('is_ranked', true)
                .order('fecha_hora', { ascending: false })
                .limit(1)

              setEloDelta(delta)
            }
          } catch {
            // ELO update failed silently — not critical
          }
        }
      }

      // Análisis antiplagio — async, no bloquea la UI
      if (user) {
        analyzePlagiarism({
          userId: user.id,
          prompt: submittedPrompt,
          score: finalScore,
          elapsedSeconds: timingData.elapsedSeconds,
          difficulty,
          imageId: imageData.id_imagen,
        })
      }
    } catch (err) {
      setScorePercent(0)
      setAiExplanation('Hubo un error al analizar tu prompt.')
      setSuggestions('')
      setStrengths([])
      setImprovements([])
      setTimePenaltyMessage('')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleTryApp = () => {
    setShowLanding(false)
    setMode('random')
  }

  const handleOpenAuth = () => {
    setAuthModalOpen(true)
  }

  const handleCloseAuth = () => {
    setAuthModalOpen(false)
  }

  const handleReset = () => {
    setPromptUsuario('')
    setAiExplanation('')
    setScorePercent(null)
    setEloDelta(null)
    setSubmitted(false)
    setSuggestions('')
    setStrengths([])
    setImprovements([])
    setTimingData({ elapsedSeconds: 0, recommendedSeconds: 0, overtimeSeconds: 0 })
    setTimePenaltyMessage('')
    setAnalyzing(false)
    setImageAttempts(0)
    setRevealPrompt(false)
    setPromptRevealed(false)
    setAttemptHistory([])
    if (!challengeId) setIsRanked(true) // reset a rankeado por defecto
  }

  // Retry: vuelve al input con el mismo prompt y misma imagen, sin guardar nuevo intento
  const handleRetry = () => {
    setAiExplanation('')
    setScorePercent(null)
    setEloDelta(null)
    setSubmitted(false)
    setSuggestions('')
    setStrengths([])
    setImprovements([])
    setTimingData({ elapsedSeconds: 0, recommendedSeconds: 0, overtimeSeconds: 0 })
    setTimePenaltyMessage('')
    setAnalyzing(false)
    // promptUsuario se mantiene para que el usuario lo vea y mejore
  }

  // Nueva imagen aleatoria — resetea todo y fuerza refetch en modo random
  const handleNewRandom = () => {
    handleReset()
    if (mode !== 'random') {
      setMode('random')
    } else {
      // Forzar refetch cambiando a un valor temporal y volviendo
      setImageStatus('loading')
      setImageData(null)
      const fetchRandom = async () => {
        try {
          let query = supabase.from('imagenes_ia').select('*').is('company_id', null)
          if (difficulty) query = query.eq('image_diff', difficulty)
          const { data } = await query
          if (!data || data.length === 0) { setImageStatus('empty'); return }
          let rows = data.map(normalizeImageData)

          // Excluir imagen del día
          const dailyId = [...rows].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]?.id_imagen
          const withoutDaily = rows.filter(r => r.id_imagen !== dailyId)
          if (withoutDaily.length > 0) rows = withoutDaily

          // Excluir dominadas
          if (user) {
            try {
              const { data: mastered } = await supabase
                .from('intentos').select('id_imagen')
                .eq('id_usuario', user.id).gt('puntaje_similitud', 93)
              if (mastered?.length) {
                const masteredIds = new Set(mastered.map(i => i.id_imagen))
                const filtered = rows.filter(r => !masteredIds.has(r.id_imagen))
                if (filtered.length > 0) rows = filtered
              }
            } catch { /* fail open */ }
          }

          const selected = rows[Math.floor(Math.random() * rows.length)]
          setImageData(selected)
          setDifficulty(selected.image_diff ?? 'Medium')
          setImageStatus('ok')
        } catch { setImageStatus('error') }
      }
      fetchRandom()
    }
  }

  const handleRevealOriginalPrompt = () => {
    setPromptRevealed(true)
    setRevealPrompt(false)
    setSubmitted(false)
    if (user && imageData?.id_imagen) {
      supabase.from('intentos').insert([{
        prompt_usuario: '[REVEALED]',
        puntaje_similitud: 94,
        id_imagen: imageData.id_imagen,
        id_usuario: user.id,
        fecha_hora: nowAR(),
        modo: mode,
        is_ranked: false,
      }]).then(() => {})
    } else if (!user && imageData?.id_imagen) {
      // Guardar reveal para asignarlo al registrarse
      try {
        const existing = JSON.parse(sessionStorage.getItem('guestAttempts') || '[]')
        existing.push({
          prompt_usuario: '[REVEALED]',
          puntaje_similitud: 94,
          id_imagen: imageData.id_imagen,
          fecha_hora: nowAR(),
          modo: mode,
          is_ranked: false,
        })
        sessionStorage.setItem('guestAttempts', JSON.stringify(existing))
      } catch { /* silencioso */ }
    }
  }

  // Cicla entre daily y random al hacer click en el badge de modo
  const handleModeToggle = () => {
    if (mode === 'challenge') return
    const next = mode === 'daily' ? 'random' : 'daily'
    setMode(next)
    handleReset()
  }

  const getAttemptDotClass = (i) => {
    const base = 'h-2 rounded-full transition-all duration-500'
    if (i < imageAttempts) return base + ' bg-violet-500 flex-1'
    return base + ' bg-slate-200 dark:bg-slate-700 flex-1'
  }

  // Gráfico de progresión con recharts — mismo estilo que el perfil
  const progressChart = attemptHistory.length > 0 ? (() => {
    const chartData = attemptHistory.map((a, i) => ({ n: i + 1, score: a.score, prompt: a.prompt }))
    const best = Math.max(...attemptHistory.map(a => a.score))
    const last = attemptHistory[attemptHistory.length - 1]
    const prev = attemptHistory.length > 1 ? attemptHistory[attemptHistory.length - 2] : null
    const trend = prev ? last.score - prev.score : 0
    const accentColor = '#8b5cf6'

    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {lang === 'en' ? 'Your progress' : 'Tu progreso'}
          </p>
          <div className="flex items-center gap-3">
            {trend !== 0 && (
              <span className={['text-xs font-bold', trend > 0 ? 'text-emerald-500' : 'text-rose-400'].join(' ')}>
                {trend > 0 ? '▲ +' : '▼ '}{trend}pts
              </span>
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {lang === 'en' ? 'Best ' : 'Mejor '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{best}%</span>
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accentColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="n" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
              tickFormatter={v => '#' + v} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
              tickFormatter={v => v + '%'} ticks={[0, 50, 100]} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                const c = d.score >= 70 ? '#10b981' : d.score >= 50 ? '#f59e0b' : '#ef4444'
                return (
                  <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 px-3 py-2 shadow-lg text-xs space-y-1 min-w-[90px]">
                    <p className="text-slate-400">{lang === 'en' ? 'Attempt' : 'Intento'} #{d.n}</p>
                    <p className="text-base font-bold" style={{ color: c }}>{d.score}%</p>
                  </div>
                )
              }}
            />
            <Area type="monotone" dataKey="score" stroke={accentColor} strokeWidth={2}
              fill="url(#progressGrad)"
              dot={{ r: 3, fill: accentColor, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: accentColor }}
              isAnimationActive animationDuration={800} animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  })() : null

  // Panel de análisis completo post-reveal
  const scColor = (s) => s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444'
  const revealedAnalysisPanel = promptRevealed && imageData?.prompt_original ? (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* Header */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1">
              {lang === 'en' ? 'Original prompt' : 'Prompt original'}
            </p>
            <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed italic">
              &ldquo;{imageData.prompt_original}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Gráfico de progresión */}
      {progressChart}

      {/* Análisis por intento */}
      {attemptHistory.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {lang === 'en' ? 'Attempt breakdown' : 'Análisis por intento'}
            </p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {attemptHistory.map((a, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: scColor(a.score) }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: a.score + '%', backgroundColor: scColor(a.score) }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums" style={{ color: scColor(a.score) }}>
                    {a.score}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mb-1.5 line-clamp-2">
                  &ldquo;{a.prompt}&rdquo;
                </p>
                {a.improvements?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.improvements.slice(0, 3).map((imp, j) => (
                      <span key={j} className="rounded-md bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 px-1.5 py-0.5 text-[10px] text-rose-600 dark:text-rose-400">
                        {imp}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acción */}
      <button
        type="button"
        onClick={handleNewRandom}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition"
        style={{ backgroundColor: 'rgb(var(--color-accent))' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent-2))'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent))'}
      >
        {lang === 'en' ? 'Try a new image' : 'Probar con otra imagen'}
      </button>
    </div>
  ) : null

  const remaining = MAX_ATTEMPTS_BEFORE_UNLOCK - imageAttempts
  const unlocked = imageAttempts >= MAX_ATTEMPTS_BEFORE_UNLOCK

  const attemptsIndicator = imageData && !promptRevealed && mode !== 'daily' ? (
    <div className="relative group/attempts">
      <div className={[
        'rounded-xl border px-3 py-2.5 transition-all',
        unlocked
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      ].join(' ')}>
        <div className="flex items-center gap-3">
          {/* Icono */}
          <div className={[
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
            unlocked
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
          ].join(' ')}>
            {unlocked
              ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
              : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4" /></svg>
            }
          </div>

          {/* Texto + barra */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className={[
                'text-xs font-semibold',
                unlocked ? 'text-amber-800 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'
              ].join(' ')}>
                {unlocked
                  ? (lang === 'en' ? '🔓 Prompt unlocked!' : '🔓 ¡Prompt desbloqueado!')
                  : (lang === 'en' ? 'Prompt hint' : 'Pista del prompt')}
              </p>
              <span className={[
                'text-[10px] font-bold tabular-nums',
                unlocked ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
              ].join(' ')}>
                {imageAttempts}/{MAX_ATTEMPTS_BEFORE_UNLOCK}
              </span>
            </div>
            {/* Barra de progreso */}
            <div className="flex gap-1">
              {Array.from({ length: MAX_ATTEMPTS_BEFORE_UNLOCK }).map((_, i) => (
                <div key={i} className={getAttemptDotClass(i)} />
              ))}
            </div>
            <p className={[
              'text-[10px] mt-1.5',
              unlocked ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400 dark:text-slate-500'
            ].join(' ')}>
              {unlocked
                ? (lang === 'en' ? 'Tap to reveal or keep trying' : 'Tocá para ver o seguir intentando')
                : imageAttempts === 0
                  ? (lang === 'en' ? 'Submit prompts to unlock the original' : 'Enviá prompts para desbloquear el original')
                  : (lang === 'en'
                    ? remaining + ' more ' + (remaining === 1 ? 'attempt' : 'attempts') + ' to unlock'
                    : remaining + ' ' + (remaining === 1 ? 'intento' : 'intentos') + ' más para desbloquear')}
            </p>
          </div>

          {/* Flecha si desbloqueado */}
          {unlocked && (
            <svg className="h-4 w-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Tooltip hover */}
      <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover/attempts:block z-50 w-64">
        <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-xl space-y-1.5">
          <p className="font-semibold text-violet-300">
            {lang === 'en' ? 'How the hint system works' : 'Cómo funciona el sistema de pistas'}
          </p>
          <p className="text-slate-300 leading-relaxed">
            {lang === 'en'
              ? 'Each time you submit a prompt, you get closer to unlocking the original. After ' + MAX_ATTEMPTS_BEFORE_UNLOCK + ' attempts you can choose to reveal it and learn from it.'
              : 'Cada vez que enviás un prompt, te acercás más a desbloquear el original. Después de ' + MAX_ATTEMPTS_BEFORE_UNLOCK + ' intentos podés elegir verlo y aprender de él.'}
          </p>
          {unlocked
            ? <p className="text-amber-400 font-medium">{lang === 'en' ? '✓ You can now reveal the original prompt.' : '✓ Ya podés ver el prompt original.'}</p>
            : <p className="text-slate-400">{lang === 'en' ? 'Keep trying — the more you practice, the better your prompts get.' : 'Seguí intentando — cuanto más practicás, mejores son tus prompts.'}</p>
          }
        </div>
        <div className="ml-3 h-2 w-2 rotate-45 bg-slate-900 -mt-1" />
      </div>

      {/* Clickeable si desbloqueado */}
      {unlocked && (
        <button
          type="button"
          onClick={() => setRevealPrompt(true)}
          className="absolute inset-0 rounded-xl"
          aria-label={lang === 'en' ? 'Reveal original prompt' : 'Ver prompt original'}
        />
      )}
    </div>
  ) : null

  const renderControls = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Nueva imagen aleatoria — solo en random y cuando no se ha enviado */}
      {mode === 'random' && !submitted && (
        <button
          type="button"
          onClick={handleNewRandom}
          title={t('newRandom')}
          className="flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  )

  if (!user && showLanding) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <LandingPage onOpenAuth={handleOpenAuth} onTryApp={handleTryApp} />
        <AuthModal
          open={authModalOpen}
          onClose={handleCloseAuth}
          onSignInWithGoogle={signInWithGoogle}
          onSignInWithEmail={signInWithEmail}
          onSignUpWithEmail={signUpWithEmail}
          inviteCompany={inviteState === 'prompt_login' ? inviteCompany : null}
        />
      </div>
    )
  }

  // Si el usuario es empresa, esperar a cargar el tipo de usuario
  if (user && userTypeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="text-center text-slate-600">{t('loading') || 'Loading...'}</div>
      </div>
    )
  }

  if (user && userType === 'enterprise') {
    return <EnterprisePanel user={user} />
  }

  // Si es individual, mostrar juego
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header companyRefreshKey={inviteState === 'joined' ? 1 : 0} />

      {suspensionInfo && (
        <div className="bg-rose-600 px-4 py-3 text-center text-sm font-medium text-white">
          {suspensionInfo.reason}
          {suspensionInfo.until && ` Hasta el ${suspensionInfo.until}.`}
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-2">
        <div className="overflow-hidden rounded-2xl bg-slate-50">
          <div className="grid lg:items-stretch lg:grid-cols-[1.2fr_1fr]">
            <section className="flex flex-col justify-center space-y-4 p-6 lg:p-8">
              <div className="space-y-4">
                {/* Banner de invitación a empresa */}
                {inviteCompanyId && inviteState && inviteState !== 'prompt_login' && (
                  <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                    inviteState === 'joined' ? 'border-emerald-200 bg-emerald-50' :
                    inviteState === 'already' ? 'border-slate-200 bg-slate-50' :
                    inviteState === 'error' ? 'border-rose-200 bg-rose-50' :
                    'border-violet-200 bg-violet-50'
                  }`}>
                    {inviteCompany?.avatar_url && (
                      <img src={proxyImg(inviteCompany.avatar_url)} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
                    )}
                    <p className={`text-sm font-medium ${
                      inviteState === 'joined' ? 'text-emerald-800' :
                      inviteState === 'already' ? 'text-slate-600' :
                      inviteState === 'error' ? 'text-rose-700' :
                      'text-violet-800'
                    }`}>
                      {inviteState === 'loading' && (lang === 'en' ? 'Joining company...' : 'Uniéndote a la empresa...')}
                      {inviteState === 'joined' && `✓ ${lang === 'en' ? `You joined ${inviteCompany?.company_name || 'the company'}!` : `¡Te uniste a ${inviteCompany?.company_name || 'la empresa'}!`}`}
                      {inviteState === 'already' && (lang === 'en' ? 'You are already a member of a company.' : 'Ya sos miembro de una empresa.')}
                      {inviteState === 'error' && (lang === 'en' ? 'Could not join. Try again.' : 'No se pudo unir. Intentá de nuevo.')}
                    </p>
                  </div>
                )}

                {/* Banner de desafío de empresa */}
                {mode === 'challenge' && challengeCompany && (
                  <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <div className="relative shrink-0">
                      <div className="h-9 w-9 rounded-xl overflow-hidden bg-violet-200 flex items-center justify-center border border-violet-300">
                        {challengeCompany.avatar_url
                          ? <img src={proxyImg(challengeCompany.avatar_url)} alt="" className="h-full w-full object-cover" />
                          : <span className="text-xs font-bold text-violet-700">
                              {(challengeCompany.company_name || challengeCompany.nombre_display || 'E').substring(0,2).toUpperCase()}
                            </span>
                        }
                      </div>
                      {challengeCompany.verified && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-600 ring-1 ring-white">
                          <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z"/>
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-violet-800">
                        {lang === 'en' ? 'Company challenge' : 'Desafío de empresa'}
                      </p>
                      <p className="text-sm font-bold text-violet-900 truncate">
                        {challengeCompany.company_name || challengeCompany.nombre_display}
                      </p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <span className="rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                        {imageData?.image_diff || 'Medium'}
                      </span>
                    </div>
                  </div>
                )}
                {mode === 'challenge' && !challengeCompany && (
                  <div className="flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <span className="text-violet-600 text-sm">🎯</span>
                    <p className="text-sm font-semibold text-violet-800">
                      {t('companyChallenge') || 'Desafío personalizado de tu empresa'}
                    </p>
                  </div>
                )}
                {!submitted ? (
                  <>
                    {mode === 'daily' && dailyDone ? (
                      <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-6 text-center">
                        <p className="text-base font-semibold text-emerald-800">{t('dailyDoneTitle')}</p>
                        <p className="mt-1 text-sm text-emerald-600">{t('dailyDoneDesc')}</p>
                        <button onClick={() => { setMode('random') }}
                          className="mt-4 rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800">
                          {t('goToRandom')}
                        </button>
                      </div>
                    ) : promptRevealed ? (
                      revealedAnalysisPanel
                    ) : (
                      <>
                        <PromptInput
                          promptUsuario={promptUsuario}
                          setPromptUsuario={setPromptUsuario}
                          onSubmit={handleSubmit}
                          isLoading={imageStatus === 'loading' || analyzing}
                          disabled={isDisabled}
                          mode={mode}
                          difficulty={imageData?.image_diff ?? difficulty}
                          onTimingChange={setTimingData}
                          paused={imagePreviewOpen}
                          isRanked={isRanked}
                          onToggleRanked={challengeId ? null : setIsRanked}
                          streak={user ? userStreak : 0}
                          imageId={imageData?.id_imagen || null}
                          availableDiffs={availableDiffs}
                          onModeChange={mode !== 'challenge' ? handleModeToggle : null}
                          onNewRandom={mode === 'random' && !challengeId ? handleNewRandom : null}
                          onDifficultyChange={mode === 'random' && !challengeId ? (newDiff) => {
                            setDifficulty(newDiff)
                            handleReset()
                          } : null}
                          personalizedTime={personalizedTime}
                        />
                        {progressChart}
                        {attemptsIndicator}
                        {promptRevealed && revealedAnalysisPanel}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {analyzing ? (
                      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
                        <p className="mt-4 text-sm text-slate-600">{t('analyzingPrompt')}</p>
                      </div>
                    ) : (
                      <>
                        {progressChart}
                        <ResultPanel
                          scorePercent={scorePercent}
                          explanation={aiExplanation}
                          suggestions={suggestions}
                          difficulty={imageData?.image_diff ?? difficulty}
                          improvements={improvements}
                          timePenaltyMessage={timePenaltyMessage}
                          recommendedGuideIds={recommendedGuideIds}
                          eloDelta={eloDelta}
                          onRetry={scorePercent !== null && scorePercent < 60 ? handleRetry : undefined}
                          onReset={handleReset}
                          onNewRandom={mode !== 'challenge' ? handleNewRandom : undefined}
                          mode={mode}
                        />
                        {attemptsIndicator}
                      </>
                    )}
                  </>
                )}
              </div>
            </section>

            <aside className="flex flex-col items-stretch justify-center gap-4 p-4 transition-all duration-500">
              <div className="w-full relative" style={{ height: 'calc(100vh - 120px)' }}>
                <ImageCard
                  mode={mode}
                  data={imageData ?? {}}
                  imageStatus={imageStatus}
                  onPreviewChange={setImagePreviewOpen}
                />
                {/* Overlay imagen vencida */}
                {submitted && scorePercent > 93 && (
                  <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-500">
                    <div className="text-center px-6 space-y-3">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30">
                        <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">
                          {lang === 'en' ? 'Image conquered!' : '¡Imagen vencida!'}
                        </p>
                        <p className="text-sm text-slate-300 mt-1">
                          {lang === 'en' ? 'You scored ' : 'Sacaste '}<span className="font-bold text-emerald-400">{scorePercent}%</span>
                          {lang === 'en' ? ' — this image won\'t appear again.' : ' — esta imagen no te va a aparecer más.'}
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

          </div>
        </div>
      </main>

      <Footer />

      {/* Modal de desbloqueo del prompt original */}
      {revealPrompt && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setRevealPrompt(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
                <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {lang === 'en' ? 'Original prompt unlocked' : 'Prompt original desbloqueado'}
              </h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'en'
                  ? 'You\'ve used all your attempts. You can reveal the original prompt to learn from it, or keep trying on your own.'
                  : 'Usaste todos tus intentos. Podés ver el prompt original para aprender, o seguir intentando por tu cuenta.'}
              </p>
            </div>

            {/* Opciones */}
            <div className="px-4 pb-5 space-y-2.5">
              <button
                type="button"
                onClick={handleRevealOriginalPrompt}
                className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {lang === 'en' ? 'Reveal & learn' : 'Ver y aprender'}
              </button>
              <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 -mt-1">
                {lang === 'en'
                  ? 'This image won\'t appear again in your random games.'
                  : 'Esta imagen no te va a aparecer más en tus partidas aleatorias.'}
              </p>
              <button
                type="button"
                onClick={() => setRevealPrompt(false)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {lang === 'en' ? 'Keep trying' : 'Seguir intentando'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
