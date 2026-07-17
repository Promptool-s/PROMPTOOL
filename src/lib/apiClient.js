import { supabase } from '../supabaseClient'

/**
 * Cliente central para llamar al backend (/api/*).
 * Inyecta automáticamente el access token de la sesión de Supabase como
 * Authorization: Bearer (el backend lo verifica server-side) y normaliza los
 * errores: cualquier respuesta no-2xx se lanza como ApiError con el mensaje
 * del backend ({ message }) y el status HTTP.
 */

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const h = { ...headers }
  const isRaw = body instanceof Blob || body instanceof File || body instanceof ArrayBuffer
  if (body !== undefined && !isRaw && !h['Content-Type']) h['Content-Type'] = 'application/json'

  if (auth && supabase) {
    const { data: { session } = {} } = await supabase.auth.getSession()
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers: h,
    body: isRaw ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(data?.message || data?.error || `Error ${res.status}`, res.status, data)
  }
  return data
}

export const api = {
  get: (path, opts) => request(path, { ...opts }),
  post: (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  put: (path, body, opts) => request(path, { method: 'PUT', body, ...opts }),
  patch: (path, body, opts) => request(path, { method: 'PATCH', body, ...opts }),
  del: (path, opts) => request(path, { method: 'DELETE', ...opts }),
  /** Para uploads binarios (avatar, imagen de desafío): body crudo + Content-Type explícito. */
  postRaw: (path, blob, contentType, opts) =>
    request(path, { method: 'POST', body: blob, headers: { 'Content-Type': contentType }, ...opts }),
}
