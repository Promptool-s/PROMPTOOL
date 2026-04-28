/**
 * Sistema de detección de prompts generados por IA
 * 
 * Estrategias:
 * 1. Análisis de patrones de escritura (velocidad, pausas, correcciones)
 * 2. Detección de frases típicas de IA (GPT, Claude, etc.)
 * 3. Análisis de complejidad y estructura
 * 4. Fingerprinting de comportamiento de usuario
 * 5. Verificación de consistencia temporal
 */

import { supabase } from '../supabaseClient'

// ── Patrones típicos de IA ──────────────────────────────────────────────────

const AI_PATTERNS = {
  // Frases comunes de ChatGPT/Claude
  commonPhrases: [
    'as an ai',
    'i cannot',
    'i apologize',
    'it\'s important to note',
    'it is worth noting',
    'in conclusion',
    'to summarize',
    'in summary',
    'overall',
    'furthermore',
    'moreover',
    'additionally',
    'consequently',
    'therefore',
    'thus',
    'hence',
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
    /\d+\.\s+\w+/g, // "1. item, 2. item"
    /\w+:\s+\w+,\s+\w+:\s+\w+/g, // "key: value, key: value"
  ],
  
  // Exceso de adjetivos técnicos (IA tiende a ser muy descriptiva)
  technicalOverload: [
    'photorealistic',
    'hyperrealistic',
    'ultra-detailed',
    'high-resolution',
    'professional',
    'masterpiece',
    'award-winning',
    'trending on artstation',
    'octane render',
    'unreal engine',
  ],
}

// ── Análisis de patrones de escritura ──────────────────────────────────────

/**
 * Analiza la velocidad de escritura y detecta patrones sospechosos
 * @param {number} promptLength - Longitud del prompt en caracteres
 * @param {number} elapsedSeconds - Tiempo transcurrido
 * @returns {{ suspicious: boolean, reason: string, confidence: number }}
 */
const analyzeTypingSpeed = (promptLength, elapsedSeconds) => {
  const charsPerSecond = promptLength / Math.max(elapsedSeconds, 1)
  const charsPerMinute = charsPerSecond * 60

  // Demasiado rápido — imposible para un humano (>400 cpm = ~80 wpm sin pensar)
  if (charsPerMinute > 400) {
    return {
      suspicious: true,
      reason: 'typing_too_fast',
      confidence: Math.min((charsPerMinute - 400) / 200, 1),
    }
  }

  // Texto largo escrito muy rápido en términos absolutos
  // >80 chars en menos de 5 segundos = casi imposible sin paste
  if (promptLength > 80 && elapsedSeconds < 5) {
    return {
      suspicious: true,
      reason: 'long_text_instant',
      confidence: 0.95,
    }
  }

  return { suspicious: false, reason: '', confidence: 0 }
}

/**
 * Analiza el reporte de comportamiento de escritura del hook useTypingBehavior.
 * Esta es la señal más confiable porque captura el comportamiento real keystroke a keystroke.
 *
 * @param {Object} typingReport - Reporte devuelto por useTypingBehavior.getReport()
 * @returns {{ suspicious: boolean, reasons: string[], confidence: number }}
 */
