import crypto from 'crypto'

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

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function buildOtpHtml({ code, isEs }) {
  const title = isEs ? 'Verificá tu cuenta — PrompTool' : 'Verify your account — PrompTool'
  const heading = isEs ? 'Tu código de verificación' : 'Your verification code'
  const body = isEs
    ? 'Ingresá este código para completar tu registro. Válido por 10 minutos.'
    : 'Enter this code to complete your registration. Valid for 10 minutes.'
  const footer = isEs
    ? 'Si no solicitaste este código, ignorá este mensaje.'
    : 'If you didn\'t request this code, ignore this message.'

  return `<!DOCTYPE html>
<html lang="${isEs ? 'es' : 'en'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;border-radius:16px;overflow:hidden;background:#ffffff;box-shadow:0 1px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:32px 40px 28px;">
              <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Prompt<span style="color:#a78bfa;">Tool</span></span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${heading}</p>
              <p style="margin:0 0 28px;color:#0f172a;font-size:14px;line-height:1.6;">${body}</p>

              <!-- Code block -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;">
                    <span style="color:#0f172a;font-size:36px;font-weight:800;letter-spacing:10px;font-family:'Courier New',monospace;">${code}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">${footer}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f1f5f9;padding:20px 40px;">
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                &copy; 2025 PrompTool &middot;
                <a href="https://promptool.app" style="color:#94a3b8;text-decoration:none;">promptool.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(origin))
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const OTP_SECRET = process.env.OTP_SECRET || 'promptool-otp-default-secret-change-in-prod'
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' })

  const { email, lang } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Missing email' })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email' })

  const code = generateCode()
  const exp = Date.now() + 10 * 60 * 1000 // 10 minutes
  const payload = JSON.stringify({ email: email.toLowerCase(), code, exp })
  const sig = signPayload(payload, OTP_SECRET)
  const token = Buffer.from(payload).toString('base64url') + '.' + sig

  const isEs = lang !== 'en'
  const subject = isEs
    ? `Tu código de verificación: ${code}`
    : `Your verification code: ${code}`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PrompTool <soporte@promptool.app>',
        to: [email],
        subject,
        html: buildOtpHtml({ code, isEs }),
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[send-otp] Resend error:', err)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ token })
  } catch (err) {
    console.error('[send-otp] error:', err.message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
