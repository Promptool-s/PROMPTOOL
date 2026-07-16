import PreferenciaRepository from '../repositories/preferenciaRepository.js'
import { throwError } from '../helpers/httpError.js'
import { nowAR } from '../helpers/dateHelper.js'

/**
 * Preferencias de privacidad/visualización del usuario. Whitelist de columnas;
 * el cliente ya no hace upsert directo a `user_preferences`.
 */
const BOOL_FIELDS = ['hide_from_ranking', 'incognito_mode', 'no_prompt_history']
const VISUAL_MODES = ['normal', 'sakura', 'dark', 'light', 'default']

export default class PreferenciaService {
    constructor() {
        this.repo = new PreferenciaRepository()
    }

    getAsync = async (userId) => {
        const prefs = await this.repo.getByUsuarioAsync(userId)
        return prefs ?? {
            hide_from_ranking: false,
            incognito_mode: false,
            no_prompt_history: false,
            visual_mode: null,
        }
    }

    updateAsync = async (userId, body = {}) => {
        const fields = {}
        for (const key of BOOL_FIELDS) {
            if (body[key] !== undefined) {
                if (typeof body[key] !== 'boolean') throwError(`${key} debe ser booleano.`, 400)
                fields[key] = body[key]
            }
        }
        if (body.visual_mode !== undefined) {
            if (body.visual_mode !== null && !VISUAL_MODES.includes(String(body.visual_mode))) {
                throwError('visual_mode no válido.', 400)
            }
            fields.visual_mode = body.visual_mode
        }
        if (Object.keys(fields).length === 0) throwError('No hay preferencias para actualizar.', 400)

        return await this.repo.upsertAsync(userId, fields, nowAR())
    }
}
