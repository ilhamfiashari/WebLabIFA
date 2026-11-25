-- Strict login approval & Excel/CSV student pre-registration tables.
-- Even institutional (@student.itera.ac.id, @if.itera.ac.id) accounts must be
-- explicitly approved or imported by Admin/Dosen before they can obtain a session.

CREATE TABLE IF NOT EXISTS approved_accounts (
  email TEXT PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  nim TEXT,
  role TEXT NOT NULL DEFAULT 'mahasiswa' CHECK (role IN ('mahasiswa', 'dosen')),
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'approval' CHECK (source IN ('approval', 'excel_import', 'manual', 'migration')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approved_accounts_role_idx
  ON approved_accounts (role, updated_at DESC);

CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  workspace_domain TEXT,
  requested_role TEXT NOT NULL DEFAULT 'mahasiswa' CHECK (requested_role IN ('mahasiswa', 'dosen')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_requests_status_idx
  ON access_requests (status, updated_at DESC);

-- Backfill existing active, initialized accounts with valid roles so pre-existing cohorts keep working seamlessly.
INSERT INTO approved_accounts (email, full_name, role, class_id, source)
SELECT
  lower(u.email) AS email,
  u.name AS full_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'dosen')
      THEN 'dosen'
    ELSE 'mahasiswa'
  END AS role,
  (SELECT m.class_id FROM class_memberships m WHERE m.user_id = u.id ORDER BY m.class_id LIMIT 1) AS class_id,
  'migration' AS source
FROM users u
WHERE u.active = true
  AND u.access_initialized = true
  AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id)
ON CONFLICT (email) DO NOTHING;
