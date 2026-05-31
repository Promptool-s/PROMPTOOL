import crypto from 'crypto'

// Rate limit verify attempts per token prefix (prevent brute-force of 6-digit code)
const verifyRateMap = new Map()
function checkVerifyRateLimit(tokenPrefix) {
  const now = Date.now()
  const entry = verifyRateMap.get(tokenPrefix)
  const WINDOW = 10 * 60 * 1000 // 10 min (matches OTP expiry)
  const MAX = 8 // 8 attempts per token before lockout
  if (!entry || now > entry.resetAt) {
    verifyRateMap.set(tokenPrefix, { count: 1, resetAt: now + WINDOW })
    return true
  }
  if (entry.count >= MAX) return false
  entry.count++
  return true
}

const ALLOWED_ORIGINS = [
  'https://promptool.app',
  'https://www.promptool.app',
  'https://promptool.vercel.app',
]

function getCorsOrigin(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ALLOWED_ORIGINS[0]
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(origin))
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const OTP_SECRET = process.env.OTP_SECRET
  if (!OTP_SECRET) return res.status(500).json({ error: 'OTP service not configured' })
  const { token, code, email } = req.body || {}

  if (!token || !code || !email) {
    return res.status(400).json({ error: 'Missing fields' })
  }

  // Rate limit by token prefix to prevent brute-force of 6-digit codes
  const tokenPrefix = token.slice(0, 20)
  if (!checkVerifyRateLimit(tokenPrefix)) {
    return res.status(429).json({ error: 'Too many attempts. Please request a new code.' })
  }

  try {
    const [payloadB64, sig] = token.split('.')
    if (!payloadB64 || !sig) return res.status(400).json({ error: 'Invalid token format' })

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8')
    const expectedSig = signPayload(payloadStr, OTP_SECRET)

    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return res.status(400).json({ error: 'Invalid token' })
    }

    const payload = JSON.parse(payloadStr)

    if (Date.now() > payload.exp) {
      return res.status(400).json({ error: 'Code expired' })
    }

    if (payload.email !== email.toLowerCase()) {
      return res.status(400).json({ error: 'Email mismatch' })
    }

    if (payload.code !== code.trim()) {
      return res.status(400).json({ error: 'Wrong code' })
    }

    return res.status(200).json({ verified: true })
  } catch {
    return res.status(400).json({ error: 'Invalid token' })
  }
}
