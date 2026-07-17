import EmpresaRepository from '../repositories/empresaRepository.js'
import InvitacionRepository from '../repositories/invitacionRepository.js'
import SupabaseRpcRepository from '../repositories/supabaseRpcRepository.js'
import UsuarioRepository from '../repositories/usuarioRepository.js'
import EmailService from './emailService.js'
import { config } from '../config/env.js'
import { throwError } from '../helpers/httpError.js'
import { fireAndForget } from '../helpers/backgroundTask.js'
import { isValidString, isValidUUID, isValidHexColor, isValidHttpsUrl, clampInt } from '../helpers/validatorHelper.js'
import { nowAR } from '../helpers/dateHelper.js'

/**
 * Reglas de negocio del bloque enterprise: equipo, roles, invitaciones,
 * guías y desafíos de empresa.
 *
 * Reemplaza las llamadas directas de EnterprisePanel.jsx / UsuarioApp.jsx /
 * CompanyPanel.jsx / EnterpriseOnboarding.jsx a Supabase. Las mutaciones de
 * membresía/roles reusan las RPCs SECURITY DEFINER existentes (vía
 * supabaseRpcRepository, con la identidad verificada del JWT); el resto es SQL
 * directo con whitelist.
 */

const DIFICULTADES = ['Easy', 'Medium', 'Hard']
const EVAL_MODES = ['standard', 'strict', 'flexible']
const INV_ESTADOS_RECHAZO = ['rejected', 'cancelled']

export default class EnterpriseService {
    constructor() {
        this.empresaRepo = new EmpresaRepository()
        this.invitacionRepo = new InvitacionRepository()
        this.rpcRepo = new SupabaseRpcRepository()
        this.usuarioRepo = new UsuarioRepository()
        this.emailService = new EmailService()
    }

    /** La empresa es un usuario con user_type='enterprise' — verificado en BD. */
    _assertEmpresaAsync = async (idUsuario) => {
        const usuario = await this.usuarioRepo.getByIdAsync(idUsuario)
        if (usuario?.user_type !== 'enterprise') {
            throwError('Esta acción requiere un perfil de empresa.', 403)
        }
        return usuario
    }

    /** Versión pública para rutas que solo necesitan el gate de empresa. */
    assertEmpresaAsync = async (idUsuario) => await this._assertEmpresaAsync(idUsuario)

    // ── Equipo y roles ───────────────────────────────────────────────────────

    getMiembrosAsync = async (usuario) => {
        await this._assertEmpresaAsync(usuario.id)
        return await this.empresaRepo.getMiembrosAsync(usuario.id)
    }

    getRolesAsync = async (usuario) => {
        await this._assertEmpresaAsync(usuario.id)
        return await this.empresaRepo.getCustomRolesAsync(usuario.id)
    }

    crearRolAsync = async (usuario, { nombre, descripcion, color }) => {
        if (!isValidString(nombre, { min: 1, max: 50 })) throwError('El nombre del rol es requerido (máx. 50).', 400)
        if (color !== undefined && color !== null && !isValidHexColor(color)) throwError('El color debe ser hexadecimal.', 400)
        await this._assertEmpresaAsync(usuario.id)
        await this.rpcRepo.callAsUserAsync('create_custom_role', {
            role_name: nombre.trim(),
            role_description: descripcion?.trim() || null,
            role_color: color ?? '#6b7280',
        }, usuario)
        return { ok: true }
    }

    eliminarRolAsync = async (usuario, nombre) => {
        if (!isValidString(nombre, { min: 1, max: 50 })) throwError('El nombre del rol es requerido.', 400)
        await this._assertEmpresaAsync(usuario.id)
        await this.rpcRepo.callAsUserAsync('delete_custom_role', { role_name: nombre }, usuario)
        return { ok: true }
    }

    asignarRolAsync = async (usuario, targetUserId, rol) => {
        if (!isValidUUID(targetUserId)) throwError('El ID del miembro no es válido.', 400)
        await this._assertEmpresaAsync(usuario.id)
        await this.rpcRepo.callAsUserAsync('assign_company_role', {
            target_user_id: targetUserId,
            role: typeof rol === 'string' ? rol.slice(0, 50) : '',
        }, usuario)
        return { ok: true }
    }

