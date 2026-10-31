-- ==========================================================
-- فرق طلاب المحجة البيضاء ونموذج المتابعة اليومية
-- Mahaja students: teams of 5 and the daily follow-up of each team.
-- ==========================================================
-- Requires 20261023000000_mahaja_attendance_periods.sql (access scope). Safe to re-run.
-- New tables only: no existing student, attendance, class or other row is changed or deleted.
--
-- * Teams of 5, numbered automatically. «توزيع الطلاب» puts every student who has no team yet,
--   in registration order (student number), into the last incomplete team, then new teams.
--   Once teams exist, a newly registered student joins the last team automatically (or opens
--   the next one when it is full). Suspended students are not distributed automatically.
-- * Members can be changed by the managers of the Mahaja section (at most 5 per team, a student
--   belongs to one team).
-- * Follow-up: one record per team and day (Mauritania time), with the period and, for each
--   student, the daily portion (from surah/ayah to surah/ayah), memorised yes/no, old ahzab
--   reviewed with the teacher yes/no, number of repetitions and the supervisor's note. Saving
--   the same day again updates that day; previous days are never replaced.
-- * Access: the Mahaja section's existing scope (mahaja_attendance_scope): managers see and
--   manage every team; class supervisors see and fill in the teams of their own students.
-- ==========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.mahaja_teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_number  INTEGER NOT NULL UNIQUE CHECK (team_number > 0),
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mahaja_team_members (
  team_id     UUID NOT NULL REFERENCES public.mahaja_teams(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL UNIQUE REFERENCES public.mahaja_students(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, student_id)
);
CREATE INDEX IF NOT EXISTS mahaja_team_members_team_idx ON public.mahaja_team_members (team_id, added_at);

CREATE TABLE IF NOT EXISTS public.mahaja_team_followups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        UUID NOT NULL REFERENCES public.mahaja_teams(id) ON DELETE RESTRICT,
  team_number    INTEGER NOT NULL,
  followup_date  DATE NOT NULL,
  period         TEXT NOT NULL CHECK (period IN ('morning', 'evening', 'both')),
  note           TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  recorded_by    TEXT,
  updated_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, followup_date)
);
CREATE INDEX IF NOT EXISTS mahaja_team_followups_date_idx ON public.mahaja_team_followups (followup_date);

