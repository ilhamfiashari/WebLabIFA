-- Run as database owner after migration. Provision passwords interactively with \password.
-- CREATE ROLE ifa_migrator LOGIN; CREATE ROLE ifa_runtime LOGIN;
-- CREATE DATABASE ifa_lab OWNER ifa_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE ifa_lab TO ifa_runtime;
GRANT USAGE ON SCHEMA public TO ifa_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ifa_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ifa_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE ifa_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ifa_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE ifa_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO ifa_runtime;
ALTER ROLE ifa_runtime SET statement_timeout = '5s';
ALTER ROLE ifa_runtime SET idle_in_transaction_session_timeout = '10s';
