import { Router } from 'express'
import { config } from '../config/env.js'

/**
 * GET /api/auth/confirm — destino de los links en los emails de auth
 * (signup, recovery, magic link, email change) que arma emailService a partir
 * del Send Email Hook de Supabase. Redirige al endpoint verify de Supabase,
 * que valida el token y a su vez redirige a redirect_to.
 */
const router = Router()

router.get('/confirm', (req, res) => {
    const supabaseUrl = config.storage.supabaseUrl || (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
    if (!supabaseUrl) return res.status(503).json({ message: 'Auth no está configurado (falta SUPABASE_URL).' })

    const { token_hash: tokenHash, token, type } = req.query

    // Anti open-redirect: solo se permite volver a la propia app
    const base = config.email.appBaseUrl
    let redirectTo = typeof req.query.redirect_to === 'string' ? req.query.redirect_to : base
    if (!redirectTo.startsWith(base)) redirectTo = base

    const url = new URL(`${supabaseUrl}/auth/v1/verify`)
    if (typeof tokenHash === 'string' && tokenHash) {
        url.searchParams.set('token_hash', tokenHash)
    } else if (typeof token === 'string' && token) {
        url.searchParams.set('token', token)
    } else {
        return res.status(400).json({ message: 'Falta el token de verificación.' })
    }
    url.searchParams.set('type', typeof type === 'string' ? type : '')
    url.searchParams.set('redirect_to', redirectTo)

    res.redirect(302, url.toString())
})

export default router
