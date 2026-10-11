-- Derived, versioned observations only. No credit rules, payment or entitlement changes.
CREATE TABLE IF NOT EXISTS admin_analysis_observations (
 analysis_id text PRIMARY KEY REFERENCES analyses(id),
 input_fingerprint text NOT NULL,
 canonical_version text NOT NULL,
 canonical_state text NOT NULL,
 source_state text NOT NULL,
 completeness double precision,
 index_value double precision,
 readiness text,
 assessment text,
 debt_capacity_status text,
 critical_count integer,
 observed_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_observations_state_idx ON admin_analysis_observations(canonical_state,source_state);
