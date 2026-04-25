/**
 * Helper seguro para localStorage
 * Previene errores por datos corruptos y valida tipos
 */

/**
 * Lee un item de localStorage de forma segura
 * @param {string} key - Clave del item
 * @param {any} defaultValue - Valor por defecto si no existe o hay error
 * @returns {any} - Valor parseado o defaultValue
 */
export const safeGetItem = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key)
    if (!item) return defaultValue
    
    // Intentar parsear si es JSON
    try {
      const parsed = JSON.parse(item)
      return parsed
    } catch {
      // Si no es JSON, devolver como string
      return item
    }
  } catch (error) {
    console.error('[LocalStorage] Error reading:', key, error)
    return defaultValue
  }
}

/**
 * Guarda un item en localStorage de forma segura
 * @param {string} key - Clave del item
 * @param {any} value - Valor a guardar
 * @returns {boolean} - true si se guardó correctamente
 */
export const safeSetItem = (key, value) => {
  try {
    const stringValue = typeof value === 'string' 
      ? value 
      : JSON.stringify(value)
    
    // Validar tamaño (localStorage tiene límite de ~5MB)
    if (stringValue.length > 5 * 1024 * 1024) {
      console.warn('[LocalStorage] Value too large:', key)
      return false
    }
    
    localStorage.setItem(key, stringValue)
    return true
  } catch (error) {
    console.error('[LocalStorage] Error writing:', key, error)
    return false
  }
}

/**
 * Elimina un item de localStorage de forma segura
 * @param {string} key - Clave del item
 * @returns {boolean} - true si se eliminó correctamente
 */
export const safeRemoveItem = (key) => {
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error('[LocalStorage] Error removing:', key, error)
    return false
  }
}

/**
 * Limpia todo el localStorage de forma segura
 * @returns {boolean} - true si se limpió correctamente
 */
export const safeClear = () => {
  try {
    localStorage.clear()
    return true
  } catch (error) {
    console.error('[LocalStorage] Error clearing:', error)
    return false
  }
}

/**
 * Verifica si localStorage está disponible
 * @returns {boolean} - true si está disponible
 */
export const isLocalStorageAvailable = () => {
  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Lee un item con validación de tipo
 * @param {string} key - Clave del item
 * @param {string} expectedType - Tipo esperado ('string', 'number', 'boolean', 'object', 'array')
 * @param {any} defaultValue - Valor por defecto
 * @returns {any} - Valor validado o defaultValue
 */
export const safeGetTyped = (key, expectedType, defaultValue = null) => {
  const value = safeGetItem(key, defaultValue)
  
  if (value === defaultValue) return defaultValue
  
  // Validar tipo
  switch (expectedType) {
    case 'string':
      return typeof value === 'string' ? value : defaultValue
    case 'number':
      return typeof value === 'number' && !isNaN(value) ? value : defaultValue
    case 'boolean':
      return typeof value === 'boolean' ? value : defaultValue
    case 'object':
      return value && typeof value === 'object' && !Array.isArray(value) ? value : defaultValue
    case 'array':
      return Array.isArray(value) ? value : defaultValue
    default:
      return value
  }
}

/**
 * Lee un item con validación de estructura
 * @param {string} key - Clave del item
 * @param {Object} schema - Schema de validación { field: 'type' }
 * @param {any} defaultValue - Valor por defecto
 * @returns {any} - Valor validado o defaultValue
 */
export const safeGetValidated = (key, schema, defaultValue = null) => {
  const value = safeGetItem(key, defaultValue)
  
  if (value === defaultValue) return defaultValue
  if (typeof value !== 'object' || value === null) return defaultValue
  
  // Validar cada campo del schema
  for (const [field, expectedType] of Object.entries(schema)) {
    if (!(field in value)) return defaultValue
    
    const fieldValue = value[field]
    
    switch (expectedType) {
      case 'string':
        if (typeof fieldValue !== 'string') return defaultValue
        break
      case 'number':
        if (typeof fieldValue !== 'number' || isNaN(fieldValue)) return defaultValue
        break
      case 'boolean':
        if (typeof fieldValue !== 'boolean') return defaultValue
        break
      case 'object':
        if (!fieldValue || typeof fieldValue !== 'object' || Array.isArray(fieldValue)) return defaultValue
        break
      case 'array':
        if (!Array.isArray(fieldValue)) return defaultValue
        break
    }
  }
  
  return value
}

/**
 * Lee un item con TTL (Time To Live)
 * @param {string} key - Clave del item
 * @param {number} ttl - TTL en milisegundos
 * @param {any} defaultValue - Valor por defecto
 * @returns {any} - Valor si no expiró, defaultValue si expiró
 */
export const safeGetWithTTL = (key, ttl, defaultValue = null) => {
  const stored = safeGetItem(key, null)
  
  if (!stored || typeof stored !== 'object') return defaultValue
  if (!('value' in stored) || !('timestamp' in stored)) return defaultValue
  
  const now = Date.now()
  const age = now - stored.timestamp
  
  if (age > ttl) {
    safeRemoveItem(key)
    return defaultValue
  }
  
  return stored.value
}

/**
 * Guarda un item con TTL (Time To Live)
 * @param {string} key - Clave del item
 * @param {any} value - Valor a guardar
 * @returns {boolean} - true si se guardó correctamente
 */
export const safeSetWithTTL = (key, value) => {
  return safeSetItem(key, {
    value,
    timestamp: Date.now()
  })
}

export default {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
  safeClear,
  isLocalStorageAvailable,
  safeGetTyped,
  safeGetValidated,
  safeGetWithTTL,
  safeSetWithTTL
}
