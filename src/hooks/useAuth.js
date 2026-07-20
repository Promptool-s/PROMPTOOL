import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { api } from '../lib/apiClient'
import { checkRateLimit } from '../services/rateLimitService'
import {
  sanitizeEmail,
  sanitizePassword,
  sanitizeUsername,
  sanitizeDisplayName,
  sanitizeCompanyName
} from '../utils/inputSanitizer'

/**
 * Asegura el perfil del usuario y dispara la bienvenida "una vez por cuenta",
 * TODO server-side vía POST /api/usuarios. El backend crea el perfil de forma
 * idempotente y hace el claim atómico + envío del mail (ver usuarioService).
 * Reemplaza el upsert/select/update directo a `usuarios` que vivía acá.
 *
 * Cubre altas nuevas (email y Google) y cuentas viejas cuyo welcome_email_sent
 * sigue en false (lo reciben en su próximo login). Idempotente: se puede llamar
 * en cada SIGNED_IN sin duplicar el mail.
 */
const ensureUserProfile = async (u) => {
  if (!u) return
  try {
    const nombre = u.user_metadata?.full_name || u.user_metadata?.nombre || u.email?.split('@')[0] || 'Usuario'
    const userType = u.user_metadata?.userType || 'individual'
    const companyName = u.user_metadata?.companyName || null
    const lang = localStorage.getItem('lang') || 'es'

    await api.post('/usuarios', {
      nombre,
      nombre_display: userType === 'enterprise' ? (companyName || nombre) : nombre,
      user_type: userType,
      company_name: userType === 'enterprise' ? (companyName || nombre) : null,
      idioma_preferido: 'es',
      lang,
    })
  } catch (err) {
    // Perfil ya existente o error transitorio: no romper el flujo de sesión.
    console.error('[ensureUserProfile]', err.message)
  }
}

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sesión actual al montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setLoading(false)
      if (u) ensureUserProfile(u)
    })

    // Cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (_event === 'SIGNED_IN') ensureUserProfile(u)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signInWithEmail = async (email, password) => {
    // Check rate limit first
    const rateLimit = await checkRateLimit('login')
    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetAt ? new Date(rateLimit.resetAt).toLocaleTimeString() : 'soon'
      throw new Error(`Too many login attempts. Please try again at ${resetTime}`)
    }

    // Sanitize password
    const passwordResult = sanitizePassword(password)
    if (!passwordResult.valid) {
      throw new Error(passwordResult.error)
    }

    // Allow login with username — resolve to email first
    let loginEmail = email
    if (!email.includes('@')) {
      // Sanitize username
      const usernameResult = sanitizeUsername(email)
      if (!usernameResult.valid) {
        throw new Error(usernameResult.error)
      }
      
      try {
        const { email } = await api.get(
          `/usuarios/email-por-username?u=${encodeURIComponent(usernameResult.sanitized)}`,
          { auth: false }
        )
        loginEmail = email
      } catch {
        throw new Error('Username not found')
      }
    } else {
      // Sanitize email
      const emailResult = sanitizeEmail(email)
      if (!emailResult.valid) {
        throw new Error(emailResult.error)
      }
      loginEmail = emailResult.sanitized
    }

    const { error } = await supabase.auth.signInWithPassword({ 
      email: loginEmail, 
      password: passwordResult.sanitized 
    })
    if (error) throw error
  }

  const signUpWithEmail = async (email, password, nombre, username, userType = 'individual', companyName = null, acceptedTerms = false, emailMarketing = false) => {
    // Check rate limit first
    const rateLimit = await checkRateLimit('signup')
    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetAt ? new Date(rateLimit.resetAt).toLocaleTimeString() : 'soon'
      throw new Error(`Too many signup attempts. Please try again at ${resetTime}`)
    }

    // Sanitize all inputs
    const emailResult = sanitizeEmail(email)
    if (!emailResult.valid) {
      throw new Error(emailResult.error)
    }

    const passwordResult = sanitizePassword(password)
    if (!passwordResult.valid) {
      throw new Error(passwordResult.error)
    }

    const nombreResult = sanitizeDisplayName(nombre)
    if (!nombreResult.valid) {
      throw new Error(nombreResult.error)
    }

    const usernameResult = sanitizeUsername(username)
    if (!usernameResult.valid) {
      throw new Error(usernameResult.error)
    }

    // Validate user type
    if (!['individual', 'enterprise'].includes(userType)) {
      throw new Error('Invalid user type')
    }

    // Sanitize company name if provided
    let sanitizedCompanyName = null
    if (userType === 'enterprise') {
      if (!companyName) {
        throw new Error('Company name is required for enterprise accounts')
      }
      const companyResult = sanitizeCompanyName(companyName)
      if (!companyResult.valid) {
        throw new Error(companyResult.error)
      }
      sanitizedCompanyName = companyResult.sanitized
    }

    const { data, error } = await supabase.auth.signUp({
      email: emailResult.sanitized,
      password: passwordResult.sanitized,
      options: {
        data: { 
          nombre: nombreResult.sanitized, 
          userType, 
          companyName: sanitizedCompanyName 
        },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) throw error

    if (data.user) {
      // Auto-login primero: el alta de perfil pega a POST /api/usuarios, que
      // requiere sesión (Bearer). Si la confirmación de email está desactivada,
      // signUp ya deja sesión y esto la refresca.
      if (!data.session) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: emailResult.sanitized,
          password: passwordResult.sanitized,
        })
        if (loginError) throw loginError
      }

      // Alta de perfil + mail de bienvenida, TODO server-side (antes: insert
      // directo a `usuarios` + sendWelcomeOnce con supabase.from()). El backend
      // hace el claim atómico del flag, así que si el SIGNED_IN del auto-login
      // dispara ensureUserProfile en paralelo, se manda un único mail.
      const lang = localStorage.getItem('lang') || 'es'
      await api.post('/usuarios', {
        nombre: nombreResult.sanitized,
        username: usernameResult.sanitized || null,
        user_type: userType || 'individual',
        company_name: userType === 'enterprise' ? (sanitizedCompanyName || nombreResult.sanitized) : null,
        idioma_preferido: 'es',
        accepted_terms: !!acceptedTerms,
        email_marketing: !!emailMarketing,
        lang,
      })
    }

    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }
}
