import { supabase } from '../supabaseClient'

/**
 * Rate limiting service for authentication endpoints
 * Limits: 5 attempts per 15 minutes per IP and endpoint
 */

// Get client IP address (best effort)
const getClientIP = async () => {
  try {
    // Try to get IP from a public API
    const response = await fetch('https://api.ipify.org?format=json', { timeout: 2000 })
    const data = await response.json()
    return data.ip || 'unknown'
  } catch {
    // Fallback to a hash of user agent + timestamp bucket (15min)
    const ua = navigator.userAgent
    const timeBucket = Math.floor(Date.now() / (15 * 60 * 1000))
    return `fallback-${btoa(ua + timeBucket).slice(0, 32)}`
  }
}

/**
 * Check if the user can attempt authentication
 * @param {string} endpoint - The endpoint being accessed (e.g., 'login', 'signup')
 * @returns {Promise<{allowed: boolean, attemptsLeft: number, resetAt: Date|null, error: string|null}>}
 */
export const checkRateLimit = async (endpoint = 'login') => {
  try {
    const ip = await getClientIP()
    
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_ip_address: ip,
      p_endpoint: endpoint,
      p_max_attempts: 5,
      p_window_minutes: 15
    })

    if (error) {
      console.error('[RateLimit] Error checking rate limit:', error)
      // On error, allow the request (fail open)
      return { allowed: true, attemptsLeft: 5, resetAt: null, error: error.message }
    }

    if (!data) {
      // No data returned, allow the request
      return { allowed: true, attemptsLeft: 5, resetAt: null, error: null }
    }

    const result = Array.isArray(data) ? data[0] : data
    
    return {
      allowed: result.allowed === true,
      attemptsLeft: result.attempts_left || 0,
      resetAt: result.reset_at ? new Date(result.reset_at) : null,
      error: null
    }
  } catch (err) {
    console.error('[RateLimit] Exception checking rate limit:', err)
    // On exception, allow the request (fail open)
    return { allowed: true, attemptsLeft: 5, resetAt: null, error: err.message }
  }
}

/**
 * Format time remaining until rate limit reset
 * @param {Date} resetAt - The reset timestamp
 * @returns {string} - Formatted time string (e.g., "5 minutos")
 */
export const formatTimeRemaining = (resetAt, lang = 'es') => {
  if (!resetAt) return ''
  
  const now = new Date()
  const diff = resetAt - now
  
  if (diff <= 0) return lang === 'en' ? 'now' : 'ahora'
  
  const minutes = Math.ceil(diff / 60000)
  
  if (minutes < 1) {
    return lang === 'en' ? 'less than a minute' : 'menos de un minuto'
  }
  
  if (minutes === 1) {
    return lang === 'en' ? '1 minute' : '1 minuto'
  }
  
  return lang === 'en' ? `${minutes} minutes` : `${minutes} minutos`
}

/**
 * Reset rate limit for a specific IP and endpoint (admin only)
 * @param {string} ipAddress - The IP address to reset
 * @param {string} endpoint - The endpoint to reset
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const resetRateLimit = async (ipAddress, endpoint = 'login') => {
  try {
    const { error } = await supabase.rpc('reset_rate_limit', {
      p_ip_address: ipAddress,
      p_endpoint: endpoint
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
