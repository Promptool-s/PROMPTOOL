/**
 * Input Sanitization Utility
 * Validates and sanitizes all user inputs to prevent injection attacks and malformed data
 */

// Maximum allowed lengths for different input types
const MAX_LENGTHS = {
  email: 254, // RFC 5321
  password: 128,
  username: 20,
  displayName: 50,
  companyName: 100,
  prompt: 2000,
  bio: 500,
  url: 2048,
  general: 255
}

// Regex patterns for validation
const PATTERNS = {
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  username: /^[a-z0-9_]{3,20}$/,
  alphanumeric: /^[a-zA-Z0-9\s]+$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/
}

/**
 * Sanitize and validate email address
 * @param {string} email - Email to validate
 * @returns {{valid: boolean, sanitized: string|null, error: string|null}}
 */
export const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, sanitized: null, error: 'Email is required' }
  }

  // Trim and lowercase
  const trimmed = email.trim().toLowerCase()

  // Check length
  if (trimmed.length > MAX_LENGTHS.email) {
    return { valid: false, sanitized: null, error: 'Email is too long' }
  }

  // Validate format
  if (!PATTERNS.email.test(trimmed)) {
    return { valid: false, sanitized: null, error: 'Invalid email format' }
  }

  // Check for suspicious patterns (multiple @, etc.)
  if ((trimmed.match(/@/g) || []).length !== 1) {
    return { valid: false, sanitized: null, error: 'Invalid email format' }
  }

  return { valid: true, sanitized: trimmed, error: null }
}

/**
 * Sanitize and validate password
 * @param {string} password - Password to validate
 * @param {number} minLength - Minimum password length (default: 6)
 * @returns {{valid: boolean, sanitized: string|null, error: string|null}}
 */
export const sanitizePassword = (password, minLength = 6) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, sanitized: null, error: 'Password is required' }
  }

  // Check length
  if (password.length < minLength) {
    return { valid: false, sanitized: null, error: `Password must be at least ${minLength} characters` }
  }

  if (password.length > MAX_LENGTHS.password) {
    return { valid: false, sanitized: null, error: 'Password is too long' }
  }

  // Check for null bytes and control characters
  if (/[\x00-\x1F\x7F]/.test(password)) {
    return { valid: false, sanitized: null, error: 'Password contains invalid characters' }
  }

  return { valid: true, sanitized: password, error: null }
}

/**
 * Sanitize and validate username
 * @param {string} username - Username to validate
 * @returns {{valid: boolean, sanitized: string|null, error: string|null}}
 */
export const sanitizeUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return { valid: false, sanitized: null, error: 'Username is required' }
  }

  // Lowercase and remove invalid characters
  const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, '')

  // Check length
  if (sanitized.length < 3) {
    return { valid: false, sanitized: null, error: 'Username must be at least 3 characters' }
  }

  if (sanitized.length > MAX_LENGTHS.username) {
    return { valid: false, sanitized: null, error: 'Username is too long' }
  }

  // Validate format
  if (!PATTERNS.username.test(sanitized)) {
    return { valid: false, sanitized: null, error: 'Username can only contain lowercase letters, numbers and underscores' }
  }

  // Check for reserved usernames
  const reserved = ['admin', 'root', 'system', 'api', 'null', 'undefined', 'test']
  if (reserved.includes(sanitized)) {
    return { valid: false, sanitized: null, error: 'This username is reserved' }
  }

  return { valid: true, sanitized, error: null }
}

/**
 * Sanitize display name (nombre)
 * @param {string} name - Display name to sanitize
 * @returns {{valid: boolean, sanitized: string|null, error: string|null}}
 */
