import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Header from './components/Header'
import Footer from './components/Footer'
import ImageCard from './components/ImageCard'
import PromptInput from './components/PromptInput'
import ResultPanel from './components/ResultPanel'
import SplashScreen from './components/SplashScreen'
import { checkSuspension } from './services/plagiarismService'
import { checkClipboardForGameImage } from './services/aiDetectionService'
import { getRecommendedGuides } from './data/guides'
import { api } from './lib/apiClient'
import { useAuth } from './hooks/useAuth'
import { useLang } from './contexts/LangContext'
import { useWindowFocus } from './hooks/useWindowFocus'
import { proxyImg } from './utils/imgProxy'

// Lazy load de componentes pesados que no se usan inmediatamente
const LandingPage = lazy(() => import('./components/LandingPage'))
const EnterpriseLanding = lazy(() => import('./components/EnterpriseLanding'))
const AuthModal = lazy(() => import('./components/AuthModal'))
const EnterprisePanel = lazy(() => import('./components/EnterprisePanel'))
const ConfigModal = lazy(() => import('./components/ConfigModal'))
const EnterpriseOnboarding = lazy(() => import('./components/EnterpriseOnboarding'))
const UserOnboarding = lazy(() => import('./components/UserOnboarding'))

// Initialize visual mode on app load — but NOT on landing page
import('./components/ConfigModal').then(({ loadVisualMode, applyVisualMode }) => {
  // Will be applied once user leaves landing (see useEffect in App)
  // Store the mode but don't apply yet — landing is always clean
})

// ── Config demo para guests ───────────────────────────────────────────────────
// Los guests ven una imagen Easy aleatoria (diferente en cada sesión, persistida en
// sessionStorage para no cambiar dentro de la misma sesión). La daily es la misma
// para todos — registrados y no registrados.
const GUEST_MAX_ATTEMPTS = 4

// Columnas reales: id_imagen, url_image, prompt_original, seed, fecha, image_diff, image_theme
const normalizeImageData = (row) => {
  if (!row) return null
  // Spread all fields first so challenge-specific columns (challenge_eval_instructions, etc.)
  // are preserved, then overwrite the fields we normalize.
  return {
    ...row,
    id_imagen: row.id_imagen ?? null,
    url_image: row.url_image ? `/api/img-proxy?url=${encodeURIComponent(row.url_image)}` : null,
    // prompt_original NO se guarda en estado — se fetcha al momento del submit
    seed: row.seed ?? null,
    fecha: row.fecha ?? null,
    image_diff: row.image_diff ?? 'Medium',
    image_theme: row.image_theme ?? '',
  }
}

const normalizeDifficulty = (difficulty = 'Medium') => difficulty.toLowerCase()

/**
 * Calcula tiempo recomendado personalizado basado en el historial del usuario
 * @param {string} userId - ID del usuario
 * @param {string} difficulty - Dificultad del desafío
 * @returns {Promise<number>} - Tiempo recomendado en segundos
 */
const getPersonalizedTime = async (userId, difficulty = 'Medium') => {
  // Tiempos base por dificultad (fallback)
  const baseTime = { easy: 90, medium: 150, hard: 240 }
  const nd = normalizeDifficulty(difficulty)
  const defaultTime = baseTime[nd] || baseTime.medium

  if (!userId) return defaultTime

  try {
    // El promedio ponderado del historial se calcula server-side.
    const data = await api.get(`/intentos/tiempo-personalizado?difficulty=${encodeURIComponent(difficulty)}`)
    return data?.recommended_seconds ?? defaultTime
  } catch (error) {
    console.error('Error calculating personalized time:', error)
    return defaultTime
  }
}

