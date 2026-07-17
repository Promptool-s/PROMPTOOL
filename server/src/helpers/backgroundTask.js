import { waitUntil } from '@vercel/functions'

/**
 * Ejecuta una promesa sin bloquear la respuesta HTTP.
 * En Vercel la función se congela apenas se envía la respuesta, así que el
 * trabajo pendiente se registra con waitUntil() para que sobreviva al freeze.
 * En local queda corriendo en el proceso, igual que el fire-and-forget clásico.
 */
export function fireAndForget(promise, label = 'bg') {
    const guarded = Promise.resolve(promise).catch((error) => {
        console.error(`[${label}]`, error?.message)
    })
    if (process.env.VERCEL) waitUntil(guarded)
    return guarded
}
