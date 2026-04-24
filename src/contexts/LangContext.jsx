import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const translations = {
  es: {
    // Nav
    guides: 'Guías',
    stats: 'Estadísticas',
    challenges: 'Torneos',
    tables: 'Admin',
    signIn: 'Iniciar sesión',
    leaderboard: 'Liga Competitiva',
    leaderboardReset: 'Se reinicia cada mes',

    // Header menu
    viewProfile: 'Ver perfil',
    settings: 'Configuración',
    adminPanel: 'Panel Admin',
    signOut: 'Cerrar sesión',

    // Settings
    settingsTitle: 'Configuración',
    changePassword: 'Cambiar contraseña',
    language: 'Idioma',
    theme: 'Tema',
    light: 'Claro',
    dark: 'Oscuro',
    newPassword: 'Nueva contraseña',
    confirmPassword: 'Confirmar contraseña',
    save: 'Guardar',
    cancel: 'Cancelar',
    passwordChanged: 'Contraseña actualizada correctamente',
    passwordError: 'No se pudo cambiar la contraseña',
    passwordMismatch: 'Las contraseñas no coinciden',
    passwordShort: 'Mínimo 6 caracteres',
    back: 'Volver',

    // App principal
    analyzeWithAI: 'Evaluar prompt',
    analyzing: 'Analizando...',
    noImageAvailable: 'Sin imagen disponible',
    configure: 'Configurar',
    reset: 'Reiniciar',
    newRandom: 'Nueva imagen',
    adjustModeAndDifficulty: 'Cambia el modo o la dificultad.',
    mode: 'Modo',
    daily: 'Diario',
    random: 'Aleatorio',
    difficulty: 'Dificultad',
    suggestedTime: 'Tiempo sugerido',
    writePrompt: 'Escribe tu prompt',
    promptPlaceholder: 'Describe el prompt que crees que generó la imagen a tu derecha',
    promptRecommendation: 'Consejo: menciona el ambiente, estilo o iluminación, y sé específico con los objetos.',
    dailyDoneTitle: 'Ya completaste el desafío diario de hoy',
    dailyDoneDesc: 'Vuelve mañana para un nuevo desafío, o prueba el modo Aleatorio.',
    goToRandom: 'Ir al modo Aleatorio',
    analyzingPrompt: 'Analizando tu prompt con IA...',

    // Modal de configuración
    configTitle: 'Modo y dificultad',
    close: 'Cerrar',
    saveChanges: 'Guardar cambios',
    dailyDesc: 'Imagen más reciente del día',
    randomDesc: 'Imagen aleatoria por dificultad',
    dailyNoFilter: 'El modo diario no se puede filtrar',
    loading: 'Cargando...',

    // Panel de resultados
    aiAnalysis: 'Análisis de la IA',
    analysisUnavailable: 'El análisis no está disponible en este momento.',
    levelPassed: 'Nivel superado',
    keepTrying: 'Sigue intentando',
    strengths: 'Puntos fuertes',
    analyzing2: 'Analizando...',
    improvements: 'Áreas de mejora',
    noImprovements: 'Sin áreas de mejora detectadas',
    learnMore: 'Aprende más',

    // Perfil
    memberSince: 'Miembro desde',
    copyProfileLink: 'Copiar enlace del perfil',
    editProfile: 'Editar perfil',
    editBio: 'Editar bio',
    addBio: 'Agregar bio',
    noBio: 'Sin bio todavía',
    readMore: 'Leer más',
    readLess: 'Ver menos',
    statistics: 'Estadísticas',
    average: 'Promedio',
    bestScore: 'Mejor score',
    approval: 'Aprobación',
    totalAttempts: 'Intentos',
    today: 'Hoy',
    thisWeek: 'Esta semana',
    worstScore: 'Peor score',
    scoreEvolution: 'Evolución de scores',
    activityLastYear: 'intentos en el último año',
    attempt: 'intento',
    attempts: 'intentos',
    resolutionHistory: 'Historial',
    noAttempts: 'Aún no hay intentos registrados',
    firstAttempt: 'Hacer mi primer intento',
    userNotFound: 'Usuario no encontrado',
    backHome: 'Volver al inicio',
    streak: 'días de racha',
    streakDay: 'día de racha',
    editStats: 'Editar estadísticas',
    yourPrompt: 'Tu prompt',
    originalPrompt: 'Prompt original',
    similarity: 'Similitud',
    recentStrengths: 'Puntos fuertes recientes',
    toImprove: 'A mejorar',
    visibleName: 'Nombre visible',
    uploadPhoto: 'Subir foto de perfil',
    fileSelected: 'Archivo:',
    saving: 'Guardando...',
    uploading: 'Subiendo imagen...',
    hideEmail: 'Ocultar email en perfil público',
    showEmail: 'Mostrar email en perfil público',

    // Auth
    signInTitle: 'Iniciar sesión',
    signUpTitle: 'Crear cuenta',
    signInDesc: 'Accede a tu cuenta',
    signUpDesc: 'Regístrate para guardar tu progreso',
    continueWithGoogle: 'Continuar con Google',
    orWithEmail: 'O con email',
    publicName: 'Nombre público',
    username: 'Nombre de usuario',
    usernameHint: 'Solo letras, números y guión bajo. Tu perfil:',
    email: 'Email',
    password: 'Contraseña',
    processing: 'Procesando...',
    noAccount: '¿No tienes cuenta? Regístrate',
    hasAccount: '¿Ya tienes cuenta? Inicia sesión',
    usernameMin: 'El usuario debe tener al menos 3 caracteres',
    usernameTaken: 'Ese nombre de usuario ya está en uso',
    nameRequired: 'El nombre es obligatorio',

    // Leaderboard
    globalLeaderboard: 'Ranking Global',
    leaderboardDesc: 'Los mejores jugadores por rendimiento',
    noPlayers: 'Aún no hay jugadores en el ranking',
    player: 'Jugador',
    avgScore: 'Promedio',
    attempts2: 'Intentos',
  },

  en: {
    // Nav
    guides: 'Guides',
    stats: 'Statistics',
    challenges: 'Tournaments',
    tables: 'Admin',
    signIn: 'Sign in',
    leaderboard: 'Competitive League',
    leaderboardReset: 'Resets every month',

    // Header menu
    viewProfile: 'View profile',
    settings: 'Settings',
    adminPanel: 'Admin Panel',
    signOut: 'Sign out',

    // Settings
    settingsTitle: 'Settings',
    changePassword: 'Change password',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    save: 'Save',
    cancel: 'Cancel',
    passwordChanged: 'Password updated successfully',
    passwordError: 'Could not change password',
    passwordMismatch: 'Passwords do not match',
    passwordShort: 'Minimum 6 characters',
    back: 'Back',

    // App main
    analyzeWithAI: 'Evaluate prompt',
    analyzing: 'Analyzing...',
    noImageAvailable: 'No image available',
    configure: 'Configure',
    reset: 'Reset',
    newRandom: 'New image',
    adjustModeAndDifficulty: 'Change mode or difficulty.',
    mode: 'Mode',
    daily: 'Daily',
    random: 'Random',
    difficulty: 'Difficulty',
    suggestedTime: 'Suggested time',
    writePrompt: 'Write your prompt',
    promptPlaceholder: 'Describe the prompt you think generated the image to your right',
    promptRecommendation: 'Tip: mention the environment, style or lighting, and be specific about objects.',
    dailyDoneTitle: "You've already completed today's daily challenge",
    dailyDoneDesc: 'Come back tomorrow for a new challenge, or try Random mode.',
    goToRandom: 'Go to Random mode',
    analyzingPrompt: 'Analyzing your prompt with AI...',

    // Config modal
    configTitle: 'Mode & difficulty',
    close: 'Close',
    saveChanges: 'Save changes',
    dailyDesc: "Today's most recent image",
    randomDesc: 'Random image by difficulty',
    dailyNoFilter: 'Daily mode cannot be filtered',
    loading: 'Loading...',

    // Result panel
    aiAnalysis: 'AI Analysis',
    analysisUnavailable: 'Analysis is not available right now.',
    levelPassed: 'Level passed',
    keepTrying: 'Keep trying',
    strengths: 'Strengths',
    analyzing2: 'Analyzing...',
    improvements: 'Areas to improve',
    noImprovements: 'No areas to improve detected',
    learnMore: 'Learn more',

    // Profile
    memberSince: 'Member since',
    copyProfileLink: 'Copy profile link',
    editProfile: 'Edit profile',
    editBio: 'Edit bio',
    addBio: 'Add bio',
    noBio: 'No bio yet',
    readMore: 'Read more',
    readLess: 'Show less',
    statistics: 'Statistics',
    average: 'Average',
    bestScore: 'Best score',
    approval: 'Approval rate',
    totalAttempts: 'Attempts',
    today: 'Today',
    thisWeek: 'This week',
    worstScore: 'Worst score',
    scoreEvolution: 'Score evolution',
    activityLastYear: 'contributions in the last year',
    attempt: 'attempt',
    attempts: 'attempts',
    resolutionHistory: 'History',
    noAttempts: 'No attempts recorded yet',
    firstAttempt: 'Make my first attempt',
    userNotFound: 'User not found',
    backHome: 'Back to home',
    streak: 'day streak',
    streakDay: 'day streak',
    editStats: 'Edit stats',
    yourPrompt: 'Your prompt',
    originalPrompt: 'Original prompt',
    similarity: 'Similarity',
    recentStrengths: 'Recent strengths',
    toImprove: 'To improve',
    visibleName: 'Display name',
    uploadPhoto: 'Upload profile photo',
    fileSelected: 'File:',
    saving: 'Saving...',
    uploading: 'Uploading...',
    hideEmail: 'Hide email on public profile',
    showEmail: 'Show email on public profile',

    // Auth
    signInTitle: 'Sign in',
    signUpTitle: 'Create account',
    signInDesc: 'Access your account',
    signUpDesc: 'Sign up to save your progress',
    continueWithGoogle: 'Continue with Google',
    orWithEmail: 'Or with email',
    publicName: 'Display name',
    username: 'Username',
    usernameHint: 'Letters, numbers and underscores only. Your profile:',
    email: 'Email',
    password: 'Password',
    processing: 'Processing...',
    noAccount: "Don't have an account? Sign up",
    hasAccount: 'Already have an account? Sign in',
    usernameMin: 'Username must be at least 3 characters',
    usernameTaken: 'That username is already taken',
    nameRequired: 'Name is required',

    // Leaderboard
    globalLeaderboard: 'Global Leaderboard',
    leaderboardDesc: 'Top players ranked by performance',
    noPlayers: 'No players on the leaderboard yet',
    player: 'Player',
    avgScore: 'Avg Score',
    attempts2: 'Attempts',
  }
}

const LangContext = createContext()

export const LangProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    const stored = localStorage.getItem('lang')
    if (stored) return stored
    const nav = navigator.language || navigator.languages?.[0] || 'es'
    return nav.toLowerCase().startsWith('es') ? 'es' : 'en'
  })

  const t = (key) => translations[lang]?.[key] ?? translations['es'][key] ?? key

  const changeLang = async (l) => {
    setLang(l)
    localStorage.setItem('lang', l)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('usuarios')
          .update({ idioma_preferido: l })
          .eq('id_usuario', user.id)
      }
    } catch (_) {}
  }

  useEffect(() => {
    const loadLangFromDB = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('usuarios')
          .select('idioma_preferido')
          .eq('id_usuario', user.id)
          .maybeSingle()
        if (data?.idioma_preferido && ['es', 'en'].includes(data.idioma_preferido)) {
          setLang(data.idioma_preferido)
          localStorage.setItem('lang', data.idioma_preferido)
        }
      } catch (_) {}
    }
    loadLangFromDB()
  }, [])

  return (
    <LangContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
