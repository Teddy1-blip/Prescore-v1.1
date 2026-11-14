CREATE TABLE dossier_reports (
  id text PRIMARY KEY,
  dossier_id text NOT NULL REFERENCES company_dossiers(id),
  tier text NOT NULL CHECK (tier IN ('BASIC','FULL')),
  public_model jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dossier_reports_by_company ON dossier_reports(dossier_id,created_at DESC);
