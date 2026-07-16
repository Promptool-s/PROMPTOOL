import pool from '../database/db.js'

/**
 * Invoca las funciones RPC SECURITY DEFINER existentes en Supabase
 * (`accept_team_invitation`, `create_custom_role`, ...) desde el backend.
 *
 * Esas funciones usan `auth.uid()` internamente, que en Supabase se resuelve
 * leyendo `current_setting('request.jwt.claims')` — el mismo mecanismo que usa
 * PostgREST. Acá replicamos eso: dentro de una transacción se setea el claim
 * con `set_config(..., true)` (transaction-local, se limpia solo en el COMMIT/
 * ROLLBACK) y se llama a la función. Así la lógica y las validaciones de las
 * RPCs se reusan tal cual, sin portarlas, pero con el `sub` que YA VERIFICÓ el
 * authMiddleware — el cliente no puede falsear su identidad.
 *
 * Whitelist estricta de funciones y sus argumentos nombrados: nada del cliente
 * llega a la construcción del SQL (los nombres salen de este mapa; los valores
 * van parametrizados).
 */
const RPC_WHITELIST = {
    accept_team_invitation: ['invitation_id'],
    accept_company_invite: ['invitation_id'],
    join_company_by_link: ['p_company_id'],
    leave_company: [],
    create_custom_role: ['role_name', 'role_description', 'role_color'],
    delete_custom_role: ['role_name'],
    assign_company_role: ['target_user_id', 'role'],
    remove_team_member: ['target_user_id'],
    set_company_display_name: ['target_user_id', 'display_name'],
    create_enterprise_guide: ['title', 'summary', 'content', 'accent', 'keywords'],
    assign_guide_to_members: ['guide_id', 'member_ids', 'due_date', 'notes'],
    update_guide_progress: ['guide_id', 'section_id', 'completed', 'data'],
}

export default class SupabaseRpcRepository {
    /**
     * @param {string} fnName - nombre de la RPC (debe estar en la whitelist)
     * @param {object} args - argumentos nombrados; los que falten van NULL
     * @param {{ id: string, email?: string|null }} usuario - identidad verificada por el authMiddleware
     * @returns el valor devuelto por la función (fila única o escalar)
     */
    callAsUserAsync = async (fnName, args, usuario) => {
        const argNames = RPC_WHITELIST[fnName]
        if (!argNames) {
            throw Object.assign(new Error(`RPC no permitida: ${fnName}`), { statusCode: 400 })
        }

        const claims = JSON.stringify({
            sub: usuario.id,
            email: usuario.email ?? undefined,
            role: 'authenticated',
        })

        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            // Claims transaction-local: auth.uid() dentro de la RPC devuelve
            // usuario.id. NO se cambia el role de la conexión — las funciones
            // SECURITY DEFINER corren con los privilegios de su owner igual.
            await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims])

            const params = argNames.map((name) => args?.[name] ?? null)
            const placeholders = argNames.map((name, i) => `${name} := $${i + 1}`).join(', ')
            const result = await client.query(
                `SELECT ${fnName}(${placeholders}) AS resultado`,
                params
            )

            await client.query('COMMIT')
            return result.rows[0]?.resultado ?? null
        } catch (error) {
            try { await client.query('ROLLBACK') } catch (e) { console.error('ROLLBACK falló:', e) }
            // Los RAISE EXCEPTION de las RPCs son errores de negocio legibles
            // (p. ej. 'Already member'). Se exponen con 422 para que el
            // frontend pueda mostrarlos, salvo que ya traigan statusCode.
            if (!error.statusCode && error.code === 'P0001') {
                error.statusCode = 422
            }
            throw error
        } finally {
            client.release()
        }
    }
}
