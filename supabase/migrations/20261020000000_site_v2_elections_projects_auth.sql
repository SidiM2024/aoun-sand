-- ==========================================================
-- الموقع v2: الإحصائيات الحقيقية، المشاريع، محتوى الرئيسية، الانتخابات، إصلاح التسجيل
-- Site v2: live stats, projects, homepage content, elections, signup/login fixes
-- ==========================================================
-- Requires (run earlier): 20261007000000_mahaja_students.sql and
--                         20261008000000_admin_sections_and_mahaja_attendance.sql
-- Safe to re-run. Nothing existing is dropped, and the finance tables are only READ.
-- ==========================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$ BEGIN
  IF to_regprocedure('public.admin_require_section(text, text)') IS NULL THEN
    RAISE EXCEPTION 'Run 20261008000000_admin_sections_and_mahaja_attendance.sql first';
  END IF;
END $$;

-- ----------------------------------------------------------
-- 0. New dashboard sections: elections, projects, homepage
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_all_sections()
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['users','approvals','notifications','voting','donations','patients','media',
               'finance','requests','competitions','mahaja','memberships','user_donations',
               'elections','projects','homepage']::TEXT[];
$$;

-- Phone numbers are compared on their last 8 digits (Mauritanian numbers, with or without +222).
CREATE OR REPLACE FUNCTION public.normalize_phone(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 8);
$$;

-- ----------------------------------------------------------
-- 1. Live homepage statistics (read-only aggregates)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_home_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_members BIGINT := 0; v_approved BIGINT := 0; v_students BIGINT := 0;
  v_donations NUMERIC := 0; v_expenses NUMERIC := 0;
  v_has_status BOOLEAN;
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    SELECT count(*), count(*) FILTER (WHERE approval_status = 'Approved')
      INTO v_members, v_approved
      FROM public.users WHERE coalesce(is_mahaja, false) = false;
  END IF;

  IF to_regclass('public.mahaja_students') IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'mahaja_students' AND column_name = 'status')
      INTO v_has_status;
    IF v_has_status THEN
      EXECUTE 'SELECT count(*) FROM public.mahaja_students WHERE status <> ''suspended''' INTO v_students;
    ELSE
      EXECUTE 'SELECT count(*) FROM public.mahaja_students' INTO v_students;
    END IF;
  END IF;

  -- Same tables and sums the admin finance dashboard uses.
  IF to_regclass('public.donation_revenues') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce(sum(amount), 0) FROM public.donation_revenues' INTO v_donations;
  END IF;
  IF to_regclass('public.donation_expenses') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce(sum(amount), 0) FROM public.donation_expenses' INTO v_expenses;
  END IF;

  RETURN jsonb_build_object(
    'members', v_members,
    'approved_members', v_approved,
    'mahaja_students', v_students,
    'donations_total', v_donations,
    'expenses_total', v_expenses,
    'balance', v_donations - v_expenses,
    'generated_at', now());
END $$;

-- ----------------------------------------------------------
-- 2. Projects (shown on the homepage and /projects)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 150),
  subtitle     TEXT,
  description  TEXT,
  category     TEXT,
  image_url    TEXT,
  image_path   TEXT,
  video_url    TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_featured  BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_public_read ON public.projects;
CREATE POLICY projects_public_read ON public.projects FOR SELECT TO anon, authenticated USING (is_published);
REVOKE INSERT, UPDATE, DELETE ON public.projects FROM anon, authenticated;
GRANT SELECT ON public.projects TO anon, authenticated;

