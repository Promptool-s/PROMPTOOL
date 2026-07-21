import pool from '../database/db.js'
import IntentoRepository from '../repositories/intentoRepository.js'
import ImagenRepository from '../repositories/imagenRepository.js'
import UsuarioRepository from '../repositories/usuarioRepository.js'
import EvaluacionService from './evaluacionService.js'
import PlagiarismService from './plagiarismService.js'
import AiDetectionService, {
    sanitizeTypingReport, sanitizeFocusReport, sanitizeClipReport,
} from './aiDetectionService.js'
import { calculateElo } from './eloService.js'
import { getProgressiveTime, getGraceSeconds, getTimePenalty } from './timingService.js'
import { nowAR } from '../helpers/dateHelper.js'
import { clamp } from '../helpers/validatorHelper.js'
import { throwError } from '../helpers/httpError.js'
import { MODOS_RANKED, MIN_INTENTOS_PARA_ELO, SUSPENSION } from '../constants/index.js'

/**
 * Orquestador del flujo de un intento — el corazón de la migración.
 *
 * Reemplaza el pipeline que vivía repartido en App.jsx + geminiService +
 * eloService del frontend, donde el cliente calculaba su propio score y
 * escribía su propio ELO. Acá el cliente solo aporta su prompt y metadatos;
 * todo lo que vale puntos se decide en el servidor y se persiste en UNA
 * transacción.
 */
export default class IntentoService {
    constructor() {
        this.intentoRepo = new IntentoRepository()
        this.imagenRepo = new ImagenRepository()
        this.usuarioRepo = new UsuarioRepository()
        this.evaluacionService = new EvaluacionService()
        this.plagiarismService = new PlagiarismService()
        this.aiDetectionService = new AiDetectionService()
    }

    /** Bloquea intentos de usuarios suspendidos/baneados (antes era checkSuspension en el cliente). */
    _verificarSuspensionAsync = async (idUsuario) => {
        const susp = await this.usuarioRepo.getSuspensionAsync(idUsuario)
        if (!susp?.suspension_status || susp.suspension_status === SUSPENSION.NONE) return

        if (susp.suspension_status === SUSPENSION.BANNED) {
            throwError(susp.suspension_reason || 'Cuenta suspendida permanentemente.', 403)
        }
        if (susp.suspension_status === SUSPENSION.SUSPENDED) {
            const until = susp.suspension_until ? new Date(susp.suspension_until) : null
            if (until && until > new Date()) {
                throwError(susp.suspension_reason || 'Cuenta suspendida temporalmente.', 403)
            }
            // Suspensión expirada — limpiar y dejar pasar
            await this.usuarioRepo.clearSuspensionAsync(idUsuario)
        }
    }

