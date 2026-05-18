const ALLOWED_ORIGINS = [
  'https://promptool.app',
  'https://www.promptool.app',
]

function getCorsOrigin(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ALLOWED_ORIGINS[0]
}

function buildWelcomeHtml({ nombre, email, userType, lang }) {
  const isEnterprise = userType === 'enterprise'
  const isEs = lang === 'es'

  const headline = isEs
    ? `Bienvenido${isEnterprise ? ' a PrompTool Enterprise' : ' a PrompTool'}, ${nombre} 👋`
    : `Welcome${isEnterprise ? ' to PrompTool Enterprise' : ' to PrompTool'}, ${nombre} 👋`

  const subheadline = isEs
    ? 'Tu cuenta está lista. Esto es lo que podés hacer desde hoy.'
    : 'Your account is ready. Here's what you can do starting today.'

  const steps = isEs
    ? [
        { n: '01', t: 'Jugá el desafío diario', d: 'Cada día hay una imagen nueva generada por IA. Tu misión: adivinar el prompt que la creó.' },
        { n: '02', t: 'Recibí feedback real', d: 'La IA compara tu prompt con el original y te da un score con sugerencias concretas para mejorar.' },
        { n: '03', t: isEnterprise ? 'Armá tu equipo' : 'Subí en el ranking', d: isEnterprise ? 'Invitá a los miembros de tu equipo y seguí su progreso desde el panel de empresa.' : 'Cada intento suma a tu posición en el leaderboard mensual. El mejor prompter gana una badge exclusiva.' },
      ]
    : [
        { n: '01', t: 'Play the daily challenge', d: 'Every day there's a new AI-generated image. Your mission: guess the prompt that created it.' },
        { n: '02', t: 'Get real feedback', d: 'The AI compares your prompt to the original and gives you a detailed score with concrete suggestions.' },
        { n: '03', t: isEnterprise ? 'Build your team' : 'Climb the ranking', d: isEnterprise ? 'Invite your team members and track their progress from the company dashboard.' : 'Every attempt counts toward your position in the monthly leaderboard. The best prompter earns an exclusive badge.' },
      ]

  const ctaLabel = isEs ? 'Empezar a jugar →' : 'Start playing →'
  const ctaUrl = 'https://promptool.app'

  const tipLabel = isEs ? '💡 Tip para arrancar' : '💡 Starter tip'
  const tipText = isEs
    ? 'Cuanto más específico seas en tu prompt — luz, estilo, detalles del sujeto — más alto va a ser tu score. No alcanza con describir lo obvio.'
    : 'The more specific your prompt — lighting, style, subject details — the higher your score. Just describing the obvious won't cut it.'

  const footerNote = isEs
    ? `Recibiste este mail porque te registraste con ${email}.`
    : `You received this email because you signed up with ${email}.`

  return `<!DOCTYPE html>
<html lang="${isEs ? 'es' : 'en'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${isEs ? 'Bienvenido a PrompTool' : 'Welcome to PrompTool'}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:580px;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.09);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0e0e1a 0%,#1a1040 40%,#0c2a3a 100%);padding:44px 44px 36px;position:relative;">
              <!-- Logo -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 18px;">
                    <span style="color:#fff;font-size:19px;font-weight:800;letter-spacing:-0.5px;">Prompt<span style="color:#22d3ee;">Tool</span></span>
                  </td>
                </tr>
              </table>

              <!-- Headline -->
              <h1 style="margin:0 0 10px;color:#ffffff;font-size:28px;font-weight:800;line-height:1.2;">${headline}</h1>
              <p style="margin:0;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">${subheadline}</p>

              ${isEnterprise ? `
              <!-- Enterprise badge -->
              <div style="margin-top:20px;display:inline-block;background:rgba(124,58,237,0.25);border:1px solid rgba(124,58,237,0.5);border-radius:99px;padding:5px 14px;">
                <span style="color:#c4b5fd;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Enterprise</span>
              </div>` : ''}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 44px 32px;">

              <!-- Steps -->
              <p style="margin:0 0 24px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${isEs ? 'Cómo funciona' : 'How it works'}</p>

              <table cellpadding="0" cellspacing="0" width="100%">
                ${steps.map((s, i) => `
                <tr>
                  <td style="padding-bottom:${i < steps.length - 1 ? '20px' : '0'};">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width:44px;vertical-align:top;">
                          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#06b6d4);display:flex;align-items:center;justify-content:center;text-align:center;line-height:36px;">
                            <span style="color:#fff;font-size:12px;font-weight:800;">${s.n}</span>
                          </div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:0 0 4px;color:#0f172a;font-size:15px;font-weight:700;">${s.t}</p>
                          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">${s.d}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- Divider -->
              <div style="margin:32px 0;height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>

              <!-- Tip box -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:14px;padding:20px 22px;">
                    <p style="margin:0 0 6px;color:#7c3aed;font-size:13px;font-weight:700;">${tipLabel}</p>
                    <p style="margin:0;color:#4c1d95;font-size:14px;line-height:1.65;">${tipText}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-top:32px;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#7c3aed 0%,#06b6d4 100%);padding:1px;">
                    <a href="${ctaUrl}" style="display:block;background:linear-gradient(135deg,#7c3aed 0%,#0891b2 100%);border-radius:11px;padding:15px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;text-align:center;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Stats strip -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:20px 44px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  ${[
                    { v: '1', l: isEs ? 'desafío por día' : 'challenge/day' },
                    { v: '∞', l: isEs ? 'intentos' : 'attempts' },
                    { v: '100', l: isEs ? 'puntos posibles' : 'points possible' },
                  ].map(({ v, l }) => `
                  <td style="text-align:center;padding:0 8px;">
                    <p style="margin:0;color:#7c3aed;font-size:22px;font-weight:800;">${v}</p>
                    <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">${l}</p>
                  </td>`).join('')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#ffffff;padding:24px 44px 32px;">
              <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;line-height:1.6;">${footerNote}</p>
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © 2025 PrompTool ·
                <a href="https://promptool.app" style="color:#94a3b8;text-decoration:none;">promptool.app</a>
                &nbsp;·&nbsp;
                <a href="https://promptool.app/privacy.html" style="color:#94a3b8;text-decoration:none;">${isEs ? 'Privacidad' : 'Privacy'}</a>
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
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' })

  const { nombre, email, userType, lang } = req.body || {}

  if (!nombre || !email) return res.status(400).json({ error: 'Missing required fields' })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email' })

  const isEs = lang !== 'en'
  const subject = isEs
    ? `Bienvenido a PrompTool, ${nombre} — tu cuenta está lista`
    : `Welcome to PrompTool, ${nombre} — your account is ready`

  const html = buildWelcomeHtml({ nombre, email, userType: userType || 'individual', lang: isEs ? 'es' : 'en' })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PrompTool <hola@promptool.app>',
        to: [email],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[send-welcome] Resend error:', err)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[send-welcome] error:', err.message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
