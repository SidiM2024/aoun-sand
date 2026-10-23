-- ==========================================================
-- الانتخابات العامة لجمعية عون وسند: الترشح، المناصب، التصويت لكل منصب، إعلان النتائج
-- General elections: candidacy applications, positions, one vote per position,
-- automatic phases from the server clock, official results announced by an admin.
-- ==========================================================
-- Requires 20261020 / 20261021 / 20261022 (elections). Safe to re-run.
-- Nothing existing is deleted: the current simple ballots keep working as before
-- (they are now "simple" elections; general elections are a new kind).
--
-- Phases (computed from the times saved by the admin, Mauritania time = UTC):
--   setup → nominations_upcoming → nominations (1) → nominations_closed (2)
--   → voting_scheduled (3) → voting (4) → voting_closed (5) → results (5, announced)
-- Every write function re-checks the phase on the server, so nothing can be done
-- outside its time window, whatever the browser sends.
-- ==========================================================

BEGIN;

-- ----------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'simple';
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS nominations_start_at TIMESTAMPTZ;
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS nominations_end_at TIMESTAMPTZ;
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS results_announced_at TIMESTAMPTZ;
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS results_announced_by TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elections_kind_check') THEN
    ALTER TABLE public.elections ADD CONSTRAINT elections_kind_check CHECK (kind IN ('simple', 'general'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.election_positions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id            UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  group_key              TEXT NOT NULL DEFAULT 'other' CHECK (group_key IN ('executive', 'committee', 'other')),
  committee              TEXT,
  role                   TEXT NOT NULL DEFAULT 'other',
  title                  TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),
  sort_order             INTEGER NOT NULL DEFAULT 100,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  winner_application_id  UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (election_id, title)
);
CREATE INDEX IF NOT EXISTS election_positions_election_idx ON public.election_positions (election_id, sort_order);

