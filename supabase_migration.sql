-- ============================================================
-- PrompTool — Migration script v3 (completo)
-- Supabase SQL Editor → New query → pegar → Run
-- Todos los ALTER usan IF NOT EXISTS → seguro re-ejecutar
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- PASO 1 — DIAGNÓSTICO (ejecutar antes para ver qué falla)
-- ══════════════════════════════════════════════════════════════

-- Triggers sobre imagenes_ia (buscar el que usa u.lang):
SELECT t.tgname AS trigger_name, p.proname AS function_name, p.prosrc AS function_source
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc  p ON p.oid = t.tgfoid
WHERE c.relname = 'imagenes_ia';

-- RLS policies que referencian 'lang':
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE qual LIKE '%lang%' OR with_check LIKE '%lang%';


-- ══════════════════════════════════════════════════════════════
-- PASO 2 — FIX "column u.lang does not exist"
-- ══════════════════════════════════════════════════════════════
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'es'
    CHECK (lang IN ('es', 'en', 'pt'));


-- ══════════════════════════════════════════════════════════════
-- PASO 3 — Columnas enterprise en imagenes_ia
-- ══════════════════════════════════════════════════════════════
ALTER TABLE imagenes_ia
  ADD COLUMN IF NOT EXISTS company_id                UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS challenge_description     TEXT,
  ADD COLUMN IF NOT EXISTS challenge_time_limit      INTEGER DEFAULT 180,
  ADD COLUMN IF NOT EXISTS challenge_max_attempts    INTEGER,
  ADD COLUMN IF NOT EXISTS challenge_min_words       INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS challenge_start_date      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS challenge_end_date        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS challenge_visibility      TEXT DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS challenge_points          INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS challenge_tags            TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS challenge_hints           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS challenge_evaluation_mode TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS challenge_eval_instructions TEXT,
  ADD COLUMN IF NOT EXISTS challenge_content_type    TEXT DEFAULT 'image';

CREATE INDEX IF NOT EXISTS idx_imagenes_ia_company_id ON imagenes_ia(company_id);


