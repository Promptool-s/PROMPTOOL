import { Router } from 'express'
import LeaderboardService from '../services/leaderboardService.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { adminMiddleware } from '../middlewares/adminMiddleware.js'
import { clampInt } from '../helpers/validatorHelper.js'

const router = Router()
const svc = new LeaderboardService()

/**
 * GET /api/leaderboard?sort=<col>&limit=100 — top de jugadores rankeados.
 * Público. Reemplaza el SELECT directo de LeaderboardApp.jsx.
 */
router.get('', async (req, res) => {
    const sortBy = typeof req.query.sort === 'string' ? req.query.sort : 'elo_rating'
    const limit = clampInt(req.query.limit, 1, 100, 100)
    const data = await svc.getTopAsync({ sortBy, limit })
    res.status(200).json(data)
})

/**
 * POST /api/leaderboard/snapshot — recalcula rank_anterior (delta diario).
 * Solo admin. Reemplaza el loop de UPDATEs que hacía cada cliente sobre el
 * top-100. Idealmente se dispara desde un cron/job una vez al día.
 */
router.post('/snapshot', authMiddleware, adminMiddleware, async (req, res) => {
    const sortBy = typeof req.body?.sort === 'string' ? req.body.sort : 'elo_rating'
    const updated = await svc.snapshotAsync({ sortBy })
    res.status(200).json({ updated })
})

export default router