CREATE TABLE IF NOT EXISTS public.election_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id  UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  position_id  UUID NOT NULL REFERENCES public.election_positions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  full_name    TEXT NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 3 AND 120),
  photo_url    TEXT NOT NULL,
  photo_path   TEXT,
  program      TEXT NOT NULL CHECK (char_length(btrim(program)) BETWEEN 20 AND 5000),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note  TEXT CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  reviewed_by  TEXT,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One application per member and position.
  UNIQUE (position_id, user_id)
);
CREATE INDEX IF NOT EXISTS election_applications_election_idx ON public.election_applications (election_id, status);
CREATE INDEX IF NOT EXISTS election_applications_user_idx ON public.election_applications (user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'election_positions_winner_fkey') THEN
    ALTER TABLE public.election_positions ADD CONSTRAINT election_positions_winner_fkey
      FOREIGN KEY (winner_application_id) REFERENCES public.election_applications(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Who voted for which position (one row per member and position). Not linked to the choice.
CREATE TABLE IF NOT EXISTS public.election_position_voters (
  election_id  UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  position_id  UUID NOT NULL REFERENCES public.election_positions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  voted_on     DATE NOT NULL DEFAULT current_date,
  PRIMARY KEY (position_id, user_id)
);
CREATE INDEX IF NOT EXISTS election_position_voters_election_idx ON public.election_position_voters (election_id, user_id);

-- The choices. Deliberately no voter and no timestamp (secret ballot).
CREATE TABLE IF NOT EXISTS public.election_position_ballots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  position_id     UUID NOT NULL REFERENCES public.election_positions(id) ON DELETE CASCADE,
  application_id  UUID NOT NULL REFERENCES public.election_applications(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS election_position_ballots_idx ON public.election_position_ballots (position_id, application_id);

-- Administrative log (kept even if an election is deleted).
CREATE TABLE IF NOT EXISTS public.election_admin_log (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  election_id  UUID,
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  details      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS election_admin_log_election_idx ON public.election_admin_log (election_id, created_at DESC);

-- No direct access: everything goes through the functions below.
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['election_positions', 'election_applications', 'election_position_voters',
                           'election_position_ballots', 'election_admin_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Votes can never be edited or removed (only together with their election).
DROP TRIGGER IF EXISTS election_position_voters_immutable ON public.election_position_voters;
CREATE TRIGGER election_position_voters_immutable BEFORE UPDATE OR DELETE ON public.election_position_voters
  FOR EACH ROW EXECUTE FUNCTION public.election_votes_immutable();
DROP TRIGGER IF EXISTS election_position_ballots_immutable ON public.election_position_ballots;
CREATE TRIGGER election_position_ballots_immutable BEFORE UPDATE OR DELETE ON public.election_position_ballots
  FOR EACH ROW EXECUTE FUNCTION public.election_votes_immutable();

-- ----------------------------------------------------------
-- 2. Candidate photos (Supabase Storage)
-- ----------------------------------------------------------
-- Members upload into a folder named after their own user id; everyone can view.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('election-photos', 'election-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS election_photos_select ON storage.objects;
DROP POLICY IF EXISTS election_photos_insert ON storage.objects;
DROP POLICY IF EXISTS election_photos_delete ON storage.objects;
CREATE POLICY election_photos_select ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'election-photos');
CREATE POLICY election_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'election-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY election_photos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'election-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------
-- 3. Helpers
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.general_election_phase(e public.elections)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN e.results_announced_at IS NOT NULL THEN 'results'
    WHEN e.starts_at IS NOT NULL AND e.ends_at IS NOT NULL AND now() >= e.ends_at THEN 'voting_closed'
    WHEN e.starts_at IS NOT NULL AND now() >= e.starts_at THEN 'voting'
    WHEN e.nominations_start_at IS NULL THEN 'setup'
    WHEN now() < e.nominations_start_at THEN 'nominations_upcoming'
    WHEN e.nominations_end_at IS NULL OR now() < e.nominations_end_at THEN 'nominations'
    WHEN e.starts_at IS NOT NULL THEN 'voting_scheduled'
    ELSE 'nominations_closed'
  END;
$$;

CREATE OR REPLACE FUNCTION public.general_voting_started(p_phase TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$ SELECT p_phase IN ('voting', 'voting_closed', 'results') $$;

CREATE OR REPLACE FUNCTION public.general_log(p_election UUID, p_actor TEXT, p_action TEXT, p_details JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO public.election_admin_log (election_id, actor, action, details) VALUES (p_election, coalesce(p_actor, '—'), p_action, coalesce(p_details, '{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.general_seed_positions(p_election UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c TEXT; i INT := 0;
BEGIN
  INSERT INTO public.election_positions (election_id, group_key, role, title, sort_order) VALUES
    (p_election, 'executive', 'president', 'الرئيس', 1),
    (p_election, 'executive', 'vice_president', 'نائب الرئيس', 2),
    (p_election, 'executive', 'secretary_general', 'الأمين العام', 3)
  ON CONFLICT (election_id, title) DO NOTHING;
  FOREACH c IN ARRAY ARRAY['اللجنة الانتسابية', 'اللجنة الرقمية', 'اللجنة الإعلامية', 'اللجنة المالية',
                           'اللجنة التعليمية', 'لجنة التنظيم والتنسيق', 'لجنة العلاقات الخارجية', 'لجنة المرضى'] LOOP
    i := i + 1;
    INSERT INTO public.election_positions (election_id, group_key, committee, role, title, sort_order) VALUES
      (p_election, 'committee', c, 'head', 'مسؤول ' || c, 10 + i * 2),
      (p_election, 'committee', c, 'deputy', 'نائب مسؤول ' || c, 11 + i * 2)
    ON CONFLICT (election_id, title) DO NOTHING;
  END LOOP;
END $$;

-- Votes per approved candidate of a position, with rank info.
CREATE OR REPLACE FUNCTION public.general_position_tally(p_position UUID)
RETURNS TABLE (application_id UUID, votes BIGINT) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT a.id, (SELECT count(*) FROM public.election_position_ballots b WHERE b.application_id = a.id)
    FROM public.election_applications a
   WHERE a.position_id = p_position AND a.status = 'approved';
$$;

-- Full JSON of a general election. p_admin = dashboard view (everything);
-- otherwise what members may see in the current phase.
CREATE OR REPLACE FUNCTION public.general_election_to_json(e public.elections, p_admin BOOLEAN, p_user UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phase TEXT := public.general_election_phase(e);
  v_show_candidates BOOLEAN := p_admin OR v_phase IN ('nominations_closed', 'voting_scheduled', 'voting', 'voting_closed', 'results');
  v_show_results BOOLEAN := p_admin OR v_phase = 'results';
  v_positions JSONB;
  v_my JSONB := NULL;
BEGIN
  SELECT coalesce(jsonb_agg(pj ORDER BY (pj->>'sort_order')::int, pj->>'title'), '[]'::jsonb) INTO v_positions
  FROM (
    SELECT jsonb_build_object(
      'id', p.id, 'title', p.title, 'group_key', p.group_key, 'committee', p.committee, 'role', p.role,
      'sort_order', p.sort_order, 'is_active', p.is_active,
      'candidates_count', CASE WHEN v_show_candidates THEN (SELECT count(*) FROM public.election_applications a WHERE a.position_id = p.id AND a.status = 'approved') END,
      'pending_count', CASE WHEN p_admin THEN (SELECT count(*) FROM public.election_applications a WHERE a.position_id = p.id AND a.status = 'pending') END,
      'voters_count', CASE WHEN v_show_results THEN (SELECT count(*) FROM public.election_position_voters v WHERE v.position_id = p.id) END,
      'top_votes', CASE WHEN v_show_results THEN t.top END,
      'tie', CASE WHEN v_show_results THEN (t.top > 0 AND t.top_n > 1 AND p.winner_application_id IS NULL) END,
      'winner_application_id', CASE WHEN v_show_results THEN
          coalesce(p.winner_application_id, CASE WHEN t.top > 0 AND t.top_n = 1 THEN t.top_id END) END,
      'tie_resolved', CASE WHEN v_show_results THEN p.winner_application_id IS NOT NULL END,
      'candidates', CASE WHEN v_show_candidates THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', a.id, 'full_name', a.full_name, 'photo_url', a.photo_url, 'program', a.program,
          'votes', CASE WHEN v_show_results THEN tl.votes END)
          ORDER BY CASE WHEN v_show_results THEN tl.votes END DESC NULLS LAST, a.full_name)
        FROM public.election_applications a
        JOIN public.general_position_tally(p.id) tl ON tl.application_id = a.id
        WHERE a.position_id = p.id AND a.status = 'approved'), '[]'::jsonb) ELSE '[]'::jsonb END
    ) AS pj
    FROM public.election_positions p
    LEFT JOIN LATERAL (
      SELECT max(x.votes) AS top,
             count(*) FILTER (WHERE x.votes = (SELECT max(y.votes) FROM public.general_position_tally(p.id) y)) AS top_n,
             (array_agg(x.application_id ORDER BY x.votes DESC))[1] AS top_id
        FROM public.general_position_tally(p.id) x
    ) t ON v_show_results
    WHERE p.election_id = e.id AND (p_admin OR p.is_active)
  ) s;

  IF p_user IS NOT NULL THEN
    v_my := jsonb_build_object(
      'can_apply', public.election_member_eligible(p_user, 'registered'),
      'can_vote', public.election_member_eligible(p_user, e.eligibility),
      'voted_position_ids', coalesce((SELECT jsonb_agg(v.position_id) FROM public.election_position_voters v
                                       WHERE v.election_id = e.id AND v.user_id = p_user), '[]'::jsonb),
      'applications', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', a.id, 'position_id', a.position_id, 'position_title', p.title, 'status', a.status,
          'review_note', a.review_note, 'full_name', a.full_name, 'photo_url', a.photo_url, 'photo_path', a.photo_path,
          'program', a.program, 'created_at', a.created_at) ORDER BY a.created_at)
        FROM public.election_applications a JOIN public.election_positions p ON p.id = a.position_id
        WHERE a.election_id = e.id AND a.user_id = p_user), '[]'::jsonb));
  END IF;

  RETURN jsonb_build_object(
    'id', e.id, 'kind', 'general', 'title', e.title, 'description', e.description, 'eligibility', e.eligibility,
    'is_published', e.is_published, 'phase', v_phase, 'server_now', now(),
    'nominations_start_at', e.nominations_start_at, 'nominations_end_at', e.nominations_end_at,
    'voting_start_at', e.starts_at, 'voting_end_at', e.ends_at,
    'results_announced_at', e.results_announced_at,
    'voters_total', CASE WHEN p_admin OR public.general_voting_started(v_phase)
                         THEN (SELECT count(DISTINCT v.user_id) FROM public.election_position_voters v WHERE v.election_id = e.id) END,
    'eligible_count', public.election_eligible_count(e.eligibility),
    'positions', v_positions,
    'my', v_my,
    'created_at', e.created_at, 'updated_at', e.updated_at);
END $$;

-- ----------------------------------------------------------
-- 4. Members: read, apply, withdraw, vote
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.general_elections_public()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(public.general_election_to_json(e, false, auth.uid()) ORDER BY e.created_at DESC), '[]'::jsonb)
    FROM public.elections e
   WHERE e.kind = 'general' AND e.is_published;
