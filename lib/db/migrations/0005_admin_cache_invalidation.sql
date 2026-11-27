-- Invalidate only derived ADMIN observations when canonical saved inputs change.
-- Business entities, historical analyses, access and payments are never removed.
CREATE OR REPLACE FUNCTION invalidate_admin_analysis_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.payload IS DISTINCT FROM OLD.payload THEN
  DELETE FROM admin_analysis_observations WHERE analysis_id=NEW.id;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER admin_analysis_observation_changed AFTER UPDATE OF payload ON analyses
 FOR EACH ROW EXECUTE FUNCTION invalidate_admin_analysis_observation();

CREATE OR REPLACE FUNCTION invalidate_admin_profile_observations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.payload IS DISTINCT FROM OLD.payload THEN
  -- Coordinate with on-demand observation writes that lock the parent analysis.
  PERFORM id FROM analyses WHERE company_inn=NEW.inn ORDER BY id FOR UPDATE;
  DELETE FROM admin_analysis_observations WHERE analysis_id IN (SELECT id FROM analyses WHERE company_inn=NEW.inn);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER admin_profile_observation_changed AFTER INSERT OR UPDATE OF payload ON checko_profiles
 FOR EACH ROW EXECUTE FUNCTION invalidate_admin_profile_observations();
