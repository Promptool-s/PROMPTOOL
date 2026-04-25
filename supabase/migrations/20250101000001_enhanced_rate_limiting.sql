-- ════════════════════════════════════════════════════════════════════════════
-- ENHANCED RATE LIMITING & SECURITY SYSTEM
-- Adds IP blocking, better tracking, and comprehensive endpoint protection
-- ════════════════════════════════════════════════════════════════════════════

-- Add user_agent column to existing table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_rate_limit' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE auth_rate_limit ADD COLUMN user_agent TEXT;
  END IF;
END $$;

-- Add constraint to ensure positive attempt counts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'valid_attempt_count'
  ) THEN
    ALTER TABLE auth_rate_limit ADD CONSTRAINT valid_attempt_count CHECK (attempt_count >= 0);
  END IF;
END $$;

-- Create index on created_at if not exists
CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_created_at
  ON auth_rate_limit(created_at);

-- Tabla para trackear IPs bloqueadas permanentemente
CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ, -- NULL = permanent block
  violation_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_violation_count CHECK (violation_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_until ON blocked_ips(blocked_until) WHERE blocked_until IS NOT NULL;

-- Función para verificar si una IP está bloqueada permanentemente
CREATE OR REPLACE FUNCTION is_ip_blocked(p_ip_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_blocked BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM blocked_ips
    WHERE ip_address = p_ip_address
      AND (blocked_until IS NULL OR blocked_until > NOW())
  ) INTO v_blocked;
  
  RETURN v_blocked;
END;
$$;

-- Actualizar función de limpieza para incluir bloqueos temporales
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Limpiar rate limits antiguos
  DELETE FROM auth_rate_limit
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  -- Limpiar bloqueos temporales expirados (más de 7 días)
  DELETE FROM blocked_ips
  WHERE blocked_until IS NOT NULL 
    AND blocked_until < NOW() - INTERVAL '7 days';
END;
$$;

-- Función mejorada para verificar rate limit con detección de abusos
CREATE OR REPLACE FUNCTION check_rate_limit_enhanced(
  p_ip_address TEXT,
  p_endpoint TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record auth_rate_limit%ROWTYPE;
  v_attempts_remaining INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Verificar si la IP está bloqueada permanentemente
  IF is_ip_blocked(p_ip_address) THEN
    RETURN json_build_object(
      'allowed', FALSE,
      'blocked', TRUE,
      'attempts_remaining', 0,
      'reset_at', NULL,
      'message', 'IP address is blocked due to repeated violations.'
    );
  END IF;

  -- Buscar registro existente en la ventana de tiempo
  SELECT * INTO v_record
  FROM auth_rate_limit
  WHERE ip_address::TEXT = p_ip_address
    AND endpoint = p_endpoint
    AND first_attempt_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL
  ORDER BY first_attempt_at DESC
  LIMIT 1;

  -- Si existe un bloqueo activo
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > NOW() THEN
    RETURN json_build_object(
      'allowed', FALSE,
      'blocked', TRUE,
      'attempts_remaining', 0,
      'reset_at', v_record.blocked_until,
      'message', 'Too many attempts. Please try again later.'
    );
  END IF;

  -- Si no existe registro o la ventana expiró, crear nuevo
  IF v_record.id IS NULL OR v_record.first_attempt_at <= NOW() - (p_window_minutes || ' minutes')::INTERVAL THEN
    INSERT INTO auth_rate_limit (ip_address, endpoint, attempt_count, first_attempt_at, last_attempt_at)
    VALUES (p_ip_address::INET, p_endpoint, 1, NOW(), NOW())
    RETURNING * INTO v_record;
    
    RETURN json_build_object(
      'allowed', TRUE,
      'blocked', FALSE,
      'attempts_remaining', p_max_attempts - 1,
      'reset_at', NOW() + (p_window_minutes || ' minutes')::INTERVAL,
      'message', 'Request allowed'
    );
  END IF;

  -- Incrementar contador
  UPDATE auth_rate_limit
  SET 
    attempt_count = attempt_count + 1,
    last_attempt_at = NOW(),
    blocked_until = CASE 
      WHEN attempt_count + 1 >= p_max_attempts 
      THEN NOW() + (p_window_minutes || ' minutes')::INTERVAL
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = v_record.id
  RETURNING * INTO v_record;

  -- Si se alcanzó el límite múltiples veces, considerar bloqueo permanente
  IF v_record.attempt_count >= p_max_attempts * 3 THEN
    INSERT INTO blocked_ips (ip_address, reason, blocked_until, violation_count)
    VALUES (
      p_ip_address, 
      'Repeated rate limit violations on ' || p_endpoint,
      NOW() + INTERVAL '24 hours',
      1
    )
    ON CONFLICT (ip_address) 
    DO UPDATE SET 
      violation_count = blocked_ips.violation_count + 1,
      blocked_until = CASE 
        WHEN blocked_ips.violation_count >= 3 THEN NULL -- Permanent block
        ELSE NOW() + INTERVAL '24 hours'
      END;
  END IF;

  -- Verificar si se alcanzó el límite
  IF v_record.attempt_count >= p_max_attempts THEN
    RETURN json_build_object(
      'allowed', FALSE,
      'blocked', TRUE,
      'attempts_remaining', 0,
      'reset_at', v_record.blocked_until,
      'message', 'Rate limit exceeded. Too many attempts.'
    );
  END IF;

  -- Permitir request
  RETURN json_build_object(
    'allowed', TRUE,
    'blocked', FALSE,
    'attempts_remaining', p_max_attempts - v_record.attempt_count,
    'reset_at', v_record.first_attempt_at + (p_window_minutes || ' minutes')::INTERVAL,
    'message', 'Request allowed'
  );
END;
$$;

-- Función para desbloquear una IP (admin)
CREATE OR REPLACE FUNCTION unblock_ip(p_ip_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM blocked_ips WHERE ip_address = p_ip_address;
  DELETE FROM auth_rate_limit WHERE ip_address::TEXT = p_ip_address;
  RETURN TRUE;
END;
$$;

-- Función para bloquear una IP manualmente (admin)
CREATE OR REPLACE FUNCTION block_ip(
  p_ip_address TEXT,
  p_reason TEXT DEFAULT 'Manual block',
  p_duration_hours INTEGER DEFAULT NULL -- NULL = permanent
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO blocked_ips (ip_address, reason, blocked_until)
  VALUES (
    p_ip_address,
    p_reason,
    CASE 
      WHEN p_duration_hours IS NULL THEN NULL
      ELSE NOW() + (p_duration_hours || ' hours')::INTERVAL
    END
  )
  ON CONFLICT (ip_address)
  DO UPDATE SET
    reason = p_reason,
    blocked_until = CASE 
      WHEN p_duration_hours IS NULL THEN NULL
      ELSE NOW() + (p_duration_hours || ' hours')::INTERVAL
    END,
    violation_count = blocked_ips.violation_count + 1;
  
  RETURN TRUE;
END;
$$;

-- Función para obtener estadísticas de rate limiting (admin)
CREATE OR REPLACE FUNCTION get_rate_limit_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_rate_limits', (SELECT COUNT(*) FROM auth_rate_limit),
    'active_blocks', (SELECT COUNT(*) FROM auth_rate_limit WHERE blocked_until > NOW()),
    'permanent_blocks', (SELECT COUNT(*) FROM blocked_ips WHERE blocked_until IS NULL),
    'temporary_blocks', (SELECT COUNT(*) FROM blocked_ips WHERE blocked_until IS NOT NULL AND blocked_until > NOW()),
    'top_blocked_endpoints', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT endpoint, COUNT(*) as count
        FROM auth_rate_limit
        WHERE blocked_until > NOW()
        GROUP BY endpoint
        ORDER BY count DESC
        LIMIT 10
      ) t
    )
  ) INTO v_stats;
  
  RETURN v_stats;
END;
$$;

-- Comentarios para documentación
COMMENT ON TABLE blocked_ips IS 'Tabla para trackear IPs bloqueadas por violaciones repetidas';
COMMENT ON FUNCTION is_ip_blocked IS 'Verifica si una IP está bloqueada permanentemente o temporalmente';
COMMENT ON FUNCTION check_rate_limit_enhanced IS 'Versión mejorada de check_rate_limit con detección de abusos';
COMMENT ON FUNCTION unblock_ip IS 'Desbloquea una IP y limpia sus registros de rate limit';
COMMENT ON FUNCTION block_ip IS 'Bloquea una IP manualmente con duración configurable';
COMMENT ON FUNCTION get_rate_limit_stats IS 'Obtiene estadísticas del sistema de rate limiting';

-- Grants (ajustar según tus roles)
-- GRANT SELECT ON blocked_ips TO authenticated;
-- GRANT EXECUTE ON FUNCTION is_ip_blocked TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_rate_limit_enhanced TO authenticated;
-- GRANT EXECUTE ON FUNCTION unblock_ip TO service_role;
-- GRANT EXECUTE ON FUNCTION block_ip TO service_role;
-- GRANT EXECUTE ON FUNCTION get_rate_limit_stats TO service_role;
