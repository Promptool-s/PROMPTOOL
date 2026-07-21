# TODO — Migración frontend a `/api/*` (dejar de pegarle a Supabase directo)

Checklist de continuación. Contexto completo y el porqué de la migración están en [`estado-migracion.md`](./estado-migracion.md); acá solo la lista accionable, con archivo/línea/endpoint destino para no tener que re-investigar.

Última actualización: 2026-07-21 (parte 2 — submit completo).

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
- [x] **`src/App.jsx` — parte de bajo riesgo (2026-07-21)**: feed de imágenes (daily/random/prefetch/dificultades/`handleNewRandom`) → `GET /api/imagenes`; `join_company_by_link` → `POST /api/enterprise/unirse`; `user_onboarded` → `PUT /api/usuarios/me`; reveal manual (`handleRevealOriginalPrompt`) → `POST /api/imagenes/:id/revelar` para usuarios logueados. De paso se arreglaron dos bugs de backend: `imagenRepository.listarAsync` seleccionaba columnas inexistentes y no filtraba `company_id IS NULL` (endpoint roto de origen); `imagen.eval_instructions` no existía como columna (es `challenge_eval_instructions`) — no se filtraba de la respuesta pública y nunca llegaba al evaluador.
- [x] **`src/App.jsx` — submit completo (2026-07-21, parte 2)**: `handleSubmit` reescrito de punta a punta para llamar a `POST /api/intentos` (evaluación LLM + scoring + timing + ELO + anti-cheat, todo server-side y en una transacción). Se sacaron: el insert directo a `intentos`, el cálculo y `UPDATE` client-side de `elo_rating`, el fetch de `prompt_original` en el submit, la llamada a `comparePrompts` (Groq desde el cliente, con la API key expuesta en el bundle), y el bloque entero de migración de intentos de guest desde `sessionStorage` (quedó obsoleto — ver nota de producto abajo, ya asumida). El loader de desafíos (`?challenge=ID`) también se migró a `GET /api/imagenes/:id` + `GET /api/usuarios/:id`, porque ya no hace falta que el cliente reciba `challenge_eval_instructions` (el server lo usa internamente).
  - **Backend**: `intentoService.crearIntentoAsync` ahora también aplica la penalidad de score por detección de IA (10/20/40 pts según severidad, antes solo el cliente la restaba) y acepta `ranked` en el body como opt-out del toggle "modo rankeado" del jugador (solo puede restar elegibilidad, nunca sumarla más allá de lo que ya permiten modo/challenge/usuario). La respuesta agrega `aiCheat: { penalty, severity } | null` para que el cliente siga mostrando el aviso.
  - **Archivos vaciados/borrados**: `src/services/geminiService.js` (borrado — llamaba a Groq directo desde el cliente con `VITE_GROQ_API_KEY` expuesta; ya no lo usa nadie). `src/services/plagiarismService.js` (reducido a solo `checkSuspension`, de solo lectura — se sacó `analyzePlagiarism` entero y el `UPDATE` que hacía `checkSuspension` para auto-limpiar suspensiones vencidas, eso ya lo hace el backend en cada submit). `src/services/aiDetectionService.js` (reducido a solo `checkClipboardForGameImage` — es la única pieza que necesita correr en el cliente, porque compara píxeles del portapapeles vía canvas; el resto de la detección de IA vive server-side).
  - **Decisión de producto tomada con el usuario (no revertir sin volver a hablarlo)**: los guests ya no tienen "carry-over" de sus intentos al registrarse — como el scoring es server-authoritative, el intento del guest se persiste enseguida (`id_usuario: null`) en vez de quedar en `sessionStorage` para migrarse después. También se decidió mantener la penalidad de score por detección de IA (server-side ahora) y mantener el chequeo proactivo de suspensión (banner apenas se entra a la página), ambos ya implementados arriba.
  - **Sin cambios (a propósito, por la misma razón)**: el auto-reveal del demo de guest a los 4 intentos sigue leyendo `prompt_original` directo — el endpoint gateado `POST /api/imagenes/:id/revelar` exige sesión + intento ya persistido, y un guest no tiene eso. Es el mismo comportamiento de antes, no empeora.
  - **Verificación**: `node --check` en los archivos de backend tocados, `npm run build` limpio (bundle principal bajó ~26KB al sacar `geminiService.js`), prueba directa de `intentoService.crearIntentoAsync` contra la BD real como guest (llegó hasta la llamada a Groq — cortó ahí por una API key inválida en el `.env` local, no por el código nuevo). **No se pudo probar el flujo completo de submit en un browser real** — revisar manualmente antes de confiar en esto en producción.

## 🔴 Pendiente — por impacto

