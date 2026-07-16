import pool from '../database/db.js'

/**
 * SQL sobre `tickets` y `ticket_mensajes`.
 * Reemplaza los accesos directos de SupportApp.jsx y la parte de tickets de
 * AdminApp.jsx.
 */
export default class TicketRepository {
    getByUsuarioAsync = async (idUsuario) => {
        const result = await pool.query(
            `SELECT * FROM tickets WHERE id_usuario = $1 ORDER BY updated_at DESC NULLS LAST`,
            [idUsuario]
        )
        return result.rows
    }

    /** Listado admin con datos del autor. */
    getTodosAsync = async () => {
        const result = await pool.query(
            `SELECT t.*,
                    u.nombre, u.nombre_display, u.email, u.avatar_url
             FROM tickets t
             LEFT JOIN usuarios u ON u.id_usuario = t.id_usuario
             ORDER BY t.updated_at DESC NULLS LAST`
        )
        return result.rows
    }

    getByIdAsync = async (idTicket) => {
        const result = await pool.query(
            `SELECT * FROM tickets WHERE id_ticket = $1`,
            [idTicket]
        )
        return result.rows[0] ?? null
    }

    getMensajesAsync = async (idTicket) => {
        const result = await pool.query(
            `SELECT m.*,
                    u.nombre, u.nombre_display, u.avatar_url
             FROM ticket_mensajes m
             LEFT JOIN usuarios u ON u.id_usuario = m.id_usuario
             WHERE m.id_ticket = $1
             ORDER BY m.created_at ASC`,
            [idTicket]
        )
        return result.rows
    }

    /** Crea ticket + primer mensaje en una transacción. */
    createConMensajeAsync = async ({ idUsuario, asunto, mensaje, fecha }) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const t = await client.query(
                `INSERT INTO tickets (id_usuario, asunto, estado, created_at, updated_at)
                 VALUES ($1, $2, 'open', $3, $3)
                 RETURNING *`,
                [idUsuario, asunto, fecha]
            )
            const ticket = t.rows[0]
            await client.query(
                `INSERT INTO ticket_mensajes (id_ticket, id_usuario, mensaje, es_admin, created_at)
                 VALUES ($1, $2, $3, false, $4)`,
                [ticket.id_ticket, idUsuario, mensaje, fecha]
            )
            await client.query('COMMIT')
            return ticket
        } catch (error) {
            try { await client.query('ROLLBACK') } catch (e) { console.error('ROLLBACK falló:', e) }
            throw error
        } finally {
            client.release()
        }
    }

    /** Agrega un mensaje y actualiza el ticket (updated_at + estado opcional). */
    addMensajeAsync = async ({ idTicket, idUsuario, mensaje, esAdmin, estado, fecha }) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            await client.query(
                `INSERT INTO ticket_mensajes (id_ticket, id_usuario, mensaje, es_admin, created_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [idTicket, idUsuario, mensaje, esAdmin, fecha]
            )
            if (estado) {
                await client.query(
                    `UPDATE tickets SET estado = $2, updated_at = $3 WHERE id_ticket = $1`,
                    [idTicket, estado, fecha]
                )
            } else {
                await client.query(
                    `UPDATE tickets SET updated_at = $2 WHERE id_ticket = $1`,
                    [idTicket, fecha]
                )
            }
            await client.query('COMMIT')
        } catch (error) {
            try { await client.query('ROLLBACK') } catch (e) { console.error('ROLLBACK falló:', e) }
            throw error
        } finally {
            client.release()
        }
    }

    setEstadoAsync = async (idTicket, estado, fecha) => {
        const result = await pool.query(
            `UPDATE tickets SET estado = $2, updated_at = $3 WHERE id_ticket = $1
             RETURNING id_ticket, estado`,
            [idTicket, estado, fecha]
        )
        return result.rows[0] ?? null
    }
}
