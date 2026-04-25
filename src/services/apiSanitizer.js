/**
 * API Request Sanitization Service
 * Validates and sanitizes all API requests before processing
 */

import {
  sanitizeEmail,
  sanitizePassword,
  sanitizeUsername,
  sanitizeDisplayName,
  sanitizeCompanyName,
  sanitizePrompt,
  sanitizeText,
  sanitizeInteger,
  sanitizeBoolean,
  sanitizeBatch
} from '../utils/inputSanitizer'

/**
 * Sanitize authentication request
 * @param {Object} data - Request data
 * @returns {{valid: boolean, sanitized: Object, errors: Object}}
 */
export const sanitizeAuthRequest = (data) => {
  const schema = {
    email: { type: 'email', required: true },
    password: { type: 'password', required: true, minLength: 6 }
  }

  return sanitizeBatch(data, schema)
}

/**
 * Sanitize signup request
 * @param {Object} data - Request data
 * @returns {{valid: boolean, sanitized: Object, errors: Object}}
 */
export const sanitizeSignupRequest = (data) => {
  const schema = {
    email: { type: 'email', required: true },
    password: { type: 'password', required: true, minLength: 6 },
    nombre: { type: 'displayName', required: true },
    username: { type: 'username', required: true },
    userType: { type: 'text', required: false, maxLength: 20 },
    companyName: { type: 'companyName', required: false }
  }

  const result = sanitizeBatch(data, schema)

  // Additional validation for userType
  if (result.valid && result.sanitized.userType) {
    if (!['individual', 'enterprise'].includes(result.sanitized.userType)) {
      result.valid = false
      result.errors.userType = 'Invalid user type'
    }
  }

  // Validate company name is required for enterprise
  if (result.valid && result.sanitized.userType === 'enterprise' && !result.sanitized.companyName) {
    result.valid = false
    result.errors.companyName = 'Company name is required for enterprise accounts'
  }

  return result
}

/**
 * Sanitize prompt submission request
 * @param {Object} data - Request data
 * @returns {{valid: boolean, sanitized: Object, errors: Object}}
 */
export const sanitizePromptRequest = (data) => {
  const schema = {
    prompt: { type: 'prompt', required: true },
    imageId: { type: 'text', required: true, maxLength: 100 },
    mode: { type: 'text', required: false, maxLength: 20 },
    difficulty: { type: 'text', required: false, maxLength: 20 },
    elapsedSeconds: { type: 'integer', required: false, min: 0, max: 7200 },
    isRanked: { type: 'boolean', required: false }
  }

  const result = sanitizeBatch(data, schema)

  // Additional validation for mode
  if (result.valid && result.sanitized.mode) {
    if (!['daily', 'random', 'challenge'].includes(result.sanitized.mode)) {
      result.valid = false
      result.errors.mode = 'Invalid mode'
    }
  }

  // Additional validation for difficulty
  if (result.valid && result.sanitized.difficulty) {
    const normalized = result.sanitized.difficulty.toLowerCase()
    if (!['easy', 'medium', 'hard'].includes(normalized)) {
      result.valid = false
      result.errors.difficulty = 'Invalid difficulty'
    }
  }

  return result
}

/**
 * Sanitize profile update request
 * @param {Object} data - Request data
 * @returns {{valid: boolean, sanitized: Object, errors: Object}}
 */
export const sanitizeProfileUpdateRequest = (data) => {
  const schema = {
    nombre: { type: 'displayName', required: false },
    username: { type: 'username', required: false },
    bio: { type: 'text', required: false, maxLength: 500 },
    avatar_url: { type: 'text', required: false, maxLength: 2048 },
    idioma_preferido: { type: 'text', required: false, maxLength: 5 }
  }

  const result = sanitizeBatch(data, schema)

  // Additional validation for idioma_preferido
  if (result.valid && result.sanitized.idioma_preferido) {
    if (!['es', 'en', 'pt'].includes(result.sanitized.idioma_preferido)) {
      result.valid = false
      result.errors.idioma_preferido = 'Invalid language'
    }
  }

  return result
}

/**
 * Sanitize challenge creation request
 * @param {Object} data - Request data
 * @returns {{valid: boolean, sanitized: Object, errors: Object}}
 */
export const sanitizeChallengeRequest = (data) => {
  const schema = {
    title: { type: 'text', required: true, maxLength: 100 },
    description: { type: 'text', required: false, maxLength: 1000 },
    difficulty: { type: 'text', required: true, maxLength: 20 },
    imageUrl: { type: 'text', required: true, maxLength: 2048 },
    timeLimit: { type: 'integer', required: false, min: 30, max: 600 },
    isPublic: { type: 'boolean', required: false }
  }

  const result = sanitizeBatch(data, schema)

  // Additional validation for difficulty
  if (result.valid && result.sanitized.difficulty) {
    const normalized = result.sanitized.difficulty.toLowerCase()
    if (!['easy', 'medium', 'hard'].includes(normalized)) {
      result.valid = false
      result.errors.difficulty = 'Invalid difficulty'
    }
  }

  return result
}

