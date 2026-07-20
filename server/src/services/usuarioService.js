import UsuarioRepository from '../repositories/usuarioRepository.js'
import FollowRepository from '../repositories/followRepository.js'
import EmailService from './emailService.js'
import { fireAndForget } from '../helpers/backgroundTask.js'
import { throwError } from '../helpers/httpError.js'
import { isValidString, isValidHexColor, isValidUsername, isValidHttpsUrl } from '../helpers/validatorHelper.js'
import { LIMITES } from '../constants/index.js'

/**
 * Reglas de negocio de perfiles de usuario.
 * La whitelist de campos editables reemplaza los updates directos a la tabla
 * `usuarios` desde UsuarioApp.jsx/ConfigModal.jsx/LangContext.jsx — el cliente
 * ya no puede tocar columnas sensibles (elo_rating, adminstate, suspension_status, ...).
 */

/** Únicos campos que el dueño del perfil puede editar. */
const CAMPOS_EDITABLES = [
    'nombre_display', 'bio', 'accent_color', 'avatar_url', 'show_company_badge',
    'user_onboarded', 'showcase_url', 'idioma_preferido',
]

/** Campos que además requieren perfil enterprise (gateados contra la BD). */
const CAMPOS_ENTERPRISE = ['company_name', 'social_website', 'email_publico', 'industry_type']

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

        this._enviarBienvenidaUnaVez(idUsuario, body.lang)
        return await this.repo.getPerfilPublicoAsync(idUsuario)
    }

    /**
     * Envía el mail de bienvenida UNA sola vez por cuenta, de forma race-safe.
     * El claim atómico (welcome_email_sent false→true) garantiza un único envío
     * aunque el alta y el SIGNED_IN corran en paralelo o haya varias pestañas.
     * Fire-and-forget: no bloquea la respuesta. Si el envío falla, revierte el
     * flag para reintentar en el próximo login (entrega al-menos-una-vez).
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

            const envio = this.emailService
                .sendWelcomeAsync({ nombre, email: u.email, userType: u.user_type || 'individual', lang: idioma })
                .catch(async (err) => {
                    console.error('[welcome-email] falló, revierto flag:', err?.message)
                    await this.repo.revertWelcomeEmailAsync(idUsuario).catch(() => {})
                })
            fireAndForget(envio, 'welcome-email')
        } catch (err) {
            console.error('[welcome-email] error en el claim:', err?.message)
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
        for (const flag of ['show_company_badge', 'user_onboarded', 'email_publico']) {
            if (fields[flag] !== undefined && typeof fields[flag] !== 'boolean') {
                throwError(`${flag} debe ser booleano.`, 400)
            }
        }
        for (const urlField of ['showcase_url', 'social_website']) {
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
        return await this.repo.getPerfilPublicoAsync(idUsuario)
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
