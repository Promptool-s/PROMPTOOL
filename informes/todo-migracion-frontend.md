# TODO — Migración frontend a `/api/*` (dejar de pegarle a Supabase directo)

Checklist de continuación. Contexto completo y el porqué de la migración están en [`estado-migracion.md`](./estado-migracion.md); acá solo la lista accionable, con archivo/línea/endpoint destino para no tener que re-investigar.

Última actualización: 2026-07-20 (commit `9b755c9`).

Comando para recontar sitios pendientes en cualquier momento:
```
grep -rlE "supabase\.(from|rpc|storage)" src/ | xargs -I{} sh -c 'echo -n "{}: "; grep -cE "supabase\.(from|rpc|storage)" "{}"'
```
(subcuenta los chains multilínea `await supabase\n.from(...)`, pero sirve como cota inferior)

---

## ✅ Hecho

- [x] `useAuth.js`, `AuthModal.jsx`, `LangContext.jsx`, `ConfigModal.jsx`, `SupportApp.jsx`, `Header.jsx`, `LeaderboardApp.jsx` — cero `supabase.from/rpc/storage`.
- [x] `EnterprisePanel.jsx` → `sendEnterpriseInvite` y `EnterpriseOnboarding.jsx` → `sendInvite`: migrados a `POST /api/enterprise/invitaciones` (commit `9b755c9`). Sacó ~21 sitios.
- [x] `supabase.auth.*` (login/signup/logout/session) se deja a propósito en el cliente en todos los archivos — no migrar.

## 🔴 Pendiente — por impacto

### 1. `src/App.jsx` (21 sitios) — EL MÁS CRÍTICO Y RIESGOSO

Núcleo de scoring/ELO/feed/reveal. Dos vectores de trampa activos hoy:

- **Línea ~492**: `supabase.from('intentos').insert([{ ...attempt, id_usuario: user.id }])` — el cliente arma el intento entero.
- **Líneas ~1038-1061**: el cliente **calcula su propio ELO** (`supabase.from('usuarios').select('elo_rating')...update({ elo_rating: newElo })`) — un usuario deshonesto puede escribir cualquier ELO desde la consola del browser.
- **Línea ~931**: `supabase.from('imagenes_ia').select('prompt_original')` — lee la respuesta correcta directo, sin gating server-side.
- Líneas 580, 594, 604, 635, 1165, 1186: lecturas de `imagenes_ia` (feed/dificultades/random).
- Línea 335: `supabase.rpc('join_company_by_link', ...)`.
- Línea 1953: `supabase.from('usuarios').update({ user_onboarded: true })`.

**Reemplazo:**
- Todo el submit → `POST /api/intentos` (body: `id_imagen, prompt_usuario, modo, elapsed_seconds, attempt_number, lang, challenge_id, typing_report, focus_report, clip_report`; el server hace eval IA + scoring + ELO + contadores en una transacción y devuelve el resultado completo — ver `server/src/services/intentoService.js` o equivalente).
- Feed/dificultades/random → `GET /api/imagenes`.
- Reveal → `POST /api/imagenes/:id/revelar` (gating server-side de `prompt_original`, ya existe).
- `user_onboarded` → `PUT /api/usuarios/me`.
- `join_company_by_link` → `POST /api/enterprise/unirse` (`unirsePorLinkAsync` en `enterpriseService.js`, ya existe).

⚠️ Cuidado con: sync de intentos de invitado en `sessionStorage` (flujo de usuario no logueado que juega y después crea cuenta), y que el cliente deje de necesitar `prompt_original` en ningún momento antes del reveal.

### 2. `src/UsuarioApp.jsx` (31 sitios)

Perfil, stats, follows, showcase. Backend ya tiene `getPerfilAsync`, `updatePerfilAsync`, `followAsync`/`unfollowAsync` en `usuarioService.js` → exponer/usar vía `/api/usuarios/*`. Revisar si faltan endpoints para las stats agregadas que hoy arma con selects propios del cliente (ej. históricos, distribución de scores).

### 3. `src/AdminApp.jsx` (16 sitios) + `src/hooks/useAdmin.js` + `src/hooks/useDev.js`

Hoy la autorización de admin se resuelve contra `user_metadata` **en el cliente** — hay que verificar server-side. Backend ya tiene `/api/admin/*` (listado + toggles de usuario por whitelist: `adminstate`/`verified`/`devstate`, ver `estado-migracion.md` sección Backend). Revisar qué falta exponer antes de escribir controllers nuevos.

### 4. `src/components/EnterprisePanel.jsx` — resto (22 sitios restantes tras el fix de invite)

Todos tienen equivalente 1:1 ya escrito en `server/src/services/enterpriseService.js` — es mecánico, solo cambiar `supabase.rpc/from` por el `api.*` correspondiente:

