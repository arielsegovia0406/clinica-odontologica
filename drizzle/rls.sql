-- Applied after Drizzle migrations by scripts/apply-rls.ts
-- FORCE ROW LEVEL SECURITY so even owners cannot skip policies (migrator still bypasses as superuser-equivalent owner unless forced).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'pacientes',
      'consentimientos',
      'anamnesis',
      'visitas',
      'visita_adendas',
      'odontogramas',
      'odontograma_dientes',
      'odontograma_caras',
      'odontograma_protesis',
      'indicadores_salud_bucal',
      'indices',
      'diagnosticos',
      'plan_tratamiento',
      'plan_items',
      'plantillas_prescripcion',
      'prescripciones',
      'documentos_generados',
      'sesiones_dictado',
      'audit_log',
      'solicitudes_arco'
    ]) AS tbl
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', r.tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (clinica_id = nullif(current_setting(''app.clinica_id'', true), ''''))
         WITH CHECK (clinica_id = nullif(current_setting(''app.clinica_id'', true), ''''))',
      r.tbl
    );
  END LOOP;
END
$$;

-- audit_log append-only for app_user
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
GRANT SELECT, INSERT ON audit_log TO app_user;

CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

-- --- Odontograma: active membership role required for writes (defense in depth) ---

CREATE OR REPLACE FUNCTION app_has_clinical_write_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM member m
    WHERE m.organization_id = nullif(current_setting('app.clinica_id', true), '')
      AND m.user_id = nullif(current_setting('app.user_id', true), '')
      AND m.estado = 'activa'
      AND m.role IN ('odontologo', 'auxiliar', 'admin')
  );
$$;

-- Replace bare tenant policies on odontograma tables with select + role-gated writes
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'odontogramas',
    'odontograma_dientes',
    'odontograma_caras',
    'odontograma_protesis'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS odontograma_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS odontograma_write_role ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS odontograma_update_role ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS odontograma_delete_role ON %I', t);

    EXECUTE format(
      'CREATE POLICY odontograma_select ON %I
         FOR SELECT
         USING (clinica_id = nullif(current_setting(''app.clinica_id'', true), ''''))',
      t
    );
    EXECUTE format(
      'CREATE POLICY odontograma_write_role ON %I
         FOR INSERT
         WITH CHECK (
           clinica_id = nullif(current_setting(''app.clinica_id'', true), '''')
           AND app_has_clinical_write_role()
         )',
      t
    );
    EXECUTE format(
      'CREATE POLICY odontograma_update_role ON %I
         FOR UPDATE
         USING (clinica_id = nullif(current_setting(''app.clinica_id'', true), ''''))
         WITH CHECK (
           clinica_id = nullif(current_setting(''app.clinica_id'', true), '''')
           AND app_has_clinical_write_role()
         )',
      t
    );
    EXECUTE format(
      'CREATE POLICY odontograma_delete_role ON %I
         FOR DELETE
         USING (
           clinica_id = nullif(current_setting(''app.clinica_id'', true), '''')
           AND app_has_clinical_write_role()
         )',
      t
    );
  END LOOP;
END
$$;

-- Immutability: block mutations when odontograma.inmutable OR visita firmada
-- Exception: SET LOCAL app.arco_purge = 'true' during approved ARCO eliminación (F6)
CREATE OR REPLACE FUNCTION odontograma_reject_if_locked()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  o_id text;
  locked boolean;
  purge text;
BEGIN
  purge := nullif(current_setting('app.arco_purge', true), '');
  IF purge = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'odontogramas' THEN
    o_id := COALESCE(NEW.id, OLD.id);
    -- Allow the lock flip itself (false → true), including when visita just became firmada
    IF TG_OP = 'UPDATE'
       AND OLD.inmutable IS DISTINCT FROM true
       AND NEW.inmutable = true THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'odontograma_dientes' THEN
    o_id := COALESCE(NEW.odontograma_id, OLD.odontograma_id);
  ELSIF TG_TABLE_NAME = 'odontograma_protesis' THEN
    o_id := COALESCE(NEW.odontograma_id, OLD.odontograma_id);
  ELSIF TG_TABLE_NAME = 'odontograma_caras' THEN
    SELECT d.odontograma_id INTO o_id
    FROM odontograma_dientes d
    WHERE d.id = COALESCE(NEW.diente_id, OLD.diente_id);
  ELSE
    RAISE EXCEPTION 'odontograma_reject_if_locked: unexpected table %', TG_TABLE_NAME;
  END IF;

  SELECT (o.inmutable OR v.estado = 'firmada')
  INTO locked
  FROM odontogramas o
  INNER JOIN visitas v ON v.id = o.visita_id
  WHERE o.id = o_id;

  IF COALESCE(locked, false) THEN
    RAISE EXCEPTION 'odontograma_locked: visita firmada o odontograma inmutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS odontogramas_immutable ON odontogramas;
CREATE TRIGGER odontogramas_immutable
  BEFORE UPDATE OR DELETE ON odontogramas
  FOR EACH ROW EXECUTE FUNCTION odontograma_reject_if_locked();

DROP TRIGGER IF EXISTS odontograma_dientes_immutable ON odontograma_dientes;
CREATE TRIGGER odontograma_dientes_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON odontograma_dientes
  FOR EACH ROW EXECUTE FUNCTION odontograma_reject_if_locked();

DROP TRIGGER IF EXISTS odontograma_caras_immutable ON odontograma_caras;
CREATE TRIGGER odontograma_caras_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON odontograma_caras
  FOR EACH ROW EXECUTE FUNCTION odontograma_reject_if_locked();

DROP TRIGGER IF EXISTS odontograma_protesis_immutable ON odontograma_protesis;
CREATE TRIGGER odontograma_protesis_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON odontograma_protesis
  FOR EACH ROW EXECUTE FUNCTION odontograma_reject_if_locked();

-- When marking visita firmada, lock linked odontograma
CREATE OR REPLACE FUNCTION visita_firma_lock_odontograma()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estado = 'firmada' AND (OLD.estado IS DISTINCT FROM 'firmada') THEN
    UPDATE odontogramas SET inmutable = true WHERE visita_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visita_firma_lock_odo ON visitas;
CREATE TRIGGER visita_firma_lock_odo
  AFTER UPDATE OF estado ON visitas
  FOR EACH ROW EXECUTE FUNCTION visita_firma_lock_odontograma();

-- Grants on all clinical + auth tables for app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "user", session, account, verification, organization, member, invitation,
  pacientes, consentimientos, anamnesis, visitas, visita_adendas,
  odontogramas, odontograma_dientes, odontograma_caras, odontograma_protesis,
  indicadores_salud_bucal, indices, diagnosticos, plan_tratamiento, plan_items,
  plantillas_prescripcion, prescripciones, documentos_generados, sesiones_dictado,
  solicitudes_arco
TO app_user;

GRANT SELECT, INSERT ON audit_log TO app_user;
