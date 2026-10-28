-- ==========================================================
-- سجل المشاركة في الانتخابات (لوحة المشرف فقط)
-- Election participation record (dashboard only).
-- ==========================================================
-- Requires 20261024000000_general_elections.sql. Safe to re-run. Read-only: nothing is changed
-- in the votes, the voting process or the public pages.
--
-- For each position: the members who voted in it (account details, date of the vote), and the
-- eligible members who have not voted yet in the election. Taken from election_position_voters,
-- the record that already prevents double voting. The ballot stays secret: this record does not
-- say for whom a member voted (it is not stored anywhere).
-- Dashboard admins with the «elections» section only; every consultation is logged.
-- ==========================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.general_election_participation(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); e public.elections; v JSONB;
BEGIN
  SELECT * INTO e FROM public.elections WHERE id = p_id AND kind = 'general';
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v := jsonb_build_object(
    'positions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'title', p.title, 'group_key', p.group_key, 'is_active', p.is_active,
          'voters', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'user_id', v.user_id, 'full_name', u.full_name, 'phone', u.phone, 'email', u.email,
                'approval_status', u.approval_status, 'unique_short_id', u.unique_short_id, 'voted_on', v.voted_on)
              ORDER BY u.full_name NULLS LAST, v.user_id)
              FROM public.election_position_voters v
              LEFT JOIN public.users u ON u.id = v.user_id
             WHERE v.position_id = p.id), '[]'::jsonb))
        ORDER BY p.sort_order, p.title)
        FROM public.election_positions p
       WHERE p.election_id = e.id
         AND (p.is_active OR EXISTS (SELECT 1 FROM public.election_position_voters x WHERE x.position_id = p.id))), '[]'::jsonb),
    'voters_total', (SELECT count(DISTINCT v.user_id) FROM public.election_position_voters v WHERE v.election_id = e.id),
    'eligibility', e.eligibility,
    -- Eligible members (same rule as the vote) who have not voted in any position yet.
    'non_voters', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'user_id', u.id, 'full_name', u.full_name, 'phone', u.phone, 'email', u.email,
          'approval_status', u.approval_status, 'unique_short_id', u.unique_short_id)
        ORDER BY u.full_name)
        FROM public.users u
       WHERE coalesce(u.is_mahaja, false) = false
         AND (e.eligibility = 'registered' OR u.approval_status = 'Approved')
         AND NOT EXISTS (SELECT 1 FROM public.election_position_voters v WHERE v.election_id = e.id AND v.user_id = u.id)), '[]'::jsonb));

  PERFORM public.general_log(e.id, v_me->>'label', 'participation_viewed', '{}'::jsonb);
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.general_election_participation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_election_participation(uuid, text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
