const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const IS_DEV = import.meta.env.DEV

// Extrae UUID de una URL (formato estándar 8-4-4-4-12)
function extractUUID(url) {
  const m = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  return m ? m[1] : null
}

export function proxyImg(url) {
  if (!url) return url
  const raw = String(url).trim()
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return raw

  // En desarrollo: usar URLs directas de Supabase (sin caché)
  // El caché solo funciona en producción con Vercel
  if (IS_DEV) {
    return raw
  }

  // Producción: Supabase Storage va directo, externas por proxy
  if (SUPABASE_URL && raw.startsWith(SUPABASE_URL)) return raw
  return `/api/img-proxy?url=${encodeURIComponent(raw)}`
}
