import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limiting real, por IP (o por usuario) y en el servidor.
 * En serverless la memoria no se comparte entre invocaciones, así que el
 * store vive en Upstash Redis (REST). Sin las env UPSTASH_* (dev local)
 * cae a una ventana fija en memoria: alcanza para un proceso único.
 */

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

if (!redis && process.env.VERCEL) {
    console.error('[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN no configuradas: los límites son por instancia (inefectivos).')
}

const ipDe = (req) => req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'

/** Fallback dev: fixed-window en memoria por prefijo. */
function memoryLimit(prefix, limit, windowMs) {
    const hits = new Map()
    return (key) => {
        const now = Date.now()
        const entry = hits.get(key)
        if (!entry || now >= entry.reset) {
            hits.set(key, { count: 1, reset: now + windowMs })
            return { success: true, reset: now + windowMs }
        }
        entry.count += 1
        return { success: entry.count <= limit, reset: entry.reset }
    }
}

/**
 * Crea un middleware de rate limit.
 * @param {object} opts
 * @param {string} opts.prefix   Prefijo de la key en Redis.
 * @param {number} opts.limit    Cantidad de requests permitidas por ventana.
 * @param {number} opts.windowSeconds Ventana en segundos.
 * @param {(req) => string|null} [opts.keyFn] Key custom; si devuelve null se usa la IP.
 * @param {string} opts.message  Mensaje del 429.
 */
function buildLimiter({ prefix, limit, windowSeconds, keyFn, message }) {
    const limiter = redis
        ? new Ratelimit({ redis, prefix, limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`) })
        : null
    const fallback = redis ? null : memoryLimit(prefix, limit, windowSeconds * 1000)

    return async (req, res, next) => {
        try {
            const key = keyFn?.(req) ?? ipDe(req)
            const { success, reset } = limiter
                ? await limiter.limit(String(key ?? ipDe(req)))
                : fallback(String(key ?? ipDe(req)))
            if (!success) {
                res.setHeader('Retry-After', Math.max(1, Math.ceil((reset - Date.now()) / 1000)))
                return res.status(429).json({ message })
            }
            return next()
        } catch (error) {
            // Si Upstash falla no se bloquea la API entera: se deja pasar y se loguea.
            console.error('[rate-limit] error consultando el store:', error?.message)
            return next()
        }
    }
}

/** Límite general para toda la API. */
export const generalLimiter = buildLimiter({
    prefix: 'rl:gen',
    limit: 300,
    windowSeconds: 15 * 60,
    message: 'Demasiadas solicitudes. Probá de nuevo en unos minutos.',
})

/**
 * Límite estricto para endpoints caros (evaluación con LLM).
 * Por usuario autenticado cuando existe (debe montarse DESPUÉS del auth
 * middleware en la ruta), por IP para guests.
 */
export const evaluationLimiter = buildLimiter({
    prefix: 'rl:eval',
    limit: 10,
    windowSeconds: 60,
    keyFn: (req) => req.usuario?.id ?? null,
    message: 'Demasiados intentos seguidos. Esperá un momento.',
})

/**
 * Límite para envío de emails no autenticados (OTP): evita abuso del
 * remitente. 5 envíos por IP cada 10 minutos.
 */
export const emailSendLimiter = buildLimiter({
    prefix: 'rl:email',
    limit: 5,
    windowSeconds: 10 * 60,
    message: 'Demasiados envíos. Esperá unos minutos antes de pedir otro código.',
})

/**
 * Límite para verificación de OTP: frena el brute-force del código de 6 dígitos.
 * 12 intentos por IP cada 10 minutos (ventana que coincide con el TTL del OTP).
 */
export const otpVerifyLimiter = buildLimiter({
    prefix: 'rl:otp',
    limit: 12,
    windowSeconds: 10 * 60,
    message: 'Demasiados intentos. Pedí un código nuevo.',
})