-- One line per student of the team on that day (name kept as it was, even if the student leaves).
CREATE TABLE IF NOT EXISTS public.mahaja_team_followup_students (
  followup_id   UUID NOT NULL REFERENCES public.mahaja_team_followups(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL,
  student_name  TEXT NOT NULL,
  student_number BIGINT,
  position      SMALLINT NOT NULL DEFAULT 0,
  from_surah    SMALLINT CHECK (from_surah BETWEEN 1 AND 114),
  from_ayah     SMALLINT CHECK (from_ayah BETWEEN 1 AND 286),
  to_surah      SMALLINT CHECK (to_surah BETWEEN 1 AND 114),
  to_ayah       SMALLINT CHECK (to_ayah BETWEEN 1 AND 286),
  memorized     BOOLEAN,
  reviewed_old  BOOLEAN,
  repetitions   SMALLINT CHECK (repetitions BETWEEN 0 AND 1000),
  supervisor_note TEXT CHECK (supervisor_note IS NULL OR char_length(supervisor_note) <= 1000),
  PRIMARY KEY (followup_id, student_id)
);

-- Only reachable through the functions below.
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['mahaja_teams', 'mahaja_team_members', 'mahaja_team_followups', 'mahaja_team_followup_students'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------

-- Puts one student in the last incomplete team, or in a new team (next number).
CREATE OR REPLACE FUNCTION public.mahaja_team_place(p_student UUID, p_by TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_team UUID; v_count INT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.mahaja_team_members WHERE student_id = p_student) THEN RETURN NULL; END IF;
  SELECT t.id, (SELECT count(*) FROM public.mahaja_team_members m WHERE m.team_id = t.id)
    INTO v_team, v_count
    FROM public.mahaja_teams t ORDER BY t.team_number DESC LIMIT 1 FOR UPDATE;
  IF v_team IS NULL OR v_count >= 5 THEN
    INSERT INTO public.mahaja_teams (team_number, created_by)
    VALUES (coalesce((SELECT max(team_number) FROM public.mahaja_teams), 0) + 1, p_by)
    RETURNING id INTO v_team;
  END IF;
  INSERT INTO public.mahaja_team_members (team_id, student_id) VALUES (v_team, p_student);
  RETURN v_team;
END $$;
REVOKE ALL ON FUNCTION public.mahaja_team_place(uuid, text) FROM PUBLIC, anon, authenticated;

-- New student: joins the teams automatically once the teams have been started.
CREATE OR REPLACE FUNCTION public.mahaja_team_auto_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.mahaja_teams) AND NEW.status IS DISTINCT FROM 'suspended' THEN
    PERFORM pg_advisory_xact_lock(hashtext('mahaja_teams'));
    PERFORM public.mahaja_team_place(NEW.id, 'تلقائي');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mahaja_team_auto_join() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS mahaja_team_auto_join ON public.mahaja_students;
CREATE TRIGGER mahaja_team_auto_join AFTER INSERT ON public.mahaja_students
  FOR EACH ROW EXECUTE FUNCTION public.mahaja_team_auto_join();

-- Teams this caller may see / fill in.
CREATE OR REPLACE FUNCTION public.mahaja_scope_teams(p_scope JSONB)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id FROM public.mahaja_teams t WHERE (p_scope->>'is_manager')::BOOLEAN
  UNION
  SELECT DISTINCT m.team_id FROM public.mahaja_team_members m
   WHERE NOT (p_scope->>'is_manager')::BOOLEAN
     AND m.student_id IN (SELECT public.mahaja_scope_students(p_scope, NULL));
$$;
REVOKE ALL ON FUNCTION public.mahaja_scope_teams(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mahaja_require_manager(p_scope JSONB)
RETURNS VOID LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF NOT coalesce((p_scope->>'is_manager')::BOOLEAN, false) THEN RAISE EXCEPTION 'TEAMS_MANAGER_ONLY' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mahaja_require_manager(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mahaja_today() RETURNS DATE LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Africa/Nouakchott')::date;
$$;

-- ----------------------------------------------------------
-- Teams
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mahaja_teams_list(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token);
BEGIN
  RETURN jsonb_build_object(
    'can_manage', coalesce((v_scope->>'is_manager')::BOOLEAN, false),
    'today', public.mahaja_today(),
    'unassigned', CASE WHEN (v_scope->>'is_manager')::BOOLEAN THEN (
        SELECT count(*) FROM public.mahaja_students s
         WHERE s.status IS DISTINCT FROM 'suspended'
           AND NOT EXISTS (SELECT 1 FROM public.mahaja_team_members m WHERE m.student_id = s.id)) END,
    'teams', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', t.id, 'team_number', t.team_number,
          'members', coalesce((
            SELECT jsonb_agg(jsonb_build_object('id', s.id, 'full_name', s.full_name, 'student_number', s.student_number,
                                                'status', s.status, 'photo_url', s.photo_url)
                             ORDER BY m.added_at, s.student_number)
              FROM public.mahaja_team_members m JOIN public.mahaja_students s ON s.id = m.student_id
             WHERE m.team_id = t.id), '[]'::jsonb),
          'last_followup', (SELECT max(f.followup_date) FROM public.mahaja_team_followups f WHERE f.team_id = t.id),
          'followups_count', (SELECT count(*) FROM public.mahaja_team_followups f WHERE f.team_id = t.id))
        ORDER BY t.team_number)
        FROM public.mahaja_teams t
       WHERE t.id IN (SELECT public.mahaja_scope_teams(v_scope))), '[]'::jsonb));
END $$;

-- Every student without a team (not suspended), in registration order.
CREATE OR REPLACE FUNCTION public.mahaja_teams_distribute(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token); r RECORD; v_n INT := 0; v_before INT;
BEGIN
  PERFORM public.mahaja_require_manager(v_scope);
  PERFORM pg_advisory_xact_lock(hashtext('mahaja_teams'));
  SELECT count(*) INTO v_before FROM public.mahaja_teams;
  FOR r IN SELECT s.id FROM public.mahaja_students s
            WHERE s.status IS DISTINCT FROM 'suspended'
              AND NOT EXISTS (SELECT 1 FROM public.mahaja_team_members m WHERE m.student_id = s.id)
            ORDER BY s.student_number LOOP
    PERFORM public.mahaja_team_place(r.id, v_scope->>'label');
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('placed', v_n, 'new_teams', (SELECT count(*) FROM public.mahaja_teams) - v_before);
END $$;

