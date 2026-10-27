-- ==========================================================
-- التصويت للأعضاء المعتمدين فقط
-- Voting: approved accounts only.
-- ==========================================================
-- Requires 20261029000000_live_voting.sql. Safe to re-run. No vote is changed or deleted.
--
-- * Only accounts approved by the administration (users.approval_status = 'Approved') can vote;
--   accounts awaiting review cannot. Mahaja student accounts stay excluded, as before.
-- * Approval is checked at the moment of each vote: a member approved while voting is open
--   (including accounts created after voting started) can vote right away.
-- * General elections whose results are not announced switch to 'approved'; it is also the
--   default for new elections. Votes already cast are kept as they are.
-- ==========================================================

BEGIN;

UPDATE public.elections SET eligibility = 'approved', updated_at = now()
 WHERE kind = 'general' AND results_announced_at IS NULL AND eligibility IS DISTINCT FROM 'approved';

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
          coalesce(nullif(p_data->>'eligibility', ''), 'approved'), 'draft', false, true, v_me->>'label',
          coalesce((p_data->>'live_results')::boolean, true))
  RETURNING * INTO e;
  PERFORM public.general_seed_positions(e.id);
  PERFORM public.general_log(e.id, v_me->>'label', 'created', jsonb_build_object('title', e.title));
  RETURN jsonb_build_object('id', e.id);
END $$;

REVOKE ALL ON FUNCTION public.general_election_save(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_election_save(uuid, jsonb, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.general_election_create(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_election_create(jsonb, text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