$$;

-- p_data: { full_name, photo_url, photo_path, program }
CREATE OR REPLACE FUNCTION public.election_apply(p_election_id UUID, p_position_id UUID, p_data JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user UUID := auth.uid(); e public.elections; a public.election_applications;
  v_path TEXT := nullif(btrim(coalesce(p_data->>'photo_path', '')), '');
  v_url TEXT := nullif(btrim(coalesce(p_data->>'photo_url', '')), '');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'APPLY_LOGIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO e FROM public.elections WHERE id = p_election_id AND kind = 'general' AND is_published FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ELECTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF public.general_election_phase(e) <> 'nominations' THEN RAISE EXCEPTION 'APPLY_CLOSED' USING ERRCODE = '22023'; END IF;
  IF NOT public.election_member_eligible(v_user, 'registered') THEN RAISE EXCEPTION 'APPLY_NOT_ELIGIBLE' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.election_positions WHERE id = p_position_id AND election_id = e.id AND is_active) THEN
    RAISE EXCEPTION 'APPLY_BAD_POSITION' USING ERRCODE = '22023';
  END IF;
  -- The photo must be one this member uploaded to the candidates' bucket.
  IF v_url IS NULL OR v_path IS NULL OR split_part(v_path, '/', 1) <> v_user::text THEN
    RAISE EXCEPTION 'APPLY_PHOTO_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(coalesce(p_data->>'full_name', ''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'APPLY_BAD_NAME' USING ERRCODE = '22023'; END IF;
  IF char_length(btrim(coalesce(p_data->>'program', ''))) NOT BETWEEN 20 AND 5000 THEN RAISE EXCEPTION 'APPLY_BAD_PROGRAM' USING ERRCODE = '22023'; END IF;

  BEGIN
    INSERT INTO public.election_applications (election_id, position_id, user_id, full_name, photo_url, photo_path, program)
    VALUES (e.id, p_position_id, v_user, btrim(p_data->>'full_name'), v_url, v_path, btrim(p_data->>'program'))
    RETURNING * INTO a;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'APPLY_DUPLICATE' USING ERRCODE = '23505';
  END;
  RETURN jsonb_build_object('id', a.id, 'status', a.status);