    /**
     * @param {object} params
     * @param {string|null} params.idUsuario - null para guests
     * @param {string|number} params.idImagen
     * @param {string} params.promptUsuario
     * @param {string} params.modo - 'random' | 'daily' | 'challenge' | 'enterprise'
     * @param {number} params.elapsedSeconds - reportado por el cliente (clampeado)
     * @param {number} params.attemptNumber - intento 1..N sobre esta imagen
     * @param {string|null} params.appLang - 'es' | 'en'
     * @param {string|number|null} params.challengeId
     * @param {object|null} params.typingReport - señal anti-cheat del cliente (se sanitiza acá)
     * @param {object|null} params.focusReport - señal anti-cheat del cliente (se sanitiza acá)
     * @param {object|null} params.clipReport - señal anti-cheat del cliente (se sanitiza acá)
     */
    crearIntentoAsync = async ({
        idUsuario,
        idImagen,
        promptUsuario,
        modo = 'random',
        elapsedSeconds = 0,
        attemptNumber = 1,
        appLang = null,
        challengeId = null,
        typingReport = null,
        focusReport = null,
        clipReport = null,
        ranked = true,
    }) => {
        // ── 1. Cargar la imagen (el prompt original NUNCA viene del cliente) ──
        const imagen = await this.imagenRepo.getByIdAsync(idImagen)
        if (!imagen) throwError('La imagen no existe.', 404)
        if (!imagen.prompt_original) throwError('La imagen no tiene prompt para evaluar.', 422)

        if (idUsuario) await this._verificarSuspensionAsync(idUsuario)

        const difficulty = imagen.image_diff || 'Medium'

        // ── 2. Timing calculado en el servidor ──
        const recommendedSeconds = getProgressiveTime(attemptNumber, difficulty)
        const graceSeconds = getGraceSeconds(recommendedSeconds, difficulty)
        const timePenalty = getTimePenalty({ elapsedSeconds, recommendedSeconds }, difficulty, modo)
        const penaltyOvertimeSeconds = Math.max(0, elapsedSeconds - recommendedSeconds - graceSeconds)

        // ── 3. Evaluación con LLM + scoring determinístico (server-side) ──
        const evaluacion = await this.evaluacionService.evaluarAsync({
            userPrompt: promptUsuario,
            originalPrompt: imagen.prompt_original,
            difficulty,
            appLang,
            evalInstructions: imagen.challenge_eval_instructions || null,
        })

        const scoreAntesDeAntiCheat = clamp(evaluacion.score - timePenalty.penalty)

        // ── 4. Anti-cheat: antiplagio + detección de IA (server-side) ──
        // Análisis puro acá (fuera de la transacción); las escrituras de flags
        // y suspensión progresiva van DENTRO de la transacción del intento.
        // Solo aplica a usuarios logueados: un guest no acumula historial ni ELO.
        let plagio = { suspicious: false, reasons: [], severity: 'none' }
        let deteccionIA = { isAI: false, confidence: 0, reasons: [], severity: 'none' }
        let aiPenalty = 0
        const safeTyping = sanitizeTypingReport(typingReport)
        const safeFocus = sanitizeFocusReport(focusReport)
        const safeClip = sanitizeClipReport(clipReport)
        let intentosPrevios = []

        if (idUsuario) {
            intentosPrevios = await this.intentoRepo.getUltimosAsync(idUsuario, { limit: 20 })

            deteccionIA = this.aiDetectionService.analizar({
                prompt: promptUsuario,
                elapsedSeconds,
                typingReport: safeTyping,
                focusReport: safeFocus,
                clipReport: safeClip,
                intentosPrevios,
            })
            // Penalidad inmediata sobre el score de este intento, además del
            // flag + escalada de suspensión (reemplaza el aiPenalty que antes
            // calculaba y restaba el cliente).
            if (deteccionIA.isAI) {
                aiPenalty = deteccionIA.severity === 'high' ? 40 : deteccionIA.severity === 'medium' ? 20 : 10
            }
        }

        const finalScore = clamp(scoreAntesDeAntiCheat - aiPenalty)

        if (idUsuario) {
            plagio = this.plagiarismService.analizar({
                prompt: promptUsuario,
                score: finalScore,
                elapsedSeconds,
                difficulty,
                idImagen,
                esDesafioEmpresa: imagen.company_id != null,
                intentosPrevios,
            })
        }

        // ── 5. Persistencia transaccional: intento + contadores + ELO + flags ──
        // `ranked` es un opt-out del cliente (toggle "modo rankeado" del jugador):
        // solo puede restar elegibilidad, nunca sumarla más allá de lo que ya
        // permiten modo/challenge/usuario.
        const esRankeable = MODOS_RANKED.includes(modo) && !challengeId && !!idUsuario && ranked !== false

        const client = await pool.connect()
        let idIntento = null
        let eloResult = null
        let isImprovement = true
        let suspensionEscalada = null

        try {
            await client.query('BEGIN')

            if (idUsuario) {
                const mejorPrevio = await this.intentoRepo.getMejorPuntajeAsync(idUsuario, idImagen)
                isImprovement = mejorPrevio === null || finalScore > Number(mejorPrevio)
            }

            const isRanked = esRankeable && isImprovement

            const creado = await this.intentoRepo.createWithClientAsync({
                prompt_usuario: promptUsuario,
                puntaje_similitud: finalScore,
                id_imagen: idImagen,
                id_usuario: idUsuario,
                fecha_hora: nowAR(),
                strengths: evaluacion.strengths,
                improvements: evaluacion.improvements,
                modo,
                elo_delta: null,
                is_ranked: isRanked,
                tiempo_respuesta: elapsedSeconds > 0 ? elapsedSeconds : null,
                attempt_number: attemptNumber,
                tiempo_asignado: recommendedSeconds,
                eficiencia: elapsedSeconds > 0
                    ? Math.round((finalScore / elapsedSeconds) * 100) / 100
                    : null,
            }, client)
            idIntento = creado?.id_intento ?? null

            if (idUsuario && isImprovement) {
                await this.usuarioRepo.incrementarContadoresWithClientAsync(idUsuario, {
                    total: 1,
                    ranked: isRanked ? 1 : 0,
                }, client)
            }

            // ── ELO: solo intentos rankeados y con historial mínimo ──
            if (isRanked) {
                const usuario = await this.usuarioRepo.getForUpdateWithClientAsync(idUsuario, client)
                if (usuario) {
                    const rankedCount = await this.intentoRepo.countRankedWithClientAsync(idUsuario, client)
                    if (rankedCount >= MIN_INTENTOS_PARA_ELO) {
                        const { newElo, delta } = calculateElo({
                            userElo: usuario.elo_rating ?? 1000,
                            totalAttempts: rankedCount,
                            score: finalScore,
                            difficulty,
                            timing: { elapsedSeconds, recommendedSeconds, penaltyOvertimeSeconds },
                        })
                        await this.usuarioRepo.updateEloWithClientAsync(idUsuario, newElo, client)
                        if (idIntento) {
                            await this.intentoRepo.setEloDeltaWithClientAsync(idIntento, delta, client)
                        }
                        eloResult = { newElo, delta }
                    }
                }
            }

            // ── Flags anti-cheat + suspensión progresiva (misma transacción) ──
            if (idUsuario && plagio.suspicious) {
                const { nuevoEstado } = await this.plagiarismService.registrarFlagWithClientAsync({
                    idUsuario,
                    idImagen,
                    prompt: promptUsuario,
                    score: finalScore,
                    elapsedSeconds,
                    reasons: plagio.reasons,
                    severity: plagio.severity,
                }, client)
                if (nuevoEstado) suspensionEscalada = nuevoEstado
            }

            if (idUsuario && deteccionIA.isAI) {
                await this.aiDetectionService.registrarFlagWithClientAsync({
                    idUsuario,
                    prompt: promptUsuario,
                    score: finalScore,
                    elapsedSeconds,
                    deteccion: deteccionIA,
                    typingReport: safeTyping,
                    focusReport: safeFocus,
                }, client)
            }

            await client.query('COMMIT')
        } catch (error) {
            try { await client.query('ROLLBACK') } catch (e) { console.error('ROLLBACK falló:', e) }
            throw error
        } finally {
            client.release()
        }

        // ── 6. Respuesta al cliente — sin prompt_original, sin datos internos ──
        // No se exponen las razones de detección (enseñarían a evadirla); solo
        // se avisa si el estado de la cuenta escaló por acumulación de flags.
        return {
            idIntento,
            score: finalScore,
            criteria: evaluacion.criteria,
            explanation: evaluacion.explanation,
            strengths: evaluacion.strengths,
            improvements: evaluacion.improvements,
            suggestions: evaluacion.suggestions,
            timePenalty: { penalty: timePenalty.penalty, message: timePenalty.message },
            isImprovement,
            elo: eloResult, // null si no aplica (guest, challenge, <5 rankeados)
            // No se exponen las razones/confianza de la detección — solo lo mínimo
            // para que el cliente muestre el aviso de penalidad aplicada.
            aiCheat: deteccionIA.isAI ? { penalty: aiPenalty, severity: deteccionIA.severity } : null,
            moderacion: suspensionEscalada
                ? {
                    estado: suspensionEscalada,
                    mensaje: suspensionEscalada === SUSPENSION.WARNED
                        ? 'Detectamos actividad inusual en tu cuenta. Si se repite, podría ser suspendida.'
                        : 'Tu cuenta fue suspendida por actividad sospechosa reiterada.',
                }
                : null,
        }
    }

    getHistorialAsync = async (idUsuario, { limit, offset }) =>
        await this.intentoRepo.getByUsuarioAsync(idUsuario, { limit, offset })
}
