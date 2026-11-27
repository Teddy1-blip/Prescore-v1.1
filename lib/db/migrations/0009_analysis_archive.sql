-- Reversible presentation archive. No payload, identity, entitlement or economic data is removed.
ALTER TABLE analyses ADD COLUMN archive_state text NOT NULL DEFAULT 'ACTIVE'
  CHECK (archive_state IN ('ACTIVE', 'LEGACY_PREPRODUCTION'));
ALTER TABLE analyses ADD COLUMN archived_at text;
ALTER TABLE analyses ADD COLUMN archive_batch_id text;
CREATE INDEX analyses_active_owner_date ON analyses(owner_email, created_at DESC) WHERE archive_state = 'ACTIVE';
CREATE TABLE analysis_archive_batches (
  id text PRIMARY KEY,
  cutover_at timestamptz NOT NULL,
  preview_hash text NOT NULL,
  record_count integer NOT NULL CHECK (record_count >= 0),
  executed_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz
);
