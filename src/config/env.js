/**
 * Environment variable validation
 * Validates all required environment variables at startup
 * Crashes early if any required keys are missing
 */

const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_GROQ_API_KEY',
]

const optionalEnvVars = [
  'VITE_IMG_PROXY_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

/**
 * Validates that all required environment variables are present
 * @throws {Error} If any required variable is missing
 */
export function validateEnv() {
  const missing = []
  const warnings = []

  // Check required variables
  for (const key of requiredEnvVars) {
    const value = import.meta.env[key]
    if (!value || value.trim() === '') {
      missing.push(key)
    }
  }

  // Check optional variables (just warn)
  for (const key of optionalEnvVars) {
    const value = import.meta.env[key]
    if (!value || value.trim() === '') {
      warnings.push(key)
    }
  }

  // Crash early if required variables are missing
  if (missing.length > 0) {
    const errorMsg = `
╔════════════════════════════════════════════════════════════╗
║  FATAL ERROR: Missing Required Environment Variables      ║
╚════════════════════════════════════════════════════════════╝

The following required environment variables are not set:
${missing.map(key => `  ❌ ${key}`).join('\n')}

Please create a .env file in the project root with these variables.
See .env.example for reference.

Application cannot start without these variables.
`
    console.error(errorMsg)
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Log warnings for optional variables
  if (warnings.length > 0) {
    console.warn('⚠️  Optional environment variables not set:', warnings.join(', '))
  }

  // Log success
  console.log('✅ Environment variables validated successfully')
}

/**
 * Get environment variable with fallback
 * @param {string} key - Environment variable key
 * @param {string} fallback - Fallback value if not set
 * @returns {string}
 */
export function getEnv(key, fallback = '') {
  return import.meta.env[key] || fallback
}

/**
 * Check if running in production
 * @returns {boolean}
 */
export function isProduction() {
  return import.meta.env.PROD
}

/**
 * Check if running in development
 * @returns {boolean}
 */
export function isDevelopment() {
  return import.meta.env.DEV
}