-- Seed with the projects that were hard-coded in the website, once.
INSERT INTO public.projects (title, subtitle, description, category, video_url, image_url, sort_order, created_by)
SELECT * FROM (VALUES
  ('سقيا الجمعية في غزة العزة', 'سقيا الماء', 'مشروع سقيا الجمعية في غزة لتوفير المياه.', 'المساعدات الإنسانية',
   'https://www.youtube.com/embed/nDQYphxF6UU', 'https://img.youtube.com/vi/nDQYphxF6UU/hqdefault.jpg', 1, 'seed'),
  ('السقاية رقم 11', 'سقيا الماء', 'مشروع السقاية رقم 11 لتوزيع المياه.', 'الخدمات المجتمعية',
   'https://www.youtube.com/embed/86LU416opIc', 'https://img.youtube.com/vi/86LU416opIc/hqdefault.jpg', 2, 'seed'),
  ('سقاية رقم 4', 'سقيا الماء', 'مشروع السقاية رقم 4 لتوفير المياه للمحتاجين.', 'الخدمات المجتمعية',
   'https://www.youtube.com/embed/ZLop_RsrDBw', 'https://img.youtube.com/vi/ZLop_RsrDBw/hqdefault.jpg', 3, 'seed'),
  ('شرح كتاب الأخضري', 'دعم التعليم', 'شرح مبسط لكتاب الأخضري.', 'دعم التعليم',
   'https://www.youtube.com/embed/fQgr-BUSW1c', 'https://img.youtube.com/vi/fQgr-BUSW1c/hqdefault.jpg', 4, 'seed')
) AS seed(title, subtitle, description, category, video_url, image_url, sort_order, created_by)
WHERE NOT EXISTS (SELECT 1 FROM public.projects);

CREATE OR REPLACE FUNCTION public.projects_admin_list(p_token TEXT DEFAULT NULL)
RETURNS SETOF public.projects LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.admin_require_section(p_token, 'projects');
  RETURN QUERY SELECT * FROM public.projects ORDER BY sort_order, created_at;
END $$;

CREATE OR REPLACE FUNCTION public.project_save(p_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS public.projects LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'projects'); v_row public.projects;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO public.projects (title, subtitle, description, category, image_url, image_path, video_url,
                                 is_published, is_featured, sort_order, created_by)
    VALUES (btrim(p_data->>'title'), nullif(btrim(coalesce(p_data->>'subtitle', '')), ''),
            nullif(btrim(coalesce(p_data->>'description', '')), ''), nullif(btrim(coalesce(p_data->>'category', '')), ''),
            nullif(p_data->>'image_url', ''), nullif(p_data->>'image_path', ''), nullif(btrim(coalesce(p_data->>'video_url', '')), ''),
            coalesce((p_data->>'is_published')::boolean, true), coalesce((p_data->>'is_featured')::boolean, true),
            coalesce((p_data->>'sort_order')::int, 0), v_me->>'label')
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.projects SET
      title = btrim(p_data->>'title'),
      subtitle = nullif(btrim(coalesce(p_data->>'subtitle', '')), ''),
      description = nullif(btrim(coalesce(p_data->>'description', '')), ''),
      category = nullif(btrim(coalesce(p_data->>'category', '')), ''),
      image_url = CASE WHEN p_data ? 'image_url' THEN nullif(p_data->>'image_url', '') ELSE image_url END,
      image_path = CASE WHEN p_data ? 'image_path' THEN nullif(p_data->>'image_path', '') ELSE image_path END,
      video_url = nullif(btrim(coalesce(p_data->>'video_url', '')), ''),
      is_published = coalesce((p_data->>'is_published')::boolean, is_published),
      is_featured = coalesce((p_data->>'is_featured')::boolean, is_featured),
      sort_order = coalesce((p_data->>'sort_order')::int, sort_order),
      updated_at = now()
    WHERE id = p_id RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.project_delete(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_path TEXT;
BEGIN
  PERFORM public.admin_require_section(p_token, 'projects');
  DELETE FROM public.projects WHERE id = p_id RETURNING image_path INTO v_path;
  RETURN v_path;
END $$;

-- ----------------------------------------------------------
-- 3. Homepage content (site_settings row 'homepage')
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.homepage_settings_save(p_value JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.admin_require_section(p_token, 'homepage');
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'BAD_VALUE' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.site_settings (id, value, updated_at) VALUES ('homepage', p_value, now())
  ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN p_value;
END $$;

-- Public image storage for projects, homepage slides and election candidates.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
-- Dashboard admins without a Supabase Auth session upload with the anon key (same model as
-- the existing media buckets); uploads are limited to these folders, size and image types.
DROP POLICY IF EXISTS site_media_select ON storage.objects;
DROP POLICY IF EXISTS site_media_insert ON storage.objects;
DROP POLICY IF EXISTS site_media_delete ON storage.objects;
CREATE POLICY site_media_select ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'site-media');
CREATE POLICY site_media_insert ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'site-media' AND (storage.foldername(name))[1] IN ('projects', 'homepage', 'candidates'));
CREATE POLICY site_media_delete ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'site-media' AND (storage.foldername(name))[1] IN ('projects', 'homepage', 'candidates'));

