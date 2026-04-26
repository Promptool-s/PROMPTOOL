/**
 * Structured error handling utilities
 * Returns safe JSON errors without exposing stack traces
 */

import { logger } from './logger'

/**
 * Standard error response structure
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = true
  }
}

/**
 * Common error types
 */
export const ErrorTypes = {
  VALIDATION_ERROR: (message, details) => new AppError(message, 400, 'VALIDATION_ERROR', details),
  UNAUTHORIZED: (message = 'No autorizado') => new AppError(message, 401, 'UNAUTHORIZED'),
  FORBIDDEN: (message = 'Acceso denegado') => new AppError(message, 403, 'FORBIDDEN'),
  NOT_FOUND: (message = 'Recurso no encontrado') => new AppError(message, 404, 'NOT_FOUND'),
  RATE_LIMIT: (message = 'Demasiadas solicitudes') => new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'),
  SERVER_ERROR: (message = 'Error interno del servidor') => new AppError(message, 500, 'INTERNAL_ERROR'),
  SERVICE_UNAVAILABLE: (message = 'Servicio no disponible') => new AppError(message, 503, 'SERVICE_UNAVAILABLE'),
}

/**
 * Convert error to safe JSON response
 * Never exposes stack traces in production
 * @param {Error|AppError} error
 * @returns {object}
 */
export function toSafeError(error) {
  const isProduction = import.meta.env.PROD

  // If it's our custom AppError
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        ...(error.details ? { details: error.details } : {}),
        // Only include stack in development
        ...(isProduction ? {} : { stack: error.stack }),
      },
    }
  }

  // Generic error
  return {
    success: false,
    error: {
      message: isProduction ? 'Ha ocurrido un error' : error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      // Only include stack in development
      ...(isProduction ? {} : { stack: error.stack }),
    },
  }
}

/**
 * Handle async errors in services
 * @param {Function} fn - Async function to wrap
 * @returns {Function}
 */
export function asyncHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      logger.error('Async handler caught error', error, {
        function: fn.name,
        args: args.length,
      })
      throw error
    }
  }
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Initial delay in ms
 * @returns {Promise}
 */
export async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
  let lastError

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (i < maxRetries - 1) {
        const backoffDelay = delay * Math.pow(2, i)
        logger.warn(`Retry attempt ${i + 1}/${maxRetries} after ${backoffDelay}ms`, {
          error: error.message,
        })
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
      }
    }
  }

  throw lastError
}

/**
 * Validate required fields
 * @param {object} data - Data to validate
 * @param {string[]} requiredFields - Required field names
 * @throws {AppError}
 */
export function validateRequired(data, requiredFields) {
  const missing = requiredFields.filter(field => !data[field])
  
  if (missing.length > 0) {
    throw ErrorTypes.VALIDATION_ERROR(
      'Campos requeridos faltantes',
      { missing }
    )
  }
}

/**
 * Safe JSON parse with fallback
 * @param {string} json
 * @param {any} fallback
 * @returns {any}
 */
export function safeJsonParse(json, fallback = null) {
  try {
    return JSON.parse(json)
  } catch (error) {
    logger.warn('Failed to parse JSON', { error: error.message })
    return fallback
  }
}
