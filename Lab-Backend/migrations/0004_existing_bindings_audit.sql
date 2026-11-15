INSERT INTO privileged_bindings(email,user_id)
SELECT lower(email),id FROM users WHERE issuer='https://accounts.google.com'
AND lower(email) IN ('firman.ashari@if.itera.ac.id','ilhamfirman39@gmail.com')
ON CONFLICT(email) DO NOTHING;

CREATE FUNCTION audit_account_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.active IS DISTINCT FROM NEW.active THEN
        INSERT INTO access_events(id,user_id,event)
            VALUES(gen_random_uuid(),NEW.id,CASE WHEN NEW.active THEN 'account_enabled' ELSE 'account_disabled' END);
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER users_status_audit AFTER UPDATE OF active ON users
FOR EACH ROW EXECUTE FUNCTION audit_account_status();
