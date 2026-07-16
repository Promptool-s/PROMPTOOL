/**
 * Devuelve la fecha/hora actual en UTC-3 (Argentina) como string ISO 8601.
 * Formato: "2026-04-23T14:30:00.000-03:00"
 * Portado de src/utils/dateAR.js del frontend para mantener el mismo formato
 * en la columna intentos.fecha_hora.
 */
export const nowAR = () => {
    const now = new Date()
    // UTC-3 fijo (Argentina no tiene DST)
    const offsetMs = -3 * 60 * 60 * 1000
    const ar = new Date(now.getTime() + offsetMs)
    return ar.toISOString().replace('Z', '-03:00')
}
