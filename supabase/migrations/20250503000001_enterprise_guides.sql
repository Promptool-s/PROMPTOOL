-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Enterprise Guides System
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Create enterprise_guides table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  accent TEXT DEFAULT 'indigo' CHECK (accent IN ('indigo','cyan','violet','amber','rose','emerald','slate','fuchsia','orange','red','teal','blue','lime')),
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── 2. Create guide_assignments table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS guide_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES enterprise_guides(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','completed','skipped')),
  due_date TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(guide_id, assigned_to)
);

-- ── 3. Create guide_progress table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guide_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES enterprise_guides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  section_id TEXT NOT NULL, -- e.g., 'lesson', 'quiz', 'activity', 'checkpoint-1'
  completed BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}'::jsonb, -- Store quiz answers, activity results, etc.
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(guide_id, user_id, section_id)
);

-- ── 4. Add indexes for performance ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_enterprise_guides_company_id ON enterprise_guides(company_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_guides_status ON enterprise_guides(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_guides_created_by ON enterprise_guides(created_by);

CREATE INDEX IF NOT EXISTS idx_guide_assignments_guide_id ON guide_assignments(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_assignments_assigned_to ON guide_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_guide_assignments_assigned_by ON guide_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_guide_assignments_status ON guide_assignments(status);

CREATE INDEX IF NOT EXISTS idx_guide_progress_guide_id ON guide_progress(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_progress_user_id ON guide_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_guide_progress_completed ON guide_progress(completed);

-- ── 5. RLS Policies ────────────────────────────────────────────────────────
ALTER TABLE enterprise_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_progress ENABLE ROW LEVEL SECURITY;

-- Enterprise guides policies
CREATE POLICY "enterprise_guides_company_access"
  ON enterprise_guides FOR ALL
  TO authenticated
  USING (
    company_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id_usuario = auth.uid() 
      AND company_id = enterprise_guides.company_id
    )
  )
  WITH CHECK (
    company_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id_usuario = auth.uid() 
      AND company_id = enterprise_guides.company_id
    )
  );

-- Guide assignments policies
CREATE POLICY "guide_assignments_access"
  ON guide_assignments FOR ALL
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    assigned_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM enterprise_guides eg
      WHERE eg.id = guide_assignments.guide_id
      AND (
        eg.company_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id_usuario = auth.uid()
          AND u.company_id = eg.company_id
        )
      )
    )
  )
  WITH CHECK (
    assigned_to = auth.uid() OR
    assigned_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM enterprise_guides eg
      WHERE eg.id = guide_assignments.guide_id
      AND (
        eg.company_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id_usuario = auth.uid()
          AND u.company_id = eg.company_id
        )
      )
    )
  );

-- Guide progress policies
CREATE POLICY "guide_progress_access"
  ON guide_progress FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM enterprise_guides eg
      WHERE eg.id = guide_progress.guide_id
      AND (
        eg.company_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id_usuario = auth.uid()
          AND u.company_id = eg.company_id
        )
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM enterprise_guides eg
      WHERE eg.id = guide_progress.guide_id
      AND (
        eg.company_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id_usuario = auth.uid()
          AND u.company_id = eg.company_id
        )
      )
    )
  );

-- ── 6. RPC Functions ───────────────────────────────────────────────────────