-- ----------------------------------------------------------
-- 4. Elections (secret ballot, one participation per member per election)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  description     TEXT,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  results_visible BOOLEAN NOT NULL DEFAULT false,
  max_choices     INTEGER NOT NULL DEFAULT 1 CHECK (max_choices BETWEEN 1 AND 50),
  eligibility     TEXT NOT NULL DEFAULT 'approved' CHECK (eligibility IN ('approved', 'registered')),
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.election_candidates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 150),
  photo_url   TEXT,
  photo_path  TEXT,
  bio         TEXT,
  program     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS election_candidates_election_idx ON public.election_candidates (election_id, sort_order);

-- Who participated (for "one vote per member"). Not linked to the ballot content.
CREATE TABLE IF NOT EXISTS public.election_voters (
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  voted_on    DATE NOT NULL DEFAULT current_date,
  PRIMARY KEY (election_id, user_id)
);

-- What was chosen. Deliberately stores no voter and no timestamp (secret ballot).
CREATE TABLE IF NOT EXISTS public.election_ballots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id  UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS election_ballots_candidate_idx ON public.election_ballots (election_id, candidate_id);

-- No direct table access at all; everything goes through the functions below.
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['elections', 'election_candidates', 'election_voters', 'election_ballots'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Votes can never be edited, and only disappear together with their election.
CREATE OR REPLACE FUNCTION public.election_votes_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'VOTES_ARE_IMMUTABLE'; END IF;
  IF EXISTS (SELECT 1 FROM public.elections WHERE id = OLD.election_id) THEN
    RAISE EXCEPTION 'VOTES_ARE_IMMUTABLE';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS election_voters_immutable ON public.election_voters;
CREATE TRIGGER election_voters_immutable BEFORE UPDATE OR DELETE ON public.election_voters
  FOR EACH ROW EXECUTE FUNCTION public.election_votes_immutable();
DROP TRIGGER IF EXISTS election_ballots_immutable ON public.election_ballots;
CREATE TRIGGER election_ballots_immutable BEFORE UPDATE OR DELETE ON public.election_ballots
  FOR EACH ROW EXECUTE FUNCTION public.election_votes_immutable();

CREATE OR REPLACE FUNCTION public.election_phase(e public.elections)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN e.status = 'draft' THEN 'draft'
    WHEN e.status = 'closed' THEN 'closed'
    WHEN e.starts_at IS NOT NULL AND now() < e.starts_at THEN 'upcoming'
    WHEN e.ends_at IS NOT NULL AND now() >= e.ends_at THEN 'ended'
    ELSE 'open'
  END;
$$;

-- Can this member vote in this election?
CREATE OR REPLACE FUNCTION public.election_member_eligible(p_user UUID, p_eligibility TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = p_user
       AND coalesce(u.is_mahaja, false) = false
       AND (p_eligibility = 'registered' OR u.approval_status = 'Approved'));
$$;

CREATE OR REPLACE FUNCTION public.election_eligible_count(p_eligibility TEXT)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*) FROM public.users u
   WHERE coalesce(u.is_mahaja, false) = false
     AND (p_eligibility = 'registered' OR u.approval_status = 'Approved');
$$;

