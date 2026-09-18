-- App role must NOT own tables: table owners bypass RLS unless FORCE ROW LEVEL SECURITY.
-- migrator (POSTGRES_USER) owns schema objects; app_user is the runtime connection.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_dev_only';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE clinica TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Default privileges for objects created by migrator going forward
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
