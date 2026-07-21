import pool from '../database/db.js'

/**
 * SQL sobre la tabla `imagenes_ia`.
 * getByIdAsync devuelve TODO (incluido prompt_original) — es de uso interno
 * del backend. El Service decide qué campos salen hacia el cliente.
 */
export default class ImagenRepository {
    getByIdAsync = async (idImagen) => {
        const result = await pool.query(
            `SELECT * FROM imagenes_ia WHERE id_imagen = $1`,
            [idImagen]
        )
        return result.rows[0] ?? null
    }

    /**
     * Listado del feed público. Nunca incluye prompt_original/challenge_eval_instructions
     * (esas columnas son secreto del juego). Siempre excluye desafíos de empresa
     * (company_id no nulo) — esos se cargan por id vía getByIdAsync/getPublicaAsync.
     * `daily` ordena por fecha (imagen del día, fecha <= `before`); `random` mezcla
     * el orden en SQL; `excludeMasteredFor` saca imágenes que el usuario ya superó
     * (score > 93) para no repetirlas.
     */
    listarAsync = async ({
        dificultad = null, excludeIds = [], random = false, daily = false, before = null,
        excludeMasteredFor = null, limit = 20, offset = 0,
    } = {}) => {
        const conds = ['company_id IS NULL']
        const params = []

        if (dificultad) {
            params.push(dificultad)
            conds.push(`image_diff = $${params.length}`)
        }
        if (Array.isArray(excludeIds) && excludeIds.length > 0) {
            params.push(excludeIds)
            conds.push(`id_imagen <> ALL($${params.length})`)
        }
        if (daily) {
            params.push(before || new Date().toISOString())
            conds.push(`fecha <= $${params.length}`)
        }
        if (excludeMasteredFor) {
            params.push(excludeMasteredFor)
            conds.push(`id_imagen NOT IN (SELECT id_imagen FROM intentos WHERE id_usuario = $${params.length} AND puntaje_similitud > 93)`)
        }

        const where = `WHERE ${conds.join(' AND ')}`
        const order = daily ? 'ORDER BY fecha DESC' : random ? 'ORDER BY random()' : 'ORDER BY id_imagen DESC'

        params.push(limit)
        const limitIdx = params.length
        params.push(offset)
        const offsetIdx = params.length

        const result = await pool.query(
            `SELECT id_imagen, url_image, seed, fecha, image_diff, image_theme, company_id
             FROM imagenes_ia
             ${where}
             ${order}
             LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            params
        )
        return result.rows
    }

    /** Dificultades disponibles (para los filtros del feed). */
    getDificultadesAsync = async () => {
        const result = await pool.query(
            `SELECT DISTINCT image_diff FROM imagenes_ia WHERE image_diff IS NOT NULL`
        )
        return result.rows.map((r) => r.image_diff)
    }
}
