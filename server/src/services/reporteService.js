import ReporteRepository from '../repositories/reporteRepository.js'
import EmpresaRepository from '../repositories/empresaRepository.js'
import { throwError } from '../helpers/httpError.js'
import { isValidString } from '../helpers/validatorHelper.js'
import { nowAR } from '../helpers/dateHelper.js'

/**
 * Reportes de imágenes/usuarios. Creación abierta (usuario o guest); la gestión
 * (estado, notas de review, borrado) es solo de admin.
 */
const TARGET_TYPES = ['image', 'user']
const ESTADOS = ['pending', 'reviewed', 'dismissed', 'actioned']
const REASON_MAX = 1000

export default class ReporteService {
    constructor() {
        this.repo = new ReporteRepository()
        this.empresaRepo = new EmpresaRepository()
    }

    crearAsync = async ({ reporterId = null, targetType, targetId = null, reason }) => {
        if (!TARGET_TYPES.includes(targetType)) throwError('Tipo de reporte no válido.', 400)
        if (!isValidString(reason, { min: 1, max: REASON_MAX })) {
            throwError('El motivo del reporte es requerido.', 400)
        }
        const created = await this.repo.createAsync({
            reporterId,
            targetType,
            targetId: targetType === 'image' ? (targetId ?? null) : (targetId ?? null),
            reason: reason.trim(),
            fecha: nowAR(),
        })
        return { id: created?.id ?? null, ok: true }
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    listarAsync = async () => await this.repo.adminListAsync({ limit: 100 })

    actualizarAsync = async (id, reviewerId, { status, reviewerNotes }) => {
        if (!ESTADOS.includes(status)) throwError('Estado no válido.', 400)
        const updated = await this.repo.adminUpdateAsync(id, {
            status, reviewerId, reviewerNotes: reviewerNotes ?? null, fecha: nowAR(),
        })
        if (!updated) throwError('Reporte no encontrado.', 404)

        // Notificar al reporter la respuesta del staff (mismo carrier
        // guide_suggestions que usaba AdminApp.jsx). El título fijo es la
        // marca que Header.jsx usa para detectar respuestas a reportes.
        if (status === 'reviewed' && updated.reporter_id && isValidString(reviewerNotes, { min: 1, max: 1000 })) {
            await this.empresaRepo.insertGuideSuggestionsAsync([{
                target_user_id: updated.reporter_id,
                target_email: null,
                title: 'Respuesta a tu reporte',
                message: reviewerNotes.trim(),
                guide_slug: null,
                guide_url: null,
                created_at: nowAR(),
            }]).catch((err) => console.error('[reportes] notificación al reporter falló:', err.message))
        }
        return updated
    }

    eliminarAsync = async (id) => {
        const ok = await this.repo.adminDeleteAsync(id)
        if (!ok) throwError('Reporte no encontrado.', 404)
        return { ok: true }
    }
}
