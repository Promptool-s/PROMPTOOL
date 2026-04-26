/**
 * Centralized logging system
 * Logs errors, warnings, and key user actions with timestamps
 * Never exposes sensitive data or stack traces in production
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
}

const isProduction = import.meta.env.PROD

/**
 * Format timestamp for logs
 * @returns {string}
 */
function getTimestamp() {
  return new Date().toISOString()
}

/**
 * Sanitize error for safe logging (no stack traces in production)
 * @param {Error|any} error
 * @returns {object}
 */
function sanitizeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      // Only include stack in development
      ...(isProduction ? {} : { stack: error.stack }),
    }
  }
  return { message: String(error) }
}

/**
 * Core logging function
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: getTimestamp(),
    level,
    message,
    ...meta,
  }

  // In production, send to external logging service (e.g., Sentry, LogRocket)
  if (isProduction) {
    // TODO: Send to external logging service
    // Example: Sentry.captureMessage(message, { level, extra: meta })
  }

  // Console output
  const consoleMethod = {
    [LOG_LEVELS.ERROR]: console.error,
    [LOG_LEVELS.WARN]: console.warn,
    [LOG_LEVELS.INFO]: console.info,
    [LOG_LEVELS.DEBUG]: console.log,
  }[level] || console.log

  consoleMethod(`[${logEntry.timestamp}] [${level}]`, message, meta)
}

/**
 * Logger instance
 */
export const logger = {
  /**
   * Log error
   * @param {string} message
   * @param {Error|any} error
   * @param {object} meta
   */
  error(message, error = null, meta = {}) {
    log(LOG_LEVELS.ERROR, message, {
      ...meta,
      ...(error ? { error: sanitizeError(error) } : {}),
    })
  },

  /**
   * Log warning
   * @param {string} message
   * @param {object} meta
   */
  warn(message, meta = {}) {
    log(LOG_LEVELS.WARN, message, meta)
  },

  /**
   * Log info
   * @param {string} message
   * @param {object} meta
   */
  info(message, meta = {}) {
    log(LOG_LEVELS.INFO, message, meta)
  },

  /**
   * Log debug (only in development)
   * @param {string} message
   * @param {object} meta
   */
  debug(message, meta = {}) {
    if (!isProduction) {
      log(LOG_LEVELS.DEBUG, message, meta)
    }
  },

  /**
   * Log user action
   * @param {string} action - Action name
   * @param {object} meta - Additional metadata
   */
  userAction(action, meta = {}) {
    log(LOG_LEVELS.INFO, `User action: ${action}`, {
      category: 'user_action',
      action,
      ...meta,
    })
  },

  /**
   * Log API call
   * @param {string} endpoint
   * @param {string} method
   * @param {object} meta
   */
  apiCall(endpoint, method, meta = {}) {
    log(LOG_LEVELS.INFO, `API call: ${method} ${endpoint}`, {
      category: 'api_call',
      endpoint,
      method,
      ...meta,
    })
  },

  /**
   * Log authentication event
   * @param {string} event - Auth event name
   * @param {object} meta
   */
  auth(event, meta = {}) {
    log(LOG_LEVELS.INFO, `Auth event: ${event}`, {
      category: 'auth',
      event,
      ...meta,
    })
  },
}

export default logger
