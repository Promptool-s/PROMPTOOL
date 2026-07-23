import express, { Router } from 'express'
import EnterpriseService from '../services/enterpriseService.js'
import EnterpriseChatService from '../services/enterpriseChatService.js'
import ChallengeGeneratorService from '../services/challengeGeneratorService.js'
import StorageService from '../services/storageService.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { evaluationLimiter } from '../middlewares/rateLimiterMiddleware.js'
import { throwError } from '../helpers/httpError.js'
import { isValidPk } from '../helpers/validatorHelper.js'

/**
 * Namespace /api/enterprise — migra el bloque de EnterprisePanel.jsx,
 * CompanyPanel.jsx, EnterpriseOnboarding.jsx y EnterpriseGuideContent.jsx.
 * La verificación de "es empresa" se hace en el Service contra la BD
 * (user_type), nunca contra user_metadata.
 */
const router = Router()
const svc = new EnterpriseService()
const chatSvc = new EnterpriseChatService()
const genSvc = new ChallengeGeneratorService()
const storageSvc = new StorageService()

router.use(authMiddleware)

// ── Equipo y roles ───────────────────────────────────────────────────────────

/** GET /api/enterprise/equipo — miembros con métricas (panel). */
router.get('/equipo', async (req, res) => {
    const data = await svc.getMiembrosAsync(req.usuario)
    res.status(200).json(data)
})

/** PATCH /api/enterprise/equipo/:userId/rol — asignar rol (RPC assign_company_role). */
router.patch('/equipo/:userId/rol', async (req, res) => {
    const data = await svc.asignarRolAsync(req.usuario, req.params.userId, req.body?.rol ?? '')
    res.status(200).json(data)
})

/** PATCH /api/enterprise/equipo/:userId/nombre — display name interno (RPC). */
router.patch('/equipo/:userId/nombre', async (req, res) => {
    const data = await svc.setDisplayNameAsync(req.usuario, req.params.userId, req.body?.nombre)
    res.status(200).json(data)
})

/** DELETE /api/enterprise/equipo/:userId — remover miembro (RPC remove_team_member). */
router.delete('/equipo/:userId', async (req, res) => {
    const data = await svc.removerMiembroAsync(req.usuario, req.params.userId)
    res.status(200).json(data)
})

/** GET /api/enterprise/roles — roles personalizados. */
router.get('/roles', async (req, res) => {
    const data = await svc.getRolesAsync(req.usuario)
    res.status(200).json(data)
})

/** POST /api/enterprise/roles — crear rol (RPC create_custom_role). */
router.post('/roles', async (req, res) => {
    const { nombre, descripcion, color } = req.body ?? {}
    const data = await svc.crearRolAsync(req.usuario, { nombre, descripcion, color })
    res.status(201).json(data)
})

/** DELETE /api/enterprise/roles/:nombre — eliminar rol (RPC delete_custom_role). */
router.delete('/roles/:nombre', async (req, res) => {
    const data = await svc.eliminarRolAsync(req.usuario, req.params.nombre)
    res.status(200).json(data)
})

// ── Settings del panel (fila propia de la empresa) ──────────────────────────

/** GET /api/enterprise/settings — fila completa de settings de la empresa. */
router.get('/settings', async (req, res) => {
    const data = await svc.getSettingsAsync(req.usuario)
    res.status(200).json(data)
})

/** PUT /api/enterprise/settings — guardar settings (whitelist estricta). */
router.put('/settings', async (req, res) => {
    const data = await svc.updateSettingsAsync(req.usuario, req.body ?? {})
    res.status(200).json(data)
})

// ── Config del panel (JSONB de la propia fila) ──────────────────────────────

/** GET /api/enterprise/config — training_config / dashboard_filters / performance_metrics. */
router.get('/config', async (req, res) => {
    const data = await svc.getConfigAsync(req.usuario)
    res.status(200).json(data)
})

/** PUT /api/enterprise/config — update con whitelist de columnas JSONB. */
router.put('/config', async (req, res) => {
    const data = await svc.updateConfigAsync(req.usuario, req.body ?? {})
    res.status(200).json(data)
})

// ── Membresía (lado usuario) ────────────────────────────────────────────────

/** POST /api/enterprise/unirse — unirse por link (?join=companyId). */
router.post('/unirse', async (req, res) => {
    const data = await svc.unirsePorLinkAsync(req.usuario, req.body?.company_id)
    res.status(200).json(data)
})

/** POST /api/enterprise/salir — salir de la empresa actual. */
router.post('/salir', async (req, res) => {
    const data = await svc.salirAsync(req.usuario)
    res.status(200).json(data)
})

// ── Invitaciones ─────────────────────────────────────────────────────────────

/** GET /api/enterprise/invitaciones — bandeja de la empresa. */
router.get('/invitaciones', async (req, res) => {
    const data = await svc.getInvitacionesAsync(req.usuario)
    res.status(200).json(data)
})