END $$;

-- A member may withdraw a pending application while nominations are open.
-- Returns the photo path so the browser can remove the file.
CREATE OR REPLACE FUNCTION public.election_application_withdraw(p_application_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user UUID := auth.uid(); a public.election_applications; e public.elections;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'APPLY_LOGIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.election_applications WHERE id = p_application_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO e FROM public.elections WHERE id = a.election_id;
  IF a.status <> 'pending' OR public.general_election_phase(e) <> 'nominations' THEN
    RAISE EXCEPTION 'APPLY_CLOSED' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.election_applications WHERE id = a.id;
  RETURN a.photo_path;
END $$;

-- One vote per member and position; atomic (primary key on voters), cannot be changed.
CREATE OR REPLACE FUNCTION public.election_vote_position(p_election_id UUID, p_position_id UUID, p_application_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user UUID := auth.uid(); e public.elections; v_phase TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'VOTE_LOGIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO e FROM public.elections WHERE id = p_election_id AND kind = 'general' AND is_published FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOTE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  v_phase := public.general_election_phase(e);
  IF v_phase <> 'voting' THEN
    RAISE EXCEPTION '%', CASE WHEN public.general_voting_started(v_phase) THEN 'VOTE_CLOSED' ELSE 'VOTE_NOT_STARTED' END USING ERRCODE = '22023';
  END IF;
  IF NOT public.election_member_eligible(v_user, e.eligibility) THEN RAISE EXCEPTION 'VOTE_NOT_ELIGIBLE' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.election_positions WHERE id = p_position_id AND election_id = e.id AND is_active) OR
     NOT EXISTS (SELECT 1 FROM public.election_applications WHERE id = p_application_id AND position_id = p_position_id AND status = 'approved') THEN
    RAISE EXCEPTION 'VOTE_BAD_CHOICES' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.election_position_voters (election_id, position_id, user_id) VALUES (e.id, p_position_id, v_user);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'VOTE_ALREADY_CAST' USING ERRCODE = '23505';
  END;
  INSERT INTO public.election_position_ballots (election_id, position_id, application_id) VALUES (e.id, p_position_id, p_application_id);
  RETURN jsonb_build_object('success', true);
END $$;

-- ----------------------------------------------------------
-- 5. Dashboard (section «الانتخابات»)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.general_elections_admin_list(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', e.id, 'title', e.title, 'phase', public.general_election_phase(e), 'is_published', e.is_published,
      'pending', (SELECT count(*) FROM public.election_applications a WHERE a.election_id = e.id AND a.status = 'pending'),
      'approved', (SELECT count(*) FROM public.election_applications a WHERE a.election_id = e.id AND a.status = 'approved'),
      'created_at', e.created_at) ORDER BY e.created_at DESC)
    FROM public.elections e WHERE e.kind = 'general'), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.general_election_admin_get(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE e public.elections;
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  SELECT * INTO e FROM public.elections WHERE id = p_id AND kind = 'general';
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN public.general_election_to_json(e, true, NULL) || jsonb_build_object(
    'applications', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'position_id', a.position_id, 'position_title', p.title, 'user_id', a.user_id,
        'account_name', u.full_name, 'account_email', u.email, 'account_phone', u.phone,
        'full_name', a.full_name, 'photo_url', a.photo_url, 'program', a.program, 'status', a.status,
        'review_note', a.review_note, 'reviewed_by', a.reviewed_by, 'reviewed_at', a.reviewed_at, 'created_at', a.created_at)
        ORDER BY a.created_at)
      FROM public.election_applications a
      JOIN public.election_positions p ON p.id = a.position_id
      LEFT JOIN public.users u ON u.id = a.user_id
      WHERE a.election_id = e.id), '[]'::jsonb),
    'log', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC)
      FROM (SELECT * FROM public.election_admin_log WHERE election_id = e.id ORDER BY created_at DESC LIMIT 300) l), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.general_election_create(p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); e public.elections;
