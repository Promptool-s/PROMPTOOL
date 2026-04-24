import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

/**
 * Genera configuración de desafío usando IA
 * @param {Object} params
 * @param {string} params.userPrompt - Descripción del desafío deseado por el usuario
 * @param {File} params.imageFile - Archivo de imagen
 * @param {string} params.companyIndustry - Industria de la empresa
 * @returns {Promise<Object>} Configuración del desafío generada
 */
export const generateChallengeConfig = async ({ userPrompt, imageFile, companyIndustry = 'general' }) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Convertir imagen a base64
    const imageData = await fileToGenerativePart(imageFile)

    const prompt = `Eres un experto en crear desafíos de prompting para IA generativa. 

Analiza esta imagen y la descripción del usuario para generar una configuración completa de desafío.

**Descripción del usuario:** ${userPrompt}
**Industria:** ${companyIndustry}

Genera un JSON con esta estructura EXACTA (sin markdown, solo JSON puro):
{
  "prompt": "El prompt exacto que genera esta imagen (detallado, técnico, con keywords de IA)",
  "difficulty": "Easy|Medium|Hard (basado en complejidad visual)",
  "theme": "Tema principal de la imagen en 2-3 palabras",
  "description": "Descripción del desafío para los participantes (1-2 oraciones)",
  "timeLimit": número entre 60-600 (segundos recomendados según dificultad),
  "maxAttempts": número entre 0-10 (0=ilimitado, recomienda según dificultad),
  "minWords": número entre 5-50 (palabras mínimas del prompt según complejidad),
  "points": número entre 50-200 (puntos según dificultad),
  "tags": ["tag1", "tag2", "tag3"] (3-5 tags relevantes),
  "hints": ["pista1", "pista2", "pista3"] (3 pistas progresivas),
  "evaluationMode": "standard|strict|flexible (según precisión requerida)"
}

**Criterios:**
- Easy: timeLimit 300-600s, maxAttempts 5-10, minWords 5-15, points 50-80
- Medium: timeLimit 180-300s, maxAttempts 3-5, minWords 10-25, points 80-120
- Hard: timeLimit 60-180s, maxAttempts 1-3, minWords 20-50, points 120-200

- El prompt debe ser técnico y detallado (estilo, composición, iluminación, colores, mood)
- Los hints deben ser progresivos: primero general, luego más específico
- Los tags deben ser relevantes para búsqueda y categorización
- Adapta la dificultad a la industria: marketing=más flexible, tech=más estricto

Responde SOLO con el JSON, sin explicaciones adicionales.`

    const result = await model.generateContent([prompt, imageData])
    const response = await result.response
    const text = response.text()

    // Limpiar respuesta (remover markdown si existe)
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '')
    }

    const config = JSON.parse(jsonText)

    // Validar y sanitizar
    return {
      prompt: config.prompt || '',
      difficulty: ['Easy', 'Medium', 'Hard'].includes(config.difficulty) ? config.difficulty : 'Medium',
      theme: config.theme || 'General',
      description: config.description || '',
      timeLimit: Math.max(60, Math.min(600, config.timeLimit || 180)),
      maxAttempts: Math.max(0, Math.min(10, config.maxAttempts || 0)),
      minWords: Math.max(5, Math.min(50, config.minWords || 10)),
      points: Math.max(50, Math.min(200, config.points || 100)),
      tags: Array.isArray(config.tags) ? config.tags.slice(0, 5) : [],
      hints: Array.isArray(config.hints) ? config.hints.slice(0, 3) : ['', '', ''],
      evaluationMode: ['standard', 'strict', 'flexible'].includes(config.evaluationMode) ? config.evaluationMode : 'standard',
    }
  } catch (error) {
    console.error('Error generating challenge config:', error)
    throw new Error('No se pudo generar la configuración del desafío. Intenta de nuevo.')
  }
}

/**
 * Convierte un archivo a formato GenerativePart para Gemini
 */
async function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1]
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
