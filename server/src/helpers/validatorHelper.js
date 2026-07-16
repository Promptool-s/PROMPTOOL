/**
 * Validadores puros, sin estado ni acceso a BD.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isValidUUID = (value) => typeof value === 'string' && UUID_RE.test(value)

export const isValidString = (value, { min = 1, max = 10_000 } = {}) =>
    typeof value === 'string' && value.trim().length >= min && value.trim().length <= max

export const isValidId = (value) => Number.isInteger(value) && value > 0

/** Acepta UUID o entero positivo — las PKs de PrompTool varían por tabla. */
export const isValidPk = (value) =>
    isValidUUID(value) || isValidId(value) || (typeof value === 'string' && /^\d+$/.test(value))

export const clamp = (value, min = 0, max = 100) =>
    Math.min(max, Math.max(min, Number(value) || 0))

export const clampInt = (value, min, max, fallback) => {
    const n = parseInt(value, 10)
    if (Number.isNaN(n)) return fallback
    return Math.min(max, Math.max(min, n))
}

export const isValidHexColor = (value) =>
    typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

/** Username: 3–30 chars, letras/números/guion bajo/punto. */
export const isValidUsername = (value) =>
    typeof value === 'string' && /^[a-z0-9_.]{3,30}$/i.test(value)

/** Email con forma básica (la verificación real la hace Supabase Auth). */
export const isValidEmail = (value) =>
    typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/** URL https válida y acotada (para campos de perfil como showcase/website). */
export const isValidHttpsUrl = (value, { max = 300 } = {}) => {
    if (typeof value !== 'string' || value.length > max) return false
    try {
        return new URL(value).protocol === 'https:'
    } catch {
        return false
    }
}
