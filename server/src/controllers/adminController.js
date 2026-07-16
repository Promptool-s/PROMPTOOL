import { Router } from 'express'
import AdminService from '../services/adminService.js'
import ReporteService from '../services/reporteService.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { adminMiddleware } from '../middlewares/adminMiddleware.js'
import { throwError } from '../helpers/httpError.js'
import { isValidUUID, isValidPk, clampInt } from '../helpers/validatorHelper.js'

const router = Router()
const svc = new AdminService()
const reporteSvc = new ReporteService()

// Todas las rutas admin: autenticación + verificación de admin CONTRA LA BD.
router.use(authMiddleware, adminMiddleware)

/** GET /api/admin/usuarios?search=&limit=&offset= — listado de gestión. */
router.get('/usuarios', async (req, res) => {
    const search = typeof req.query.search === 'string' && req.query.search.trim()
        ? req.query.search.trim()
        : null
    const data = await svc.listarUsuariosAsync({
        search,
        limit: clampInt(req.query.limit, 1, 200, 50),
        offset: clampInt(req.query.offset, 0, 1_000_000, 0),
    })
    res.status(200).json(data)
})

/**
 * PATCH /api/admin/usuarios/:id — togglear un flag (adminstate|verified|devstate).
 * Body: { campo: 'verified', valor: true }. Reemplaza los updates directos de
 * AdminApp.jsx. No existe endpoint de SQL arbitrario ni de tabla dinámica.
 */
router.patch('/usuarios/:id', async (req, res) => {
    if (!isValidUUID(req.params.id)) throwError('El ID de usuario no es válido.', 400)
    const { campo, valor } = req.body ?? {}
    const data = await svc.setFlagUsuarioAsync(req.params.id, campo, valor)
    res.status(200).json(data)
})

// ── Reportes de usuarios/imágenes ──────────────────────────────────────────

/** GET /api/admin/reportes — bandeja de reportes. */
router.get('/reportes', async (req, res) => {
    const data = await reporteSvc.listarAsync()
    res.status(200).json(data)
})

/** PATCH /api/admin/reportes/:id — cambiar estado / dejar notas de review. */
router.patch('/reportes/:id', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de reporte no es válido.', 400)
    const { status, reviewer_notes } = req.body ?? {}
    const data = await reporteSvc.actualizarAsync(req.params.id, req.usuario.id, {
        status, reviewerNotes: reviewer_notes,
    })
    res.status(200).json(data)
})

/** DELETE /api/admin/reportes/:id — descartar/borrar un reporte. */
router.delete('/reportes/:id', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de reporte no es válido.', 400)
    const data = await reporteSvc.eliminarAsync(req.params.id)
    res.status(200).json(data)
})

export default router
