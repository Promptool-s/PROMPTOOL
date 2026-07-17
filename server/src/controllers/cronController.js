import { Router } from 'express'
import LeaderboardService from '../services/leaderboardService.js'

/**
 * Rutas invocadas por Vercel Cron (vercel.json → "crons").
 * Vercel manda GET con `Authorization: Bearer ${CRON_SECRET}` si la env var
 * existe en el proyecto. Sin CRON_SECRET configurado, la ruta queda cerrada.
 */
const router = Router()
const leaderboardSvc = new LeaderboardService()

/** GET /api/cron/leaderboard-snapshot — snapshot diario de rank_anterior. */
router.get('/leaderboard-snapshot', async (req, res) => {
    const auth = req.headers.authorization || ''
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ message: 'No autorizado.' })
    }
    const updated = await leaderboardSvc.snapshotAsync({ sortBy: 'elo_rating' })
    res.status(200).json({ updated })
})

export default router
