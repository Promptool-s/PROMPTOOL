// Descarga todas las imágenes de imagenes_ia al .img-cache local
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const fs = require('fs')
const https = require('https')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})

const SUPABASE_URL = env.VITE_SUPABASE_URL.replace(/\/$/, '')
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY
const CACHE_DIR = path.join(__dirname, '..', '.img-cache')

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR)

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

function isRealImage(buffer) {
  const h = buffer.slice(0, 4).toString('hex')
  return h.startsWith('ffd8')       // JPEG
      || h.startsWith('89504e47')   // PNG
      || h.startsWith('52494646')   // WEBP (RIFF)
      || h.startsWith('47494638')   // GIF
}

function downloadWithAuth(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      rejectUnauthorized: false,
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'User-Agent': 'Mozilla/5.0',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadWithAuth(res.headers.location))
      }
      const ct = res.headers['content-type'] || ''
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), ct }))
    })
    req.on('error', reject)
    req.end()
  })
}

async function run() {
  // Primero borrar archivos que son HTML disfrazados
  let cleaned = 0
  fs.readdirSync(CACHE_DIR).forEach(f => {
    if (f === '_map.json') return
    const fp = path.join(CACHE_DIR, f)
    const buf = fs.readFileSync(fp)
    if (!isRealImage(buf)) {
      fs.unlinkSync(fp)
      cleaned++
    }
  })
  if (cleaned > 0) console.log(`Borrados ${cleaned} archivos falsos del cache\n`)

  const { data: rows } = await sb.from('imagenes_ia').select('id_imagen, url_image')
  console.log(`${rows.length} imágenes en BD\n`)

  let done = 0, skip = 0, err = 0

  for (let i = 0; i < rows.length; i += 5) {
    const batch = rows.slice(i, i + 5)
    await Promise.all(batch.map(async row => {
      if (!row.url_image || !row.id_imagen) return

      const existing = ['jpg','png','webp','gif','avif']
        .find(e => fs.existsSync(path.join(CACHE_DIR, `${row.id_imagen}.${e}`)))
      if (existing) { skip++; return }

      try {
        const { buffer, ct } = await downloadWithAuth(row.url_image)
        if (!isRealImage(buffer)) {
          console.log(`✗ ${row.id_imagen}: no es imagen (${ct}, ${buffer.length}B, inicio: ${buffer.slice(0,20).toString().replace(/\n/g,' ')})`)
          err++; return
        }
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg'
        fs.writeFileSync(path.join(CACHE_DIR, `${row.id_imagen}.${ext}`), buffer)
        console.log(`✓ ${row.id_imagen} (${ext}, ${(buffer.length/1024).toFixed(0)}KB)`)
        done++
      } catch(e) {
        console.log(`✗ ${row.id_imagen}: ${e.message}`)
        err++
      }
    }))
  }

  console.log(`\nlisto: ${done} descargadas, ${skip} ya existían, ${err} errores`)
}

run()
