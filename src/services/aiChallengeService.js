import { api } from '../lib/apiClient'

/**
 * Genera configuración de desafío usando IA (server-side).
 *
 * Antes esto llamaba a Gemini directo desde el navegador con VITE_GEMINI_API_KEY
 * en el bundle — la key ya no existe en el cliente, por eso fallaba con
 * "No se pudo generar la configuración". Ahora delega en el endpoint
 * POST /enterprise/desafios/generar, que tiene la key server-side y devuelve la
 * misma forma sanitizada (prompt, difficulty, theme, description, timeLimit,
 * maxAttempts, minWords, points, tags, hints, evaluationMode).
 *
 * La generación es por texto: se basa en la descripción del usuario (no se sube
 * la imagen acá). Sirve para los tres tipos de desafío (imagen, código, documento).
 *
 * @param {Object} params
 * @param {string} params.userPrompt - Descripción del desafío deseado
 * @param {string} params.companyIndustry - Industria de la empresa
 * @returns {Promise<Object>} Configuración del desafío generada
 */
export const generateChallengeConfig = async ({ userPrompt, companyIndustry = 'general' }) => {
  return await api.post('/enterprise/desafios/generar', {
    user_prompt: userPrompt,
    industry: companyIndustry,
  })
}
