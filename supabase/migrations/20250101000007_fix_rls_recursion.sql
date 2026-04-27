-- ════════════════════════════════════════════════════════════════════════════
-- FIX RLS RECURSION — elimina los 500 de PostgREST
--
-- CAUSA RAÍZ: Las políticas "admins_full_*" hacen SELECT FROM usuarios
-- dentro de una política ON usuarios → recursión infinita → HTTP 500.
--
-- SOLUCIÓN: Usar una función SECURITY DEFINER que bypasea RLS para
-- verificar adminstate, rompiendo la recursión. Aplicar el mismo
-- patrón a todas las tablas que referencian usuarios para el check admin.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Helper: is_admin() — SECURITY DEFINER bypasea RLS ────────────────────
-- Esta función corre como el owner de la tabla (superuser), no como el
-- usuario que hace la request, por lo que no dispara RLS en usuarios.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id_usuario = auth.uid()
      AND (adminstate = true OR devstate = true)
  );
$$;

-- Dar acceso a roles que ejecutan queries
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated, anon;

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: usuarios
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Limpiar TODAS las políticas existentes para empezar limpio
DROP POLICY IF EXISTS "usuarios_select_own"    ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_public" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_own"    ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_own"    ON usuarios;
DROP POLICY IF EXISTS "admins_full_usuarios"   ON usuarios;

-- SELECT: cualquiera puede leer perfiles (necesario para leaderboard, búsqueda, etc.)
CREATE POLICY "usuarios_select_public"
  ON usuarios FOR SELECT
  TO authenticated, anon
  USING (true);

-- INSERT: solo el propio usuario puede crear su fila (on signup)
CREATE POLICY "usuarios_insert_own"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (id_usuario = auth.uid());

-- UPDATE: el propio usuario actualiza su fila; admins usan is_admin()
CREATE POLICY "usuarios_update_own"
  ON usuarios FOR UPDATE
  TO authenticated
  USING  (id_usuario = auth.uid() OR is_admin())
  WITH CHECK (id_usuario = auth.uid() OR is_admin());

