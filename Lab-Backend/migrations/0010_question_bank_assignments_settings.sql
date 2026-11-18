-- Pengaturan Admin terpusat, Bank Latihan dinamis/impor Moodle LMS (hanya jalur Cyber Security & IoT),
-- dan detail penugasan praktikum dengan kontrol anti-kecurangan di sisi server.

CREATE TABLE IF NOT EXISTS platform_settings (
    id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
    active_tracks jsonb NOT NULL DEFAULT '["web", "iot"]'::jsonb,
    enforce_sequential_unlock boolean NOT NULL DEFAULT true,
    strict_deadline_lock boolean NOT NULL DEFAULT true,
    block_concurrent_attempts boolean NOT NULL DEFAULT true,
    max_import_questions integer NOT NULL DEFAULT 100 CHECK (max_import_questions BETWEEN 10 AND 500),
    allow_dosen_question_import boolean NOT NULL DEFAULT true,
    allow_student_hints boolean NOT NULL DEFAULT true,
    hide_answer_explanations_until_due boolean NOT NULL DEFAULT false,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS question_bank_items (
    id text PRIMARY KEY,
    track text NOT NULL CHECK (track IN ('web', 'iot')),
    level smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
    title text NOT NULL,
    owasp text,
    difficulty_label text NOT NULL DEFAULT 'Mudah',
    estimated_minutes integer NOT NULL DEFAULT 5 CHECK (estimated_minutes BETWEEN 1 AND 120),
    scenario text NOT NULL,
    code text,
    code_lang text,
    question text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('pilihan', 'isian', 'truefalse')),
    options_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    answers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    hint text NOT NULL DEFAULT '',
    explanation text NOT NULL DEFAULT '',
    tags text[] NOT NULL DEFAULT '{}'::text[],
    source_format text NOT NULL DEFAULT 'builtin' CHECK (source_format IN ('builtin', 'moodle_xml', 'moodle_gift', 'aiken', 'json')),
    published boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_bank_track_level ON question_bank_items(track, level, created_at);

ALTER TABLE assignments
    ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'web' CHECK (track IN ('web', 'iot')),
    ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS instructions text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS rubric_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS attachment_url text,
    ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 0 CHECK (max_attempts BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS allow_late boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS randomize_order boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS linked_exercise_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE assignments
SET track = CASE WHEN lab_id LIKE 'iot-%' THEN 'iot' ELSE 'web' END
WHERE track IS DISTINCT FROM CASE WHEN lab_id LIKE 'iot-%' THEN 'iot' ELSE 'web' END;

UPDATE classes
SET name = 'IF-4A · IoT',
    course = 'IF4204 Sistem IoT & Tertanam'
WHERE id = 'IF-4A' AND (name = 'IF-4A · Keamanan IoT' OR course = 'Keamanan IoT');
