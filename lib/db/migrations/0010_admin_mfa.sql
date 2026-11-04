-- Additive administrator MFA schema. Deploy only after the staging backup/restore gate.
ALTER TABLE "user" ADD COLUMN "twoFactorEnabled" boolean NOT NULL DEFAULT false;
CREATE TABLE "twoFactor" (
 id text PRIMARY KEY,
 "userId" text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
 secret text NOT NULL,
 "backupCodes" text NOT NULL,
 verified boolean NOT NULL DEFAULT false,
 "failedVerificationCount" integer NOT NULL DEFAULT 0 CHECK ("failedVerificationCount">=0),
 "lockedUntil" timestamptz
);
CREATE INDEX prescore_two_factor_secret_idx ON "twoFactor"(secret);
CREATE TABLE platform_admin_mfa_sessions (
 session_id text PRIMARY KEY REFERENCES "session"(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 verified_at timestamptz NOT NULL,
 method text NOT NULL CHECK (method IN ('TOTP','BACKUP'))
);
CREATE INDEX prescore_admin_mfa_user_idx ON platform_admin_mfa_sessions(user_id);
