# MIGRACIÓN FRONTEND → BACKEND (seguridad anon-key) — ESTADO FINAL

> **Qué es esto:** el registro completo de la migración que elimina TODO acceso
> directo del frontend a datos de Supabase (`supabase.from/rpc/storage`) y lo
> rutea por el backend Express (`/api/*`) vía `apiClient.js`. Cierra el agujero
> de seguridad de la anon-key y habilita revocar el `SELECT` de `anon` sobre
> columnas sensibles (sobre todo `prompt_original`).

Repos involucrados:
- **Frontend:** `Promptool-s/PROMPTOOL` (rama `master`)
- **Backend:** `Promptool-s/BACKEND-PROMPTOOL` (rama `fase-9-restos-menores`)

⚠️ La migración es **una sola unidad lógica repartida en 2 repos**. El frontend
llama a endpoints nuevos: si se despliega el front sin el back, **prod se rompe**.
Desplegar **BACKEND primero**, luego FRONTEND.

---

## 1. Estado: COMPLETO ✅

- `npm run build` (frontend) → verde (solo warning preexistente de chunk-size).
- `node --check` en los 14 archivos backend tocados → OK.
- Grep final en `PROMPTOOL/src` de `\.from\(['"]|\.rpc\(['"]|supabase\.storage`
  → solo quedan las 2 `supabase.rpc` de `rateLimitService.js` (excepción intencional).

---

## 2. Qué NO se migró (a propósito)

| Sitio | Motivo |
|-------|--------|
| `supabase.auth.*` (login/signup/logout/session/updateUser) | Corre client-side ANTES de tener sesión. Es el flujo de auth, no datos. |
| `src/services/rateLimitService.js` → `check_rate_limit` / `reset_rate_limit` | RPCs de infra de auth ejecutadas por el rol `anon` antes de la sesión. Funciones `SECURITY DEFINER`. Ver comentario en el archivo. |

---

## 3. Endpoints backend nuevos

### Torneos — `torneoController/Service/Repository` → `/api/torneos`
- `GET  /api/torneos` — listado ordenado por `fecha_inicio` (auth).
- `GET  /api/torneos/mis-inscripciones` — IDs del usuario (derivados del JWT).
- `GET  /api/torneos/:id/leaderboard` — top 20, forma `{id_usuario, score_total, intentos_completados, usuarios:{...}}`.
- `POST /api/torneos/:id/inscribirse` — inscribe con `id_usuario` del JWT (nunca del body); valida server-side que `estado ∈ {upcoming, active}` (409 si no); `ON CONFLICT (id_torneo, id_usuario) DO NOTHING`.

### Otros endpoints agregados en esta migración
- `GET  /api/usuarios/me/suspension` — estado de suspensión derivado (banner UX).
- `GET  /api/enterprise/mis-asignaciones` — guías asignadas vía `training_config.guide_assignments` (JSONB).
- `GET  /api/enterprise/guias-asignadas` — guías vía tabla `guide_assignments` ⋈ `enterprise_guides`.
- `GET  /api/intentos/comunidad` — showcase público (selección/filtro/shuffle server-side).
- `GET  /api/intentos/tiempo-personalizado?difficulty=` — tiempo recomendado (history-averaged).
- `GET  /api/intentos/daily-hecho` — si ya jugó el daily hoy.
- `POST /api/imagenes/:id/revelar-demo` — reveal de invitado restringido al pool demo (Easy, no-company). **Ver decisión #5.**

---

## 4. Archivos tocados

### Frontend (`PROMPTOOL/src`)
`AdminApp.jsx`, `App.jsx`, `GuidesApp.jsx`, `TournamentsApp.jsx`, `UsuarioApp.jsx`,
`components/CompanyPanel.jsx`, `components/EnterpriseGuideContent.jsx`,
`components/EnterpriseOnboarding.jsx`, `components/EnterprisePanel.jsx`,
`components/GuidesSection.jsx`, `components/Header.jsx`,
`components/landing/CommunitySlideshow.jsx`, `hooks/useAdmin.js`, `hooks/useDev.js`,
`services/plagiarismService.js`, `services/rateLimitService.js` (solo comentario).

### Backend (`BACKEND-PROMPTOOL/src`)
`app.js`, `controllers/{admin,enterprise,imagen,intento,usuario,torneo}Controller.js`,
`repositories/{empresa,imagen,intento,usuario,torneo}Repository.js`,
`services/{admin,enterprise,imagen,intento,storage,usuario,torneo}Service.js`.

---

## 5. Decisiones que necesitan tu OK / veto

1. **Guest reveal (override de "keep intentional").** En vez de dejar el
   `supabase.from('imagenes_ia').select('prompt_original')` client-side —que
   bloquearía el revoke que es el punto de toda la migración— ambos reveals de
   invitado van por `POST /api/imagenes/:id/revelar-demo`, limitado al pool demo
   (Easy, no-company). Si querés otra política, avisá.

2. **rateLimitService client-side.** Se conserva (ver §2). Requiere **preservar**
   el `GRANT EXECUTE` de `check_rate_limit`/`reset_rate_limit` para `anon`.

---

## 6. Pasos DB pendientes (NO ejecutados — hacer manualmente)

- [ ] **REVOKE** `SELECT` de `anon` en columnas sensibles (`prompt_original`, `eval_instructions`).
- [ ] **PRESERVAR** `GRANT EXECUTE` de `check_rate_limit` / `reset_rate_limit` para `anon`
      (si no, se rompe el rate-limit de login/signup).
- [ ] **DELETE** de la RPC `exec_sql` (el código ya no la llama).

---

## 7. Validar contra el esquema real ANTES del E2E (endpoints schema-inferidos)

- `guide_assignments` → columnas `assigned_to`, `guide_id`, `assigned_by`, `due_date`, `notes`, `status`.
- `enterprise_guides` → columnas usadas en el SELECT del roster de guías.
- `torneos` → `id_torneo`, `nombre`, `descripcion`, `estado`, `formato`, `fecha_inicio`, `fecha_fin`, `premio_descripcion`.
- `torneo_participantes` → `id_torneo`, `id_usuario`, `score_total`, `intentos_completados`.
  **Confirmar que exista la PK/UNIQUE compuesta `(id_torneo, id_usuario)`** (la usa el `ON CONFLICT`).

---

## 8. Pérdidas de capacidad en AdminApp

Con la eliminación de `exec_sql` y el acceso directo:
- No hay browsing de tablas arbitrarias.
- No hay alta/baja manual de usuarios desde el panel.
- No hay SQL runner.

---

## 9. Checklist de despliegue

1. [ ] Merge/deploy **BACKEND-PROMPTOOL** (`fase-9-restos-menores`) primero.
2. [ ] Validar esquema real (§7).
3. [ ] Deploy **PROMPTOOL** (`master`).
4. [ ] Ejecutar pasos DB (§6) — revoke + delete `exec_sql`.
5. [ ] Smoke E2E: login, jugar intento, daily, torneos (listar/inscribir/leaderboard),
       guías enterprise, reveal de invitado (demo), suspensión.
