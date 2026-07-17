import TicketRepository from '../repositories/ticketRepository.js'
import UsuarioRepository from '../repositories/usuarioRepository.js'
import { throwError } from '../helpers/httpError.js'
import { isValidString } from '../helpers/validatorHelper.js'
import { nowAR } from '../helpers/dateHelper.js'

/**
 * Reglas de negocio de tickets de soporte. La autorización (dueño del ticket o
 * admin) y el flag es_admin se deciden en el servidor — el cliente ya no puede
 * marcar un mensaje como "de admin" ni leer tickets ajenos.
 */
const ASUNTO_MAX = 140
const MENSAJE_MAX = 4000

export default class TicketService {
    constructor() {
        this.repo = new TicketRepository()
        this.usuarioRepo = new UsuarioRepository()
    }

    getMisTicketsAsync = async (idUsuario) => await this.repo.getByUsuarioAsync(idUsuario)

    getTodosAsync = async () => await this.repo.getTodosAsync()

    crearAsync = async (idUsuario, { asunto, mensaje }) => {
        if (!isValidString(asunto, { min: 1, max: ASUNTO_MAX })) {
            throwError(`El asunto es requerido (máx. ${ASUNTO_MAX} caracteres).`, 400)
        }
        if (!isValidString(mensaje, { min: 1, max: MENSAJE_MAX })) {
            throwError(`El mensaje es requerido (máx. ${MENSAJE_MAX} caracteres).`, 400)
        }
        return await this.repo.createConMensajeAsync({
            idUsuario, asunto: asunto.trim(), mensaje: mensaje.trim(), fecha: nowAR(),
        })
    }

    /** Devuelve los mensajes si el usuario es dueño del ticket o admin. */
    getMensajesAsync = async (idTicket, idUsuario) => {
        await this._assertPuedeVer(idTicket, idUsuario)
        return await this.repo.getMensajesAsync(idTicket)
    }

    /**
     * Agrega una respuesta. es_admin se calcula server-side: es true solo si
     * quien responde es admin y NO es el dueño del ticket (staff respondiendo).
     * Cuando responde el staff, el ticket pasa a 'in_progress'.
     */
    responderAsync = async (idTicket, idUsuario, { mensaje }) => {
        if (!isValidString(mensaje, { min: 1, max: MENSAJE_MAX })) {
            throwError(`El mensaje es requerido (máx. ${MENSAJE_MAX} caracteres).`, 400)
        }
        const ticket = await this.repo.getByIdAsync(idTicket)
        if (!ticket) throwError('El ticket no existe.', 404)

        const esAdmin = await this.usuarioRepo.isAdminAsync(idUsuario)
        const esDueno = ticket.id_usuario === idUsuario
        if (!esAdmin && !esDueno) throwError('No podés responder este ticket.', 403)

        const staffReply = esAdmin && !esDueno
        await this.repo.addMensajeAsync({
            idTicket,
            idUsuario,
            mensaje: mensaje.trim(),
            esAdmin: staffReply,
            estado: staffReply ? 'in_progress' : null,
            fecha: nowAR(),
        })
        return { ok: true }
    }

    cerrarAsync = async (idTicket, idUsuario) => {
        const ticket = await this.repo.getByIdAsync(idTicket)
        if (!ticket) throwError('El ticket no existe.', 404)
        const esAdmin = await this.usuarioRepo.isAdminAsync(idUsuario)
        if (!esAdmin && ticket.id_usuario !== idUsuario) throwError('No podés cerrar este ticket.', 403)
        return await this.repo.setEstadoAsync(idTicket, 'closed', nowAR())
    }

    _assertPuedeVer = async (idTicket, idUsuario) => {
        const ticket = await this.repo.getByIdAsync(idTicket)
        if (!ticket) throwError('El ticket no existe.', 404)
        if (ticket.id_usuario === idUsuario) return
        const esAdmin = await this.usuarioRepo.isAdminAsync(idUsuario)
        if (!esAdmin) throwError('No tenés acceso a este ticket.', 403)
    }
}
