import { Router } from 'express'
import ReporteService from '../services/reporteService.js'
import { optionalAuthMiddleware } from '../middlewares/authMiddleware.js'

const router = Router()
const svc = new ReporteService()

/**
 * POST /api/reportes — reportar una imagen o usuario.
 * Auth opcional: si hay sesión, reporter_id sale del JWT; los guests reportan
 * de forma anónima. Reemplaza el insert directo a `user_reports` (ConfigModal).
 */
router.post('', optionalAuthMiddleware, async (req, res) => {
    const { target_type, target_id, reason } = req.body ?? {}
    const data = await svc.crearAsync({
        reporterId: req.usuario?.id ?? null,
        targetType: target_type,
        targetId: target_id ?? null,
        reason,
    })
    res.status(201).json(data)
})

export default router
