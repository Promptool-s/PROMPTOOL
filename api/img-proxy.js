// Allowlisted domains for image proxying — add more as needed
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
]

// Block private/internal IP ranges (SSRF protection)
const BLOCKED_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i,
  /^0\.0\.0\.0$/,
]

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

function isBlockedHost(hostname) {
  return BLOCKED_IP_PATTERNS.some(p => p.test(hostname))
}

function isDomainAllowed(hostname) {
  return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))
}

export default async function handler(req, res) {
  // CORS — only allow our own origin
  const origin = req.headers.origin || ''
  const allowedOrigins = [
    'https://promptool.app',
    'https://www.promptool.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean)

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : allowedOrigins[0])
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', '86400')
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.query

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  let targetUrl
  let parsedUrl
  try {
    targetUrl = decodeURIComponent(url)
    parsedUrl = new URL(targetUrl)
  } catch {
    return res.status(400).json({ error: 'Invalid url' })
  }

  // Protocol check
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'Only http/https allowed' })
  }

  const hostname = parsedUrl.hostname.toLowerCase()

  // Block internal/private IPs (SSRF)
  if (isBlockedHost(hostname)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Domain allowlist
  if (!isDomainAllowed(hostname)) {
    return res.status(403).json({ error: 'Domain not allowed' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PrompToolProxy/1.0',
        'Accept': 'image/*',
      },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' })
    }

    const contentType = response.headers.get('content-type') || ''
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']

    if (!allowedTypes.some(t => contentType.startsWith(t))) {
      return res.status(400).json({ error: 'URL is not an allowed image type' })
    }

    // Size check — stream with limit
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
    if (contentLength > MAX_SIZE_BYTES) {
      return res.status(413).json({ error: 'Image too large' })
    }

    const buffer = await response.arrayBuffer()

    if (buffer.byteLength > MAX_SIZE_BYTES) {
      return res.status(413).json({ error: 'Image too large' })
    }

    // Security headers on response
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
    res.setHeader('Access-Control-Allow-Origin', corsOrigin)
    res.setHeader('Content-Type', contentType.split(';')[0].trim())
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'")
    res.status(200).send(Buffer.from(buffer))
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' })
    }
    console.error('[img-proxy] error:', err.message)
    res.status(500).json({ error: 'Proxy error' })
  }
}
