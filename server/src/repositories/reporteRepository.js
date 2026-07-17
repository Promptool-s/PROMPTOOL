import pool from '../database/db.js'

/**
 * SQL sobre `user_reports`. Creación (cualquier usuario/guest) y gestión (admin).
 * Reemplaza el insert directo de ConfigModal.jsx y el CRUD de AdminApp.jsx.
 */
export default class ReporteRepository {
    createAsync = async ({ reporterId, targetType, targetId, reason, fecha }) => {
        const result = await pool.query(
            `INSERT INTO user_reports (reporter_id, target_type, target_id, reason, status, created_at)
             VALUES ($1, $2, $3, $4, 'pending', $5)
             RETURNING id`,
            [reporterId, targetType, targetId, reason, fecha]
        )
        return result.rows[0] ?? null
    }

    adminListAsync = async ({ limit = 100 } = {}) => {
        const result = await pool.query(
            `SELECT r.*,
                    u.nombre, u.nombre_display, u.username, u.avatar_url
             FROM user_reports r
             LEFT JOIN usuarios u ON u.id_usuario = r.reporter_id
             ORDER BY r.created_at DESC
             LIMIT $1`,
            [limit]
        )
        return result.rows
    }

    adminUpdateAsync = async (id, { status, reviewerId, reviewerNotes, fecha }) => {
        const result = await pool.query(
            `UPDATE user_reports
             SET status = $2, reviewer_id = $3, reviewer_notes = COALESCE($4, reviewer_notes),
                 reviewed_at = $5
             WHERE id = $1
             RETURNING *`,
            [id, status, reviewerId, reviewerNotes ?? null, fecha]
        )
        return result.rows[0] ?? null
    }

    adminDeleteAsync = async (id) => {
        const result = await pool.query(`DELETE FROM user_reports WHERE id = $1`, [id])
        return result.rowCount > 0
    }
}
