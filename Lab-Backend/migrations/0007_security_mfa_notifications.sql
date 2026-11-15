-- Pengaturan MFA (TOTP, Passkeys, Backup Codes), Notifikasi Email, Telemetri Sesi, Log Aktivitas, & Deteksi Anomali

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS session_id uuid NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS ip_address text,
    ADD COLUMN IF NOT EXISTS user_agent text,
    ADD COLUMN IF NOT EXISTS device_label text,
    ADD COLUMN IF NOT EXISTS location_label text,
    ADD COLUMN IF NOT EXISTS current_path text,
    ADD COLUMN IF NOT EXISTS mfa_verified boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_public_id ON sessions(session_id);

CREATE TABLE IF NOT EXISTS user_security_settings (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secondary_email text,
    notify_assignments boolean NOT NULL DEFAULT true,
    notify_feedback boolean NOT NULL DEFAULT true,
    notify_security_alerts boolean NOT NULL DEFAULT true,
    mfa_enabled boolean NOT NULL DEFAULT false,
    totp_secret_b32 text,
    totp_verified boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash text NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mfa_backup_codes_user_idx ON mfa_backup_codes(user_id, used_at);

CREATE TABLE IF NOT EXISTS user_passkeys (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id text NOT NULL UNIQUE,
    device_name text NOT NULL,
    transports text NOT NULL DEFAULT 'internal',
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_passkeys_user_idx ON user_passkeys(user_id);

CREATE TABLE IF NOT EXISTS user_activity_logs (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    actor_email text,
    session_id uuid,
    action text NOT NULL,
    route_path text,
    ip_address text,
    device_label text,
    location_label text,
    anomaly_flag boolean NOT NULL DEFAULT false,
    detail text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_activity_logs_created_idx ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_logs_user_idx ON user_activity_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS security_anomalies (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    actor_email text,
    session_id uuid,
    kind text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    summary text NOT NULL,
    ip_address text,
    device_label text,
    location_label text,
    acknowledged boolean NOT NULL DEFAULT false,
    acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_anomalies_created_idx ON security_anomalies(created_at DESC);
CREATE INDEX IF NOT EXISTS security_anomalies_ack_idx ON security_anomalies(acknowledged, created_at DESC);

CREATE TABLE IF NOT EXISTS email_notifications (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_email text NOT NULL,
    category text NOT NULL CHECK (category IN ('assignment', 'feedback', 'security_alert', 'system')),
    subject text NOT NULL,
    body_preview text NOT NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'skipped')),
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    read_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_notifications_user_idx ON email_notifications(user_id, created_at DESC);
