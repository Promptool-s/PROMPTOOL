/**
 * Utilidades puras de similitud de texto para el sistema antiplagio.
 * Portado de src/services/plagiarismService.js del frontend — acá solo vive
 * la matemática; las reglas de negocio están en services/plagiarismService.js.
 */

export const normalize = (text = '') =>
    text.toLowerCase().replace(/[^a-záéíóúñ\s]/gi, '').replace(/\s+/g, ' ').trim()

export const tokenize = (text = '') =>
    normalize(text).split(' ').filter((w) => w.length >= 3)

/** Levenshtein distance entre dos strings (DP clásico, O(m·n)). */
export const levenshtein = (a, b) => {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    )
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[m][n]
}

/** Similitud normalizada 0–1 basada en Levenshtein. */
export const textSimilarity = (a, b) => {
    if (!a || !b) return 0
    const na = normalize(a), nb = normalize(b)
    const maxLen = Math.max(na.length, nb.length)
    if (maxLen === 0) return 1
    return 1 - levenshtein(na, nb) / maxLen
}

/** Cosine similarity entre bags of words. */
export const cosineSimilarity = (a, b) => {
    const ta = tokenize(a), tb = tokenize(b)
    if (!ta.length || !tb.length) return 0
    const vocab = new Set([...ta, ...tb])
    const va = [], vb = []
    vocab.forEach((w) => {
        va.push(ta.filter((t) => t === w).length)
        vb.push(tb.filter((t) => t === w).length)
    })
    const dot = va.reduce((s, v, i) => s + v * vb[i], 0)
    const magA = Math.sqrt(va.reduce((s, v) => s + v * v, 0))
    const magB = Math.sqrt(vb.reduce((s, v) => s + v * v, 0))
    return magA && magB ? dot / (magA * magB) : 0
}

/** Fingerprint estructural: keywords + longitud + estructura. */
export const fingerprint = (text = '') => {
    const tokens = tokenize(text)
    const sorted = [...new Set(tokens)].sort()
    return {
        keywords: sorted.slice(0, 12),
        length: tokens.length,
        hasComma: text.includes(','),
        hasTechnical: /\b(4k|8k|cinematic|bokeh|depth|lighting|render|realistic|photorealistic)\b/i.test(text),
    }
}

/** Similitud 0–1 entre dos fingerprints (Jaccard de keywords + longitud + estructura). */
export const fingerprintSimilarity = (fpA, fpB) => {
    const kwA = new Set(fpA.keywords), kwB = new Set(fpB.keywords)
    const intersection = [...kwA].filter((k) => kwB.has(k)).length
    const union = new Set([...kwA, ...kwB]).size
    const jaccardKw = union > 0 ? intersection / union : 0
    const lengthSim = 1 - Math.abs(fpA.length - fpB.length) / Math.max(fpA.length, fpB.length, 1)
    const structSim = (fpA.hasComma === fpB.hasComma ? 0.5 : 0) + (fpA.hasTechnical === fpB.hasTechnical ? 0.5 : 0)
    return jaccardKw * 0.6 + lengthSim * 0.25 + structSim * 0.15
}
