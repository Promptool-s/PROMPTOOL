import pool from '../database/db.js'

/**
 * SQL de torneos e inscripciones. Reemplaza los accesos directos a `torneos` y
 * `torneo_participantes` que hacía TournamentsApp.jsx (listado, chequeo de
 * inscripción, leaderboard e insert de inscripción).
 *
 * NOTA (schema-inferido): columnas tomadas del uso del cliente —
 *   torneos: id_torneo, nombre, descripcion, estado, formato, fecha_inicio,
 *            fecha_fin, premio_descripcion
 *   torneo_participantes: id_torneo, id_usuario, score_total, intentos_completados
 * Validar contra el esquema real antes del E2E.
 */
export default class TorneoRepository {
    getTorneosAsync = async () => {
        const result = await pool.query(
            `SELECT * FROM torneos ORDER BY fecha_inicio ASC`
        )
        return result.rows
    }

    getByIdAsync = async (idTorneo) => {
        const result = await pool.query(
            `SELECT * FROM torneos WHERE id_torneo = $1`, [idTorneo]
        )
        return result.rows[0] ?? null
    }

    /** IDs de torneos en los que el usuario ya está inscripto. */
    getInscripcionesUsuarioAsync = async (idUsuario) => {
        const result = await pool.query(
            `SELECT id_torneo FROM torneo_participantes WHERE id_usuario = $1`,
            [idUsuario]
        )
        return result.rows.map((r) => r.id_torneo)
    }

    getLeaderboardAsync = async (idTorneo, limit = 20) => {
        const result = await pool.query(
            `SELECT tp.id_usuario, tp.score_total, tp.intentos_completados,
                    u.nombre, u.nombre_display, u.username, u.avatar_url
             FROM torneo_participantes tp
             LEFT JOIN usuarios u ON u.id_usuario = tp.id_usuario
             WHERE tp.id_torneo = $1
             ORDER BY tp.score_total DESC NULLS LAST
             LIMIT $2`,
            [idTorneo, limit]
        )
        return result.rows
    }

    /** Inscribe al usuario (idempotente). Devuelve true si insertó una fila nueva. */
    inscribirAsync = async (idTorneo, idUsuario) => {
        const result = await pool.query(
            `INSERT INTO torneo_participantes (id_torneo, id_usuario)
             VALUES ($1, $2)
             ON CONFLICT (id_torneo, id_usuario) DO NOTHING`,
            [idTorneo, idUsuario]
        )
        return result.rowCount > 0
    }
}
