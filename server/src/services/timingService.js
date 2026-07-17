/**
 * Reglas de tiempo del juego — portadas de PromptInput.jsx y App.jsx.
 * Al calcularse en el servidor, el tiempo recomendado y la penalización por
 * overtime ya no dependen de valores que el cliente pueda inventar.
 *
 * Limitación conocida (fase 1): elapsedSeconds sigue siendo reportado por el
 * cliente. Para blindarlo del todo habría que trackear el inicio del intento
 * server-side (fase 2). Mientras tanto se clampa a rangos sanos.
 */

const normalizeDifficulty = (difficulty = 'Medium') => String(difficulty).toLowerCase()

// T(i) = T_max - ((i-1)/(N-1))^α * (T_max - T_min) — N=5, α=1.3
const N_ATTEMPTS = 5
const ALPHA = 1.3

const ATTEMPT_TIME_CONFIG = {
    //          T_max  T_min  targetWords  graceRatio
    easy:   { tMax: 150, tMin: 75,  targetWords: 14, graceRatio: 0.22 },
    medium: { tMax: 210, tMin: 100, targetWords: 20, graceRatio: 0.20 },
    hard:   { tMax: 270, tMin: 120, targetWords: 28, graceRatio: 0.18 },
}

/** Tiempo recomendado (segundos) para el intento i (1-based). */
export const getProgressiveTime = (attemptNumber = 1, difficulty = 'Medium') => {
    const nd = normalizeDifficulty(difficulty)
    const cfg = ATTEMPT_TIME_CONFIG[nd] || ATTEMPT_TIME_CONFIG.medium
    const i = Math.max(1, Math.min(attemptNumber, N_ATTEMPTS))
    const t = cfg.tMax - Math.pow((i - 1) / (N_ATTEMPTS - 1), ALPHA) * (cfg.tMax - cfg.tMin)
    return Math.round(t)
}

export const getGraceSeconds = (recommendedSeconds, difficulty = 'Medium') => {
    const nd = normalizeDifficulty(difficulty)
    const cfg = ATTEMPT_TIME_CONFIG[nd] || ATTEMPT_TIME_CONFIG.medium
    return Math.round(recommendedSeconds * cfg.graceRatio)
}

const formatDuration = (seconds) => {
    const safe = Math.max(0, Math.round(seconds))
    const mins = Math.floor(safe / 60)
    const secs = safe % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
}

/** Penalización de score por exceder el tiempo recomendado (port de App.jsx). */
export const getTimePenalty = ({ elapsedSeconds = 0, recommendedSeconds = 0 }, difficulty = 'Medium', mode = 'random') => {
    if (!recommendedSeconds || elapsedSeconds <= recommendedSeconds) {
        return { penalty: 0, message: '' }
    }
    const overtimeSeconds = elapsedSeconds - recommendedSeconds
    const overtimeRatio = overtimeSeconds / Math.max(recommendedSeconds, 1)
    const nd = normalizeDifficulty(difficulty)
    const difficultyFactor = nd === 'easy' ? 0.85 : nd === 'hard' ? 1.2 : 1.05
    const modeFactor = mode === 'daily' ? 1.12 : 0.95
    const penalty = Math.min(30, Math.max(4, Math.round((overtimeRatio * 22 + overtimeSeconds / 18) * difficultyFactor * modeFactor)))
    return {
        penalty,
        message: `Tardaste demasiado (${formatDuration(overtimeSeconds)} extra). Se descontaron ${penalty} puntos por exceder el tiempo recomendado.`,
    }
}