    setDisplayNameAsync = async (usuario, targetUserId, nombre) => {
        if (!isValidUUID(targetUserId)) throwError('El ID del miembro no es válido.', 400)
        // Misma sanitización que hacía el panel (sin chars inyectables, 60 máx.)
        const safeName = String(nombre ?? '').trim().slice(0, 60).replace(/[<>"'`]/g, '')
        if (!safeName) throwError('El nombre es requerido.', 400)
        await this._assertEmpresaAsync(usuario.id)
        await this.rpcRepo.callAsUserAsync('set_company_display_name', {
            target_user_id: targetUserId,
            display_name: safeName,
        }, usuario)
        return { ok: true }
    }

    removerMiembroAsync = async (usuario, targetUserId) => {
        if (!isValidUUID(targetUserId)) throwError('El ID del miembro no es válido.', 400)
        if (targetUserId === usuario.id) throwError('No podés removerte a vos mismo.', 400)
        await this._assertEmpresaAsync(usuario.id)
        await this.rpcRepo.callAsUserAsync('remove_team_member', { target_user_id: targetUserId }, usuario)
        return { ok: true }
    }

    /** Unirse a una empresa por link de invitación (App.jsx ?join=). */
    unirsePorLinkAsync = async (usuario, companyId) => {
        if (!isValidUUID(companyId)) throwError('El ID de empresa no es válido.', 400)
        await this.rpcRepo.callAsUserAsync('join_company_by_link', { p_company_id: companyId }, usuario)
        return { ok: true }
    }

    /** Salir de la empresa actual (CompanyPanel.jsx). */
    salirAsync = async (usuario) => {
        await this.rpcRepo.callAsUserAsync('leave_company', {}, usuario)
        return { ok: true }
    }

    // ── Invitaciones ─────────────────────────────────────────────────────────

    getInvitacionesAsync = async (usuario) => {
        await this._assertEmpresaAsync(usuario.id)
        return await this.invitacionRepo.getByCompanyAsync(usuario.id)
    }

    /**
     * La empresa invita por email. Resuelve server-side si el email ya tiene
     * cuenta (antes lo hacía el panel leyendo `usuarios`) y dispara el email
     * de invitación fire-and-forget vía emailService.
     */
    invitarAsync = async (usuario, { email, mensaje }) => {
        if (!isValidString(email, { min: 3, max: 200 }) || !email.includes('@')) {
            throwError('El email es requerido.', 400)
        }
        const empresa = await this._assertEmpresaAsync(usuario.id)
        const cleanEmail = email.trim().toLowerCase()
        const existente = await this.usuarioRepo.getByEmailAsync(cleanEmail)

        if (await this.invitacionRepo.existeActivaAsync(usuario.id, { userId: existente?.id_usuario ?? null, userEmail: cleanEmail })) {
            throwError('Ya existe una invitación activa para ese usuario.', 409)
        }

        const invitacion = await this.invitacionRepo.createAsync({
            companyId: usuario.id,
            userId: existente?.id_usuario ?? null,
            userEmail: cleanEmail,
            status: 'pending',
            message: isValidString(mensaje, { min: 0, max: 500 }) ? mensaje.trim() : null,
            fecha: nowAR(),
        })

        // Email de invitación: no frena la operación si falla. En Vercel se
        // registra con waitUntil para que sobreviva al freeze post-respuesta.
        const base = config.email.appBaseUrl
        const joinUrl = existente?.id_usuario
            ? `${base}/?join=${usuario.id}`
            : `${base}/?invite=${usuario.id}&email=${encodeURIComponent(cleanEmail)}`
        fireAndForget(this.emailService.sendInviteAsync({
            recipientEmail: cleanEmail,
            companyName: empresa.company_name || empresa.nombre_display || 'PrompTool',
            inviterName: empresa.nombre_display || null,
            joinUrl,
            isExistingUser: !!existente,
        }), 'enterprise-invite')

        return invitacion
    }

    /** Un usuario pide unirse a una empresa (perfil público de la empresa). */
    solicitarUnirseAsync = async (usuario, { companyId, mensaje }) => {
        if (!isValidUUID(companyId)) throwError('El ID de empresa no es válido.', 400)
        const empresa = await this.usuarioRepo.getByIdAsync(companyId)
        if (empresa?.user_type !== 'enterprise') throwError('La empresa no existe.', 404)

        const yo = await this.usuarioRepo.getByIdAsync(usuario.id)
        if (yo?.company_id === companyId) throwError('Ya sos miembro de esta empresa.', 409)
        if (await this.invitacionRepo.existeActivaAsync(companyId, { userId: usuario.id, userEmail: usuario.email ?? null })) {
            throwError('Ya tenés una solicitud activa con esta empresa.', 409)
        }

        return await this.invitacionRepo.createAsync({
            companyId,
            userId: usuario.id,
            userEmail: usuario.email ?? null,
            status: 'requested',
            message: isValidString(mensaje, { min: 0, max: 500 }) ? mensaje.trim() : null,
            fecha: nowAR(),
        })
    }

    /**
     * Acepta una invitación. La RPC correcta se decide server-side según quién
     * acepta (misma regla que Header.jsx): la empresa acepta solicitudes con
     * accept_team_invitation; el receptor acepta invitaciones con
     * accept_company_invite.
     */
    aceptarInvitacionAsync = async (usuario, invitacionId) => {
        const inv = await this.invitacionRepo.getByIdAsync(invitacionId)
        if (!inv) throwError('La invitación no existe.', 404)

        const esEmpresa = inv.company_id === usuario.id
        const esReceptor = inv.user_id === usuario.id || (!!usuario.email && inv.user_email === usuario.email)
        if (!esEmpresa && !esReceptor) throwError('No podés aceptar esta invitación.', 403)

        const rpc = esEmpresa ? 'accept_team_invitation' : 'accept_company_invite'
        await this.rpcRepo.callAsUserAsync(rpc, { invitation_id: inv.id }, usuario)
        return { ok: true }
    }

    /** Rechaza (receptor) o cancela (empresa) una invitación. */
    rechazarInvitacionAsync = async (usuario, invitacionId, status = 'rejected') => {
        if (!INV_ESTADOS_RECHAZO.includes(status)) throwError('Estado no válido.', 400)
        const inv = await this.invitacionRepo.getByIdAsync(invitacionId)
        if (!inv) throwError('La invitación no existe.', 404)

        const esEmpresa = inv.company_id === usuario.id
        const esReceptor = inv.user_id === usuario.id || (!!usuario.email && inv.user_email === usuario.email)
        if (!esEmpresa && !esReceptor) throwError('No podés modificar esta invitación.', 403)

        return await this.invitacionRepo.setStatusAsync(inv.id, status)
    }

    /** Borra una invitación de la bandeja (solo la empresa dueña). */
    eliminarInvitacionAsync = async (usuario, invitacionId) => {
        const inv = await this.invitacionRepo.getByIdAsync(invitacionId)
        if (!inv) throwError('La invitación no existe.', 404)
        if (inv.company_id !== usuario.id) throwError('No podés borrar esta invitación.', 403)
        await this.invitacionRepo.deleteAsync(inv.id)
        return { ok: true }
    }

    // ── Guías ────────────────────────────────────────────────────────────────

    crearGuiaAsync = async (usuario, { titulo, resumen, contenido, accent, keywords }) => {
        await this._assertEmpresaAsync(usuario.id)
        if (!isValidString(titulo, { min: 1, max: 150 })) throwError('El título es requerido.', 400)
        const data = await this.rpcRepo.callAsUserAsync('create_enterprise_guide', {
            title: titulo.trim(),
            summary: isValidString(resumen, { min: 1, max: 500 }) ? resumen.trim() : null,
            content: contenido ?? null,
            accent: accent ?? null,
            keywords: Array.isArray(keywords) ? JSON.stringify(keywords.filter((k) => isValidString(k, { max: 50 })).slice(0, 10)) : null,
        }, usuario)
        return { ok: true, guia: data }
    }

    /** Asigna una guía a miembros + inserta las notificaciones (carrier guide_suggestions). */
    asignarGuiaAsync = async (usuario, guiaId, { memberIds, dueDate, notas, titulo }) => {
        const empresa = await this._assertEmpresaAsync(usuario.id)
        if (!Array.isArray(memberIds) || memberIds.length === 0 || !memberIds.every(isValidUUID)) {
            throwError('member_ids debe ser un array de IDs válidos.', 400)
        }
        const asignados = await this.rpcRepo.callAsUserAsync('assign_guide_to_members', {
            guide_id: guiaId,
            member_ids: JSON.stringify(memberIds),
            due_date: dueDate || null,
            notes: isValidString(notas, { min: 1, max: 500 }) ? notas.trim() : null,
        }, usuario)

        // Notificaciones — solo a miembros reales de la empresa (verificado en BD)
        const miembros = await this.empresaRepo.getMiembrosAsync(usuario.id)
        const idsMiembros = new Set(miembros.map((m) => m.id_usuario))
        const companyName = empresa.company_name || 'Tu empresa'
        const tituloGuia = isValidString(titulo, { min: 1, max: 150 }) ? titulo.trim() : 'Guía'
        const rows = memberIds.filter((id) => idsMiembros.has(id)).map((id) => ({
            target_user_id: id,
            target_email: null,
            title: 'Nueva guía asignada',
            message: `${companyName} te asignó: "${tituloGuia}"${notas ? ` — ${String(notas).slice(0, 200)}` : ''}`,
            guide_slug: null,
            guide_url: `/guides?enterprise_guide=${guiaId}`,
            created_at: nowAR(),
        }))
        if (rows.length) {
            await this.empresaRepo.insertGuideSuggestionsAsync(rows)
                .catch((err) => console.error('[enterprise] notificaciones de guía fallaron:', err.message))
        }
        return { ok: true, asignados }
    }

    /**
     * Notifica una guía del catálogo/custom a miembros (flujo training_config
     * de EnterprisePanel.jsx — la notificación es lo único server-side).
     */
    notificarGuiaAsync = async (usuario, { targets, titulo, mensaje, guideSlug, guideUrl }) => {
        await this._assertEmpresaAsync(usuario.id)
        if (!Array.isArray(targets) || targets.length === 0 || !targets.every(isValidUUID)) {
            throwError('targets debe ser un array de IDs válidos.', 400)
        }
        if (!isValidString(titulo, { min: 1, max: 150 })) throwError('El título es requerido.', 400)
        if (!isValidString(mensaje, { min: 1, max: 500 })) throwError('El mensaje es requerido.', 400)

        const miembros = await this.empresaRepo.getMiembrosAsync(usuario.id)
        const porId = new Map(miembros.map((m) => [m.id_usuario, m]))
        const rows = targets.filter((id) => porId.has(id)).map((id) => ({
            target_user_id: id,
            target_email: porId.get(id).email ?? null,
            title: titulo.trim(),
            message: mensaje.trim(),
            guide_slug: isValidString(guideSlug, { min: 1, max: 100 }) ? guideSlug : null,
            guide_url: isValidString(guideUrl, { min: 1, max: 300 }) ? guideUrl : null,
            created_at: nowAR(),
        }))
        if (!rows.length) throwError('Ningún target pertenece a tu equipo.', 400)
        const insertadas = await this.empresaRepo.insertGuideSuggestionsAsync(rows)
        return { ok: true, notificados: insertadas }
    }

    /** Progreso de guía del propio usuario (EnterpriseGuideContent.jsx). */
    actualizarProgresoGuiaAsync = async (usuario, guiaId, { sectionId, completed, data }) => {
        if (!isValidString(String(sectionId ?? ''), { min: 1, max: 100 })) {
            throwError('section_id es requerido.', 400)
        }
        await this.rpcRepo.callAsUserAsync('update_guide_progress', {
            guide_id: guiaId,
            section_id: String(sectionId),
            completed: completed !== false,
            data: JSON.stringify(data && typeof data === 'object' ? data : {}),
        }, usuario)
        return { ok: true }
    }

    // ── Desafíos de empresa ──────────────────────────────────────────────────

    getDesafiosAsync = async (usuario) => {
        await this._assertEmpresaAsync(usuario.id)
        return await this.empresaRepo.getDesafiosAsync(usuario.id)
    }

    /** Whitelist + validación de los campos de un desafío (create y update). */
    _validarCamposDesafio = (body, { requerirTodo = false } = {}) => {
        const fields = {}

        if (body.url_image !== undefined || requerirTodo) {
            if (!isValidHttpsUrl(body.url_image, { max: 500 })) throwError('url_image debe ser una URL https.', 400)
            fields.url_image = body.url_image
        }
        if (body.prompt_original !== undefined || requerirTodo) {
            if (!isValidString(body.prompt_original, { min: 1, max: 2000 })) throwError('El prompt es requerido (máx. 2000).', 400)
            fields.prompt_original = body.prompt_original.trim()
        }
        if (body.image_theme !== undefined || requerirTodo) {
            if (!isValidString(body.image_theme, { min: 1, max: 100 })) throwError('La temática es requerida (máx. 100).', 400)
            fields.image_theme = body.image_theme.trim()
        }
        if (body.image_diff !== undefined) {
            if (!DIFICULTADES.includes(body.image_diff)) throwError(`image_diff debe ser: ${DIFICULTADES.join(', ')}.`, 400)
            fields.image_diff = body.image_diff
        }
        if (body.challenge_description !== undefined) {
            fields.challenge_description = isValidString(body.challenge_description, { min: 1, max: 500 })
                ? body.challenge_description.trim() : null
        }
        if (body.challenge_time_limit !== undefined) {
            fields.challenge_time_limit = clampInt(body.challenge_time_limit, 30, 3600, 180)
        }
        if (body.challenge_max_attempts !== undefined) {
            fields.challenge_max_attempts = body.challenge_max_attempts === null
                ? null : clampInt(body.challenge_max_attempts, 0, 10, 0)
        }
        if (body.challenge_min_words !== undefined) {
            fields.challenge_min_words = clampInt(body.challenge_min_words, 0, 100, 0)
        }
        if (body.challenge_points !== undefined) {
            fields.challenge_points = clampInt(body.challenge_points, 0, 1000, 100)
        }
        for (const dateField of ['challenge_start_date', 'challenge_end_date']) {
            if (body[dateField] !== undefined) {
                fields[dateField] = body[dateField] ? String(body[dateField]).slice(0, 40) : null
            }
        }
        if (body.challenge_visibility !== undefined) {
            fields.challenge_visibility = isValidString(body.challenge_visibility, { min: 1, max: 20 })
                ? body.challenge_visibility : null
        }
        if (body.challenge_tags !== undefined) {
            fields.challenge_tags = JSON.stringify(
                (Array.isArray(body.challenge_tags) ? body.challenge_tags : [])
                    .filter((t) => isValidString(t, { max: 40 })).slice(0, 10)
            )
        }
        if (body.challenge_hints !== undefined) {
            fields.challenge_hints = JSON.stringify(
                (Array.isArray(body.challenge_hints) ? body.challenge_hints : [])
                    .filter((h) => isValidString(h, { max: 200 })).slice(0, 5)
            )
        }
        if (body.challenge_evaluation_mode !== undefined) {
            if (!EVAL_MODES.includes(body.challenge_evaluation_mode)) {
                throwError(`challenge_evaluation_mode debe ser: ${EVAL_MODES.join(', ')}.`, 400)
            }
            fields.challenge_evaluation_mode = body.challenge_evaluation_mode
        }
        if (body.challenge_eval_instructions !== undefined) {
            fields.challenge_eval_instructions = isValidString(body.challenge_eval_instructions, { min: 1, max: 2000 })
                ? body.challenge_eval_instructions.trim() : null
        }
        return fields
    }

    crearDesafioAsync = async (usuario, body) => {
        await this._assertEmpresaAsync(usuario.id)
        const fields = this._validarCamposDesafio(body, { requerirTodo: true })
        // company_id y fecha los pone el servidor — NUNCA el body
        fields.company_id = usuario.id
        fields.fecha = nowAR()
        if (!fields.image_diff) fields.image_diff = 'Medium'
        const creado = await this.empresaRepo.createDesafioAsync(fields)
        return { ok: true, id_imagen: creado?.id_imagen ?? null }
    }

    actualizarDesafioAsync = async (usuario, idImagen, body) => {
        await this._assertEmpresaAsync(usuario.id)
        const existente = await this.empresaRepo.getDesafioByIdAsync(idImagen)
        if (!existente) throwError('El desafío no existe.', 404)
        if (existente.company_id !== usuario.id) throwError('No podés editar este desafío.', 403)

        const fields = this._validarCamposDesafio(body)
        if (Object.keys(fields).length === 0) throwError('No hay campos editables en la solicitud.', 400)
        const actualizado = await this.empresaRepo.updateDesafioAsync(idImagen, usuario.id, fields)
        return { ok: true, id_imagen: actualizado?.id_imagen ?? null }
    }
}
