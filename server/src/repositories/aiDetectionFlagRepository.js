/**
 * SQL sobre la tabla `ai_detection_flags`.
 * Convención: los errores de infraestructura se propagan; `null` = no encontrado.
 */
export default class AiDetectionFlagRepository {
    /** Inserta un flag dentro de la transacción del intento. */
    createWithClientAsync = async (flag, client) => {
        const result = await client.query(
            `INSERT INTO ai_detection_flags
                (id_usuario, prompt_snapshot, score, elapsed_seconds,
                 detections, confidence, severity, typing_report, focus_report, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id`,
            [
                flag.id_usuario,
                flag.prompt_snapshot,
                flag.score,
                flag.elapsed_seconds,
                JSON.stringify(flag.detections ?? []),
                flag.confidence,
                flag.severity,
                flag.typing_report ? JSON.stringify(flag.typing_report) : null,
                flag.focus_report ? JSON.stringify(flag.focus_report) : null,
                flag.created_at,
            ]
        )
        return result.rows[0] ?? null
    }

    /** Flags del usuario en los últimos `dias` días (ventana de reincidencia). */
    countRecientesWithClientAsync = async (idUsuario, dias, client) => {
        const result = await client.query(
            `SELECT COUNT(*)::int AS total FROM ai_detection_flags
             WHERE id_usuario = $1 AND created_at >= NOW() - ($2 || ' days')::interval`,
            [idUsuario, dias]
        )
        return result.rows[0]?.total ?? 0
    }
}
