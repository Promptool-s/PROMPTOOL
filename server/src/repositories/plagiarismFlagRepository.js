/**
 * SQL sobre la tabla `plagiarism_flags`.
 * Convención: los errores de infraestructura se propagan; `null` = no encontrado.
 */
export default class PlagiarismFlagRepository {
    /** Inserta un flag dentro de la transacción del intento. */
    createWithClientAsync = async (flag, client) => {
        const result = await client.query(
            `INSERT INTO plagiarism_flags
                (id_usuario, id_imagen, prompt_snapshot, score, elapsed_seconds,
                 reasons, severity, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                flag.id_usuario,
                flag.id_imagen,
                flag.prompt_snapshot,
                flag.score,
                flag.elapsed_seconds,
                JSON.stringify(flag.reasons ?? []),
                flag.severity,
                flag.created_at,
            ]
        )
        return result.rows[0] ?? null
    }

    /** Total de flags acumulados por el usuario (para la suspensión progresiva). */
    countByUsuarioWithClientAsync = async (idUsuario, client) => {
        const result = await client.query(
            `SELECT COUNT(*)::int AS total FROM plagiarism_flags WHERE id_usuario = $1`,
            [idUsuario]
        )
        return result.rows[0]?.total ?? 0
    }
}