export const analyzeTypingBehavior = (typingReport) => {
  if (!typingReport) return { suspicious: false, reasons: [], confidence: 0 }

  const {
    totalKeys,
    totalTimeSeconds,
    corrections,
    pauseCount,
    burstCount,
    finalLength,
    maxLength,
    avgCharsPerSecond,
    interKeyVarianceMs,
    correctionRatio,
    editRatio,
    avgPauseDurationMs,
  } = typingReport

  // Debug — ver qué valores llegan realmente
  console.debug('[AI Detection] typingReport:', {
    totalKeys, totalTimeSeconds, corrections, pauseCount,
    burstCount, finalLength, maxLength, avgCharsPerSecond,
    interKeyVarianceMs, correctionRatio, editRatio,
  })

  const reasons = []
  let confidence = 0

  // ── 1. Sin correcciones en texto largo ──────────────────────────────────
  // Un humano escribiendo >60 chars casi siempre comete al menos 1 error.
  // Cero correcciones en texto largo es señal fuerte de paste/IA.
  if (finalLength > 60 && corrections === 0) {
    reasons.push('no_corrections')
    confidence += 0.5
  } else if (finalLength > 120 && corrections <= 1) {
    reasons.push('almost_no_corrections')
    confidence += 0.3
  }

  // ── 2. Sin pausas en texto largo ────────────────────────────────────────
  // Un humano piensa mientras escribe. Cero pausas >1.5s en texto largo = sospechoso.
  if (finalLength > 80 && pauseCount === 0) {
    reasons.push('no_pauses')
    confidence += 0.4
  }

  // ── 3. Varianza de inter-key timing muy baja ─────────────────────────────
  // Un robot escribe con intervalos muy regulares. Un humano varía mucho.
  // <30ms de desviación estándar en >20 teclas es casi imposible para humanos.
  if (totalKeys > 20 && interKeyVarianceMs < 30 && interKeyVarianceMs > 0) {
    reasons.push('robotic_key_timing')
    confidence += 0.6
  } else if (totalKeys > 20 && interKeyVarianceMs < 60 && interKeyVarianceMs > 0) {
    reasons.push('low_key_variance')
    confidence += 0.3
  }

  // ── 4. Burst masivo único ────────────────────────────────────────────────
  // Si hay exactamente 1 burst grande y poco más, es paste disfrazado.
  // (El usuario escribió 1-2 chars, pegó el resto de a poco con autocomplete de IA)
  if (burstCount >= 3 && corrections === 0 && pauseCount === 0) {
    reasons.push('burst_no_corrections')
    confidence += 0.5
  }

  // ── 5. Velocidad promedio muy alta ───────────────────────────────────────
  // >6 chars/segundo sostenido es inusual para escritura con pensamiento
  if (avgCharsPerSecond > 6 && finalLength > 60) {
    reasons.push('sustained_high_speed')
    confidence += Math.min((avgCharsPerSecond - 6) / 4, 0.5)
  }

  // ── 6. Ratio de edición cero ─────────────────────────────────────────────
  // Si el texto nunca fue más largo que el final (nunca borró nada),
  // combinado con otras señales, es sospechoso.
  if (editRatio === 0 && correctionRatio === 0 && finalLength > 50) {
    reasons.push('zero_edit_ratio')
    confidence += 0.25
  }

  // ── 8. Patrón de transcripción — pausas regulares entre bursts ──────────
  // Cuando alguien mira otra pantalla y transcribe, el patrón es:
  // burst corto → pausa larga → burst corto → pausa larga → ...
  // Esto genera una varianza de pausas BAJA (pausas muy regulares)
  // combinada con bursts frecuentes.
  if (s.pauses.length >= 3 && burstCount >= 3) {
    const pauseDurations = s.pauses
    const meanPause = pauseDurations.reduce((a, b) => a + b, 0) / pauseDurations.length
    const pauseVariance = pauseDurations.reduce((a, b) => a + (b - meanPause) ** 2, 0) / pauseDurations.length
    const pauseStdDev = Math.sqrt(pauseVariance)
    // Pausas muy regulares (baja varianza) + bursts = patrón de transcripción
    if (pauseStdDev < meanPause * 0.4) {
      reasons.push('transcription_pattern')
      confidence += 0.45
    }
  }
  // Si totalKeys << finalLength, el texto apareció sin ser tipeado tecla a tecla.
  // Esto detecta autocomplete agresivo o paste fragmentado.
  if (finalLength > 40 && totalKeys < finalLength * 0.4) {
    reasons.push('keys_vs_length_mismatch')
    confidence += 0.7
  }

  // Umbral: 1 señal fuerte (≥0.5) o 2 señales cualquiera
  const suspicious = confidence >= 0.5 || reasons.length >= 2
  console.debug('[AI Detection] analyzeTypingBehavior result:', { suspicious, reasons, confidence })
  return {
    suspicious,
    reasons,
    confidence: Math.min(confidence, 1),
  }
}

