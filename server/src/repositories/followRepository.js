import pool from '../database/db.js'

/**
 * SQL sobre la tabla `follows`.
 * Convención: errores de infraestructura se propagan; los métodos de escritura
 * son idempotentes (seguir dos veces no duplica, dejar de seguir sin seguir no falla).
 */
export default class FollowRepository {
    /** Idempotente vía ON CONFLICT: seguir dos veces no duplica la fila. */
    followAsync = async (followerId, followingId) => {
        const result = await pool.query(
            `INSERT INTO follows (follower_id, following_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [followerId, followingId]
        )
        return result.rowCount > 0
    }

    unfollowAsync = async (followerId, followingId) => {
        const result = await pool.query(
            `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
            [followerId, followingId]
        )
        return result.rowCount > 0
    }

    isFollowingAsync = async (followerId, followingId) => {
        const result = await pool.query(
            `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`,
            [followerId, followingId]
        )
        return result.rowCount > 0
    }

    /** Contadores de un perfil en una sola query. */
    getCountsAsync = async (idUsuario) => {
        const result = await pool.query(
            `SELECT
                (SELECT COUNT(*)::int FROM follows WHERE following_id = $1) AS followers,
                (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) AS following`,
            [idUsuario]
        )
        return result.rows[0] ?? { followers: 0, following: 0 }
    }
}
