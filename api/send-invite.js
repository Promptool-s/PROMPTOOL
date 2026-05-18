const ALLOWED_ORIGINS = [
  'https://promptool.app',
  'https://www.promptool.app',
]

function getCorsOrigin(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ALLOWED_ORIGINS[0]
}

function buildEmailHtml({ companyName, inviterName, recipientEmail, joinUrl, isExistingUser }) {
  const ctaLabel = isExistingUser ? 'Unirme al equipo' : 'Crear mi cuenta'
  const headline = isExistingUser
    ? `${inviterName || companyName} te invita a unirte a su equipo`
    : `${inviterName || companyName} te invita a PrompTool`
  const body = isExistingUser
    ? `Tu cuenta de PrompTool ya está lista. Solo necesitás aceptar la invitación para empezar a colaborar con el equipo de <strong>${companyName}</strong>.`
    : `PrompTool es la plataforma donde los equipos aprenden a comunicarse con la IA. Cada día hay un nuevo desafío de prompting, feedback real y métricas de equipo para que <strong>${companyName}</strong> mida el progreso de sus integrantes.`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Invitación a PrompTool</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);padding:40px 40px 32px;">
              <!-- Logo mark -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 16px;">
                    <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Prompt<span style="color:#a78bfa;">Tool</span></span>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;color:rgba(255,255,255,0.7);font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:1px;">Invitación de equipo</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.25;">${headline}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.65;">${body}</p>

              ${!isExistingUser ? `
              <!-- Feature list -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;width:100%;">
                <tr>
                  <td style="background:#f8f4ff;border-radius:12px;padding:20px 24px;">
                    <p style="margin:0 0 12px;color:#6d28d9;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Qué incluye</p>
                    ${[
                      'Desafío de prompting nuevo cada día',
                      'Score y feedback de IA en tiempo real',
                      'Ranking interno del equipo',
                      'Panel de analytics para el admin',
                    ].map(f => `
                    <table cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="width:20px;vertical-align:top;padding-top:2px;">
                          <span style="display:inline-block;width:16px;height:16px;background:#7c3aed;border-radius:50%;text-align:center;line-height:16px;font-size:10px;color:#fff;">✓</span>
                        </td>
                        <td style="padding-left:8px;color:#374151;font-size:14px;">${f}</td>
                      </tr>
                    </table>`).join('')}
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:10px;padding:1px;">
                    <a href="${joinUrl}" style="display:inline-block;background:#7c3aed;border-radius:9px;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${ctaLabel} →</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">Si el botón no funciona, copiá este enlace en tu navegador:<br/>
                <a href="${joinUrl}" style="color:#7c3aed;word-break:break-all;">${joinUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                Recibiste este correo porque <strong>${companyName}</strong> te invitó a PrompTool.<br/>
                Si no esperabas esta invitación, podés ignorar este mensaje.
              </p>
              <p style="margin:12px 0 0;color:#cbd5e1;font-size:11px;">
                © 2025 PrompTool · <a href="https://promptool.app" style="color:#94a3b8;text-decoration:none;">promptool.app</a>
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
  const corsOrigin = getCorsOrigin(origin)

  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' })

  const { recipientEmail, companyName, inviterName, joinUrl, isExistingUser } = req.body || {}

  if (!recipientEmail || !companyName || !joinUrl) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(recipientEmail)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  const subject = isExistingUser
    ? `${companyName} te invita a unirte a su equipo en PrompTool`
    : `Tenés una invitación para PrompTool de parte de ${companyName}`

  const html = buildEmailHtml({ companyName, inviterName, recipientEmail, joinUrl, isExistingUser })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PrompTool <soporte@promptool.app>',
        to: [recipientEmail],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[send-invite] Resend error:', err)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[send-invite] error:', err.message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
