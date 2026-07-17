import { Router } from 'express'
import { config } from '../config/env.js'

/**
 * GET /api/img-proxy — proxy de imágenes (port de la función serverless
 * api/img-proxy.js al Express, para que funcione igual en dev local y pueda
 * eliminarse la función suelta). Mismas protecciones: allowlist de dominios,
 * bloqueo de IPs privadas (SSRF), tipos de imagen permitidos, límite 10MB,
 * timeout 10s.
 */

const ALLOWED_DOMAINS = [
    'rexysehzyqfxpkvajnpy.supabase.co',
    'supabase.co',
    'storage.googleapis.com',
    'res.cloudinary.com',
    'images.unsplash.com',
    'cdn.discordapp.com',
    'media.discordapp.net',
    'i.imgur.com',
    'image-generator.com',
    'cdn.spaceprompts.com',
    'googleusercontent.com',
    'lh3.googleusercontent.com',
    'blogger.googleusercontent.com',
]

const BLOCKED_IP_PATTERNS = [
    /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
    /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/, /^localhost$/i, /^0\.0\.0\.0$/,
]

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isBlockedHost = (hostname) => BLOCKED_IP_PATTERNS.some((p) => p.test(hostname))
const isDomainAllowed = (hostname) => ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))

/** Resuelve la URL destino desde ?url= o ?id= (UUID de imagenes_ia). */
async function resolveTargetUrl(query) {
    const { url, id } = query

    if (id) {
        if (!UUID_RE.test(id)) return { error: 'Invalid id', status: 400 }

        const supabaseUrl = config.storage.supabaseUrl || (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
        const supabaseKey = config.storage.serviceRoleKey || process.env.VITE_SUPABASE_ANON_KEY || ''
        if (!supabaseUrl || !supabaseKey) return { error: 'Server config error', status: 503 }

        const dbResp = await fetch(
            `${supabaseUrl}/rest/v1/imagenes_ia?id_imagen=eq.${id}&select=url_image&limit=1`,
            { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        )
        if (!dbResp.ok) return { error: 'DB error', status: 502 }

        const rows = await dbResp.json()
        if (!rows.length || !rows[0].url_image) return { error: 'Not found', status: 404 }
        return { targetUrl: rows[0].url_image }
    }

    if (url) return { targetUrl: decodeURIComponent(url) }
    return { error: 'Missing url or id parameter', status: 400 }
}

const router = Router()

router.get('', async (req, res) => {
    const resolved = await resolveTargetUrl(req.query).catch(() => ({ error: 'Proxy error', status: 500 }))
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error })

    let parsedUrl
    try {
        parsedUrl = new URL(resolved.targetUrl)
    } catch {
        return res.status(400).json({ message: 'Invalid url' })
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ message: 'Only http/https allowed' })
    }

    const hostname = parsedUrl.hostname.toLowerCase()
    if (isBlockedHost(hostname)) return res.status(403).json({ message: 'Forbidden' })
    if (!isDomainAllowed(hostname)) return res.status(403).json({ message: 'Domain not allowed' })

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10_000)
        const response = await fetch(resolved.targetUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'PrompToolProxy/1.0', Accept: 'image/*' },
        })
        clearTimeout(timeout)

        if (!response.ok) return res.status(response.status).json({ message: 'Failed to fetch image' })

        const contentType = response.headers.get('content-type') || ''
        if (!ALLOWED_TYPES.some((t) => contentType.startsWith(t))) {
            return res.status(400).json({ message: 'URL is not an allowed image type' })
        }

        const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
        if (contentLength > MAX_SIZE_BYTES) return res.status(413).json({ message: 'Image too large' })

        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.byteLength > MAX_SIZE_BYTES) return res.status(413).json({ message: 'Image too large' })

        res.setHeader('Content-Type', contentType.split(';')[0].trim())
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Content-Security-Policy', "default-src 'none'")
        res.status(200).send(buffer)
    } catch (err) {
        if (err.name === 'AbortError') return res.status(504).json({ message: 'Request timeout' })
        console.error('[img-proxy] error:', err.message)
        res.status(500).json({ message: 'Proxy error' })
    }
})

export default router