BEGIN
  INSERT INTO public.elections (kind, title, description, eligibility, status, results_visible, is_published, created_by)
  VALUES ('general', btrim(p_data->>'title'), nullif(btrim(coalesce(p_data->>'description', '')), ''),
          coalesce(nullif(p_data->>'eligibility', ''), 'approved'), 'draft', false, true, v_me->>'label')
  RETURNING * INTO e;
  PERFORM public.general_seed_positions(e.id);
  PERFORM public.general_log(e.id, v_me->>'label', 'created', jsonb_build_object('title', e.title));
  RETURN jsonb_build_object('id', e.id);
END $$;

-- Title, description, voter eligibility and all dates. The server validates the order of
-- the phases and refuses changes that would rewrite an election that has started voting.
CREATE OR REPLACE FUNCTION public.general_election_save(p_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_me JSONB := public.admin_require_section(p_token, 'elections');
  e public.elections; v_phase TEXT;
  n_start TIMESTAMPTZ := nullif(p_data->>'nominations_start_at', '')::timestamptz;
  n_end   TIMESTAMPTZ := nullif(p_data->>'nominations_end_at', '')::timestamptz;
  v_start TIMESTAMPTZ := nullif(p_data->>'voting_start_at', '')::timestamptz;
  v_end   TIMESTAMPTZ := nullif(p_data->>'voting_end_at', '')::timestamptz;
  v_elig  TEXT := coalesce(nullif(p_data->>'eligibility', ''), 'approved');
BEGIN
  SELECT * INTO e FROM public.elections WHERE id = p_id AND kind = 'general' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  v_phase := public.general_election_phase(e);

  IF n_start IS NOT NULL AND n_end IS NULL THEN RAISE EXCEPTION 'SCHEDULE_NOMINATIONS_END_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF n_end IS NOT NULL AND (n_start IS NULL OR n_end <= n_start) THEN RAISE EXCEPTION 'SCHEDULE_BAD_NOMINATIONS' USING ERRCODE = '22023'; END IF;
  IF (v_start IS NULL) <> (v_end IS NULL) THEN RAISE EXCEPTION 'SCHEDULE_VOTING_BOTH_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF v_start IS NOT NULL AND v_end <= v_start THEN RAISE EXCEPTION 'SCHEDULE_BAD_VOTING' USING ERRCODE = '22023'; END IF;
  IF v_start IS NOT NULL AND (n_end IS NULL OR v_start < n_end) THEN RAISE EXCEPTION 'SCHEDULE_VOTING_BEFORE_NOMINATIONS_END' USING ERRCODE = '22023'; END IF;

  IF public.general_voting_started(v_phase) THEN
    -- Voting has started: only the end of voting may move (and only while voting is open).
    IF n_start IS DISTINCT FROM e.nominations_start_at OR n_end IS DISTINCT FROM e.nominations_end_at
       OR v_start IS DISTINCT FROM e.starts_at OR v_elig IS DISTINCT FROM e.eligibility
       OR (v_phase <> 'voting' AND v_end IS DISTINCT FROM e.ends_at) THEN
      RAISE EXCEPTION 'SCHEDULE_LOCKED' USING ERRCODE = '22023';
    END IF;
    IF v_end IS DISTINCT FROM e.ends_at AND v_end <= now() THEN RAISE EXCEPTION 'SCHEDULE_BAD_VOTING' USING ERRCODE = '22023'; END IF;
  END IF;

  UPDATE public.elections SET
    title = btrim(coalesce(p_data->>'title', title)),
    description = CASE WHEN p_data ? 'description' THEN nullif(btrim(coalesce(p_data->>'description', '')), '') ELSE description END,
    eligibility = v_elig,
    nominations_start_at = n_start, nominations_end_at = n_end,
    starts_at = v_start, ends_at = v_end, updated_at = now()
  WHERE id = p_id RETURNING * INTO e;

  PERFORM public.general_log(e.id, v_me->>'label', 'schedule_saved', jsonb_build_object(
    'nominations_start_at', n_start, 'nominations_end_at', n_end, 'voting_start_at', v_start, 'voting_end_at', v_end,
    'eligibility', v_elig, 'phase', public.general_election_phase(e)));
  RETURN public.general_election_admin_get(p_id, p_token);
END $$;

-- close_nominations | close_voting | announce | unannounce | publish | unpublish
CREATE OR REPLACE FUNCTION public.general_election_action(p_id UUID, p_action TEXT, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); e public.elections; v_phase TEXT;
BEGIN
  SELECT * INTO e FROM public.elections WHERE id = p_id AND kind = 'general' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  v_phase := public.general_election_phase(e);
  CASE p_action
    WHEN 'close_nominations' THEN
      IF v_phase <> 'nominations' THEN RAISE EXCEPTION 'ACTION_WRONG_PHASE' USING ERRCODE = '22023'; END IF;
      UPDATE public.elections SET nominations_end_at = now(), updated_at = now() WHERE id = p_id;
    WHEN 'close_voting' THEN
      IF v_phase <> 'voting' THEN RAISE EXCEPTION 'ACTION_WRONG_PHASE' USING ERRCODE = '22023'; END IF;
      UPDATE public.elections SET ends_at = now(), updated_at = now() WHERE id = p_id;
    WHEN 'announce' THEN
      IF v_phase <> 'voting_closed' THEN RAISE EXCEPTION 'ACTION_WRONG_PHASE' USING ERRCODE = '22023'; END IF;
      UPDATE public.elections SET results_announced_at = now(), results_announced_by = v_me->>'label', updated_at = now() WHERE id = p_id;
    WHEN 'unannounce' THEN
      IF v_phase <> 'results' THEN RAISE EXCEPTION 'ACTION_WRONG_PHASE' USING ERRCODE = '22023'; END IF;
      UPDATE public.elections SET results_announced_at = NULL, results_announced_by = NULL, updated_at = now() WHERE id = p_id;
    WHEN 'publish' THEN UPDATE public.elections SET is_published = true, updated_at = now() WHERE id = p_id;
    WHEN 'unpublish' THEN UPDATE public.elections SET is_published = false, updated_at = now() WHERE id = p_id;
    ELSE RAISE EXCEPTION 'BAD_ACTION' USING ERRCODE = '22023';
  END CASE;
  PERFORM public.general_log(p_id, v_me->>'label', p_action, jsonb_build_object('phase_before', v_phase));
  RETURN public.general_election_admin_get(p_id, p_token);
END $$;

-- Positions (p_id NULL = new custom position). Locked once voting has started.
CREATE OR REPLACE FUNCTION public.general_position_save(p_election_id UUID, p_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); e public.elections; p public.election_positions;
BEGIN
  SELECT * INTO e FROM public.elections WHERE id = p_election_id AND kind = 'general' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF public.general_voting_started(public.general_election_phase(e)) THEN RAISE EXCEPTION 'POSITIONS_LOCKED' USING ERRCODE = '22023'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.election_positions (election_id, group_key, committee, role, title, sort_order, is_active)
    VALUES (e.id, coalesce(nullif(p_data->>'group_key', ''), 'other'), nullif(btrim(coalesce(p_data->>'committee', '')), ''),
            'other', btrim(p_data->>'title'), coalesce((p_data->>'sort_order')::int, 100), coalesce((p_data->>'is_active')::boolean, true))
    RETURNING * INTO p;
  ELSE
    UPDATE public.election_positions SET
      title = CASE WHEN p_data ? 'title' THEN btrim(p_data->>'title') ELSE title END,
      sort_order = coalesce((p_data->>'sort_order')::int, sort_order),
      is_active = coalesce((p_data->>'is_active')::boolean, is_active)
    WHERE id = p_id AND election_id = e.id RETURNING * INTO p;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  END IF;
  PERFORM public.general_log(e.id, v_me->>'label', CASE WHEN p_id IS NULL THEN 'position_added' ELSE 'position_updated' END,
                             jsonb_build_object('title', p.title, 'is_active', p.is_active));
  RETURN to_jsonb(p);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'POSITION_DUPLICATE' USING ERRCODE = '23505';
END $$;

CREATE OR REPLACE FUNCTION public.general_position_delete(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); p public.election_positions; e public.elections;
BEGIN
  SELECT * INTO p FROM public.election_positions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO e FROM public.elections WHERE id = p.election_id FOR UPDATE;
  IF public.general_voting_started(public.general_election_phase(e)) THEN RAISE EXCEPTION 'POSITIONS_LOCKED' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.election_applications WHERE position_id = p_id) THEN RAISE EXCEPTION 'POSITION_HAS_APPLICATIONS' USING ERRCODE = '22023'; END IF;
  DELETE FROM public.election_positions WHERE id = p_id;
  PERFORM public.general_log(e.id, v_me->>'label', 'position_deleted', jsonb_build_object('title', p.title));
