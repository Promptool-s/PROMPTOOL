-- ════════════════════════════════════════════════════════════════════════════
-- AI DETECTION SYSTEM
-- Sistema de detección de prompts generados por IA
-- ════════════════════════════════════════════════════════════════════════════

-- Tabla para trackear detecciones de IA
CREATE TABLE IF NOT EXISTS ai_detection_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  prompt_snapshot TEXT NOT NULL,
  score INTEGER,
  elapsed_seconds INTEGER,
  detections TEXT[] NOT NULL DEFAULT '{}',
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.0,
  severity TEXT NOT NULL CHECK (severity IN ('none', 'low', 'medium', 'high')),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT valid_score CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_ai_detection_user 
  ON ai_detection_flags(id_usuario);

CREATE INDEX IF NOT EXISTS idx_ai_detection_created 
  ON ai_detection_flags(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_detection_severity 
  ON ai_detection_flags(severity) 
  WHERE severity IN ('medium', 'high');

CREATE INDEX IF NOT EXISTS idx_ai_detection_unreviewed 
  ON ai_detection_flags(reviewed, created_at DESC) 
  WHERE reviewed = FALSE;

-- Función para obtener estadísticas de detección de IA por usuario
CREATE OR REPLACE FUNCTION get_user_ai_detection_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_detections', COUNT(*),
    'last_7_days', COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),
    'last_30_days', COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'),
    'high_severity', COUNT(*) FILTER (WHERE severity = 'high'),
    'medium_severity', COUNT(*) FILTER (WHERE severity = 'medium'),
    'low_severity', COUNT(*) FILTER (WHERE severity = 'low'),
    'avg_confidence', ROUND(AVG(confidence)::numeric, 2),
    'last_detection', MAX(created_at)
  ) INTO v_stats
  FROM ai_detection_flags
  WHERE id_usuario = p_user_id;
  
  RETURN v_stats;
END;
$$;

-- Función para obtener detecciones pendientes de revisión (admin)
CREATE OR REPLACE FUNCTION get_pending_ai_detections(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  username TEXT,
  prompt_snippet TEXT,
  score INTEGER,
  confidence DECIMAL,
  severity TEXT,
  detections TEXT[],
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    adf.id,
    u.username,
    LEFT(adf.prompt_snapshot, 100) as prompt_snippet,
    adf.score,
    adf.confidence,
    adf.severity,
    adf.detections,
    adf.created_at
  FROM ai_detection_flags adf
  JOIN usuarios u ON adf.id_usuario = u.id_usuario
  WHERE adf.reviewed = FALSE
    AND adf.severity IN ('medium', 'high')
  ORDER BY 
    CASE adf.severity
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      ELSE 3
    END,
    adf.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Función para marcar una detección como revisada (admin)
CREATE OR REPLACE FUNCTION review_ai_detection(
  p_detection_id UUID,
  p_reviewer_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ai_detection_flags
  SET 
    reviewed = TRUE,
    reviewer_notes = p_reviewer_notes
  WHERE id = p_detection_id;
  
  RETURN FOUND;
END;
$$;

-- Función para limpiar detecciones antiguas (más de 90 días)
CREATE OR REPLACE FUNCTION cleanup_old_ai_detections()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM ai_detection_flags
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND reviewed = TRUE;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Función para obtener patrones comunes de detección
CREATE OR REPLACE FUNCTION get_ai_detection_patterns()
RETURNS TABLE (
  detection_type TEXT,
  count BIGINT,
  avg_confidence DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    UNNEST(detections) as detection_type,
    COUNT(*) as count,
    ROUND(AVG(confidence)::numeric, 2) as avg_confidence
  FROM ai_detection_flags
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY detection_type
  ORDER BY count DESC
  LIMIT 20;
END;
$$;

-- Trigger para actualizar estadísticas del usuario cuando se detecta IA
CREATE OR REPLACE FUNCTION update_user_ai_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Contar detecciones recientes del usuario
  DECLARE
    v_recent_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_recent_count
    FROM ai_detection_flags
    WHERE id_usuario = NEW.id_usuario
      AND created_at > NOW() - INTERVAL '7 days';
    
    -- Si tiene 5+ detecciones en 7 días, marcar para revisión
    IF v_recent_count >= 5 THEN
      UPDATE usuarios
      SET suspension_status = 'warned'
      WHERE id_usuario = NEW.id_usuario
        AND suspension_status = 'none';
    END IF;
  END;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_user_ai_stats
  AFTER INSERT ON ai_detection_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_stats();

-- Vista para dashboard de admin
CREATE OR REPLACE VIEW ai_detection_dashboard AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_detections,
  COUNT(*) FILTER (WHERE severity = 'high') as high_severity,
  COUNT(*) FILTER (WHERE severity = 'medium') as medium_severity,
  COUNT(*) FILTER (WHERE severity = 'low') as low_severity,
  ROUND(AVG(confidence)::numeric, 2) as avg_confidence,
  COUNT(DISTINCT id_usuario) as unique_users
FROM ai_detection_flags
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Comentarios para documentación
COMMENT ON TABLE ai_detection_flags IS 'Tabla para trackear detecciones de prompts generados por IA';
COMMENT ON COLUMN ai_detection_flags.detections IS 'Array de razones de detección (typing_too_fast, ai_patterns, etc.)';
COMMENT ON COLUMN ai_detection_flags.confidence IS 'Nivel de confianza de la detección (0.0 - 1.0)';
COMMENT ON COLUMN ai_detection_flags.severity IS 'Severidad de la detección: none, low, medium, high';
COMMENT ON FUNCTION get_user_ai_detection_stats IS 'Obtiene estadísticas de detección de IA para un usuario';
COMMENT ON FUNCTION get_pending_ai_detections IS 'Obtiene detecciones pendientes de revisión para admins';
COMMENT ON FUNCTION review_ai_detection IS 'Marca una detección como revisada con notas opcionales';
COMMENT ON FUNCTION cleanup_old_ai_detections IS 'Limpia detecciones antiguas ya revisadas';
COMMENT ON FUNCTION get_ai_detection_patterns IS 'Obtiene patrones comunes de detección en los últimos 30 días';

-- Grants (ajustar según tus roles)
-- GRANT SELECT, INSERT ON ai_detection_flags TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_user_ai_detection_stats TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_pending_ai_detections TO service_role;
-- GRANT EXECUTE ON FUNCTION review_ai_detection TO service_role;
-- GRANT EXECUTE ON FUNCTION cleanup_old_ai_detections TO service_role;
-- GRANT SELECT ON ai_detection_dashboard TO service_role;
