import AiDetectionFlagRepository from '../repositories/aiDetectionFlagRepository.js'
import { nowAR } from '../helpers/dateHelper.js'
import { clamp } from '../helpers/validatorHelper.js'

/**
 * Detección de prompts generados por IA / copy-paste — portado de
 * aiDetectionService.js del frontend.
 *
 * Señales server-side (autoritativas, el cliente no puede falsearlas):
 *  - velocidad global (longitud del prompt vs. tiempo del intento)
 *  - patrones de texto típicos de IA (frases, estructura, sobrecarga técnica)
 *  - complejidad y diversidad léxica
 *  - patrón histórico (salto brusco de longitud) y consistencia temporal
 *    (ráfagas de intentos), contra el historial en BD
 *
 * Señales client-side (typing_report / focus_report / clip_report): se aceptan
 * como evidencia ADICIONAL — un cliente tramposo puede omitirlas o falsearlas
 * "en limpio", por eso solo suman sospecha, nunca la restan.
 *
 * Bugs corregidos respecto del original: el patrón de transcripción leía
 * `s.pauses` (variable inexistente — ahora `pause_durations` del reporte) y el
 * umbral final usaba `confidence` sin definir (ahora `avgConfidence`).
 */

const AI_PATTERNS = {
    // Frases comunes de ChatGPT/Claude
    commonPhrases: [
        'as an ai', 'i cannot', 'i apologize', "it's important to note",
        'it is worth noting', 'in conclusion', 'to summarize', 'in summary',
        'overall', 'furthermore', 'moreover', 'additionally', 'consequently',
        'therefore', 'thus', 'hence',
    ],
    // Estructuras muy formales (poco naturales para un juego)
    formalStructures: [
        /^(the|a|an)\s+\w+\s+(is|are|was|were)\s+depicted/i,
        /featuring\s+\w+\s+and\s+\w+/i,
        /showcasing\s+\w+/i,
        /illustrating\s+\w+/i,
        /demonstrating\s+\w+/i,
        /portraying\s+\w+/i,
    ],
    // Listas muy estructuradas (típico de IA)
    structuredLists: [
        /\d+\.\s+\w+/g,              // "1. item, 2. item"
        /\w+:\s+\w+,\s+\w+:\s+\w+/g, // "key: value, key: value"
    ],
    // Exceso de adjetivos técnicos
    technicalOverload: [
        'photorealistic', 'hyperrealistic', 'ultra-detailed', 'high-resolution',
        'professional', 'masterpiece', 'award-winning', 'trending on artstation',
        'octane render', 'unreal engine',
    ],
}

const PROMPT_SNAPSHOT_MAX = 500
const REINCIDENCIA_DIAS = 7
const REINCIDENCIA_WARN = 3
const REINCIDENCIA_BLOCK = 5

// ── Sanitización de señales del cliente (whitelist numérica) ─────────────────

const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : 0)

/** Whitelist estricta del typing_report — nada del cliente pasa sin acotar. */
export const sanitizeTypingReport = (raw) => {
    if (!raw || typeof raw !== 'object') return null
    return {
        total_keys: num(raw.total_keys ?? raw.totalKeys, 0, 100_000),
        total_time_seconds: num(raw.total_time_seconds ?? raw.totalTimeSeconds, 0, 86_400),
        corrections: num(raw.corrections, 0, 100_000),
        pause_count: num(raw.pause_count ?? raw.pauseCount, 0, 10_000),
        burst_count: num(raw.burst_count ?? raw.burstCount, 0, 10_000),
        final_length: num(raw.final_length ?? raw.finalLength, 0, 100_000),
        max_length: num(raw.max_length ?? raw.maxLength, 0, 100_000),
        avg_chars_per_second: num(raw.avg_chars_per_second ?? raw.avgCharsPerSecond, 0, 1_000),
        inter_key_variance_ms: num(raw.inter_key_variance_ms ?? raw.interKeyVarianceMs, 0, 60_000),
        correction_ratio: num(raw.correction_ratio ?? raw.correctionRatio, 0, 1),
        edit_ratio: num(raw.edit_ratio ?? raw.editRatio, 0, 1),
        pause_durations: (Array.isArray(raw.pause_durations ?? raw.pauseDurations)
            ? (raw.pause_durations ?? raw.pauseDurations) : [])
            .slice(0, 200)
            .map((p) => num(p, 0, 3_600_000)),
        clipboard_changed_before_typing: (raw.clipboard_changed_before_typing ?? raw.clipboardChangedBeforeTyping) === true,
    }
}

