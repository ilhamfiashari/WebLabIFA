-- Penyimpanan proyek multi-file & progres misi XP Virtual Lab Pengembangan Aplikasi Web (P1-P16)

CREATE TABLE IF NOT EXISTS webdev_projects (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    mission_id text,
    files_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webdev_projects_user_updated ON webdev_projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS webdev_mission_completions (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_id text NOT NULL,
    score integer NOT NULL,
    code_sha256 text NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, mission_id)
);
CREATE INDEX IF NOT EXISTS webdev_mission_completions_user_idx ON webdev_mission_completions(user_id, completed_at DESC);
