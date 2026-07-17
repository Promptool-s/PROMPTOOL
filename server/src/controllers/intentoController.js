import { Router } from 'express'
import IntentoService from '../services/intentoService.js'
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware.js'
import { evaluationLimiter } from '../middlewares/rateLimiterMiddleware.js'
import { throwError } from '../helpers/httpError.js'
import { isValidString, isValidPk, clampInt } from '../helpers/validatorHelper.js'
import { MODOS_INTENTO, LIMITES } from '../constants/index.js'

const router = Router()
const svc = new IntentoService()

/**
 * POST /api/intentos — enviar un intento.
 * Auth opcional: los guests pueden jugar (id_usuario null, nunca rankea).
 * Reemplaza al flujo del frontend que llamaba a Groq + insertaba en
 * `intentos` + actualizaba ELO por su cuenta.
 */
router.post('', optionalAuthMiddleware, evaluationLimiter, async (req, res) => {
    const {
        id_imagen, prompt_usuario, modo, elapsed_seconds, attempt_number, lang, challenge_id,
        typing_report, focus_report, clip_report,
    } = req.body

    if (!isValidPk(id_imagen)) throwError('id_imagen es requerido.', 400)
    if (!isValidString(prompt_usuario, { min: 1, max: LIMITES.PROMPT_MAX_CHARS })) {
        throwError(`El prompt es requerido (máx. ${LIMITES.PROMPT_MAX_CHARS} caracteres).`, 400)
    }
    const modoFinal = MODOS_INTENTO.includes(modo) ? modo : 'random'

    const resultado = await svc.crearIntentoAsync({
        idUsuario: req.usuario?.id ?? null,
        idImagen: id_imagen,
        promptUsuario: prompt_usuario.trim(),
        modo: modoFinal,
        elapsedSeconds: clampInt(elapsed_seconds, 0, LIMITES.ELAPSED_MAX_SECONDS, 0),
        attemptNumber: clampInt(attempt_number, 1, LIMITES.ATTEMPT_NUMBER_MAX, 1),
        appLang: lang === 'en' ? 'en' : lang === 'es' ? 'es' : null,
        challengeId: challenge_id ?? null,
        // Señales anti-cheat opcionales del cliente — el Service las sanitiza
        // campo por campo (whitelist numérica) antes de usarlas.
        typingReport: typing_report ?? null,
        focusReport: focus_report ?? null,
        clipReport: clip_report ?? null,
    })

    res.status(201).json(resultado)
})

/** GET /api/intentos/mios — historial del usuario autenticado. */
router.get('/mios', authMiddleware, async (req, res) => {
    const limit = clampInt(req.query.limit, 1, 100, 50)
    const offset = clampInt(req.query.offset, 0, 100_000, 0)
    const data = await svc.getHistorialAsync(req.usuario.id, { limit, offset })
    res.status(200).json(data)
})

export default router