export const sanitizeDisplayName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, sanitized: null, error: 'Display name is required' }
  }

  // Trim and remove excessive whitespace
  const sanitized = name.trim().replace(/\s+/g, ' ')

  // Check length
  if (sanitized.length < 1) {
    return { valid: false, sanitized: null, error: 'Display name cannot be empty' }
  }

  if (sanitized.length > MAX_LENGTHS.displayName) {
    return { valid: false, sanitized: null, error: 'Display name is too long' }
  }

  // Remove control characters and null bytes
  const cleaned = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  // Check for HTML/script injection attempts
  if (/<script|<iframe|javascript:|on\w+=/i.test(cleaned)) {
    return { valid: false, sanitized: null, error: 'Display name contains invalid content' }
  }

  return { valid: true, sanitized: cleaned, error: null }
}

/**
 * Sanitize company name
 * @param {string} companyName - Company name to sanitize
 * @returns {{valid: boolean, sanitized: string|null, error: string|null}}
 */
export const sanitizeCompanyName = (companyName) => {
  if (!companyName || typeof companyName !== 'string') {
    return { valid: false, sanitized: null, error: 'Company name is required' }
  }

  // Trim and remove excessive whitespace
  const sanitized = companyName.trim().replace(/\s+/g, ' ')

  // Check length
  if (sanitized.length < 1) {
    return { valid: false, sanitized: null, error: 'Company name cannot be empty' }
  }

  if (sanitized.length > MAX_LENGTHS.companyName) {
    return { valid: false, sanitized: null, error: 'Company name is too long' }
  }

  // Remove control characters and null bytes
  const cleaned = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  // Check for HTML/script injection attempts
  if (/<script|<iframe|javascript:|on\w+=/i.test(cleaned)) {
    return { valid: false, sanitized: null, error: 'Company name contains invalid content' }
  }

  return { valid: true, sanitized: cleaned, error: null }
}

/**
 * Sanitize prompt text
 * @param {string} prompt - Prompt text to sanitize
 * @returns {{valid: boolean, sanitized: string|null, error: string|null}}
 */
export const sanitizePrompt = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, sanitized: null, error: 'Prompt is required' }
  }

  // Trim
  const trimmed = prompt.trim()

  // Check length
  if (trimmed.length === 0) {
    return { valid: false, sanitized: null, error: 'Prompt cannot be empty' }
  }

  if (trimmed.length > MAX_LENGTHS.prompt) {
    return { valid: false, sanitized: null, error: `Prompt is too long (max ${MAX_LENGTHS.prompt} characters)` }
  }

  // Remove null bytes and most control characters (keep newlines and tabs)
  const cleaned = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Check for script injection attempts
  if (/<script|<iframe|javascript:/i.test(cleaned)) {
    return { valid: false, sanitized: null, error: 'Prompt contains invalid content' }
  }

  return { valid: true, sanitized: cleaned, error: null }
}

/**
 * Sanitize URL
 * @param {string} url - URL to validate
 * @returns {{valid: boolean, sanitized: string|null, error: string|null}}
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, sanitized: null, error: 'URL is required' }
  }

  // Trim
  const trimmed = url.trim()

  // Check length
  if (trimmed.length > MAX_LENGTHS.url) {
    return { valid: false, sanitized: null, error: 'URL is too long' }
  }

  // Validate format
  if (!PATTERNS.url.test(trimmed)) {
    return { valid: false, sanitized: null, error: 'Invalid URL format' }
  }

  // Only allow http and https protocols
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return { valid: false, sanitized: null, error: 'URL must use http or https protocol' }
  }

  return { valid: true, sanitized: trimmed, error: null }
}

/**
 * Sanitize general text input
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {{valid: boolean, sanitized: string|null, error: string|null}}
 */