END $$;

-- Review: pending | approved | rejected. Locked once voting has started.
CREATE OR REPLACE FUNCTION public.general_application_review(p_id UUID, p_status TEXT, p_note TEXT DEFAULT NULL, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); a public.election_applications; e public.elections; v_prev TEXT;
BEGIN
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN RAISE EXCEPTION 'BAD_STATUS' USING ERRCODE = '22023'; END IF;
  SELECT * INTO a FROM public.election_applications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO e FROM public.elections WHERE id = a.election_id;
  IF public.general_voting_started(public.general_election_phase(e)) THEN RAISE EXCEPTION 'REVIEW_LOCKED' USING ERRCODE = '22023'; END IF;
  v_prev := a.status;
  UPDATE public.election_applications SET status = p_status,
    review_note = nullif(btrim(coalesce(p_note, '')), ''),
    reviewed_by = CASE WHEN p_status = 'pending' THEN NULL ELSE v_me->>'label' END,
    reviewed_at = CASE WHEN p_status = 'pending' THEN NULL ELSE now() END,
    updated_at = now()
  WHERE id = p_id RETURNING * INTO a;
  PERFORM public.general_log(e.id, v_me->>'label', 'application_' || p_status, jsonb_build_object(
    'candidate', a.full_name, 'position', (SELECT title FROM public.election_positions WHERE id = a.position_id),
    'previous', v_prev, 'note', a.review_note));
  RETURN to_jsonb(a);