/** POST /api/enterprise/invitaciones — la empresa invita por email (+ email fire-and-forget). */
router.post('/invitaciones', async (req, res) => {
    const { email, mensaje } = req.body ?? {}
    const data = await svc.invitarAsync(req.usuario, { email, mensaje })
    res.status(201).json(data)
})

/** POST /api/enterprise/invitaciones/solicitud — un usuario pide unirse a una empresa. */
router.post('/invitaciones/solicitud', async (req, res) => {
    const { company_id, mensaje } = req.body ?? {}
    const data = await svc.solicitarUnirseAsync(req.usuario, { companyId: company_id, mensaje })
    res.status(201).json(data)
})

/** POST /api/enterprise/invitaciones/:id/aceptar — la RPC correcta se elige server-side. */
router.post('/invitaciones/:id/aceptar', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de invitación no es válido.', 400)
    const data = await svc.aceptarInvitacionAsync(req.usuario, req.params.id)
    res.status(200).json(data)
})

/** PATCH /api/enterprise/invitaciones/:id — rechazar/cancelar. */
router.patch('/invitaciones/:id', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de invitación no es válido.', 400)
    const data = await svc.rechazarInvitacionAsync(req.usuario, req.params.id, req.body?.status ?? 'rejected')
    res.status(200).json(data)
})

/** DELETE /api/enterprise/invitaciones/:id — borrar de la bandeja (solo empresa). */
router.delete('/invitaciones/:id', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de invitación no es válido.', 400)
    const data = await svc.eliminarInvitacionAsync(req.usuario, req.params.id)
    res.status(200).json(data)
})

// ── Guías ────────────────────────────────────────────────────────────────────

/** GET /api/enterprise/guias — guías propias de la empresa (enterprise_guides). */
router.get('/guias', async (req, res) => {
    const data = await svc.getGuiasAsync(req.usuario)
    res.status(200).json(data)
})

/** POST /api/enterprise/guias — crear guía (RPC create_enterprise_guide). */
router.post('/guias', async (req, res) => {
    const { titulo, resumen, contenido, accent, keywords } = req.body ?? {}
    const data = await svc.crearGuiaAsync(req.usuario, { titulo, resumen, contenido, accent, keywords })
    res.status(201).json(data)
})

/** PUT /api/enterprise/guias/:id — editar guía propia. */
router.put('/guias/:id', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de guía no es válido.', 400)
    const { titulo, resumen, contenido, accent, keywords } = req.body ?? {}
    const data = await svc.actualizarGuiaAsync(req.usuario, req.params.id, { titulo, resumen, contenido, accent, keywords })
    res.status(200).json(data)
})

/** DELETE /api/enterprise/guias/:id — eliminar guía propia. */
router.delete('/guias/:id', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de guía no es válido.', 400)
    const data = await svc.eliminarGuiaAsync(req.usuario, req.params.id)
    res.status(200).json(data)
})

/** POST /api/enterprise/guias/:id/asignar — asignar + notificar miembros. */
router.post('/guias/:id/asignar', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de guía no es válido.', 400)
    const { member_ids, due_date, notas, titulo } = req.body ?? {}
    const data = await svc.asignarGuiaAsync(req.usuario, req.params.id, {
        memberIds: member_ids, dueDate: due_date, notas, titulo,
    })
    res.status(200).json(data)
})

/** POST /api/enterprise/guias/notificar — notificación de guía catálogo/custom. */
router.post('/guias/notificar', async (req, res) => {
    const { targets, titulo, mensaje, guide_slug, guide_url } = req.body ?? {}
    const data = await svc.notificarGuiaAsync(req.usuario, {
        targets, titulo, mensaje, guideSlug: guide_slug, guideUrl: guide_url,
    })
    res.status(200).json(data)
})

/** GET /api/enterprise/mis-asignaciones — guías asignadas al miembro (training_config). */
router.get('/mis-asignaciones', async (req, res) => {
    const data = await svc.getMisAsignacionesGuiasAsync(req.usuario)
    res.status(200).json(data)
})

/** GET /api/enterprise/guias-asignadas — enterprise_guides asignadas al miembro (tabla). */
router.get('/guias-asignadas', async (req, res) => {
    const data = await svc.getGuiasAsignadasAsync(req.usuario)
    res.status(200).json(data)
})

/** GET /api/enterprise/guias/:id/progreso — progreso propio del usuario. */
router.get('/guias/:id/progreso', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de guía no es válido.', 400)
    const data = await svc.getProgresoGuiaAsync(req.usuario, req.params.id)
    res.status(200).json(data)
})

