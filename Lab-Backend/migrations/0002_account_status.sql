ALTER TABLE users ADD COLUMN active boolean NOT NULL DEFAULT true;

-- Cabut semua sesi dalam transaksi yang sama saat operator menonaktifkan akun.
CREATE FUNCTION revoke_disabled_account_sessions() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.active AND NOT NEW.active THEN
        DELETE FROM sessions WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_disable_revokes_sessions
AFTER UPDATE OF active ON users
FOR EACH ROW EXECUTE FUNCTION revoke_disabled_account_sessions();