export const sanitizeFocusReport = (raw) => {
    if (!raw || typeof raw !== 'object') return null
    return {
        screenshot_like_count: num(raw.screenshot_like_count ?? raw.screenshotLikeCount, 0, 1_000),
        long_absence_count: num(raw.long_absence_count ?? raw.longAbsenceCount, 0, 1_000),
        early_absence_count: num(raw.early_absence_count ?? raw.earlyAbsenceCount, 0, 1_000),
    }
}

export const sanitizeClipReport = (raw) => {
    if (!raw || typeof raw !== 'object') return null
    return {
        has_image: raw.has_image === true || raw.hasImage === true,
        similar_to_game: raw.similar_to_game === true || raw.similarToGame === true,
        similarity: num(raw.similarity, 0, 1),
    }
}

// ── Analizadores (funciones puras a nivel de módulo) ─────────────────────────

/** Velocidad global: fallback autoritativo cuando no hay typing_report. */
const analyzeTypingSpeed = (promptLength, elapsedSeconds) => {
    const charsPerMinute = (promptLength / Math.max(elapsedSeconds, 1)) * 60

    // >400 cpm sostenido es casi imposible pensando a la vez
    if (charsPerMinute > 400) {
        return { suspicious: true, reason: 'typing_too_fast', confidence: Math.min((charsPerMinute - 400) / 200, 1) }
    }
    // Texto largo casi instantáneo = paste
    if (promptLength > 80 && elapsedSeconds > 0 && elapsedSeconds < 5) {
        return { suspicious: true, reason: 'long_text_instant', confidence: 0.95 }
    }
    return { suspicious: false, reason: '', confidence: 0 }
}

/** Señales del comportamiento real de tipeo (keystroke a keystroke). */
const analyzeTypingBehavior = (r) => {
    if (!r) return { suspicious: false, reasons: [], confidence: 0 }

    const reasons = []
    let confidence = 0

    // 1. Sin correcciones en texto largo → paste/IA
    if (r.final_length > 60 && r.corrections === 0) {
        reasons.push('no_corrections')
        confidence += 0.5
    } else if (r.final_length > 120 && r.corrections <= 1) {
        reasons.push('almost_no_corrections')
        confidence += 0.3
    }

    // 2. Sin pausas de pensamiento en texto largo
    if (r.final_length > 80 && r.pause_count === 0) {
        reasons.push('no_pauses')
        confidence += 0.4
    }

    // 3. Varianza de inter-key timing robótica
    if (r.total_keys > 20 && r.inter_key_variance_ms > 0 && r.inter_key_variance_ms < 30) {
        reasons.push('robotic_key_timing')
        confidence += 0.6
    } else if (r.total_keys > 20 && r.inter_key_variance_ms > 0 && r.inter_key_variance_ms < 60) {
        reasons.push('low_key_variance')
        confidence += 0.3
    }

    // 4. Bursts sin correcciones ni pausas = paste fragmentado
    if (r.burst_count >= 3 && r.corrections === 0 && r.pause_count === 0) {
        reasons.push('burst_no_corrections')
        confidence += 0.5
    }

    // 5. Velocidad sostenida muy alta
    if (r.avg_chars_per_second > 6 && r.final_length > 60) {
        reasons.push('sustained_high_speed')
        confidence += Math.min((r.avg_chars_per_second - 6) / 4, 0.5)
    }

    // 6. Nunca borró nada
    if (r.edit_ratio === 0 && r.correction_ratio === 0 && r.final_length > 50) {
        reasons.push('zero_edit_ratio')
        confidence += 0.25
    }

    // 7. Patrón de transcripción: bursts + pausas muy regulares (mira otra pantalla)
    if (r.pause_durations.length >= 3 && r.burst_count >= 3) {
        const mean = r.pause_durations.reduce((a, b) => a + b, 0) / r.pause_durations.length
        const variance = r.pause_durations.reduce((a, b) => a + (b - mean) ** 2, 0) / r.pause_durations.length
        if (Math.sqrt(variance) < mean * 0.4) {
            reasons.push('transcription_pattern')
            confidence += 0.45
        }
    }

    // 8. El texto apareció sin ser tipeado tecla a tecla (autocomplete/paste)
    if (r.final_length > 40 && r.total_keys < r.final_length * 0.4) {
        reasons.push('keys_vs_length_mismatch')
        confidence += 0.7
    }

    return { suspicious: confidence >= 0.5 || reasons.length >= 2, reasons, confidence: Math.min(confidence, 1) }
}

