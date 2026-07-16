import EmpresaRepository from '../repositories/empresaRepository.js'
import UsuarioRepository from '../repositories/usuarioRepository.js'
import { config } from '../config/env.js'
import { throwError } from '../helpers/httpError.js'

/**
 * Chat de análisis de equipo con Groq — portado de EnterprisePanel.jsx, donde
 * la key viajaba en el bundle (VITE_GROQ_API_KEY) y el contexto del equipo lo
 * armaba el cliente.
 *
 * Acá la key vive en el servidor y el contexto se construye desde la BD, así
 * el cliente no puede inyectar datos falsos del equipo en el system prompt.
 * Los bloques <action> que devuelve el modelo se reenvían tal cual: el
 * frontend los parsea y ejecuta la acción llamando a los endpoints de
 * /api/enterprise (que revalidan todo server-side).
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const MAX_TURNOS = 10
const MSG_MAX_CHARS = 2000

const nombreDe = (u) => u.company_display_name || u.nombre_display || u.nombre || u.email

function buildTeamContext({ empresa, miembros, roles, cantDesafios, lang }) {
    const companyName = empresa.company_name || 'the company'
    const memberCount = miembros.length
    const activos = miembros.filter((u) => (u.total_intentos || 0) > 0)
    const inactivos = miembros.filter((u) => (u.total_intentos || 0) === 0)
    const avgScore = memberCount > 0
        ? Math.round(miembros.reduce((s, u) => s + (Number(u.promedio_score) || 0), 0) / memberCount) : 0
    const avgElo = memberCount > 0
        ? Math.round(miembros.reduce((s, u) => s + (u.elo_rating || 1000), 0) / memberCount) : 1000
    const totalAttempts = miembros.reduce((s, u) => s + (u.total_intentos || 0), 0)
    const topPerformer = [...miembros].sort((a, b) => (b.elo_rating || 1000) - (a.elo_rating || 1000))[0]
    const lowestPerformer = [...activos].sort((a, b) => (Number(a.promedio_score) || 0) - (Number(b.promedio_score) || 0))[0]

    const memberSummaries = miembros.slice(0, 20).map((u) =>
        `- "${nombreDe(u)}" → id:${u.id_usuario} | ELO:${u.elo_rating || 1000} | score:${u.promedio_score ?? 'N/A'}% | attempts:${u.total_intentos || 0} | streak:${u.racha_actual || 0}d | role:${u.company_role || 'none'}`
    ).join('\n')

    const uiLang = lang === 'en' ? 'English' : 'Spanish (español rioplatense)'

    return `You are a focused team analytics assistant for ${companyName} on a prompt engineering training platform. You provide data-driven insights and execute management actions ONLY.

LANGUAGE: Always respond in ${uiLang}. Never switch languages regardless of what the user writes.

STRICT SCOPE: You ONLY handle:
1. Team performance questions (scores, ELO, attempts, streaks)
2. Member management actions (rename, assign roles, remove)
3. Challenge and participation analytics
4. Direct greetings and thanks (keep brief)

FORBIDDEN TOPICS: Refuse anything outside team management:
- General knowledge, recipes, jokes, trivia, weather, news
- Programming help, technical tutorials
- Personal advice, life coaching
- Any topic not directly related to THIS team's performance data

CRITICAL ACTION RULES:
- When asked to rename, assign role, or remove a member, find them in the MEMBERS list below
- Use the exact id from the list in your action JSON
- If you find the member, execute the action immediately
- If name is ambiguous, ask which specific member
- Always emit action block AND confirmation text

AVAILABLE ACTIONS:
- Rename: <action>{"action":"rename","userId":"<exact id>","newName":"<new name>"}</action>
- Assign role: <action>{"action":"assign_role","userId":"<exact id>","role":"<role name>"}</action>
- Remove: <action>{"action":"remove_member","userId":"<exact id>"}</action>
- Filter by challenge: <action>{"action":"filter_challenge","challengeId":"<challenge id>"}</action>
- Show challenge stats: <action>{"action":"show_challenge_stats","challengeId":"<challenge id>"}</action>
- Create role: <action>{"action":"create_role","roleName":"<role name>","description":"<optional description>","color":"<hex color>"}</action>
- Delete role: <action>{"action":"delete_role","roleName":"<exact role name>"}</action>

AVAILABLE ROLES:
${roles.map((r) => `- ${r.role_name}: ${r.role_description || 'Custom role'} (color: ${r.role_color})`).join('\n')}
${roles.length === 0 ? '- No custom roles defined yet' : ''}

ROLE MANAGEMENT RULES:
- You CAN create new roles with any name (avoid duplicates)
- You CAN delete existing custom roles (this removes them from all members)
- You CAN assign any role name (if it doesn't exist, it will be created automatically)
- Default colors: #8b5cf6 (purple), #3b82f6 (blue), #f59e0b (amber), #ef4444 (red), #10b981 (emerald)
- When creating roles, suggest appropriate colors based on the role type

TEAM DATA:
- Company: ${companyName}
- Members: ${memberCount} total (${activos.length} active, ${inactivos.length} inactive)
- Avg ELO: ${avgElo} | Avg score: ${avgScore}% | Total attempts: ${totalAttempts}
- Challenges: ${cantDesafios}
${topPerformer ? `- Top performer: ${nombreDe(topPerformer)} (ELO ${topPerformer.elo_rating || 1000})` : ''}
${lowestPerformer ? `- Needs attention: ${nombreDe(lowestPerformer)} (${lowestPerformer.promedio_score ?? 'N/A'}%)` : ''}
${inactivos.length > 0 ? `- Inactive members: ${inactivos.map(nombreDe).join(', ')}` : ''}

MEMBERS:
${memberSummaries || '- (no members yet)'}`
}

export default class EnterpriseChatService {
    constructor() {
        this.empresaRepo = new EmpresaRepository()
        this.usuarioRepo = new UsuarioRepository()
    }

    /**
     * @param {{ id: string }} usuario - empresa autenticada (verificada enterprise por el caller)
     * @param {Array<{role: string, content: string}>} messages - historial user/assistant
     * @param {string|null} lang
     */
    chatAsync = async (usuario, messages, lang = 'es') => {
        // Whitelist de mensajes: solo user/assistant, largo acotado, últimos N turnos
        const safeMessages = (Array.isArray(messages) ? messages : [])
            .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
            .slice(-MAX_TURNOS)
            .map((m) => ({ role: m.role, content: m.content.slice(0, MSG_MAX_CHARS) }))
        if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== 'user') {
            throwError('messages debe terminar con un mensaje del usuario.', 400)
        }

        const empresa = await this.usuarioRepo.getByIdAsync(usuario.id)
        if (empresa?.user_type !== 'enterprise') throwError('Esta acción requiere un perfil de empresa.', 403)

        const [miembros, roles, desafios] = await Promise.all([
            this.empresaRepo.getMiembrosAsync(usuario.id),
            this.empresaRepo.getCustomRolesAsync(usuario.id),
            this.empresaRepo.getDesafiosAsync(usuario.id),
        ])

        const systemPrompt = buildTeamContext({
            empresa, miembros, roles, cantDesafios: desafios.length, lang: lang === 'en' ? 'en' : 'es',
        })

        const response = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.groqApiKey}`,
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [{ role: 'system', content: systemPrompt }, ...safeMessages],
                temperature: 0.5,
                max_tokens: 500,
            }),
        })

        if (!response.ok) {
            const detail = await response.json().catch(() => ({}))
            console.error('[enterpriseChat] Groq error:', response.status, detail)
            throwError(response.status === 429
                ? 'Demasiadas solicitudes al asistente. Esperá un momento.'
                : 'El asistente no está disponible ahora.', 502)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''
        return { content }
    }
}
