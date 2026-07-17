import PlagiarismFlagRepository from '../repositories/plagiarismFlagRepository.js'
import UsuarioRepository from '../repositories/usuarioRepository.js'
import {
    textSimilarity, cosineSimilarity, fingerprint, fingerprintSimilarity,
} from '../helpers/textSimilarityHelper.js'
import { nowAR } from '../helpers/dateHelper.js'
import { SUSPENSION } from '../constants/index.js'

/**
 * Sistema antiplagio server-side — portado de plagiarismService.js del
 * frontend, donde el propio cliente decidía si se flageaba a sí mismo
 * (trivialmente evadible). Acá todas las señales se calculan con datos que ya
 * están en el servidor (prompt recibido + historial en BD).
 *
 * Capas:
 *  1. Tiempo de respuesta sospechoso (score alto en tiempo imposible)
 *  2. Similitud con intentos anteriores del usuario en OTRAS imágenes
 *     (Levenshtein + cosine + fingerprint estructural)
 *  3. Acumulación de flags → suspensión progresiva (warned → suspended → banned)
 *
 * En desafíos de empresa (imagen con company_id) no se aplica la capa de
 * similitud: el organizador puede testear con el mismo prompt legítimamente.
 */
const THRESHOLDS = {
    // Tiempo mínimo razonable en segundos según dificultad
    minTime: { easy: 8, medium: 12, hard: 18 },
    // Score mínimo para que el tiempo bajo sea sospechoso
    minScoreForTimeSuspicion: 75,
    // Similitudes con intentos anteriores que disparan flag
    textSimilarityFlag: 0.82,
    cosineSimilarityFlag: 0.88,
    fingerprintFlag: 0.80,
    // Flags acumulados → escalera de suspensión
    flagsForWarning: 2,
    flagsForSuspension: 5,
    flagsForBan: 10,
    // Días de suspensión temporal
    suspensionDays: 7,
}

const PROMPT_SNAPSHOT_MAX = 500

export default class PlagiarismService {
    constructor() {
        this.flagRepo = new PlagiarismFlagRepository()
        this.usuarioRepo = new UsuarioRepository()
    }

    /**
     * Análisis puro (sin escrituras): decide si el intento es sospechoso.
     * `intentosPrevios` viene del orquestador (ya leído de BD) para no duplicar
     * queries entre este análisis y el de detección de IA.
     *
     * @returns {{ suspicious: boolean, reasons: string[], severity: 'none'|'low'|'medium'|'high' }}
     */
    analizar = ({ prompt, score, elapsedSeconds, difficulty = 'Medium', idImagen = null, esDesafioEmpresa = false, intentosPrevios = [] }) => {
        if (!prompt) return { suspicious: false, reasons: [], severity: 'none' }

        const reasons = []
        const nd = String(difficulty).toLowerCase()

        // ── 1. Tiempo sospechoso ──
        const minTime = THRESHOLDS.minTime[nd] ?? THRESHOLDS.minTime.medium
        if (elapsedSeconds > 0 && elapsedSeconds < minTime && score >= THRESHOLDS.minScoreForTimeSuspicion) {
            reasons.push(`response_time:${elapsedSeconds}s`)
        }

        // ── 2. Similitud con intentos anteriores (solo fuera de modo empresa) ──
        // Se descarta la imagen actual: repetir prompt sobre la misma imagen es
        // un retry normal, no plagio.
        const previos = idImagen != null
            ? intentosPrevios.filter((p) => String(p.id_imagen) !== String(idImagen))
            : intentosPrevios

        if (!esDesafioEmpresa && previos.length) {
            const fpCurrent = fingerprint(prompt)
            let maxTextSim = 0, maxCosine = 0, maxFp = 0

            for (const prev of previos) {
                if (!prev.prompt_usuario) continue
                maxTextSim = Math.max(maxTextSim, textSimilarity(prompt, prev.prompt_usuario))
                maxCosine = Math.max(maxCosine, cosineSimilarity(prompt, prev.prompt_usuario))
                maxFp = Math.max(maxFp, fingerprintSimilarity(fpCurrent, fingerprint(prev.prompt_usuario)))
            }

            if (maxTextSim >= THRESHOLDS.textSimilarityFlag)
                reasons.push(`text_similarity:${Math.round(maxTextSim * 100)}%`)
            if (maxCosine >= THRESHOLDS.cosineSimilarityFlag)
                reasons.push(`cosine_similarity:${Math.round(maxCosine * 100)}%`)
            if (maxFp >= THRESHOLDS.fingerprintFlag)
                reasons.push(`fingerprint:${Math.round(maxFp * 100)}%`)
        }

        if (!reasons.length) return { suspicious: false, reasons: [], severity: 'none' }

        const severity = reasons.length >= 3 ? 'high' : reasons.length === 2 ? 'medium' : 'low'
        return { suspicious: true, reasons, severity }
    }

    /**
     * Persiste el flag y aplica la suspensión progresiva DENTRO de la
     * transacción del intento (client compartido).
     *
     * @returns {{ totalFlags: number, nuevoEstado: string|null }} nuevoEstado
     *          solo si esta pasada escaló el status del usuario.
     */
    registrarFlagWithClientAsync = async ({ idUsuario, idImagen, prompt, score, elapsedSeconds, reasons, severity }, client) => {
        await this.flagRepo.createWithClientAsync({
            id_usuario: idUsuario,
            id_imagen: idImagen,
            prompt_snapshot: prompt.slice(0, PROMPT_SNAPSHOT_MAX),
            score,
            elapsed_seconds: elapsedSeconds,
            reasons,
            severity,
            created_at: nowAR(),
        }, client)

        const totalFlags = await this.flagRepo.countByUsuarioWithClientAsync(idUsuario, client)

        let nuevoEstado = null
        if (totalFlags >= THRESHOLDS.flagsForBan) {
            nuevoEstado = SUSPENSION.BANNED
            await this.usuarioRepo.setSuspensionWithClientAsync(idUsuario, {
                status: SUSPENSION.BANNED,
                reason: 'Múltiples detecciones de plagio',
                until: null, // permanente
            }, client)
        } else if (totalFlags >= THRESHOLDS.flagsForSuspension) {
            nuevoEstado = SUSPENSION.SUSPENDED
            await this.usuarioRepo.setSuspensionWithClientAsync(idUsuario, {
                status: SUSPENSION.SUSPENDED,
                reason: 'Comportamiento sospechoso detectado',
                until: new Date(Date.now() + THRESHOLDS.suspensionDays * 24 * 60 * 60 * 1000).toISOString(),
            }, client)
        } else if (totalFlags >= THRESHOLDS.flagsForWarning) {
            nuevoEstado = SUSPENSION.WARNED
            await this.usuarioRepo.setSuspensionWithClientAsync(idUsuario, {
                status: SUSPENSION.WARNED,
            }, client)
        }

        return { totalFlags, nuevoEstado }
    }
}
