import { config } from '../config/env.js'

/**
 * Error handler global — SIEMPRE el último middleware registrado.
 * Convención (de la guía de arquitectura):
 *  - Errores de negocio traen .statusCode (400/403/404/...) y su mensaje es seguro de exponer.
 *  - Errores de infraestructura (pg, fetch, etc.) NO traen statusCode →
 *    500 con mensaje genérico; el detalle solo va al log del servidor.
 */
export function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500

    if (statusCode >= 500) {
        console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} →`, err)
    }

    res.status(statusCode).json({
        message: statusCode >= 500 && config.isProduction
            ? 'Error interno del servidor.'
            : err.message,
    })
}

/** 404 para rutas no registradas. */
export function notFoundHandler(req, res) {
    res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` })
}
