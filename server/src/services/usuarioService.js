import UsuarioRepository from '../repositories/usuarioRepository.js'
import FollowRepository from '../repositories/followRepository.js'
import EmailService from './emailService.js'
import { throwError } from '../helpers/httpError.js'
import { isValidString, isValidHexColor, isValidUsername, isValidHttpsUrl } from '../helpers/validatorHelper.js'
import { nowAR } from '../helpers/dateHelper.js'
import { LIMITES } from '../constants/index.js'

/**
 * Reglas de negocio de perfiles de usuario.
 * La whitelist de campos editables reemplaza los updates directos a la tabla
 * `usuarios` desde UsuarioApp.jsx/ConfigModal.jsx/LangContext.jsx — el cliente
 * ya no puede tocar columnas sensibles (elo_rating, adminstate, suspension_status, ...).
 */

/** Únicos campos que el dueño del perfil puede editar. */
const CAMPOS_EDITABLES = [
    'nombre_display', 'bio', 'accent_color', 'avatar_url', 'banner_url', 'showcase_url',
    'show_company_badge', 'show_stats', 'user_onboarded', 'enterprise_onboarded', 'idioma_preferido',
    'email_publico', 'social_website', 'pais', 'idioma_display',
    'social_github', 'social_linkedin', 'social_twitter', 'pronouns', 'status',
    'organization', 'company_tagline', 'company_industry', 'company_size', 'company_founded',
]

/** Campos que además requieren perfil enterprise (gateados contra la BD). */
const CAMPOS_ENTERPRISE = ['company_name', 'industry_type']

/**
 * Vista de perfil devuelta al público (perfil ajeno). Excluye columnas
 * sensibles (email salvo email_publico, adminstate/devstate, suspensión).
 * El dueño y los admin reciben la fila completa vía _shapePerfilPropio.
 */
const CAMPOS_PERFIL_PUBLICO = [
    'id_usuario', 'nombre', 'nombre_display', 'username', 'bio', 'avatar_url', 'banner_url',
    'fecha_registro', 'total_intentos', 'promedio_score', 'mejor_score', 'peor_score',
    'porcentaje_aprobacion', 'racha_actual', 'pais', 'idioma_display',
    'social_github', 'social_linkedin', 'social_twitter', 'social_website', 'pronouns',
    'status', 'accent_color', 'organization', 'showcase_url', 'elo_rating', 'user_type',
    'company_name', 'company_id', 'company_role', 'company_joined_at', 'show_stats',
    'show_company_badge', 'verified', 'company_tagline', 'company_industry', 'company_size',
    'company_founded',
]

/** Columnas internas que nunca salen al cliente, ni siquiera al dueño. */
const CAMPOS_SECRETOS = new Set([
    'suspension_reason', 'suspension_until', 'suspension_status', 'password', 'auth_id',
])

export default class UsuarioService {
    constructor() {
        this.repo = new UsuarioRepository()
        this.followRepo = new FollowRepository()
        this.emailService = new EmailService()
    }

    getPerfilAsync = async (idUsuario) => {
        const perfil = await this.repo.getPerfilPublicoAsync(idUsuario)
        if (!perfil) throwError('Usuario no encontrado.', 404)
        return perfil
    }

    /** Fila completa del dueño/admin, menos columnas secretas. */
    _shapePerfilPropio = (row) => {
        const out = {}
        for (const [k, v] of Object.entries(row)) {
            if (!CAMPOS_SECRETOS.has(k)) out[k] = v
        }
        return out
    }

    /** Vista pública de un perfil ajeno: email solo si email_publico. */
    _shapePerfilPublico = (row) => {
        const out = {}
        for (const key of CAMPOS_PERFIL_PUBLICO) {
            if (row[key] !== undefined) out[key] = row[key]
        }
        if (row.email_publico) {
            out.email = row.email
            out.email_publico = true
        }
        return out
    }