| Frontend (supabase directo) | Backend ya existente |
|---|---|
| `supabase.rpc('create_custom_role', ...)` | `crearRolAsync` |
| `supabase.rpc('delete_custom_role', ...)` | `eliminarRolAsync` |
| `supabase.rpc('assign_company_role', ...)` | `asignarRolAsync` |
| `supabase.rpc('remove_team_member', ...)` | `removerMiembroAsync` |
| `supabase.rpc('set_company_display_name', ...)` | `setDisplayNameAsync` |
| `supabase.from('imagenes_ia').insert(...)` (crear desafío, línea ~1100) | `crearDesafioAsync` |
| `supabase.rpc('create_enterprise_guide', ...)` | `crearGuiaAsync` |
| `supabase.rpc('assign_guide_to_members', ...)` + `guide_suggestions` insert (líneas 332, 1378) | `asignarGuiaAsync` |
| `supabase.rpc('accept_team_invitation', ...)` (línea 842) | `aceptarInvitacionAsync` (ya usado en `Header.jsx`, mismo patrón) |
| `supabase.from('team_invitations').delete()` (línea 875) | `eliminarInvitacionAsync` |
| `supabase.from('usuarios').update(updates)` (línea 902, config de empresa) | Falta endpoint whitelist para `training_config`/`dashboard_filters`/`performance_metrics` — ver `estado-migracion.md` "Backend (menor)" |
| `fetchEnterpriseRequests` (línea 708, GET bandeja) | `getInvitacionesAsync` vía `GET /api/enterprise/invitaciones` (ya expuesto; ojo con adaptar el shape del join `usuarios!team_invitations_user_id_fkey(...)`) |

### 5. `src/components/CompanyPanel.jsx` (1 sitio)

Línea 72: `supabase.rpc('leave_company')` → `api.post('/enterprise/salir')` (`salirAsync`, ya existe). Trivial.

### 6. `src/components/EnterpriseGuideContent.jsx` (1 sitio)

Línea 44: `supabase.rpc('update_guide_progress', ...)` → `actualizarProgresoGuiaAsync` (ya existe en `enterpriseService.js`); confirmar que está expuesto en `enterpriseController.js`, si no agregar la ruta.

---

## 🔒 Seguridad — services client-side con agujero activo

### `src/services/plagiarismService.js` (5 sitios)

**El más urgente de este grupo.** El cliente:
- Inserta sus propios `plagiarism_flags` (línea ~183).
- Hace `UPDATE usuarios SET suspension_status=..., elo_rating=...` directo (líneas ~204, 211, 217).
- **Línea ~257: `UPDATE usuarios SET suspension_status='none', suspension_until=null`** — un usuario suspendido puede auto-desuspenderse desde la consola del browser con su propia sesión.

Backend ya tiene el equivalente completo integrado en `POST /api/intentos` (`server/src/services/plagiarismService.js`, con escalera de suspensión 2→warned/5→suspended 7 días/10→banned, ver `estado-migracion.md` "Anti-cheat server-side"). **Acción: vaciar/borrar el archivo del cliente**, no migrarlo — la detección ya corre server-side, el cliente no debería tener ninguna de estas funciones.

### `src/services/aiDetectionService.js` (1 sitio)

Línea ~532: insert directo a `ai_detection_flags`. Mismo caso — ya integrado server-side en `POST /api/intentos`. Vaciar/borrar.

### `src/services/rateLimitService.js` (2 sitios) — revisar con el usuario, no migrar a ciegas

`supabase.rpc('check_rate_limit'/'reset_rate_limit')` contra la tabla `auth_rate_limit`. Es **intencionalmente** client-side porque protege login/signup, que corren **antes** de tener sesión propia (no hay JWT todavío para pegarle al backend). Decidir: ¿dejarlo así, o mover a un endpoint público del backend con su propio rate limit (patrón `emailSendLimiter`, ya existe)? Login en sí seguiría yendo directo a Supabase Auth de cualquier forma.

### Ya limpios / no requieren acción
- `geminiService.js`, `aiChallengeService.js` — mencionados como pendientes en `estado-migracion.md` pero **no aparecen** en el grep actual de `supabase.(from|rpc|storage)`; confirmar si ya fueron vaciados o si usan otro patrón (keys expuestas en el bundle, por ejemplo) antes de tacharlos.

---

## Bajo impacto / posponer

- `src/TournamentsApp.jsx` — feature no activa (página estática "coming soon"), sin llamadas reales todavía.

---

## Cierre de la migración (hacerlo al final, no antes)

- [ ] `grep -rlE "supabase\.(from|rpc|storage)" src/` → limpio, salvo comentarios y `supabase.auth.*`.
- [ ] `npm run build` sin errores.
- [ ] Fuera del código (ver `estado-migracion.md` "Fuera del código"): RLS en Supabase para revocar escritura del cliente sobre columnas sensibles y **borrar `exec_sql`**, rotar keys de Groq/Gemini (viajaron expuestas en el bundle antes de esta migración).
