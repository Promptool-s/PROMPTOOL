import pool from '../database/db.js'

/**
 * SQL sobre la tabla `intentos`.
 */
export default class IntentoRepository {
    /** Mejor puntaje previo del usuario para una imagen (para detectar mejora real). */
    getMejorPuntajeAsync = async (idUsuario, idImagen) => {
        const result = await pool.query(
            `SELECT MAX(puntaje_similitud) AS mejor
             FROM intentos WHERE id_usuario = $1 AND id_imagen = $2`,
            [idUsuario, idImagen]
        )
        return result.rows[0]?.mejor ?? null
    }

    countRankedWithClientAsync = async (idUsuario, client) => {
        const result = await client.query(
            `SELECT COUNT(*)::int AS total FROM intentos
             WHERE id_usuario = $1 AND is_ranked = true`,
            [idUsuario]
        )
        return result.rows[0]?.total ?? 0
    }

    createWithClientAsync = async (intento, client) => {
        const result = await client.query(
            `INSERT INTO intentos
                (prompt_usuario, puntaje_similitud, id_imagen, id_usuario, fecha_hora,
                 strengths, improvements, modo, elo_delta, is_ranked,
                 tiempo_respuesta, attempt_number, tiempo_asignado, eficiencia)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING id_intento`,
            [
                intento.prompt_usuario,
                intento.puntaje_similitud,
                intento.id_imagen,
                intento.id_usuario,
                intento.fecha_hora,
                JSON.stringify(intento.strengths ?? []),
                JSON.stringify(intento.improvements ?? []),
                intento.modo,
                intento.elo_delta,
                intento.is_ranked,
                intento.tiempo_respuesta,
                intento.attempt_number,
                intento.tiempo_asignado,
                intento.eficiencia,
            ]
        )
        return result.rows[0] ?? null
    }

    setEloDeltaWithClientAsync = async (idIntento, delta, client) => {
        await client.query(
            `UPDATE intentos SET elo_delta = $2 WHERE id_intento = $1`,
            [idIntento, delta]
        )
    }