/**
 * Detecta frases y patrones típicos de IA
 * @param {string} prompt - El prompt a analizar
 * @returns {{ suspicious: boolean, matches: string[], confidence: number }}
 */
const detectAIPatterns = (prompt) => {
  const lower = prompt.toLowerCase()
  const matches = []
  
  // Buscar frases comunes de IA
  for (const phrase of AI_PATTERNS.commonPhrases) {
    if (lower.includes(phrase)) {
      matches.push(`phrase:${phrase}`)
    }
  }
  
  // Buscar estructuras formales
  for (const pattern of AI_PATTERNS.formalStructures) {
    if (pattern.test(prompt)) {
      matches.push(`formal_structure:${pattern.source.slice(0, 30)}`)
    }
  }
  
  // Buscar listas estructuradas
  for (const pattern of AI_PATTERNS.structuredLists) {
    const found = prompt.match(pattern)
    if (found && found.length >= 3) {
      matches.push(`structured_list:${found.length}_items`)
    }
  }
  
  // Contar términos técnicos
  let technicalCount = 0
  for (const term of AI_PATTERNS.technicalOverload) {
    if (lower.includes(term)) {
      technicalCount++
      matches.push(`technical:${term}`)
    }
  }
  
  // Más de 4 términos técnicos es muy sospechoso
  const confidence = matches.length > 0 
    ? Math.min(matches.length / 5, 1)
    : 0
  
  return {
    suspicious: matches.length >= 2,
    matches,
    confidence
  }
}

/**
 * Analiza la complejidad y estructura del prompt
 * @param {string} prompt - El prompt a analizar
 * @returns {{ suspicious: boolean, reason: string, confidence: number }}
 */
const analyzeComplexity = (prompt) => {
  const words = prompt.trim().split(/\s+/)
  const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  // Promedio de palabras por oración
  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1)
  
  // IA tiende a hacer oraciones muy largas y complejas
  if (avgWordsPerSentence > 25) {
    return {
      suspicious: true,
      reason: 'overly_complex_sentences',
      confidence: Math.min((avgWordsPerSentence - 25) / 20, 1)
    }
  }
  
  // Contar palabras únicas vs total (diversidad léxica)
  const uniqueWords = new Set(words.map(w => w.toLowerCase()))
  const lexicalDiversity = uniqueWords.size / words.length
  
  // IA tiende a tener alta diversidad léxica (no repite palabras)
  if (lexicalDiversity > 0.85 && words.length > 30) {
    return {
      suspicious: true,
      reason: 'unnaturally_high_lexical_diversity',
      confidence: (lexicalDiversity - 0.85) / 0.15
    }
  }
  
  // Contar comas (IA usa muchas comas para listas)
  const commaCount = (prompt.match(/,/g) || []).length
  const commaRatio = commaCount / words.length
  
  if (commaRatio > 0.15) {
    return {
      suspicious: true,
      reason: 'excessive_comma_usage',
      confidence: Math.min((commaRatio - 0.15) / 0.1, 1)
    }
  }
  
  return { suspicious: false, reason: '', confidence: 0 }
}

/**
 * Analiza el comportamiento histórico del usuario
 * @param {string} userId - ID del usuario
 * @param {string} currentPrompt - Prompt actual
 * @returns {Promise<{ suspicious: boolean, reason: string, confidence: number }>}
 */
