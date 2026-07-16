import pool from '../database/db.js'

/**
 * SQL de las 4 fuentes de notificaciones que Header.jsx leía por separado
 * (`team_invitations`, `guide_suggestions`, `challenge_notifications`,
 * `notification_reads`). Los JOINs replican los embeds de PostgREST que usaba
 * el frontend (sender de la invitación, empresa e imagen del desafío).
 */
export default class NotificacionRepository {
    /** Invitaciones donde participa el usuario (como empresa, receptor o email). */
    getInvitacionesAsync = async (idUsuario, email, limit = 30) => {
        const result = await pool.query(
            `SELECT i.id, i.company_id, i.user_id, i.user_email, i.status, i.message, i.created_at,
                    s.company_name  AS sender_company_name,
                    s.nombre_display AS sender_nombre_display,
                    s.avatar_url    AS sender_avatar_url,
                    s.verified      AS sender_verified
             FROM team_invitations i
             LEFT JOIN usuarios s ON s.id_usuario = i.company_id
             WHERE i.company_id = $1 OR i.user_id = $1 OR ($2::text IS NOT NULL AND i.user_email = $2)
             ORDER BY i.created_at DESC
             LIMIT $3`,
            [idUsuario, email, limit]
        )
        return result.rows
    }

    /** Sugerencias de guía (también carrier de respuestas a reportes). */
    getGuideSuggestionsAsync = async (idUsuario, email, limit = 30) => {
        const result = await pool.query(
            `SELECT id, target_user_id, target_email, title, message, guide_slug, guide_url, created_at
             FROM guide_suggestions
             WHERE target_user_id = $1 OR ($2::text IS NOT NULL AND target_email = $2)
             ORDER BY created_at DESC
             LIMIT $3`,
            [idUsuario, email, limit]
        )
        return result.rows
    }

    /** Notificaciones de desafíos de la empresa del usuario. */
    getChallengeNotificationsAsync = async (idUsuario, limit = 30) => {
        const result = await pool.query(
            `SELECT c.id, c.challenge_id, c.company_id, c.title, c.message, c.created_at,
                    img.id_imagen, img.url_image, img.image_theme, img.image_diff,
                    emp.company_name AS company_name,
                    emp.avatar_url   AS company_avatar_url,
                    emp.verified     AS company_verified
             FROM challenge_notifications c
             LEFT JOIN imagenes_ia img ON img.id_imagen = c.challenge_id
             LEFT JOIN usuarios emp ON emp.id_usuario = c.company_id
             WHERE c.target_user_id = $1
             ORDER BY c.created_at DESC
             LIMIT $2`,
            [idUsuario, limit]
        )
        return result.rows
    }

    /** Claves (source_type:source_id) ya leídas por el usuario. */
    getReadsAsync = async (idUsuario) => {
        const result = await pool.query(
            `SELECT source_type, source_id FROM notification_reads WHERE user_id = $1`,
            [idUsuario]
        )
        return result.rows
    }

    /** Marca leídas en batch (idempotente vía ON CONFLICT). */
    upsertReadsAsync = async (idUsuario, items) => {
        if (!items.length) return 0
        const values = []
        const params = [idUsuario]
        items.forEach((item) => {
            params.push(item.source_type, item.source_id)
            values.push(`($1, $${params.length - 1}, $${params.length})`)
        })
        const result = await pool.query(
            `INSERT INTO notification_reads (user_id, source_type, source_id)
             VALUES ${values.join(', ')}
             ON CONFLICT (user_id, source_type, source_id) DO NOTHING`,
            params
        )
        return result.rowCount
    }
}
