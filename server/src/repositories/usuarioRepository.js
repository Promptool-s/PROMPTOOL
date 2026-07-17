import pool from '../database/db.js'

/**
 * Única capa con SQL sobre la tabla `usuarios`. 100% parametrizado.
 * Convención de errores: `null` = no encontrado; los errores de infraestructura
 * se PROPAGAN (no se absorben) y el errorHandler global los traduce a 500.
 */
export default class UsuarioRepository {
    getByIdAsync = async (idUsuario) => {
        const result = await pool.query(
            `SELECT * FROM usuarios WHERE id_usuario = $1`,
            [idUsuario]
        )
        return result.rows[0] ?? null
    }

    /** Campos públicos del perfil (sin flags internos ni datos de moderación). */
    getPerfilPublicoAsync = async (idUsuario) => {
        const result = await pool.query(
            `SELECT id_usuario, nombre, nombre_display, username, avatar_url, bio,
                    accent_color, elo_rating, total_intentos, ranked_count,
                    promedio_score, mejor_score, porcentaje_aprobacion, racha_actual,
                    verified, company_name, show_company_badge
             FROM usuarios WHERE id_usuario = $1`,
            [idUsuario]
        )
        return result.rows[0] ?? null
    }

    /** Busca por username (case-insensitive). Para login-by-username y perfiles. */
    getByUsernameAsync = async (username) => {
        const result = await pool.query(
            `SELECT id_usuario, nombre, nombre_display, username, avatar_url, bio,
                    accent_color, elo_rating, total_intentos, ranked_count,
                    promedio_score, mejor_score, porcentaje_aprobacion, racha_actual,
                    verified, company_name, show_company_badge, email
             FROM usuarios WHERE lower(username) = lower($1)`,
            [username]
        )
        return result.rows[0] ?? null
    }

    /** Busca por email (para resolver invitaciones a usuarios existentes). */
    getByEmailAsync = async (email) => {
        const result = await pool.query(
            `SELECT id_usuario, email, nombre_display, username FROM usuarios
             WHERE lower(email) = lower($1)`,
            [email]
        )
        return result.rows[0] ?? null
    }

    /** ¿Existe ya un usuario con ese username? (chequeo de disponibilidad). */
    usernameExistsAsync = async (username) => {
        const result = await pool.query(
            `SELECT 1 FROM usuarios WHERE lower(username) = lower($1) LIMIT 1`,
            [username]
        )
        return result.rowCount > 0
    }

    /**
     * Crea el perfil si no existe (idempotente vía ON CONFLICT DO NOTHING).
     * El id y el email salen del JWT verificado, no del body del cliente.
     * Reemplaza el upsert/insert de perfil que hacía useAuth.js en el cliente.
     */
    crearPerfilSiNoExisteAsync = async (perfil) => {
        const result = await pool.query(
            `INSERT INTO usuarios (id_usuario, email, nombre, nombre_display, username, avatar_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id_usuario) DO NOTHING
             RETURNING id_usuario`,
            [
                perfil.id_usuario,
                perfil.email ?? null,
                perfil.nombre ?? null,
                perfil.nombre_display ?? null,
                perfil.username ?? null,
                perfil.avatar_url ?? null,
            ]
        )
        // rowCount 0 = ya existía (no es error): devolvemos el existente
        return result.rows[0]?.id_usuario ?? perfil.id_usuario
    }

    isAdminAsync = async (idUsuario) => {
        const result = await pool.query(
            `SELECT adminstate FROM usuarios WHERE id_usuario = $1`,
            [idUsuario]
        )
        return result.rows[0]?.adminstate === true
    }

    // ── Operaciones de administración ────────────────────────────────────────

    /** Flags booleanos que un admin puede togglear (whitelist anti-inyección). */
    static ADMIN_FLAGS = new Set(['adminstate', 'verified', 'devstate'])