const analyzeBehaviorPattern = async (userId, currentPrompt) => {
  try {
    // Obtener últimos 10 intentos del usuario
    const { data: history } = await supabase
      .from('intentos')
      .select('prompt_usuario, tiempo_transcurrido, puntaje_similitud')
      .eq('id_usuario', userId)
      .order('fecha_hora', { ascending: false })
      .limit(10)
    
    if (!history || history.length < 3) {
      return { suspicious: false, reason: 'insufficient_history', confidence: 0 }
    }
    
    // Calcular promedios históricos
    const avgLength = history.reduce((sum, h) => sum + (h.prompt_usuario?.length || 0), 0) / history.length
    const avgTime = history.reduce((sum, h) => sum + (h.tiempo_transcurrido || 0), 0) / history.length
    const avgScore = history.reduce((sum, h) => sum + (h.puntaje_similitud || 0), 0) / history.length
    
    const currentLength = currentPrompt.length
    
    // Cambio drástico en longitud (más del 200%)
    if (currentLength > avgLength * 2.5 && avgLength > 50) {
      return {
        suspicious: true,
        reason: 'sudden_length_increase',
        confidence: Math.min((currentLength / avgLength - 2.5) / 2, 1)
      }
    }
    
    // Cambio drástico en calidad (score sube más de 30 puntos)
    const recentAvgScore = history.slice(0, 3).reduce((sum, h) => sum + (h.puntaje_similitud || 0), 0) / 3
    // Este check se hace después de obtener el score, en la función principal
    
    return { suspicious: false, reason: '', confidence: 0 }
  } catch (error) {
    console.error('[AI Detection] Error analyzing behavior:', error)
    return { suspicious: false, reason: 'analysis_error', confidence: 0 }
  }
}

/**
 * Verifica consistencia temporal entre intentos
 * @param {string} userId - ID del usuario
 * @param {number} elapsedSeconds - Tiempo del intento actual
 * @returns {Promise<{ suspicious: boolean, reason: string, confidence: number }>}
 */
const analyzeTemporalConsistency = async (userId, elapsedSeconds) => {
  try {
    const { data: recent } = await supabase
      .from('intentos')
      .select('fecha_hora, tiempo_transcurrido')
      .eq('id_usuario', userId)
      .order('fecha_hora', { ascending: false })
      .limit(5)
    
    if (!recent || recent.length < 2) {
      return { suspicious: false, reason: '', confidence: 0 }
    }
    
    // Verificar si hay múltiples intentos en muy poco tiempo
    const now = new Date()
    const recentAttempts = recent.filter(r => {
      const attemptTime = new Date(r.fecha_hora)
      const diffMinutes = (now - attemptTime) / 1000 / 60
      return diffMinutes < 5
    })
    
    // Más de 3 intentos en 5 minutos es sospechoso
    if (recentAttempts.length >= 3) {
      return {
        suspicious: true,
        reason: 'rapid_fire_attempts',
        confidence: Math.min(recentAttempts.length / 5, 1)
      }
    }
    
    return { suspicious: false, reason: '', confidence: 0 }
  } catch (error) {
    return { suspicious: false, reason: '', confidence: 0 }
  }
}

// ── Función principal de detección ─────────────────────────────────────────

/**
 * Analiza un prompt para detectar si fue generado por IA
 * @param {Object} params - Parámetros del análisis
 * @param {Object} [params.typingReport] - Reporte de useTypingBehavior (opcional pero muy recomendado)
 * @returns {Promise<{ isAI: boolean, confidence: number, reasons: string[], severity: 'none'|'low'|'medium'|'high' }>}
 */
