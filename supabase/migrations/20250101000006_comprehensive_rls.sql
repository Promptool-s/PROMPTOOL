-- ════════════════════════════════════════════════════════════════════════════
-- SUPERSEDED by 20250101000007_fix_rls_recursion.sql
--
-- This migration was replaced because the original policies caused
-- infinite recursion (HTTP 500) by querying the usuarios table from
-- within a policy ON usuarios.
--
-- All RLS logic has been moved to 000007 which uses a SECURITY DEFINER
-- helper function (is_admin()) to break the recursion.
-- ════════════════════════════════════════════════════════════════════════════

-- No-op: all work done in 000007
SELECT 1;