/**
 * Sanitize search query
 * @param {Object} data - Request data
 * @returns {{valid: boolean, sanitized: Object, errors: Object}}
 */
export const sanitizeSearchRequest = (data) => {
  const schema = {
    query: { type: 'text', required: true, maxLength: 200 },
    limit: { type: 'integer', required: false, min: 1, max: 100 },
    offset: { type: 'integer', required: false, min: 0, max: 10000 }
  }

  return sanitizeBatch(data, schema)
}

/**
 * Sanitize pagination parameters
 * @param {Object} data - Request data
 * @returns {{valid: boolean, sanitized: Object, errors: Object}}
 */
export const sanitizePaginationRequest = (data) => {
  const schema = {
    page: { type: 'integer', required: false, min: 1, max: 10000 },
    limit: { type: 'integer', required: false, min: 1, max: 100 },
    sortBy: { type: 'text', required: false, maxLength: 50 },
    sortOrder: { type: 'text', required: false, maxLength: 4 }
  }

  const result = sanitizeBatch(data, schema)

  // Additional validation for sortOrder
  if (result.valid && result.sanitized.sortOrder) {
    if (!['asc', 'desc'].includes(result.sanitized.sortOrder.toLowerCase())) {
      result.valid = false
      result.errors.sortOrder = 'Invalid sort order'
    }
  }

  return result
}

/**
 * Generic request sanitizer with size limits
 * @param {Object} data - Request data
 * @param {number} maxSize - Maximum request size in bytes
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateRequestSize = (data, maxSize = 1024 * 1024) => {
  try {
    const size = new Blob([JSON.stringify(data)]).size
    
    if (size > maxSize) {
      return {
        valid: false,
        error: `Request too large (${Math.round(size / 1024)}KB). Maximum allowed: ${Math.round(maxSize / 1024)}KB`
      }
    }

    return { valid: true, error: null }
  } catch (err) {
    return { valid: false, error: 'Invalid request format' }
  }
}

/**
 * Validate request headers
 * @param {Object} headers - Request headers
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateHeaders = (headers) => {
  // Check Content-Type for POST/PUT requests
  const contentType = headers['content-type'] || headers['Content-Type']
  
  if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
    return {
      valid: false,
      error: 'Invalid Content-Type. Expected application/json or multipart/form-data'
    }
  }

  return { valid: true, error: null }
}

/**
 * Detect potential SQL injection patterns
 * @param {string} input - Input string to check
 * @returns {boolean} - True if suspicious patterns detected
 */
export const detectSQLInjection = (input) => {
  if (typeof input !== 'string') return false

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /(--|;|\/\*|\*\/|xp_|sp_)/gi,
    /('|")\s*(OR|AND)\s*('|")?(\d+|true|false)\s*(=|>|<)/gi
  ]

  return sqlPatterns.some(pattern => pattern.test(input))
}

/**
 * Detect potential XSS patterns
 * @param {string} input - Input string to check
 * @returns {boolean} - True if suspicious patterns detected
 */
export const detectXSS = (input) => {
  if (typeof input !== 'string') return false

  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi
  ]

  return xssPatterns.some(pattern => pattern.test(input))
}

/**
 * Comprehensive security check for any input
 * @param {any} input - Input to check
 * @returns {{safe: boolean, threats: string[]}}
 */
export const securityCheck = (input) => {
  const threats = []

  if (typeof input === 'string') {
    if (detectSQLInjection(input)) {
      threats.push('SQL injection pattern detected')
    }
    if (detectXSS(input)) {
      threats.push('XSS pattern detected')
    }
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(input)) {
      threats.push('Control characters detected')
    }
  }

  if (typeof input === 'object' && input !== null) {
    for (const value of Object.values(input)) {
      const nestedCheck = securityCheck(value)
      threats.push(...nestedCheck.threats)
    }
  }

  return {
    safe: threats.length === 0,
    threats
  }
}

export default {
  sanitizeAuthRequest,
  sanitizeSignupRequest,
  sanitizePromptRequest,
  sanitizeProfileUpdateRequest,
  sanitizeChallengeRequest,
  sanitizeSearchRequest,
  sanitizePaginationRequest,
  validateRequestSize,
  validateHeaders,
  detectSQLInjection,
  detectXSS,
  securityCheck
}
