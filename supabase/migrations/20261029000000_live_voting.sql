-- ==========================================================
-- التصويت الإلكتروني: نتائج مباشرة، صور المترشحين في ورقة التصويت، تصويت كل الأعضاء المسجلين،
-- وتثبيت مساحة صور المترشحين
-- Live voting: live vote counts, candidate photos on the ballot, every registered member votes,
-- and the candidates' photo storage re-asserted.
-- ==========================================================
-- Requires 20261024 … 20261028. Safe to re-run. No vote, application or account is deleted.
--
-- * elections.live_results (default true): vote counts are shown to everyone as soon as voting
--   starts, refreshed automatically by the page. The dashboard can turn it off (then counts
--   appear only when the results are announced).
-- * The ballot shows each candidate's photo, name and position (programmes stay hidden while
--   voting is open). total_votes = number of votes cast in the election.
-- * Every registered member (not only approved members) can vote: general elections that have
--   not announced their results switch to eligibility 'registered'; it is the new default.
-- * One vote per member and position: unchanged (primary key on election_position_voters).
-- * Candidate photos: bucket «election-photos» and its policies are created again if missing.
-- ==========================================================

BEGIN;

ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS live_results BOOLEAN NOT NULL DEFAULT true;

UPDATE public.elections SET eligibility = 'registered', updated_at = now()
 WHERE kind = 'general' AND results_announced_at IS NULL AND eligibility IS DISTINCT FROM 'registered';