-- Members of one team (managers). NULL team = new team with the next number.
CREATE OR REPLACE FUNCTION public.mahaja_team_set_members(p_team_id UUID, p_student_ids UUID[], p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token); v_team UUID := p_team_id; v_ids UUID[];
BEGIN
  PERFORM public.mahaja_require_manager(v_scope);
  PERFORM pg_advisory_xact_lock(hashtext('mahaja_teams'));
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_ids FROM unnest(coalesce(p_student_ids, '{}'::UUID[])) x;
  IF array_length(v_ids, 1) > 5 THEN RAISE EXCEPTION 'TEAM_TOO_LARGE' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.mahaja_students WHERE id = ANY (v_ids)) <> coalesce(array_length(v_ids, 1), 0) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_team IS NULL THEN
    INSERT INTO public.mahaja_teams (team_number, created_by)
    VALUES (coalesce((SELECT max(team_number) FROM public.mahaja_teams), 0) + 1, v_scope->>'label') RETURNING id INTO v_team;
  ELSIF NOT EXISTS (SELECT 1 FROM public.mahaja_teams WHERE id = v_team) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.mahaja_team_members WHERE team_id = v_team AND NOT (student_id = ANY (v_ids));
  -- A student moved here leaves their previous team.
  DELETE FROM public.mahaja_team_members WHERE student_id = ANY (v_ids) AND team_id <> v_team;
  INSERT INTO public.mahaja_team_members (team_id, student_id)
  SELECT v_team, x FROM unnest(v_ids) x ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('id', v_team, 'team_number', (SELECT team_number FROM public.mahaja_teams WHERE id = v_team));
END $$;

-- A team can be deleted only if it has no follow-up (records are never lost).
CREATE OR REPLACE FUNCTION public.mahaja_team_delete(p_team_id UUID, p_token TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token);
BEGIN
  PERFORM public.mahaja_require_manager(v_scope);
  IF EXISTS (SELECT 1 FROM public.mahaja_team_followups WHERE team_id = p_team_id) THEN
    RAISE EXCEPTION 'TEAM_HAS_FOLLOWUPS' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.mahaja_teams WHERE id = p_team_id;
END $$;

-- ----------------------------------------------------------
-- Follow-ups
-- ----------------------------------------------------------

-- The record of a team for a day, or a blank form with the current members.
CREATE OR REPLACE FUNCTION public.mahaja_team_followup_get(p_team_id UUID, p_date DATE, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token); t public.mahaja_teams; f public.mahaja_team_followups;
BEGIN
  IF p_team_id NOT IN (SELECT public.mahaja_scope_teams(v_scope)) THEN RAISE EXCEPTION 'ADMIN_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO t FROM public.mahaja_teams WHERE id = p_team_id;
  SELECT * INTO f FROM public.mahaja_team_followups WHERE team_id = p_team_id AND followup_date = coalesce(p_date, public.mahaja_today());
  RETURN jsonb_build_object(
    'team_id', t.id, 'team_number', t.team_number, 'date', coalesce(p_date, public.mahaja_today()),
    'exists', f.id IS NOT NULL, 'period', f.period, 'note', f.note,
    'recorded_by', f.recorded_by, 'updated_by', f.updated_by, 'updated_at', f.updated_at,
    'students', CASE WHEN f.id IS NOT NULL THEN coalesce((
        SELECT jsonb_agg(to_jsonb(x) - 'followup_id' ORDER BY x.position) FROM public.mahaja_team_followup_students x WHERE x.followup_id = f.id), '[]'::jsonb)
      ELSE coalesce((
        SELECT jsonb_agg(jsonb_build_object('student_id', s.id, 'student_name', s.full_name, 'student_number', s.student_number)
                         ORDER BY m.added_at, s.student_number)
          FROM public.mahaja_team_members m JOIN public.mahaja_students s ON s.id = m.student_id WHERE m.team_id = t.id), '[]'::jsonb) END,
    'dates', coalesce((SELECT jsonb_agg(d.followup_date ORDER BY d.followup_date DESC)
                         FROM (SELECT followup_date FROM public.mahaja_team_followups WHERE team_id = p_team_id ORDER BY followup_date DESC LIMIT 400) d), '[]'::jsonb));
END $$;

