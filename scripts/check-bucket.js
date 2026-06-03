process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})
const sb = createClient(env.VITE_SUPABASE_URL.replace(/\/$/, ''), env.SUPABASE_SERVICE_KEY)

async function run() {
  const { data, error } = await sb.storage.from('images').list('imagenes_ia', { limit: 100 })
  if (error) { console.log('Error:', error.message); return }
  console.log(`${data.length} archivos en bucket images/imagenes_ia:`)
  data.forEach(f => console.log(' ', f.name, (f.metadata?.size/1024).toFixed(0)+'KB'))
}
run()