    /**
     * Perfil completo para la página de perfil. Si el solicitante es el dueño
     * o un admin, devuelve la fila entera (sin secretos); si es ajeno, la vista
     * pública filtrada. Reemplaza el `supabase.from('usuarios').select(...)`
     * de UsuarioApp.jsx.
     */
    getPerfilVistaAsync = async (idPerfil, idSolicitante = null) => {
        const row = await this.repo.getByIdAsync(idPerfil)
        if (!row) throwError('Usuario no encontrado.', 404)
        const esDueno = idSolicitante && idSolicitante === idPerfil
        const esAdmin = idSolicitante && !esDueno && await this.repo.isAdminAsync(idSolicitante)
        return esDueno || esAdmin ? this._shapePerfilPropio(row) : this._shapePerfilPublico(row)
    }

    /**
     * Estado de suspensión del propio usuario para el banner de UX (App.jsx).
     * Devuelve el estado DERIVADO (allowed/reason/until), no las columnas
     * secretas crudas — reemplaza el read directo de plagiarismService.js del
     * cliente. El control real sigue en POST /api/intentos (403).
     */
    getEstadoSuspensionAsync = async (idUsuario) => {
        const susp = await this.repo.getSuspensionAsync(idUsuario)
        if (!susp?.suspension_status || susp.suspension_status === 'none') return { allowed: true }
        if (susp.suspension_status === 'banned') {
            return { allowed: false, reason: susp.suspension_reason || 'Cuenta suspendida permanentemente.' }
        }
        if (susp.suspension_status === 'suspended') {
            const until = susp.suspension_until ? new Date(susp.suspension_until) : null
            if (until && until > new Date()) {
                return {
                    allowed: false,
                    reason: susp.suspension_reason || 'Cuenta suspendida temporalmente.',
                    until: susp.suspension_until,
                }
            }
        }
        return { allowed: true }
    }

    /** Resuelve un username a su id (para /user/:username). */
    getIdPorUsernameAsync = async (username) => {
        const user = await this.repo.getByUsernameAsync(username)
        if (!user) throwError('No existe un usuario con ese nombre.', 404)
        return { id_usuario: user.id_usuario }
    }

    /** Búsqueda pública de usuarios (feature de comparar perfiles). */
    buscarAsync = async (q, limit = 5) => {
        const term = typeof q === 'string' ? q.trim() : ''
        if (term.length < 2) return []
        return await this.repo.searchPublicAsync(term.slice(0, 60), Math.min(Math.max(limit, 1), 10))
    }

    /** Roster público de una empresa (perfil de empresa). */
    getMiembrosPublicosAsync = async (companyId, limit = 24) =>
        await this.repo.getMiembrosPublicosAsync(companyId, Math.min(Math.max(limit, 1), 50))

    /**
     * Crea el perfil tras el signup (email/Google). El id y el email vienen del
     * JWT (params confiables), no del body. Idempotente: si ya existe, no falla.
     * Reemplaza el upsert/insert de `usuarios` Y el sendWelcomeOnce que hacía
     * useAuth.js con supabase directo: además del alta, dispara el mail de
     * bienvenida "una vez por cuenta" server-side (race-safe + fire-and-forget).
     */
    crearPerfilAsync = async ({ idUsuario, email, body = {} }) => {
        if (body.username !== undefined && body.username !== null && !isValidUsername(body.username)) {
            throwError('El username debe tener 3–30 caracteres (letras, números, _ o .).', 400)
        }
        if (body.username && await this.repo.usernameExistsAsync(body.username)) {
            // Si ya existe el username en otro usuario, lo dejamos sin setear (no bloqueamos el alta)
            const dueno = await this.repo.getByUsernameAsync(body.username)
            if (dueno && dueno.id_usuario !== idUsuario) {
                throwError('Ese nombre de usuario ya está en uso.', 409)
            }
        }

        const esEnterprise = body.user_type === 'enterprise'
        const nombreDisplay = body.nombre_display ?? (esEnterprise ? body.company_name : null) ?? body.nombre ?? null
        await this.repo.crearPerfilSiNoExisteAsync({
            id_usuario: idUsuario,
            email,
            nombre: body.nombre ?? null,
            nombre_display: nombreDisplay,
            username: body.username ?? null,
            avatar_url: body.avatar_url ?? null,
            user_type: esEnterprise ? 'enterprise' : 'individual',
            company_name: esEnterprise ? (body.company_name ?? body.nombre ?? null) : null,
            idioma_preferido: ['es', 'en'].includes(body.idioma_preferido) ? body.idioma_preferido : 'es',
            accepted_terms: !!body.accepted_terms,
            email_marketing: !!body.email_marketing,
        })

        // AWAITED (no fire-and-forget): en este entorno serverless el trabajo
        // post-respuesta (waitUntil) no corre confiable, así que el claim del
        // flag no quedaba seteado y el mail no salía. Se espera todo el flujo
        // antes de responder — agrega ~0.5s solo la PRIMERA vez (el claim corta
        // en los logins siguientes). No frena el alta si el envío falla.
        await this._enviarBienvenidaUnaVez(idUsuario, body.lang)
        return await this.repo.getPerfilPublicoAsync(idUsuario)
    }