export const detectAIGenerated = async ({
  userId,
  prompt,
  elapsedSeconds,
  score,
  typingReport = null,
  focusReport = null,
}) => {
  if (!prompt || !userId) {
    return { isAI: false, confidence: 0, reasons: [], severity: 'none' }
  }
  
  const detections = []
  let totalConfidence = 0
  
  // 1. Análisis de comportamiento de escritura real (señal más fuerte)
  if (typingReport) {
    const behaviorAnalysis = analyzeTypingBehavior(typingReport)
    if (behaviorAnalysis.suspicious) {
      detections.push(...behaviorAnalysis.reasons)
      totalConfidence += behaviorAnalysis.confidence * 1.5
    }
    // Clipboard cambió antes de escribir — señal directa de copy-paste externo
    if (typingReport.clipboardChangedBeforeTyping) {
      detections.push('clipboard_changed_before_typing')
      totalConfidence += 0.6
    }
  }

  // 2. Análisis de foco de ventana
  if (focusReport) {
    console.debug('[AI Detection] focusReport:', focusReport)
    // Ausencias tipo screenshot (Win+Shift+S dura ~1-3s)
    if (focusReport.screenshotLikeCount >= 1) {
      detections.push(`screenshot_like_absence:${focusReport.screenshotLikeCount}`)
      totalConfidence += Math.min(focusReport.screenshotLikeCount * 0.35, 0.7)
    }
    // Ausencia larga — fue a consultar algo (ChatGPT, etc.)
    if (focusReport.longAbsenceCount >= 1) {
      detections.push(`long_absence:${focusReport.longAbsenceCount}`)
      totalConfidence += Math.min(focusReport.longAbsenceCount * 0.4, 0.8)
    }
    // Perdió foco muy temprano (en los primeros 5s de ver la imagen)
    if (focusReport.earlyAbsenceCount >= 1) {
      detections.push('early_focus_loss')
      totalConfidence += 0.5
    }
    // Muchas ausencias cortas = múltiples screenshots
    if (focusReport.screenshotLikeCount >= 3) {
      detections.push('multiple_screenshots')
      totalConfidence += 0.4
    }
  }

  // 3. Análisis de velocidad global (fallback si no hay typingReport)
  const speedAnalysis = analyzeTypingSpeed(prompt.length, elapsedSeconds)
  if (speedAnalysis.suspicious) {
    detections.push(speedAnalysis.reason)
    totalConfidence += speedAnalysis.confidence
  }
  
  // 4. Detección de patrones de IA en el texto
  const patternAnalysis = detectAIPatterns(prompt)
  if (patternAnalysis.suspicious) {
    detections.push(...patternAnalysis.matches)
    totalConfidence += patternAnalysis.confidence
  }
  
  // 5. Análisis de complejidad
  const complexityAnalysis = analyzeComplexity(prompt)
  if (complexityAnalysis.suspicious) {
    detections.push(complexityAnalysis.reason)
    totalConfidence += complexityAnalysis.confidence
  }
  
  // 6. Análisis de comportamiento histórico
  // 7. Análisis de consistencia temporal
  // Ambos son queries independientes a Supabase — corren en paralelo
  const [behaviorHistoryAnalysis, temporalAnalysis] = await Promise.all([
    analyzeBehaviorPattern(userId, prompt),
    analyzeTemporalConsistency(userId, elapsedSeconds),
  ])

  if (behaviorHistoryAnalysis.suspicious) {
    detections.push(behaviorHistoryAnalysis.reason)
    totalConfidence += behaviorHistoryAnalysis.confidence
  }
  
  if (temporalAnalysis.suspicious) {
    detections.push(temporalAnalysis.reason)
    totalConfidence += temporalAnalysis.confidence
  }
  
  const avgConfidence = detections.length > 0 
    ? totalConfidence / detections.length 
    : 0
  
  let severity = 'none'
  if (avgConfidence >= 0.7 || detections.length >= 4) {
    severity = 'high'
  } else if (avgConfidence >= 0.5 || detections.length >= 3) {
    severity = 'medium'
  } else if (avgConfidence >= 0.3 || detections.length >= 2) {
    severity = 'low'
  }
  
  // Umbral final: 1 señal fuerte o 2 señales débiles
  const isAI = confidence >= 0.5 || detections.length >= 2
  console.debug('[AI Detection] final result:', { isAI, avgConfidence, detections, severity })
  
  if (isAI) {
    try {
      await supabase.from('ai_detection_flags').insert([{
        id_usuario: userId,
        prompt_snapshot: prompt.slice(0, 500),
        score,
        elapsed_seconds: elapsedSeconds,
        detections,
        confidence: avgConfidence,
        severity,
        typing_report: typingReport ? JSON.stringify(typingReport) : null,
        focus_report: focusReport ? JSON.stringify(focusReport) : null,
        created_at: new Date().toISOString(),
      }])
    } catch (error) {
      console.error('[AI Detection] Error saving flag:', error)
    }
  }
  
  return {
    isAI,
    confidence: avgConfidence,
    reasons: detections,
    severity
  }
}

