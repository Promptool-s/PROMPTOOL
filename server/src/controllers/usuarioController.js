import express, { Router } from 'express'
import UsuarioService from '../services/usuarioService.js'
import PreferenciaService from '../services/preferenciaService.js'
import StorageService from '../services/storageService.js'
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware.js'
import { throwError } from '../helpers/httpError.js'
import { isValidUUID } from '../helpers/validatorHelper.js'

const router = Router()
const svc = new UsuarioService()
const prefSvc = new PreferenciaService()
const storageSvc = new StorageService()

/**
 * POST /api/usuarios — crea el perfil tras el signup (idempotente).
 * El id y el email salen del JWT verificado, no del body.
 * Reemplaza el upsert/insert de perfil de useAuth.js.
 */
router.post('', authMiddleware, async (req, res) => {
    const data = await svc.crearPerfilAsync({
        idUsuario: req.usuario.id,
        email: req.usuario.email ?? null,
        body: req.body ?? {},
    })
    res.status(201).json(data)
})

/** GET /api/usuarios/me — perfil propio COMPLETO (todas las columnas, sin secretos). */
router.get('/me', authMiddleware, async (req, res) => {
    const data = await svc.getPerfilVistaAsync(req.usuario.id, req.usuario.id)
    res.status(200).json(data)
})

/**
 * PUT /api/usuarios/me — editar perfil propio.
 * Solo campos de la whitelist del Service; elo_rating, adminstate,
 * suspension_status y contadores quedan fuera del alcance del cliente.
 */
router.put('/me', authMiddleware, async (req, res) => {
    const data = await svc.updatePerfilAsync(req.usuario.id, req.body ?? {})
    res.status(200).json(data)
})

/**
 * POST /api/usuarios/me/avatar — sube el avatar y actualiza avatar_url.
 * Body: bytes crudos de la imagen (Content-Type: image/*). Reemplaza el
 * upload directo al bucket + createBucket que hacía UsuarioApp.jsx.
 */
router.post('/me/avatar', authMiddleware, express.raw({ type: 'image/*', limit: '3mb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throwError('Mandá la imagen como body binario con Content-Type image/*.', 400)
    }
    const subida = await storageSvc.subirImagenAsync(req.body, 'avatars', req.usuario.id)
    const perfil = await svc.updatePerfilAsync(req.usuario.id, { avatar_url: subida.public_url })
    res.status(200).json({ avatar_url: subida.public_url, perfil })
})

/**
 * POST /api/usuarios/me/banner — sube el banner del perfil (bucket avatars).
 * Devuelve la URL; el cliente la persiste con PUT /me. Reemplaza el upload
 * directo al bucket que hacía UsuarioApp.jsx.
 */
router.post('/me/banner', authMiddleware, express.raw({ type: 'image/*', limit: '3mb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throwError('Mandá la imagen como body binario con Content-Type image/*.', 400)
    }
    const subida = await storageSvc.subirImagenAsync(req.body, 'avatars', `${req.usuario.id}/banner`)
    res.status(200).json(subida)
})

/** POST /api/usuarios/me/showcase — sube la imagen showcase del perfil. */
router.post('/me/showcase', authMiddleware, express.raw({ type: 'image/*', limit: '3mb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throwError('Mandá la imagen como body binario con Content-Type image/*.', 400)
    }
    const subida = await storageSvc.subirImagenAsync(req.body, 'avatars', `${req.usuario.id}/showcase`)
    res.status(200).json(subida)
})

/** GET /api/usuarios/me/suspension — estado de suspensión propio (banner de UX). */
router.get('/me/suspension', authMiddleware, async (req, res) => {
    const data = await svc.getEstadoSuspensionAsync(req.usuario.id)
    res.status(200).json(data)
})

/** GET /api/usuarios/me/preferencias — preferencias de privacidad/visual. */
router.get('/me/preferencias', authMiddleware, async (req, res) => {
    const data = await prefSvc.getAsync(req.usuario.id)
    res.status(200).json(data)
})

/** PUT /api/usuarios/me/preferencias — actualizar preferencias (whitelist). */
router.put('/me/preferencias', authMiddleware, async (req, res) => {
    const data = await prefSvc.updateAsync(req.usuario.id, req.body ?? {})
    res.status(200).json(data)
})

/** GET /api/usuarios/username-disponible?u=<username> — chequeo de registro. */
router.get('/username-disponible', async (req, res) => {
    const u = typeof req.query.u === 'string' ? req.query.u : ''
    const data = await svc.usernameDisponibleAsync(u)
    res.status(200).json(data)
})

/** GET /api/usuarios/email-por-username?u=<username> — login por username. */
router.get('/email-por-username', async (req, res) => {
    const u = typeof req.query.u === 'string' ? req.query.u : ''
    const data = await svc.getEmailPorUsernameAsync(u)
    res.status(200).json(data)
})

/** GET /api/usuarios/id-por-username?u=<username> — resuelve /user/:username a id. */
router.get('/id-por-username', async (req, res) => {
    const u = typeof req.query.u === 'string' ? req.query.u : ''
    const data = await svc.getIdPorUsernameAsync(u)
    res.status(200).json(data)
})

/** GET /api/usuarios/buscar?q=<term> — búsqueda pública (comparar perfiles). */
router.get('/buscar', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    const data = await svc.buscarAsync(q)
    res.status(200).json(data)
})

/**
 * GET /api/usuarios/:id — perfil de otro usuario (o el propio).
 * Vista completa para el dueño/admin; vista pública filtrada para el resto.
 * Reemplaza el `supabase.from('usuarios').select(...)` de UsuarioApp.jsx.
 */
router.get('/:id', optionalAuthMiddleware, async (req, res) => {
    if (!isValidUUID(req.params.id)) throwError('El ID de usuario no es válido.', 400)
    const data = await svc.getPerfilVistaAsync(req.params.id, req.usuario?.id ?? null)
    res.status(200).json(data)
})

/** GET /api/usuarios/:id/miembros — roster público de una empresa. */
router.get('/:id/miembros', async (req, res) => {
    if (!isValidUUID(req.params.id)) throwError('El ID de empresa no es válido.', 400)
    const data = await svc.getMiembrosPublicosAsync(req.params.id)
    res.status(200).json(data)
})

// ── Follows — reemplaza los insert/delete directos a `follows` (UsuarioApp.jsx) ──

/** GET /api/usuarios/:id/follow — contadores + si el solicitante lo sigue. */
router.get('/:id/follow', optionalAuthMiddleware, async (req, res) => {
    if (!isValidUUID(req.params.id)) throwError('El ID de usuario no es válido.', 400)
    const data = await svc.getFollowInfoAsync(req.params.id, req.usuario?.id ?? null)
    res.status(200).json(data)
})

/** POST /api/usuarios/:id/follow — seguir (idempotente). */
router.post('/:id/follow', authMiddleware, async (req, res) => {
    if (!isValidUUID(req.params.id)) throwError('El ID de usuario no es válido.', 400)
    const data = await svc.followAsync(req.usuario.id, req.params.id)
    res.status(200).json(data)
})

/** DELETE /api/usuarios/:id/follow — dejar de seguir (idempotente). */
router.delete('/:id/follow', authMiddleware, async (req, res) => {
    if (!isValidUUID(req.params.id)) throwError('El ID de usuario no es válido.', 400)
    const data = await svc.unfollowAsync(req.usuario.id, req.params.id)
    res.status(200).json(data)
})

export default router