END $$;

-- Ties are never decided automatically: an admin records the decision taken under the
-- association's rules (NULL clears it). Only after voting has closed, only among the tied.
CREATE OR REPLACE FUNCTION public.general_position_resolve_tie(p_position_id UUID, p_application_id UUID, p_token TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); p public.election_positions; e public.elections; v_top BIGINT;
BEGIN
  SELECT * INTO p FROM public.election_positions WHERE id = p_position_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO e FROM public.elections WHERE id = p.election_id;
  IF public.general_election_phase(e) NOT IN ('voting_closed', 'results') THEN RAISE EXCEPTION 'ACTION_WRONG_PHASE' USING ERRCODE = '22023'; END IF;
  SELECT max(votes) INTO v_top FROM public.general_position_tally(p.id);
  IF p_application_id IS NOT NULL THEN
    IF coalesce(v_top, 0) = 0 OR (SELECT count(*) FROM public.general_position_tally(p.id) WHERE votes = v_top) < 2
       OR NOT EXISTS (SELECT 1 FROM public.general_position_tally(p.id) WHERE application_id = p_application_id AND votes = v_top) THEN
      RAISE EXCEPTION 'TIE_NOT_FOUND' USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.election_positions SET winner_application_id = p_application_id WHERE id = p.id;
  PERFORM public.general_log(e.id, v_me->>'label', CASE WHEN p_application_id IS NULL THEN 'tie_cleared' ELSE 'tie_resolved' END,
    jsonb_build_object('position', p.title, 'winner', (SELECT full_name FROM public.election_applications WHERE id = p_application_id)));
