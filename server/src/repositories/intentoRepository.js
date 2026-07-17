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
