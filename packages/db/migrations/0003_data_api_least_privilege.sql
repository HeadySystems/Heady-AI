-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0003 — Data API least privilege             ║
-- ║  Keeps Neon Postgres authoritative by denying broad direct API   ║
-- ║  access to internal SoR tables and future public-schema objects.  ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- The application writes through authenticated backend services using the
-- canonical DATABASE_URL. The Neon Data API role must not bypass those service
-- boundaries or gain automatic access to newly migrated SoR objects.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
