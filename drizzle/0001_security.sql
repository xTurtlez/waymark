-- Waymark security layer: roles, grants, row-level security, append-only
-- hash-chained audit log, job claiming.
--
-- How tenancy works: each request runs in a transaction that does
--   SET LOCAL ROLE waymark_app;
--   SELECT set_config('app.firm_id', '<uuid>', true),
--          set_config('app.user_id', '<user id>', true),
--          set_config('app.scope', 'firm' | 'portal', true);
-- waymark_app is NOLOGIN, NOBYPASSRLS and does not own any table, so every
-- policy below applies regardless of how privileged the login role is.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
-- Roles:
--   owner (whoever runs migrations): owns every table. Used only by
--     migrations, seed and admin scripts (DATABASE_ADMIN_URL). Never by the app.
--   waymark_runtime: the app's LOGIN role (DATABASE_URL). Not an owner, not a
--     superuser, no BYPASSRLS, NOINHERIT. It can use the auth tables and a few
--     SECURITY DEFINER functions directly, and reaches tenant data only by
--     SET LOCAL ROLE waymark_app inside withTenant(). It cannot SET ROLE to
--     anything else. Its password is set by `npm run db:runtime-role`.
--   waymark_app: NOLOGIN; the role every RLS policy targets.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'waymark_app') THEN
    CREATE ROLE waymark_app NOLOGIN NOBYPASSRLS NOSUPERUSER NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'waymark_runtime') THEN
    CREATE ROLE waymark_runtime NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
--> statement-breakpoint
GRANT waymark_app TO waymark_runtime;
--> statement-breakpoint
-- Admin scripts may also switch into waymark_app (e.g. to test policies).
DO $$ BEGIN EXECUTE format('GRANT waymark_app TO %I', current_user); END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO waymark_app, waymark_runtime;
--> statement-breakpoint
-- Better Auth tables are global (not tenant data) and used directly by the runtime role.
GRANT SELECT, INSERT, UPDATE, DELETE ON "user", session, account, verification, two_factor, passkey TO waymark_runtime;
--> statement-breakpoint

