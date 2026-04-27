-- ════════════════════════════════════════════════════════════════════════════
-- USER PREFERENCES
-- Guarda las preferencias de configuración de cada usuario
-- (privacidad, modo visual, etc.)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id             UUID PRIMARY KEY REFERENCES usuarios(id_usuario) ON DELETE CASCADE,

  -- Privacidad
  hide_from_ranking   BOOLEAN NOT NULL DEFAULT FALSE,
  incognito_mode      BOOLEAN NOT NULL DEFAULT FALSE,
  no_prompt_history   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Visual
  visual_mode         TEXT NOT NULL DEFAULT 'default'
                        CHECK (visual_mode IN ('default', 'sakura', 'retro', 'hacker')),

  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para lookups rápidos
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede leer y escribir sus propias preferencias
CREATE POLICY "users_manage_own_preferences"
  ON user_preferences FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Función helper para obtener preferencias de un usuario (usable desde edge functions)
CREATE OR REPLACE FUNCTION get_user_preferences(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefs JSON;
BEGIN
  SELECT row_to_json(p) INTO v_prefs
  FROM user_preferences p
  WHERE p.user_id = p_user_id;

  -- Si no existe, devolver defaults
  IF v_prefs IS NULL THEN
    v_prefs := json_build_object(
      'user_id',           p_user_id,
      'hide_from_ranking', false,
      'incognito_mode',    false,
      'no_prompt_history', false,
      'visual_mode',       'default'
    );
  END IF;

  RETURN v_prefs;
END;
$$;
