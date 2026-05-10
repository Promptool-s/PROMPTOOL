-- Rate limiting table and RPC functions
-- Stores per-fingerprint, per-endpoint attempt counts within a rolling window

CREATE TABLE IF NOT EXISTS rate_limits (
  id           bigserial PRIMARY KEY,
  ip_address   text        NOT NULL,
  endpoint     text        NOT NULL,
  attempts     integer     NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_address, endpoint)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint
  ON rate_limits (ip_address, endpoint);

-- Enable RLS (rows are managed only via SECURITY DEFINER functions)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct client access — all access goes through the RPCs below
CREATE POLICY "No direct access" ON rate_limits
  FOR ALL USING (false);

-- -----------------------------------------------------------------------
-- check_rate_limit
--   Increments the attempt counter for (ip, endpoint) within the window.
--   Returns whether the request is allowed and how many attempts remain.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip_address   text,
  p_endpoint     text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        timestamptz := now();
  v_window_end timestamptz;
  v_attempts   integer;
  v_row        rate_limits%ROWTYPE;
BEGIN
  -- Try to fetch existing row
  SELECT * INTO v_row
  FROM rate_limits
  WHERE ip_address = p_ip_address
    AND endpoint   = p_endpoint;

  IF NOT FOUND THEN
    -- First attempt — insert fresh row
    INSERT INTO rate_limits (ip_address, endpoint, attempts, window_start)
    VALUES (p_ip_address, p_endpoint, 1, v_now);

    RETURN jsonb_build_object(
      'allowed',       true,
      'attempts_left', p_max_attempts - 1,
      'reset_at',      null
    );
  END IF;

  v_window_end := v_row.window_start + (p_window_minutes || ' minutes')::interval;

  IF v_now > v_window_end THEN
    -- Window expired — reset counter
    UPDATE rate_limits
    SET attempts     = 1,
        window_start = v_now
    WHERE ip_address = p_ip_address
      AND endpoint   = p_endpoint;

    RETURN jsonb_build_object(
      'allowed',       true,
      'attempts_left', p_max_attempts - 1,
      'reset_at',      null
    );
  END IF;

  -- Within the window
  v_attempts := v_row.attempts + 1;

  UPDATE rate_limits
  SET attempts = v_attempts
  WHERE ip_address = p_ip_address
    AND endpoint   = p_endpoint;

  IF v_attempts > p_max_attempts THEN
    RETURN jsonb_build_object(
      'allowed',       false,
      'attempts_left', 0,
      'reset_at',      v_window_end
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed',       true,
    'attempts_left', p_max_attempts - v_attempts,
    'reset_at',      null
  );
END;
$$;

-- -----------------------------------------------------------------------
-- reset_rate_limit  (admin use)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_rate_limit(
  p_ip_address text,
  p_endpoint   text DEFAULT 'login'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE ip_address = p_ip_address
    AND endpoint   = p_endpoint;
END;
$$;