/**
 * Verifica si un usuario tiene demasiadas detecciones de IA
 * @param {string} userId - ID del usuario
 * @returns {Promise<{ shouldWarn: boolean, shouldBlock: boolean, count: number }>}
 */
export const checkAIDetectionHistory = async (userId) => {
  try {
    const { count } = await supabase
      .from('ai_detection_flags')
      .select('id', { count: 'exact', head: true })
      .eq('id_usuario', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // últimos 7 días
    
    const detectionCount = count || 0
    
    return {
      shouldWarn: detectionCount >= 3,
      shouldBlock: detectionCount >= 5,
      count: detectionCount
    }
  } catch (error) {
    return { shouldWarn: false, shouldBlock: false, count: 0 }
  }
}

/**
 * Verifica si el portapapeles contiene una imagen y si se parece a la imagen del juego.
 * Usa canvas para comparar píxeles — detecta capturas de pantalla de la imagen.
 *
 * @param {string} gameImageUrl - URL de la imagen del juego actual
 * @returns {Promise<{ hasImage: boolean, similarToGame: boolean, similarity: number }>}
 */
export const checkClipboardForGameImage = async (gameImageUrl) => {
  const result = { hasImage: false, similarToGame: false, similarity: 0 }
  try {
    if (!navigator.clipboard?.read) return result

    const items = await navigator.clipboard.read()
    const imageItem = items.find(item =>
      item.types.some(t => t.startsWith('image/'))
    )
    if (!imageItem) return result

    result.hasImage = true

    if (!gameImageUrl) return result

    // Leer la imagen del clipboard como blob
    const imageType = imageItem.types.find(t => t.startsWith('image/'))
    const blob = await imageItem.getType(imageType)
    const clipboardBitmap = await createImageBitmap(blob)

    // Cargar la imagen del juego
    const gameImg = new Image()
    gameImg.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      gameImg.onload = resolve
      gameImg.onerror = reject
      gameImg.src = gameImageUrl
    })

    // Comparar en canvas pequeño (32x32 es suficiente para similitud perceptual)
    const SIZE = 32
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Píxeles de la imagen del juego
    ctx.drawImage(gameImg, 0, 0, SIZE, SIZE)
    const gamePixels = ctx.getImageData(0, 0, SIZE, SIZE).data

    // Píxeles del clipboard
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.drawImage(clipboardBitmap, 0, 0, SIZE, SIZE)
    const clipPixels = ctx.getImageData(0, 0, SIZE, SIZE).data

    // Diferencia media absoluta normalizada (0 = idéntico, 1 = completamente diferente)
    let totalDiff = 0
    const pixelCount = SIZE * SIZE
    for (let i = 0; i < clipPixels.length; i += 4) {
      const dr = Math.abs(gamePixels[i]     - clipPixels[i])
      const dg = Math.abs(gamePixels[i + 1] - clipPixels[i + 1])
      const db = Math.abs(gamePixels[i + 2] - clipPixels[i + 2])
      totalDiff += (dr + dg + db) / 3
    }
    const avgDiff = totalDiff / pixelCount
    const similarity = 1 - avgDiff / 255

    result.similarity = similarity
    // >60% de similitud = muy probable que sea la misma imagen (puede tener UI encima)
    result.similarToGame = similarity > 0.60

    clipboardBitmap.close()
  } catch {
    // fail open — no bloquear por error técnico
  }
  return result
}

export default {
  detectAIGenerated,
  checkAIDetectionHistory,
  analyzeTypingSpeed,
  detectAIPatterns,
  analyzeComplexity,
}
