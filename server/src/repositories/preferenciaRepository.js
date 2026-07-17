import pool from '../database/db.js'

/**
 * SQL sobre `user_preferences` (privacidad/visual). PK = user_id.
 * Reemplaza el upsert/select directo de ConfigModal.jsx.
 */
export default class PreferenciaRepository {
    getByUsuarioAsync = async (userId) => {
        const result = await pool.query(
            `SELECT hide_from_ranking, incognito_mode, no_prompt_history, visual_mode
             FROM user_preferences WHERE user_id = $1`,
            [userId]
        )
        return result.rows[0] ?? null
    }

    /** Upsert de las columnas provistas (ya filtradas por el Service). */
    upsertAsync = async (userId, fields, fecha) => {
        const cols = Object.keys(fields)
        const insertCols = ['user_id', ...cols, 'updated_at']
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ')
        const updates = [...cols, 'updated_at'].map((c) => `${c} = EXCLUDED.${c}`).join(', ')
        const values = [userId, ...cols.map((c) => fields[c]), fecha]

        const result = await pool.query(
            `INSERT INTO user_preferences (${insertCols.join(', ')})
             VALUES (${placeholders})
             ON CONFLICT (user_id) DO UPDATE SET ${updates}
             RETURNING hide_from_ranking, incognito_mode, no_prompt_history, visual_mode`,
            values
        )
        return result.rows[0] ?? null
    }
}
