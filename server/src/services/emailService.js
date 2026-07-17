import crypto from 'crypto'
import { config } from '../config/env.js'
import { throwError } from '../helpers/httpError.js'
import { isValidEmail } from '../helpers/validatorHelper.js'

/**
 * emailService — ÚNICO punto de todo lo relacionado con emails.
 *
 * Consolida los 5 serverless functions del frontend viejo
 * (send-otp, verify-otp, send-welcome, send-invite, send-auth-email) en un
 * solo Service de la arquitectura en capas.
 *
 * Diferencias con el original:
 *  - Se envía por Mailtrap (dominio registrado ahí) en vez de Resend, vía su
 *    API HTTP transaccional (fetch nativo, sin dependencia npm).
 *  - CORS y rate limit ya no viven acá: los resuelven los middlewares globales
 *    y el emailController.
 *  - Los errores de negocio se lanzan con throwError y los captura el
 *    errorHandler global.
 *
 * Envío "fire-and-forget": el Controller decide si esperar el envío. Cuando un
 * email no debe frenar la operación de negocio, llamar sin await y encadenar
 * `.catch(err => console.error(...))` (patrón de la guía de arquitectura).
 */

// ── Plantillas HTML (funciones puras) ────────────────────────────────────────

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

function buildOtpHtml({ code, isEs }) {
    const heading = isEs ? 'Tu código de verificación' : 'Your verification code'
    const body = isEs
        ? 'Ingresá este código para completar tu registro. Válido por 10 minutos.'
        : 'Enter this code to complete your registration. Valid for 10 minutes.'
    const footer = isEs
        ? 'Si no solicitaste este código, ignorá este mensaje.'
        : "If you didn't request this code, ignore this message."

    return `<!DOCTYPE html>
<html lang="${isEs ? 'es' : 'en'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;border-radius:16px;overflow:hidden;background:#ffffff;box-shadow:0 1px 8px rgba(0,0,0,0.08);">

          <tr>
            <td style="background:#0f172a;padding:32px 40px 28px;">
              <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Prompt<span style="color:#a78bfa;">Tool</span></span>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${heading}</p>
              <p style="margin:0 0 28px;color:#0f172a;font-size:14px;line-height:1.6;">${body}</p>

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

          <tr>
            <td style="border-top:1px solid #f1f5f9;padding:20px 40px;">
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                &copy; 2026 PrompTool &middot;
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

function buildInviteHtml({ companyName, inviterName, joinUrl, isExistingUser }) {
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

          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);padding:40px 40px 32px;">
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

          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.65;">${body}</p>

              ${!isExistingUser ? `
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

          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#e2e8f0;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                Recibiste este correo porque <strong>${companyName}</strong> te invitó a PrompTool.<br/>
                Si no esperabas esta invitación, podés ignorar este mensaje.
              </p>
              <p style="margin:12px 0 0;color:#cbd5e1;font-size:11px;">
                © 2026 PrompTool · <a href="https://promptool.app" style="color:#94a3b8;text-decoration:none;">promptool.app</a>
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

function buildEnterpriseWelcomeHtml({ nombre, email }) {
    const features = [
        { t: 'Invitá a tu equipo', d: 'Sumá integrantes desde el panel de empresa. Cada uno recibe un link de invitación y empieza a jugar de inmediato.' },
        { t: 'Panel de progreso', d: 'Ves el score promedio, la evolución y los intentos de cada integrante. Sabés en tiempo real quién avanza y quién necesita más práctica.' },
        { t: 'Ranking interno', d: 'Tu equipo compite entre sí. El ranking interno muestra quién es el mejor prompter de la empresa.' },
        { t: 'Desafíos personalizados', d: 'Creá desafíos exclusivos para tu organización con imágenes propias o temáticas específicas de tu industria.' },
        { t: 'Desafío diario compartido', d: 'Todo el equipo enfrenta la misma imagen cada día. Comparás el rendimiento de todos en igualdad de condiciones.' },
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
        <table width="100%" style="max-width:600px;border-radius:16px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08);">

          <tr>
            <td style="background:#0f172a;padding:40px 44px 36px;">
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td>
                    <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Prompt<span style="color:#a78bfa;">Tool</span></span>
                  </td>
                </tr>
              </table>

              <div style="margin-bottom:16px;display:inline-block;background:#1e1b4b;border:1px solid #4338ca;border-radius:99px;padding:5px 16px;">
                <span style="color:#a5b4fc;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Enterprise · Prueba gratuita</span>
              </div>

              <h1 style="margin:0 0 10px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;">
                Bienvenidos a PrompTool, ${nombre}
              </h1>
              <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.65;">
                Tu empresa ya tiene acceso a todo el plan Enterprise. Esto es lo que podés hacer desde hoy.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#4c1d95;padding:18px 44px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <p style="margin:0 0 2px;color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Tu plan actual</p>
                    <p style="margin:0;color:#fff;font-size:16px;font-weight:800;">Enterprise — Prueba gratuita</p>
                  </td>
                  <td style="text-align:right;white-space:nowrap;padding-left:16px;">
                    <span style="background:rgba(255,255,255,0.15);border-radius:99px;padding:6px 14px;color:#fff;font-size:13px;font-weight:700;">GRATIS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;padding:40px 44px 32px;">

              <p style="margin:0 0 16px;color:#0f172a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Qué incluye tu plan</p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:12px;padding:20px 24px;">
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

              <p style="margin:0 0 20px;color:#0f172a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Primeros pasos</p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                ${steps.map((s, i) => `
                <tr>
                  <td style="padding-bottom:${i < steps.length - 1 ? '20px' : '0'};">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width:44px;vertical-align:top;">
                          <div style="width:36px;height:36px;border-radius:10px;background:#7c3aed;text-align:center;line-height:36px;">
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

              <p style="margin:0 0 16px;color:#0f172a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Todo lo que podés hacer</p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                ${features.map((f, i) => `
                <tr>
                  <td style="padding-bottom:${i < features.length - 1 ? '16px' : '0'};">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width:32px;vertical-align:top;">
                          <div style="width:24px;height:24px;background:#ede9fe;border-radius:6px;text-align:center;line-height:24px;">
                            <span style="color:#7c3aed;font-size:11px;font-weight:800;">${i + 1}</span>
                          </div>
                        </td>
                        <td style="vertical-align:top;padding-left:8px;">
                          <p style="margin:0 0 2px;color:#0f172a;font-size:14px;font-weight:700;">${f.t}</p>
                          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.55;">${f.d}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-radius:10px;background:#7c3aed;">
                    <a href="https://promptool.app" style="display:block;border-radius:10px;padding:14px 36px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;text-align:center;">Ir al panel de empresa</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

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

          <tr>
            <td style="background:#ffffff;padding:24px 44px 32px;">
              <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;line-height:1.6;">Recibiste este mail porque registraste la empresa con ${email}.</p>
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                &copy; 2026 PrompTool &middot;
                <a href="https://promptool.app" style="color:#94a3b8;text-decoration:none;">promptool.app</a>
                &nbsp;&middot;&nbsp;
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

function buildIndividualWelcomeHtml({ nombre, email, isEs }) {
    const steps = isEs
        ? [
              { n: '01', t: 'Jugá el desafío diario', d: 'Cada día hay una imagen nueva generada por IA. Tu misión: adivinar el prompt que la creó.' },
              { n: '02', t: 'Recibí feedback real', d: 'La IA compara tu prompt con el original y te da un score detallado con sugerencias concretas.' },
              { n: '03', t: 'Subí en el ranking', d: 'Cada intento suma a tu posición en el leaderboard mensual. El mejor prompter gana una badge exclusiva.' },
          ]
        : [
              { n: '01', t: 'Play the daily challenge', d: "Every day there's a new AI-generated image. Your mission: guess the prompt that created it." },
              { n: '02', t: 'Get real feedback', d: 'The AI compares your prompt to the original and gives you a detailed score with concrete suggestions.' },
              { n: '03', t: 'Climb the ranking', d: 'Every attempt counts toward your monthly leaderboard position. The top prompter earns an exclusive badge.' },
          ]

    const tipLabel = isEs ? 'Tip para arrancar' : 'Starter tip'
    const tipText = isEs
        ? 'Cuanto más específico seas — luz, estilo, detalles del sujeto — más alto va a ser tu score. No alcanza con describir lo obvio.'
        : "The more specific you are — lighting, style, subject details — the higher your score. Just describing the obvious won't cut it."

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
        <table width="100%" style="max-width:580px;border-radius:16px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08);">

          <tr>
            <td style="background:#0f172a;padding:40px 44px 36px;">
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td>
                    <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Prompt<span style="color:#a78bfa;">Tool</span></span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0 0 10px;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;">
                ${isEs ? `Bienvenido, ${nombre}` : `Welcome, ${nombre}`}
              </h1>
              <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                ${isEs ? 'Tu cuenta está lista. Esto es lo que podés hacer desde hoy.' : "Your account is ready. Here's what you can do starting today."}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;padding:40px 44px 32px;">
              <p style="margin:0 0 24px;color:#0f172a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${isEs ? 'Cómo funciona' : 'How it works'}</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${steps.map((s, i) => `
                <tr>
                  <td style="padding-bottom:${i < steps.length - 1 ? '20px' : '0'};">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width:44px;vertical-align:top;">
                          <div style="width:36px;height:36px;border-radius:10px;background:#7c3aed;text-align:center;line-height:36px;">
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

              <div style="margin:32px 0;height:1px;background:#e2e8f0;"></div>

              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:12px;padding:20px 22px;">
                    <p style="margin:0 0 6px;color:#7c3aed;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${tipLabel}</p>
                    <p style="margin:0;color:#4c1d95;font-size:14px;line-height:1.65;">${tipText}</p>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" style="margin-top:32px;" width="100%">
                <tr>
                  <td style="border-radius:10px;background:#7c3aed;">
                    <a href="https://promptool.app" style="display:block;border-radius:10px;padding:14px 36px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;text-align:center;">${isEs ? 'Empezar a jugar' : 'Start playing'}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

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

          <tr>
            <td style="background:#ffffff;padding:24px 44px 32px;">
              <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;line-height:1.6;">${footerNote}</p>
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                &copy; 2026 PrompTool &middot;
                <a href="https://promptool.app" style="color:#94a3b8;text-decoration:none;">promptool.app</a>
                &nbsp;&middot;&nbsp;
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

// ── Sanitización mínima de campos de texto que van al HTML ───────────────────
const sanitizeText = (value, max = 100) => String(value ?? '').slice(0, max).replace(/[<>"']/g, '')

// ── Service ──────────────────────────────────────────────────────────────────

export default class EmailService {
    constructor() {
        this.cfg = config.email
    }

    /**
     * Envío base contra la API HTTP transaccional de Mailtrap.
     * Lanza error de infraestructura (502) si Mailtrap responde mal, para que
     * el errorHandler global lo convierta en 500 o el caller lo capture en un
     * envío fire-and-forget.
     */
    _sendAsync = async ({ to, subject, html, category }) => {
        if (!this.cfg.mailtrapToken) throwError('El servicio de email no está configurado.', 500)

        const response = await fetch(this.cfg.mailtrapApiUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.cfg.mailtrapToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: { email: this.cfg.fromEmail, name: this.cfg.fromName },
                to: [{ email: to }],
                subject,
                html,
                category,
            }),
        })

        if (!response.ok) {
            const detail = await response.json().catch(() => ({}))
            console.error('[emailService] Mailtrap error:', response.status, detail)
            throwError('No se pudo enviar el email.', 502)
        }
        return true
    }

    // ── OTP (reemplaza send-otp / verify-otp) ────────────────────────────────

    _generateCode = () => String(crypto.randomInt(100000, 1000000))

    _signPayload = (payload) => crypto.createHmac('sha256', this.cfg.otpSecret).update(payload).digest('hex')

    /**
     * Genera un OTP de 6 dígitos, lo manda por email y devuelve un token
     * firmado (stateless, HMAC) que el cliente reenvía a verifyOtp. El código
     * nunca se guarda en BD: viaja firmado dentro del token.
     */
    sendOtpAsync = async ({ email, lang }) => {
        if (!isValidEmail(email)) throwError('Email inválido.', 400)
        if (!this.cfg.otpSecret) throwError('El servicio de OTP no está configurado.', 500)

        const code = this._generateCode()
        const exp = Date.now() + 10 * 60 * 1000 // 10 minutos
        const payload = JSON.stringify({ email: email.toLowerCase(), code, exp })
        const token = Buffer.from(payload).toString('base64url') + '.' + this._signPayload(payload)

        const isEs = lang !== 'en'
        await this._sendAsync({
            to: email,
            subject: isEs ? `Tu código de verificación: ${code}` : `Your verification code: ${code}`,
            html: buildOtpHtml({ code, isEs }),
            category: 'otp',
        })
        return { token }
    }

    /**
     * Verifica el par (token firmado, código) contra el email. Devuelve
     * { verified: true } o lanza el error de negocio correspondiente.
     */
    verifyOtp = ({ token, code, email }) => {
        if (!token || !code || !email) throwError('Faltan datos.', 400)
        if (!this.cfg.otpSecret) throwError('El servicio de OTP no está configurado.', 500)

        const [payloadB64, sig] = String(token).split('.')
        if (!payloadB64 || !sig) throwError('Token con formato inválido.', 400)

        let payloadStr
        try {
            payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8')
        } catch {
            throwError('Token inválido.', 400)
        }

        const expectedSig = this._signPayload(payloadStr)
        const sigBuf = Buffer.from(sig, 'hex')
        const expBuf = Buffer.from(expectedSig, 'hex')
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            throwError('Token inválido.', 400)
        }

        let payload
        try {
            payload = JSON.parse(payloadStr)
        } catch {
            throwError('Token inválido.', 400)
        }

        if (Date.now() > payload.exp) throwError('El código expiró.', 400)
        if (payload.email !== email.toLowerCase()) throwError('El email no coincide.', 400)
        if (payload.code !== String(code).trim()) throwError('Código incorrecto.', 400)

        return { verified: true }
    }

    // ── Bienvenida (reemplaza send-welcome) ──────────────────────────────────

    sendWelcomeAsync = async ({ nombre, email, userType, lang }) => {
        if (!isValidEmail(email)) throwError('Email inválido.', 400)
        if (!nombre) throwError('Falta el nombre.', 400)

        const isEnterprise = userType === 'enterprise'
        const isEs = lang !== 'en'
        const safeNombre = sanitizeText(nombre, 100)

        const subject = isEnterprise
            ? `Bienvenidos a PrompTool Enterprise, ${safeNombre}`
            : isEs
              ? `Bienvenido a PrompTool, ${safeNombre} — tu cuenta está lista`
              : `Welcome to PrompTool, ${safeNombre} — your account is ready`

        const html = isEnterprise
            ? buildEnterpriseWelcomeHtml({ nombre: safeNombre, email })
            : buildIndividualWelcomeHtml({ nombre: safeNombre, email, isEs })

        await this._sendAsync({ to: email, subject, html, category: 'welcome' })
        return { ok: true }
    }

    // ── Invitación de equipo (reemplaza send-invite) ─────────────────────────

    sendInviteAsync = async ({ recipientEmail, companyName, inviterName, joinUrl, isExistingUser }) => {
        if (!recipientEmail || !companyName || !joinUrl) throwError('Faltan campos requeridos.', 400)
        if (!isValidEmail(recipientEmail)) throwError('Email inválido.', 400)

        // Anti open-redirect / phishing: joinUrl debe apuntar a un origen propio.
        const allowedOrigins = config.corsOrigins
        const joinUrlValid = allowedOrigins.some((base) => joinUrl.startsWith(base + '/'))
        if (!joinUrlValid) throwError('La URL de invitación no es válida.', 400)

        const safeCompany = sanitizeText(companyName, 100)
        const safeInviter = sanitizeText(inviterName, 100)

        const subject = isExistingUser
            ? `${safeCompany} te invita a unirte a su equipo en PrompTool`
            : `Tenés una invitación para PrompTool de parte de ${safeCompany}`

        await this._sendAsync({
            to: recipientEmail,
            subject,
            html: buildInviteHtml({ companyName: safeCompany, inviterName: safeInviter, joinUrl, isExistingUser }),
            category: 'invite',
        })
        return { ok: true }
    }

    // ── Auth Hook de Supabase (reemplaza send-auth-email) ────────────────────

    /**
     * Recibe el payload del Auth Hook de Supabase y manda el email de la acción
     * correspondiente (signup, recovery, magiclink, email_change).
     */
    sendAuthEmailAsync = async ({ user, email_data }) => {
        const email = user?.email || ''
        const nombre = user?.user_metadata?.nombre || user?.user_metadata?.full_name || ''
        const actionType = email_data?.email_action_type || ''
        const token = email_data?.token || ''
        const tokenHash = email_data?.token_hash || ''
        const redirectTo = email_data?.redirect_to || this.cfg.appBaseUrl

        if (!email || !actionType) throwError('Faltan campos requeridos.', 400)

        const baseUrl = this.cfg.appBaseUrl
        const actionUrl = tokenHash
            ? `${baseUrl}/api/auth/confirm?token_hash=${tokenHash}&type=${actionType}&redirect_to=${encodeURIComponent(redirectTo)}`
            : `${baseUrl}/api/auth/confirm?token=${token}&type=${actionType}&redirect_to=${encodeURIComponent(redirectTo)}`

        let subject, html
        switch (actionType) {
            case 'signup':
            case 'email_confirmation':
                subject = 'Confirmá tu cuenta en PrompTool'
                html = buildConfirmEmail({ nombre, confirmUrl: actionUrl, email })
                break
            case 'recovery':
                subject = 'Restablecer contraseña — PrompTool'
                html = buildResetEmail({ nombre, resetUrl: actionUrl, email })
                break
            case 'magiclink':
                subject = 'Tu link de acceso a PrompTool'
                html = buildMagicLinkEmail({ nombre, magicUrl: actionUrl, email })
                break
            case 'email_change':
                subject = 'Confirmá tu nuevo email en PrompTool'
                html = buildEmailChangeEmail({ nombre, confirmUrl: actionUrl, email, newEmail: email_data?.new_email })
                break
            default:
                subject = 'Acción requerida en PrompTool'
                html = buildConfirmEmail({ nombre, confirmUrl: actionUrl, email })
        }

        await this._sendAsync({ to: email, subject, html, category: `auth-${actionType}` })
        return { ok: true }
    }
}
