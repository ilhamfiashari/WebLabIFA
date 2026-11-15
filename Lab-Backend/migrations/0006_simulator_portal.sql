CREATE TABLE classes (
    id text PRIMARY KEY,
    name text NOT NULL,
    course text NOT NULL,
    semester text NOT NULL DEFAULT 'Ganjil 2026/2027',
    timezone text NOT NULL DEFAULT 'Asia/Jakarta',
    leaderboard_enabled boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE class_memberships (
    class_id text NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_class text NOT NULL CHECK (role_in_class IN ('mahasiswa', 'dosen')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (class_id, user_id)
);
CREATE INDEX class_memberships_user ON class_memberships(user_id);

CREATE TABLE assignments (
    id uuid PRIMARY KEY,
    class_id text NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title text NOT NULL,
    lab_id text NOT NULL,
    required_level text NOT NULL CHECK (required_level IN ('easy', 'medium', 'hard', 'impossible')),
    due_at timestamptz NOT NULL,
    pass_threshold integer NOT NULL DEFAULT 80 CHECK (pass_threshold BETWEEN 1 AND 100),
    allow_hints boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assignments_class ON assignments(class_id, due_at);

CREATE TABLE lab_modules (
    lab_id text PRIMARY KEY,
    track text NOT NULL CHECK (track IN ('web', 'iot')),
    owasp_code text,
    status text NOT NULL DEFAULT 'Terbit' CHECK (status IN ('Draft', 'Review', 'Terbit', 'Rencana')),
    version text NOT NULL DEFAULT '1.0.0',
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lab_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lab_id text NOT NULL,
    level_id text NOT NULL CHECK (level_id IN ('easy', 'medium', 'hard', 'impossible')),
    scenario_version text NOT NULL DEFAULT '2026.1',
    current_step text NOT NULL DEFAULT 'pahami' CHECK (current_step IN ('pahami', 'uji', 'perbaiki', 'verifikasi', 'refleksi')),
    selected_patch text,
    hypothesis text,
    diagnosis text,
    hints_opened integer NOT NULL DEFAULT 0 CHECK (hints_opened BETWEEN 0 AND 3),
    baseline_recorded boolean NOT NULL DEFAULT false,
    exploit_proved boolean NOT NULL DEFAULT false,
    verification_passed boolean NOT NULL DEFAULT false,
    reflection_submitted boolean NOT NULL DEFAULT false,
    score integer CHECK (score IS NULL OR (score BETWEEN 0 AND 100)),
    passed boolean NOT NULL DEFAULT false,
    state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    verification_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    reflection_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    row_version integer NOT NULL DEFAULT 1,
    started_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);
CREATE INDEX lab_sessions_user ON lab_sessions(user_id, updated_at DESC);
CREATE INDEX lab_sessions_lab_level ON lab_sessions(user_id, lab_id, level_id);

CREATE TABLE lab_achievements (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_key text NOT NULL,
    xp integer NOT NULL CHECK (xp >= 0),
    earned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, achievement_key)
);

CREATE TABLE lab_feedback (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES lab_sessions(id) ON DELETE CASCADE,
    lecturer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lab_feedback_session ON lab_feedback(session_id, created_at DESC);

CREATE TABLE platform_audit_logs (
    id uuid PRIMARY KEY,
    actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    kind text NOT NULL,
    title text NOT NULL,
    target text NOT NULL,
    result text NOT NULL DEFAULT 'Berhasil',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_audit_created ON platform_audit_logs(created_at DESC);

INSERT INTO classes (id, name, course, semester, timezone, leaderboard_enabled, active) VALUES
('IF-3A', 'IF-3A · Keamanan Informasi', 'IF3101 Keamanan Web & Jaringan', 'Ganjil 2026/2027', 'Asia/Jakarta', false, true),
('IF-3B', 'IF-3B · Keamanan Informasi', 'IF3101 Keamanan Web & Jaringan', 'Ganjil 2026/2027', 'Asia/Jakarta', true, true),
('IF-4A', 'IF-4A · Keamanan IoT', 'IF4204 Keamanan Sistem Tertanam', 'Ganjil 2026/2027', 'Asia/Jakarta', false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lab_modules (lab_id, track, owasp_code, status, version) VALUES
('a01-idor', 'web', 'A01', 'Terbit', '1.0.0'),
('a02-misconfig', 'web', 'A02', 'Terbit', '1.0.0'),
('a03-supply-chain', 'web', 'A03', 'Terbit', '1.0.0'),
('a04-crypto', 'web', 'A04', 'Terbit', '1.0.0'),
('a05-sqli', 'web', 'A05', 'Terbit', '1.0.0'),
('a05-xss', 'web', 'A05', 'Terbit', '1.0.0'),
('a06-coupon', 'web', 'A06', 'Terbit', '1.0.0'),
('a07-auth', 'web', 'A07', 'Terbit', '1.0.0'),
('a08-webhook', 'web', 'A08', 'Terbit', '1.0.0'),
('a09-logging', 'web', 'A09', 'Terbit', '1.0.0'),
('a10-checkout', 'web', 'A10', 'Terbit', '1.0.0'),
('iot-mqtt-acl', 'iot', NULL, 'Terbit', '1.0.0'),
('iot-replay', 'iot', NULL, 'Terbit', '1.0.0'),
('iot-ota', 'iot', NULL, 'Terbit', '1.0.0'),
('iot-interlock', 'iot', NULL, 'Terbit', '1.0.0')
ON CONFLICT (lab_id) DO NOTHING;
