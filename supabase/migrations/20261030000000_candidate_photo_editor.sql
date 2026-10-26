-- ==========================================================
-- محرر صورة المترشح: قص دائري، نسخة أصلية ونسخة مقصوصة 800×800، تعديل لاحق
-- Candidate photo editor: circular crop, original + 800×800 cropped copy, editable later.
-- ==========================================================
-- Requires 20261024 … 20261029. Safe to re-run. No application, vote or account is deleted.
--
-- * election_applications: photo_url / photo_path stay the displayed (cropped) photo, used
--   everywhere. New: photo_original_url / photo_original_path (uncropped original, to crop again
--   later), photo_crop (editor position: x, y = centre as a fraction of the original, zoom),
--   photo_updated_at.
-- * A member changes the photo of their own applications only, until voting starts
--   (election_application_set_photo). Files must be in their own folder and exist in storage.
-- * Dashboard admins (no Supabase login) change any candidate's photo with a one-time upload
--   ticket: general_photo_ticket() gives a ticket valid 10 minutes for one application; the
--   storage policy only accepts uploads into tickets/<valid ticket>/; general_application_set_photo()
--   checks the ticket and the files, then updates the application. Every change is logged.
-- * Every save uses new file names, so the new photo shows at once (no stale cache).
-- ==========================================================

BEGIN;

ALTER TABLE public.election_applications
  ADD COLUMN IF NOT EXISTS photo_original_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_original_path TEXT,
  ADD COLUMN IF NOT EXISTS photo_crop JSONB,
  ADD COLUMN IF NOT EXISTS photo_updated_at TIMESTAMPTZ;

-- One-time upload tickets for dashboard admins (read only through the functions below).
CREATE TABLE IF NOT EXISTS public.election_photo_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.election_applications(id) ON DELETE CASCADE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes',
  used_at TIMESTAMPTZ
);
ALTER TABLE public.election_photo_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_photo_tickets FROM PUBLIC, anon, authenticated;

