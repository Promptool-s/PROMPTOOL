/**
 * Constantes centralizadas (evita números mágicos repartidos por el código,
 * punto débil señalado en la guía de arquitectura).
 */

export const MODOS_INTENTO = ['random', 'daily', 'challenge', 'enterprise']

/** Modos que puntúan para ELO/ranking (mismos criterios que el frontend actual). */
export const MODOS_RANKED = ['random', 'daily']

/** Mínimo de intentos rankeados antes de que el ELO empiece a moverse. */
export const MIN_INTENTOS_PARA_ELO = 5

export const LIMITES = {
    PROMPT_MAX_CHARS: 2000,
    ELAPSED_MAX_SECONDS: 3600,
    ATTEMPT_NUMBER_MAX: 10,
    BIO_MAX_CHARS: 500,
    NOMBRE_MAX_CHARS: 60,
}

export const SUSPENSION = {
    NONE: 'none',
    WARNED: 'warned',
    SUSPENDED: 'suspended',
    BANNED: 'banned',
}