/** Frases y patrones típicos de texto generado por IA. */
const detectAIPatterns = (prompt) => {
    const lower = prompt.toLowerCase()
    const matches = []

    for (const phrase of AI_PATTERNS.commonPhrases) {
        if (lower.includes(phrase)) matches.push(`phrase:${phrase}`)
    }
    for (const pattern of AI_PATTERNS.formalStructures) {
        if (pattern.test(prompt)) matches.push(`formal_structure:${pattern.source.slice(0, 30)}`)
    }
    for (const pattern of AI_PATTERNS.structuredLists) {
        const found = prompt.match(pattern)
        if (found && found.length >= 3) matches.push(`structured_list:${found.length}_items`)
    }
    for (const term of AI_PATTERNS.technicalOverload) {
        if (lower.includes(term)) matches.push(`technical:${term}`)
    }

    return {
        suspicious: matches.length >= 2,
        matches,
        confidence: matches.length > 0 ? Math.min(matches.length / 5, 1) : 0,
    }
}

/** Complejidad y estructura del texto. */
const analyzeComplexity = (prompt) => {
    const words = prompt.trim().split(/\s+/)
    const sentences = prompt.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1)

    if (avgWordsPerSentence > 25) {
        return { suspicious: true, reason: 'overly_complex_sentences', confidence: Math.min((avgWordsPerSentence - 25) / 20, 1) }
    }

    const uniqueWords = new Set(words.map((w) => w.toLowerCase()))
    const lexicalDiversity = uniqueWords.size / words.length
    if (lexicalDiversity > 0.85 && words.length > 30) {
        return { suspicious: true, reason: 'unnaturally_high_lexical_diversity', confidence: (lexicalDiversity - 0.85) / 0.15 }
    }

    const commaRatio = (prompt.match(/,/g) || []).length / words.length
    if (commaRatio > 0.15) {
        return { suspicious: true, reason: 'excessive_comma_usage', confidence: Math.min((commaRatio - 0.15) / 0.1, 1) }
    }

    return { suspicious: false, reason: '', confidence: 0 }
}

/** Salto brusco de longitud respecto del historial del usuario. */
const analyzeBehaviorPattern = (intentosPrevios, currentPrompt) => {
    const history = intentosPrevios.slice(0, 10)
    if (history.length < 3) return { suspicious: false, reason: '', confidence: 0 }

    const avgLength = history.reduce((sum, h) => sum + (h.prompt_usuario?.length || 0), 0) / history.length
    if (currentPrompt.length > avgLength * 2.5 && avgLength > 50) {
        return {
            suspicious: true,
            reason: 'sudden_length_increase',
            confidence: Math.min((currentPrompt.length / avgLength - 2.5) / 2, 1),
        }
    }
    return { suspicious: false, reason: '', confidence: 0 }
}

/** Ráfagas de intentos: 3+ en los últimos 5 minutos. */
const analyzeTemporalConsistency = (intentosPrevios) => {
    const recent = intentosPrevios.slice(0, 5)
    if (recent.length < 2) return { suspicious: false, reason: '', confidence: 0 }

    const now = Date.now()
    const recentAttempts = recent.filter((r) => {
        const t = new Date(r.fecha_hora).getTime()
        return Number.isFinite(t) && (now - t) / 60_000 < 5
    })

    if (recentAttempts.length >= 3) {
        return { suspicious: true, reason: 'rapid_fire_attempts', confidence: Math.min(recentAttempts.length / 5, 1) }
    }
    return { suspicious: false, reason: '', confidence: 0 }
}

// ── Service ──────────────────────────────────────────────────────────────────

export default class AiDetectionService {
    constructor() {
        this.flagRepo = new AiDetectionFlagRepository()
    }

