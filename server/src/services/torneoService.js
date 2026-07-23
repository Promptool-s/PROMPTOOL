import TorneoRepository from '../repositories/torneoRepository.js'
import { throwError } from '../helpers/httpError.js'

/**
 * Torneos: listado, inscripción y leaderboard. La inscripción setea id_usuario
 * desde el JWT (nunca del body) y valida el estado del torneo server-side —
 * antes el cliente insertaba directo en `torneo_participantes`.
 */
export default class TorneoService {
    constructor() {
        this.repo = new TorneoRepository()
    }

    getTorneosAsync = async () => await this.repo.getTorneosAsync()

    getMisInscripcionesAsync = async (idUsuario) =>
        await this.repo.getInscripcionesUsuarioAsync(idUsuario)

    /** Leaderboard con la forma que espera el cliente: usuarios anidado. */
    getLeaderboardAsync = async (idTorneo) => {
        const rows = await this.repo.getLeaderboardAsync(idTorneo, 20)
        return rows.map((r) => ({
            id_usuario: r.id_usuario,
            score_total: r.score_total,
            intentos_completados: r.intentos_completados,
            usuarios: {
                nombre: r.nombre,
                nombre_display: r.nombre_display,
                username: r.username,
                avatar_url: r.avatar_url,
            },
        }))
    }

    inscribirAsync = async (idTorneo, idUsuario) => {
        const torneo = await this.repo.getByIdAsync(idTorneo)
        if (!torneo) throwError('El torneo no existe.', 404)
        const estado = String(torneo.estado ?? '').toLowerCase()
        if (estado !== 'upcoming' && estado !== 'active') {
            throwError('Las inscripciones para este torneo están cerradas.', 409)
        }
        const inserted = await this.repo.inscribirAsync(idTorneo, idUsuario)
        return { registered: true, nuevo: inserted }
    }
}