    /**
     * Envía el mail de bienvenida UNA sola vez por cuenta, de forma race-safe.
     * El claim atómico (welcome_email_sent false→true) garantiza un único envío
     * aunque el alta y el SIGNED_IN corran en paralelo o haya varias pestañas.
     * Si el envío falla, revierte el flag para reintentar en el próximo login
     * (entrega al-menos-una-vez). Toda excepción se traga: la bienvenida nunca
     * debe hacer fallar el alta del perfil.
     */
    _enviarBienvenidaUnaVez = async (idUsuario, lang) => {
        try {
            const claimed = await this.repo.claimWelcomeEmailAsync(idUsuario)
            if (!claimed) return // ya se envió, o lo ganó otro llamado

            const u = await this.repo.getByIdAsync(idUsuario)
            if (!u?.email) {
                await this.repo.revertWelcomeEmailAsync(idUsuario)
                return
            }
            const nombre = u.nombre_display || u.nombre || u.email.split('@')[0]
            const idioma = ['es', 'en'].includes(lang) ? lang : (u.idioma_preferido || 'es')

            try {
                await this.emailService.sendWelcomeAsync({
                    nombre, email: u.email, userType: u.user_type || 'individual', lang: idioma,
                })
            } catch (err) {
                console.error('[welcome-email] falló, revierto flag:', err?.message)
                await this.repo.revertWelcomeEmailAsync(idUsuario).catch(() => {})
            }
        } catch (err) {
            console.error('[welcome-email] error inesperado:', err?.message)
        }
    }

    /** Chequeo de disponibilidad de username (registro). */
    usernameDisponibleAsync = async (username) => {
        if (!isValidUsername(username)) {
            throwError('Username inválido (3–30 caracteres: letras, números, _ o .).', 400)
        }
        const existe = await this.repo.usernameExistsAsync(username)
        return { username, disponible: !existe }
    }

    /** Resuelve el email a partir del username (login por username). */
    getEmailPorUsernameAsync = async (username) => {
        const user = await this.repo.getByUsernameAsync(username)
        if (!user) throwError('No existe un usuario con ese nombre.', 404)
        return { email: user.email }
    }