-- Create enterprise guide
CREATE OR REPLACE FUNCTION create_enterprise_guide(
  title TEXT,
  summary TEXT DEFAULT NULL,
  content JSONB DEFAULT '{}'::jsonb,
  accent TEXT DEFAULT 'indigo',
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_guide_id UUID;
  user_company_id UUID;
BEGIN
  -- Get user's company (either they own it or are a member)
  SELECT COALESCE(
    (SELECT id_usuario FROM usuarios WHERE id_usuario = auth.uid() AND user_type = 'enterprise'),
    (SELECT company_id FROM usuarios WHERE id_usuario = auth.uid())
  ) INTO user_company_id;
  
  IF user_company_id IS NULL THEN
    RAISE EXCEPTION 'User is not part of an enterprise';
  END IF;

  -- Validate inputs
  IF title IS NULL OR trim(title) = '' THEN
    RAISE EXCEPTION 'Title cannot be empty';
  END IF;

  -- Insert new guide
  INSERT INTO enterprise_guides (
    company_id, 
    title, 
    summary, 
    content, 
    accent, 
    keywords, 
    created_by
  )
  VALUES (
    user_company_id, 
    trim(title), 
    summary, 
    content, 
    accent, 
    keywords, 
    auth.uid()
  )
  RETURNING id INTO new_guide_id;

  RETURN new_guide_id;
END;
$$;

-- Assign guide to team members
CREATE OR REPLACE FUNCTION assign_guide_to_members(
  guide_id UUID,
  member_ids UUID[],
  due_date TIMESTAMPTZ DEFAULT NULL,
  notes TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_count INTEGER := 0;
  member_id UUID;
  guide_company_id UUID;
  user_company_id UUID;
BEGIN
  -- Verify guide exists and user has access
  SELECT company_id INTO guide_company_id
  FROM enterprise_guides
  WHERE id = guide_id;
  
  IF guide_company_id IS NULL THEN
    RAISE EXCEPTION 'Guide not found';
  END IF;

  -- Get user's company
  SELECT COALESCE(
    (SELECT id_usuario FROM usuarios WHERE id_usuario = auth.uid() AND user_type = 'enterprise'),
    (SELECT company_id FROM usuarios WHERE id_usuario = auth.uid())
  ) INTO user_company_id;
  
  IF user_company_id != guide_company_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Assign to each member
  FOREACH member_id IN ARRAY member_ids
  LOOP
    -- Verify member belongs to the same company
    IF EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id_usuario = member_id 
      AND company_id = guide_company_id
    ) THEN
      INSERT INTO guide_assignments (
        guide_id,
        assigned_to,
        assigned_by,
        due_date,
        notes
      )
      VALUES (
        guide_id,
        member_id,
        auth.uid(),
        due_date,
        notes
      )
      ON CONFLICT (guide_id, assigned_to) 
      DO UPDATE SET
        assigned_by = auth.uid(),
        due_date = EXCLUDED.due_date,
        notes = EXCLUDED.notes,
        updated_at = now();
      
      assigned_count := assigned_count + 1;
    END IF;
  END LOOP;

  RETURN assigned_count;
END;
$$;

-- Update guide progress
CREATE OR REPLACE FUNCTION update_guide_progress(
  guide_id UUID,
  section_id TEXT,
  completed BOOLEAN DEFAULT true,
  data JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this guide
  IF NOT EXISTS (
    SELECT 1 FROM guide_assignments
    WHERE guide_id = update_guide_progress.guide_id
    AND assigned_to = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM enterprise_guides eg
    JOIN usuarios u ON u.company_id = eg.company_id
    WHERE eg.id = update_guide_progress.guide_id
    AND u.id_usuario = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO guide_progress (
    guide_id,
    user_id,
    section_id,
    completed,
    data,
    completed_at
  )
  VALUES (
    guide_id,
    auth.uid(),
    section_id,
    completed,
    data,
    CASE WHEN completed THEN now() ELSE NULL END
  )
  ON CONFLICT (guide_id, user_id, section_id)
  DO UPDATE SET
    completed = EXCLUDED.completed,
    data = EXCLUDED.data,
    completed_at = CASE WHEN EXCLUDED.completed THEN now() ELSE NULL END,
    updated_at = now();
END;
$$;

-- Get guide progress summary
CREATE OR REPLACE FUNCTION get_guide_progress_summary(guide_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  avatar_url TEXT,
  total_sections INTEGER,
  completed_sections INTEGER,
  progress_percentage INTEGER,
  last_activity TIMESTAMPTZ,
  assignment_status TEXT,
  due_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this guide
  IF NOT EXISTS (
    SELECT 1 FROM enterprise_guides
    WHERE id = guide_id
    AND (
      company_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE id_usuario = auth.uid()
        AND company_id = enterprise_guides.company_id
      )
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    u.id_usuario,
    COALESCE(u.company_display_name, u.nombre_display, u.nombre, u.email) as user_name,
    u.email,
    u.avatar_url,
    COALESCE(section_counts.total_sections, 0) as total_sections,
    COALESCE(section_counts.completed_sections, 0) as completed_sections,
    CASE 
      WHEN COALESCE(section_counts.total_sections, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(section_counts.completed_sections, 0)::FLOAT / section_counts.total_sections) * 100)::INTEGER
    END as progress_percentage,
    section_counts.last_activity,
    COALESCE(ga.status, 'not_assigned') as assignment_status,
    ga.due_date
  FROM usuarios u
  LEFT JOIN guide_assignments ga ON ga.assigned_to = u.id_usuario AND ga.guide_id = get_guide_progress_summary.guide_id
  LEFT JOIN (
    SELECT 
      gp.user_id,
      COUNT(*) as total_sections,
      COUNT(*) FILTER (WHERE gp.completed = true) as completed_sections,
      MAX(gp.updated_at) as last_activity
    FROM guide_progress gp
    WHERE gp.guide_id = get_guide_progress_summary.guide_id
    GROUP BY gp.user_id
  ) section_counts ON section_counts.user_id = u.id_usuario
  WHERE (
    ga.assigned_to IS NOT NULL OR
    EXISTS (
      SELECT 1 FROM guide_progress gp2
      WHERE gp2.guide_id = get_guide_progress_summary.guide_id
      AND gp2.user_id = u.id_usuario
    )
  )
  AND EXISTS (
    SELECT 1 FROM enterprise_guides eg
    WHERE eg.id = get_guide_progress_summary.guide_id
    AND u.company_id = eg.company_id
  )
  ORDER BY progress_percentage DESC, user_name;
END;
$$;

-- ── 7. Update triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_enterprise_guides_updated_at
  BEFORE UPDATE ON enterprise_guides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guide_assignments_updated_at
  BEFORE UPDATE ON guide_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guide_progress_updated_at
  BEFORE UPDATE ON guide_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();