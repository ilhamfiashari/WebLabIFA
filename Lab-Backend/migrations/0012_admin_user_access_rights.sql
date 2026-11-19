-- Manajemen peran dan hak akses terperinci per pengguna yang diatur Admin

CREATE TABLE IF NOT EXISTS user_access_rights (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    can_access_web_labs boolean NOT NULL DEFAULT true,
    can_access_iot_studio boolean NOT NULL DEFAULT true,
    can_submit_assignments boolean NOT NULL DEFAULT true,
    can_import_questions boolean NOT NULL DEFAULT false,
    can_manage_assignments boolean NOT NULL DEFAULT false,
    can_view_class_analytics boolean NOT NULL DEFAULT false,
    can_export_reports boolean NOT NULL DEFAULT false,
    updated_by uuid REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);
