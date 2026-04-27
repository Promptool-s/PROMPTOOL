import { supabase } from '../supabaseClient'
import { logger } from '../utils/logger'
import { ErrorTypes } from '../utils/errorHandler'

/**
 * Enhanced rate limiting service for authentication endpoints
 * Limits: 5 attempts per 15 minutes per IP and endpoint
 * Prevents spam, abuse, and brute force attacks
 */

// Generate a privacy-preserving client fingerprint without calling external APIs.
// Avoids leaking the user's IP to third-party services (e.g. ipify.org) and
// removes a slow, unreliable network dependency from the hot path.
const getClientFingerprint = () => {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.platform || '',
    ]
    // Time bucket: 15-minute windows (aligns with the rate-limit window)
    const timeBucket = Math.floor(Date.now() / (15 * 60 * 1000))
    const raw = components.join('|') + '|' + timeBucket
    // Simple hash (not cryptographic — used only for bucketing)
    let hash = 0
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return 'fp-' + Math.abs(hash).toString(36)
  } catch {
    return 'fp-unknown-' + Math.floor(Date.now() / (15 * 60 * 1000))
  }
}

/**
 * Check if the user can attempt authentication
 * @param {string} endpoint - The endpoint being accessed (e.g., 'login', 'signup')
 * @returns {Promise<{allowed: boolean, attemptsLeft: number, resetAt: Date|null, error: string|null}>}
 */
export const checkRateLimit = async (endpoint = 'login') => {
  try {
    const ip = getClientFingerprint()

    logger.debug('Checking rate limit', { endpoint, ip })

    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_ip_address: ip,
      p_endpoint: endpoint,
      p_max_attempts: 5,
      p_window_minutes: 15
    })

    if (error) {
      logger.error('Rate limit check failed', error, { endpoint, ip })
      // On error, allow the request (fail open)
      return { allowed: true, attemptsLeft: 5, resetAt: null, error: error.message }
    }

    if (!data) {
      logger.warn('Rate limit check returned no data', { endpoint, ip })
      // No data returned, allow the request
      return { allowed: true, attemptsLeft: 5, resetAt: null, error: null }
    }

    const result = Array.isArray(data) ? data[0] : data
    
    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        endpoint,
        ip,
        attemptsLeft: result.attempts_left,
        resetAt: result.reset_at,
      })
    }
    
    return {
      allowed: result.allowed === true,
      attemptsLeft: result.attempts_left || 0,
      resetAt: result.reset_at ? new Date(result.reset_at) : null,
      error: null
    }
  } catch (err) {
    logger.error('Rate limit check exception', err, { endpoint })
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
    logger.info('Resetting rate limit', { ipAddress, endpoint })
    
    const { error } = await supabase.rpc('reset_rate_limit', {
      p_ip_address: ipAddress,
      p_endpoint: endpoint
    })

    if (error) {
      logger.error('Failed to reset rate limit', error, { ipAddress, endpoint })
      return { success: false, error: error.message }
    }

    logger.info('Rate limit reset successfully', { ipAddress, endpoint })
    return { success: true, error: null }
  } catch (err) {
    logger.error('Rate limit reset exception', err, { ipAddress, endpoint })
    return { success: false, error: err.message }
  }
}