-- DELETE: solo admins
CREATE POLICY "usuarios_delete_admin"
  ON usuarios FOR DELETE
  TO authenticated
  USING (is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: imagenes_ia
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE imagenes_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imagenes_select_all"   ON imagenes_ia;
DROP POLICY IF EXISTS "imagenes_insert_admin" ON imagenes_ia;
DROP POLICY IF EXISTS "imagenes_update_admin" ON imagenes_ia;
DROP POLICY IF EXISTS "imagenes_delete_admin" ON imagenes_ia;

-- SELECT: público (landing page, juego, leaderboard)
CREATE POLICY "imagenes_select_all"
  ON imagenes_ia FOR SELECT
  TO authenticated, anon
  USING (true);

-- INSERT/UPDATE/DELETE: solo admins
CREATE POLICY "imagenes_insert_admin"
  ON imagenes_ia FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "imagenes_update_admin"
  ON imagenes_ia FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "imagenes_delete_admin"
  ON imagenes_ia FOR DELETE
  TO authenticated
  USING (is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: intentos
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE intentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intentos_select_own"    ON intentos;
DROP POLICY IF EXISTS "intentos_select_public" ON intentos;
DROP POLICY IF EXISTS "intentos_insert_own"    ON intentos;
DROP POLICY IF EXISTS "intentos_update_own"    ON intentos;
DROP POLICY IF EXISTS "admins_full_intentos"   ON intentos;

-- SELECT: cualquier usuario autenticado puede leer intentos
-- (necesario para leaderboard, perfil público, community slideshow)
CREATE POLICY "intentos_select_all"
  ON intentos FOR SELECT
  TO authenticated, anon
  USING (true);

-- INSERT: el propio usuario o anon (guest attempts)
CREATE POLICY "intentos_insert_own"
  ON intentos FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    id_usuario = auth.uid()
    OR id_usuario IS NULL   -- guest attempts
    OR is_admin()
  );

-- UPDATE: propio usuario o admin (para guardar elo_delta, etc.)
CREATE POLICY "intentos_update_own"
  ON intentos FOR UPDATE
  TO authenticated
  USING  (id_usuario = auth.uid() OR is_admin())
  WITH CHECK (id_usuario = auth.uid() OR is_admin());

-- DELETE: solo admins
CREATE POLICY "intentos_delete_admin"
  ON intentos FOR DELETE
  TO authenticated
  USING (is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: team_invitations
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_can_view_own_invitations"  ON team_invitations;
DROP POLICY IF EXISTS "users_can_insert_invitations"    ON team_invitations;
DROP POLICY IF EXISTS "users_can_update_invitations"    ON team_invitations;
DROP POLICY IF EXISTS "admins_full_access_invitations"  ON team_invitations;

-- SELECT: solo las invitaciones donde el usuario es parte
CREATE POLICY "invitations_select_own"
  ON team_invitations FOR SELECT
  TO authenticated
  USING (
    company_id = auth.uid()
    OR user_id  = auth.uid()
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR is_admin()
  );

-- INSERT: empresas crean invitaciones, usuarios solicitan unirse
CREATE POLICY "invitations_insert"
  ON team_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = auth.uid()
    OR user_id  = auth.uid()
    OR is_admin()
  );

-- UPDATE: partes involucradas pueden actualizar estado
CREATE POLICY "invitations_update_own"
  ON team_invitations FOR UPDATE
  TO authenticated
  USING (
    company_id = auth.uid()
    OR user_id  = auth.uid()
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR is_admin()
  );

-- DELETE: solo admins o la empresa que creó la invitación
CREATE POLICY "invitations_delete"
  ON team_invitations FOR DELETE
  TO authenticated
  USING (company_id = auth.uid() OR is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: notification_reads
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_reads" ON notification_reads;

CREATE POLICY "notification_reads_own"
  ON notification_reads FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: user_reports
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_can_insert_reports"    ON user_reports;
DROP POLICY IF EXISTS "users_can_view_own_reports"  ON user_reports;
DROP POLICY IF EXISTS "admins_can_manage_reports"   ON user_reports;

-- INSERT: cualquier usuario autenticado o anon puede reportar
CREATE POLICY "reports_insert"
  ON user_reports FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    reporter_id = auth.uid()
    OR reporter_id IS NULL
  );

-- SELECT: el reporter ve sus propios reportes; admins ven todos
CREATE POLICY "reports_select"
  ON user_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid() OR is_admin());

