process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const env = {}
fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})
const sb = createClient('https://rexysehzyqfxpkvajnpy.supabase.co', env.SUPABASE_SERVICE_KEY)

async function run() {
  // Hacer el bucket público
  const { error } = await sb.storage.updateBucket('images', { public: true })
  if (error) {
    console.log('Error actualizando bucket:', error.message)
  } else {
    console.log('Bucket "images" ahora es público')
  }

  // Verificar con una URL de prueba
  const { data } = sb.storage.from('images').getPublicUrl('imagenes_ia/6087114c-e0ff-4f88-b065-75e87e3641c9.jpg')
  console.log('URL de prueba:', data.publicUrl)
}

run()
