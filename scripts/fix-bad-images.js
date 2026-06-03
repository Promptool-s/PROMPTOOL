// Desde una máquina SIN Fortinet:
// 1. Descarga las 17 imágenes malas directo de cdn.yooprompt.org
// 2. Las sube correctamente a Supabase Storage
// 3. Guarda en .img-cache local
// Uso: node scripts/fix-bad-images.js

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const fs = require('fs')
const https = require('https')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const env = {}
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim()
  })
} catch {}

const SUPABASE_URL = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_KEY  = env.SUPABASE_SERVICE_KEY
const CACHE_DIR    = path.join(__dirname, '..', '.img-cache')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_KEY en .env')
  process.exit(1)
}
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR)

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

function isRealImage(buf) {
  const h = buf.slice(0, 4).toString('hex')
  return h.startsWith('ffd8') || h.startsWith('89504e47') ||
         h.startsWith('52494646') || h.startsWith('47494638')
}

function download(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
        'Referer': 'https://promptool.vercel.app/',
        ...extraHeaders,
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location, extraHeaders))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        ct: res.headers['content-type'] || 'image/jpeg',
        status: res.statusCode,
      }))
    })
    req.on('error', reject)
    req.end()
  })
}

async function run() {
  // Leer todas las filas
  const { data: rows, error } = await sb.from('imagenes_ia').select('id_imagen, url_image')
  if (error) { console.error('Error BD:', error.message); process.exit(1) }

  // Identificar las malas: las que están en Supabase pero son HTML
  const bad = []
  for (const row of rows) {
    if (!row.url_image || !row.id_imagen) continue
    const ext = ['jpg','png','webp','gif','avif'].find(e =>
      fs.existsSync(path.join(CACHE_DIR, `${row.id_imagen}.${e}`))
    )
    if (ext) {
      const buf = fs.readFileSync(path.join(CACHE_DIR, `${row.id_imagen}.${ext}`))
      if (!isRealImage(buf)) bad.push(row)
    } else {
      bad.push(row)
    }
  }

  console.log(`${bad.length} imágenes a reparar\n`)
  if (bad.length === 0) { console.log('Todo ok'); return }

  let fixed = 0, errors = 0

  for (let i = 0; i < bad.length; i += 5) {
    const batch = bad.slice(i, i + 5)
    await Promise.all(batch.map(async (row) => {
      // La URL en BD es de Supabase pero el archivo es HTML
      // Necesitamos la URL original — está guardada en el nombre del archivo en Storage
      // Intentar descargar desde la URL de Supabase con auth
      const { buffer, ct, status } = await download(row.url_image, {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      }).catch(e => ({ buffer: Buffer.alloc(0), ct: '', status: 0 }))

      if (!isRealImage(buffer)) {
        console.log(`✗ ${row.id_imagen}: sigue siendo HTML (status ${status})`)
        errors++
        return
      }

      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
      const filename = `${row.id_imagen}.${ext}`
      const cachePath = path.join(CACHE_DIR, filename)

      // Guardar en cache local
      fs.writeFileSync(cachePath, buffer)

      // Resubir a Supabase Storage (sobreescribir el HTML con la imagen real)
      const storagePath = `imagenes_ia/${filename}`
      const { error: upErr } = await sb.storage.from('images')
        .upload(storagePath, buffer, { contentType: ct, upsert: true })

      if (upErr) {
        console.log(`✗ ${row.id_imagen}: error subiendo: ${upErr.message}`)
        errors++
        return
      }

      console.log(`✓ ${row.id_imagen} (${ext}, ${(buffer.length/1024).toFixed(0)}KB)`)
      fixed++
    }))
  }

  console.log(`\nlisto: ${fixed} reparadas, ${errors} errores`)
}

run()
