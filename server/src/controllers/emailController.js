import crypto from 'crypto'
import { Router } from 'express'
import EmailService from '../services/emailService.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { emailSendLimiter, otpVerifyLimiter } from '../middlewares/rateLimiterMiddleware.js'
import { config } from '../config/env.js'
import { throwError } from '../helpers/httpError.js'

/**
 * Rutas de email. Consolida los serverless del frontend viejo:
 *   POST /api/send-otp        →  POST /api/email/otp
 *   POST /api/verify-otp      →  POST /api/email/otp/verify
 *   POST /api/send-welcome    →  POST /api/email/welcome    (requiere sesión)
 *   POST /api/send-invite     →  POST /api/email/invite     (requiere sesión)
 *   POST /api/send-auth-email →  POST /api/email/auth-hook  (Auth Hook Supabase)
 *
 * OTP va sin auth (es previo a tener cuenta) pero con rate limit por IP.
 */
const router = Router()
const svc = new EmailService()

/** POST /api/email/otp — genera y envía un código OTP. Público + rate limit. */
router.post('/otp', emailSendLimiter, async (req, res) => {
    const { email, lang } = req.body ?? {}
    const data = await svc.sendOtpAsync({ email, lang })
    res.status(200).json(data)
})

/** POST /api/email/otp/verify — verifica el código OTP. Público + rate limit. */
router.post('/otp/verify', otpVerifyLimiter, async (req, res) => {
    const { token, code, email } = req.body ?? {}
    const data = svc.verifyOtp({ token, code, email })
    res.status(200).json(data)
})

/** POST /api/email/welcome — email de bienvenida. Requiere sesión. */
router.post('/welcome', authMiddleware, async (req, res) => {
    const { nombre, email, userType, lang } = req.body ?? {}
    const data = await svc.sendWelcomeAsync({ nombre, email, userType, lang })
    res.status(200).json(data)
})

/** POST /api/email/invite — invitación de equipo. Requiere sesión (admin empresa). */
router.post('/invite', authMiddleware, async (req, res) => {
    const { recipientEmail, companyName, inviterName, joinUrl, isExistingUser } = req.body ?? {}
    const data = await svc.sendInviteAsync({ recipientEmail, companyName, inviterName, joinUrl, isExistingUser })
    res.status(200).json(data)
})

const timingSafeEqualStr = (a, b) => {
    const bufA = Buffer.from(String(a))
    const bufB = Buffer.from(String(b))
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verifica la firma del Auth Hook de Supabase según la Standard Webhooks Spec
 * (https://www.standardwebhooks.com/). Supabase manda tres headers —
 * `webhook-id`, `webhook-timestamp`, `webhook-signature` — y firma
 * `${id}.${timestamp}.${body}` con HMAC-SHA256 usando el secreto
 * `v1,whsec_<base64>`. La firma se compara sobre los BYTES CRUDOS del body
 * (req.rawBody), no sobre el JSON re-serializado.
 */
function verifyStandardWebhook(req, secret) {
    const id = req.headers['webhook-id']
    const timestamp = req.headers['webhook-timestamp']
    const sigHeader = req.headers['webhook-signature']
    const rawBody = req.rawBody
    if (!id || !timestamp || !sigHeader || !rawBody) return false

    // Anti-replay: la firma sólo es válida dentro de una ventana de 5 minutos.
    const ts = Number.parseInt(timestamp, 10)
    if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false

    // El secreto es "v1,whsec_<base64>"; la clave HMAC son esos bytes base64 decodificados.
    const b64Secret = String(secret).replace(/^v1,/, '').replace(/^whsec_/, '')
    const key = Buffer.from(b64Secret, 'base64')
    const signed = Buffer.concat([Buffer.from(`${id}.${timestamp}.`), rawBody])
    const expected = crypto.createHmac('sha256', key).update(signed).digest('base64')

    // El header es una lista separada por espacios de "v1,<firma-base64>".
    return String(sigHeader)
        .split(' ')
        .some((part) => {
            const sig = part.includes(',') ? part.split(',')[1] : part
            return sig && timingSafeEqualStr(sig, expected)
        })
}

/**
 * Handler del Auth Hook de Supabase (Send Email Hook). Se exporta aparte para
 * poder montarlo tanto en POST /api/email/auth-hook (endpoint nuevo) como en el
 * alias retrocompatible POST /api/send-auth-email (la URL vieja del hook, que
 * antes resolvía un serverless de Resend ya retirado — ver app.js).
 *
 * No pasa por authMiddleware (lo llama Supabase, no un usuario). Se autoriza con
 * SUPABASE_AUTH_HOOK_SECRET, aceptando dos esquemas:
 *   1. Firma Standard Webhooks (lo que manda Supabase en producción).
 *   2. Authorization: Bearer <secret> (compat: pruebas manuales / setups propios).
 * Si el secreto no está configurado, no se verifica (dev / hook sin secreto).
 */
export async function authHookHandler(req, res) {
    const secret = config.email.authHookSecret
    if (secret) {
        const header = req.headers.authorization || ''
        const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
        const authorized = verifyStandardWebhook(req, secret) || (bearer && timingSafeEqualStr(bearer, secret))
        if (!authorized) throwError('No autorizado.', 401)
    }
    const { user, email_data } = req.body ?? {}
    const data = await svc.sendAuthEmailAsync({ user, email_data })
    res.status(200).json(data)
}

/** POST /api/email/auth-hook — invocado por el Auth Hook de Supabase. */
router.post('/auth-hook', authHookHandler)

export default router
