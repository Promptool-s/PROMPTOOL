/**
 * Sistema antiplagio — detección multicapa
 *
 * Capas:
 * 1. Tiempo de respuesta sospechoso
 * 2. Similitud de texto con intentos anteriores (Levenshtein + cosine de keywords)
 * 3. Fingerprint estructural del prompt
 * 4. Acumulación de flags → suspensión progresiva
 */

import { supabase } from '../supabaseClient'
import { nowAR } from '../utils/dateAR'

// ── Utilidades de texto ──────────────────────────────────────────────────────

const normalize = (text = '') =>
  text.toLowerCase().replace(/[^a-záéíóúñ\s]/gi, '').replace(/\s+/g, ' ').trim()

const tokenize = (text = '') =>
  normalize(text).split(' ').filter(w => w.length >= 3)

/** Levenshtein distance entre dos strings */
const levenshtein = (a, b) => {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

/** Similitud normalizada 0–1 basada en Levenshtein */
const textSimilarity = (a, b) => {
  if (!a || !b) return 0
  const na = normalize(a), nb = normalize(b)
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(na, nb) / maxLen
}

/** Cosine similarity entre bags of words */
const cosineSimilarity = (a, b) => {
  const ta = tokenize(a), tb = tokenize(b)
  if (!ta.length || !tb.length) return 0
  const vocab = new Set([...ta, ...tb])
  const va = [], vb = []
  vocab.forEach(w => { va.push(ta.filter(t => t === w).length); vb.push(tb.filter(t => t === w).length) })
  const dot = va.reduce((s, v, i) => s + v * vb[i], 0)
  const magA = Math.sqrt(va.reduce((s, v) => s + v * v, 0))
  const magB = Math.sqrt(vb.reduce((s, v) => s + v * v, 0))
  return magA && magB ? dot / (magA * magB) : 0
}

/** Fingerprint estructural: keywords + longitud + estructura */
const fingerprint = (text = '') => {
  const tokens = tokenize(text)
  const sorted = [...new Set(tokens)].sort()
  return {
    keywords: sorted.slice(0, 12),
    length: tokens.length,
    hasComma: text.includes(','),
    hasTechnical: /\b(4k|8k|cinematic|bokeh|depth|lighting|render|realistic|photorealistic)\b/i.test(text),
  }
}

const fingerprintSimilarity = (fpA, fpB) => {
  const kwA = new Set(fpA.keywords), kwB = new Set(fpB.keywords)
  const intersection = [...kwA].filter(k => kwB.has(k)).length
  const union = new Set([...kwA, ...kwB]).size
  const jaccardKw = union > 0 ? intersection / union : 0
  const lengthSim = 1 - Math.abs(fpA.length - fpB.length) / Math.max(fpA.length, fpB.length, 1)
  const structSim = (fpA.hasComma === fpB.hasComma ? 0.5 : 0) + (fpA.hasTechnical === fpB.hasTechnical ? 0.5 : 0)
  return jaccardKw * 0.6 + lengthSim * 0.25 + structSim * 0.15
}

// ── Umbrales ─────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  // Tiempo mínimo razonable en segundos según dificultad
  minTime: { easy: 8, medium: 12, hard: 18 },
  // Score mínimo para que el tiempo sea sospechoso
  minScoreForTimeSuspicion: 75,
  // Similitud de texto con intentos anteriores para flag
  textSimilarityFlag: 0.82,
  // Similitud cosine para flag
  cosineSimilarityFlag: 0.88,
  // Similitud de fingerprint para flag
  fingerprintFlag: 0.80,
  // Flags acumulados antes de warning
  flagsForWarning: 2,
  // Flags acumulados antes de suspensión temporal
  flagsForSuspension: 5,
  // Flags acumulados antes de suspensión permanente
  flagsForBan: 10,
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Analiza un intento y determina si es sospechoso.
 * @returns {{ suspicious: boolean, reasons: string[], severity: 'none'|'low'|'medium'|'high' }}
 */
export const analyzePlagiarism = async ({
  userId,
  prompt,
  score,
  elapsedSeconds,
  difficulty = 'Medium',
  imageId,
}) => {
  if (!userId || !prompt) return { suspicious: false, reasons: [], severity: 'none' }

  const reasons = []
  const nd = difficulty.toLowerCase()

  // ── 1. Tiempo sospechoso ──────────────────────────────────────────────────
  const minTime = THRESHOLDS.minTime[nd] ?? THRESHOLDS.minTime.medium
  if (elapsedSeconds < minTime && score >= THRESHOLDS.minScoreForTimeSuspicion) {
    reasons.push(`response_time:${elapsedSeconds}s`)
  }

  // ── 2. Comparar con intentos anteriores del mismo usuario ─────────────────
  // NOTA: En modo empresa, el organizador puede usar el mismo prompt para testear
  // Por eso, solo comparamos si NO es un desafío de empresa
  try {
    // Verificar si esta imagen es un desafío de empresa
    const { data: imageInfo } = await supabase
      .from('imagenes_ia')
      .select('company_id')
      .eq('id_imagen', imageId)
      .maybeSingle()

    // Si es un desafío de empresa, no aplicar detección de plagio por similitud
    const isCompanyChallenge = imageInfo?.company_id != null

    if (!isCompanyChallenge) {
      const { data: prevAttempts } = await supabase
        .from('intentos')
        .select('prompt_usuario, puntaje_similitud, id_imagen')
        .eq('id_usuario', userId)
        .neq('id_imagen', imageId) // diferente imagen — si es igual imagen es retry normal
        .order('fecha_hora', { ascending: false })
        .limit(20)

      if (prevAttempts?.length) {
        const fpCurrent = fingerprint(prompt)
        let maxTextSim = 0, maxCosine = 0, maxFp = 0

        for (const prev of prevAttempts) {
          if (!prev.prompt_usuario) continue
          const ts = textSimilarity(prompt, prev.prompt_usuario)
          const cs = cosineSimilarity(prompt, prev.prompt_usuario)
          const fpPrev = fingerprint(prev.prompt_usuario)
          const fps = fingerprintSimilarity(fpCurrent, fpPrev)
          maxTextSim = Math.max(maxTextSim, ts)
          maxCosine = Math.max(maxCosine, cs)
          maxFp = Math.max(maxFp, fps)
        }

        if (maxTextSim >= THRESHOLDS.textSimilarityFlag)
          reasons.push(`text_similarity:${Math.round(maxTextSim * 100)}%`)
        if (maxCosine >= THRESHOLDS.cosineSimilarityFlag)
          reasons.push(`cosine_similarity:${Math.round(maxCosine * 100)}%`)
        if (maxFp >= THRESHOLDS.fingerprintFlag)
          reasons.push(`fingerprint:${Math.round(maxFp * 100)}%`)
      }
    }
  } catch {
    // fail open — comparison error
  }

  if (!reasons.length) return { suspicious: false, reasons: [], severity: 'none' }

  // ── 3. Registrar flag y evaluar severidad acumulada ───────────────────────
  const severity = reasons.length >= 3 ? 'high' : reasons.length === 2 ? 'medium' : 'low'

  try {
    // Guardar flag en BD
    await supabase.from('plagiarism_flags').insert([{
      id_usuario: userId,
      id_imagen: imageId,
      prompt_snapshot: prompt.slice(0, 500),
      score,
      elapsed_seconds: elapsedSeconds,
      reasons,
      severity,
      created_at: nowAR(),
    }])

    // Contar flags totales del usuario
    const { count } = await supabase
      .from('plagiarism_flags')
      .select('id', { count: 'exact', head: true })
      .eq('id_usuario', userId)

    const totalFlags = count ?? 0

    // Suspensión progresiva
    if (totalFlags >= THRESHOLDS.flagsForBan) {
      await supabase.from('usuarios').update({
        suspension_status: 'banned',
        suspension_reason: 'Múltiples detecciones de plagio',
        suspension_until: null, // permanente
      }).eq('id_usuario', userId)
    } else if (totalFlags >= THRESHOLDS.flagsForSuspension) {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 días
      await supabase.from('usuarios').update({
        suspension_status: 'suspended',
        suspension_reason: 'Comportamiento sospechoso detectado',
        suspension_until: until,
      }).eq('id_usuario', userId)
    } else if (totalFlags >= THRESHOLDS.flagsForWarning) {
      await supabase.from('usuarios').update({
        suspension_status: 'warned',
      }).eq('id_usuario', userId)
    }
  } catch {
    // fail open — flag save error
  }

  return { suspicious: true, reasons, severity }
}

/**
 * Verifica si un usuario está suspendido antes de permitir un intento.
 * @returns {{ allowed: boolean, reason?: string, until?: string }}
 */
export const checkSuspension = async (userId) => {
  if (!userId) return { allowed: true }
  try {
    const { data } = await supabase
      .from('usuarios')
      .select('suspension_status, suspension_reason, suspension_until')
      .eq('id_usuario', userId)
      .maybeSingle()

    if (!data?.suspension_status || data.suspension_status === 'none') return { allowed: true }

    if (data.suspension_status === 'banned') {
      return { allowed: false, reason: data.suspension_reason || 'Cuenta suspendida permanentemente.' }
    }

    if (data.suspension_status === 'suspended') {
      const until = data.suspension_until ? new Date(data.suspension_until) : null
      if (until && until > new Date()) {
        return {
          allowed: false,
          reason: data.suspension_reason || 'Cuenta suspendida temporalmente.',
          until: until.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
        }
      }
      // Suspensión expirada — limpiar
      await supabase.from('usuarios').update({ suspension_status: 'none', suspension_until: null }).eq('id_usuario', userId)
    }

    return { allowed: true }
  } catch {
    return { allowed: true } // fail open — no bloquear por error técnico
  }
}
