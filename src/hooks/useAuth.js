import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

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
    // Allow login with username — resolve to email first
    let loginEmail = email
    if (!email.includes('@')) {
      const { data } = await supabase
        .from('usuarios')
        .select('email')
        .ilike('username', email)
        .maybeSingle()
      if (!data?.email) throw new Error('Username not found')
      loginEmail = data.email
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    if (error) throw error
  }

  const signUpWithEmail = async (email, password, nombre, username, userType = 'individual', companyName = null) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, userType, companyName },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) throw error

    if (data.user) {
      const profileData = {
        id_usuario: data.user.id,
        nombre,
        username: username || null,
        email,
        idioma_preferido: 'es',
        adminstate: false,
        user_type: userType || 'individual',
      }

      // Si es empresa, agregar campos específicos
      if (userType === 'enterprise') {
        profileData.company_name = companyName || nombre
        profileData.nombre_display = companyName || nombre
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
