import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { config, getMissingEnv } from './config/env.js'
import { generalLimiter } from './middlewares/rateLimiterMiddleware.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import intentoController from './controllers/intentoController.js'
import usuarioController from './controllers/usuarioController.js'
import imagenController from './controllers/imagenController.js'
import leaderboardController from './controllers/leaderboardController.js'
import adminController from './controllers/adminController.js'
import ticketController from './controllers/ticketController.js'
import reporteController from './controllers/reporteController.js'
import emailController, { authHookHandler } from './controllers/emailController.js'
import notificacionController from './controllers/notificacionController.js'
import enterpriseController from './controllers/enterpriseController.js'
import cronController from './controllers/cronController.js'
import imgProxyController from './controllers/imgProxyController.js'
import authController from './controllers/authController.js'
import torneoController from './controllers/torneoController.js'

// En serverless no corre server.js (que valida y aborta): check suave al cold
// start para que el problema quede visible en los logs sin tirar la función.
const missingEnv = getMissingEnv()
if (missingEnv.length > 0) {
    console.error(`[env] Faltan variables de entorno requeridas: ${missingEnv.join(', ')}`)
}

/**
 * Bootstrap de Express: middlewares globales + montaje de rutas.
 * Orden: seguridad → parsers → rate limit → rutas → 404 → errorHandler.
 */
const app = express()

// Si corre detrás de un proxy (Vercel/Railway/Render), habilita IP real para rate limit
app.set('trust proxy', 1)

app.use(helmet())
// Se usa la forma con `req` para poder detectar same-origin: en Vercel el front
// y la API se sirven desde el mismo dominio (p.ej. promptool.vercel.app), y ese
// origin no siempre está en la allowlist por env (VERCEL_PROJECT_PRODUCTION_URL
// puede no estar expuesto, y el alias de producción no matchea con VERCEL_URL).
app.use(cors((req, callback) => {
    const origin = req.header('Origin')
    let originHost = null
    try { originHost = origin ? new URL(origin).host : null } catch { /* origin inválido */ }
    // Permitir: requests sin Origin (curl, health checks, server-to-server),
    // same-origin (mismo host que la request) o los orígenes de la allowlist.
    const isAllowed =
        !origin ||
        (originHost && originHost === req.headers.host) ||
        config.corsOrigins.includes(origin)
    // Si no está permitido se responde sin headers CORS (el navegador bloquea del
    // lado del cliente) en vez de lanzar un Error, que se convertía en un 500.
    callback(null, { origin: isAllowed, credentials: false })
}))
// Se guarda el body crudo (req.rawBody) además de parsearlo: la verificación de
// firma del Auth Hook de Supabase (Standard Webhooks, en emailController) necesita
// los bytes exactos recibidos, no el JSON re-serializado.
app.use(express.json({
    limit: '25kb',
    verify: (req, _res, buf) => { req.rawBody = buf },
}))

// El proxy de imágenes va ANTES del rate limit general: es tráfico de <img>
// de alto volumen y ya tiene sus propias protecciones (allowlist + SSRF).
app.use('/api/img-proxy', imgProxyController)

app.use(generalLimiter)

// ── Rutas ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }))

app.use('/api/intentos', intentoController)
app.use('/api/usuarios', usuarioController)
app.use('/api/imagenes', imagenController)
app.use('/api/leaderboard', leaderboardController)
app.use('/api/admin', adminController)
app.use('/api/tickets', ticketController)
app.use('/api/reportes', reporteController)
app.use('/api/email', emailController)
// Alias retrocompatible del Auth Hook de Supabase: la config vieja del hook
// apuntaba a /api/send-auth-email (un serverless de Resend, ya retirado). Se
// mapea al mismo handler que /api/email/auth-hook (Mailtrap) para que los mails
// de auth (signup, recovery, magic link, email change) funcionen igual aunque
// el hook todavía no se haya repuntado al endpoint nuevo.
app.post('/api/send-auth-email', authHookHandler)
app.use('/api/notificaciones', notificacionController)
app.use('/api/enterprise', enterpriseController)
app.use('/api/cron', cronController)
app.use('/api/auth', authController)
app.use('/api/torneos', torneoController)

// ── Cierre ───────────────────────────────────────────────────────────────────
app.use(notFoundHandler)
app.use(errorHandler)

export default app
