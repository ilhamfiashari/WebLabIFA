ALTER TABLE users ADD COLUMN workspace_domain text;
ALTER TABLE users ADD COLUMN access_initialized boolean NOT NULL DEFAULT false;
CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK(role IN ('mahasiswa','dosen','admin')),
    PRIMARY KEY(user_id,role)
);
-- Preserve existing grants; first eligible login initializes the revised policy.
INSERT INTO user_roles SELECT id,role FROM users;
CREATE TABLE privileged_bindings (
    email text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    UNIQUE(user_id,email)
);
ALTER TABLE sessions ADD COLUMN active_role text NOT NULL DEFAULT 'mahasiswa'
    CHECK(active_role IN ('mahasiswa','dosen','admin'));
CREATE TABLE access_events (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    event text NOT NULL,
    role text,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Old sessions lack verified Workspace context; require a new Google login.
DELETE FROM sessions;

CREATE FUNCTION revoke_changed_grant_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM sessions WHERE user_id=OLD.user_id;
    INSERT INTO access_events(id,user_id,event,role)
        VALUES(gen_random_uuid(),OLD.user_id,'role_revoked',OLD.role);
    RETURN OLD;
END;
$$;
CREATE TRIGGER user_roles_revoke AFTER DELETE ON user_roles
FOR EACH ROW EXECUTE FUNCTION revoke_changed_grant_sessions();
