import LeaderboardRepository from '../repositories/leaderboardRepository.js'
import { MIN_INTENTOS_PARA_ELO } from '../constants/index.js'

/**
 * Leaderboard: top de jugadores rankeados. El cálculo de posiciones y el
 * snapshot de rank_anterior viven en el servidor; el cliente solo lee.
 */
export default class LeaderboardService {
    constructor() {
        this.repo = new LeaderboardRepository()
    }

    getTopAsync = async ({ sortBy, limit } = {}) =>
        await this.repo.getTopAsync({ sortBy, limit, minRanked: MIN_INTENTOS_PARA_ELO })

    /** Snapshot diario (lo dispara un endpoint admin o un cron). */
    snapshotAsync = async ({ sortBy } = {}) =>
        await this.repo.snapshotRankAnteriorAsync({ sortBy, minRanked: MIN_INTENTOS_PARA_ELO })
}
