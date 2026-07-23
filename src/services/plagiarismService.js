/**
 * Chequeo de suspensión — lectura proactiva client-side.
 *
 * La detección de plagio en sí (análisis de similitud, flags, escalada de
 * suspensión) corre server-side dentro de POST /api/intentos desde que se
 * migró el submit de App.jsx (ver server/src/services/plagiarismService.js).
 * Lo único que queda acá es esta lectura de UX: mostrar el banner de
 * "cuenta suspendida" apenas el usuario entra, sin esperar a que intente
 * jugar. No es el control de seguridad real — eso lo hace el backend, que
 * corta con 403 igual si el chequeo de acá fallara o se saltara.
 */

import { api } from '../lib/apiClient'

/**
 * Verifica si un usuario está suspendido antes de permitir un intento.
 * El estado derivado lo calcula el backend; acá solo se formatea la fecha.
 * @returns {{ allowed: boolean, reason?: string, until?: string }}
 */
export const checkSuspension = async (userId) => {
  if (!userId) return { allowed: true }
  try {
    const estado = await api.get('/usuarios/me/suspension')
    if (!estado || estado.allowed) return { allowed: true }
    const until = estado.until
      ? new Date(estado.until).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
      : undefined
    return { allowed: false, reason: estado.reason, ...(until ? { until } : {}) }
  } catch {
    return { allowed: true } // fail open — no bloquear por error técnico
  }
}