    /**
     * Análisis puro (sin escrituras). Los reportes deben venir YA sanitizados
     * (sanitizeTypingReport/sanitizeFocusReport/sanitizeClipReport).
     *
     * @returns {{ isAI: boolean, confidence: number, reasons: string[], severity: 'none'|'low'|'medium'|'high' }}
     */
    analizar = ({ prompt, elapsedSeconds, typingReport = null, focusReport = null, clipReport = null, intentosPrevios = [] }) => {
        if (!prompt) return { isAI: false, confidence: 0, reasons: [], severity: 'none' }

        const detections = []
        let totalConfidence = 0

        // 1. Comportamiento de tipeo real (señal más fuerte, peso 1.5x)
        if (typingReport) {
            const behavior = analyzeTypingBehavior(typingReport)
            if (behavior.suspicious) {
                detections.push(...behavior.reasons)
                totalConfidence += behavior.confidence * 1.5
            }
            if (typingReport.clipboard_changed_before_typing) {
                detections.push('clipboard_changed_before_typing')
                totalConfidence += 0.6
            }
        }

        // 2. Foco de ventana (screenshots / consultas externas)
        if (focusReport) {
            if (focusReport.screenshot_like_count >= 1) {
                detections.push(`screenshot_like_absence:${focusReport.screenshot_like_count}`)
                totalConfidence += Math.min(focusReport.screenshot_like_count * 0.35, 0.7)
            }
            if (focusReport.long_absence_count >= 1) {
                detections.push(`long_absence:${focusReport.long_absence_count}`)
                totalConfidence += Math.min(focusReport.long_absence_count * 0.4, 0.8)
            }
            if (focusReport.early_absence_count >= 1) {
                detections.push('early_focus_loss')
                totalConfidence += 0.5
            }
            if (focusReport.screenshot_like_count >= 3) {
                detections.push('multiple_screenshots')
                totalConfidence += 0.4
            }
        }

        // 3. Clipboard con la imagen del juego (chequeo perceptual del cliente)
        if (clipReport?.similar_to_game) {
            detections.push(`clipboard_game_image:${Math.round(clipReport.similarity * 100)}%`)
            totalConfidence += 0.6
        }

        // 4. Velocidad global (autoritativa — no depende del cliente)
        const speed = analyzeTypingSpeed(prompt.length, elapsedSeconds)
        if (speed.suspicious) {
            detections.push(speed.reason)
            totalConfidence += speed.confidence
        }

        // 5. Patrones de IA en el texto
        const patterns = detectAIPatterns(prompt)
        if (patterns.suspicious) {
            detections.push(...patterns.matches)
            totalConfidence += patterns.confidence
        }

        // 6. Complejidad
        const complexity = analyzeComplexity(prompt)
        if (complexity.suspicious) {
            detections.push(complexity.reason)
            totalConfidence += complexity.confidence
        }

        // 7. Historial: salto de longitud + ráfagas
        const behaviorHistory = analyzeBehaviorPattern(intentosPrevios, prompt)
        if (behaviorHistory.suspicious) {
            detections.push(behaviorHistory.reason)
            totalConfidence += behaviorHistory.confidence
        }
        const temporal = analyzeTemporalConsistency(intentosPrevios)
        if (temporal.suspicious) {
            detections.push(temporal.reason)
            totalConfidence += temporal.confidence
        }

        const avgConfidence = detections.length > 0 ? totalConfidence / detections.length : 0

        let severity = 'none'
        if (avgConfidence >= 0.7 || detections.length >= 4) severity = 'high'
        else if (avgConfidence >= 0.5 || detections.length >= 3) severity = 'medium'
        else if (avgConfidence >= 0.3 || detections.length >= 2) severity = 'low'

        // Umbral final: 1 señal fuerte o 2 señales débiles
        const isAI = avgConfidence >= 0.5 || detections.length >= 2

        return { isAI, confidence: avgConfidence, reasons: detections, severity }
    }

    /**
     * Persiste el flag dentro de la transacción del intento y devuelve la
     * reincidencia de los últimos 7 días (para que el orquestador decida).
     *
     * @returns {{ countReciente: number, shouldWarn: boolean, shouldBlock: boolean }}
     */
    registrarFlagWithClientAsync = async ({ idUsuario, prompt, score, elapsedSeconds, deteccion, typingReport, focusReport }, client) => {
        await this.flagRepo.createWithClientAsync({
            id_usuario: idUsuario,
            prompt_snapshot: prompt.slice(0, PROMPT_SNAPSHOT_MAX),
            score,
            elapsed_seconds: elapsedSeconds,
            detections: deteccion.reasons,
            confidence: deteccion.confidence,
            severity: deteccion.severity,
            typing_report: typingReport,
            focus_report: focusReport,
            created_at: nowAR(),
        }, client)

        const countReciente = await this.flagRepo.countRecientesWithClientAsync(idUsuario, REINCIDENCIA_DIAS, client)
        return {
            countReciente,
            shouldWarn: countReciente >= REINCIDENCIA_WARN,
            shouldBlock: countReciente >= REINCIDENCIA_BLOCK,
        }
    }
}
