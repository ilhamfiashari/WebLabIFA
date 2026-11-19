-- Penyimpanan penyelesaian misi IoT studio beserta kode/board tervalidasi server
-- serta perluasan board proyek IoT termasuk arduino-mega.

ALTER TABLE iot_projects DROP CONSTRAINT IF EXISTS iot_projects_board_check;
ALTER TABLE iot_projects
    ADD CONSTRAINT iot_projects_board_check
    CHECK (board IN ('esp32-c3', 'esp32', 'arduino-uno', 'arduino-mega', 'pico-w'));

CREATE TABLE IF NOT EXISTS iot_mission_completions (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_id text NOT NULL,
    board text NOT NULL,
    score integer NOT NULL,
    code_sha256 text NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, mission_id)
);
CREATE INDEX IF NOT EXISTS iot_mission_completions_user_idx ON iot_mission_completions(user_id, completed_at DESC);
