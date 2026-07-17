import pg from 'pg'
import { config } from '../config/env.js'

/**
 * Pool único de conexiones a Postgres (Supabase).
 * Toda query de la app pasa por acá (vía Repositories).
 * El backend se conecta con credenciales de servidor: las RLS de Supabase
 * no aplican en esta conexión — este backend ES la capa de confianza.
 */
const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    // En Vercel (Fluid Compute) una misma instancia atiende varias requests
    // concurrentes; DATABASE_URL debe apuntar al Transaction pooler (6543).
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Entre invocaciones no debe quedar el event loop retenido por conexiones idle.
    allowExitOnIdle: true,
    // Supabase requiere SSL; el pooler usa certificados que Node no siempre
    // puede validar contra su CA store, de ahí rejectUnauthorized: false.
    ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
})

pool.on('error', (err) => {
    console.error('Error inesperado en cliente idle de pg:', err.message)
})

export default pool
