-- ════════════════════════════════════════════════════════════════════════════
-- FIX RLS POLICIES + REPORT RESPONSES
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Fix team_invitations 403 ──────────────────────────────────────────
-- The 403 happens because the anon/authenticated role can't read
-- team_invitations when the user is not directly involved.
-- Drop and recreate the policy to be explicit.

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "users_can_view_own_invitations" ON team_invitations;
DROP POLICY IF EXISTS "users_can_insert_invitations"   ON team_invitations;
DROP POLICY IF EXISTS "users_can_update_invitations"   ON team_invitations;

-- Users can see invitations where they are the company OR the invited user
CREATE POLICY "users_can_view_own_invitations"
  ON team_invitations FOR SELECT
  TO authenticated
  USING (
    company_id = auth.uid()
    OR user_id  = auth.uid()
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Users can insert invitations where they are the company
CREATE POLICY "users_can_insert_invitations"
  ON team_invitations FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth.uid() OR user_id = auth.uid());

-- Users can update invitations they are part of
CREATE POLICY "users_can_update_invitations"
  ON team_invitations FOR UPDATE
  TO authenticated
  USING (
    company_id = auth.uid()
    OR user_id  = auth.uid()
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can do everything
CREATE POLICY "admins_full_access_invitations"
  ON team_invitations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id_usuario = auth.uid() AND adminstate = true
    )
  );

-- ── 2. user_reports: add reviewer_notes column if missing ────────────────
ALTER TABLE user_reports
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_id    UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ;

-- Admins can read and update all reports
DROP POLICY IF EXISTS "admins_can_manage_reports" ON user_reports;

CREATE POLICY "admins_can_manage_reports"
  ON user_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id_usuario = auth.uid()
        AND (adminstate = true OR devstate = true)
    )
  );

-- ── 3. notification_reads: ensure RLS allows reading own rows ────────────
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_reads" ON notification_reads;

CREATE POLICY "users_manage_own_reads"
  ON notification_reads FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
