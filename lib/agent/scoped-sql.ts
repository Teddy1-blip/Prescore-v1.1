import {brokerApplicationSQL,dossierAuthorizationSQL} from '../auth/broker-authorizations';

// The legacy and paginated agent views use the same access predicates.
export const clientSelect = `SELECT l.id, l.company_name AS companyName, l.company_inn AS companyInn,
        l.contact_name AS contactName, l.phone, l.email, l.source, l.status,
        l.subscription_status AS subscriptionStatus, l.consent_at AS consentAt,
        l.created_at AS createdAt, l.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM payment_orders po JOIN analyses paid_analysis ON paid_analysis.id=po.analysis_id WHERE po.company_inn=l.company_inn AND po.status='Оплачен' AND ${dossierAuthorizationSQL('paid_analysis','actor.email')}) AS paidFullOrders,
        (SELECT a.id FROM analyses a WHERE a.company_inn = l.company_inn AND a.archive_state='ACTIVE' AND (a.owner_email=actor.email OR ${dossierAuthorizationSQL('a','actor.email')}) ORDER BY a.created_at DESC LIMIT 1) AS analysisId
        FROM agent_leads l CROSS JOIN (SELECT ?::text AS email) actor WHERE (NOT EXISTS (SELECT 1 FROM analyses ax WHERE ax.company_inn=l.company_inn AND ${dossierAuthorizationSQL('ax','actor.email')}) OR EXISTS (SELECT 1 FROM analyses ax WHERE ax.company_inn=l.company_inn AND ${dossierAuthorizationSQL('ax','actor.email')} AND ax.archive_state='ACTIVE') OR NOT EXISTS (SELECT 1 FROM analyses ax JOIN analysis_archive_batches ab ON ab.id=ax.archive_batch_id WHERE ax.company_inn=l.company_inn AND ${dossierAuthorizationSQL('ax','actor.email')} AND ax.archive_state<>'ACTIVE' AND l.created_at::timestamp AT TIME ZONE 'UTC' < ab.cutover_at)) AND l.agent_code = ?`;

export const applicationSelect = `SELECT id, lead_id AS leadId, analysis_id AS analysisId, company_name AS companyName,
        bank, product, requested_amount AS requestedAmount, calculated_limit AS calculatedLimit,
        COALESCE((SELECT d.status FROM deals d WHERE d.id = agent_applications.id), status) AS status, next_action AS nextAction,
        created_at AS createdAt, updated_at AS updatedAt
        FROM agent_applications CROSS JOIN (SELECT ?::text AS email) actor WHERE ${brokerApplicationSQL('agent_applications','actor.email')} AND agent_code = ?`;
