-- ════════════════════════════════════════════════════════════════════════════
-- USER REPORTS
-- Sistema de reportes de usuarios (imágenes, prompts, bugs)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  target_type  TEXT NOT NULL CHECK (target_type IN ('image', 'prompt')),
  target_id    UUID,                          -- id_imagen si target_type = 'image'
  reason       TEXT NOT NULL,                 -- 'inappropriate' | 'incoherent' | 'visual_bug' | 'bad_eval' | 'ambiguous'
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewer_id  UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  reviewer_notes TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_reports_status      ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter    ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_target      ON user_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_created     ON user_reports(created_at DESC);

-- RLS
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede insertar un reporte
CREATE POLICY "users_can_insert_reports"
  ON user_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid() OR reporter_id IS NULL);

-- Los usuarios solo pueden ver sus propios reportes
CREATE POLICY "users_can_view_own_reports"
  ON user_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- Los admins pueden ver y actualizar todos los reportes
-- (requiere que exista la función is_admin() o ajustar según el sistema de roles)
CREATE POLICY "admins_can_manage_reports"
  ON user_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id_usuario = auth.uid()
        AND user_type IN ('admin', 'company')
    )
  );
