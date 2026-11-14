-- A dossier is a private company identity. Bank analyses remain immutable, independently addressable versions.
CREATE TABLE company_dossiers (
  id text PRIMARY KEY,
  owner_email text NOT NULL,
  company_inn text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_email, company_inn)
);
CREATE TABLE dossier_sources (
  dossier_id text NOT NULL REFERENCES company_dossiers(id),
  source_id text NOT NULL,
  source_type text NOT NULL,
  payload jsonb NOT NULL,
  document_id text UNIQUE REFERENCES client_documents(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(dossier_id, source_id)
);
