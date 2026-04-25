import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { checkRateLimit } from '../services/rateLimitService'
import {
  sanitizeEmail,
  sanitizePassword,
  sanitizeUsername,
  sanitizeDisplayName,
  sanitizeCompanyName
} from '../utils/inputSanitizer'

const ensureUserProfile = async (u) => {
  if (!u) return
  try {
    const { data: existing } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('id_usuario', u.id)
      .maybeSingle()

    if (!existing) {
      const nombre = u.user_metadata?.full_name || u.user_metadata?.nombre || u.email?.split('@')[0] || 'Usuario'
      const userType = u.user_metadata?.userType || 'individual'
      const companyName = u.user_metadata?.companyName || null
      
      const profileData = {
        id_usuario: u.id,
        nombre,
        email: u.email,
        idioma_preferido: 'es',
        adminstate: false,
        user_type: userType,
      }

      // Si es empresa, agregar campos específicos
      if (userType === 'enterprise') {
        profileData.company_name = companyName || nombre
        profileData.nombre_display = companyName || nombre
      }

      await supabase.from('usuarios').insert([profileData])
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

  const signUpWithEmail = async (email, password, nombre, username, userType = 'individual', companyName = null) => {
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
      }

      // Si es empresa, agregar campos específicos
      if (userType === 'enterprise') {
        profileData.company_name = sanitizedCompanyName || nombreResult.sanitized
        profileData.nombre_display = sanitizedCompanyName || nombreResult.sanitized
      }

      const { error: dbError } = await supabase.from('usuarios').insert([profileData])
      if (dbError) throw dbError
    }

    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }
}
