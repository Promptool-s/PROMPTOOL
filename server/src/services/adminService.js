import UsuarioRepository from '../repositories/usuarioRepository.js'
import { throwError } from '../helpers/httpError.js'

/**
 * Operaciones de administración. Reemplaza el CRUD directo de AdminApp.jsx
 * (toggles de adminstate/verified/devstate) y ELIMINA por diseño el "SQL runner"
 * (rpc exec_sql): acá no hay endpoint genérico de SQL ni de tabla dinámica.
 */
export default class AdminService {
    constructor() {
        this.usuarioRepo = new UsuarioRepository()
    }

    listarUsuariosAsync = async ({ search, limit, offset } = {}) =>
        await this.usuarioRepo.adminListAsync({ search, limit, offset })

    /**
     * Togglea un flag de usuario. Solo se permiten adminstate/verified/devstate
     * (whitelist en el repo). Nunca elo_rating, contadores, ni columnas arbitrarias.
     */
    setFlagUsuarioAsync = async (idUsuario, campo, valor) => {
        if (typeof valor !== 'boolean') throwError('El valor debe ser booleano.', 400)
        const CAMPOS = ['adminstate', 'verified', 'devstate']
        if (!CAMPOS.includes(campo)) throwError(`Campo no editable: ${campo}.`, 400)

        const updated = await this.usuarioRepo.adminSetFlagAsync(idUsuario, campo, valor)
        if (!updated) throwError('Usuario no encontrado.', 404)
        return updated
    }

    /**
     * Sobrescritura manual de stats por un admin (override del panel de perfil).
     * Whitelist estricta de columnas numéricas; nada de elo ni flags internos.
     */
    setStatsUsuarioAsync = async (idUsuario, body = {}) => {
        const COLS = [
            'total_intentos', 'promedio_score', 'mejor_score', 'peor_score',
            'porcentaje_aprobacion', 'racha_actual',
        ]
        const stats = {}
        for (const col of COLS) {
            if (body[col] === undefined) continue
            const n = Number.parseInt(body[col], 10)
            if (!Number.isFinite(n) || n < 0) throwError(`${col} debe ser un entero ≥ 0.`, 400)
            stats[col] = n
        }
        if (Object.keys(stats).length === 0) throwError('No hay stats para actualizar.', 400)

        const updated = await this.usuarioRepo.adminSetStatsAsync(idUsuario, stats)
        if (!updated) throwError('Usuario no encontrado.', 404)
        return updated
    }
}