-- UPDATE/DELETE: solo admins
CREATE POLICY "reports_admin"
  ON user_reports FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "reports_delete_admin"
  ON user_reports FOR DELETE
  TO authenticated
  USING (is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: user_preferences
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
    ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "users_manage_own_preferences" ON user_preferences;
    DROP POLICY IF EXISTS "preferences_own"              ON user_preferences;

    CREATE POLICY "preferences_own"
      ON user_preferences FOR ALL
      TO authenticated
      USING  (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- TABLAS OPCIONALES — aplicar si existen
-- ════════════════════════════════════════════════════════════════════════════

-- guide_suggestions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guide_suggestions') THEN
    ALTER TABLE guide_suggestions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "guide_suggestions_select" ON guide_suggestions;
    DROP POLICY IF EXISTS "guide_suggestions_insert" ON guide_suggestions;

    -- Usuarios ven sugerencias dirigidas a ellos
    CREATE POLICY "guide_suggestions_select"
      ON guide_suggestions FOR SELECT
      TO authenticated
      USING (
        target_user_id = auth.uid()
        OR target_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR is_admin()
      );

    -- Solo admins insertan sugerencias
    CREATE POLICY "guide_suggestions_insert"
      ON guide_suggestions FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());
  END IF;
END $$;

-- challenge_notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_notifications') THEN
    ALTER TABLE challenge_notifications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "challenge_notif_select" ON challenge_notifications;
    DROP POLICY IF EXISTS "challenge_notif_insert" ON challenge_notifications;

    CREATE POLICY "challenge_notif_select"
      ON challenge_notifications FOR SELECT
      TO authenticated
      USING (target_user_id = auth.uid() OR company_id = auth.uid() OR is_admin());

    CREATE POLICY "challenge_notif_insert"
      ON challenge_notifications FOR INSERT
      TO authenticated
      WITH CHECK (company_id = auth.uid() OR is_admin());
  END IF;
END $$;

-- tickets
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
    ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "tickets_select" ON tickets;
    DROP POLICY IF EXISTS "tickets_insert" ON tickets;
    DROP POLICY IF EXISTS "tickets_update" ON tickets;

    CREATE POLICY "tickets_select"
      ON tickets FOR SELECT
      TO authenticated
      USING (id_usuario = auth.uid() OR is_admin());

    CREATE POLICY "tickets_insert"
      ON tickets FOR INSERT
      TO authenticated
      WITH CHECK (id_usuario = auth.uid());

    CREATE POLICY "tickets_update"
      ON tickets FOR UPDATE
      TO authenticated
      USING (id_usuario = auth.uid() OR is_admin());
  END IF;
END $$;

-- ticket_mensajes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_mensajes') THEN
    ALTER TABLE ticket_mensajes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "ticket_mensajes_select" ON ticket_mensajes;
    DROP POLICY IF EXISTS "ticket_mensajes_insert" ON ticket_mensajes;

    -- Ver mensajes del ticket si sos el dueño del ticket o admin
    CREATE POLICY "ticket_mensajes_select"
      ON ticket_mensajes FOR SELECT
      TO authenticated
      USING (
        id_usuario = auth.uid()
        OR is_admin()
        OR EXISTS (
          SELECT 1 FROM tickets t
          WHERE t.id_ticket = ticket_mensajes.id_ticket
            AND t.id_usuario = auth.uid()
        )
      );

    CREATE POLICY "ticket_mensajes_insert"
      ON ticket_mensajes FOR INSERT
      TO authenticated
      WITH CHECK (
        id_usuario = auth.uid()
        OR is_admin()
      );
  END IF;
END $$;

-- torneos / torneo_participantes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'torneos') THEN
    ALTER TABLE torneos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "torneos_select_all" ON torneos;
    CREATE POLICY "torneos_select_all"
      ON torneos FOR SELECT
      TO authenticated, anon
      USING (true);
    DROP POLICY IF EXISTS "torneos_admin" ON torneos;
    CREATE POLICY "torneos_admin"
      ON torneos FOR ALL
      TO authenticated
      USING (is_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'torneo_participantes') THEN
    ALTER TABLE torneo_participantes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "torneo_part_select" ON torneo_participantes;
    DROP POLICY IF EXISTS "torneo_part_insert" ON torneo_participantes;
    CREATE POLICY "torneo_part_select"
      ON torneo_participantes FOR SELECT
      TO authenticated, anon
      USING (true);
    CREATE POLICY "torneo_part_insert"
      ON torneo_participantes FOR INSERT
      TO authenticated
      WITH CHECK (id_usuario = auth.uid());
  END IF;
END $$;

-- ai_detection_flags
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_detection_flags') THEN
    ALTER TABLE ai_detection_flags ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ai_flags_admin" ON ai_detection_flags;
    DROP POLICY IF EXISTS "ai_flags_insert" ON ai_detection_flags;
    CREATE POLICY "ai_flags_insert"
      ON ai_detection_flags FOR INSERT
      TO authenticated
      WITH CHECK (id_usuario = auth.uid() OR is_admin());
    CREATE POLICY "ai_flags_admin"
      ON ai_detection_flags FOR SELECT
      TO authenticated
      USING (id_usuario = auth.uid() OR is_admin());
  END IF;
END $$;
