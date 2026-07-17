import { Router } from 'express'
import NotificacionService from '../services/notificacionService.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'

const router = Router()
const svc = new NotificacionService()

// Todas las rutas de notificaciones requieren sesión.
router.use(authMiddleware)

/**
 * GET /api/notificaciones — feed unificado (invitaciones + guías + desafíos)
 * con el estado de lectura resuelto. Reemplaza las 4 queries de Header.jsx.
 */
router.get('', async (req, res) => {
    const data = await svc.getNotificacionesAsync(req.usuario.id, req.usuario.email)
    res.status(200).json(data)
})

/**
 * POST /api/notificaciones/leidas — marca leídas en batch.
 * Body: { items: [{ source_type, source_id }, ...] }
 */
router.post('/leidas', async (req, res) => {
    const data = await svc.marcarLeidasAsync(req.usuario.id, req.body?.items)
    res.status(200).json(data)
})

export default router
