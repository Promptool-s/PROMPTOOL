import crypto from 'crypto'
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
 * Supabase firma los access tokens con uno de dos esquemas, y ambos hay que
 * soportarlos porque conviven durante la migración de un proyecto:
 *  - JWT Secret clásico (HS256, simétrico) — SUPABASE_JWT_SECRET.
 *  - JWT Signing Keys nuevas (asimétricas: ES256/RS256) — el default en
 *    proyectos nuevos/migrados. La clave pública se publica en
 *    `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` y se identifica por `kid`.
 * Verificar solo HS256 (como antes) rechaza el 100% de los tokens en un
 * proyecto ya migrado a JWT Signing Keys: NINGÚN endpoint autenticado
 * funciona, con el 401 "Token inválido o expirado" silencioso de por medio.
 */
function extractToken(req) {
    const header = req.headers.authorization || ''
    if (header.startsWith('Bearer ')) return header.slice(7)
    return null
}

// Cache en memoria del JWKS del proyecto (proceso serverless de corta vida,
// así que el TTL es sobre todo para no refetchear en cada invocación cálida).
let jwksCache = { keys: [], fetchedAt: 0 }
const JWKS_TTL_MS = 10 * 60 * 1000

async function fetchJwks() {
    const supabaseUrl = config.storage.supabaseUrl
    if (!supabaseUrl) return []
    const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
    if (!res.ok) return []
    const { keys } = await res.json()
    return keys || []
}

async function getSigningKey(kid) {
    const stale = Date.now() - jwksCache.fetchedAt > JWKS_TTL_MS
    if (stale || !jwksCache.keys.length) {
        jwksCache = { keys: await fetchJwks(), fetchedAt: Date.now() }
    }
    let jwk = jwksCache.keys.find((k) => k.kid === kid)
    if (!jwk) {
        // La key pudo haber rotado desde el último fetch: reintenta una vez.
        jwksCache = { keys: await fetchJwks(), fetchedAt: Date.now() }
        jwk = jwksCache.keys.find((k) => k.kid === kid)
    }
    if (!jwk) return null
    return crypto.createPublicKey({ key: jwk, format: 'jwk' })
}

async function verifyToken(token) {
    const decoded = jwt.decode(token, { complete: true })
    const alg = decoded?.header?.alg

    if (alg === 'HS256') {
        const payload = jwt.verify(token, config.supabaseJwtSecret, {
            algorithms: ['HS256'],
            audience: 'authenticated',
        })
        return { id: payload.sub, email: payload.email || null }
    }

    const key = await getSigningKey(decoded?.header?.kid)
    if (!key) throw new Error('No se encontró la clave pública para verificar el token.')
    const payload = jwt.verify(token, key, { algorithms: [alg], audience: 'authenticated' })
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
export async function authMiddleware(req, res, next) {
    const token = extractToken(req)
    if (!token) {
        return res.status(401).json({ message: 'Token de autenticación requerido.' })
    }
    try {
        req.usuario = await verifyToken(token)
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
export async function optionalAuthMiddleware(req, res, next) {
    const token = extractToken(req)
    if (!token) {
        req.usuario = null
        return next()
    }
    try {
        req.usuario = await verifyToken(token)
    } catch {
        // Token presente pero inválido → tratar como guest, no como error,
        // para no romper flujos de sesión expirada en el juego.
        req.usuario = null
    }
    next()
}