CREATE OR REPLACE FUNCTION public.election_to_json(e public.elections, p_with_results BOOLEAN, p_user UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', e.id, 'title', e.title, 'description', e.description,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'status', e.status,
    'phase', public.election_phase(e), 'results_visible', e.results_visible,
    'max_choices', e.max_choices, 'eligibility', e.eligibility,
    'voters_count', (SELECT count(*) FROM public.election_voters v WHERE v.election_id = e.id),
    'ballots_count', CASE WHEN p_with_results THEN (SELECT count(*) FROM public.election_ballots b WHERE b.election_id = e.id) END,
    'has_voted', p_user IS NOT NULL AND EXISTS (SELECT 1 FROM public.election_voters v WHERE v.election_id = e.id AND v.user_id = p_user),
    'is_eligible', p_user IS NOT NULL AND public.election_member_eligible(p_user, e.eligibility),
    'candidates', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'full_name', c.full_name, 'photo_url', c.photo_url, 'photo_path', c.photo_path,
        'bio', c.bio, 'program', c.program, 'sort_order', c.sort_order,
        'votes', CASE WHEN p_with_results THEN (SELECT count(*) FROM public.election_ballots b WHERE b.candidate_id = c.id) END)
        ORDER BY c.sort_order, c.created_at)
      FROM public.election_candidates c WHERE c.election_id = e.id), '[]'::jsonb),
    'created_at', e.created_at, 'updated_at', e.updated_at);
$$;

-- Public list (no drafts). Results only when the admin made them visible.
CREATE OR REPLACE FUNCTION public.elections_public()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(public.election_to_json(e, e.results_visible, auth.uid())
           ORDER BY (e.status = 'closed'), coalesce(e.starts_at, e.created_at) DESC), '[]'::jsonb)
    FROM public.elections e WHERE e.status <> 'draft';
$$;

CREATE OR REPLACE FUNCTION public.election_cast_vote(p_election_id UUID, p_candidate_ids UUID[])
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user UUID := auth.uid(); e public.elections; v_ids UUID[]; v_valid INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'VOTE_LOGIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO e FROM public.elections WHERE id = p_election_id FOR SHARE;
  IF NOT FOUND OR e.status = 'draft' THEN RAISE EXCEPTION 'VOTE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF public.election_phase(e) <> 'open' THEN RAISE EXCEPTION 'VOTE_CLOSED' USING ERRCODE = '22023'; END IF;
  IF NOT public.election_member_eligible(v_user, e.eligibility) THEN RAISE EXCEPTION 'VOTE_NOT_ELIGIBLE' USING ERRCODE = '42501'; END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(coalesce(p_candidate_ids, '{}'::UUID[])) AS x;
  IF v_ids IS NULL OR array_length(v_ids, 1) < 1 OR array_length(v_ids, 1) > e.max_choices THEN
    RAISE EXCEPTION 'VOTE_BAD_CHOICES' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_valid FROM public.election_candidates WHERE election_id = e.id AND id = ANY (v_ids);
  IF v_valid <> array_length(v_ids, 1) THEN RAISE EXCEPTION 'VOTE_BAD_CHOICES' USING ERRCODE = '22023'; END IF;

  BEGIN
    INSERT INTO public.election_voters (election_id, user_id) VALUES (e.id, v_user);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'VOTE_ALREADY_CAST' USING ERRCODE = '23505';
  END;
  INSERT INTO public.election_ballots (election_id, candidate_id) SELECT e.id, unnest(v_ids);
  RETURN jsonb_build_object('success', true);
END $$;

