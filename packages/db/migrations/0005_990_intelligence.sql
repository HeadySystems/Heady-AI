-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HEADY™ DB migration 0005 — Heady 990 Intelligence data plane     ║
-- ║  The nonprofit/990 domain: tax-exempt organizations, their 990     ║
-- ║  filings (financials + governance), and PROVENANCE so every fact   ║
-- ║  links to its source IRS filing. Forward-only; Neon is the SoR.    ║
-- ║  990 data is lawful PUBLIC IRS bulk data — re-ingestible/updatable ║
-- ║  (NOT an append-only audit ledger); upsert is the intended path.   ║
-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE SCHEMA IF NOT EXISTS heady_990;

CREATE TABLE heady_990.organizations (
  ein            TEXT PRIMARY KEY CHECK (ein ~ '^[0-9]{9}$'),
  name           TEXT NOT NULL,
  state          TEXT CHECK (state IS NULL OR state ~ '^[A-Z]{2}$'),
  ntee_code      TEXT,
  subsection_cd  TEXT,
  ruling_year    INTEGER CHECK (ruling_year IS NULL OR (ruling_year BETWEEN 1900 AND 2100)),
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE heady_990.filings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ein                    TEXT NOT NULL REFERENCES heady_990.organizations(ein),
  tax_period_end         DATE NOT NULL,
  return_type            TEXT NOT NULL CHECK (return_type IN ('990', '990-EZ', '990-PF', '990-N')),
  -- Financials (nullable — not every form carries every field).
  total_revenue          NUMERIC,
  total_expenses         NUMERIC,
  total_assets_eoy       NUMERIC,
  total_liabilities_eoy  NUMERIC,
  net_assets_eoy         NUMERIC,
  -- Governance.
  voting_members         INTEGER CHECK (voting_members IS NULL OR voting_members >= 0),
  independent_members    INTEGER CHECK (independent_members IS NULL OR independent_members >= 0),
  -- Provenance — every extracted fact traces to its source filing.
  source_object_id       TEXT NOT NULL,
  source_url             TEXT CHECK (source_url IS NULL OR source_url ~ '^https://'),
  content_sha256         TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  ingested_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One filing per org per period per form; re-ingest updates in place.
  UNIQUE (ein, tax_period_end, return_type)
);

CREATE INDEX filings_ein ON heady_990.filings (ein);
CREATE INDEX filings_period_end ON heady_990.filings (tax_period_end);
CREATE INDEX organizations_state ON heady_990.organizations (state) WHERE state IS NOT NULL;
