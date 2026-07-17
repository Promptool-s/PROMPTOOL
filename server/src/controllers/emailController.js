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

/**
 * POST /api/email/auth-hook — invocado por el Auth Hook de Supabase.
 * No pasa por authMiddleware (lo llama Supabase, no un usuario): se protege con
 * el secreto compartido SUPABASE_AUTH_HOOK_SECRET en el header Authorization.
 */
router.post('/auth-hook', async (req, res) => {
    const secret = config.email.authHookSecret
    if (secret) {
        const header = req.headers.authorization || ''
        const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
        if (provided !== secret) throwError('No autorizado.', 401)
    }
    const { user, email_data } = req.body ?? {}
    const data = await svc.sendAuthEmailAsync({ user, email_data })
    res.status(200).json(data)
})

export default router
