const { defineConfig } = require('vite')
const react = require('@vitejs/plugin-react')
const { resolve, join } = require('path')
const fs = require('fs')
const https = require('https')
const http = require('http')

const CACHE_DIR = join(__dirname, '.img-cache')
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR)

// Mapa id_imagen → nombre de archivo local (se llena al descargar)
const ID_MAP_FILE = join(CACHE_DIR, '_map.json')
let idMap = {}
try { idMap = JSON.parse(fs.readFileSync(ID_MAP_FILE, 'utf8')) } catch {}

function readEnv() {
  const env = {}
  try {
    fs.readFileSync(join(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=')
      if (k && v.length) env[k.trim()] = v.join('=').trim()
    })
  } catch {}
  return env
}

function downloadBuffer(url, serviceKey) {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith('https://') ? https : http
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*,*/*' }
    // Si es URL de Supabase Storage, autenticar con service key
    if (url.includes('supabase.co')) {
      headers['Authorization'] = `Bearer ${serviceKey}`
      headers['apikey'] = serviceKey
    }
    const req = transport.request(url, { method: 'GET', rejectUnauthorized: false, headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBuffer(res.headers.location, serviceKey))
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)) }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), ct: res.headers['content-type'] || 'image/jpeg' }))
    })
    req.on('error', reject)
    req.end()
  })
}

async function prefetchImages() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  const env = readEnv()
  const serviceKey = env.SUPABASE_SERVICE_KEY
  const supabaseUrl = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  if (!serviceKey || !supabaseUrl) return

  let rows
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/imagenes_ia?select=id_imagen,url_image`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
    })
    rows = await res.json()
  } catch (e) { console.log('[img-cache] Error leyendo BD:', e.message); return }

  if (!Array.isArray(rows) || rows.length === 0) return
  console.log(`\n[img-cache] ${rows.length} imágenes, descargando de a 5...`)

  const BATCH = 5
  let done = 0, skipped = 0, errors = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await Promise.all(batch.map(async (row) => {
      if (!row.url_image || !row.id_imagen) return
      // Ya está en el mapa y el archivo existe
      if (idMap[row.id_imagen] && fs.existsSync(join(CACHE_DIR, idMap[row.id_imagen]))) {
        skipped++; return
      }
      try {
        const { buffer, ct } = await downloadBuffer(row.url_image, serviceKey)
        // Verificar que sea imagen real (no HTML de error)
        if (ct.includes('text/html') || buffer.length < 1000) {
          errors++; return
        }
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg'
        const filename = `${row.id_imagen}.${ext}`
        fs.writeFileSync(join(CACHE_DIR, filename), buffer)
        idMap[row.id_imagen] = filename
        done++
      } catch { errors++ }
    }))
    process.stdout.write(`\r[img-cache] ${done} descargadas, ${skipped} cacheadas, ${errors} errores   `)
  }

  // Guardar mapa actualizado
  fs.writeFileSync(ID_MAP_FILE, JSON.stringify(idMap, null, 2))
  console.log(`\n[img-cache] listo`)
}

module.exports = defineConfig({
  plugins: [
    react(),
    {
      name: 'img-cache-dev',
      configureServer(server) {
        prefetchImages().catch(() => {})

        server.middlewares.stack.unshift({
          route: '',
          handle: (req, res, next) => {
            if (!req.url?.startsWith('/.img-cache/')) return next()
            const nameRaw = req.url.replace('/.img-cache/', '').split('?')[0]
            // Si viene sin extensión, buscar el archivo con cualquier extensión
            let filePath = join(CACHE_DIR, nameRaw)
            if (!fs.existsSync(filePath)) {
              const found = ['jpg', 'png', 'webp', 'gif', 'avif']
                .map(e => join(CACHE_DIR, `${nameRaw}.${e}`))
                .find(p => fs.existsSync(p))
              if (!found) { res.statusCode = 404; res.end('Not found'); return }
              filePath = found
            }
            const ext = filePath.split('.').pop()
            const ct = { png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' }[ext] || 'image/jpeg'
            res.setHeader('Content-Type', ct)
            res.setHeader('Cache-Control', 'public, max-age=86400')
            fs.createReadStream(filePath).pipe(res)
          }
        })
      }
    },
    {
      name: 'clean-url-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url.split('?')[0]
          const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
          if (url.startsWith('/media/')) { res.statusCode = 403; res.end('Forbidden'); return }
          if (/^\/user\/[^/]+/.test(url)) { req.url = '/user.html' + query }
          else if (url === '/admin' || url === '/admin/') { req.url = '/admin.html' + query }
          else if (url === '/guides' || url === '/guides/') { req.url = '/guides.html' + query }
          else if (url === '/support' || url === '/support/') { req.url = '/support.html' + query }
          else if (url === '/terms' || url === '/terms/') { req.url = '/terms.html' + query }
          else if (url === '/privacy' || url === '/privacy/') { req.url = '/privacy.html' + query }
          else if (url === '/tournaments' || url === '/tournaments/') { req.url = '/tournaments.html' + query }
          else if (url === '/leaderboard' || url === '/leaderboard/') { req.url = '/leaderboard.html' + query }
          else if (url === '/perfil' || url === '/perfil/' || url.startsWith('/perfil?')) { req.url = '/usuario.html' + query }
          next()
        })
      },
    },
  ],
  build: {
    assetsInlineLimit: 1024 * 1024,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        guides: resolve(__dirname, 'guides.html'),
        usuario: resolve(__dirname, 'usuario.html'),
        admin: resolve(__dirname, 'admin.html'),
        user: resolve(__dirname, 'user.html'),
        tournaments: resolve(__dirname, 'tournaments.html'),
        leaderboard: resolve(__dirname, 'leaderboard.html'),
        support: resolve(__dirname, 'support.html'),
        terms: resolve(__dirname, 'terms.html'),
        privacy: resolve(__dirname, 'privacy.html'),
      },
    },
  },
})
