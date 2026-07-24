import EmpresaRepository from '../repositories/empresaRepository.js'
import InvitacionRepository from '../repositories/invitacionRepository.js'
import SupabaseRpcRepository from '../repositories/supabaseRpcRepository.js'
import UsuarioRepository from '../repositories/usuarioRepository.js'
import EmailService from './emailService.js'
import { config } from '../config/env.js'
import { throwError } from '../helpers/httpError.js'
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
const CONTENT_TYPES = ['image', 'code', 'document']
const INV_ESTADOS_RECHAZO = ['rejected', 'cancelled']

// Columnas JSONB de `usuarios` que el panel edita sobre su PROPIA fila.
// Solo estas: nada de elo/adminstate/contadores por esta vía.
const CONFIG_JSONB_COLS = ['training_config', 'dashboard_filters', 'performance_metrics']
const CONFIG_MAX_JSON_CHARS = 10_000

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

    // ── Settings del panel (fila propia de la empresa) ───────────────────────

    getSettingsAsync = async (usuario) => {
        await this._assertEmpresaAsync(usuario.id)
        return await this.empresaRepo.getSettingsAsync(usuario.id)
    }

    /**
     * Cierra el `usuarios.update({...})` del formulario de settings del panel.
     * Whitelist estricta sobre la PROPIA fila enterprise: escalares validados +
     * columnas JSONB serializadas con tope de tamaño.
     * NOTA (esquema inferido): `settings_allowed_diffs`, `performance_metrics`,
     * `training_config` y `dashboard_filters` se asumen columnas JSONB. Validar
     * contra el esquema real de Supabase antes del E2E.
     */
    updateSettingsAsync = async (usuario, body) => {
        await this._assertEmpresaAsync(usuario.id)
        const fields = {}

        if (body.company_name !== undefined) {
            if (!isValidString(body.company_name, { min: 1, max: 100 })) throwError('El nombre de la empresa no es válido (máx. 100).', 400)
            fields.company_name = body.company_name.trim()
        }
        if (body.bio !== undefined) {
            fields.bio = isValidString(body.bio, { min: 1, max: 1000 }) ? body.bio.trim() : null
        }
        if (body.social_website !== undefined) {
            if (body.social_website && !isValidHttpsUrl(body.social_website, { max: 300 })) throwError('social_website debe ser una URL https.', 400)
            fields.social_website = body.social_website || null
        }
        if (body.industry_type !== undefined) {
            if (!isValidString(String(body.industry_type ?? ''), { min: 0, max: 60 })) throwError('industry_type no es válido (máx. 60).', 400)
            fields.industry_type = body.industry_type || null
        }
        if (body.tournament_enabled !== undefined) {
            if (typeof body.tournament_enabled !== 'boolean') throwError('tournament_enabled debe ser booleano.', 400)
            fields.tournament_enabled = body.tournament_enabled
        }
        if (body.default_challenge_type !== undefined) {
            if (!isValidString(body.default_challenge_type, { min: 1, max: 40 })) throwError('default_challenge_type no es válido.', 400)
            fields.default_challenge_type = body.default_challenge_type
        }
        if (body.default_challenge_mode !== undefined) {
            if (!isValidString(body.default_challenge_mode, { min: 1, max: 40 })) throwError('default_challenge_mode no es válido.', 400)
            fields.default_challenge_mode = body.default_challenge_mode
        }

        // JSONB (incluye settings_allowed_diffs, que es un array de dificultades)
        for (const col of ['settings_allowed_diffs', 'performance_metrics', 'training_config', 'dashboard_filters']) {
            if (body[col] === undefined) continue
            if (body[col] === null) { fields[col] = null; continue }
            if (typeof body[col] !== 'object') throwError(`${col} debe ser un objeto/array JSON (o null).`, 400)
            const serialized = JSON.stringify(body[col])
            if (serialized.length > CONFIG_MAX_JSON_CHARS) throwError(`${col} supera el tamaño máximo (${CONFIG_MAX_JSON_CHARS} caracteres).`, 400)
            fields[col] = serialized
        }

        if (Object.keys(fields).length === 0) throwError('No hay campos de settings en la solicitud.', 400)
        return await this.empresaRepo.updateSettingsAsync(usuario.id, fields)
    }

    // ── Config del panel (columnas JSONB de la propia fila) ──────────────────

    getConfigAsync = async (usuario) => {
        await this._assertEmpresaAsync(usuario.id)
        return await this.empresaRepo.getConfigAsync(usuario.id)
    }

    /**
     * Cierra el update directo `usuarios.update({ training_config: ... })` del
     * panel: solo columnas JSONB de la whitelist, solo la propia fila, con tope
     * de tamaño. `null` limpia la columna.
     */
    updateConfigAsync = async (usuario, body) => {
        await this._assertEmpresaAsync(usuario.id)
        const fields = {}
        for (const col of CONFIG_JSONB_COLS) {
            if (body[col] === undefined) continue
            if (body[col] === null) {
                fields[col] = null
                continue
            }
            if (typeof body[col] !== 'object') {
                throwError(`${col} debe ser un objeto JSON (o null para limpiar).`, 400)
            }
            const serialized = JSON.stringify(body[col])
            if (serialized.length > CONFIG_MAX_JSON_CHARS) {
                throwError(`${col} supera el tamaño máximo (${CONFIG_MAX_JSON_CHARS} caracteres).`, 400)
            }
            fields[col] = serialized
        }
        if (Object.keys(fields).length === 0) throwError('No hay campos de config en la solicitud.', 400)
        return await this.empresaRepo.updateConfigAsync(usuario.id, fields)
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

        // Email de invitación: se ESPERA (no fire-and-forget) porque el trabajo
        // post-respuesta con waitUntil no es confiable en este entorno serverless
        // (mismo motivo que el mail de bienvenida). Agrega ~0.5s a la respuesta
        // del invite, pero garantiza el envío. Si falla, NO frena la operación:
        // la invitación ya quedó creada en la BD.
        const base = config.email.appBaseUrl
        const joinUrl = existente?.id_usuario
            ? `${base}/?join=${usuario.id}`
            : `${base}/?invite=${usuario.id}&email=${encodeURIComponent(cleanEmail)}`
        try {
            await this.emailService.sendInviteAsync({
                recipientEmail: cleanEmail,
                companyName: empresa.company_name || empresa.nombre_display || 'PrompTool',
                inviterName: empresa.nombre_display || null,
                joinUrl,
                isExistingUser: !!existente,
            })
            console.log(`[enterprise-invite] email enviado a ${cleanEmail} (invitacion ${invitacion.id})`)
        } catch (err) {
            console.error(`[enterprise-invite] email falló para ${cleanEmail} (invitacion ${invitacion.id}):`, err?.message)
        }

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

    /** Lista de guías propias de la empresa (tabla enterprise_guides). */
    getGuiasAsync = async (usuario) => {
        await this._assertEmpresaAsync(usuario.id)
        return await this.empresaRepo.getEnterpriseGuidesAsync(usuario.id)
    }

    /**
     * Edita una guía propia. Whitelist de campos + verificación de ownership
     * en BD (company_id), no se confía en el cliente.
     */
    actualizarGuiaAsync = async (usuario, guiaId, body) => {
        await this._assertEmpresaAsync(usuario.id)
        const existente = await this.empresaRepo.getEnterpriseGuideByIdAsync(guiaId)
        if (!existente) throwError('La guía no existe.', 404)
        if (existente.company_id !== usuario.id) throwError('No podés editar esta guía.', 403)

        const fields = {}
        if (body.titulo !== undefined) {
            if (!isValidString(body.titulo, { min: 1, max: 150 })) throwError('El título es requerido (máx. 150).', 400)
            fields.title = body.titulo.trim()
        }
        if (body.resumen !== undefined) {
            fields.summary = isValidString(body.resumen, { min: 1, max: 500 }) ? body.resumen.trim() : null
        }
        if (body.accent !== undefined) {
            fields.accent = isValidString(body.accent, { min: 1, max: 40 }) ? body.accent : null
        }
        if (body.contenido !== undefined) {
            if (body.contenido !== null && typeof body.contenido !== 'object') throwError('contenido debe ser un objeto JSON (o null).', 400)
            const serialized = body.contenido === null ? null : JSON.stringify(body.contenido)
            if (serialized && serialized.length > CONFIG_MAX_JSON_CHARS) throwError(`contenido supera el tamaño máximo (${CONFIG_MAX_JSON_CHARS} caracteres).`, 400)
            fields.content = serialized
        }
        if (body.keywords !== undefined) {
            fields.keywords = Array.isArray(body.keywords)
                ? JSON.stringify(body.keywords.filter((k) => isValidString(k, { max: 50 })).slice(0, 10))
                : null
        }
        if (Object.keys(fields).length === 0) throwError('No hay campos editables en la solicitud.', 400)
        fields.updated_at = nowAR()
        const actualizado = await this.empresaRepo.updateEnterpriseGuideAsync(guiaId, usuario.id, fields)
        return { ok: true, id: actualizado?.id ?? null }
    }

    eliminarGuiaAsync = async (usuario, guiaId) => {
        await this._assertEmpresaAsync(usuario.id)
        const existente = await this.empresaRepo.getEnterpriseGuideByIdAsync(guiaId)
        if (!existente) throwError('La guía no existe.', 404)
        if (existente.company_id !== usuario.id) throwError('No podés eliminar esta guía.', 403)
        await this.empresaRepo.deleteEnterpriseGuideAsync(guiaId, usuario.id)
        return { ok: true }
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

    /**
     * Asignaciones de guías del miembro que llama (GuidesApp.jsx). Lee el
     * `training_config.guide_assignments` de SU empresa y filtra las que le
     * corresponden. Sin gate de empresa: es un endpoint del lado del usuario.
     */
    getMisAsignacionesGuiasAsync = async (usuario) => {
        const row = await this.empresaRepo.getCompanyTrainingConfigForMemberAsync(usuario.id)
        const all = row?.training_config?.guide_assignments || []
        return all.filter((a) => !a.target_user_id || a.target_user_id === usuario.id)
    }

    /**
     * Guías de empresa asignadas al miembro que llama (GuidesSection.jsx).
     * Sin gate de empresa: es un endpoint del lado del usuario.
     */
    getGuiasAsignadasAsync = async (usuario) => {
        return await this.empresaRepo.getAssignedEnterpriseGuidesAsync(usuario.id)
    }

    /** Lectura del progreso propio en una guía (EnterpriseGuideContent.jsx). */
    getProgresoGuiaAsync = async (usuario, guiaId) => {
        return await this.empresaRepo.getGuideProgressAsync(guiaId, usuario.id)
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

    // ── Analytics del panel ──────────────────────────────────────────────────

    /** Intentos de miembros sobre los desafíos de la empresa, agrupados por desafío. */
    getIntentosDesafiosAsync = async (usuario) => {
        await this._assertEmpresaAsync(usuario.id)
        const rows = await this.empresaRepo.getIntentosDesafiosAsync(usuario.id)
        const grouped = {}
        for (const row of rows) {
            ;(grouped[row.id_imagen] ??= []).push(row)
        }
        return grouped
    }

    /** Progreso diario del equipo: intentos de los últimos `days` días. */
    getIntentosDiariosAsync = async (usuario, days = 30) => {
        await this._assertEmpresaAsync(usuario.id)
        const d = clampInt(days, 1, 90, 30)
        const since = new Date()
        since.setDate(since.getDate() - (d - 1))
        return await this.empresaRepo.getIntentosDiariosAsync(usuario.id, since.toISOString())
    }

    /** Estadísticas detalladas de un desafío propio. */
    getChallengeStatsAsync = async (usuario, idImagen) => {
        await this._assertEmpresaAsync(usuario.id)
        return await this.empresaRepo.getChallengeStatsAsync(usuario.id, idImagen)
    }

    /** guide_progress por miembro (para el tablero de progreso de guías). */
    getProgresoMiembrosAsync = async (usuario) => {
        await this._assertEmpresaAsync(usuario.id)
        const rows = await this.empresaRepo.getMiembrosTrainingConfigAsync(usuario.id)
        return rows.map((r) => ({
            id_usuario: r.id_usuario,
            guide_progress: r.training_config?.guide_progress ?? {},
        }))
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
        if (body.challenge_content_type !== undefined) {
            if (!CONTENT_TYPES.includes(body.challenge_content_type)) {
                throwError(`challenge_content_type debe ser: ${CONTENT_TYPES.join(', ')}.`, 400)
            }
            fields.challenge_content_type = body.challenge_content_type
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
        if (!fields.challenge_content_type) fields.challenge_content_type = 'image'
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
