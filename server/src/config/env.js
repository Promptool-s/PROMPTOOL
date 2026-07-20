import 'dotenv/config'

const REQUIRED = ['DATABASE_URL', 'SUPABASE_JWT_SECRET', 'GROQ_API_KEY', 'MAILTRAP_API_TOKEN', 'OTP_SECRET']

/** Lista de env vars requeridas que faltan (vacío = todo OK). */
export function getMissingEnv() {
    return REQUIRED.filter((key) => !process.env[key] || process.env[key].trim() === '')
}

export function validateEnv() {
    const missing = getMissingEnv()
    if (missing.length > 0) {
        console.error(`FATAL: faltan variables de entorno requeridas: ${missing.join(', ')}`)
        console.error('Copiá .env.example a .env y completá los valores.')
        process.exit(1)
    }
}

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    corsOrigins: [
        ...(process.env.CORS_ORIGINS || 'http://localhost:5173')
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean),
        // URLs propias de Vercel (producción + previews): sin esto, los POST
        // same-origin desde un preview deployment se auto-bloquean por CORS.
        process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
        process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
        process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    ].filter(Boolean),
    databaseUrl: process.env.DATABASE_URL,
    supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
    groqApiKey: process.env.GROQ_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    isProduction: process.env.NODE_ENV === 'production',

    /**
     * Todo lo relacionado con el envío de emails (Mailtrap).
     * El dominio está registrado en Mailtrap Sending; se usa su API HTTP
     * transaccional (no requiere dependencia npm, va por fetch nativo).
     */
    email: {
        // Mailtrap → Sending Domains → tu dominio → API/SMTP → API Tokens.
        mailtrapToken: process.env.MAILTRAP_API_TOKEN,
        // Producción: https://send.api.mailtrap.io/api/send
        // Sandbox (testing inbox): https://sandbox.api.mailtrap.io/api/send/<inbox_id>
        mailtrapApiUrl: process.env.MAILTRAP_API_URL || 'https://send.api.mailtrap.io/api/send',
        // Remitente verificado en el dominio registrado en Mailtrap.
        fromEmail: process.env.MAIL_FROM_EMAIL || 'support@promptool.app',
        fromName: process.env.MAIL_FROM_NAME || 'PrompTool',
        // Secreto HMAC para firmar/verificar los tokens OTP (stateless).
        otpSecret: process.env.OTP_SECRET,
        // Base para armar las URLs de acción (confirmación, reset, magic link).
        appBaseUrl: process.env.APP_BASE_URL || 'https://promptool.app',
        // Secreto compartido con el Auth Hook de Supabase (opcional).
        authHookSecret: process.env.SUPABASE_AUTH_HOOK_SECRET || null,
    },

    /**
     * Storage server-side (avatares / imágenes de desafíos enterprise).
     * Opcionales: si faltan, los endpoints de upload responden 503 pero el
     * resto de la API funciona igual.
     */
    storage: {
        // Supabase Dashboard → Project Settings → API → Project URL
        // .trim(): en Vercel el valor llegó con espacios al final, lo que producía
        // URLs inválidas (".../%20/auth/v1/...") tanto en el redirect de auth como
        // en el fetch del JWKS. Se limpian espacios y barras finales.
        supabaseUrl: (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '') || null,
        // Supabase Dashboard → Project Settings → API → service_role (¡SECRETA!)
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
    },
}
