// Smoke test de envío REAL vía Mailtrap, usando el MISMO código que producción
// (server/src/services/emailService.js → API HTTP transaccional de Mailtrap).
//
// Uso (desde la raíz del repo):
//   npm run test-email -- tu-email@ejemplo.com
//   node server/scripts/test-mailtrap.mjs tu-email@ejemplo.com
//
// Lee las credenciales de .env en la raíz del repo (MAILTRAP_API_TOKEN,
// MAILTRAP_API_URL, MAIL_FROM_*, OTP_SECRET). Envía un OTP de prueba al
// destinatario indicado. NO afecta el build de Vercel: es tooling inerte, no lo
// importa la app.

import 'dotenv/config'
import { config } from '../src/config/env.js'
import EmailService from '../src/services/emailService.js'

const to = process.argv[2] || process.env.TEST_TO
const token = config.email.mailtrapToken

const fail = (msg) => {
    console.error(`\n❌ ${msg}\n`)
    process.exit(1)
}

if (!token || token.startsWith('PEGA_TU_TOKEN')) {
    fail('Falta MAILTRAP_API_TOKEN en .env.\n   Abrí el .env de la raíz del repo y pegá el token real de Mailtrap.')
}
if (!to) {
    fail('Indicá el destinatario:\n   npm run test-email -- vos@tu-email.com')
}

console.log('→ Endpoint :', config.email.mailtrapApiUrl)
console.log('→ From     :', `${config.email.fromName} <${config.email.fromEmail}>`)
console.log('→ To       :', to)
console.log('→ Enviando OTP de prueba...\n')

try {
    const { token: otpToken } = await new EmailService().sendOtpAsync({ email: to, lang: 'es' })
    console.log('✅ Mailtrap aceptó el envío. Revisá la bandeja de', to)
    console.log('   (token OTP firmado:', otpToken.slice(0, 24) + '...)')
} catch (err) {
    console.error('❌ Falló el envío.')
    console.error('   status :', err.statusCode ?? '(infraestructura)')
    console.error('   message:', err.message)
    console.error('\n   Si arriba ves "[emailService] Mailtrap error:", ese es el detalle exacto')
    console.error('   de Mailtrap (dominio no verificado, from no permitido, token sin permiso, etc.).')
    process.exit(1)
}