-- ══════════════════════════════════════════════════════════════
-- PASO 4 — Tabla enterprise_guides
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS enterprise_guides (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  summary    TEXT,
  content    JSONB DEFAULT '{}',
  accent     TEXT DEFAULT 'violet',
  keywords   TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_guides_company_id ON enterprise_guides(company_id);
ALTER TABLE enterprise_guides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enterprise_guides' AND policyname='eg_select_own') THEN
    CREATE POLICY eg_select_own ON enterprise_guides FOR SELECT USING (company_id = auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enterprise_guides' AND policyname='eg_insert_own') THEN
    CREATE POLICY eg_insert_own ON enterprise_guides FOR INSERT WITH CHECK (company_id = auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enterprise_guides' AND policyname='eg_update_own') THEN
    CREATE POLICY eg_update_own ON enterprise_guides FOR UPDATE USING (company_id = auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enterprise_guides' AND policyname='eg_delete_own') THEN
    CREATE POLICY eg_delete_own ON enterprise_guides FOR DELETE USING (company_id = auth.uid()); END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- PASO 5 — Columnas faltantes en usuarios
-- ══════════════════════════════════════════════════════════════
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS enterprise_onboarded   BOOLEAN    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_onboarded         BOOLEAN    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS industry_type          TEXT,
  ADD COLUMN IF NOT EXISTS default_challenge_type TEXT       DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS default_challenge_mode TEXT       DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS performance_metrics    JSONB      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS training_config        JSONB      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tournament_enabled     BOOLEAN    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS settings_allowed_diffs TEXT[]     DEFAULT '{Easy,Medium,Hard}',
  ADD COLUMN IF NOT EXISTS company_display_name   TEXT,
  ADD COLUMN IF NOT EXISTS company_role           TEXT;


-- ══════════════════════════════════════════════════════════════
-- PASO 6 — Tabla team_invitations (con TODAS las columnas)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS team_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_id    UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  status     TEXT DEFAULT 'pending',
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Columnas que pueden faltar si la tabla ya existe:
ALTER TABLE team_invitations
  ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message  TEXT;

CREATE INDEX IF NOT EXISTS idx_team_invitations_company_id ON team_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email      ON team_invitations(user_email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_user_id    ON team_invitations(user_id);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_invitations' AND policyname='ti_select_own') THEN
    CREATE POLICY ti_select_own ON team_invitations FOR SELECT USING (company_id = auth.uid() OR user_id = auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_invitations' AND policyname='ti_insert_own') THEN
    CREATE POLICY ti_insert_own ON team_invitations FOR INSERT WITH CHECK (company_id = auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_invitations' AND policyname='ti_update') THEN
    CREATE POLICY ti_update ON team_invitations FOR UPDATE USING (company_id = auth.uid() OR user_id = auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_invitations' AND policyname='ti_delete_own') THEN
    CREATE POLICY ti_delete_own ON team_invitations FOR DELETE USING (company_id = auth.uid()); END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- PASO 7 — RPCs críticos (si no existen aún)
-- ══════════════════════════════════════════════════════════════

-- join_company_by_link: llamado cuando alguien hace clic en el link de invitación
CREATE OR REPLACE FUNCTION join_company_by_link(p_company_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing_company UUID;
BEGIN
  SELECT company_id INTO v_existing_company FROM usuarios WHERE id_usuario = v_user_id;
  IF v_existing_company IS NOT NULL THEN
    IF v_existing_company = p_company_id THEN
      RAISE EXCEPTION 'Already member';
    ELSE
      RAISE EXCEPTION 'Already in another company';
    END IF;
  END IF;
  UPDATE usuarios SET company_id = p_company_id WHERE id_usuario = v_user_id;
  UPDATE team_invitations
    SET status = 'accepted'
    WHERE company_id = p_company_id
      AND (user_id = v_user_id OR user_email = (SELECT email FROM usuarios WHERE id_usuario = v_user_id))
      AND status = 'pending';
END;
$$;

-- accept_team_invitation: para aceptar desde notificaciones
CREATE OR REPLACE FUNCTION accept_team_invitation(invitation_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_company  UUID;
BEGIN
  SELECT company_id INTO v_company FROM team_invitations WHERE id = invitation_id;
  IF v_company IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  UPDATE usuarios SET company_id = v_company WHERE id_usuario = v_user_id;
  UPDATE team_invitations SET status = 'accepted' WHERE id = invitation_id;
END;
$$;

-- leave_company: para que un miembro se vaya de la empresa
CREATE OR REPLACE FUNCTION leave_company()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE usuarios SET company_id = NULL, company_role = NULL WHERE id_usuario = auth.uid();
END;
$$;

-- remove_team_member: para que el admin elimine un miembro
CREATE OR REPLACE FUNCTION remove_team_member(target_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_type TEXT;
BEGIN
  SELECT user_type INTO v_caller_type FROM usuarios WHERE id_usuario = v_caller;
  IF v_caller_type != 'enterprise' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE usuarios SET company_id = NULL, company_role = NULL
  WHERE id_usuario = target_user_id AND company_id = v_caller;
END;
$$;

-- assign_company_role: asignar rol a un miembro
CREATE OR REPLACE FUNCTION assign_company_role(target_user_id UUID, role_name TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  UPDATE usuarios SET company_role = role_name
  WHERE id_usuario = target_user_id AND company_id = v_caller;
END;
$$;

-- set_company_display_name: nombre de display para un miembro dentro de la empresa
CREATE OR REPLACE FUNCTION set_company_display_name(target_user_id UUID, display_name TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  UPDATE usuarios SET company_display_name = display_name
  WHERE id_usuario = target_user_id AND company_id = v_caller;
END;
$$;

-- create_custom_role / delete_custom_role: roles personalizados en training_config
CREATE OR REPLACE FUNCTION create_custom_role(role_name TEXT, role_color TEXT DEFAULT 'violet')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_config JSONB;
  v_roles  JSONB;
BEGIN
  SELECT COALESCE(training_config, '{}') INTO v_config FROM usuarios WHERE id_usuario = v_caller;
  v_roles := COALESCE(v_config->'custom_roles', '[]'::jsonb);
  v_roles := v_roles || jsonb_build_object('name', role_name, 'color', role_color);
  v_config := jsonb_set(v_config, '{custom_roles}', v_roles);
  UPDATE usuarios SET training_config = v_config WHERE id_usuario = v_caller;
END;
$$;

CREATE OR REPLACE FUNCTION delete_custom_role(role_name TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_config JSONB;
  v_roles  JSONB;
BEGIN
  SELECT COALESCE(training_config, '{}') INTO v_config FROM usuarios WHERE id_usuario = v_caller;
  v_roles := COALESCE(v_config->'custom_roles', '[]'::jsonb);
  v_roles := (SELECT jsonb_agg(r) FROM jsonb_array_elements(v_roles) r WHERE r->>'name' != role_name);
  v_config := jsonb_set(v_config, '{custom_roles}', COALESCE(v_roles, '[]'::jsonb));
  UPDATE usuarios SET training_config = v_config WHERE id_usuario = v_caller;
END;
$$;

-- assign_guide_to_members: guardar asignación de guía en training_config de la empresa
CREATE OR REPLACE FUNCTION assign_guide_to_members(assignment JSONB)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_config JSONB;
  v_assignments JSONB;
  new_id  UUID := gen_random_uuid();
  target  TEXT;
  assigned_count INTEGER := 0;
BEGIN
  SELECT COALESCE(training_config, '{}') INTO v_config FROM usuarios WHERE id_usuario = v_caller;
  v_assignments := COALESCE(v_config->'guide_assignments', '[]'::jsonb);
  v_assignments := v_assignments || (assignment || jsonb_build_object('id', new_id, 'created_at', now()));
  v_config := jsonb_set(v_config, '{guide_assignments}', v_assignments);
  UPDATE usuarios SET training_config = v_config WHERE id_usuario = v_caller;
  target := assignment->>'target';
  IF target = 'all' THEN
    SELECT COUNT(*) INTO assigned_count FROM usuarios WHERE company_id = v_caller;
  ELSE
    assigned_count := 1;
  END IF;
  RETURN assigned_count;
END;
$$;

-- update_guide_progress: registra el progreso de un miembro en una guía
CREATE OR REPLACE FUNCTION update_guide_progress(p_company_id UUID, p_guide_id TEXT, p_field TEXT, p_value BOOLEAN DEFAULT TRUE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_config  JSONB;
  v_progress JSONB;
  v_guide_progress JSONB;
BEGIN
  SELECT COALESCE(training_config, '{}') INTO v_config FROM usuarios WHERE id_usuario = p_company_id;
  v_progress := COALESCE(v_config->'guide_progress', '{}'::jsonb);
  v_guide_progress := COALESCE(v_progress->v_user_id::text, '{}'::jsonb);
  v_guide_progress := jsonb_set(v_guide_progress, ARRAY[p_guide_id, p_field], to_jsonb(p_value));
  v_progress := jsonb_set(v_progress, ARRAY[v_user_id::text], v_guide_progress);
  v_config := jsonb_set(v_config, '{guide_progress}', v_progress);
  UPDATE usuarios SET training_config = v_config WHERE id_usuario = p_company_id;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- PASO 8 — Storage bucket enterprise-challenges
-- ══════════════════════════════════════════════════════════════
-- Ejecutar SOLO si el bucket no existe (verificar en Storage en el dashboard)
-- Si ya existe, saltar este paso.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'enterprise-challenges',
  'enterprise-challenges',
  true,
  52428800,  -- 50MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/avif',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain','text/csv','text/markdown',
        'application/json','text/javascript','text/html','text/xml']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit    = EXCLUDED.file_size_limit;

-- RLS del bucket (empresa sube, todos los miembros leen)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='ec_upload') THEN
    CREATE POLICY ec_upload ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'enterprise-challenges');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='ec_read') THEN
    CREATE POLICY ec_read ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'enterprise-challenges');
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- VERIFICACIÓN FINAL
-- ══════════════════════════════════════════════════════════════

SELECT 'imagenes_ia challenge columns' AS check_name, COUNT(*) AS count
FROM information_schema.columns
WHERE table_name = 'imagenes_ia' AND column_name LIKE 'challenge_%';

SELECT 'usuarios new columns' AS check_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'usuarios'
  AND column_name IN ('lang','enterprise_onboarded','user_onboarded','training_config','company_role')
ORDER BY column_name;

SELECT 'team_invitations columns' AS check_name, column_name
FROM information_schema.columns
WHERE table_name = 'team_invitations'
ORDER BY ordinal_position;

SELECT 'enterprise_guides exists' AS check_name, to_regclass('enterprise_guides')::text AS result;

SELECT 'RPCs exist' AS check_name, proname AS function_name
FROM pg_proc
WHERE proname IN ('join_company_by_link','accept_team_invitation','leave_company',
                  'remove_team_member','assign_company_role','assign_guide_to_members',
                  'update_guide_progress','create_custom_role','delete_custom_role')
ORDER BY proname;
