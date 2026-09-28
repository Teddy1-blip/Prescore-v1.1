# Temporary staging FULL access

Set runtime `PRESCORE_STAGING_FREE_FULL=1` only in `prescore-staging`.
The switch additionally requires `PRESCORE_BASE_URL` to equal
`https://prescore-staging-dorogovab.amvera.io` (optional trailing slash).

Checkout redirects authenticated users to their full report. Unauthenticated
users must sign in first. A requested analysis ID is selected only from analyses
already returned by the authorized workspace API. Owned analyses resolve to FULL
without storing a paid entitlement, order, or payment. Scoring is unchanged.

Rollback: set `PRESCORE_STAGING_FREE_FULL=0` (or remove it) and restart staging.
Normal checkout and existing entitlement rules resume; no database cleanup or
migration is needed. Do not enable this switch in production.