END $$;

-- Delete a general election (not while voting is open). Returns photo paths to remove.
CREATE OR REPLACE FUNCTION public.general_election_delete(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); e public.elections; v_paths TEXT[];
BEGIN
  SELECT * INTO e FROM public.elections WHERE id = p_id AND kind = 'general' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF public.general_election_phase(e) = 'voting' THEN RAISE EXCEPTION 'ELECTION_IS_OPEN' USING ERRCODE = '22023'; END IF;
  SELECT array_agg(photo_path) FILTER (WHERE photo_path IS NOT NULL) INTO v_paths FROM public.election_applications WHERE election_id = p_id;
  PERFORM public.general_log(p_id, v_me->>'label', 'deleted', jsonb_build_object('title', e.title));
  DELETE FROM public.elections WHERE id = p_id;
  RETURN coalesce(v_paths, '{}'::TEXT[]);
END $$;

-- ----------------------------------------------------------
-- 6. Simple ballots: keep them separate from general elections
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.elections_public()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(public.election_to_json(e, e.results_visible, auth.uid())
           ORDER BY (e.status = 'closed'), (e.status = 'draft'), coalesce(e.starts_at, e.created_at) DESC), '[]'::jsonb)
    FROM public.elections e WHERE e.is_published AND e.kind = 'simple';
$$;

CREATE OR REPLACE FUNCTION public.elections_admin_list(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  RETURN coalesce((SELECT jsonb_agg(public.election_to_json(e, true, NULL)
                             || jsonb_build_object('eligible_count', public.election_eligible_count(e.eligibility))
                             ORDER BY e.created_at DESC)
                     FROM public.elections e WHERE e.kind = 'simple'), '[]'::jsonb);
END $$;

-- ----------------------------------------------------------
-- 7. Grants
-- ----------------------------------------------------------
DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.general_log(uuid, text, text, jsonb)', 'public.general_seed_positions(uuid)',
    'public.general_position_tally(uuid)', 'public.general_election_to_json(public.elections, boolean, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.general_elections_public()', 'public.elections_public()', 'public.elections_admin_list(text)',
    'public.general_elections_admin_list(text)', 'public.general_election_admin_get(uuid, text)',
    'public.general_election_create(jsonb, text)', 'public.general_election_save(uuid, jsonb, text)',
    'public.general_election_action(uuid, text, text)', 'public.general_position_save(uuid, uuid, jsonb, text)',
    'public.general_position_delete(uuid, text)', 'public.general_application_review(uuid, text, text, text)',
    'public.general_position_resolve_tie(uuid, uuid, text)', 'public.general_election_delete(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
  -- Member actions need a signed-in account.
  FOREACH f IN ARRAY ARRAY[
    'public.election_apply(uuid, uuid, jsonb)', 'public.election_application_withdraw(uuid)',
    'public.election_vote_position(uuid, uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
