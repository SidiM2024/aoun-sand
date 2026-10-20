-- ==========================================================
-- إظهار الانتخابات والمرشحين للأعضاء فور إضافتها من لوحة التحكم
-- Elections and candidates are visible to members as soon as they are saved
-- ==========================================================
-- Root cause: new elections are created with status 'draft' and elections_public()
-- returned only non-draft elections, so anything saved in the dashboard stayed hidden
-- from members until an admin pressed «فتح التصويت».
--
-- Fix: visibility is now a separate flag (is_published, default true). A published
-- election is listed with its candidates whatever its status; voting itself is unchanged
-- (still only while the election is open). Admins can hide an election explicitly.
--
-- Requires 20261020000000_site_v2_elections_projects_auth.sql. Safe to re-run.
-- No election, candidate, vote or member is deleted or modified (except the new flag).
-- ==========================================================

BEGIN;

ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;
-- Existing elections (including those saved as drafts) become visible, as requested.
UPDATE public.elections SET is_published = true WHERE is_published = false;

CREATE OR REPLACE FUNCTION public.election_to_json(e public.elections, p_with_results BOOLEAN, p_user UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', e.id, 'title', e.title, 'description', e.description,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'status', e.status,
    'phase', public.election_phase(e), 'results_visible', e.results_visible,
    'is_published', e.is_published,
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

-- Public list: every published election with its candidates (open first, closed last).
CREATE OR REPLACE FUNCTION public.elections_public()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(public.election_to_json(e, e.results_visible, auth.uid())
           ORDER BY (e.status = 'closed'), (e.status = 'draft'), coalesce(e.starts_at, e.created_at) DESC), '[]'::jsonb)
    FROM public.elections e WHERE e.is_published;
$$;

-- Admin: show / hide an election on the members' page.
CREATE OR REPLACE FUNCTION public.election_set_published(p_id UUID, p_published BOOLEAN, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE e public.elections;
BEGIN
  PERFORM public.admin_require_section(p_token, 'elections');
  UPDATE public.elections SET is_published = coalesce(p_published, true), updated_at = now()
   WHERE id = p_id RETURNING * INTO e;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN public.election_to_json(e, true, NULL);
END $$;

-- Read access for members and visitors goes through these SECURITY DEFINER functions only
-- (the tables themselves stay closed). Re-applied here so the permissions are always right.
REVOKE ALL ON FUNCTION public.election_to_json(public.elections, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.elections_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.elections_public() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.election_set_published(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.election_set_published(uuid, boolean, text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