export const sanitizeText = (text, maxLength = MAX_LENGTHS.general) => {
  if (text === null || text === undefined) {
    return { valid: false, sanitized: null, error: 'Text is required' }
  }

  if (typeof text !== 'string') {
    return { valid: false, sanitized: null, error: 'Text must be a string' }
  }

  // Trim and remove excessive whitespace
  const sanitized = text.trim().replace(/\s+/g, ' ')

  // Check length
  if (sanitized.length > maxLength) {
    return { valid: false, sanitized: null, error: `Text is too long (max ${maxLength} characters)` }
  }

  // Remove control characters and null bytes
  const cleaned = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  // Check for script injection attempts
  if (/<script|<iframe|javascript:|on\w+=/i.test(cleaned)) {
    return { valid: false, sanitized: null, error: 'Text contains invalid content' }
  }

  return { valid: true, sanitized: cleaned, error: null }
}

/**
 * Sanitize integer input
 * @param {any} value - Value to sanitize
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {{valid: boolean, sanitized: number|null, error: string|null}}
 */
export const sanitizeInteger = (value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = parseInt(value, 10)

  if (isNaN(parsed)) {
    return { valid: false, sanitized: null, error: 'Value must be a number' }
  }

  if (parsed < min) {
    return { valid: false, sanitized: null, error: `Value must be at least ${min}` }
  }

  if (parsed > max) {
    return { valid: false, sanitized: null, error: `Value must be at most ${max}` }
  }

  return { valid: true, sanitized: parsed, error: null }
}

/**
 * Sanitize boolean input
 * @param {any} value - Value to sanitize
 * @returns {{valid: boolean, sanitized: boolean, error: string|null}}
 */
export const sanitizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return { valid: true, sanitized: value, error: null }
  }

  if (value === 'true' || value === '1' || value === 1) {
    return { valid: true, sanitized: true, error: null }
  }

  if (value === 'false' || value === '0' || value === 0) {
    return { valid: true, sanitized: false, error: null }
  }

  return { valid: false, sanitized: false, error: 'Value must be a boolean' }
}

/**
 * Batch sanitize multiple inputs
 * @param {Object} inputs - Object with input values
 * @param {Object} schema - Schema defining sanitization rules
 * @returns {{valid: boolean, sanitized: Object, errors: Object}}
 */
export const sanitizeBatch = (inputs, schema) => {
  const sanitized = {}
  const errors = {}
  let allValid = true

  for (const [key, rules] of Object.entries(schema)) {
    const value = inputs[key]
    const { type, required = false, ...options } = rules

    // Check if required
    if (required && (value === null || value === undefined || value === '')) {
      errors[key] = `${key} is required`
      allValid = false
      continue
    }

    // Skip if not required and empty
    if (!required && (value === null || value === undefined || value === '')) {
      sanitized[key] = null
      continue
    }

    // Apply appropriate sanitizer
    let result
    switch (type) {
      case 'email':
        result = sanitizeEmail(value)
        break
      case 'password':
        result = sanitizePassword(value, options.minLength)
        break
      case 'username':
        result = sanitizeUsername(value)
        break
      case 'displayName':
        result = sanitizeDisplayName(value)
        break
      case 'companyName':
        result = sanitizeCompanyName(value)
        break
      case 'prompt':
        result = sanitizePrompt(value)
        break
      case 'url':
        result = sanitizeUrl(value)
        break
      case 'text':
        result = sanitizeText(value, options.maxLength)
        break
      case 'integer':
        result = sanitizeInteger(value, options.min, options.max)
        break
      case 'boolean':
        result = sanitizeBoolean(value)
        break
      default:
        result = { valid: false, sanitized: null, error: 'Unknown type' }
    }

    if (result.valid) {
      sanitized[key] = result.sanitized
    } else {
      errors[key] = result.error
      allValid = false
    }
  }

  return { valid: allValid, sanitized, errors }
}

export default {
  sanitizeEmail,
  sanitizePassword,
  sanitizeUsername,
  sanitizeDisplayName,
  sanitizeCompanyName,
  sanitizePrompt,
  sanitizeUrl,
  sanitizeText,
  sanitizeInteger,
  sanitizeBoolean,
  sanitizeBatch,
  MAX_LENGTHS,
  PATTERNS
}
