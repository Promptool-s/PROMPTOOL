/**
 * Sistema ELO de PrompTool — portado 1:1 de src/services/eloService.js del
 * frontend. Al correr en el backend, el usuario ya no puede escribir
 * usuarios.elo_rating a mano ni falsificar el delta.
 *
 * El usuario compite contra la imagen: cada imagen tiene un rating implícito
 * según su dificultad y el resultado depende del score, el tiempo y la dificultad.
 */

const IMAGE_RATINGS = {
    easy:   1000,
    medium: 1200,
    hard:   1500,
}

export const ELO_RANKS = [
    { min: 0,    max: 799,  name: 'Aprendiz',          nameEn: 'Apprentice',      color: '#94a3b8' },
    { min: 800,  max: 999,  name: 'Observador',        nameEn: 'Observer',        color: '#64748b' },
    { min: 1000, max: 1199, name: 'Descriptor',        nameEn: 'Descriptor',      color: '#3b82f6' },
    { min: 1200, max: 1399, name: 'Compositor',        nameEn: 'Composer',        color: '#8b5cf6' },
    { min: 1400, max: 1599, name: 'Artista',           nameEn: 'Artist',          color: '#ec4899' },
    { min: 1600, max: 1799, name: 'Visionario',        nameEn: 'Visionary',       color: '#f59e0b' },
    { min: 1800, max: 1999, name: 'Maestro',           nameEn: 'Master',          color: '#ef4444' },
    { min: 2000, max: 9999, name: 'Arquitecto Visual', nameEn: 'Visual Architect', color: '#10b981' },
]

export const getRank = (elo) =>
    ELO_RANKS.find((r) => elo >= r.min && elo <= r.max) || ELO_RANKS[0]

/**
 * Calcula el nuevo ELO después de un intento.
 * @returns {{ newElo: number, delta: number, S: number, E: number, K: number }}
 */
export const calculateElo = ({
    userElo = 1000,
    totalAttempts = 0,
    score,
    difficulty = 'Medium',
    timing = {},
}) => {
    const nd = difficulty.toLowerCase()
    const imageRating = IMAGE_RATINGS[nd] ?? IMAGE_RATINGS.medium

    // ── K dinámico ──
    let K = 32
    if (totalAttempts < 30)  K = 48  // novato: más volátil
    if (totalAttempts > 100) K = 20  // veterano: más estable
    if (nd === 'hard') K *= 1.4
    if (nd === 'easy') K *= 0.7
    K = Math.round(K)

    // ── Resultado esperado (fórmula ELO clásica) ──
    const E = 1 / (1 + Math.pow(10, (imageRating - userElo) / 400))

    // ── Resultado real (S) basado en score ──
    let S
    if (score >= 90)      S = 1.0
    else if (score >= 70) S = 0.75
    else if (score >= 60) S = 0.5
    else if (score >= 40) S = 0.25
    else                  S = 0.0

    // ── Modificador de tiempo ──
    const { elapsedSeconds = 0, recommendedSeconds = 0, penaltyOvertimeSeconds = 0 } = timing

    if (penaltyOvertimeSeconds > 0) {
        S = Math.max(0, S * 0.85)
    }

    // Bonus por velocidad: terminó en <40% del tiempo sugerido con score alto
    if (recommendedSeconds > 0 && elapsedSeconds < recommendedSeconds * 0.4 && score >= 70) {
        S = Math.min(1.0, S + 0.08)
    }

    const delta = Math.round(K * (S - E))
    const newElo = Math.max(100, userElo + delta) // floor en 100

    return { newElo, delta, S: Math.round(S * 100) / 100, E: Math.round(E * 100) / 100, K }
}
