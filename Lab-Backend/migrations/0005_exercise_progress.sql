-- Progres latihan Mahasiswa. Isi soal dan kunci jawaban berada di content/latihan.json.
CREATE TABLE exercise_progress (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id text NOT NULL CHECK (length(exercise_id) BETWEEN 1 AND 64),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    hint_used boolean NOT NULL DEFAULT false,
    points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, exercise_id)
);
