-- ==========================================================
-- إعلان النتائج: لا نتائج للأعضاء بعد إغلاق التصويت حتى يعلنها المشرف
-- Results announcement: after voting closes, members see no results until the admin announces them.
-- ==========================================================
-- Requires 20261031000000_election_security_review.sql. Safe to re-run. No data changed.
--
-- * Phase «voting_closed»: vote counts, leaders and winners are no longer sent to members
--   (the page shows «ترقبوا النتائج النهائية»). Phase «results» (after «إعلان النتائج»):
--   everything, as before. While voting is open, the live-results setting is unchanged.
-- * The dashboard keeps seeing everything at every phase. Votes and counting are unchanged.
-- ==========================================================

BEGIN;

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
  -- Vote counts: live while voting is open (if the election shows live results). Once voting
  -- has closed, nothing until the administration announces the results. The dashboard always sees them.
  v_live BOOLEAN := coalesce(e.live_results, true) AND v_phase = 'voting';
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

REVOKE ALL ON FUNCTION public.general_election_to_json(public.elections, boolean, uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