    updatePerfilAsync = async (idUsuario, body) => {
        const fields = {}
        for (const key of CAMPOS_EDITABLES) {
            if (body[key] !== undefined) fields[key] = body[key]
        }

        // Cambio de username: validación + cooldown de 7 días + unicidad.
        // El server fija username_last_changed (el cliente no puede saltearlo).
        if (body.username !== undefined && body.username !== null && body.username !== '') {
            const actual = await this.repo.getByIdAsync(idUsuario)
            if (actual && body.username !== actual.username) {
                if (!isValidUsername(body.username)) {
                    throwError('El username debe tener 3–30 caracteres (letras, números, _ o .).', 400)
                }
                const last = actual.username_last_changed ? new Date(actual.username_last_changed) : null
                const dias = last ? (Date.now() - last.getTime()) / 86_400_000 : Infinity
                if (dias < 7) throwError('Solo podés cambiar tu username cada 7 días.', 429)
                if (await this.repo.usernameExistsAsync(body.username)) {
                    throwError('Ese nombre de usuario ya está en uso.', 409)
                }
                fields.username = body.username
                fields.username_last_changed = nowAR()
            }
        }

        // Los campos de empresa solo aplican a perfiles enterprise (verificado
        // contra la BD, nunca contra user_metadata del token).
        const pideEnterprise = CAMPOS_ENTERPRISE.some((key) => body[key] !== undefined)
        if (pideEnterprise) {
            const usuario = await this.repo.getByIdAsync(idUsuario)
            if (usuario?.user_type !== 'enterprise') {
                throwError('Los campos de empresa requieren un perfil enterprise.', 403)
            }
            for (const key of CAMPOS_ENTERPRISE) {
                if (body[key] !== undefined) fields[key] = body[key]
            }
        }

        if (Object.keys(fields).length === 0) {
            throwError('No hay campos editables en la solicitud.', 400)
        }

        if (fields.bio !== undefined && !isValidString(String(fields.bio ?? ''), { min: 0, max: LIMITES.BIO_MAX_CHARS })) {
            throwError(`La bio no puede superar ${LIMITES.BIO_MAX_CHARS} caracteres.`, 400)
        }
        if (fields.nombre_display !== undefined && !isValidString(fields.nombre_display, { min: 1, max: LIMITES.NOMBRE_MAX_CHARS })) {
            throwError('El nombre para mostrar no es válido.', 400)
        }
        if (fields.accent_color !== undefined && !isValidHexColor(fields.accent_color)) {
            throwError('El color debe ser hexadecimal (#rrggbb).', 400)
        }
        for (const flag of ['show_company_badge', 'show_stats', 'user_onboarded', 'email_publico']) {
            if (fields[flag] !== undefined && typeof fields[flag] !== 'boolean') {
                throwError(`${flag} debe ser booleano.`, 400)
            }
        }
        for (const urlField of ['showcase_url', 'banner_url', 'social_website']) {
            if (fields[urlField] !== undefined && fields[urlField] !== null && fields[urlField] !== '' && !isValidHttpsUrl(fields[urlField])) {
                throwError(`${urlField} debe ser una URL https válida.`, 400)
            }
        }
        if (fields.idioma_preferido !== undefined && !['es', 'en'].includes(fields.idioma_preferido)) {
            throwError('idioma_preferido debe ser "es" o "en".', 400)
        }
        if (fields.company_name !== undefined && !isValidString(fields.company_name, { min: 1, max: 100 })) {
            throwError('El nombre de la empresa no es válido (máx. 100 caracteres).', 400)
        }
        if (fields.industry_type !== undefined && !isValidString(String(fields.industry_type ?? ''), { min: 0, max: 60 })) {
            throwError('industry_type no es válido (máx. 60 caracteres).', 400)
        }

        const updated = await this.repo.updatePerfilAsync(idUsuario, fields)
        if (!updated) throwError('Usuario no encontrado.', 404)
        return await this.getPerfilVistaAsync(idUsuario, idUsuario)
    }

    // ── Follows (reemplaza los insert/delete directos de UsuarioApp.jsx) ─────

    /** Estado de seguimiento + contadores de un perfil. */
    getFollowInfoAsync = async (idPerfil, idSolicitante = null) => {
        const counts = await this.followRepo.getCountsAsync(idPerfil)
        const isFollowing = idSolicitante && idSolicitante !== idPerfil
            ? await this.followRepo.isFollowingAsync(idSolicitante, idPerfil)
            : false
        return { followers: counts.followers, following: counts.following, is_following: isFollowing }
    }

    followAsync = async (idSolicitante, idPerfil) => {
        if (idSolicitante === idPerfil) throwError('No podés seguirte a vos mismo.', 400)
        const existe = await this.repo.getPerfilPublicoAsync(idPerfil)
        if (!existe) throwError('Usuario no encontrado.', 404)
        await this.followRepo.followAsync(idSolicitante, idPerfil)
        return await this.getFollowInfoAsync(idPerfil, idSolicitante)
    }

    unfollowAsync = async (idSolicitante, idPerfil) => {
        await this.followRepo.unfollowAsync(idSolicitante, idPerfil)
        return await this.getFollowInfoAsync(idPerfil, idSolicitante)
    }
}
