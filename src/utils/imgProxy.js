/**
 * Pasa una URL de imagen por el proxy /api/img-proxy para evitar bloqueos
 * de sitios institucionales. Solo aplica a URLs externas (http/https).
 * Las URLs de Supabase Storage se devuelven sin cambios.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

export function proxyImg(url) {
  if (!url) return url
  const raw = String(url).trim()

  // No proxear blobs ni rutas relativas
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return raw

  // No proxear imágenes que ya vienen de Supabase Storage (no están bloqueadas)
  if (SUPABASE_URL && raw.startsWith(SUPABASE_URL)) return raw

  // Pasar por el proxy
  return `/api/img-proxy?url=${encodeURIComponent(raw)}`
}
