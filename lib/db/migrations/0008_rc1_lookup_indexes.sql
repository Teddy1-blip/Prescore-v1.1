-- Existing owner/assignment/document/audit/confirmed-payment lookup predicates.
-- No policy, data transformation or credit/billing economics changes.
CREATE INDEX analyses_owner_company_date ON analyses(owner_email,company_inn,created_at DESC,id);
CREATE INDEX agent_leads_company_owner_agent ON agent_leads(company_inn,email,agent_code);
CREATE INDEX deals_owner_date ON deals(owner_email,updated_at DESC,id);
CREATE INDEX documents_analysis_date ON client_documents(analysis_id,created_at DESC,id);
CREATE INDEX documents_owner_date ON client_documents(owner_email,created_at DESC,id);
CREATE INDEX audit_entity_date ON audit_log(entity_type,entity_id,created_at DESC,id);
CREATE INDEX billing_payments_confirmed ON billing_payments(confirmed_at,id) WHERE confirmed_at IS NOT NULL;
