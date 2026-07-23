-- ============================================================================
-- PROMPTOOL — Hardening de BD post-migración (cierre del agujero de la anon-key)
-- ----------------------------------------------------------------------------
-- Correr en el SQL Editor de Supabase. El backend se conecta por `pg` directo
-- (service role / DATABASE_URL) y BYPASSA RLS y grants, así que todo lo de abajo
-- afecta SOLO al rol anon/authenticated (la anon-key del cliente) — el agujero
-- que esta migración cierra. El frontend ya no lee tablas de datos directo,
-- salvo las 2 RPC de rate-limit (bloque 3), que se preservan a propósito.
--
-- Orden sugerido: 0 (verificar) -> 1 -> 2 -> 3 -> 4 -> smoke test -> 5 (opcional).
-- ============================================================================


-- ============================================================================
-- 0. PRE-FLIGHT — verificar antes de tocar nada (solo SELECTs, no muta)
-- ============================================================================

-- (a) Nombre real de las columnas sensibles en imagenes_ia.
--     El código usa prompt_original + challenge_eval_instructions. Confirmá cuál existe.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'imagenes_ia'
  AND column_name IN ('prompt_original', 'eval_instructions', 'challenge_eval_instructions');

-- (b) UNIQUE (id_torneo, id_usuario) que usa el ON CONFLICT de "inscribirse".
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.torneo_participantes'::regclass
  AND contype IN ('p', 'u');

-- (c) RPC de infra: check/reset_rate_limit se PRESERVAN; exec_sql se BORRA.
SELECT proname
FROM pg_proc
WHERE proname IN ('check_rate_limit', 'reset_rate_limit', 'exec_sql');


-- ============================================================================
-- 1. TORNEOS — UNIQUE requerida por POST /api/torneos/:id/inscribirse
--    (solo si el paso 0.b no la devolvió; sin esto el ON CONFLICT falla)
-- ============================================================================

ALTER TABLE public.torneo_participantes
  ADD CONSTRAINT torneo_participantes_torneo_usuario_key
  UNIQUE (id_torneo, id_usuario);


-- ============================================================================
-- 2. OCULTAR COLUMNAS SENSIBLES DE LA ANON-KEY (núcleo de la migración)
--    El frontend ya no lee imagenes_ia directo => revocar la lectura entera.
-- ============================================================================

REVOKE SELECT ON public.imagenes_ia FROM anon, authenticated;

-- ALTERNATIVA (si querés seguir exponiendo las columnas NO sensibles): en Postgres
-- hay que revocar a nivel tabla y re-otorgar columna por columna. Enumerá TODAS
-- menos prompt_original y challenge_eval_instructions. Descomentá y completá:
--
-- REVOKE SELECT ON public.imagenes_ia FROM anon, authenticated;
-- GRANT SELECT (
--   id_imagen, url_image, image_diff, company_id, created_at /* …resto públicas… */
-- ) ON public.imagenes_ia TO anon, authenticated;
-- -- OMITIR a propósito: prompt_original, challenge_eval_instructions


-- ============================================================================
-- 3. PRESERVAR el rate-limit de login/signup (NO borrar)
--    Corren client-side a propósito: protegen login/signup antes de tener sesión.
--    Nota: check_rate_limit/reset_rate_limit pueden tener VARIAS sobrecargas, así
--    que un GRANT sin firma falla ("function name is not unique"). Este bloque
--    recorre todas las sobrecargas y les otorga EXECUTE a anon una por una.
--    Como son SECURITY DEFINER puede que ya lo tuvieran; esto solo lo garantiza.
-- ============================================================================

DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname IN ('check_rate_limit', 'reset_rate_limit')
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f);
  END LOOP;
END $$;


-- ============================================================================
-- 4. BORRAR el SQL runner arbitrario
--    El código ya no lo llama; mientras exista, la anon-key ejecuta SQL arbitrario.
-- ============================================================================

-- Recorre todas las sobrecargas de exec_sql y las borra (evita el error de firma
-- ambigua si hubiera más de una). Si no existe ninguna, no hace nada.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname = 'exec_sql'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', f);
  END LOOP;
END $$;


-- ============================================================================
-- 5. HARDENING DE ESCRITURA (OPCIONAL — correr DESPUÉS del smoke test)
--    El cliente ya no escribe estas columnas (lo hace el backend), pero conviene
--    revocarlo por defensa en profundidad. Ajustá los nombres a tu esquema real.
--    OJO: asume que el frontend NO hace ya ningún UPDATE directo a `usuarios`
--    (todo pasa por PUT /api/usuarios/me). Si algo escribiera directo, se rompe.
-- ============================================================================

-- REVOKE INSERT, UPDATE ON public.usuarios FROM anon, authenticated;
-- GRANT UPDATE (
--   bio, avatar_url, banner_url, accent_color, idioma_preferido /* …lo que el user edita… */
-- ) ON public.usuarios TO authenticated;
-- -- Nunca en la lista: elo_rating, adminstate, verified, devstate, suspension_*, contadores de stats.


-- ============================================================================
-- NO-SQL (misma lista de cierre, fuera de este archivo):
--   - Rotar las keys de Groq y Gemini (viajaron en el bundle antes de la migración).
--   - Apuntar el Auth Hook de Supabase a /api/email/auth-hook (o el alias
--     /api/send-auth-email) con el mismo secreto que SUPABASE_AUTH_HOOK_SECRET.
-- ============================================================================