-- Editor position, cleaned: centre x/y in [0, 1], zoom in [1, 8].
CREATE OR REPLACE FUNCTION public.election_photo_crop(p JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p IS NULL OR jsonb_typeof(p) <> 'object'
                OR jsonb_typeof(p->'x') <> 'number' OR jsonb_typeof(p->'y') <> 'number' OR jsonb_typeof(p->'zoom') <> 'number'
              THEN NULL
              ELSE jsonb_build_object(
                'x', least(1, greatest(0, (p->>'x')::numeric)),
                'y', least(1, greatest(0, (p->>'y')::numeric)),
                'zoom', least(8, greatest(1, (p->>'zoom')::numeric))) END;
$$;

-- A file of the candidates' bucket really exists (uploaded through Storage, under its policies).
CREATE OR REPLACE FUNCTION public.election_photo_exists(p_path TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'election-photos' AND o.name = p_path);
$$;
REVOKE ALL ON FUNCTION public.election_photo_exists(text) FROM PUBLIC, anon, authenticated;

-- The URL must be the public URL of that very file.
CREATE OR REPLACE FUNCTION public.election_photo_url_ok(p_url TEXT, p_path TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_url IS NOT NULL AND p_path IS NOT NULL AND p_url ~ '^https?://'
     AND right(p_url, char_length('/storage/v1/object/public/election-photos/' || p_path)) = '/storage/v1/object/public/election-photos/' || p_path;
$$;

-- Applies a new photo (cropped copy, optional new original, editor position) to an application.
CREATE OR REPLACE FUNCTION public.election_photo_apply(a public.election_applications, p_data JSONB, p_prefix TEXT, p_actor TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_path TEXT := nullif(btrim(coalesce(p_data->>'photo_path', '')), '');
  v_url TEXT := nullif(btrim(coalesce(p_data->>'photo_url', '')), '');
  v_opath TEXT := nullif(btrim(coalesce(p_data->>'original_path', '')), '');
  v_ourl TEXT := nullif(btrim(coalesce(p_data->>'original_url', '')), '');
  v_name TEXT := '^' || regexp_replace(p_prefix, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '[0-9a-f-]{36}-(crop|orig)\.jpg$';
  r public.election_applications;
BEGIN
  IF v_path IS NULL OR v_path !~ v_name OR right(v_path, 9) <> '-crop.jpg' OR NOT public.election_photo_url_ok(v_url, v_path)
     OR NOT public.election_photo_exists(v_path) THEN
    RAISE EXCEPTION 'PHOTO_INVALID' USING ERRCODE = '22023';
  END IF;
  IF (v_opath IS NULL) <> (v_ourl IS NULL) OR (v_opath IS NOT NULL AND (v_opath !~ v_name OR right(v_opath, 9) <> '-orig.jpg'
      OR NOT public.election_photo_url_ok(v_ourl, v_opath) OR NOT public.election_photo_exists(v_opath))) THEN
    RAISE EXCEPTION 'PHOTO_INVALID' USING ERRCODE = '22023';
  END IF;

  UPDATE public.election_applications SET
    photo_url = v_url, photo_path = v_path,
    -- Without a new original, keep the previous one (older applications: their first photo).
    photo_original_url = coalesce(v_ourl, a.photo_original_url, a.photo_url),
    photo_original_path = CASE WHEN v_ourl IS NOT NULL THEN v_opath WHEN a.photo_original_url IS NOT NULL THEN a.photo_original_path ELSE a.photo_path END,
    photo_crop = public.election_photo_crop(p_data->'crop'),
    photo_updated_at = now(), updated_at = now()
  WHERE id = a.id RETURNING * INTO r;

  PERFORM public.general_log(a.election_id, p_actor, 'photo_updated', jsonb_build_object(
    'candidate', a.full_name, 'position', (SELECT title FROM public.election_positions WHERE id = a.position_id)));
  RETURN jsonb_build_object('id', r.id, 'photo_url', r.photo_url, 'photo_original_url', r.photo_original_url,
                            'photo_crop', r.photo_crop, 'photo_updated_at', r.photo_updated_at,
                            'previous_path', a.photo_path);
END $$;
REVOKE ALL ON FUNCTION public.election_photo_apply(public.election_applications, jsonb, text, text) FROM PUBLIC, anon, authenticated;

-- Member: own applications only, until voting starts.
CREATE OR REPLACE FUNCTION public.election_application_set_photo(p_application_id UUID, p_data JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user UUID := auth.uid(); a public.election_applications; e public.elections;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'APPLY_LOGIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.election_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR a.user_id <> v_user THEN RAISE EXCEPTION 'PHOTO_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO e FROM public.elections WHERE id = a.election_id;
  IF a.status = 'rejected' OR public.general_voting_started(public.general_election_phase(e)) THEN
    RAISE EXCEPTION 'PHOTO_LOCKED' USING ERRCODE = '22023';
  END IF;
  RETURN public.election_photo_apply(a, p_data, v_user::text || '/', coalesce(a.full_name, 'المترشح'));
END $$;
REVOKE ALL ON FUNCTION public.election_application_set_photo(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.election_application_set_photo(uuid, jsonb) TO authenticated;

-- Dashboard: one-time upload ticket for one application.
CREATE OR REPLACE FUNCTION public.general_photo_ticket(p_application_id UUID, p_token TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); v_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.election_applications WHERE id = p_application_id) THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.election_photo_tickets WHERE expires_at < now() - interval '1 day';
  INSERT INTO public.election_photo_tickets (application_id, created_by) VALUES (p_application_id, v_me->>'label') RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.general_photo_ticket(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_photo_ticket(uuid, text) TO anon, authenticated;

-- Dashboard: apply the uploaded photo (ticket checked, then spent).
CREATE OR REPLACE FUNCTION public.general_application_set_photo(p_ticket UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_section(p_token, 'elections'); t public.election_photo_tickets; a public.election_applications; v JSONB;
BEGIN
  SELECT * INTO t FROM public.election_photo_tickets WHERE id = p_ticket FOR UPDATE;
  IF NOT FOUND OR t.used_at IS NOT NULL OR t.expires_at < now() THEN RAISE EXCEPTION 'PHOTO_TICKET_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO a FROM public.election_applications WHERE id = t.application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  v := public.election_photo_apply(a, p_data, 'tickets/' || t.id::text || '/', v_me->>'label');
  UPDATE public.election_photo_tickets SET used_at = now() WHERE id = t.id;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.general_application_set_photo(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_application_set_photo(uuid, jsonb, text) TO anon, authenticated;

-- Storage policy helper: is this folder a valid, unused ticket?
CREATE OR REPLACE FUNCTION public.election_photo_ticket_ok(p_folder TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_folder ~ '^[0-9a-f-]{36}$' AND EXISTS (
    SELECT 1 FROM public.election_photo_tickets t
     WHERE t.id::text = p_folder AND t.used_at IS NULL AND t.expires_at > now());
$$;
REVOKE ALL ON FUNCTION public.election_photo_ticket_ok(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.election_photo_ticket_ok(text) TO anon, authenticated;

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
  -- The photo must be one this member uploaded to the candidates' bucket.
  IF v_url IS NULL OR v_path IS NULL OR split_part(v_path, '/', 1) <> v_user::text THEN
    RAISE EXCEPTION 'APPLY_PHOTO_REQUIRED' USING ERRCODE = '22023';
  END IF;
  -- Optional uncropped original (photo editor): also in this member's folder.
  IF (v_opath IS NULL) <> (v_ourl IS NULL) OR (v_opath IS NOT NULL AND split_part(v_opath, '/', 1) <> v_user::text) THEN
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
        'photo_original_url', coalesce(a.photo_original_url, a.photo_url), 'photo_crop', a.photo_crop, 'photo_updated_at', a.photo_updated_at,
        'review_note', a.review_note, 'reviewed_by', a.reviewed_by, 'reviewed_at', a.reviewed_at, 'created_at', a.created_at)
        ORDER BY a.created_at)
      FROM public.election_applications a
      JOIN public.election_positions p ON p.id = a.position_id
      LEFT JOIN public.users u ON u.id = a.user_id
      WHERE a.election_id = e.id), '[]'::jsonb),
    'log', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC)
      FROM (SELECT * FROM public.election_admin_log WHERE election_id = e.id ORDER BY created_at DESC LIMIT 300) l), '[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.general_election_to_json(public.elections, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.election_apply(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.election_apply(uuid, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.general_election_admin_get(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_election_admin_get(uuid, text) TO anon, authenticated;

COMMIT;

-- Storage: uploads into tickets/<valid ticket>/ (dashboard admins). Members keep their own folder.
DO $$
BEGIN
  DROP POLICY IF EXISTS election_photos_ticket_insert ON storage.objects;
  CREATE POLICY election_photos_ticket_insert ON storage.objects FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'election-photos' AND (storage.foldername(name))[1] = 'tickets'
                AND public.election_photo_ticket_ok((storage.foldername(name))[2]));
EXCEPTION WHEN insufficient_privilege OR undefined_table OR invalid_schema_name THEN
  RAISE NOTICE 'Storage policies not configurable from here: run this file from the Supabase SQL Editor.';
END $$;

NOTIFY pgrst, 'reload schema';
