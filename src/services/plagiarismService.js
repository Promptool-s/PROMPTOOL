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

import { supabase } from '../supabaseClient'

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
      // Suspensión vencida — el backend la limpia en el próximo submit
      // (POST /api/intentos → _verificarSuspensionAsync); acá solo leemos.
    }

    return { allowed: true }
  } catch {
    return { allowed: true } // fail open — no bloquear por error técnico
  }
}