/** POST /api/enterprise/guias/:id/progreso — progreso propio (RPC update_guide_progress). */
router.post('/guias/:id/progreso', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de guía no es válido.', 400)
    const { section_id, completed, data: progresoData } = req.body ?? {}
    const data = await svc.actualizarProgresoGuiaAsync(req.usuario, req.params.id, {
        sectionId: section_id, completed, data: progresoData,
    })
    res.status(200).json(data)
})

// ── Analytics del panel ──────────────────────────────────────────────────────

/** GET /api/enterprise/analytics/intentos — intentos de miembros por desafío (agrupados). */
router.get('/analytics/intentos', async (req, res) => {
    const data = await svc.getIntentosDesafiosAsync(req.usuario)
    res.status(200).json(data)
})

/** GET /api/enterprise/analytics/intentos-diarios?days=30 — progreso diario del equipo. */
router.get('/analytics/intentos-diarios', async (req, res) => {
    const days = Number.parseInt(req.query.days, 10) || 30
    const data = await svc.getIntentosDiariosAsync(req.usuario, days)
    res.status(200).json(data)
})

/** GET /api/enterprise/analytics/progreso-miembros — guide_progress por miembro. */
router.get('/analytics/progreso-miembros', async (req, res) => {
    const data = await svc.getProgresoMiembrosAsync(req.usuario)
    res.status(200).json(data)
})

// ── Desafíos ─────────────────────────────────────────────────────────────────

/** GET /api/enterprise/desafios — desafíos de la empresa (con prompt: son suyos). */
router.get('/desafios', async (req, res) => {
    const data = await svc.getDesafiosAsync(req.usuario)
    res.status(200).json(data)
})

/** GET /api/enterprise/desafios/:id/stats — challenge_attempts_detailed de un desafío propio. */
router.get('/desafios/:id/stats', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de desafío no es válido.', 400)
    const data = await svc.getChallengeStatsAsync(req.usuario, req.params.id)
    res.status(200).json(data)
})

/**
 * POST /api/enterprise/desafios/imagen — sube la imagen del desafío al bucket
 * y devuelve la URL para usar en el create/update. Body binario image/*.
 */
router.post('/desafios/imagen', express.raw({ type: 'image/*', limit: '3mb' }), async (req, res) => {
    await svc.assertEmpresaAsync(req.usuario.id)
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throwError('Mandá la imagen como body binario con Content-Type image/*.', 400)
    }
    const subida = await storageSvc.subirImagenAsync(req.body, 'enterprise-challenges', req.usuario.id)
    res.status(200).json(subida)
})

/** POST /api/enterprise/desafios — crear desafío (whitelist; company_id del JWT). */
router.post('/desafios', async (req, res) => {
    const data = await svc.crearDesafioAsync(req.usuario, req.body ?? {})
    res.status(201).json(data)
})

/** PUT /api/enterprise/desafios/:id — editar desafío propio. */
router.put('/desafios/:id', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de desafío no es válido.', 400)
    const data = await svc.actualizarDesafioAsync(req.usuario, req.params.id, req.body ?? {})
    res.status(200).json(data)
})

/**
 * POST /api/enterprise/desafios/generar — configuración con Gemini.
 * Contrato "storage-first" (Vercel limita el body a ~4.5MB, así que la imagen
 * NO viaja en este request): el cliente sube primero la imagen con
 * POST /desafios/imagen y acá manda solo su `path`; el server la descarga del
 * bucket y la inyecta en base64 a Gemini. Rate limit estricto: endpoint caro.
 */
router.post('/desafios/generar', evaluationLimiter, async (req, res) => {
    const { user_prompt, image_path, industry } = req.body ?? {}
    if (typeof user_prompt !== 'string' || !user_prompt.trim()) {
        throwError('user_prompt es requerido.', 400)
    }
    await svc.assertEmpresaAsync(req.usuario.id)

    let imageBase64 = null
    let mimeType = null
    if (image_path != null) {
        if (typeof image_path !== 'string' || !image_path.startsWith(`${req.usuario.id}/`)) {
            // Solo se pueden leer imágenes del prefijo propio del bucket
            throwError('image_path no es válido.', 400)
        }
        const { buffer, mime } = await storageSvc.descargarImagenAsync('enterprise-challenges', image_path)
        imageBase64 = buffer.toString('base64')
        mimeType = mime
    }

    const data = await genSvc.generarAsync({
        userPrompt: user_prompt.trim().slice(0, 1000),
        imageBase64,
        mimeType,
        companyIndustry: typeof industry === 'string' ? industry.slice(0, 60) : 'general',
    })
    res.status(200).json(data)
})

// ── Chat de análisis de equipo (Groq server-side) ───────────────────────────

/** POST /api/enterprise/chat — body: { messages: [{role, content}], lang }. */
router.post('/chat', evaluationLimiter, async (req, res) => {
    const { messages, lang } = req.body ?? {}
    const data = await chatSvc.chatAsync(req.usuario, messages, lang)
    res.status(200).json(data)
})

export default router