-- Saves the follow-up of a team for a day (that day only; other days are untouched).
CREATE OR REPLACE FUNCTION public.mahaja_team_followup_save(p_team_id UUID, p_date DATE, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token); t public.mahaja_teams; v_id UUID;
  v_period TEXT := p_data->>'period'; v_date DATE := coalesce(p_date, public.mahaja_today()); s JSONB; i INT := 0;
BEGIN
  IF p_team_id NOT IN (SELECT public.mahaja_scope_teams(v_scope)) THEN RAISE EXCEPTION 'ADMIN_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO t FROM public.mahaja_teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_period IS NULL OR v_period NOT IN ('morning', 'evening', 'both') THEN RAISE EXCEPTION 'FOLLOWUP_PERIOD_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF v_date > public.mahaja_today() THEN RAISE EXCEPTION 'FOLLOWUP_FUTURE_DATE' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_data->'students') <> 'array' OR jsonb_array_length(p_data->'students') = 0 THEN
    RAISE EXCEPTION 'FOLLOWUP_NO_STUDENTS' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.mahaja_team_followups (team_id, team_number, followup_date, period, note, recorded_by, updated_by)
  VALUES (t.id, t.team_number, v_date, v_period, nullif(btrim(coalesce(p_data->>'note', '')), ''), v_scope->>'label', v_scope->>'label')
  ON CONFLICT (team_id, followup_date) DO UPDATE SET
    period = EXCLUDED.period, note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING id INTO v_id;

  DELETE FROM public.mahaja_team_followup_students WHERE followup_id = v_id;
  FOR s IN SELECT * FROM jsonb_array_elements(p_data->'students') LOOP
    i := i + 1;
    INSERT INTO public.mahaja_team_followup_students (followup_id, student_id, student_name, student_number, position,
      from_surah, from_ayah, to_surah, to_ayah, memorized, reviewed_old, repetitions, supervisor_note)
    SELECT v_id, st.id, st.full_name, st.student_number, i,
           nullif(s->>'from_surah', '')::SMALLINT, nullif(s->>'from_ayah', '')::SMALLINT,
           nullif(s->>'to_surah', '')::SMALLINT, nullif(s->>'to_ayah', '')::SMALLINT,
           (s->>'memorized')::BOOLEAN, (s->>'reviewed_old')::BOOLEAN,
           nullif(s->>'repetitions', '')::SMALLINT, nullif(btrim(coalesce(s->>'supervisor_note', '')), '')
      FROM public.mahaja_students st
     WHERE st.id = (s->>'student_id')::UUID
    ON CONFLICT (followup_id, student_id) DO NOTHING;
  END LOOP;
  RETURN public.mahaja_team_followup_get(p_team_id, v_date, p_token);
END $$;

-- Follow-ups between two dates, one team or all the teams this caller may see (PDF reports).
CREATE OR REPLACE FUNCTION public.mahaja_team_followups_report(p_from DATE, p_to DATE, p_team_id UUID DEFAULT NULL, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token);
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 400 THEN RAISE EXCEPTION 'BAD_RANGE' USING ERRCODE = '22023'; END IF;
  IF p_team_id IS NOT NULL AND p_team_id NOT IN (SELECT public.mahaja_scope_teams(v_scope)) THEN
    RAISE EXCEPTION 'ADMIN_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
        'id', f.id, 'team_id', f.team_id, 'team_number', f.team_number, 'date', f.followup_date, 'period', f.period,
        'note', f.note, 'recorded_by', f.recorded_by, 'updated_by', f.updated_by,
        'students', coalesce((SELECT jsonb_agg(to_jsonb(x) - 'followup_id' ORDER BY x.position)
                                FROM public.mahaja_team_followup_students x WHERE x.followup_id = f.id), '[]'::jsonb))
      ORDER BY f.team_number, f.followup_date)
      FROM public.mahaja_team_followups f
     WHERE f.followup_date BETWEEN p_from AND p_to
       AND (p_team_id IS NULL OR f.team_id = p_team_id)
       AND f.team_id IN (SELECT public.mahaja_scope_teams(v_scope))), '[]'::jsonb);
END $$;

DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mahaja_teams_list(text)', 'public.mahaja_teams_distribute(text)',
    'public.mahaja_team_set_members(uuid, uuid[], text)', 'public.mahaja_team_delete(uuid, text)',
    'public.mahaja_team_followup_get(uuid, date, text)', 'public.mahaja_team_followup_save(uuid, date, jsonb, text)',
    'public.mahaja_team_followups_report(date, date, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
