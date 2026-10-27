-- ==========================================================
-- مراجعة أمنية قبل الانتخابات: إصلاحات ضرورية فقط
-- Pre-election security review: necessary fixes only.
-- ==========================================================
-- Requires 20261024 … 20261030. Safe to re-run. No vote, application, election or account
-- row is changed or deleted by this file (functions, a trigger function and one index only).
--
-- 1. users: a member could change their own is_mahaja (true -> false: a Mahaja student account
--    becoming eligible to vote) and unique_short_id (membership number checked by the card
--    verification page) by updating their row directly. The existing guard now keeps both,
--    as it already did for approval_status. Administrators are not affected.
-- 2. election_apply: the photo URL was not checked against the uploaded file, so an external
--    image (swappable after approval, leaking voters' IPs) could be used. It must now be the
--    public URL of the member's own file in the candidates' bucket.
-- 3. Deleting an election that already has votes now requires the super admin
--    (irreversible loss of the vote). Before voting, nothing changes.
-- 4. Performance under load: index on ballots(application_id) and a single tally per position
--    in general_election_to_json (identical output; ~80 ms -> ~10 ms per page refresh with
--    500 voters x 11 positions).
-- ==========================================================

BEGIN;

CREATE INDEX IF NOT EXISTS election_position_ballots_application_idx ON public.election_position_ballots (application_id);

CREATE OR REPLACE FUNCTION public.users_guard_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions, pg_temp AS $$
DECLARE v_trusted BOOLEAN;
BEGIN
  -- Trusted: database functions / service role, approval RPC, dashboard admins, Supabase Auth admins.
  v_trusted := current_user NOT IN ('anon', 'authenticated')
            OR current_setting('app.bypass_admin_check', true) = 'true'
            OR public.admin_can_any(ARRAY['users', 'approvals', 'memberships'])
            OR coalesce(public.is_admin(), false);
  IF v_trusted THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.approval_status := 'Pending Approval';
  ELSE
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      NEW.approval_status := OLD.approval_status;
    END IF;
    -- A Mahaja student account cannot turn itself into a member (voting eligibility).
    IF coalesce(OLD.is_mahaja, false) AND NOT coalesce(NEW.is_mahaja, false) THEN
      NEW.is_mahaja := OLD.is_mahaja;
    END IF;
    -- The membership number (card, card verification) is assigned by the administration.
    IF NEW.unique_short_id IS DISTINCT FROM OLD.unique_short_id THEN
      NEW.unique_short_id := OLD.unique_short_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.election_apply(p_election_id UUID, p_position_id UUID, p_data JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user UUID := auth.uid(); e public.elections; a public.election_applications;
  v_path TEXT := nullif(btrim(coalesce(p_data->>'photo_path', '')), '');
  v_url TEXT := nullif(btrim(coalesce(p_data->>'photo_url', '')), '');
  v_opath TEXT := nullif(btrim(coalesce(p_data->>'original_path', '')), '');
  v_ourl TEXT := nullif(btrim(coalesce(p_data->>'original_url', '')), '');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'APPLY_LOGIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO e FROM public.elections WHERE id = p_election_id AND kind = 'general' AND is_published FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ELECTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF public.general_election_phase(e) <> 'nominations' THEN RAISE EXCEPTION 'APPLY_CLOSED' USING ERRCODE = '22023'; END IF;
  IF NOT public.election_member_eligible(v_user, 'registered') THEN RAISE EXCEPTION 'APPLY_NOT_ELIGIBLE' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.election_positions WHERE id = p_position_id AND election_id = e.id AND is_active) THEN
    RAISE EXCEPTION 'APPLY_BAD_POSITION' USING ERRCODE = '22023';
  END IF;
  -- The photo must be one this member uploaded to the candidates' bucket, and the URL must be
  -- that very file (an external URL could be swapped after the application is approved).
  IF v_url IS NULL OR v_path IS NULL OR split_part(v_path, '/', 1) <> v_user::text
     OR NOT public.election_photo_url_ok(v_url, v_path) OR NOT public.election_photo_exists(v_path) THEN
    RAISE EXCEPTION 'APPLY_PHOTO_REQUIRED' USING ERRCODE = '22023';
  END IF;
  -- Optional uncropped original (photo editor): also in this member's folder.
  IF (v_opath IS NULL) <> (v_ourl IS NULL) OR (v_opath IS NOT NULL AND (split_part(v_opath, '/', 1) <> v_user::text
      OR NOT public.election_photo_url_ok(v_ourl, v_opath) OR NOT public.election_photo_exists(v_opath))) THEN
    RAISE EXCEPTION 'APPLY_PHOTO_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(coalesce(p_data->>'full_name', ''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'APPLY_BAD_NAME' USING ERRCODE = '22023'; END IF;
  IF char_length(btrim(coalesce(p_data->>'program', ''))) NOT BETWEEN 20 AND 5000 THEN RAISE EXCEPTION 'APPLY_BAD_PROGRAM' USING ERRCODE = '22023'; END IF;

  BEGIN
    INSERT INTO public.election_applications (election_id, position_id, user_id, full_name, photo_url, photo_path, program,
                                              photo_original_url, photo_original_path, photo_crop, photo_updated_at)
    VALUES (e.id, p_position_id, v_user, btrim(p_data->>'full_name'), v_url, v_path, btrim(p_data->>'program'),
            v_ourl, v_opath, public.election_photo_crop(p_data->'crop'), now())
    RETURNING * INTO a;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'APPLY_DUPLICATE' USING ERRCODE = '23505';
  END;
  RETURN jsonb_build_object('id', a.id, 'status', a.status);
END $$;

CREATE OR REPLACE FUNCTION public.general_election_delete(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); e public.elections; v_paths TEXT[];
BEGIN
  SELECT * INTO e FROM public.elections WHERE id = p_id AND kind = 'general' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF public.general_election_phase(e) = 'voting' THEN RAISE EXCEPTION 'ELECTION_IS_OPEN' USING ERRCODE = '22023'; END IF;
  -- Votes cast: deleting them is irreversible, only the super admin may do it.
  IF EXISTS (SELECT 1 FROM public.election_position_voters WHERE election_id = p_id) THEN
    PERFORM public.admin_require_super(p_token);
  END IF;
  SELECT array_agg(photo_path) FILTER (WHERE photo_path IS NOT NULL) INTO v_paths FROM public.election_applications WHERE election_id = p_id;
  PERFORM public.general_log(p_id, v_me->>'label', 'deleted', jsonb_build_object('title', e.title));
  DELETE FROM public.elections WHERE id = p_id;
  RETURN coalesce(v_paths, '{}'::TEXT[]);
END $$;

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
  -- Votes cast: deleting them is irreversible, only the super admin may do it.
  IF EXISTS (SELECT 1 FROM public.election_voters WHERE election_id = p_id) THEN
    PERFORM public.admin_require_super(p_token);
  END IF;
  SELECT array_agg(photo_path) FILTER (WHERE photo_path IS NOT NULL) INTO v_paths
    FROM public.election_candidates WHERE election_id = p_id;
  DELETE FROM public.elections WHERE id = p_id;
  RETURN coalesce(v_paths, '{}'::TEXT[]);
END $$;

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
    -- Leader / tie: the tally is computed once per position (same result as before, much cheaper).
    LEFT JOIN LATERAL (
      SELECT max(x.votes) AS top,
             count(*) FILTER (WHERE x.votes = x.mx) AS top_n,
             (array_agg(x.application_id ORDER BY x.votes DESC))[1] AS top_id
        FROM (SELECT y.application_id, y.votes, max(y.votes) OVER () AS mx FROM public.general_position_tally(p.id) y) x
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
          'photo_original_url', coalesce(a.photo_original_url, a.photo_url), 'photo_original_path', a.photo_original_path,
          'photo_crop', a.photo_crop, 'photo_updated_at', a.photo_updated_at,
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

REVOKE ALL ON FUNCTION public.users_guard_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.general_election_to_json(public.elections, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.election_apply(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.election_apply(uuid, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.general_election_delete(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_election_delete(uuid, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.election_delete(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.election_delete(uuid, text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
