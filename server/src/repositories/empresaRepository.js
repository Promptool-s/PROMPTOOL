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
                    porcentaje_aprobacion, racha_actual, company_role,
                    company_joined_at, created_at
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
                    challenge_hints, challenge_evaluation_mode,
                    challenge_eval_instructions, challenge_content_type
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

    /** Settings completos del panel de empresa (fila propia en `usuarios`). */
    getSettingsAsync = async (companyId) => {
        const result = await pool.query(
            `SELECT company_name, user_type, id_usuario, bio, social_website,
                    settings_allowed_diffs, industry_type, tournament_enabled,
                    default_challenge_type, default_challenge_mode,
                    performance_metrics, training_config, dashboard_filters
             FROM usuarios WHERE id_usuario = $1`,
            [companyId]
        )
        return result.rows[0] ?? null
    }

    /** `fields` ya viene whitelisteado por el Service. Update sobre la propia fila. */
    updateSettingsAsync = async (companyId, fields) => {
        const keys = Object.keys(fields)
        if (keys.length === 0) return null
        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ')
        const result = await pool.query(
            `UPDATE usuarios SET ${setClause}
             WHERE id_usuario = $1
             RETURNING company_name, bio, social_website, settings_allowed_diffs,
                       industry_type, tournament_enabled, default_challenge_type,
                       default_challenge_mode, performance_metrics, training_config,
                       dashboard_filters`,
            [companyId, ...keys.map((k) => fields[k])]
        )
        return result.rows[0] ?? null
    }

    /** Config JSONB del panel (fila propia de la empresa en `usuarios`). */
    getConfigAsync = async (companyId) => {
        const result = await pool.query(
            `SELECT training_config, dashboard_filters, performance_metrics
             FROM usuarios WHERE id_usuario = $1`,
            [companyId]
        )
        return result.rows[0] ?? null
    }

    /** `fields` ya viene whitelisteado por el Service (columnas JSONB). */
    updateConfigAsync = async (companyId, fields) => {
        const keys = Object.keys(fields)
        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ')
        const result = await pool.query(
            `UPDATE usuarios SET ${setClause}
             WHERE id_usuario = $1
             RETURNING training_config, dashboard_filters, performance_metrics`,
            [companyId, ...keys.map((k) => fields[k])]
        )
        return result.rows[0] ?? null
    }

    /**
     * Intentos de los miembros del equipo sobre los desafíos de la empresa,
     * para el desglose por desafío del panel. Membresía y ownership de los
     * desafíos se resuelven en SQL (company_id = $1), no se confía en el cliente.
     */
    getIntentosDesafiosAsync = async (companyId) => {
        const result = await pool.query(
            `SELECT i.id_intento, i.id_usuario, i.id_imagen, i.puntaje_similitud,
                    i.prompt_usuario, i.strengths, i.improvements, i.fecha_hora, i.modo,
                    i."visualElements", i."styleAtmosphere", i."technicalDetails", i.clarity
             FROM intentos i
             WHERE i.id_imagen IN (SELECT id_imagen FROM imagenes_ia WHERE company_id = $1)
               AND i.id_usuario IN (SELECT id_usuario FROM usuarios WHERE company_id = $1)
             ORDER BY i.fecha_hora DESC`,
            [companyId]
        )
        return result.rows
    }

    /** Intentos de los miembros desde `since` (progreso diario del equipo). */
    getIntentosDiariosAsync = async (companyId, sinceIso) => {
        const result = await pool.query(
            `SELECT id_usuario, puntaje_similitud, fecha_hora
             FROM intentos
             WHERE id_usuario IN (SELECT id_usuario FROM usuarios WHERE company_id = $1)
               AND fecha_hora >= $2
             ORDER BY fecha_hora ASC`,
            [companyId, sinceIso]
        )
        return result.rows
    }

    /** Estadísticas detalladas de un desafío propio (vista challenge_attempts_detailed). */
    getChallengeStatsAsync = async (companyId, idImagen) => {
        const result = await pool.query(
            `SELECT * FROM challenge_attempts_detailed
             WHERE id_imagen = $1 AND company_id = $2
             ORDER BY fecha_hora DESC`,
            [idImagen, companyId]
        )
        return result.rows
    }

    /**
     * training_config de la empresa a la que pertenece un miembro. Se usa para
     * leer `guide_assignments` desde el lado del usuario (GuidesApp.jsx) sin
     * exponer la fila entera de la empresa. Devuelve null si el usuario no tiene
     * empresa.
     */
    getCompanyTrainingConfigForMemberAsync = async (userId) => {
        const result = await pool.query(
            `SELECT c.training_config
             FROM usuarios u
             JOIN usuarios c ON c.id_usuario = u.company_id
             WHERE u.id_usuario = $1`,
            [userId]
        )
        return result.rows[0] ?? null
    }

    /** training_config de los miembros (para leer guide_progress por miembro). */
    getMiembrosTrainingConfigAsync = async (companyId) => {
        const result = await pool.query(
            `SELECT id_usuario, training_config
             FROM usuarios WHERE company_id = $1`,
            [companyId]
        )
        return result.rows
    }

    /**
     * Guías de empresa asignadas a un miembro (tabla guide_assignments unida a
     * enterprise_guides). Devuelve ya la forma que consume GuidesSection.jsx.
     * NOTA (esquema inferido): se asumen las columnas guide_assignments
     * (assigned_to, guide_id, assigned_by, due_date, notes, status). Validar
     * contra el esquema real de Supabase antes del E2E.
     */
    getAssignedEnterpriseGuidesAsync = async (userId) => {
        const result = await pool.query(
            `SELECT eg.id, eg.title, eg.summary, eg.content, eg.accent, eg.keywords,
                    eg.status, eg.created_at,
                    ga.id AS assignment_id, ga.assigned_by, ga.due_date, ga.notes,
                    ga.status AS assignment_status
             FROM guide_assignments ga
             JOIN enterprise_guides eg ON eg.id = ga.guide_id
             WHERE ga.assigned_to = $1 AND ga.status = 'assigned'
             ORDER BY ga.due_date NULLS LAST`,
            [userId]
        )
        return result.rows
    }

    /** Progreso propio del usuario en una guía (lectura de guide_progress). */
    getGuideProgressAsync = async (guiaId, userId) => {
        const result = await pool.query(
            `SELECT section_id, completed, data
             FROM guide_progress
             WHERE guide_id = $1 AND user_id = $2`,
            [guiaId, userId]
        )
        return result.rows
    }

    /** Guías propias de la empresa (tabla enterprise_guides). */
    getEnterpriseGuidesAsync = async (companyId, limit = 100) => {
        const result = await pool.query(
            `SELECT * FROM enterprise_guides
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [companyId, limit]
        )
        return result.rows
    }

    getEnterpriseGuideByIdAsync = async (guiaId) => {
        const result = await pool.query(
            `SELECT id, company_id FROM enterprise_guides WHERE id = $1`,
            [guiaId]
        )
        return result.rows[0] ?? null
    }

    /** `fields` ya viene whitelisteado por el Service. Update sobre guía propia. */
    updateEnterpriseGuideAsync = async (guiaId, companyId, fields) => {
        const keys = Object.keys(fields)
        if (keys.length === 0) return null
        const setClause = keys.map((key, i) => `${key} = $${i + 3}`).join(', ')
        const result = await pool.query(
            `UPDATE enterprise_guides SET ${setClause}
             WHERE id = $1 AND company_id = $2
             RETURNING id`,
            [guiaId, companyId, ...keys.map((k) => fields[k])]
        )
        return result.rows[0] ?? null
    }

    deleteEnterpriseGuideAsync = async (guiaId, companyId) => {
        const result = await pool.query(
            `DELETE FROM enterprise_guides WHERE id = $1 AND company_id = $2 RETURNING id`,
            [guiaId, companyId]
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