-- ── Session context helpers ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_firm_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.firm_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_id() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_scope() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('app.scope', true), ''), 'none') $$;
--> statement-breakpoint
-- Estates the current portal user is a party to. SECURITY DEFINER so the
-- lookup itself is not filtered by estate_party's own policy (which would
-- otherwise recurse).
CREATE OR REPLACE FUNCTION app_portal_estates() RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT estate_id FROM estate_party
    WHERE user_id = app_user_id() AND firm_id = app_firm_id()
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_portal_estates() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_firm_id(), app_user_id(), app_scope(), app_portal_estates() TO waymark_app;
--> statement-breakpoint
-- True when the row's firm is the current firm and, in portal scope, the
-- estate is one the current user belongs to.
CREATE OR REPLACE FUNCTION app_can_see(row_firm uuid, row_estate uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT row_firm = app_firm_id() AND (
      app_scope() = 'firm'
      OR (app_scope() = 'portal' AND row_estate IN (SELECT app_portal_estates()))
    )
  $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_can_see(uuid, uuid) TO waymark_app;
--> statement-breakpoint

-- ── Grants ─────────────────────────────────────────────────────────────────
GRANT SELECT, UPDATE ON firm TO waymark_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON membership TO waymark_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON estate TO waymark_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON estate_party TO waymark_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON file_object TO waymark_app;
--> statement-breakpoint
GRANT UPDATE (scan_status) ON file_object TO waymark_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_event TO waymark_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE audit_event_id_seq TO waymark_app;
--> statement-breakpoint
GRANT INSERT ON job TO waymark_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE job_id_seq TO waymark_app;
--> statement-breakpoint
GRANT INSERT ON outbound_message TO waymark_app;
--> statement-breakpoint
-- Staff/family names for display (no secrets).
GRANT SELECT (id, name, email, image) ON "user" TO waymark_app;
--> statement-breakpoint

-- ── Row-level security ─────────────────────────────────────────────────────
ALTER TABLE firm ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY firm_read ON firm FOR SELECT TO waymark_app USING (id = app_firm_id());
--> statement-breakpoint
CREATE POLICY firm_update ON firm FOR UPDATE TO waymark_app
  USING (id = app_firm_id() AND app_scope() = 'firm') WITH CHECK (id = app_firm_id());
--> statement-breakpoint

ALTER TABLE membership ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Portal users may see the firm's staff (to show "your solicitor").
CREATE POLICY membership_read ON membership FOR SELECT TO waymark_app USING (firm_id = app_firm_id());
--> statement-breakpoint
CREATE POLICY membership_write ON membership FOR INSERT TO waymark_app
  WITH CHECK (firm_id = app_firm_id() AND app_scope() = 'firm');
--> statement-breakpoint
CREATE POLICY membership_update ON membership FOR UPDATE TO waymark_app
  USING (firm_id = app_firm_id() AND app_scope() = 'firm') WITH CHECK (firm_id = app_firm_id());
--> statement-breakpoint

ALTER TABLE estate ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY estate_read ON estate FOR SELECT TO waymark_app USING (app_can_see(firm_id, id));
--> statement-breakpoint
CREATE POLICY estate_insert ON estate FOR INSERT TO waymark_app
  WITH CHECK (firm_id = app_firm_id() AND app_scope() = 'firm');
--> statement-breakpoint
-- Families change their own estate's workspace (uploads, messages, assets);
-- the server action layer limits which actions they may run.
CREATE POLICY estate_update ON estate FOR UPDATE TO waymark_app
  USING (app_can_see(firm_id, id)) WITH CHECK (app_can_see(firm_id, id));
--> statement-breakpoint

ALTER TABLE estate_party ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY estate_party_read ON estate_party FOR SELECT TO waymark_app USING (app_can_see(firm_id, estate_id));
--> statement-breakpoint
CREATE POLICY estate_party_insert ON estate_party FOR INSERT TO waymark_app
  WITH CHECK (firm_id = app_firm_id() AND app_scope() = 'firm');
--> statement-breakpoint
CREATE POLICY estate_party_update ON estate_party FOR UPDATE TO waymark_app
  USING (firm_id = app_firm_id() AND app_scope() = 'firm') WITH CHECK (firm_id = app_firm_id());
--> statement-breakpoint
-- A family member may update their own party row (e.g. accepting the invite).
CREATE POLICY estate_party_self_update ON estate_party FOR UPDATE TO waymark_app
  USING (firm_id = app_firm_id() AND app_scope() = 'portal' AND user_id = app_user_id())
  WITH CHECK (firm_id = app_firm_id() AND user_id = app_user_id());
--> statement-breakpoint

ALTER TABLE file_object ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY file_read ON file_object FOR SELECT TO waymark_app USING (app_can_see(firm_id, estate_id));
--> statement-breakpoint
CREATE POLICY file_insert ON file_object FOR INSERT TO waymark_app WITH CHECK (app_can_see(firm_id, estate_id));
--> statement-breakpoint
CREATE POLICY file_update ON file_object FOR UPDATE TO waymark_app
  USING (app_can_see(firm_id, estate_id)) WITH CHECK (app_can_see(firm_id, estate_id));
--> statement-breakpoint

ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Only firm staff read the audit trail; both scopes may append to estates they can see.
CREATE POLICY audit_read ON audit_event FOR SELECT TO waymark_app
  USING (firm_id = app_firm_id() AND app_scope() = 'firm');
--> statement-breakpoint
CREATE POLICY audit_insert ON audit_event FOR INSERT TO waymark_app
  WITH CHECK (firm_id = app_firm_id() AND (estate_id IS NULL AND app_scope() = 'firm' OR app_can_see(firm_id, estate_id)));
--> statement-breakpoint

ALTER TABLE job ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY job_insert ON job FOR INSERT TO waymark_app WITH CHECK (firm_id = app_firm_id());
--> statement-breakpoint

ALTER TABLE outbound_message ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY outbound_insert ON outbound_message FOR INSERT TO waymark_app WITH CHECK (firm_id = app_firm_id());
--> statement-breakpoint
-- The mailer runs as the runtime role (sign-in links are not tenant data).
GRANT SELECT, INSERT, UPDATE ON outbound_message TO waymark_runtime;
--> statement-breakpoint
CREATE POLICY outbound_runtime ON outbound_message FOR ALL TO waymark_runtime USING (true) WITH CHECK (true);
--> statement-breakpoint
-- System jobs (no firm) may be queued by the runtime role; claiming and
-- finishing go through SECURITY DEFINER functions below.
GRANT INSERT ON job TO waymark_runtime;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE job_id_seq TO waymark_runtime;
--> statement-breakpoint
CREATE POLICY job_runtime_insert ON job FOR INSERT TO waymark_runtime WITH CHECK (firm_id IS NULL);
--> statement-breakpoint
-- New executors invited by staff get an auth user created by the runtime role (granted above).
--> statement-breakpoint

-- ── Append-only, hash-chained audit log ────────────────────────────────────
-- The hashed payload is a fixed list of fields; jsonb text output is
-- canonical (keys sorted), and the timestamp is hashed as epoch microseconds
-- so the result does not depend on the session time zone.
CREATE OR REPLACE FUNCTION audit_payload(e audit_event) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_build_object(
      'firm_id', e.firm_id, 'estate_id', e.estate_id, 'seq', e.seq,
      'actor_type', e.actor_type, 'actor_user_id', e.actor_user_id,
      'action', e.action, 'entity_type', e.entity_type, 'entity_id', e.entity_id,
      'summary', e.summary, 'before', e.before, 'after', e.after, 'ai', e.ai,
      'ip', e.ip, 'user_agent', e.user_agent,
      'created_at_us', (extract(epoch FROM e.created_at) * 1000000)::bigint
    )::text
  $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_chain() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  last_seq bigint;
  last_hash text;
BEGIN
  -- Serialise appends per firm so the chain has no forks.
  PERFORM pg_advisory_xact_lock(hashtextextended('audit:' || NEW.firm_id::text, 0));
  SELECT seq, hash INTO last_seq, last_hash
    FROM audit_event WHERE firm_id = NEW.firm_id ORDER BY seq DESC LIMIT 1;
  NEW.seq := coalesce(last_seq, 0) + 1;
  NEW.created_at := clock_timestamp();
  NEW.prev_hash := coalesce(last_hash, repeat('0', 64));
  NEW.hash := encode(digest(NEW.prev_hash || audit_payload(NEW), 'sha256'), 'hex');
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_event_chain BEFORE INSERT ON audit_event
  FOR EACH ROW EXECUTE FUNCTION audit_chain();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_reject_change() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_event_no_update BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION audit_reject_change();
--> statement-breakpoint
CREATE TRIGGER audit_event_no_truncate BEFORE TRUNCATE ON audit_event
  FOR EACH STATEMENT EXECUTE FUNCTION audit_reject_change();
--> statement-breakpoint
-- Recompute a firm's chain. Returns the first broken seq, or NULL if intact.
CREATE OR REPLACE FUNCTION audit_verify(p_firm uuid) RETURNS bigint
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e audit_event;
  expected_prev text := repeat('0', 64);
  expected_seq bigint := 1;
BEGIN
  FOR e IN SELECT * FROM audit_event WHERE firm_id = p_firm ORDER BY seq LOOP
    IF e.seq <> expected_seq OR e.prev_hash <> expected_prev
       OR e.hash <> encode(digest(e.prev_hash || audit_payload(e), 'sha256'), 'hex') THEN
      RETURN e.seq;
    END IF;
    expected_prev := e.hash;
    expected_seq := expected_seq + 1;
  END LOOP;
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_verify(uuid) FROM PUBLIC;
--> statement-breakpoint

-- ── Who is this user? (routing only; data still goes through RLS) ─────────
CREATE OR REPLACE FUNCTION app_viewer_context(p_user text) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
      'memberships', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', m.id, 'firm_id', m.firm_id, 'role', m.role) ORDER BY m.created_at)
        FROM membership m WHERE m.user_id = p_user AND m.active), '[]'::jsonb),
      'parties', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', p.id, 'firm_id', p.firm_id, 'estate_id', p.estate_id) ORDER BY p.created_at)
        FROM estate_party p WHERE p.user_id = p_user), '[]'::jsonb)
    )
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_viewer_context(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_viewer_context(text) TO waymark_runtime;
--> statement-breakpoint
-- Verify every firm's chain; returns firms with a break.
CREATE OR REPLACE FUNCTION audit_verify_all() RETURNS TABLE(firm_id uuid, firm_name text, first_broken bigint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT f.id, f.name, audit_verify(f.id) FROM firm f WHERE audit_verify(f.id) IS NOT NULL
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_verify_all() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION audit_verify_all() TO waymark_runtime;
--> statement-breakpoint

-- ── Job queue (claim/finish run as definer, outside tenant scope) ───────────
CREATE OR REPLACE FUNCTION job_finish(p_id bigint, p_status job_status, p_error text, p_run_at timestamptz) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    UPDATE job SET status = p_status, last_error = p_error, run_at = coalesce(p_run_at, run_at),
      locked_at = NULL, locked_by = NULL,
      finished_at = CASE WHEN p_status IN ('done', 'dead') THEN now() ELSE NULL END
    WHERE id = p_id
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION job_finish(bigint, job_status, text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION job_finish(bigint, job_status, text, timestamptz) TO waymark_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION job_claim(p_worker text, p_limit int) RETURNS SETOF job
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    -- Requeue jobs whose worker died mid-run.
    WITH stale AS (
      UPDATE job SET status = 'queued', locked_at = NULL, locked_by = NULL
      WHERE status = 'running' AND locked_at < now() - interval '10 minutes'
      RETURNING id
    )
    UPDATE job SET status = 'running', locked_at = now(), locked_by = p_worker, attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM job
      WHERE status = 'queued' AND run_at <= now()
      ORDER BY run_at, id
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION job_claim(text, int) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION job_claim(text, int) TO waymark_runtime;
--> statement-breakpoint
-- Enqueue with de-duplication. ON CONFLICT under RLS would need a SELECT
-- policy on job, which neither role has (by design), so the insert runs as
-- definer after checking the caller may queue for this firm: firm jobs only
-- for the firm in the current tenant context, system jobs (NULL) otherwise.
CREATE OR REPLACE FUNCTION job_enqueue(p_firm uuid, p_kind text, p_payload jsonb, p_run_at timestamptz, p_dedupe text, p_max int) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_firm IS NOT NULL AND p_firm IS DISTINCT FROM app_firm_id() THEN
    RAISE EXCEPTION 'job_enqueue: firm % is not the current tenant', p_firm USING ERRCODE = '42501';
  END IF;
  INSERT INTO job (firm_id, kind, payload, run_at, dedupe_key, max_attempts)
  VALUES (p_firm, p_kind, coalesce(p_payload, '{}'::jsonb), coalesce(p_run_at, now()), p_dedupe, coalesce(p_max, 5))
  ON CONFLICT (dedupe_key) DO NOTHING;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION job_enqueue(uuid, text, jsonb, timestamptz, text, int) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION job_enqueue(uuid, text, jsonb, timestamptz, text, int) TO waymark_app, waymark_runtime;
