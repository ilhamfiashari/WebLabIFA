-- Dukungan proyek IoT multi-file tersinkronisasi (.h, .hpp, .c, .cpp, .ino, .txt, .json)
ALTER TABLE iot_projects
    ADD COLUMN IF NOT EXISTS files_json jsonb NOT NULL DEFAULT '[]'::jsonb;
