# TODO — Migración frontend a `/api/*` (dejar de pegarle a Supabase directo)

Checklist de continuación. Contexto completo y el porqué de la migración están en [`estado-migracion.md`](./estado-migracion.md); acá solo la lista accionable, con archivo/línea/endpoint destino para no tener que re-investigar.

Última actualización: 2026-07-21.

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
- [x] **`src/App.jsx` — parte de bajo riesgo (2026-07-21)**: feed de imágenes (daily/random/prefetch/dificultades/`handleNewRandom`) → `GET /api/imagenes`; `join_company_by_link` → `POST /api/enterprise/unirse`; `user_onboarded` → `PUT /api/usuarios/me`; reveal manual (`handleRevealOriginalPrompt`) → `POST /api/imagenes/:id/revelar` **solo para usuarios logueados** (gating server-side real: requiere sesión + intento previo en `intentos`; los guests siguen con el read directo porque sus intentos aún no están persistidos — ver abajo). De paso se arreglaron dos bugs de backend que esto dejó expuestos: (1) `imagenRepository.listarAsync` seleccionaba columnas que no existen (`theme`, `modo`) y no filtraba `company_id IS NULL` — el endpoint estaba roto de origen, nadie lo usaba; ahora soporta `daily`/`before`/`excludeMastered` y usa las columnas reales (`image_theme`, `seed`, `fecha`). (2) `imagen.eval_instructions` no existía como columna (es `challenge_eval_instructions`) — `getPublicaAsync` no lo estaba filtrando (se filtraba a la respuesta pública) y `intentoService` nunca le pasaba las instrucciones custom al evaluador. Ambos corregidos y verificados con una query real contra la BD de prod (ver detalle en `estado-migracion.md`).

## 🔴 Pendiente — por impacto

### 1. `src/App.jsx` — resto: el flujo de submit (scoring/ELO/anti-cheat) — EL MÁS CRÍTICO Y RIESGOSO, todavía sin tocar

Decisión tomada con el usuario (2026-07-21): esta parte se migra en una sesión aparte, revisada despacio — no se puede probar interactivamente en un browser desde acá, y es el núcleo del juego. También se decidió que los intentos de guest van a dejar de tener "carry-over" al registrarse (ver nota abajo) en vez de construir un mecanismo de reclamo — más simple, se puede mejorar después.

Dos vectores de trampa activos hoy (sin cambios):
- **Línea ~925** (era ~492): `supabase.from('intentos').insert(...)` — el cliente arma el intento entero.
- **Líneas ~1002-1025** (era ~1038-1061): el cliente **calcula su propio ELO** (`supabase.from('usuarios').select('elo_rating')...update({ elo_rating: newElo })`) — un usuario deshonesto puede escribir cualquier ELO desde la consola del browser.
- **Línea ~895** (era ~931): `supabase.from('imagenes_ia').select('prompt_original')` — auto-reveal del demo de guest tras 4 intentos, lee la respuesta directo.
- **Línea ~812** (era ~848): fetch de `prompt_original` en el momento del submit, para el scoring client-side con `comparePrompts` (Groq desde el cliente).
- **Líneas ~463-498** (era ~456-512): migración de intentos de guest desde `sessionStorage` al loguearse — queda obsoleta cuando el submit pase a ser server-authoritative (ver nota).
- **Línea ~912** (era ~948): chequeo de `isImprovement` contra el mejor score previo.
- Guest fallback en `handleRevealOriginalPrompt` (línea ~1190): intencional por ahora, ver nota.

**Reemplazo:**
- Todo el submit → `POST /api/intentos` (body: `id_imagen, prompt_usuario, modo, elapsed_seconds, attempt_number, lang, challenge_id, typing_report, focus_report, clip_report`; el server hace eval IA + scoring + ELO + contadores + anti-cheat en una transacción y devuelve el resultado completo — ver `server/src/services/intentoService.js`, ya existe y funciona, verificado con SQL directo).
- Esto también resuelve de una **los puntos 12 y 13 (plagiarismService/aiDetectionService client-side)** — `POST /api/intentos` YA corre esa detección server-side dentro de la misma transacción, así que al migrar el submit esos dos archivos del cliente quedan puramente para borrar, no para reimplementar.

⚠️ **Nota de producto (decidida 2026-07-21, no revertir sin volver a hablarlo)**: hoy el guest juega y sus intentos se guardan en `sessionStorage`, recién insertándose en la BD (atribuidos a su usuario) cuando se registra. Con scoring server-side eso deja de ser posible tal cual — el score hay que calcularlo en el momento del submit, así que el intento del guest queda guardado enseguida pero **sin usuario** (`id_usuario: null`), y no se re-atribuye al crear la cuenta. Se decidió aceptar esa pérdida de "carry-over" en vez de construir un guest-session-token para reclamarlos después (queda como mejora futura si se quiere). Como consecuencia, todo el bloque de migración de `sessionStorage` (líneas ~463-498) pasa a ser código muerto a **borrar**, no a migrar, en el mismo pase que se toque el submit.

⚠️ Cuidado también con: el auto-reveal de guest a los 4 intentos y el reveal manual para guests van a seguir sin poder usar `POST /api/imagenes/:id/revelar` (ese endpoint exige sesión + intento ya persistido) — mismo problema de fondo que el punto anterior. Si el submit de guest deja de persistir nada hasta el registro, hay que decidir de nuevo cómo el guest ve el prompt tras 4 intentos (hoy lee `prompt_original` directo, que ya es el status quo, no empeora).

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
