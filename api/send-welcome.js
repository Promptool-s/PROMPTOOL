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

// ── Enterprise welcome email ───────────────────────────────────────────────
function buildEnterpriseHtml({ nombre, email }) {
  const features = [
    { icon: '👥', t: 'Invitá a tu equipo', d: 'Sumá integrantes desde el panel de empresa. Cada uno recibe un link de invitación y empieza a jugar de inmediato.' },
    { icon: '📊', t: 'Panel de progreso', d: 'Ves el score promedio, la evolución y los intentos de cada integrante. Sabés en tiempo real quién avanza y quién necesita más práctica.' },
    { icon: '🏆', t: 'Ranking interno', d: 'Tu equipo compite entre sí. El ranking interno muestra quién es el mejor prompter de la empresa.' },
    { icon: '🎯', t: 'Desafíos personalizados', d: 'Creá desafíos exclusivos para tu organización con imágenes propias o temáticas específicas de tu industria.' },
    { icon: '📅', t: 'Desafío diario compartido', d: 'Todo el equipo enfrenta la misma imagen cada día. Comparás el rendimiento de todos en igualdad de condiciones.' },
  ]

  const steps = [
    { n: '01', t: 'Invitá a tu equipo', d: 'Desde tu panel de empresa, ingresá los emails de los integrantes. Les llega una invitación directa a su correo.' },
    { n: '02', t: 'El equipo practica', d: 'Cada integrante juega el desafío diario. La IA evalúa sus prompts y les da feedback individual.' },
    { n: '03', t: 'Seguí el progreso', d: 'Desde tu dashboard ves quién mejoró, quién se quedó atrás y los scores promedio del equipo.' },
  ]

  const planFeatures = [
    'Hasta 50 integrantes en el equipo',
    'Desafío diario para todos',
    'Panel de progreso y analytics',
    'Ranking interno de la empresa',
    'Desafíos personalizados',
    'Invitaciones por email',
  ]

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Bienvenidos a PrompTool Enterprise</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.09);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0e0e1a 0%,#1a0f3a 50%,#160d30 100%);padding:44px 44px 40px;">
              <!-- Logo -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 18px;">
                    <span style="color:#fff;font-size:19px;font-weight:800;letter-spacing:-0.5px;">Prompt<span style="color:#a78bfa;">Tool</span></span>
                  </td>
                </tr>
              </table>

              <!-- Enterprise badge -->
              <div style="margin-bottom:16px;display:inline-block;background:rgba(124,58,237,0.3);border:1px solid rgba(167,139,250,0.5);border-radius:99px;padding:5px 16px;">
                <span style="color:#c4b5fd;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Enterprise · Prueba gratuita</span>
              </div>

              <h1 style="margin:0 0 10px;color:#ffffff;font-size:28px;font-weight:800;line-height:1.2;">
                ¡Bienvenidos a PrompTool, ${nombre}!
              </h1>
              <p style="margin:0;color:rgba(255,255,255,0.65);font-size:15px;line-height:1.65;">
                Tu empresa ya tiene acceso a todo el plan Enterprise. Esto es lo que podés hacer desde hoy.
              </p>
            </td>
          </tr>

          <!-- Plan box -->
          <tr>
            <td style="background:#7c3aed;padding:20px 44px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <p style="margin:0 0 2px;color:rgba(255,255,255,0.7);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Tu plan actual</p>
                    <p style="margin:0;color:#fff;font-size:17px;font-weight:800;">Enterprise — Prueba gratuita hasta el 20 de junio de 2026</p>
                  </td>
                  <td style="text-align:right;white-space:nowrap;padding-left:16px;">
                    <span style="background:rgba(255,255,255,0.2);border-radius:99px;padding:6px 14px;color:#fff;font-size:13px;font-weight:700;">GRATIS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 44px 32px;">

              <!-- Qué incluye tu plan -->
              <p style="margin:0 0 16px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Qué incluye tu plan</p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:14px;padding:20px 24px;">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      ${planFeatures.map((f, i) => `
                      <tr>
                        <td style="padding-bottom:${i < planFeatures.length - 1 ? '10px' : '0'};">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:20px;vertical-align:middle;">
                                <div style="width:16px;height:16px;background:#7c3aed;border-radius:50%;text-align:center;line-height:16px;font-size:10px;color:#fff;font-weight:700;">✓</div>
                              </td>
                              <td style="padding-left:10px;color:#3b0764;font-size:14px;font-weight:500;">${f}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>`).join('')}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primeros pasos -->
              <p style="margin:0 0 20px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Primeros pasos</p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                ${steps.map((s, i) => `
                <tr>
                  <td style="padding-bottom:${i < steps.length - 1 ? '20px' : '0'};">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width:44px;vertical-align:top;">
                          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#4f46e5);text-align:center;line-height:36px;">
                            <span style="color:#fff;font-size:12px;font-weight:800;">${s.n}</span>
                          </div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:0 0 3px;color:#0f172a;font-size:15px;font-weight:700;">${s.t}</p>
                          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">${s.d}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- Features detalle -->
              <p style="margin:0 0 16px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Todo lo que podés hacer</p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                ${features.map((f, i) => `
                <tr>
                  <td style="padding-bottom:${i < features.length - 1 ? '16px' : '0'};">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width:40px;vertical-align:top;font-size:22px;line-height:1;">${f.icon}</td>
                        <td style="vertical-align:top;padding-left:4px;">
                          <p style="margin:0 0 2px;color:#0f172a;font-size:14px;font-weight:700;">${f.t}</p>
                          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.55;">${f.d}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);padding:1px;">
                    <a href="https://promptool.app" style="display:block;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);border-radius:11px;padding:15px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;text-align:center;">Ir al panel de empresa →</a>
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
                    { v: '50', l: 'integrantes máx.' },
                    { v: '∞', l: 'desafíos' },
                    { v: '100%', l: 'gratis hoy' },
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
              <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;line-height:1.6;">Recibiste este mail porque registraste la empresa con ${email}.</p>
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © 2025 PrompTool ·
                <a href="https://promptool.app" style="color:#94a3b8;text-decoration:none;">promptool.app</a>
                &nbsp;·&nbsp;
                <a href="https://promptool.app/privacy.html" style="color:#94a3b8;text-decoration:none;">Privacidad</a>
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

