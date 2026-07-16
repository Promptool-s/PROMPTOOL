import pool from '../database/db.js'

/**
 * SQL sobre la tabla `team_invitations`.
 * Aceptar pasa por las RPCs SECURITY DEFINER (supabaseRpcRepository);
 * acá viven las operaciones directas (crear, rechazar, borrar, consultar).
 */
export default class InvitacionRepository {
    getByIdAsync = async (id) => {
        const result = await pool.query(
            `SELECT * FROM team_invitations WHERE id = $1`,
            [id]
        )
        return result.rows[0] ?? null
    }

    /** ¿Existe ya una invitación/solicitud activa entre esta empresa y este usuario/email? */
    existeActivaAsync = async (companyId, { userId = null, userEmail = null }) => {
        const result = await pool.query(
            `SELECT 1 FROM team_invitations
             WHERE company_id = $1
               AND status IN ('requested', 'pending', 'accepted')
               AND (($2::uuid IS NOT NULL AND user_id = $2)
                 OR ($3::text IS NOT NULL AND user_email = $3))
             LIMIT 1`,
            [companyId, userId, userEmail]
        )
        return result.rowCount > 0
    }

    createAsync = async ({ companyId, userId = null, userEmail = null, status, message = null, fecha }) => {
        const result = await pool.query(
            `INSERT INTO team_invitations (company_id, user_id, user_email, status, message, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [companyId, userId, userEmail, status, message, fecha]
        )
        return result.rows[0]
    }

    setStatusAsync = async (id, status) => {
        const result = await pool.query(
            `UPDATE team_invitations SET status = $2 WHERE id = $1 RETURNING *`,
            [id, status]
        )
        return result.rows[0] ?? null
    }

    deleteAsync = async (id) => {
        const result = await pool.query(
            `DELETE FROM team_invitations WHERE id = $1`,
            [id]
        )
        return result.rowCount > 0
    }

    /** Bandeja de la empresa (solicitudes + invitaciones enviadas). */
    getByCompanyAsync = async (companyId, limit = 50) => {
        const result = await pool.query(
            `SELECT i.*, u.nombre_display, u.username, u.avatar_url
             FROM team_invitations i
             LEFT JOIN usuarios u ON u.id_usuario = i.user_id
             WHERE i.company_id = $1
             ORDER BY i.created_at DESC
             LIMIT $2`,
            [companyId, limit]
        )
        return result.rows
    }
}
