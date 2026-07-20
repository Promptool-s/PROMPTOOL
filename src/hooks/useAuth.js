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
 * Envía el mail de bienvenida UNA sola vez por cuenta, de forma race-safe.
 *
 * El "claim" atómico (welcome_email_sent: false → true, condicionado con
 * .eq('welcome_email_sent', false)) garantiza que solo el primer llamado que
 * gane la carrera dispara el envío, aunque el alta y el SIGNED_IN corran en
 * paralelo o haya varias pestañas abiertas. Si el envío falla, se revierte el
 * flag para reintentar en el próximo login (entrega al-menos-una-vez).
 *
 * Requiere la columna usuarios.welcome_email_sent (boolean not null default false).
 */
const sendWelcomeOnce = async (userId, { nombre, email, userType, lang }) => {
  const { data: claimed, error } = await supabase
    .from('usuarios')
    .update({ welcome_email_sent: true })
    .eq('id_usuario', userId)
    .eq('welcome_email_sent', false)
    .select('id_usuario')
  if (error || !claimed?.length) return // ya se envió, o lo ganó otro llamado

  try {
    await api.post('/email/welcome', { nombre, email, userType, lang })
  } catch (err) {
    console.error('[email/welcome] error:', err.message)
    // Revertir el claim para reintentar la próxima vez
    await supabase.from('usuarios').update({ welcome_email_sent: false }).eq('id_usuario', userId)
  }
}

const ensureUserProfile = async (u) => {
  if (!u) return
  try {
    const { data: existing } = await supabase
      .from('usuarios')
      .select('id_usuario, welcome_email_sent')
      .eq('id_usuario', u.id)
      .maybeSingle()

    const nombre = u.user_metadata?.full_name || u.user_metadata?.nombre || u.email?.split('@')[0] || 'Usuario'
    const userType = u.user_metadata?.userType || 'individual'
    const lang = localStorage.getItem('lang') || 'es'

    if (!existing) {
      const companyName = u.user_metadata?.companyName || null

      const profileData = {
        id_usuario: u.id,
        nombre,
        email: u.email,
        idioma_preferido: 'es',
        adminstate: false,
        user_type: userType,
      }

      if (userType === 'enterprise') {
        profileData.company_name = companyName || nombre
        profileData.nombre_display = companyName || nombre
      }

      // upsert con ignoreDuplicates evita el 409 si dos llamadas concurrentes llegan al mismo tiempo
      await supabase.from('usuarios').upsert([profileData], { onConflict: 'id_usuario', ignoreDuplicates: true })
    }

    // Bienvenida "una vez por cuenta": cubre altas nuevas (Google y email) y
    // también cuentas que ya existían antes de esta feature (su flag arranca en
    // false por el default de la columna, así que lo reciben en su próximo login).
    if (!existing || existing.welcome_email_sent === false) {
      await sendWelcomeOnce(u.id, { nombre, email: u.email, userType, lang })
    }
  } catch {
    // profile creation failed silently
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
      
      const { data } = await supabase
        .from('usuarios')
        .select('email')
        .ilike('username', usernameResult.sanitized)
        .maybeSingle()
      if (!data?.email) throw new Error('Username not found')
      loginEmail = data.email
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
      const profileData = {
        id_usuario: data.user.id,
        nombre: nombreResult.sanitized,
        username: usernameResult.sanitized || null,
        email: emailResult.sanitized,
        idioma_preferido: 'es',
        adminstate: false,
        user_type: userType || 'individual',
        accepted_terms: !!acceptedTerms,
        email_marketing: !!emailMarketing,
      }

      // Si es empresa, agregar campos específicos
      if (userType === 'enterprise') {
        profileData.company_name = sanitizedCompanyName || nombreResult.sanitized
        profileData.nombre_display = sanitizedCompanyName || nombreResult.sanitized
      }

      const { error: dbError } = await supabase.from('usuarios').insert([profileData])
      if (dbError) throw dbError

      // Auto-login después del registro — no pedir que inicie sesión por separado
      // Si la sesión ya está activa (confirmación de email desactivada), esto la refresca
      if (!data.session) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: emailResult.sanitized,
          password: passwordResult.sanitized,
        })
        if (loginError) throw loginError
      }

      // Email de bienvenida "una vez por cuenta". Va después del auto-login
      // porque el endpoint (y el claim del flag) requieren sesión. Comparte el
      // claim atómico con ensureUserProfile: si el SIGNED_IN del auto-login corre
      // en paralelo, solo uno de los dos gana y se manda un único mail.
      const lang = localStorage.getItem('lang') || 'es'
      await sendWelcomeOnce(data.user.id, {
        nombre: nombreResult.sanitized,
        email: emailResult.sanitized,
        userType: userType || 'individual',
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
