/**
 * Crea y lanza un Error con statusCode, capturado por el errorHandler global.
 * Convención: los errores de negocio llevan statusCode; los de infraestructura
 * se propagan sin statusCode y el errorHandler los traduce a 500 genérico.
 */
export function throwError(message, statusCode = 400) {
    const error = new Error(message)
    error.statusCode = statusCode
    throw error
}
