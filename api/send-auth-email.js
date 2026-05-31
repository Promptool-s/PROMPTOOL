/**
 * POST /api/send-auth-email
 * Proxy para emails de Supabase Auth enviados via Resend.
 * Supabase llama a este endpoint via Hook (Auth Hook → HTTP).
 *
 * Body esperado de Supabase:
 * {
 *   user: { email, user_metadata: { nombre, full_name } },
 *   email_data: {
 *     token,           // OTP / magic link token
 *     token_hash,
 *     redirect_to,
 *     email_action_type: 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email_change'
 *   }
 * }
 */

const ALLOWED_ORIGINS = [
  'https://promptool.app',
  'https://www.promptool.app',
  'https://promptool.vercel.app',
]

function getCorsOrigin(origin) {
  if (!origin) return ALLOWED_ORIGINS[0]
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ALLOWED_ORIGINS[0]
}

// ── Email builders ─────────────────────────────────────────────────────────

function baseWrapper(content) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.09);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0e0e1a 0%,#1a0f3a 50%,#160d30 100%);padding:40px 44px 36px;">
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 18px;">
                    <span style="color:#fff;font-size:19px;font-weight:800;letter-spacing:-0.5px;">Prompt<span style="color:#a78bfa;">Tool</span></span>
                  </td>
                </tr>
              </table>
              ${content.header}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 44px 32px;">
              ${content.body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 44px 28px;">
              <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;line-height:1.6;">${content.footerNote || ''}</p>
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © 2026 PrompTool ·
                <a href="https://promptool.app" style="color:#94a3b8;text-decoration:none;">promptool.app</a>
                &nbsp;·&nbsp;
                <a href="https://promptool.app/privacy" style="color:#94a3b8;text-decoration:none;">Privacidad</a>
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

function ctaButton(label, url) {
  return `
  <table cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="border-radius:12px;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);padding:1px;">
        <a href="${url}" style="display:block;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);border-radius:11px;padding:15px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;text-align:center;">${label}</a>
      </td>
    </tr>
  </table>
  <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
    Si el botón no funciona, copiá este enlace:<br/>
    <a href="${url}" style="color:#7c3aed;word-break:break-all;font-size:11px;">${url}</a>
  </p>`
}

function buildConfirmEmail({ nombre, confirmUrl, email }) {
  return baseWrapper({
    header: `
      <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;">
        Confirmá tu cuenta, ${nombre} 👋
      </h1>
      <p style="margin:0;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">
        Ya casi estás. Solo falta verificar tu email para empezar a jugar.
      </p>`,
    body: `
      <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.65;">
        Hacé clic en el botón para confirmar tu dirección de email y activar tu cuenta en PrompTool.
        El link expira en <strong>24 horas</strong>.
      </p>
      ${ctaButton('Confirmar mi cuenta →', confirmUrl)}`,
    footerNote: `Recibiste este mail porque te registraste con ${email}. Si no fuiste vos, ignorá este mensaje.`,
  })
}

function buildResetEmail({ nombre, resetUrl, email }) {
  return baseWrapper({
    header: `
      <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;">
        Restablecer contraseña
      </h1>
      <p style="margin:0;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">
        Recibimos una solicitud para cambiar tu contraseña.
      </p>`,
    body: `
      <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.65;">
        Hola${nombre ? `, <strong>${nombre}</strong>` : ''}. Hacé clic en el botón para crear una nueva contraseña.
        El link expira en <strong>1 hora</strong>.
      </p>
      ${ctaButton('Cambiar contraseña →', resetUrl)}
      <div style="margin-top:28px;background:#fef9c3;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
          ⚠️ Si no solicitaste este cambio, ignorá este mail. Tu contraseña actual sigue siendo la misma.
        </p>
      </div>`,
    footerNote: `Solicitud enviada para la cuenta ${email}.`,
  })
}

function buildMagicLinkEmail({ nombre, magicUrl, email }) {
  return baseWrapper({
    header: `
      <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;">
        Tu link de acceso
      </h1>
      <p style="margin:0;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">
        Acceso sin contraseña a PrompTool.
      </p>`,
    body: `
      <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.65;">
        Hola${nombre ? `, <strong>${nombre}</strong>` : ''}. Hacé clic en el botón para iniciar sesión.
        El link es de <strong>un solo uso</strong> y expira en <strong>1 hora</strong>.
      </p>
      ${ctaButton('Iniciar sesión →', magicUrl)}`,
    footerNote: `Recibiste este mail porque solicitaste acceso para ${email}.`,
  })
}

function buildEmailChangeEmail({ nombre, confirmUrl, email, newEmail }) {
  return baseWrapper({
    header: `
      <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;">
        Confirmá tu nuevo email
      </h1>
      <p style="margin:0;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">
        Verificación de cambio de dirección de email.
      </p>`,
    body: `
      <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.65;">
        Hola${nombre ? `, <strong>${nombre}</strong>` : ''}. Confirmá que querés cambiar tu email a
        <strong>${newEmail || email}</strong> haciendo clic en el botón.
      </p>
      ${ctaButton('Confirmar nuevo email →', confirmUrl)}`,
    footerNote: `Solicitud de cambio de email para la cuenta ${email}.`,
  })
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(origin))
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify the shared secret sent by Supabase Auth Hook.
  // Set SUPABASE_AUTH_HOOK_SECRET in Vercel env vars AND in the Supabase
  // Auth Hook configuration (Authorization header → Bearer <secret>).
  const AUTH_HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (AUTH_HOOK_SECRET) {
    const authHeader = req.headers.authorization || ''
    const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (provided !== AUTH_HOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' })

  const { user, email_data } = req.body || {}
  const email = user?.email || ''
  const nombre = user?.user_metadata?.nombre || user?.user_metadata?.full_name || ''
  const actionType = email_data?.email_action_type || ''
  const token = email_data?.token || ''
  const tokenHash = email_data?.token_hash || ''
  const redirectTo = email_data?.redirect_to || 'https://promptool.app'

  if (!email || !actionType) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Construir la URL de acción
  const baseUrl = 'https://promptool.app'
  const actionUrl = tokenHash
    ? `${baseUrl}/api/auth/confirm?token_hash=${tokenHash}&type=${actionType}&redirect_to=${encodeURIComponent(redirectTo)}`
    : `${baseUrl}/api/auth/confirm?token=${token}&type=${actionType}&redirect_to=${encodeURIComponent(redirectTo)}`

  let subject, html

  switch (actionType) {
    case 'signup':
    case 'email_confirmation':
      subject = `Confirmá tu cuenta en PrompTool`
      html = buildConfirmEmail({ nombre, confirmUrl: actionUrl, email })
      break
    case 'recovery':
      subject = `Restablecer contraseña — PrompTool`
      html = buildResetEmail({ nombre, resetUrl: actionUrl, email })
      break
    case 'magiclink':
      subject = `Tu link de acceso a PrompTool`
      html = buildMagicLinkEmail({ nombre, magicUrl: actionUrl, email })
      break
    case 'email_change':
      subject = `Confirmá tu nuevo email en PrompTool`
      html = buildEmailChangeEmail({ nombre, confirmUrl: actionUrl, email, newEmail: email_data?.new_email })
      break
    default:
      subject = `Acción requerida en PrompTool`
      html = buildConfirmEmail({ nombre, confirmUrl: actionUrl, email })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PrompTool <support@promptool.app>',
        to: [email],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[send-auth-email] Resend error:', err)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[send-auth-email] error:', err.message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
