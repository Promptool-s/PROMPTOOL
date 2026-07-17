import NotificacionRepository from '../repositories/notificacionRepository.js'
import UsuarioRepository from '../repositories/usuarioRepository.js'
import { throwError } from '../helpers/httpError.js'

/**
 * Agrega las 4 fuentes de notificaciones en una sola respuesta normalizada.
 * Reemplaza las 4+ queries que Header.jsx hacía directo a Supabase.
 *
 * El backend devuelve DATOS (tipo, payload, read, created_at); los textos
 * i18n de cada notificación siguen componiéndose en el frontend, que ya tiene
 * toda esa lógica de copy por idioma.
 */

const SOURCE_TYPES = new Set(['team_invitation', 'guide_suggestion', 'challenge_notification'])
const MAX_READS_BATCH = 100

export default class NotificacionService {
    constructor() {
        this.repo = new NotificacionRepository()
        this.usuarioRepo = new UsuarioRepository()
    }

    getNotificacionesAsync = async (idUsuario, email) => {
        const [invitaciones, guias, desafios, reads, perfil] = await Promise.all([
            this.repo.getInvitacionesAsync(idUsuario, email ?? null),
            this.repo.getGuideSuggestionsAsync(idUsuario, email ?? null),
            this.repo.getChallengeNotificationsAsync(idUsuario),
            this.repo.getReadsAsync(idUsuario),
            this.usuarioRepo.getByIdAsync(idUsuario),
        ])

        const readSet = new Set(reads.map((r) => `${r.source_type}:${r.source_id}`))
        const items = []

        for (const inv of invitaciones) {
            const esEmpresa = inv.company_id === idUsuario
            const esReceptor = inv.user_id === idUsuario || (!!email && inv.user_email === email)
            items.push({
                source_type: 'team_invitation',
                source_id: String(inv.id),
                read: readSet.has(`team_invitation:${inv.id}`),
                created_at: inv.created_at,
                payload: {
                    id: inv.id,
                    company_id: inv.company_id,
                    user_id: inv.user_id,
                    user_email: inv.user_email,
                    status: inv.status,
                    message: inv.message,
                    es_empresa: esEmpresa,
                    es_receptor: esReceptor,
                    // Si soy el receptor el nombre viene del join; si soy la
                    // empresa, de mi propio perfil (misma regla que Header.jsx)
                    company_name: esEmpresa
                        ? (perfil?.company_name ?? null)
                        : (inv.sender_company_name || inv.sender_nombre_display || perfil?.company_name || null),
                    sender_avatar: inv.sender_avatar_url,
                    sender_verified: inv.sender_verified === true,
                    can_respond: (esEmpresa && inv.status === 'requested') || (esReceptor && inv.status === 'pending'),
                },
            })
        }

        for (const g of guias) {
            items.push({
                source_type: 'guide_suggestion',
                source_id: String(g.id),
                read: readSet.has(`guide_suggestion:${g.id}`),
                created_at: g.created_at,
                payload: {
                    id: g.id,
                    title: g.title,
                    message: g.message,
                    guide_slug: g.guide_slug,
                    guide_url: g.guide_url,
                    // Header.jsx detecta la respuesta a reportes por el título
                    es_respuesta_reporte: g.title === 'Respuesta a tu reporte' || g.title === 'Report response',
                },
            })
        }

        for (const c of desafios) {
            items.push({
                source_type: 'challenge_notification',
                source_id: String(c.id),
                read: readSet.has(`challenge_notification:${c.id}`),
                created_at: c.created_at,
                payload: {
                    id: c.id,
                    challenge_id: c.challenge_id,
                    title: c.title,
                    message: c.message,
                    company_name: c.company_name,
                    company_avatar: c.company_avatar_url,
                    company_verified: c.company_verified === true,
                    challenge_image: c.url_image,
                    challenge_theme: c.image_theme,
                    challenge_diff: c.image_diff,
                },
            })
        }

        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return items
    }

    /** Marca leídas un batch de notificaciones del PROPIO usuario. */
    marcarLeidasAsync = async (idUsuario, items) => {
        if (!Array.isArray(items) || items.length === 0) {
            throwError('items debe ser un array con al menos una notificación.', 400)
        }
        if (items.length > MAX_READS_BATCH) {
            throwError(`Máximo ${MAX_READS_BATCH} notificaciones por request.`, 400)
        }
        const safeItems = items.map((item) => {
            const sourceType = item?.source_type
            const sourceId = String(item?.source_id ?? '')
            if (!SOURCE_TYPES.has(sourceType) || !sourceId || sourceId.length > 60) {
                throwError('Cada item necesita source_type válido y source_id.', 400)
            }
            return { source_type: sourceType, source_id: sourceId }
        })
        const marked = await this.repo.upsertReadsAsync(idUsuario, safeItems)
        return { ok: true, marked }
    }
}
