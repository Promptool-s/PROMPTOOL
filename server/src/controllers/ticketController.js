import { Router } from 'express'
import TicketService from '../services/ticketService.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { adminMiddleware } from '../middlewares/adminMiddleware.js'
import { throwError } from '../helpers/httpError.js'
import { isValidPk } from '../helpers/validatorHelper.js'

const router = Router()
const svc = new TicketService()

// Todos los endpoints de tickets requieren sesión.
router.use(authMiddleware)

/** GET /api/tickets — tickets propios. */
router.get('', async (req, res) => {
    const data = await svc.getMisTicketsAsync(req.usuario.id)
    res.status(200).json(data)
})

/** GET /api/tickets/todos — todos los tickets (solo admin). */
router.get('/todos', adminMiddleware, async (req, res) => {
    const data = await svc.getTodosAsync()
    res.status(200).json(data)
})

/** POST /api/tickets — crea un ticket con su primer mensaje. */
router.post('', async (req, res) => {
    const { asunto, mensaje } = req.body ?? {}
    const data = await svc.crearAsync(req.usuario.id, { asunto, mensaje })
    res.status(201).json(data)
})

/** GET /api/tickets/:id/mensajes — mensajes (dueño o admin). */
router.get('/:id/mensajes', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de ticket no es válido.', 400)
    const data = await svc.getMensajesAsync(req.params.id, req.usuario.id)
    res.status(200).json(data)
})

/** POST /api/tickets/:id/mensajes — responder (dueño o admin; es_admin server-side). */
router.post('/:id/mensajes', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de ticket no es válido.', 400)
    const data = await svc.responderAsync(req.params.id, req.usuario.id, { mensaje: req.body?.mensaje })
    res.status(201).json(data)
})

/** PATCH /api/tickets/:id/cerrar — cerrar ticket (dueño o admin). */
router.patch('/:id/cerrar', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de ticket no es válido.', 400)
    const data = await svc.cerrarAsync(req.params.id, req.usuario.id)
    res.status(200).json(data)
})

export default router
