import pool from '../database/db.js'

/**
 * SQL de leaderboard sobre `usuarios`. Solo lectura de columnas públicas.
 * Reemplaza el SELECT + los UPDATE masivos de rank_anterior que el cliente
 * hacía en LeaderboardApp.jsx (cada cliente escribía filas ajenas).
 */
export default class LeaderboardRepository {
    /** Columnas por las que se permite ordenar (whitelist anti-inyección). */
    static SORTABLE = new Set([
        'elo_rating', 'promedio_score', 'mejor_score',
        'total_intentos', 'porcentaje_aprobacion', 'racha_actual',
    ])

    getTopAsync = async ({ sortBy = 'elo_rating', limit = 100, minRanked = 5 } = {}) => {
        const col = LeaderboardRepository.SORTABLE.has(sortBy) ? sortBy : 'elo_rating'
        const result = await pool.query(
            `SELECT id_usuario, nombre, nombre_display, username, avatar_url,
                    promedio_score, mejor_score, total_intentos, porcentaje_aprobacion,
                    racha_actual, rank_anterior, elo_rating, ranked_count,
                    company_name, show_company_badge, verified
             FROM usuarios
             WHERE COALESCE(adminstate, false) = false
               AND COALESCE(ranked_count, 0) >= $1
             ORDER BY ${col} DESC NULLS LAST
             LIMIT $2`,
            [minRanked, limit]
        )
        return result.rows
    }

    /**
     * Snapshot diario de posiciones: guarda el ranking actual en rank_anterior
     * para poder mostrar el delta. Se hace en UNA sentencia con una CTE ordenada
     * (antes era un loop de UPDATEs desde cada cliente).
     */
    snapshotRankAnteriorAsync = async ({ sortBy = 'elo_rating', minRanked = 5 } = {}) => {
        const col = LeaderboardRepository.SORTABLE.has(sortBy) ? sortBy : 'elo_rating'
        const result = await pool.query(
            `WITH ranked AS (
                SELECT id_usuario,
                       ROW_NUMBER() OVER (ORDER BY ${col} DESC NULLS LAST) AS pos
                FROM usuarios
                WHERE COALESCE(adminstate, false) = false
                  AND COALESCE(ranked_count, 0) >= $1
             )
             UPDATE usuarios u
             SET rank_anterior = r.pos
             FROM ranked r
             WHERE u.id_usuario = r.id_usuario
               AND u.rank_anterior IS DISTINCT FROM r.pos`,
            [minRanked]
        )
        return result.rowCount
    }
}
