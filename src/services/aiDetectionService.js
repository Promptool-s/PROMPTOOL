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
  // Velocidad promedio humana: 40-60 palabras por minuto (200-300 caracteres/min)
  // Con pensamiento: 20-40 palabras por minuto (100-200 caracteres/min)
  
  const charsPerSecond = promptLength / elapsedSeconds
  const charsPerMinute = charsPerSecond * 60
  
  // Demasiado rápido (copy-paste o IA)
  if (charsPerMinute > 400) {
    return {
      suspicious: true,
      reason: 'typing_too_fast',
      confidence: Math.min((charsPerMinute - 400) / 200, 1)
    }
  }
  
  // Demasiado lento pero perfecto (generando con IA)
  if (charsPerMinute < 50 && promptLength > 100) {
    return {
      suspicious: true,
      reason: 'typing_too_slow_but_long',
      confidence: 0.3
    }
  }
  
  // Velocidad perfectamente constante (no humana)
  // Esto requeriría tracking de keystrokes, pero podemos inferir
  if (promptLength > 150 && elapsedSeconds > 30) {
    const expectedVariation = elapsedSeconds * 0.15 // 15% de variación esperada
    // Si el tiempo es muy "redondo" es sospechoso
    if (elapsedSeconds % 10 === 0 || elapsedSeconds % 5 === 0) {
      return {
        suspicious: true,
        reason: 'suspiciously_round_time',
        confidence: 0.4
      }
    }
  }
  
  return { suspicious: false, reason: '', confidence: 0 }
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
 * @returns {Promise<{ isAI: boolean, confidence: number, reasons: string[], severity: 'none'|'low'|'medium'|'high' }>}
 */
export const detectAIGenerated = async ({
  userId,
  prompt,
  elapsedSeconds,
  score,
}) => {
  if (!prompt || !userId) {
    return { isAI: false, confidence: 0, reasons: [], severity: 'none' }
  }
  
  const detections = []
  let totalConfidence = 0
  
  // 1. Análisis de velocidad de escritura
  const speedAnalysis = analyzeTypingSpeed(prompt.length, elapsedSeconds)
  if (speedAnalysis.suspicious) {
    detections.push(speedAnalysis.reason)
    totalConfidence += speedAnalysis.confidence
  }
  
  // 2. Detección de patrones de IA
  const patternAnalysis = detectAIPatterns(prompt)
  if (patternAnalysis.suspicious) {
    detections.push(...patternAnalysis.matches)
    totalConfidence += patternAnalysis.confidence
  }
  
  // 3. Análisis de complejidad
  const complexityAnalysis = analyzeComplexity(prompt)
  if (complexityAnalysis.suspicious) {
    detections.push(complexityAnalysis.reason)
    totalConfidence += complexityAnalysis.confidence
  }
  
  // 4. Análisis de comportamiento histórico
  const behaviorAnalysis = await analyzeBehaviorPattern(userId, prompt)
  if (behaviorAnalysis.suspicious) {
    detections.push(behaviorAnalysis.reason)
    totalConfidence += behaviorAnalysis.confidence
  }
  
  // 5. Análisis de consistencia temporal
  const temporalAnalysis = await analyzeTemporalConsistency(userId, elapsedSeconds)
  if (temporalAnalysis.suspicious) {
    detections.push(temporalAnalysis.reason)
    totalConfidence += temporalAnalysis.confidence
  }
  
  // Calcular confianza promedio
  const avgConfidence = detections.length > 0 
    ? totalConfidence / detections.length 
    : 0
  
  // Determinar severidad
  let severity = 'none'
  if (avgConfidence >= 0.7 || detections.length >= 4) {
    severity = 'high'
  } else if (avgConfidence >= 0.5 || detections.length >= 3) {
    severity = 'medium'
  } else if (avgConfidence >= 0.3 || detections.length >= 2) {
    severity = 'low'
  }
  
  const isAI = detections.length >= 2 && avgConfidence >= 0.4
  
  // Registrar detección si es sospechoso
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

export default {
  detectAIGenerated,
  checkAIDetectionHistory,
  analyzeTypingSpeed,
  detectAIPatterns,
  analyzeComplexity,
}