### 1. `src/UsuarioApp.jsx` (31 sitios)

Perfil, stats, follows, showcase. Backend ya tiene `getPerfilAsync`, `updatePerfilAsync`, `followAsync`/`unfollowAsync` en `usuarioService.js` → exponer/usar vía `/api/usuarios/*`. Revisar si faltan endpoints para las stats agregadas que hoy arma con selects propios del cliente (ej. históricos, distribución de scores).

### 2. `src/AdminApp.jsx` (16 sitios) + `src/hooks/useAdmin.js` + `src/hooks/useDev.js`

Hoy la autorización de admin se resuelve contra `user_metadata` **en el cliente** — hay que verificar server-side. Backend ya tiene `/api/admin/*` (listado + toggles de usuario por whitelist: `adminstate`/`verified`/`devstate`, ver `estado-migracion.md` sección Backend). Revisar qué falta exponer antes de escribir controllers nuevos.

### 3. `src/components/EnterprisePanel.jsx` — resto (22 sitios restantes tras el fix de invite)

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

### 4. `src/components/CompanyPanel.jsx` (1 sitio)

Línea 72: `supabase.rpc('leave_company')` → `api.post('/enterprise/salir')` (`salirAsync`, ya existe). Trivial.

### 5. `src/components/EnterpriseGuideContent.jsx` (1 sitio)

Línea 44: `supabase.rpc('update_guide_progress', ...)` → `actualizarProgresoGuiaAsync` (ya existe en `enterpriseService.js`); confirmar que está expuesto en `enterpriseController.js`, si no agregar la ruta.

---

## 🔒 Seguridad — services client-side

### ✅ Resueltos (2026-07-21, junto con el submit de App.jsx)
- `src/services/plagiarismService.js` — **hecho**. Se sacó `analyzePlagiarism` entero (insertaba `plagiarism_flags` y hacía `UPDATE` de `suspension_status`/`elo_rating` directo) y el `UPDATE` de auto-limpieza de `checkSuspension` (línea vieja ~257, el self-unsuspend). El archivo quedó reducido a un `checkSuspension` de solo lectura, para el banner proactivo.
- `src/services/aiDetectionService.js` — **hecho**. Se sacó `detectAIGenerated` (insertaba `ai_detection_flags`) y `checkAIDetectionHistory`. Quedó reducido a `checkClipboardForGameImage`, que sigue siendo client-only porque compara píxeles vía canvas — el resultado se manda como señal (`clip_report`) a `POST /api/intentos`, que decide.
- `src/services/geminiService.js` — **borrado**. Llamaba a Groq directo desde el cliente con `VITE_GROQ_API_KEY` expuesta en el bundle; dejó de tener callers al migrar `handleSubmit`.

### `src/services/rateLimitService.js` (2 sitios) — revisar con el usuario, no migrar a ciegas

`supabase.rpc('check_rate_limit'/'reset_rate_limit')` contra la tabla `auth_rate_limit`. Es **intencionalmente** client-side porque protege login/signup, que corren **antes** de tener sesión propia (no hay JWT todavío para pegarle al backend). Decidir: ¿dejarlo así, o mover a un endpoint público del backend con su propio rate limit (patrón `emailSendLimiter`, ya existe)? Login en sí seguiría yendo directo a Supabase Auth de cualquier forma.

### Pendiente de confirmar
- `aiChallengeService.js` (usado en `ChallengeCreatorModal.jsx`) — no aparece en el grep de `supabase.(from|rpc|storage)`; confirmar si ya fue vaciado o si usa otro patrón (keys expuestas en el bundle, por ejemplo) antes de tacharlo. Es parte del flujo de creación de desafíos de empresa (bucket 3 arriba), no del juego en sí.
- **Rotar la key de Groq** (`VITE_GROQ_API_KEY`) — viajó expuesta en el bundle de todos los deploys anteriores a este; borrar `geminiService.js` no la invalida retroactivamente. Ítem de infra, ver `estado-migracion.md` "Fuera del código".

---

## Bajo impacto / posponer

- `src/TournamentsApp.jsx` — feature no activa (página estática "coming soon"), sin llamadas reales todavía.

---

## Cierre de la migración (hacerlo al final, no antes)

- [ ] `grep -rlE "supabase\.(from|rpc|storage)" src/` → limpio, salvo comentarios y `supabase.auth.*`.
- [ ] `npm run build` sin errores.
- [ ] Fuera del código (ver `estado-migracion.md` "Fuera del código"): RLS en Supabase para revocar escritura del cliente sobre columnas sensibles y **borrar `exec_sql`**, rotar keys de Groq/Gemini (viajaron expuestas en el bundle antes de esta migración).
