-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0003 — Data API least privilege             ║
-- ║  Keeps Neon Postgres authoritative by denying broad direct API   ║
-- ║  access to internal SoR tables and future public-schema objects.  ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- The application writes through authenticated backend services using the
-- canonical DATABASE_URL. The Neon Data API role must not bypass those service
-- boundaries or gain automatic access to newly migrated SoR objects.

-- Guard for a missing Data-API role: Neon provisions `authenticated` only when the
-- Data API is enabled, so on a fresh database (or before enablement) the role is absent
-- and an unguarded REVOKE would halt the whole migration chain. The lockdown is a no-op
-- when there is no role to lock down; it applies in full once the role exists. Mirrors the
-- identical `IF EXISTS (pg_roles)` guard 0004 already uses. DEPLOY-ORDERING: enable the
-- Neon Data API BEFORE migrating so this lockdown actually binds `authenticated`.
DO $data_api$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

    ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
      REVOKE ALL PRIVILEGES ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
      REVOKE ALL PRIVILEGES ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
      REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
  END IF;
END
$data_api$;
