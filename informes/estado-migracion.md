# Informe de estado — Migración de PrompTool a arquitectura en capas

**Repo:** `PROMPTOOL` — ahora es un **monorepo**: `src/` (frontend Vite/React) + `server/` (backend Express 5, arquitectura Controller → Service → Repository). El backend se desarrolló primero en un repo aparte (`BACKEND-PROMPTOOL`) y se fusionó acá en el commit `d8a77cd` ("Migrar backend Express al monorepo como función serverless de Vercel — Fase 1").

**Objetivo original:** sacar del frontend las ~137 llamadas directas a Supabase (`supabase.from/rpc/storage`) y la lógica de negocio que viajaba con ellas (scoring, ELO, anti-cheat, admin, keys de IA expuestas), reemplazándolas por una API propia.

---

## Resumen

- **Backend:** completo en su mayor parte — 8 fases de desarrollo (núcleo de intentos, feed/leaderboard/registro/admin, tickets/preferencias/reportes, mailing, anti-cheat, social/notificaciones, enterprise, storage), más la fusión al monorepo con adaptación a Vercel serverless.
- **Frontend:** apenas empezado. Existe `src/lib/apiClient.js` (cliente HTTP central con Bearer de `supabase.auth`) y **4 archivos** ya migrados a los endpoints de email nuevos (`AuthModal.jsx`, `useAuth.js`, `EnterprisePanel.jsx`, `EnterpriseOnboarding.jsx`). Pero **quedan 17 archivos** en `src/` con llamadas directas `supabase.from/rpc/storage` sin migrar — es la mayor parte del trabajo de frontend, incluido el núcleo de scoring/ELO (`App.jsx`).
- **RLS / rotación de keys en Supabase:** no hecho todavía (fuera del alcance del código).

---

## ✅ Backend — hecho

### Núcleo de intentos (base)
- `POST /api/intentos` — evaluación IA (Groq server-side) + scoring + penalización de tiempo + ELO + contadores, en una transacción.
- `GET /api/intentos/mios`, `GET/PUT /api/usuarios/me`, `GET /api/usuarios/:id`, `GET /api/imagenes/:id`, `/health`.

### Feed, leaderboard, registro, admin
- `GET /api/imagenes` (filtros + random), `GET /api/imagenes/dificultades`, `POST /api/imagenes/:id/revelar` (gating server-side del `prompt_original`).
- `GET /api/leaderboard`, `POST /api/leaderboard/snapshot` (admin; ahora además corre solo **vía cron de Vercel**, ver abajo).
- `POST /api/usuarios` (alta de perfil idempotente, id/email del JWT), `username-disponible`, `email-por-username`.
- `/api/admin`: listado + toggles de usuario por whitelist (`adminstate`/`verified`/`devstate`). **`exec_sql` no se reimplementó** — no hay SQL arbitrario ni CRUD genérico de tabla.

### Tickets, preferencias, reportes
- `/api/tickets` (crear con primer mensaje transaccional, listar, responder con `es_admin` server-side, cerrar; `/todos` admin).
- `/api/usuarios/me/preferencias` (privacidad/visual, whitelist).
- `/api/reportes` (crear, auth opcional) + gestión admin (listar/actualizar/borrar), con notificación al reporter.

