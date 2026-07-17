import pool from '../database/db.js'

/**
 * SQL de lecturas/escrituras del bloque enterprise: miembros del equipo,
 * roles personalizados, desafíos de empresa y notificaciones de guías.
 * Las mutaciones de membresía/roles pasan por las RPCs SECURITY DEFINER
 * (supabaseRpcRepository) — acá solo hay queries directas.
 */
export default class EmpresaRepository {
    /** Miembros del equipo con las métricas que muestra el panel. */
    getMiembrosAsync = async (companyId, limit = 100) => {
        const result = await pool.query(
            `SELECT id_usuario, nombre, nombre_display, company_display_name, username,
                    email, avatar_url, elo_rating, total_intentos, promedio_score,
                    porcentaje_aprobacion, racha_actual, company_role
             FROM usuarios
             WHERE company_id = $1
             ORDER BY elo_rating DESC NULLS LAST
             LIMIT $2`,
            [companyId, limit]
        )
        return result.rows
    }

    /** Roles personalizados de la empresa. */
    getCustomRolesAsync = async (companyId) => {
        const result = await pool.query(
            `SELECT * FROM custom_roles WHERE company_id = $1 ORDER BY role_name`,
            [companyId]
        )
        return result.rows
    }

    /** Desafíos creados por la empresa (incluye prompt_original: son SUYOS). */
    getDesafiosAsync = async (companyId, limit = 50) => {
        const result = await pool.query(
            `SELECT id_imagen, url_image, image_diff, image_theme, fecha, prompt_original,
                    challenge_description, challenge_time_limit, challenge_max_attempts,
                    challenge_min_words, challenge_start_date, challenge_end_date,
                    challenge_visibility, challenge_points, challenge_tags,
                    challenge_hints, challenge_evaluation_mode
             FROM imagenes_ia
             WHERE company_id = $1
             ORDER BY fecha DESC
             LIMIT $2`,
            [companyId, limit]
        )
        return result.rows
    }

    getDesafioByIdAsync = async (idImagen) => {
        const result = await pool.query(
            `SELECT id_imagen, company_id FROM imagenes_ia WHERE id_imagen = $1`,
            [idImagen]
        )
        return result.rows[0] ?? null
    }

    /** `fields` ya viene whitelisteado por el Service; acá solo se parametriza. */
    createDesafioAsync = async (fields) => {
        const keys = Object.keys(fields)
        const cols = keys.join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const result = await pool.query(
            `INSERT INTO imagenes_ia (${cols}) VALUES (${placeholders})
             RETURNING id_imagen`,
            keys.map((k) => fields[k])
        )
        return result.rows[0] ?? null
    }

    updateDesafioAsync = async (idImagen, companyId, fields) => {
        const keys = Object.keys(fields)
        if (keys.length === 0) return null
        const setClause = keys.map((key, i) => `${key} = $${i + 3}`).join(', ')
        const result = await pool.query(
            `UPDATE imagenes_ia SET ${setClause}
             WHERE id_imagen = $1 AND company_id = $2
             RETURNING id_imagen`,
            [idImagen, companyId, ...keys.map((k) => fields[k])]
        )
        return result.rows[0] ?? null
    }

    /** Inserta notificaciones de guía en batch (asignaciones). */
    insertGuideSuggestionsAsync = async (rows) => {
        if (!rows.length) return 0
        const params = []
        const values = rows.map((r) => {
            params.push(r.target_user_id, r.target_email, r.title, r.message, r.guide_slug, r.guide_url, r.created_at)
            const base = params.length - 7
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
        })
        const result = await pool.query(
            `INSERT INTO guide_suggestions
                (target_user_id, target_email, title, message, guide_slug, guide_url, created_at)
             VALUES ${values.join(', ')}`,
            params
        )
        return result.rowCount
    }
}