-- Admin side (section 'elections')
CREATE OR REPLACE FUNCTION public.elections_admin_list(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  RETURN coalesce((SELECT jsonb_agg(public.election_to_json(e, true, NULL)
                             || jsonb_build_object('eligible_count', public.election_eligible_count(e.eligibility))
                             ORDER BY e.created_at DESC)
                     FROM public.elections e), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.election_save(p_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); e public.elections; v_votes BIGINT;
  v_max INT := coalesce((p_data->>'max_choices')::int, 1);
  v_elig TEXT := coalesce(nullif(p_data->>'eligibility', ''), 'approved');
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO public.elections (title, description, starts_at, ends_at, max_choices, eligibility, created_by)
    VALUES (btrim(p_data->>'title'), nullif(btrim(coalesce(p_data->>'description', '')), ''),
            nullif(p_data->>'starts_at', '')::timestamptz, nullif(p_data->>'ends_at', '')::timestamptz,
            v_max, v_elig, v_me->>'label')
    RETURNING * INTO e;
  ELSE
    SELECT count(*) INTO v_votes FROM public.election_voters WHERE election_id = p_id;
    SELECT * INTO e FROM public.elections WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF v_votes > 0 AND (v_max <> e.max_choices OR v_elig <> e.eligibility) THEN
      RAISE EXCEPTION 'ELECTION_HAS_VOTES' USING ERRCODE = '22023';
    END IF;
    UPDATE public.elections SET
      title = btrim(p_data->>'title'),
      description = nullif(btrim(coalesce(p_data->>'description', '')), ''),
      starts_at = nullif(p_data->>'starts_at', '')::timestamptz,
      ends_at = nullif(p_data->>'ends_at', '')::timestamptz,
      max_choices = v_max, eligibility = v_elig, updated_at = now()
    WHERE id = p_id RETURNING * INTO e;
  END IF;
  RETURN public.election_to_json(e, true, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.election_set_status(p_id UUID, p_status TEXT, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE e public.elections;
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  IF p_status NOT IN ('draft', 'open', 'closed') THEN RAISE EXCEPTION 'BAD_STATUS' USING ERRCODE = '22023'; END IF;
  IF p_status = 'open' AND NOT EXISTS (SELECT 1 FROM public.election_candidates WHERE election_id = p_id) THEN
    RAISE EXCEPTION 'ELECTION_NO_CANDIDATES' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'draft' AND EXISTS (SELECT 1 FROM public.election_voters WHERE election_id = p_id) THEN
    RAISE EXCEPTION 'ELECTION_HAS_VOTES' USING ERRCODE = '22023';
  END IF;
  UPDATE public.elections SET status = p_status, updated_at = now() WHERE id = p_id RETURNING * INTO e;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN public.election_to_json(e, true, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.election_set_results_visible(p_id UUID, p_visible BOOLEAN, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE e public.elections;
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  UPDATE public.elections SET results_visible = p_visible, updated_at = now() WHERE id = p_id RETURNING * INTO e;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN public.election_to_json(e, true, NULL);
END $$;

-- Returns the candidates' photo paths so the client can remove them from storage.
CREATE OR REPLACE FUNCTION public.election_delete(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_paths TEXT[]; v_status TEXT;
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  SELECT status INTO v_status FROM public.elections WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_status = 'open' THEN RAISE EXCEPTION 'ELECTION_IS_OPEN' USING ERRCODE = '22023'; END IF;
  SELECT array_agg(photo_path) FILTER (WHERE photo_path IS NOT NULL) INTO v_paths
    FROM public.election_candidates WHERE election_id = p_id;
  DELETE FROM public.elections WHERE id = p_id;
  RETURN coalesce(v_paths, '{}'::TEXT[]);
END $$;

CREATE OR REPLACE FUNCTION public.candidate_save(p_id UUID, p_election_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE c public.election_candidates;
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  IF p_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.election_voters WHERE election_id = p_election_id) THEN
      RAISE EXCEPTION 'ELECTION_HAS_VOTES' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.election_candidates (election_id, full_name, photo_url, photo_path, bio, program, sort_order)
    VALUES (p_election_id, btrim(p_data->>'full_name'), nullif(p_data->>'photo_url', ''), nullif(p_data->>'photo_path', ''),
            nullif(btrim(coalesce(p_data->>'bio', '')), ''), nullif(btrim(coalesce(p_data->>'program', '')), ''),
            coalesce((p_data->>'sort_order')::int, 0))
    RETURNING * INTO c;
  ELSE
    UPDATE public.election_candidates SET
      full_name = btrim(p_data->>'full_name'),
      photo_url = CASE WHEN p_data ? 'photo_url' THEN nullif(p_data->>'photo_url', '') ELSE photo_url END,
      photo_path = CASE WHEN p_data ? 'photo_path' THEN nullif(p_data->>'photo_path', '') ELSE photo_path END,
      bio = nullif(btrim(coalesce(p_data->>'bio', '')), ''),
      program = nullif(btrim(coalesce(p_data->>'program', '')), ''),
      sort_order = coalesce((p_data->>'sort_order')::int, sort_order)
    WHERE id = p_id RETURNING * INTO c;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN to_jsonb(c);
END $$;

CREATE OR REPLACE FUNCTION public.candidate_delete(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_path TEXT; v_election UUID;
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  SELECT election_id, photo_path INTO v_election, v_path FROM public.election_candidates WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.election_voters WHERE election_id = v_election) THEN
    RAISE EXCEPTION 'ELECTION_HAS_VOTES' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.election_candidates WHERE id = p_id;
  RETURN v_path;
END $$;

-- ----------------------------------------------------------
-- 5. Member accounts: signup profile creation, duplicates, login help
-- ----------------------------------------------------------
-- Profiles are created by the database from the signup metadata, so registration
-- works even when Supabase does not return a session (e.g. "Confirm email" enabled).
CREATE OR REPLACE FUNCTION public.handle_new_user_safe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m JSONB := coalesce(NEW.raw_user_meta_data, '{}'::jsonb); v_mahaja BOOLEAN := coalesce((m->>'is_mahaja')::boolean, false);
BEGIN
  INSERT INTO public.users (id, full_name, email, phone, membership_type, current_status, location, national_id, approval_status)
  VALUES (
    NEW.id,
    coalesce(nullif(btrim(m->>'full_name'), ''), 'مستخدم جديد'),
    lower(NEW.email),
    coalesce(nullif(public.normalize_phone(m->>'phone'), ''), '20000000'),
    coalesce(nullif(m->>'membership_type', ''), CASE WHEN v_mahaja THEN 'محجة' ELSE 'عضو' END),
    coalesce(nullif(m->>'current_status', ''), CASE WHEN v_mahaja THEN 'طالب علم' ELSE 'لا شيء' END),
    coalesce(m->>'location', ''),
    coalesce(m->>'national_id', CASE WHEN v_mahaja THEN 'N/A' ELSE '' END),
    'Pending Approval')
  ON CONFLICT (id) DO NOTHING;

  -- Optional columns that exist on this project.
  BEGIN
    UPDATE public.users SET
      is_mahaja = v_mahaja,
      date_of_birth = nullif(m->>'date_of_birth', '')::date
    WHERE id = NEW.id;
  EXCEPTION WHEN undefined_column OR invalid_datetime_format THEN NULL;
  END;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'handle_new_user_safe failed for %: %', NEW.id, SQLERRM;
  RETURN NEW; -- never block the auth signup; ensure_my_profile() repairs on first login
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_safe();

-- Before signup: which identifiers are already used? (prevents duplicate accounts)
CREATE OR REPLACE FUNCTION public.member_check_available(p_email TEXT, p_phone TEXT DEFAULT NULL, p_national_id TEXT DEFAULT NULL, p_is_mahaja BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT jsonb_build_object(
    'email_taken', EXISTS (SELECT 1 FROM auth.users a WHERE lower(a.email) = lower(btrim(p_email)))
                   OR EXISTS (SELECT 1 FROM public.users u WHERE lower(u.email) = lower(btrim(p_email))),
    'phone_taken', NOT p_is_mahaja AND length(public.normalize_phone(p_phone)) = 8
                   AND EXISTS (SELECT 1 FROM public.users u
                                WHERE public.normalize_phone(u.phone) = public.normalize_phone(p_phone)
                                  AND coalesce(u.is_mahaja, false) = false
                                  AND u.phone <> '20000000'),
    'national_id_taken', NOT p_is_mahaja AND length(btrim(coalesce(p_national_id, ''))) >= 4
                   AND EXISTS (SELECT 1 FROM public.users u
                                WHERE btrim(u.national_id) = btrim(p_national_id)
                                  AND coalesce(u.is_mahaja, false) = false));
$$;

-- Login help: does an account exist for this email, and is it confirmed?
CREATE OR REPLACE FUNCTION public.member_account_status(p_email TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT coalesce((
    SELECT CASE WHEN a.email_confirmed_at IS NULL THEN 'unconfirmed' ELSE 'active' END
      FROM auth.users a WHERE lower(a.email) = lower(btrim(p_email))
     ORDER BY a.created_at LIMIT 1), 'none');
$$;

-- Creates the caller's missing profile (accounts created before the trigger existed).
CREATE OR REPLACE FUNCTION public.ensure_my_profile(p_data JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE v_user UUID := auth.uid(); a auth.users; m JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_user) THEN RETURN jsonb_build_object('created', false); END IF;
  SELECT * INTO a FROM auth.users WHERE id = v_user;
  m := coalesce(a.raw_user_meta_data, '{}'::jsonb) || coalesce(p_data, '{}'::jsonb);
  INSERT INTO public.users (id, full_name, email, phone, membership_type, current_status, location, national_id, approval_status)
  VALUES (v_user, coalesce(nullif(btrim(m->>'full_name'), ''), 'مستخدم جديد'), lower(a.email),
          coalesce(nullif(public.normalize_phone(m->>'phone'), ''), '20000000'),
          coalesce(nullif(m->>'membership_type', ''), 'عضو'), coalesce(nullif(m->>'current_status', ''), 'لا شيء'),
          coalesce(m->>'location', ''), coalesce(m->>'national_id', ''), 'Pending Approval')
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('created', true);
END $$;

-- Members may edit only these fields of their own profile.
CREATE OR REPLACE FUNCTION public.member_update_profile(p_data JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user UUID := auth.uid(); v_row JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  UPDATE public.users SET
    location = CASE WHEN p_data ? 'location' THEN left(btrim(p_data->>'location'), 120) ELSE location END,
    current_status = CASE WHEN p_data ? 'current_status' THEN left(btrim(p_data->>'current_status'), 60) ELSE current_status END,
    avatar_url = CASE WHEN p_data ? 'avatar_url' THEN nullif(p_data->>'avatar_url', '') ELSE avatar_url END
  WHERE id = v_user;
  SELECT to_jsonb(u) INTO v_row FROM public.users u WHERE u.id = v_user;
  RETURN v_row;
END $$;

-- Repair: create profiles for every auth account that has none (existing data is never overwritten).
DO $$ DECLARE a RECORD; m JSONB; BEGIN
  FOR a IN SELECT au.* FROM auth.users au LEFT JOIN public.users pu ON pu.id = au.id WHERE pu.id IS NULL LOOP
    m := coalesce(a.raw_user_meta_data, '{}'::jsonb);
    BEGIN
      INSERT INTO public.users (id, full_name, email, phone, membership_type, current_status, location, national_id, approval_status)
      VALUES (a.id, coalesce(nullif(btrim(m->>'full_name'), ''), 'مستخدم جديد'), lower(a.email),
              coalesce(nullif(public.normalize_phone(m->>'phone'), ''), '20000000'),
              coalesce(nullif(m->>'membership_type', ''), 'عضو'), coalesce(nullif(m->>'current_status', ''), 'لا شيء'),
              coalesce(m->>'location', ''), coalesce(m->>'national_id', ''), 'Pending Approval')
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create profile for %: %', a.email, SQLERRM;
    END;
  END LOOP;
END $$;

-- ----------------------------------------------------------
-- 6. Grants
-- ----------------------------------------------------------
DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.election_member_eligible(uuid, text)', 'public.election_eligible_count(text)',
    'public.election_to_json(public.elections, boolean, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.public_home_stats()', 'public.normalize_phone(text)',
    'public.projects_admin_list(text)', 'public.project_save(uuid, jsonb, text)', 'public.project_delete(uuid, text)',
    'public.homepage_settings_save(jsonb, text)',
    'public.elections_public()', 'public.election_cast_vote(uuid, uuid[])',
    'public.elections_admin_list(text)', 'public.election_save(uuid, jsonb, text)',
    'public.election_set_status(uuid, text, text)', 'public.election_set_results_visible(uuid, boolean, text)',
    'public.election_delete(uuid, text)', 'public.candidate_save(uuid, uuid, jsonb, text)', 'public.candidate_delete(uuid, text)',
    'public.member_check_available(text, text, text, boolean)', 'public.member_account_status(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.ensure_my_profile(jsonb)', 'public.member_update_profile(jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
