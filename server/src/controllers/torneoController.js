import { Router } from 'express'
import TorneoService from '../services/torneoService.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { throwError } from '../helpers/httpError.js'
import { isValidPk } from '../helpers/validatorHelper.js'

const router = Router()
const svc = new TorneoService()

// El listado de torneos es una vista auth-gated en el cliente; todas las rutas
// requieren sesión. Reemplaza los accesos directos a Supabase de TournamentsApp.

/** GET /api/torneos — listado ordenado por fecha_inicio. */
router.get('', authMiddleware, async (req, res) => {
    const data = await svc.getTorneosAsync()
    res.status(200).json(data)
})

/** GET /api/torneos/mis-inscripciones — IDs de torneos del usuario. */
router.get('/mis-inscripciones', authMiddleware, async (req, res) => {
    const data = await svc.getMisInscripcionesAsync(req.usuario.id)
    res.status(200).json(data)
})

/** GET /api/torneos/:id/leaderboard — top 20 participantes. */
router.get('/:id/leaderboard', authMiddleware, async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de torneo no es válido.', 400)
    const data = await svc.getLeaderboardAsync(req.params.id)
    res.status(200).json(data)
})

/** POST /api/torneos/:id/inscribirse — inscribe al usuario (id del JWT). */
router.post('/:id/inscribirse', authMiddleware, async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de torneo no es válido.', 400)
    const data = await svc.inscribirAsync(req.params.id, req.usuario.id)
    res.status(200).json(data)
})

export default router
