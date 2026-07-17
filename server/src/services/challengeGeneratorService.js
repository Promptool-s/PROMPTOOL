import { config } from '../config/env.js'
import { throwError } from '../helpers/httpError.js'
import { clampInt } from '../helpers/validatorHelper.js'

/**
 * Generación de configuración de desafíos con Gemini — portado de
 * src/services/aiChallengeService.js del frontend, donde la key viajaba en el
 * bundle (VITE_GEMINI_API_KEY). Acá se usa la API REST de Gemini con fetch
 * nativo (sin SDK) y la key server-side (GEMINI_API_KEY).
 */

const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const IMAGE_BASE64_MAX = 3 * 1024 * 1024 * 1.4 // ~3MB de imagen en base64

const buildPrompt = ({ userPrompt, companyIndustry, conImagen }) => {
    const imageInstruction = conImagen
        ? 'Analiza esta imagen y la descripción del usuario para generar una configuración completa de desafío.'
        : 'Basándote en la descripción del usuario, generá una configuración completa de desafío de prompting.'

    return `Eres un experto en crear desafíos de prompting para IA generativa.

${imageInstruction}

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
}

export default class ChallengeGeneratorService {
    /**
     * @param {object} params
     * @param {string} params.userPrompt - descripción del desafío deseado
     * @param {string|null} params.imageBase64 - imagen opcional en base64 (sin data URI)
     * @param {string|null} params.mimeType - mime de la imagen
     * @param {string} params.companyIndustry
     */
    generarAsync = async ({ userPrompt, imageBase64 = null, mimeType = null, companyIndustry = 'general' }) => {
        if (!config.geminiApiKey) throwError('La generación con IA no está configurada (falta GEMINI_API_KEY).', 503)

        const parts = [{ text: buildPrompt({ userPrompt, companyIndustry, conImagen: !!imageBase64 }) }]
        if (imageBase64) {
            if (!IMAGE_MIME_TYPES.has(mimeType)) throwError('mime_type debe ser image/jpeg, image/png o image/webp.', 400)
            if (typeof imageBase64 !== 'string' || imageBase64.length > IMAGE_BASE64_MAX) {
                throwError('La imagen supera el tamaño máximo (~3MB).', 400)
            }
            parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } })
        }

        const response = await fetch(`${GEMINI_ENDPOINT}?key=${config.geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
            }),
        })

        if (!response.ok) {
            const detail = await response.json().catch(() => ({}))
            console.error('[challengeGenerator] Gemini error:', response.status, detail)
            throwError('No se pudo generar la configuración del desafío. Intentá de nuevo.', 502)
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''

        // Limpiar fences de markdown si el modelo los agrega igual
        let jsonText = text.trim()
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
        }

        let cfg
        try {
            cfg = JSON.parse(jsonText)
        } catch {
            console.error('[challengeGenerator] respuesta no parseable:', jsonText.slice(0, 200))
            throwError('La IA devolvió una respuesta inválida. Intentá de nuevo.', 502)
        }

        // Misma sanitización que el original del frontend
        return {
            prompt: String(cfg.prompt || '').slice(0, 2000),
            difficulty: ['Easy', 'Medium', 'Hard'].includes(cfg.difficulty) ? cfg.difficulty : 'Medium',
            theme: String(cfg.theme || 'General').slice(0, 100),
            description: String(cfg.description || '').slice(0, 500),
            timeLimit: clampInt(cfg.timeLimit, 60, 600, 180),
            maxAttempts: clampInt(cfg.maxAttempts, 0, 10, 0),
            minWords: clampInt(cfg.minWords, 5, 50, 10),
            points: clampInt(cfg.points, 50, 200, 100),
            tags: Array.isArray(cfg.tags) ? cfg.tags.slice(0, 5).map((t) => String(t).slice(0, 40)) : [],
            hints: Array.isArray(cfg.hints) ? cfg.hints.slice(0, 3).map((h) => String(h).slice(0, 200)) : ['', '', ''],
            evaluationMode: ['standard', 'strict', 'flexible'].includes(cfg.evaluationMode) ? cfg.evaluationMode : 'standard',
        }
    }
}
