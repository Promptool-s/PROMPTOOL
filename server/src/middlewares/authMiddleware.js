import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'

/**
 * Verifica el access token emitido por Supabase Auth.
 * El frontend sigue haciendo login con supabase.auth (no cambia nada ahí);
 * para llamar a este backend manda el token de la sesión:
 *
 *   const { data: { session } } = await supabase.auth.getSession()
 *   fetch('/api/...', { headers: { Authorization: `Bearer ${session.access_token}` } })
 *
 * NOTA: proyectos Supabase con "JWT signing keys" nuevas (RS256/ES256) deben
 * migrar esta verificación a JWKS. Los proyectos con el JWT Secret clásico
 * usan HS256, que es lo que se verifica acá.
 */
function extractToken(req) {
    const header = req.headers.authorization || ''
    if (header.startsWith('Bearer ')) return header.slice(7)
    return null
}

function verifyToken(token) {
    const payload = jwt.verify(token, config.supabaseJwtSecret, {
        algorithms: ['HS256'],
        audience: 'authenticated',
    })
    return {
        id: payload.sub,
        email: payload.email || null,
        // IMPORTANTE: user_metadata es editable por el propio usuario desde el
        // cliente — NUNCA usarlo para autorización. La autorización real
        // (adminstate, suspensiones) se lee de la BD en cada request que lo
        // necesite (ver adminMiddleware / services).
    }
}

/** Auth obligatoria: 401 si no hay token válido. */
export function authMiddleware(req, res, next) {
    const token = extractToken(req)
    if (!token) {
        return res.status(401).json({ message: 'Token de autenticación requerido.' })
    }
    try {
        req.usuario = verifyToken(token)
        next()
    } catch {
        return res.status(401).json({ message: 'Token inválido o expirado.' })
    }
}

/**
 * Auth opcional: si viene token válido setea req.usuario, si no sigue como
 * invitado (req.usuario = null). Para endpoints que permiten guests
 * (ej. enviar un intento de práctica).
 */
export function optionalAuthMiddleware(req, res, next) {
    const token = extractToken(req)
    if (!token) {
        req.usuario = null
        return next()
    }
    try {
        req.usuario = verifyToken(token)
    } catch {
        // Token presente pero inválido → tratar como guest, no como error,
        // para no romper flujos de sesión expirada en el juego.
        req.usuario = null
    }
    next()
}