// ── Individual welcome email ───────────────────────────────────────────────
function buildIndividualHtml({ nombre, email, lang }) {
  const isEs = lang === 'es'

  const steps = isEs
    ? [
        { n: '01', t: 'Jugá el desafío diario', d: 'Cada día hay una imagen nueva generada por IA. Tu misión: adivinar el prompt que la creó.' },
        { n: '02', t: 'Recibí feedback real', d: 'La IA compara tu prompt con el original y te da un score detallado con sugerencias concretas.' },
        { n: '03', t: 'Subí en el ranking', d: 'Cada intento suma a tu posición en el leaderboard mensual. El mejor prompter gana una badge exclusiva.' },
      ]
    : [
        { n: '01', t: 'Play the daily challenge', d: 'Every day there's a new AI-generated image. Your mission: guess the prompt that created it.' },
        { n: '02', t: 'Get real feedback', d: 'The AI compares your prompt to the original and gives you a detailed score with concrete suggestions.' },
        { n: '03', t: 'Climb the ranking', d: 'Every attempt counts toward your monthly leaderboard position. The top prompter earns an exclusive badge.' },
      ]

  const tipLabel = isEs ? '💡 Tip para arrancar' : '💡 Starter tip'
  const tipText = isEs
    ? 'Cuanto más específico seas — luz, estilo, detalles del sujeto — más alto va a ser tu score. No alcanza con describir lo obvio.'
    : 'The more specific you are — lighting, style, subject details — the higher your score. Just describing the obvious won't cut it.'

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
            <td style="background:linear-gradient(135deg,#0e0e1a 0%,#1a0f3a 50%,#160d30 100%);padding:44px 44px 36px;">
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 18px;">
                    <span style="color:#fff;font-size:19px;font-weight:800;letter-spacing:-0.5px;">Prompt<span style="color:#a78bfa;">Tool</span></span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0 0 10px;color:#ffffff;font-size:28px;font-weight:800;line-height:1.2;">
                ${isEs ? `Bienvenido, ${nombre} 👋` : `Welcome, ${nombre} 👋`}
              </h1>
              <p style="margin:0;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">
                ${isEs ? 'Tu cuenta está lista. Esto es lo que podés hacer desde hoy.' : 'Your account is ready. Here's what you can do starting today.'}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 44px 32px;">
              <p style="margin:0 0 24px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${isEs ? 'Cómo funciona' : 'How it works'}</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${steps.map((s, i) => `
                <tr>
                  <td style="padding-bottom:${i < steps.length - 1 ? '20px' : '0'};">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width:44px;vertical-align:top;">
                          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#4f46e5);text-align:center;line-height:36px;">
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

              <div style="margin:32px 0;height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>

              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:14px;padding:20px 22px;">
                    <p style="margin:0 0 6px;color:#7c3aed;font-size:13px;font-weight:700;">${tipLabel}</p>
                    <p style="margin:0;color:#4c1d95;font-size:14px;line-height:1.65;">${tipText}</p>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" style="margin-top:32px;" width="100%">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);padding:1px;">
                    <a href="https://promptool.app" style="display:block;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);border-radius:11px;padding:15px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;text-align:center;">${isEs ? 'Empezar a jugar →' : 'Start playing →'}</a>
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

  const isEnterprise = userType === 'enterprise'
  const isEs = lang !== 'en'

  const subject = isEnterprise
    ? `¡Bienvenidos a PrompTool Enterprise, ${nombre}! Tu plan está activo`
    : isEs
      ? `Bienvenido a PrompTool, ${nombre} — tu cuenta está lista`
      : `Welcome to PrompTool, ${nombre} — your account is ready`

  const html = isEnterprise
    ? buildEnterpriseHtml({ nombre, email })
    : buildIndividualHtml({ nombre, email, lang: isEs ? 'es' : 'en' })

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
      console.error('[send-welcome] Resend error:', err)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[send-welcome] error:', err.message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
