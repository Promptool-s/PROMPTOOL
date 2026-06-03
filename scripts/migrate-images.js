// Migra imágenes de cdn.yooprompt.org a Supabase Storage
// Uso: node scripts/migrate-images.js

// Ignorar cert autofirmado corporativo para TODOS los requests de Node
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const fs = require('fs')
const https = require('https')
const { createClient } = require('@supabase/supabase-js')

// Leer .env manualmente
const env = {}
try {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim()
  })
} catch {}

const SUPABASE_URL = 'https://rexysehzyqfxpkvajnpy.supabase.co'
const SERVICE_KEY  = env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY
const BUCKET       = 'images'

if (!SERVICE_KEY) {
  console.error('Falta SUPABASE_SERVICE_KEY en .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), ct: res.headers['content-type'] || 'image/jpeg' }))
    }).on('error', reject)
  })
}

async function run() {
  // Intentar crear bucket (si ya existe, el error se ignora)
  await supabase.storage.createBucket(BUCKET, { public: true })

  const { data: rows, error } = await supabase.from('imagenes_ia').select('id_imagen, url_image')
  if (error) { console.error('Error leyendo BD:', error.message); process.exit(1) }

  console.log(`${rows.length} imágenes encontradas\n`)

  for (const row of rows) {
    if (!row.url_image || row.url_image.includes('supabase.co')) {
      console.log(`skip  ${row.id_imagen}`)
      continue
    }

    try {
      const { buffer, ct } = await download(row.url_image)
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
      const path = `imagenes_ia/${row.id_imagen}.${ext}`

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: ct, upsert: true })
      if (upErr) throw new Error(upErr.message)

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

      const { error: dbErr } = await supabase.from('imagenes_ia').update({ url_image: publicUrl }).eq('id_imagen', row.id_imagen)
      if (dbErr) throw new Error(dbErr.message)

      console.log(`✓  ${row.id_imagen}`)
    } catch (e) {
      console.log(`✗  ${row.id_imagen}: ${e.message}`)
    }
  }

  console.log('\nlisto')
}

run()