    /**
     * Listado admin con búsqueda opcional por nombre/username/email.
     * Devuelve columnas de gestión (incluye flags internos, a diferencia del
     * perfil público).
     */
    adminListAsync = async ({ search = null, limit = 50, offset = 0 } = {}) => {
        const params = []
        let where = ''
        if (search) {
            params.push(`%${search}%`)
            where = `WHERE (nombre ILIKE $1 OR username ILIKE $1 OR email ILIKE $1)`
        }
        params.push(limit)
        const limitIdx = params.length
        params.push(offset)
        const offsetIdx = params.length
        const result = await pool.query(
            `SELECT id_usuario, nombre, nombre_display, username, email, avatar_url,
                    elo_rating, total_intentos, ranked_count, adminstate, devstate,
                    verified, suspension_status, suspension_until, company_name
             FROM usuarios
             ${where}
             ORDER BY nombre NULLS LAST
             LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            params
        )
        return result.rows
    }

    /** Togglea un flag booleano permitido. `campo` debe estar en ADMIN_FLAGS. */
    adminSetFlagAsync = async (idUsuario, campo, valor) => {
        if (!UsuarioRepository.ADMIN_FLAGS.has(campo)) {
            throw Object.assign(new Error(`Campo no permitido: ${campo}`), { statusCode: 400 })
        }
        const result = await pool.query(
            `UPDATE usuarios SET ${campo} = $2 WHERE id_usuario = $1
             RETURNING id_usuario, ${campo}`,
            [idUsuario, valor]
        )
        return result.rows[0] ?? null
    }

    getSuspensionAsync = async (idUsuario) => {
        const result = await pool.query(
            `SELECT suspension_status, suspension_reason, suspension_until
             FROM usuarios WHERE id_usuario = $1`,
            [idUsuario]
        )
        return result.rows[0] ?? null
    }

    clearSuspensionAsync = async (idUsuario) => {
        await pool.query(
            `UPDATE usuarios SET suspension_status = 'none', suspension_until = NULL
             WHERE id_usuario = $1`,
            [idUsuario]
        )
    }

    /**
     * Update de perfil con whitelist de columnas construida por el Service.
     * `fields` ya viene filtrado — acá solo se arma el SET parametrizado.
     */
    updatePerfilAsync = async (idUsuario, fields) => {
        const keys = Object.keys(fields)
        if (keys.length === 0) return null
        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ')
        const result = await pool.query(
            `UPDATE usuarios SET ${setClause} WHERE id_usuario = $1 RETURNING id_usuario`,
            [idUsuario, ...keys.map((k) => fields[k])]
        )
        return result.rows[0] ?? null
    }

    // ── Variantes transaccionales (reciben client) ───────────────────────────

    /** Bloquea la fila del usuario durante la transacción de ELO (evita carreras). */
    getForUpdateWithClientAsync = async (idUsuario, client) => {
        const result = await client.query(
            `SELECT id_usuario, elo_rating, total_intentos, ranked_count
             FROM usuarios WHERE id_usuario = $1 FOR UPDATE`,
            [idUsuario]
        )
        return result.rows[0] ?? null
    }

    updateEloWithClientAsync = async (idUsuario, nuevoElo, client) => {
        await client.query(
            `UPDATE usuarios SET elo_rating = $2 WHERE id_usuario = $1`,
            [idUsuario, nuevoElo]
        )
    }

    /**
     * Incrementa contadores de forma ATÓMICA en SQL.
     * Reemplaza el read-modify-write del frontend (App.jsx), que tenía
     * condición de carrera entre pestañas/requests.
     */
    incrementarContadoresWithClientAsync = async (idUsuario, { total = 0, ranked = 0 }, client) => {
        await client.query(
            `UPDATE usuarios
             SET total_intentos = COALESCE(total_intentos, 0) + $2,
                 ranked_count   = COALESCE(ranked_count, 0) + $3
             WHERE id_usuario = $1`,
            [idUsuario, total, ranked]
        )
    }

    /**
     * Escribe la suspensión progresiva del anti-cheat dentro de la transacción
     * del intento. NUNCA degrada: un 'banned' no baja a 'warned' aunque el
     * conteo de flags de esta pasada sea menor.
     */
    setSuspensionWithClientAsync = async (idUsuario, { status, reason = null, until = null }, client) => {
        await client.query(
            `UPDATE usuarios
             SET suspension_status = $2,
                 suspension_reason = COALESCE($3, suspension_reason),
                 suspension_until  = $4
             WHERE id_usuario = $1
               AND (CASE COALESCE(suspension_status, 'none')
                        WHEN 'banned' THEN 3
                        WHEN 'suspended' THEN 2
                        WHEN 'warned' THEN 1
                        ELSE 0 END)
                 < (CASE $2 WHEN 'banned' THEN 3 WHEN 'suspended' THEN 2 WHEN 'warned' THEN 1 ELSE 0 END)`,
            [idUsuario, status, reason, until]
        )
    }
}
