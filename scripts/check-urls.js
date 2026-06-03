process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})
const sb = createClient('https://rexysehzyqfxpkvajnpy.supabase.co', env.SUPABASE_SERVICE_KEY)
sb.from('imagenes_ia').select('id_imagen, url_image').then(({ data }) => {
  data.forEach(r => console.log(r.url_image?.substring(0, 90)))
})
