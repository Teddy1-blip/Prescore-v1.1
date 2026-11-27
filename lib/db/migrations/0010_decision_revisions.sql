-- Immutable issued decision revisions. This stores the exact authorized public model plus a
-- compact semantic digest; it does not alter analytical inputs or economic policies.
CREATE TABLE analysis_decision_revisions (
  snapshot_id text PRIMARY KEY,
  analysis_id text NOT NULL REFERENCES analyses(id),
  owner_email text NOT NULL,
  company_inn text NOT NULL,
  as_of_date text NOT NULL,
  input_fingerprint text NOT NULL,
  engine_version text NOT NULL,
  report_version text NOT NULL,
  public_model text NOT NULL,
  decision_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analysis_decision_revisions_analysis_date
  ON analysis_decision_revisions(analysis_id,created_at DESC,snapshot_id);