function App() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const { t, lang } = useLang()
  const { start: startFocusTracking, reset: resetFocusTracking, getReport: getFocusReport } = useWindowFocus({ enabled: true })
  const [showLanding, setShowLanding] = useState(true)
  const [showEnterpriseLanding, setShowEnterpriseLanding] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authPreselect, setAuthPreselect] = useState(null)
  const [userType, setUserType] = useState(null)
  const [userTypeLoading, setUserTypeLoading] = useState(false)
  const [userStreak, setUserStreak] = useState(0)
  const [userHasCompany, setUserHasCompany] = useState(false)
  const [showEnterpriseOnboarding, setShowEnterpriseOnboarding] = useState(false)
  const [showUserOnboarding, setShowUserOnboarding] = useState(false)
  const [promptUsuario, setPromptUsuario] = useState('')
  const [aiExplanation, setAiExplanation] = useState('')
  const [scorePercent, setScorePercent] = useState(null)
  const [eloDelta, setEloDelta] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [mode, setMode] = useState('random')
  const [difficulty, setDifficulty] = useState('Medium')
  const [configOpen, setConfigOpen] = useState(false)
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
  // Contador de intentos del guest en la imagen demo (0-4)
  const [guestAttemptCount, setGuestAttemptCount] = useState(() => {
    return parseInt(sessionStorage.getItem('guestDemoAttempts') || '0', 10)
  })
  const guestDemoLocked = !user && guestAttemptCount >= GUEST_MAX_ATTEMPTS
  // Modo desafío de empresa
  const [challengeCompany, setChallengeCompany] = useState(null) // { company_name, avatar_url, verified }
  const challengeId = new URLSearchParams(window.location.search).get('challenge')
  const inviteCompanyId = new URLSearchParams(window.location.search).get('invite')
  // Email al que la empresa envió la invitación (link ?invite=CO&email=...).
  // Se usa para abrir el registro ya prefijado con ese email, de modo que el
  // alta quede vinculada a la invitación (join_company_by_link matchea por email).
  const inviteEmail = new URLSearchParams(window.location.search).get('email')
  const [inviteState, setInviteState] = useState(null)
  const [inviteCompany, setInviteCompany] = useState(null)
  const [imageAttempts, setImageAttempts] = useState(0)
  const [revealPrompt, setRevealPrompt] = useState(false)
  const [promptRevealed, setPromptRevealed] = useState(false)
  const [revealedPromptText, setRevealedPromptText] = useState('') // se llena solo al revelar, nunca antes
  const [attemptHistory, setAttemptHistory] = useState([]) // [{score, prompt, strengths, improvements}]
  const MAX_ATTEMPTS_BEFORE_UNLOCK = 4
  const [aiCheatDetected, setAiCheatDetected] = useState(null) // { penalty, severity, confidence }
  const [isRanked, setIsRanked] = useState(true) // toggle modo rankeado
  const [clipboardPermission, setClipboardPermission] = useState('prompt') // 'granted' | 'denied' | 'prompt' | 'checking'
  const [personalizedTime, setPersonalizedTime] = useState(null)
  const [showAnticheatWarning, setShowAnticheatWarning] = useState(false)
  const anticheatTimerRef = useRef(null)
  const guestToastTimerRef = useRef(null)
  const [guestFeatureToast, setGuestFeatureToast] = useState('')

  const showGuestFeatureToast = (message) => {
    setGuestFeatureToast(message)
    if (guestToastTimerRef.current) clearTimeout(guestToastTimerRef.current)
    guestToastTimerRef.current = setTimeout(() => setGuestFeatureToast(''), 4000)
  }

  // Limpiar timers al desmontar
  useEffect(() => () => {
    if (anticheatTimerRef.current) clearTimeout(anticheatTimerRef.current)
    if (guestToastTimerRef.current) clearTimeout(guestToastTimerRef.current)
  }, [])
  const recommendedGuideIds = getRecommendedGuides(improvements, suggestions)

  // Resetear intentos y reveal cuando cambia la imagen
  useEffect(() => {
    setImageAttempts(0)
    setRevealPrompt(false)
    setPromptRevealed(false)
    setRevealedPromptText('')
    setAttemptHistory([])
  }, [imageData?.id_imagen])

  // Detectar DevTools abierto — limpiar prompt revelado de memoria si se abre
  useEffect(() => {
    const threshold = 160
    let devtoolsOpen = false
    const check = () => {
      const widthDiff = window.outerWidth - window.innerWidth > threshold
      const heightDiff = window.outerHeight - window.innerHeight > threshold
      const isOpen = widthDiff || heightDiff
      if (isOpen && !devtoolsOpen) {
        devtoolsOpen = true
        setRevealedPromptText('')
      } else if (!isOpen) {
        devtoolsOpen = false
      }
    }
    const interval = setInterval(check, 1000)
    return () => clearInterval(interval)
  }, [])

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
        // Público, gateado server-side: nunca trae prompt_original ni
        // challenge_eval_instructions (el server ya no necesita que el
        // cliente se los reenvíe — los usa internamente en POST /api/intentos).
        const data = await api.get(`/imagenes/${challengeId}`, { auth: false })
        if (!data) { setImageStatus('error'); return }
        setImageData(normalizeImageData(data))
        setDifficulty(data.image_diff || 'Medium')
        setMode('challenge')
        setImageStatus('ok')
        startFocusTracking()
        // Cargar datos de la empresa
        if (data.company_id) {
          try {
            const co = await api.get(`/usuarios/${data.company_id}`, { auth: false })
            setChallengeCompany(co || null)
          } catch { setChallengeCompany(null) }
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
      try {
        const data = await api.get(`/usuarios/${inviteCompanyId}`, { auth: false })
        setInviteCompany(data?.user_type === 'enterprise' ? data : null)
      } catch {
        setInviteCompany(null)
      }
    }
    loadInviteCompany()

    if (!user) {
      // No logueado — mostrar banner + modal de login
      setInviteState('prompt_login')
      setAuthModalOpen(true)
      return
    }

    // Logueado (o recién registrado) — unirse automáticamente
    // Evitar re-ejecutar si ya se unió o está en proceso
    if (inviteState === 'joined' || inviteState === 'loading') return

    const joinCompany = async () => {
      setInviteState('loading')
      try {
        await api.post('/enterprise/unirse', { company_id: inviteCompanyId })
        setInviteState('joined')
        // Limpiar URL sin recargar
        window.history.replaceState({}, '', '/')
      } catch (e) {
        if (e.message?.includes('Already member')) {
          setInviteState('already')
        } else {
          setInviteState('error')
        }
      }
    }
    joinCompany()
  }, [inviteCompanyId, user?.id])

  // Verificar permiso de portapapeles al montar y cuando el usuario vuelve a la pestaña
  useEffect(() => {
    const checkClipboardPermission = async () => {
      setClipboardPermission('checking')
      try {
        const result = await navigator.permissions.query({ name: 'clipboard-read' })
        setClipboardPermission(result.state) // 'granted' | 'denied' | 'prompt'
        // Escuchar cambios en tiempo real (si el usuario cambia el permiso en config del browser)
        result.onchange = () => setClipboardPermission(result.state)
      } catch {
        // Navegador no soporta permissions API (Firefox) — asumir granted para no bloquear
        setClipboardPermission('granted')
      }
    }
    checkClipboardPermission()
  }, [])

  const requestClipboardPermission = async () => {
    try {
      await navigator.clipboard.readText()
      setClipboardPermission('granted')
      // Mostrar aviso 15s al otorgar permiso por primera vez
      flashAnticheatWarning(15000)
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        setClipboardPermission('denied_hard')
      } else {
        setClipboardPermission('granted')
        flashAnticheatWarning(15000)
      }
    }
  }

  // Muestra el aviso antitrampa por `ms` milisegundos y luego lo oculta
  const flashAnticheatWarning = (ms = 9000) => {
    if (anticheatTimerRef.current) clearTimeout(anticheatTimerRef.current)
    setShowAnticheatWarning(true)
    anticheatTimerRef.current = setTimeout(() => {
      setShowAnticheatWarning(false)
      anticheatTimerRef.current = null
    }, ms)
  }

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
      // Onboarding para guests — solo la primera vez
      if (!localStorage.getItem('user_onboarded_guest')) {
        setShowUserOnboarding(true)
      }
      return
    }

    const fetchUserType = async () => {
      setUserTypeLoading(true)
      let data = null
      try { data = await api.get('/usuarios/me') } catch { /* silencioso */ }
      const type = data?.user_type || 'individual'
      setUserType(type)
      setUserStreak(data?.racha_actual || 0)
      setUserHasCompany(!!data?.company_id)
      setUserTypeLoading(false)

      // Onboarding — solo una vez por usuario
      if (type === 'enterprise' && !data?.enterprise_onboarded) {
        setShowEnterpriseOnboarding(true)
      } else if (type !== 'enterprise' && !data?.user_onboarded) {
        setShowUserOnboarding(true)
      }
    }
    fetchUserType()
  }, [user?.id])

  useEffect(() => {
    if (user) setShowLanding(false)
  }, [user])

  // Apply visual mode only when NOT on landing page
  useEffect(() => {
    import('./components/ConfigModal').then(({ loadVisualMode, applyVisualMode }) => {
      if (showLanding) {
        // Landing always shows clean — remove any visual mode classes
        applyVisualMode('default')
      } else {
        // Restore user's chosen visual mode
        applyVisualMode(loadVisualMode())
      }
    })
  }, [showLanding])

  // Al loguearse, limpiar restos de sessionStorage de guest — ya no se migran
  // intentos (el scoring es server-authoritative desde POST /api/intentos, así
  // que un guest ya persiste su intento al momento de jugarlo, sin usuario
  // asociado; no hay nada para re-atribuir al crear la cuenta).
  useEffect(() => {
    if (!user) return
    sessionStorage.removeItem('guestAttempts')
    sessionStorage.removeItem('pendingAttempt')
    sessionStorage.removeItem('guestImageId')
  }, [user?.id])

  // Fetch inicial: extrae las dificultades disponibles en la BD
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const found = await api.get('/imagenes/dificultades')
        const diffOrder = ['Easy', 'Medium', 'Hard']
        setAvailableDiffs(diffOrder.filter((d) => found.includes(d)))
      } catch { /* silencioso */ }
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
      let done = false
      try {
        const res = await api.get('/intentos/daily-hecho')
        done = res?.done === true
      } catch { /* silencioso */ }
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

    // Guest sin cuenta — cargar imagen según modo
    if (!user) {
      setImageStatus('loading')
      ;(async () => {
        try {
          let row = null

          if (mode === 'daily') {
            // Daily: misma imagen del día que para usuarios registrados
            const hoy = new Date()
            hoy.setHours(23, 59, 59, 999)
            const rows = await api.get(`/imagenes?daily=true&before=${encodeURIComponent(hoy.toISOString())}&limit=1`)
            row = rows?.[0] ?? null
          } else {
            // Random: imagen Easy aleatoria, persistida en sessionStorage para
            // que no cambie si el usuario recarga dentro de la misma sesión
            const savedId = sessionStorage.getItem('guestImageId')
            if (savedId) {
              try {
                const data = await api.get(`/imagenes/${savedId}`)
                if (data && !data.company_id) row = data
              } catch { /* imagen borrada o inválida — elegir una nueva abajo */ }
            }
            if (!row) {
              // Sin imagen guardada (primera visita o sesión nueva): elegir una Easy al azar
              const rows = await api.get('/imagenes?dificultad=Easy&random=true&limit=1')
              if (rows && rows.length > 0) row = rows[0]
            }
            if (row) sessionStorage.setItem('guestImageId', row.id_imagen)
          }

          if (!row) { setImageStatus('empty'); return }
          setImageData(normalizeImageData(row))
          setDifficulty(row.image_diff || 'Easy')
          setImageStatus('ok')
          startFocusTracking()
        } catch {
          setImageStatus('error')
        }
      })()
      return
    }

    let cancelled = false

    const fetchImageData = async () => {
      setImageStatus('loading')

      try {
        // No traer prompt_original en la carga inicial — se fetcha al submit
        let qs = ''
        if (mode === 'daily') {
          const hoy = new Date()
          hoy.setHours(23, 59, 59, 999)
          qs = `daily=true&before=${encodeURIComponent(hoy.toISOString())}&limit=1`
        } else {
          qs = difficulty ? `dificultad=${encodeURIComponent(difficulty)}&limit=100` : 'limit=100'
        }

        const data = await api.get(`/imagenes?${qs}`)
        if (cancelled) return

        if (!data || data.length === 0) {
          setImageStatus('empty')
          return
        }

        let rows = data.map(normalizeImageData).filter(r => r && r.url_image)

        if (mode === 'random') {
          const dailyId = [...rows].sort((a, b) =>
            new Date(b.fecha) - new Date(a.fecha)
          )[0]?.id_imagen
          const withoutDaily = rows.filter(r => r.id_imagen !== dailyId)
          if (withoutDaily.length > 0) rows = withoutDaily
        }

        if (cancelled) return
        if (rows.length === 0) {
          setImageStatus('empty')
          return
        }

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
        startFocusTracking()
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
        const data = await api.get(`/imagenes?daily=true&before=${encodeURIComponent(manana.toISOString())}&limit=2`)
        const nextUrl = data?.[1]?.url_image
        if (nextUrl) {
          const img = new Image()
          img.src = nextUrl
        }
      } catch { /* silencioso */ }
    }
    prefetch()
  }, [mode, challengeId])

  // Cambiar imagen cuando el usuario pierde el foco de la ventana (anti-trampa)
  // Solo aplica en modo random, antes de enviar el prompt
  useEffect(() => {
    if (submitted || mode !== 'random' || challengeId || !imageData) return

    let blurTimer = null

    const handleBlur = () => {
      blurTimer = setTimeout(() => {
        if (!document.hasFocus()) {
          flashAnticheatWarning(9000)
          handleForcedImageChange('blur')
        }
      }, 400)
    }

    const handleFocus = () => {
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        flashAnticheatWarning(9000)
        handleForcedImageChange('visibility')
      }
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (blurTimer) clearTimeout(blurTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, mode, challengeId, imageData?.id_imagen])

  // Polling de portapapeles — si cambia el contenido (texto o imagen) en los últimos 3s
  // mientras el usuario está jugando, cambia la imagen (detecta Win+Shift+S y similares)
  useEffect(() => {
    if (submitted || mode !== 'random' || challengeId || !imageData) return
    if (clipboardPermission !== 'granted') return
    if (!navigator.clipboard?.read) return

    const getClipboardFingerprint = async () => {
      try {
        const items = await navigator.clipboard.read()
        if (!items.length) return null
        const item = items[0]
        const types = [...item.types].sort().join(',')
        let textSample = ''
        if (item.types.includes('text/plain')) {
          try {
            const blob = await item.getType('text/plain')
            textSample = (await blob.text()).slice(0, 50)
          } catch { /* ignorar */ }
        }
        let imageSize = 0
        const imageType = item.types.find(t => t.startsWith('image/'))
        if (imageType) {
          try {
            const blob = await item.getType(imageType)
            imageSize = blob.size
          } catch { /* ignorar */ }
        }
        return `${types}|${textSample}|${imageSize}`
      } catch {
        return null // permiso denegado u otro error — no hacer nada
      }
    }

    let lastFingerprint = null
    let interval = null
    let active = true

    const startPolling = async () => {
      // Snapshot inicial — esperar 800ms para que el estado del clipboard se estabilice
      await new Promise(r => setTimeout(r, 800))
      if (!active) return

      lastFingerprint = await getClipboardFingerprint()

      interval = setInterval(async () => {
        if (!active) return
        const fp = await getClipboardFingerprint()
        if (fp === null || lastFingerprint === null) {
          // Error de permiso o clipboard vacío — actualizar sin disparar
          lastFingerprint = fp
          return
        }
        if (fp !== lastFingerprint) {
          lastFingerprint = fp
          flashAnticheatWarning(9000)
          handleForcedImageChange('clipboard')
        }
      }, 1500) // cada 1.5s — suficiente para detectar sin saturar
    }

    startPolling()

    return () => {
      active = false
      if (interval) clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, mode, challengeId, imageData?.id_imagen, clipboardPermission])

  const hasImage = imageStatus === 'ok' && imageData !== null
  const isDisabled = !hasImage || (mode === 'daily' && (user ? dailyDone : guestDailyDone))

  const handleSubmit = async (event, typingReport = null) => {
    event.preventDefault()
    const submittedPrompt = promptUsuario.trim()
    if (!submittedPrompt || !hasImage) return

    // Verificar suspensión antes de procesar — chequeo proactivo para UX rápida;
    // el backend igual la re-verifica y corta con 403 si hace falta.
    if (user) {
      const suspension = await checkSuspension(user.id)
      if (!suspension.allowed) { setSuspensionInfo(suspension); return }
    }

    setAnalyzing(true)
    setSubmitted(true)
    setAiCheatDetected(null)

    try {
      // Clipboard check — solo posible del lado cliente (compara píxeles contra
      // la imagen del juego). Se manda como señal server-side, no decide nada acá.
      const clipCheck = imageData?.url_image
        ? await checkClipboardForGameImage(imageData.url_image).catch(() => ({ hasImage: false, similarToGame: false, similarity: 0 }))
        : { hasImage: false, similarToGame: false, similarity: 0 }

      // POST /api/intentos: el server evalúa con el LLM, calcula score + penalización
      // de tiempo + ELO, corre anti-cheat (typing/focus/clipboard + historial) y
      // persiste todo en una transacción. El cliente nunca ve prompt_original.
      const result = await api.post('/intentos', {
        id_imagen: imageData.id_imagen,
        prompt_usuario: submittedPrompt,
        modo: mode === 'challenge' ? 'challenge' : mode,
        elapsed_seconds: timingData.elapsedSeconds,
        attempt_number: imageAttempts + 1,
        lang,
        challenge_id: challengeId || null,
        typing_report: typingReport ?? null,
        focus_report: getFocusReport(),
        clip_report: clipCheck,
        ranked: isRanked,
      })

      setScorePercent(result.score)
      setAiExplanation(result.explanation)
      setSuggestions(result.suggestions)
      setStrengths(result.strengths ?? [])
      setImprovements(result.improvements ?? [])
      setTimePenaltyMessage(result.timePenalty?.message ?? '')
      setImageAttempts(prev => prev + 1)
      if (result.aiCheat) setAiCheatDetected(result.aiCheat)
      if (result.elo) setEloDelta(result.elo.delta)
      if (result.moderacion) setSuspensionInfo({ reason: result.moderacion.mensaje })

      // Incrementar contador de intentos demo para guests
      if (!user) {
        const next = guestAttemptCount + 1
        setGuestAttemptCount(next)
        sessionStorage.setItem('guestDemoAttempts', String(next))
        // Al llegar al último intento, pre-fetchear el prompt para mostrarlo si lo pide.
        // Los guests no tienen intentos persistidos a su nombre, así que usan el
        // endpoint de demo (restringido al pool Easy/sin-empresa) en vez del reveal
        // gateado.
        if (next >= GUEST_MAX_ATTEMPTS) {
          api.post(`/imagenes/${imageData.id_imagen}/revelar-demo`, {}, { auth: false })
            .then((data) => { if (data?.prompt_original) setRevealedPromptText(data.prompt_original) })
            .catch(() => { /* fuera del pool de la demo o imagen inválida */ })
        }
      }

      setAttemptHistory(prev => [...prev, {
        score: result.score,
        prompt: submittedPrompt,
        strengths: result.strengths ?? [],
        improvements: result.improvements ?? [],
      }])

      if (mode === 'daily') {
        if (user) {
          setDailyDone(true)
          localStorage.setItem(`dailyDoneDate_${user.id}`, new Date().toDateString())
        } else {
          sessionStorage.setItem('guestDailyDate', new Date().toDateString())
          setGuestDailyDone(true)
        }
      }
    } catch (err) {
      if (err?.status === 403) {
        // Suspendido/baneado — el backend cortó antes de evaluar.
        setSuspensionInfo({ reason: err.message })
        setSubmitted(false)
      } else {
        setScorePercent(0)
        setAiExplanation('Hubo un error al analizar tu prompt.')
        setSuggestions('')
        setStrengths([])
        setImprovements([])
        setTimePenaltyMessage('')
      }
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
    setAuthPreselect(null)
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
    setAiCheatDetected(null)
    setAnalyzing(false)
    setImageAttempts(0)
    setRevealPrompt(false)
    setPromptRevealed(false)
    setRevealedPromptText('')
    setAttemptHistory([])
    if (!challengeId) setIsRanked(true)
    resetFocusTracking()
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
    setAiCheatDetected(null)
    setAnalyzing(false)
    // promptUsuario se mantiene para que el usuario lo vea y mejore
  }

  // Nueva imagen aleatoria — resetea todo y fuerza refetch en modo random
  const handleNewRandom = () => {
    handleReset()
    if (mode !== 'random') {
      setMode('random')
    } else {
      setImageStatus('loading')
      setImageData(null)

      // Guest: nueva imagen Easy al azar (diferente de la anterior)
      if (!user) {
        const prevId = sessionStorage.getItem('guestImageId')
        sessionStorage.removeItem('guestImageId')
        ;(async () => {
          try {
            const rows = await api.get('/imagenes?dificultad=Easy&limit=100')
            if (!rows || rows.length === 0) { setImageStatus('error'); return }
            // Evitar repetir la imagen anterior si hay más de una disponible
            const candidates = rows.length > 1 ? rows.filter(r => r.id_imagen !== prevId) : rows
            const selected = candidates[Math.floor(Math.random() * candidates.length)]
            sessionStorage.setItem('guestImageId', selected.id_imagen)
            setImageData(normalizeImageData(selected))
            setDifficulty('Easy')
            setImageStatus('ok')
            startFocusTracking()
          } catch { setImageStatus('error') }
        })()
        return
      }

      // Usuario logueado: lógica normal con filtros avanzados
      const fetchRandom = async () => {
        try {
          const qs = difficulty
            ? `dificultad=${encodeURIComponent(difficulty)}&excludeMastered=true&limit=100`
            : 'excludeMastered=true&limit=100'
          const data = await api.get(`/imagenes?${qs}`)
          if (!data || data.length === 0) { setImageStatus('empty'); return }
          let rows = data.map(normalizeImageData)

          // Excluir imagen del día
          const dailyId = [...rows].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]?.id_imagen
          const withoutDaily = rows.filter(r => r.id_imagen !== dailyId)
          if (withoutDaily.length > 0) rows = withoutDaily

          const selected = rows[Math.floor(Math.random() * rows.length)]
          setImageData(selected)
          setDifficulty(selected.image_diff ?? 'Medium')
          setImageStatus('ok')
        } catch { setImageStatus('error') }
      }
      fetchRandom()
    }
  }

  // Cambio forzado por anti-trampa — borra el draft antes de cambiar imagen
  const handleForcedImageChange = (reason = 'blur') => {
    // Borrar draft del imageId actual para que no se restaure en la nueva imagen
    if (imageData?.id_imagen) {
      try {
        localStorage.removeItem(`promptdraft_${imageData.id_imagen}`)
      } catch { /* silencioso */ }
    }
    handleNewRandom()
  }

  const handleRevealOriginalPrompt = async () => {
    // Fetch puntual — el prompt nunca estuvo en el estado antes de este momento
    try {
      if (user) {
        // Gating server-side: requiere sesión y al menos un intento propio sobre la imagen
        const data = await api.post(`/imagenes/${imageData.id_imagen}/revelar`)
        setRevealedPromptText(data?.prompt_original ?? '')
      } else {
        // Guests: sin intentos persistidos (juegan sin sesión). Usan el endpoint
        // de demo, restringido al pool Easy/sin-empresa.
        const data = await api.post(`/imagenes/${imageData.id_imagen}/revelar-demo`, {}, { auth: false })
        setRevealedPromptText(data?.prompt_original ?? '')
      }
    } catch { /* silencioso */ }
    setPromptRevealed(true)
    setRevealPrompt(false)
    setSubmitted(false)
    // NO guardar intento cuando se revela el prompt - es solo para aprendizaje
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
    if (i < imageAttempts) return base + ' bg-cyan-500 flex-1'
    return base + ' bg-slate-200 dark:bg-slate-700 flex-1'
  }

  const scColor = (score) => score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  // Gráfico de progresión con recharts — mismo estilo que el perfil
  const progressChart = attemptHistory.length > 0 ? (() => {
    const chartData = attemptHistory.map((a, i) => ({ n: i + 1, score: a.score, prompt: a.prompt }))
    const best = Math.max(...attemptHistory.map(a => a.score))
    const last = attemptHistory[attemptHistory.length - 1]
    const prev = attemptHistory.length > 1 ? attemptHistory[attemptHistory.length - 2] : null
    const trend = prev ? last.score - prev.score : 0
    const accentColor = '#06b6d4' // Cyan-500 profesional
    const isDark = document.documentElement.classList.contains('dark')

    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pt-2 pb-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {lang === 'en' ? 'Progress' : 'Progreso'}
          </p>
          <div className="flex items-center gap-2">
            {trend !== 0 && (
              <span className={['text-xs font-bold', trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'].join(' ')}>
                {trend > 0 ? '+' : ''}{trend}
              </span>
            )}
            <div className="relative group/progress">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-slate-100">{best}%</span>
              </span>
              
              {/* Tooltip hover - aparece abajo y por encima de todo */}
              <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/progress:block z-[200] w-48">
                <div className="mx-auto w-2 h-2 rotate-45 bg-slate-800 dark:bg-slate-700 border-l border-t border-slate-700 dark:border-slate-600 -mb-1" />
                <div className="rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-2 text-xs shadow-xl border border-slate-700 dark:border-slate-600">
                  <p className="font-semibold text-slate-100 mb-1">Tu mejor score</p>
                  <p className="text-slate-300 dark:text-slate-400 leading-relaxed">
                    Tu mejor resultado en esta imagen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accentColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={accentColor} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#475569' : '#cbd5e1'} vertical={false} />
            <XAxis dataKey="n" tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }} tickLine={false} axisLine={false}
              tickFormatter={v => (lang === 'en' ? 'Attempt ' : 'Intento ') + v} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: isDark ? '#e2e8f0' : '#334155', fontWeight: 700 }} tickLine={false} axisLine={false}
              tickFormatter={v => v + '%'} ticks={[0, 25, 50, 75, 100]} width={35} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                const c = d.score >= 70 ? '#10b981' : d.score >= 50 ? '#f59e0b' : '#ef4444'
                return (
                  <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 px-2.5 py-1.5 shadow-lg text-xs">
                    <p className="text-slate-500 dark:text-slate-400 font-medium">#{d.n}</p>
                    <p className="text-base font-bold" style={{ color: c }}>{d.score}%</p>
                  </div>
                )
              }}
            />
            <Area type="monotone" dataKey="score" stroke={accentColor} strokeWidth={2}
              fill="url(#progressGrad)"
              dot={{ r: 3, fill: accentColor, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: accentColor, stroke: isDark ? '#1e293b' : '#fff', strokeWidth: 2 }}
              isAnimationActive animationDuration={800} animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  })() : null

  // Panel de análisis completo post-reveal
  // Panel de análisis completo post-reveal - ELIMINADO, solo se muestra en la imagen
  const revealedAnalysisPanel = promptRevealed && revealedPromptText ? (
    <div className="space-y-3 animate-in fade-in duration-300">
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
        'rounded-xl border px-3.5 py-3 transition-all',
        unlocked
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
      ].join(' ')}>
        <div className="flex items-center gap-3">
          {/* Icono */}
          <div className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all',
            unlocked
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
          ].join(' ')}>
            {unlocked
              ? <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
              : <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4" /></svg>
            }
          </div>

          {/* Texto + barra */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <p className={[
                'text-sm font-semibold',
                unlocked ? 'text-amber-800 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'
              ].join(' ')}>
                {unlocked
                  ? (lang === 'en' ? 'Prompt unlocked!' : '¡Prompt desbloqueado!')
                  : (lang === 'en' 
                    ? `${remaining} more ${remaining === 1 ? 'try' : 'tries'} to see the original prompt`
                    : `Hacé ${remaining} ${remaining === 1 ? 'intento más' : 'intentos más'} para ver el prompt original`)}
              </p>
              <span className={[
                'text-xs font-bold tabular-nums',
                unlocked ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
              ].join(' ')}>
                {imageAttempts}/{MAX_ATTEMPTS_BEFORE_UNLOCK}
              </span>
            </div>
            {/* Barra de progreso */}
            <div className="flex gap-1.5">
              {Array.from({ length: MAX_ATTEMPTS_BEFORE_UNLOCK }).map((_, i) => (
                <div key={i} className={getAttemptDotClass(i)} />
              ))}
            </div>
          </div>

          {/* Flecha si desbloqueado */}
          {unlocked && (
            <svg className="h-5 w-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Tooltip hover */}
      <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover/attempts:block z-50 w-72">
        <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-xl space-y-1.5">
          <p className="font-semibold text-cyan-300">
            {lang === 'en' ? 'How it works' : '¿Cómo funciona?'}
          </p>
          <p className="text-slate-300 leading-relaxed">
            {lang === 'en'
              ? `Try to recreate the image with your own prompt. After ${MAX_ATTEMPTS_BEFORE_UNLOCK} attempts, you'll unlock the original prompt to see how it was made and learn from it!`
              : `Intentá recrear la imagen con tu propio prompt. Después de ${MAX_ATTEMPTS_BEFORE_UNLOCK} intentos, desbloqueás el prompt original para ver cómo se hizo y aprender de él.`}
          </p>
          {unlocked && (
            <p className="text-amber-400 font-medium">
              {lang === 'en' ? 'Click to reveal the original prompt' : 'Hace clic para ver el prompt original'}
            </p>
          )}
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
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
          </div>
        }>
          {showEnterpriseLanding ? (
            <EnterpriseLanding
              onBack={() => setShowEnterpriseLanding(false)}
              onOpenAuth={() => { setAuthPreselect('enterprise'); setAuthModalOpen(true) }}
            />
          ) : (
            <LandingPage
              onOpenAuth={handleOpenAuth}
              onTryApp={handleTryApp}
              onEnterprise={() => setShowEnterpriseLanding(true)}
            />
          )}
          <AuthModal
            open={authModalOpen}
            onClose={handleCloseAuth}
            onSignInWithGoogle={signInWithGoogle}
            onSignInWithEmail={signInWithEmail}
            onSignUpWithEmail={signUpWithEmail}
            inviteCompany={inviteState === 'prompt_login' ? inviteCompany : null}
            inviteEmail={inviteState === 'prompt_login' ? inviteEmail : null}
            initialPlan={authPreselect}
          />
        </Suspense>
      </div>
    )
  }

  // Si el usuario es empresa, esperar a cargar el tipo de usuario
  if (user && userTypeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />
      </div>
    )
  }

  if (user && userType === 'enterprise') {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />
        </div>
      }>
        {showEnterpriseOnboarding && (
          <EnterpriseOnboarding
            user={user}
            onDone={() => setShowEnterpriseOnboarding(false)}
          />
        )}
        <EnterprisePanel user={user} />
      </Suspense>
    )
  }

  // Si es individual, mostrar juego
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 overflow-x-hidden">
      <Header companyRefreshKey={inviteState === 'joined' ? 1 : 0} onOpenSettings={() => setConfigOpen(true)} />

      {suspensionInfo && (
        <div className="bg-rose-600 px-4 py-3 text-center text-sm font-medium text-white">
          {suspensionInfo.reason}
          {suspensionInfo.until && ` Hasta el ${suspensionInfo.until}.`}
        </div>
      )}

      <main className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 sm:py-4 sm:px-4">
        <div className="mx-auto flex max-w-7xl gap-3 items-start">
          {/* Game area */}
          <div className="flex-1 min-w-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="grid w-full lg:items-stretch lg:grid-cols-[1.2fr_1fr]">
            <section className="order-2 lg:order-1 flex flex-col justify-center space-y-4 p-4 sm:p-6 lg:p-8">
              <div className="space-y-4">
                {/* Banner de invitación a empresa */}
                {inviteCompanyId && inviteState && inviteState !== 'prompt_login' && (
                  <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                    inviteState === 'joined' ? 'border-emerald-200 bg-emerald-50' :
                    inviteState === 'already' ? 'border-slate-200 bg-slate-50' :
                    inviteState === 'error' ? 'border-rose-200 bg-rose-50' :
                    'border-cyan-200 bg-cyan-50'
                  }`}>
                    {inviteCompany?.avatar_url && (
                      <img src={proxyImg(inviteCompany.avatar_url)} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
                    )}
                    <p className={`text-sm font-medium ${
                      inviteState === 'joined' ? 'text-emerald-800' :
                      inviteState === 'already' ? 'text-slate-600' :
                      inviteState === 'error' ? 'text-rose-700' :
                      'text-cyan-800'
                    }`}>
                      {inviteState === 'loading' && (lang === 'en' ? 'Joining company...' : 'Uniéndote a la empresa...')}
                      {inviteState === 'joined' && (lang === 'en' ? `You joined ${inviteCompany?.company_name || 'the company'}!` : `Te uniste a ${inviteCompany?.company_name || 'la empresa'}!`)}
                      {inviteState === 'already' && (lang === 'en' ? 'You are already a member of a company.' : 'Ya sos miembro de una empresa.')}
                      {inviteState === 'error' && (lang === 'en' ? 'Could not join. Try again.' : 'No se pudo unir. Intentá de nuevo.')}
                    </p>
                  </div>
                )}

                {/* Banner de desafío de empresa */}
                {mode === 'challenge' && challengeCompany && (
                  <div className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                    <div className="relative shrink-0">
                      <div className="h-9 w-9 rounded-xl overflow-hidden bg-cyan-200 flex items-center justify-center border border-cyan-300">
                        {challengeCompany.avatar_url
                          ? <img src={proxyImg(challengeCompany.avatar_url)} alt="" className="h-full w-full object-cover" />
                          : <span className="text-xs font-bold text-cyan-700">
                              {(challengeCompany.company_name || challengeCompany.nombre_display || 'E').substring(0,2).toUpperCase()}
                            </span>
                        }
                      </div>
                      {challengeCompany.verified && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-600 ring-1 ring-white">
                          <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z"/>
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-cyan-800">
                        {lang === 'en' ? 'Company challenge' : 'Desafío de empresa'}
                      </p>
                      <p className="text-sm font-bold text-cyan-900 truncate">
                        {challengeCompany.company_name || challengeCompany.nombre_display}
                      </p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <span className="rounded-full bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                        {imageData?.image_diff || 'Medium'}
                      </span>
                    </div>
                  </div>
                )}
                {mode === 'challenge' && !challengeCompany && (
                  <div className="flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                    <svg className="h-4 w-4 text-cyan-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <p className="text-sm font-semibold text-cyan-800">
                      {t('companyChallenge') || 'Desafío personalizado de tu empresa'}
                    </p>
                  </div>
                )}
                {!submitted ? (
                  <>
                    {/* Banner demo para guests — muestra intentos restantes */}
                    {!user && !guestDemoLocked && (
                      <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 dark:border-violet-800/60 dark:bg-violet-950/40 px-4 py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
                          <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="-3 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">
                            {lang === 'en' ? 'Demo mode' : 'Modo demo'}
                            {' · '}
                            <span className="font-bold">
                              {GUEST_MAX_ATTEMPTS - guestAttemptCount}
                            </span>
                            {' '}
                            {lang === 'en'
                              ? `attempt${GUEST_MAX_ATTEMPTS - guestAttemptCount !== 1 ? 's' : ''} left`
                              : `intento${GUEST_MAX_ATTEMPTS - guestAttemptCount !== 1 ? 's' : ''} restante${GUEST_MAX_ATTEMPTS - guestAttemptCount !== 1 ? 's' : ''}`}
                          </p>
                          <p className="text-[11px] text-violet-600 dark:text-violet-400 leading-relaxed">
                            {lang === 'en'
                              ? 'Sign up to unlock unlimited images and track your progress.'
                              : 'Registrate para desbloquear imágenes ilimitadas y ver tu progreso.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAuth}
                          className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition"
                        >
                          {lang === 'en' ? 'Sign up' : 'Registrarse'}
                        </button>
                      </div>
                    )}
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
                    ) : clipboardPermission !== 'granted' && user ? (
                      /* ── Gate: permiso de portapapeles no otorgado (solo usuarios con cuenta) ── */
                      clipboardPermission === 'checking' ? (
                        /* Verificando permiso — spinner */
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6 flex flex-col items-center gap-3">
                          <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-cyan-500" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {lang === 'en' ? 'Checking permissions…' : 'Verificando permisos…'}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-6 space-y-4 text-center">
                          <div className="flex justify-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
                              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                              </svg>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                              {lang === 'en' ? 'Clipboard access required' : 'Se requiere acceso al portapapeles'}
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed max-w-xs mx-auto">
                              {lang === 'en'
                                ? 'PrompTool needs to read your clipboard to detect AI-assisted cheating. This keeps the game fair for everyone.'
                                : 'PrompTool necesita leer tu portapapeles para detectar trampas con IA. Esto mantiene el juego justo para todos.'}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {clipboardPermission === 'denied_hard' ? (
                              /* El navegador ya bloqueó el permiso — hay que ir a configuración */
                              <>
                                <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 px-3 py-2.5 text-left space-y-1.5">
                                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                    {lang === 'en' ? 'How to enable it:' : 'Cómo habilitarlo:'}
                                  </p>
                                  <ol className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-decimal list-inside leading-relaxed">
                                    <li>
                                      {lang === 'en'
                                        ? 'Look for the clipboard icon with a line through it in the address bar (top right of the browser)'
                                        : 'Buscá el ícono de portapapeles tachado en la barra de dirección (arriba a la derecha del navegador)'}
                                    </li>
                                    <li>
                                      {lang === 'en'
                                        ? 'Click it and select "Always allow"'
                                        : 'Hacé clic en él y seleccioná "Permitir siempre"'}
                                    </li>
                                    <li>
                                      {lang === 'en'
                                        ? 'Then click the button below to reload'
                                        : 'Luego hacé clic en el botón de abajo para recargar'}
                                    </li>
                                  </ol>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => window.location.reload()}
                                  className="w-full rounded-xl border border-amber-300 dark:border-amber-700 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:text-amber-300 transition hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                >
                                  {lang === 'en' ? 'Reload page' : 'Recargar página'}
                                </button>
                              </>
                            ) : (
                              /* Estado 'prompt' o 'denied' — mostrar botón para pedir permiso */
                              <button
                                type="button"
                                onClick={requestClipboardPermission}
                                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
                                style={{ backgroundColor: 'rgb(var(--color-accent))' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent-2))'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgb(var(--color-accent))'}
                              >
                                {lang === 'en' ? 'Grant access and play' : 'Dar acceso y jugar'}
                              </button>
                            )}
                            <p className="text-[11px] text-amber-600 dark:text-amber-500 leading-relaxed">
                              {lang === 'en'
                                ? 'This permission is only used to detect AI-assisted cheating. We never store your clipboard content.'
                                : 'Este permiso solo se usa para detectar trampas con IA. Nunca guardamos el contenido de tu portapapeles.'}
                            </p>
                          </div>
                        </div>
                      )
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
                            if (!user) {
                              showGuestFeatureToast(
                                lang === 'en'
                                  ? 'Create a free account to change difficulty and unlock all images'
                                  : 'Creá una cuenta gratis para cambiar la dificultad y desbloquear todas las imágenes'
                              )
                              return
                            }
                            setDifficulty(newDiff)
                            handleReset()
                          } : null}
                          personalizedTime={personalizedTime}
                          attemptNumber={imageAttempts + 1}
                          onOpenConfig={mode !== 'challenge' ? () => setConfigOpen(true) : null}
                          showAnticheatWarning={showAnticheatWarning && mode === 'random' && !challengeId && clipboardPermission === 'granted'}
                          attemptsIndicator={attemptsIndicator}
                          challengeId={challengeId || null}
                        />
                        {progressChart}
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
                        {attemptsIndicator}
                        {progressChart}
                        <ResultPanel
                          scorePercent={scorePercent}
                          explanation={aiExplanation}
                          suggestions={suggestions}
                          difficulty={imageData?.image_diff ?? difficulty}
                          strengths={strengths}
                          improvements={improvements}
                          timePenaltyMessage={timePenaltyMessage}
                          recommendedGuideIds={recommendedGuideIds}
                          eloDelta={eloDelta}
                          aiCheatDetected={aiCheatDetected}
                          onRetry={scorePercent !== null && scorePercent < 93 && mode !== 'daily' && !guestDemoLocked ? handleRetry : undefined}
                          onReset={user ? handleReset : undefined}
                          onNewRandom={mode !== 'challenge' && user ? handleNewRandom : undefined}
                          onRevealPrompt={scorePercent >= 93 && mode !== 'daily' && user ? handleRevealOriginalPrompt : undefined}
                          mode={mode}
                          user={user}
                          onOpenAuth={handleOpenAuth}
                          isGuestLastAttempt={!user && guestAttemptCount >= GUEST_MAX_ATTEMPTS}
                          guestDemoPrompt={!user && guestAttemptCount >= GUEST_MAX_ATTEMPTS ? revealedPromptText || undefined : undefined}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            </section>

            <aside className="order-1 lg:order-2 flex flex-col items-stretch justify-start gap-4 p-2 sm:p-4 transition-all duration-500 min-w-0 overflow-hidden lg:border-l lg:border-slate-100 dark:lg:border-slate-800">
              <div className="w-full max-w-full relative overflow-hidden" style={{ height: 'clamp(200px, 45vw, calc(100vh - 120px))' }}>
                <ImageCard
                  mode={mode}
                  data={imageData ?? {}}
                  imageStatus={imageStatus}
                  onPreviewChange={setImagePreviewOpen}
                  revealedPrompt={promptRevealed ? revealedPromptText : null}
                  userId={user?.id ?? null}
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
          </div>{/* /game area */}
        </div>{/* /flex wrapper */}
      </main>

      <Footer />

      {/* Toast: feature bloqueada para guests (ej. cambio de dificultad) */}
      {guestFeatureToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3 shadow-2xl text-white text-sm font-medium animate-in fade-in slide-in-from-bottom-3 duration-300">
          <svg className="h-4 w-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4" />
          </svg>
          <span className="max-w-xs leading-snug">{guestFeatureToast}</span>
          <button
            type="button"
            onClick={handleOpenAuth}
            className="ml-1 shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 transition"
          >
            {lang === 'en' ? 'Sign up free' : 'Registrarse gratis'}
          </button>
        </div>
      )}

      {/* User onboarding — solo primera vez (usuarios y guests) */}
      {showUserOnboarding && (
        <Suspense fallback={null}>
          <UserOnboarding onDone={async () => {
            if (user) {
              try { await api.put('/usuarios/me', { user_onboarded: true }) } catch { /* silencioso */ }
            } else {
              localStorage.setItem('user_onboarded_guest', '1')
            }
            setShowUserOnboarding(false)
          }} />
        </Suspense>
      )}

      {/* Modal de desbloqueo del prompt original */}
      {revealPrompt && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setRevealPrompt(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
                <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {lang === 'en' ? 'Warning: Final decision' : 'Advertencia: Decisión final'}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {lang === 'en'
                  ? 'If you reveal the original prompt, you will NOT be able to continue playing this challenge.'
                  : 'Si ves el prompt original, NO vas a poder seguir jugando este desafío.'}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'en'
                  ? 'You\'ve used all your attempts. You can reveal the prompt to learn from it, or keep trying to improve your score.'
                  : 'Usaste todos tus intentos. Podés ver el prompt para aprender, o seguir intentando mejorar tu puntaje.'}
              </p>
            </div>

            {/* Advertencia destacada */}
            <div className="mx-4 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3">
              <div className="flex gap-2.5">
                <svg className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                    {lang === 'en' ? 'This action is irreversible' : 'Esta acción es irreversible'}
                  </p>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                    {lang === 'en'
                      ? 'Once revealed, the challenge ends and you can\'t submit more attempts.'
                      : 'Una vez revelado, el desafío termina y no podés enviar más intentos.'}
                  </p>
                </div>
              </div>
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
                {lang === 'en' ? 'Reveal & end challenge' : 'Ver y terminar desafío'}
              </button>
              <button
                type="button"
                onClick={() => setRevealPrompt(false)}
                className="w-full rounded-xl border-2 border-cyan-500 bg-cyan-500 hover:bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {lang === 'en' ? 'Keep trying (recommended)' : 'Seguir intentando (recomendado)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de configuración */}
      <Suspense fallback={null}>
        <ConfigModal
          open={configOpen}
          mode={mode}
          difficulty={difficulty}
          availableDiffs={availableDiffs}
          imageId={imageData?.id_imagen || null}
          onClose={() => setConfigOpen(false)}
          onSave={() => setConfigOpen(false)}
          onModeChange={(newMode) => {
            if (mode !== newMode) {
              setMode(newMode)
              handleReset?.()
            }
          }}
          onDifficultyChange={(newDiff) => {
            setDifficulty(newDiff)
            handleReset?.()
          }}
        />

        {/* Auth Modal - disponible siempre */}
        <AuthModal
          open={authModalOpen}
          onClose={handleCloseAuth}
          onSignInWithGoogle={signInWithGoogle}
          onSignInWithEmail={signInWithEmail}
          onSignUpWithEmail={signUpWithEmail}
          inviteCompany={inviteState === 'prompt_login' ? inviteCompany : null}
          inviteEmail={inviteState === 'prompt_login' ? inviteEmail : null}
          initialPlan={authPreselect}
        />
      </Suspense>
    </div>
  )
}

export default App
