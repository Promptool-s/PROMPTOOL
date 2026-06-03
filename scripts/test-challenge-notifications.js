/**
 * Script de prueba para el sistema de notificaciones de challenges
 * 
 * Este script simula la creación de un challenge y verifica que las notificaciones
 * se crean correctamente para los miembros de la empresa.
 * 
 * Uso:
 * node scripts/test-challenge-notifications.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY // Necesitas la service key para este test

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno: VITE_SUPABASE_URL o SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testChallengeNotifications() {
  console.log('🧪 Iniciando test de notificaciones de challenges...\n')

  try {
    // 1. Buscar una empresa de prueba
    console.log('1️⃣ Buscando empresa de prueba...')
    const { data: companies, error: companyError } = await supabase
      .from('usuarios')
      .select('id_usuario, company_name, user_type')
      .eq('user_type', 'enterprise')
      .limit(1)

    if (companyError) throw companyError
    if (!companies || companies.length === 0) {
      console.log('⚠️  No se encontraron empresas. Crea una empresa primero.')
      return
    }

    const company = companies[0]
    console.log(`✅ Empresa encontrada: ${company.company_name} (${company.id_usuario})`)

    // 2. Buscar miembros de la empresa
    console.log('\n2️⃣ Buscando miembros de la empresa...')
    const { data: members, error: membersError } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre_display, email')
      .eq('company_id', company.id_usuario)

    if (membersError) throw membersError
    console.log(`✅ Encontrados ${members?.length || 0} miembros`)
    members?.forEach(m => console.log(`   - ${m.nombre_display || m.email}`))

    if (!members || members.length === 0) {
      console.log('⚠️  La empresa no tiene miembros. Agrega miembros primero.')
      return
    }

    // 3. Crear un challenge de prueba
    console.log('\n3️⃣ Creando challenge de prueba...')
    const testChallenge = {
      url_image: 'https://via.placeholder.com/512x512.png?text=Test+Challenge',
      prompt_original: 'Test challenge for notifications',
      image_diff: 'Medium',
      image_theme: 'Test Notification System',
      fecha: new Date().toISOString(),
      company_id: company.id_usuario,
    }

    const { data: challenge, error: challengeError } = await supabase
      .from('imagenes_ia')
      .insert([testChallenge])
      .select()
      .single()

    if (challengeError) throw challengeError
    console.log(`✅ Challenge creado: ${challenge.id_imagen}`)

    // 4. Esperar un momento para que el trigger se ejecute
    console.log('\n4️⃣ Esperando que el trigger cree las notificaciones...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 5. Verificar que se crearon las notificaciones
    console.log('\n5️⃣ Verificando notificaciones creadas...')
    const { data: notifications, error: notifError } = await supabase
      .from('challenge_notifications')
      .select('id, target_user_id, title, message, created_at')
      .eq('challenge_id', challenge.id_imagen)

    if (notifError) throw notifError

    console.log(`✅ Se crearon ${notifications?.length || 0} notificaciones`)
    notifications?.forEach(n => {
      const member = members.find(m => m.id_usuario === n.target_user_id)
      console.log(`   - Para: ${member?.nombre_display || member?.email}`)
      console.log(`     Título: ${n.title}`)
      console.log(`     Mensaje: ${n.message}`)
    })

    // 6. Verificar que NO se notificó a la empresa misma
    const companyNotified = notifications?.some(n => n.target_user_id === company.id_usuario)
    if (companyNotified) {
      console.log('\n⚠️  ADVERTENCIA: La empresa fue notificada (no debería)')
    } else {
      console.log('\n✅ Correcto: La empresa NO fue notificada')
    }

    // 7. Limpiar - eliminar el challenge de prueba
    console.log('\n6️⃣ Limpiando challenge de prueba...')
    const { error: deleteError } = await supabase
      .from('imagenes_ia')
      .delete()
      .eq('id_imagen', challenge.id_imagen)

    if (deleteError) throw deleteError
    console.log('✅ Challenge de prueba eliminado')

    console.log('\n✨ Test completado exitosamente!')

  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message)
    console.error(error)
  }
}

// Ejecutar el test
testChallengeNotifications()