    /** Cantidad de intentos de un usuario sobre una imagen (gating del reveal). */
    countByUsuarioImagenAsync = async (idUsuario, idImagen) => {
        const result = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM intentos WHERE id_usuario = $1 AND id_imagen = $2`,
            [idUsuario, idImagen]
        )
        return result.rows[0]?.total ?? 0
    }

    /**
     * Últimos intentos del usuario para el análisis anti-cheat (similitud de
     * prompts, patrón histórico, consistencia temporal). `excludeImagen`
     * descarta la imagen actual: repetir prompt sobre la misma imagen es un
     * retry normal, no plagio.
     */
    getUltimosAsync = async (idUsuario, { limit = 20, excludeImagen = null } = {}) => {
        const params = [idUsuario]
        let where = 'WHERE id_usuario = $1'
        if (excludeImagen != null) {
            params.push(excludeImagen)
            where += ` AND id_imagen <> $${params.length}`
        }
        params.push(limit)
        const result = await pool.query(
            `SELECT id_imagen, prompt_usuario, puntaje_similitud, tiempo_respuesta, fecha_hora
             FROM intentos
             ${where}
             ORDER BY fecha_hora DESC
             LIMIT $${params.length}`,
            params
        )
        return result.rows
    }

    /**
     * Pool para el showcase de comunidad de la landing: intentos con score alto,
     * con imagen y autor resueltos en SQL. La selección final (mejor por usuario,
     * filtro de contenido, shuffle) la hace el Service.
     */
    getComunidadShowcaseAsync = async (limit = 500) => {
        const result = await pool.query(
            `SELECT i.prompt_usuario, i.puntaje_similitud, i.id_usuario, i.id_imagen,
                    img.url_image, u.username, u.avatar_url, u.devstate
             FROM intentos i
             JOIN imagenes_ia img ON img.id_imagen = i.id_imagen
             LEFT JOIN usuarios u ON u.id_usuario = i.id_usuario
             WHERE i.puntaje_similitud >= 70
               AND i.prompt_usuario IS NOT NULL
               AND img.url_image IS NOT NULL
             ORDER BY i.fecha_hora DESC
             LIMIT $1`,
            [limit]
        )
        return result.rows
    }

    /** Total de intentos de la plataforma (stat pública de la landing). */
    countAllAsync = async () => {
        const result = await pool.query(`SELECT COUNT(*)::int AS total FROM intentos`)
        return result.rows[0]?.total ?? 0
    }

    /**
     * Historial completo para la página de perfil: intentos + join con la
     * imagen (dificultad, url, company_id) y con la empresa dueña del desafío
     * (nombre + verified). Resuelve en SQL lo que el frontend hacía con lecturas
     * extra a `usuarios` (nombres de empresa + filtro de verificadas).
     * `prompt_original` solo se incluye si `includeOriginal` (dueño/admin).
     */
    getHistorialPerfilAsync = async (idUsuario, { limit = 365, includeOriginal = false } = {}) => {
        const promptOriginalCol = includeOriginal ? 'img.prompt_original,' : ''
        const result = await pool.query(
            `SELECT i.id_intento, i.id_imagen, i.prompt_usuario, i.puntaje_similitud,
                    i.fecha_hora, i.modo, i.is_ranked, i.elo_delta, i.tiempo_respuesta,
                    i.strengths, i.improvements,
                    img.url_image, img.image_diff, img.company_id,
                    ${promptOriginalCol}
                    co.company_name, co.nombre_display AS company_nombre_display,
                    co.verified AS company_verified
             FROM intentos i
             LEFT JOIN imagenes_ia img ON img.id_imagen = i.id_imagen
             LEFT JOIN usuarios co ON co.id_usuario = img.company_id
             WHERE i.id_usuario = $1
             ORDER BY i.fecha_hora DESC
             LIMIT $2`,
            [idUsuario, limit]
        )
        return result.rows
    }

    /**
     * Últimos intentos del usuario en una dificultad (join con imagenes_ia),
     * para el cálculo del tiempo recomendado personalizado. Solo trae intentos
     * con tiempo_respuesta registrado.
     */
    getUltimosPorDificultadAsync = async (idUsuario, difficulty, limit = 15) => {
        const result = await pool.query(
            `SELECT i.tiempo_respuesta, i.puntaje_similitud
             FROM intentos i
             JOIN imagenes_ia img ON img.id_imagen = i.id_imagen
             WHERE i.id_usuario = $1
               AND img.image_diff = $2
               AND i.tiempo_respuesta IS NOT NULL
             ORDER BY i.fecha_hora DESC
             LIMIT $3`,
            [idUsuario, difficulty, limit]
        )
        return result.rows
    }

    /** ¿El usuario ya jugó el modo daily desde `sinceIso`? (una fila alcanza). */
    existeDailyDesdeAsync = async (idUsuario, sinceIso) => {
        const result = await pool.query(
            `SELECT 1 FROM intentos
             WHERE id_usuario = $1 AND modo = 'daily' AND fecha_hora >= $2
             LIMIT 1`,
            [idUsuario, sinceIso]
        )
        return result.rows.length > 0
    }

    /** Historial del propio usuario (paginado simple). */
    getByUsuarioAsync = async (idUsuario, { limit = 50, offset = 0 } = {}) => {
        const result = await pool.query(
            `SELECT id_intento, id_imagen, prompt_usuario, puntaje_similitud, fecha_hora,
                    modo, is_ranked, elo_delta, tiempo_respuesta, attempt_number
             FROM intentos
             WHERE id_usuario = $1
             ORDER BY fecha_hora DESC
             LIMIT $2 OFFSET $3`,
            [idUsuario, limit, offset]
        )
        return result.rows
    }
}
