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
     * Listado del feed público. Nunca incluye prompt_original/eval_instructions
     * (esas columnas son secreto del juego). Filtros opcionales por dificultad,
     * modo y exclusión de ids ya vistos. `random` mezcla el orden en SQL.
     */
    listarAsync = async ({ dificultad = null, modo = null, excludeIds = [], random = false, limit = 20, offset = 0 } = {}) => {
        const conds = []
        const params = []

        if (dificultad) {
            params.push(dificultad)
            conds.push(`image_diff = $${params.length}`)
        }
        if (modo) {
            params.push(modo)
            conds.push(`modo = $${params.length}`)
        }
        if (Array.isArray(excludeIds) && excludeIds.length > 0) {
            params.push(excludeIds)
            conds.push(`id_imagen <> ALL($${params.length})`)
        }

        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
        const order = random ? 'ORDER BY random()' : 'ORDER BY id_imagen DESC'

        params.push(limit)
        const limitIdx = params.length
        params.push(offset)
        const offsetIdx = params.length

        const result = await pool.query(
            `SELECT id_imagen, url_image, image_diff, theme, modo, company_id
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