### Mailing (Mailtrap)
- Consolidado en `emailService.js`, expuesto por `/api/email/*` (otp, otp/verify, welcome, invite, auth-hook). Reemplazó los 4 serverless de Resend que vivían en `api/` (`send-otp`, `send-welcome`, `send-invite`, `verify-otp` — **borrados** en el commit de fusión).
- **`api/send-auth-email.js`** (el 5º serverless de Resend, que había sobrevivido) fue **retirado**: por la precedencia de ruteo de Vercel (filesystem antes que los rewrites) interceptaba `/api/send-auth-email` con la lógica vieja de Resend y, sin `RESEND_API_KEY`, devolvía 500 en todos los mails de auth. Ahora `POST /api/send-auth-email` es un **alias** hacia el mismo handler que `/api/email/auth-hook` (Mailtrap), así funciona apunte donde apunte el hook de Supabase.
- **Verificación del Auth Hook** reescrita a **Standard Webhooks** (`webhook-id/timestamp/signature`, HMAC-SHA256 sobre el body crudo con el secreto `v1,whsec_…`), que es como Supabase firma los HTTP hooks. El check anterior comparaba `Authorization: Bearer <secret>`, esquema que Supabase **no** usa, por lo que con el secreto configurado habría rechazado con 401 todas las llamadas reales. Se mantiene el Bearer como camino de compat para pruebas manuales.
- **`authMiddleware.js` no verificaba tokens reales — bug mucho más grave que el mailing.** El proyecto de Supabase ya migró a **JWT Signing Keys** asimétricas (este proyecto expone una sola key `ES256` en `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), pero el middleware solo sabía verificar `HS256` contra el `SUPABASE_JWT_SECRET` clásico. Resultado: **todo endpoint que requiere sesión rechazaba con 401 el 100% de los tokens reales** — `/api/email/welcome`, `/api/email/invite`, `/api/intentos`, `/api/usuarios/me`, `/api/enterprise/*`, todos. Confirmado en producción con una cuenta de prueba: se creó bien (el alta pasa por Supabase/RLS directo, no por este middleware) pero `welcome_email_sent` quedó en `false` porque la llamada a `/api/email/welcome` fallaba en silencio.
  - Fix: `authMiddleware`/`optionalAuthMiddleware` ahora decodifican el header del JWT y, si el algoritmo no es `HS256`, resuelven la clave pública desde el JWKS del proyecto (cacheado 10 min, con reintento si el `kid` rotó) usando `crypto.createPublicKey({ format: 'jwk' })` — sin agregar dependencias nuevas. Se mantiene el camino `HS256` por compatibilidad con sesiones viejas que aún no rotaron.
  - Verificado end-to-end con un token real: se creó una cuenta descartable vía la API de Supabase, se le pasó el `access_token` (firmado `ES256`) por el middleware nuevo dentro de la app Express real, y la request pasó la verificación de firma (llegó a la lógica de negocio en vez de cortar en 401). Cuenta de prueba borrada al terminar.

### Anti-cheat server-side
- `plagiarismService.js` y `aiDetectionService.js` portados e integrados **dentro de** `POST /api/intentos` (antes el cliente se flageaba a sí mismo). Señales autoritativas: tiempo vs. score, similitud con intentos previos, patrones de texto de IA, ráfagas. Escalera de suspensión (2→warned, 5→suspended 7 días, 10→banned) en la misma transacción del intento. La respuesta nunca expone las razones de detección.

### Social + notificaciones + perfil
- `follows` (`GET/POST/DELETE /api/usuarios/:id/follow`), `GET /api/notificaciones` (agrega 4 fuentes: invitaciones, guide_suggestions, challenge_notifications, notification_reads), `POST /api/notificaciones/leidas`.
- Whitelist de perfil ampliada (`showcase_url`, `idioma_preferido`, campos de empresa gateados por `user_type`).

### Enterprise completo (`/api/enterprise/...`)
- El bloque más grande: equipo/roles, membresía, invitaciones, guías, chat Groq server-side, desafíos (creación + generación con Gemini).
- Reusa las RPCs `SECURITY DEFINER` existentes en Supabase desde el backend (seteando `request.jwt.claims` con el `sub` ya verificado), en vez de reimplementarlas.
- `POST /api/enterprise/desafios/generar` ahora usa contrato **storage-first** (`image_path`, no la imagen en el body) para no chocar con el límite de 4.5MB de Vercel.

### Storage server-side
- `POST /api/usuarios/me/avatar` y `POST /api/enterprise/desafios/imagen` — subida vía API REST de Supabase Storage con `SUPABASE_SERVICE_ROLE_KEY`, validación por **magic bytes** (no por extensión/Content-Type del cliente). Pendiente: moderación NSFW server-side (hoy solo existe en el cliente y es evadible).

### Fusión al monorepo + adaptación serverless (commit `d8a77cd`)
Esto es nuevo respecto al informe anterior del backend standalone:
- `server/src` pasa a ser una función serverless de Vercel: `api/index.mjs` la expone como catch-all; `vercel.json` reescribe `/api/*` y `/health` hacia ahí, con `maxDuration: 60`.
- **Rate limiting migrado** de `express-rate-limit` (en memoria) a **Upstash Redis** (REST), con fallback en memoria para dev local — necesario porque las funciones serverless no comparten memoria entre invocaciones.
- **Cron nativo de Vercel** (`vercel.json` → `crons`) dispara `GET /api/cron/leaderboard-snapshot` todos los días a las 6am, protegido con `CRON_SECRET` (nuevo `cronController.js`).
- `img-proxy` (antes serverless suelto en `api/img-proxy.js`) se porta a `imgProxyController.js` dentro del backend, montado **antes** del rate limiter general (es tráfico de `<img>` de alto volumen, con su propia allowlist + protección SSRF).
- Nuevo `authController.js` (`/api/auth/confirm`) para los links de los emails del Auth Hook de Supabase.
- `database/db.js` ajustado para serverless (`PG_POOL_MAX`, `allowExitOnIdle`).
- Envíos fire-and-forget (ej. email de invitación) usan `waitUntil` de `@vercel/functions` en vez de dejar la promesa suelta, para que el runtime no mate la función antes de que termine.
- **Frontend:** se creó `src/lib/apiClient.js` (Bearer de `supabase.auth.getSession()`) y se migraron a él `AuthModal.jsx`, `useAuth.js`, `EnterprisePanel.jsx` y `EnterpriseOnboarding.jsx` — pero **solo para los endpoints de email**, no para el resto de sus llamadas a Supabase.

---

## 🔜 Falta hacer

### Backend (menor)
- **Moderación NSFW server-side** para los uploads (requiere tfjs-node + nsfwjs en el server, dependencia pesada).
- **Torneos**: no hay llamadas reales en el frontend todavía (página estática/"coming soon") — se posterga hasta que exista la feature.
- **`GET /api/stats/publicas`** — conteo público de intentos para la landing.
- **Tracking server-side del inicio de intento** (hoy `elapsed_seconds` lo reporta el cliente, clampeado, pero sigue siendo confiable-por-buena-fe).
- Endpoint con whitelist para la config JSONB de empresa (`training_config`, `dashboard_filters`, `performance_metrics`) — hoy el panel enterprise sigue editando esas columnas directo.

### Frontend (el grueso del trabajo pendiente)
**17 archivos** en `src/` todavía llaman a Supabase directo (`.from/.rpc/.storage`) en vez de a la API. Los más importantes por impacto de seguridad:
1. **`App.jsx`** — el núcleo de scoring/ELO/feed/reveal sigue sin cablear a `/api/intentos`, `/api/imagenes`, etc. Es el archivo más crítico: mientras no se migre, el cliente sigue pudiendo escribir su propio ELO y leer `prompt_original` directo.
2. **`UsuarioApp.jsx`, `LeaderboardApp.jsx`** — perfil, stats, leaderboard.
3. **`AdminApp.jsx`**, `hooks/useAdmin.js`, `hooks/useDev.js` — admin todavía resuelve autorización contra `user_metadata` en el cliente.
4. **`plagiarismService.js`, `aiDetectionService.js`, `rateLimitService.js`, `geminiService.js`, `aiChallengeService.js`** — servicios que ya tienen equivalente server-side (fases 5/7) y deberían vaciarse o borrarse.
5. **`SupportApp.jsx`, `ConfigModal.jsx`, `Header.jsx`** — tickets, preferencias/reportes, notificaciones ya tienen endpoint.
6. **`CompanyPanel.jsx`**, resto de componentes de guías (`GuidesApp.jsx`, `GuidesSection.jsx`, `EnterpriseGuideContent.jsx`).
7. **`TournamentsApp.jsx`** — bajo impacto (feature no activa).

Sugerido: correr `grep -rlE "supabase\.(from|rpc|storage)" src/` para la lista exacta y priorizar por el orden de arriba (scoring/ELO primero, después admin, después el resto).

### Fuera del código (dependencias transversales)
1. **RLS en Supabase**: revocar escritura del cliente sobre columnas sensibles (`elo_rating`, `adminstate`, `suspension_*`, contadores), ocultar `prompt_original`/`eval_instructions`, **borrar la función `exec_sql`**. Sin esto, aunque el frontend deje de usarlas, la anon key todavía puede llamarlas directo.
2. **Rotar las keys** de Groq y Gemini (viajaron en el bundle del frontend antes de esta migración → deben considerarse comprometidas).
3. Confirmar en producción las variables nuevas: `MAILTRAP_API_TOKEN`, `OTP_SECRET`, `SUPABASE_AUTH_HOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CRON_SECRET`, credenciales de Upstash Redis.
4. **Auth Hook de Supabase (Send Email Hook)**: en el dashboard (Authentication → Hooks) apuntarlo a `https://promptool.app/api/email/auth-hook` (o la URL vieja `…/api/send-auth-email`, que ahora también funciona por el alias), tipo HTTPS, y que el secreto generado ahí (`v1,whsec_…`) sea **el mismo** que `SUPABASE_AUTH_HOOK_SECRET` en Vercel. Con esto la verificación de firma valida y salen los mails de signup/recovery/magic-link/email-change.

---

## Notas / riesgos abiertos

- **Esquema y RPCs inferidos del uso del frontend**, no verificados contra las definiciones reales en Supabase (nombres de columnas y de argumentos de RPC). Falta una prueba E2E contra una BD real.
- Mientras los 17 archivos del frontend no migren, **la migración no cierra el agujero de seguridad** aunque el backend esté completo: el cliente puede seguir hablando con Supabase directo mientras la anon key conserve permisos.
- El chat enterprise y los desafíos generados por IA ya no exponen las keys de Groq/Gemini en el bundle — eso es una mejora real e independiente de que el resto del frontend migre.
