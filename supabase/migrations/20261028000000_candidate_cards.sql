-- ==========================================================
-- بطاقات المترشحين للجميع + مرحلة التصويت بقرار المشرف
-- Candidate cards visible to everyone; voting phase controlled by the admin.
-- ==========================================================
-- Requires 20261024000000_general_elections.sql. Safe to re-run. No data changed or deleted.
--
-- * Approved candidates are listed (card: photo, name, position, programme) for every
--   member in every phase, so candidates who applied earlier find their card right away.
-- * While voting is open, members only receive the candidates' names (no photos, no
--   programmes): the page shows the voting form only.
-- * «فتح التصويت الآن» (admin): ends nominations and opens voting immediately; voting stays
--   open until the admin closes it (or until an end time the admin set).
-- * Public card (shared links): election_candidate_card(id), readable without an account.
-- * Votes: unchanged — one vote per member and position (primary key), cannot be changed.
-- ==========================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.general_election_to_json(e public.elections, p_admin BOOLEAN, p_user UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phase TEXT := public.general_election_phase(e);
  -- Approved candidates are visible to everyone in every phase (their cards), except that
  -- while voting is open members only get the names: no photos and no programmes.
  v_show_candidates BOOLEAN := true;
  v_cards_hidden BOOLEAN := NOT p_admin AND v_phase = 'voting';
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
          'id', a.id, 'full_name', a.full_name,
          'photo_url', CASE WHEN v_cards_hidden THEN NULL ELSE a.photo_url END,
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
  v_elig  TEXT := coalesce(nullif(p_data->>'eligibility', ''), 'approved');
BEGIN
  SELECT * INTO e FROM public.elections WHERE id = p_id AND kind = 'general' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  v_phase := public.general_election_phase(e);

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
    starts_at = v_start, ends_at = v_end, updated_at = now()
  WHERE id = p_id RETURNING * INTO e;

  PERFORM public.general_log(e.id, v_me->>'label', 'schedule_saved', jsonb_build_object(
    'nominations_start_at', n_start, 'nominations_end_at', n_end, 'voting_start_at', v_start, 'voting_end_at', v_end,
    'eligibility', v_elig, 'phase', public.general_election_phase(e)));
  RETURN public.general_election_admin_get(p_id, p_token);
END $$;

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
    WHEN 'open_voting' THEN
      IF public.general_voting_started(v_phase) THEN RAISE EXCEPTION 'ACTION_WRONG_PHASE' USING ERRCODE = '22023'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.election_applications a JOIN public.election_positions p ON p.id = a.position_id
                      WHERE a.election_id = p_id AND a.status = 'approved' AND p.is_active) THEN
        RAISE EXCEPTION 'VOTING_NO_CANDIDATES' USING ERRCODE = '22023';
      END IF;
      UPDATE public.elections SET
        nominations_start_at = coalesce(nominations_start_at, now()),
        nominations_end_at = least(coalesce(nominations_end_at, now()), now()),
        starts_at = now(),
        ends_at = CASE WHEN ends_at > now() THEN ends_at END,
        updated_at = now()
      WHERE id = p_id;
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

-- One candidate's card (for shared links). Approved candidates of published elections only.
CREATE OR REPLACE FUNCTION public.election_candidate_card(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE r RECORD; v_phase TEXT;
BEGIN
  SELECT a.id, a.full_name, a.photo_url, a.program, p.title AS position_title, p.committee, p.group_key,
         e.id AS election_id, e.title AS election_title, e AS el
    INTO r
    FROM public.election_applications a
    JOIN public.election_positions p ON p.id = a.position_id
    JOIN public.elections e ON e.id = a.election_id
   WHERE a.id = p_id AND a.status = 'approved' AND e.is_published AND e.kind = 'general';
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_phase := public.general_election_phase(r.el);
  RETURN jsonb_build_object(
    'id', r.id, 'full_name', r.full_name, 'position_title', r.position_title, 'committee', r.committee,
    'group_key', r.group_key, 'election_id', r.election_id, 'election_title', r.election_title, 'phase', v_phase,
    'cards_hidden', v_phase = 'voting',
    'photo_url', CASE WHEN v_phase = 'voting' THEN NULL ELSE r.photo_url END,
    'program', CASE WHEN v_phase = 'voting' THEN NULL ELSE r.program END);
END $$;

REVOKE ALL ON FUNCTION public.general_election_to_json(public.elections, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.election_candidate_card(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.election_candidate_card(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.general_election_save(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_election_save(uuid, jsonb, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.general_election_action(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_election_action(uuid, text, text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
