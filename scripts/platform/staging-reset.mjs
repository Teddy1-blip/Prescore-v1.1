import { randomUUID } from 'node:crypto';
import { getPool } from '../../lib/db/client.ts';

const STAGING_ORIGIN = 'https://prescore-staging-dorogovab.amvera.io';
const STAGING_DB_HOST = 'amvera-dorogovab-cnpg-prescore-stage-db-rw';
const STAGING_DB_NAME = 'prescorestaging';
const ADMIN = 'dorogovab@yandex.ru';
const AGENT = 'AGENT-2EZU15FLCNYYRY8L41GGKW6Q';
const MARKER = 'STAGING_CLIENT_DATA_RESET_2026_10_10_V1';

function guardedForStaging() {
  if (process.env.PRESCORE_BASE_URL !== STAGING_ORIGIN) return false;
  let url;
  try { url = new URL(process.env.DATABASE_URL || ''); } catch { return false; }
  return url.hostname === STAGING_DB_HOST;
}

if (!guardedForStaging()) {
  console.log(JSON.stringify({status:'SKIPPED_NON_STAGING'}));
  process.exit(0);
}

const pool = getPool();
const c = await pool.connect();
const deleteTables = [
  'ai_usage',
  'ai_messages',
  'ai_conversations',
  'application_messages',
  'application_status_history',
  'client_documents',
  'agent_prospects',
  'agent_applications',
  'deals',
  'analysis_entitlements',
  'payments',
  'payment_orders',
  'subscriptions',
  'agent_leads',
  'checko_profiles',
  'analyses',
];

try {
  await c.query('BEGIN');
  await c.query('SELECT pg_advisory_xact_lock(6419820)');

  const db = (await c.query('SELECT current_database() AS name')).rows[0]?.name;
  if (db !== STAGING_DB_NAME) throw new Error('STAGING_RESET_WRONG_DATABASE');

  const marker = await c.query(
    "SELECT 1 FROM public.audit_log WHERE entity_type='MAINTENANCE' AND entity_id='staging' AND action=$1 LIMIT 1",
    [MARKER],
  );
  if (marker.rows.length) {
    await c.query('COMMIT');
    console.log(JSON.stringify({status:'ALREADY_APPLIED',database:db,marker:MARKER}));
    process.exit(0);
  }

  const user = (await c.query('SELECT id,email FROM public."user" WHERE email=$1',[ADMIN])).rows[0];
  if (!user) throw new Error('STAGING_RESET_ADMIN_USER_MISSING');

  const roles = (await c.query('SELECT role FROM public.platform_roles WHERE user_id=$1 ORDER BY role',[user.id])).rows.map(r=>String(r.role));
  if (!roles.includes('ADMIN')) throw new Error('STAGING_RESET_ADMIN_ROLE_MISSING');

  const agent = (await c.query('SELECT user_email,agent_code FROM public.agent_accounts WHERE user_email=$1 AND agent_code=$2',[ADMIN,AGENT])).rows[0];
  if (!agent) throw new Error('STAGING_RESET_AGENT_ACCOUNT_MISSING');

  const preservedBefore = {};
  for (const table of ['user','platform_roles','agent_accounts','agent_partners','module_settings','control_settings']) {
    preservedBefore[table] = Number((await c.query('SELECT count(*)::int AS count FROM public."' + table + '"')).rows[0].count);
  }

  const deleted = {};
  for (const table of deleteTables) {
    const r = await c.query('DELETE FROM public."' + table + '"');
    deleted[table] = r.rowCount ?? 0;
  }

  const auditDeleted = await c.query("DELETE FROM public.audit_log WHERE entity_type IN ('APPLICATION','ANALYSIS')");
  deleted.audit_log = auditDeleted.rowCount ?? 0;

  for (const table of deleteTables) {
    const count = Number((await c.query('SELECT count(*)::int AS count FROM public."' + table + '"')).rows[0].count);
    if (count !== 0) throw new Error('STAGING_RESET_NOT_EMPTY_' + table);
  }

  for (const table of Object.keys(preservedBefore)) {
    const count = Number((await c.query('SELECT count(*)::int AS count FROM public."' + table + '"')).rows[0].count);
    if (count !== preservedBefore[table]) throw new Error('STAGING_RESET_PRESERVED_COUNT_CHANGED_' + table);
  }

  await c.query(
    "INSERT INTO public.audit_log (id,entity_type,entity_id,action,actor_role,actor_email,metadata,created_at) VALUES ($1,'MAINTENANCE','staging',$2,'SYSTEM',$3,$4,$5)",
    [randomUUID(), MARKER, ADMIN, JSON.stringify({deleted,preserved:preservedBefore}), new Date().toISOString()],
  );

  await c.query('COMMIT');
  console.log(JSON.stringify({status:'APPLIED',database:db,marker:MARKER,deleted,preserved:preservedBefore}));
} catch (error) {
  await c.query('ROLLBACK');
  console.error('STAGING_CLIENT_RESET_FAILED', error instanceof Error ? error.message : 'UNKNOWN');
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