CREATE OR REPLACE FUNCTION public.general_election_to_json(e public.elections, p_admin BOOLEAN, p_user UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phase TEXT := public.general_election_phase(e);
  -- Approved candidates are visible to everyone in every phase. While voting is open the
  -- ballot shows each candidate's photo, name and position; the programmes are not shown.
  v_show_candidates BOOLEAN := true;
  v_cards_hidden BOOLEAN := NOT p_admin AND v_phase = 'voting';
  -- Vote counts: live once voting has started (if the election shows live results),
  -- otherwise only after the official announcement. The dashboard always sees them.
  v_live BOOLEAN := coalesce(e.live_results, true) AND public.general_voting_started(v_phase);
  v_show_results BOOLEAN := p_admin OR v_phase = 'results' OR v_live;
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
          'id', a.id, 'full_name', a.full_name,
          'photo_url', a.photo_url,
          'program', CASE WHEN v_cards_hidden THEN NULL ELSE a.program END,
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
    'is_published', e.is_published, 'phase', v_phase, 'server_now', now(), 'cards_hidden', v_cards_hidden,
    'live_results', coalesce(e.live_results, true), 'results_visible', v_show_results,
    'total_votes', CASE WHEN p_admin OR public.general_voting_started(v_phase)
                        THEN (SELECT count(*) FROM public.election_position_ballots b
                                JOIN public.election_positions bp ON bp.id = b.position_id
                               WHERE b.election_id = e.id AND (p_admin OR bp.is_active)) END,
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
  v_elig  TEXT := coalesce(nullif(p_data->>'eligibility', ''), 'registered');
  v_live  BOOLEAN;
BEGIN
  SELECT * INTO e FROM public.elections WHERE id = p_id AND kind = 'general' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  v_phase := public.general_election_phase(e);
  v_live := coalesce((p_data->>'live_results')::boolean, e.live_results, true);

  IF n_start IS NOT NULL AND n_end IS NULL THEN RAISE EXCEPTION 'SCHEDULE_NOMINATIONS_END_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF n_end IS NOT NULL AND (n_start IS NULL OR n_end <= n_start) THEN RAISE EXCEPTION 'SCHEDULE_BAD_NOMINATIONS' USING ERRCODE = '22023'; END IF;
  IF v_start IS NULL AND v_end IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_VOTING_BOTH_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF v_start IS NOT NULL AND v_end <= v_start THEN RAISE EXCEPTION 'SCHEDULE_BAD_VOTING' USING ERRCODE = '22023'; END IF;
  IF v_start IS NOT NULL AND (n_end IS NULL OR v_start < n_end) THEN RAISE EXCEPTION 'SCHEDULE_VOTING_BEFORE_NOMINATIONS_END' USING ERRCODE = '22023'; END IF;

  IF public.general_voting_started(v_phase) THEN
    -- Voting has started: only the end of voting may move (and only while voting is open).
    IF n_start IS DISTINCT FROM e.nominations_start_at OR n_end IS DISTINCT FROM e.nominations_end_at
       OR v_start IS DISTINCT FROM e.starts_at OR v_elig IS DISTINCT FROM e.eligibility
       OR (v_phase <> 'voting' AND v_end IS DISTINCT FROM e.ends_at) THEN
      RAISE EXCEPTION 'SCHEDULE_LOCKED' USING ERRCODE = '22023';
    END IF;
    IF v_end IS DISTINCT FROM e.ends_at AND v_end IS NOT NULL AND v_end <= now() THEN RAISE EXCEPTION 'SCHEDULE_BAD_VOTING' USING ERRCODE = '22023'; END IF;
  END IF;

  UPDATE public.elections SET
    title = btrim(coalesce(p_data->>'title', title)),
    description = CASE WHEN p_data ? 'description' THEN nullif(btrim(coalesce(p_data->>'description', '')), '') ELSE description END,
    eligibility = v_elig,
    nominations_start_at = n_start, nominations_end_at = n_end,
    starts_at = v_start, ends_at = v_end, live_results = v_live, updated_at = now()
  WHERE id = p_id RETURNING * INTO e;

  PERFORM public.general_log(e.id, v_me->>'label', 'schedule_saved', jsonb_build_object(
    'nominations_start_at', n_start, 'nominations_end_at', n_end, 'voting_start_at', v_start, 'voting_end_at', v_end,
    'eligibility', v_elig, 'live_results', v_live, 'phase', public.general_election_phase(e)));
  RETURN public.general_election_admin_get(p_id, p_token);
END $$;

CREATE OR REPLACE FUNCTION public.general_election_create(p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); e public.elections;
BEGIN
  INSERT INTO public.elections (kind, title, description, eligibility, status, results_visible, is_published, created_by, live_results)
  VALUES ('general', btrim(p_data->>'title'), nullif(btrim(coalesce(p_data->>'description', '')), ''),
          coalesce(nullif(p_data->>'eligibility', ''), 'registered'), 'draft', false, true, v_me->>'label',
          coalesce((p_data->>'live_results')::boolean, true))
  RETURNING * INTO e;
  PERFORM public.general_seed_positions(e.id);
  PERFORM public.general_log(e.id, v_me->>'label', 'created', jsonb_build_object('title', e.title));
  RETURN jsonb_build_object('id', e.id);
END $$;

REVOKE ALL ON FUNCTION public.general_election_to_json(public.elections, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.general_election_save(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_election_save(uuid, jsonb, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.general_election_create(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_election_create(jsonb, text) TO anon, authenticated;

COMMIT;

-- Candidate photos (storage). Separate from the transaction above: on projects where the SQL
-- role cannot manage storage, the elections part still applies and a notice explains what to do.
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('election-photos', 'election-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
  ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

  DROP POLICY IF EXISTS election_photos_select ON storage.objects;
  DROP POLICY IF EXISTS election_photos_insert ON storage.objects;
  DROP POLICY IF EXISTS election_photos_delete ON storage.objects;
  CREATE POLICY election_photos_select ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'election-photos');
  CREATE POLICY election_photos_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'election-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY election_photos_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'election-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN insufficient_privilege OR undefined_table OR invalid_schema_name THEN
  RAISE NOTICE 'Storage not configurable from here: create the public bucket "election-photos" in Storage.';
END $$;

NOTIFY pgrst, 'reload schema';
