-- ==========================================================
-- معهد المحجة البيضاء: الحضور والخروج حسب الفترة + الحلقات والمشرفون + التقارير
-- Mahaja attendance: morning / evening periods, check-in and check-out with times,
-- classes assigned to supervisors, daily and weekly reports.
-- ==========================================================
-- Requires 20261008000000_admin_sections_and_mahaja_attendance.sql. Safe to re-run.
--
-- Existing data is kept:
--   * every existing attendance record becomes a morning-period record;
--   * old records with the status «خرج مبكرًا» become «حاضر» + exit «خرج مبكرًا»
--     (the same meaning, now split into entry and exit);
--   * students, notes and history are not touched.
--
-- Permissions:
--   * Super Admin and Mahaja admins without assigned classes see and manage every student
--     (unchanged behaviour), and every record and report.
--   * A Mahaja admin assigned to classes (الحلقات) records and sees only the students
--     of those classes, for the periods of those classes.
--   * Every entry / exit stores the name of the supervisor who recorded it.
-- ==========================================================

BEGIN;

-- ----------------------------------------------------------
-- 1. Attendance: period, check-in / check-out
-- ----------------------------------------------------------
ALTER TABLE public.mahaja_attendance ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'morning';
ALTER TABLE public.mahaja_attendance ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMPTZ;
ALTER TABLE public.mahaja_attendance ADD COLUMN IF NOT EXISTS checkout_status TEXT;
ALTER TABLE public.mahaja_attendance ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ;
ALTER TABLE public.mahaja_attendance ADD COLUMN IF NOT EXISTS checkout_by TEXT;

DO $$
DECLARE c RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mahaja_attendance_period_check') THEN
    ALTER TABLE public.mahaja_attendance ADD CONSTRAINT mahaja_attendance_period_check CHECK (period IN ('morning', 'evening'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mahaja_attendance_checkout_check') THEN
    ALTER TABLE public.mahaja_attendance ADD CONSTRAINT mahaja_attendance_checkout_check
      CHECK (checkout_status IS NULL OR checkout_status IN ('left', 'left_early'));
  END IF;
  -- One record per student, day AND period (was: per student and day).
  FOR c IN
    SELECT con.conname FROM pg_constraint con
     WHERE con.conrelid = 'public.mahaja_attendance'::regclass AND con.contype = 'u'
       AND con.conname <> 'mahaja_attendance_student_day_period_key'
       AND (SELECT array_agg(a.attname::TEXT ORDER BY a.attname) FROM pg_attribute a
             WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)) = ARRAY['attendance_date', 'student_id']
  LOOP
    EXECUTE format('ALTER TABLE public.mahaja_attendance DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mahaja_attendance_student_day_period_key') THEN
    ALTER TABLE public.mahaja_attendance ADD CONSTRAINT mahaja_attendance_student_day_period_key UNIQUE (student_id, attendance_date, period);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS mahaja_attendance_date_period_idx ON public.mahaja_attendance (attendance_date, period);

-- Old single status «خرج مبكرًا» = attended, then left early.
UPDATE public.mahaja_attendance
   SET status = 'present', checkout_status = 'left_early', checkout_by = coalesce(checkout_by, recorded_by)
 WHERE status = 'left_early';

-- ----------------------------------------------------------
-- 2. Classes (الحلقات) and their supervisors
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mahaja_classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  periods     TEXT NOT NULL DEFAULT 'both' CHECK (periods IN ('morning', 'evening', 'both')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.mahaja_class_students (
  class_id    UUID NOT NULL REFERENCES public.mahaja_classes(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.mahaja_students(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS mahaja_class_students_student_idx ON public.mahaja_class_students (student_id);
CREATE TABLE IF NOT EXISTS public.mahaja_class_supervisors (
  class_id    UUID NOT NULL REFERENCES public.mahaja_classes(id) ON DELETE CASCADE,
  admin_id    UUID NOT NULL REFERENCES public.system_admins(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, admin_id)
);
CREATE INDEX IF NOT EXISTS mahaja_class_supervisors_admin_idx ON public.mahaja_class_supervisors (admin_id);

-- Only reachable through the functions below.
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['mahaja_classes', 'mahaja_class_students', 'mahaja_class_supervisors'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------
-- 3. Who is calling, and what may they see
-- ----------------------------------------------------------
-- { label, admin_id, is_super, is_manager, class_ids }
-- is_manager = sees and manages every student (Super Admin, or Mahaja admin without classes).
CREATE OR REPLACE FUNCTION public.mahaja_attendance_scope(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v JSONB := public.admin_resolve(p_token); v_label TEXT; v_admin UUID; v_classes UUID[];
BEGIN
  IF v IS NULL THEN
    -- Older students-page tokens: full access, as before.
    v_label := public.mahaja_students_require_admin(p_token);
    RETURN jsonb_build_object('label', v_label, 'admin_id', NULL, 'is_super', false, 'is_manager', true, 'class_ids', '[]'::jsonb);
  END IF;
  IF NOT (v->>'is_super')::BOOLEAN AND NOT ((v->'sections') ? 'mahaja') THEN
    RAISE EXCEPTION 'ADMIN_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF (v->>'is_super')::BOOLEAN THEN
    RETURN jsonb_build_object('label', v->>'label', 'admin_id', v->>'id', 'is_super', true, 'is_manager', true, 'class_ids', '[]'::jsonb);
  END IF;
  v_admin := (v->>'id')::UUID;
  SELECT array_agg(s.class_id) INTO v_classes
    FROM public.mahaja_class_supervisors s JOIN public.mahaja_classes c ON c.id = s.class_id
   WHERE s.admin_id = v_admin;
  RETURN jsonb_build_object('label', v->>'label', 'admin_id', v_admin, 'is_super', false,
                            'is_manager', v_classes IS NULL, 'class_ids', to_jsonb(coalesce(v_classes, '{}'::UUID[])));
END $$;

-- Students this caller may record for a period (NULL period = any period).
CREATE OR REPLACE FUNCTION public.mahaja_scope_students(p_scope JSONB, p_period TEXT)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id FROM public.mahaja_students s WHERE (p_scope->>'is_manager')::BOOLEAN
  UNION
  SELECT cs.student_id
    FROM public.mahaja_class_students cs
    JOIN public.mahaja_classes c ON c.id = cs.class_id
   WHERE NOT (p_scope->>'is_manager')::BOOLEAN
     AND c.is_active
     AND c.id IN (SELECT jsonb_array_elements_text(p_scope->'class_ids')::UUID)
     AND (p_period IS NULL OR c.periods IN (p_period, 'both'));
$$;

CREATE OR REPLACE FUNCTION public.mahaja_attendance_check_args(p_date DATE, p_period TEXT)
RETURNS VOID LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_date IS NULL OR p_date > current_date + 1 OR p_date < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'MAHAJA_BAD_DATE' USING ERRCODE = '22023';
  END IF;
  IF p_period IS NULL OR p_period NOT IN ('morning', 'evening') THEN
    RAISE EXCEPTION 'MAHAJA_BAD_PERIOD' USING ERRCODE = '22023';
  END IF;
END $$;

-- ----------------------------------------------------------
-- 4. Attendance RPCs
-- ----------------------------------------------------------
-- What the attendance screen needs: who I am and the classes I can use.
CREATE OR REPLACE FUNCTION public.mahaja_attendance_context(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token);
BEGIN
  RETURN jsonb_build_object(
    'me', v_scope - 'class_ids',
    'classes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'periods', c.periods, 'is_active', c.is_active,
        'student_ids', coalesce((SELECT jsonb_agg(cs.student_id) FROM public.mahaja_class_students cs WHERE cs.class_id = c.id), '[]'::jsonb),
        'supervisors', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'label', coalesce(nullif(btrim(a.display_name), ''), a.username)))
                                   FROM public.mahaja_class_supervisors sv JOIN public.system_admins a ON a.id = sv.admin_id
                                  WHERE sv.class_id = c.id), '[]'::jsonb))
        ORDER BY c.name)
        FROM public.mahaja_classes c
       WHERE (v_scope->>'is_manager')::BOOLEAN
          OR (c.is_active AND c.id IN (SELECT jsonb_array_elements_text(v_scope->'class_ids')::UUID))), '[]'::jsonb));
END $$;

-- All records of a day (both periods) for the students this caller may see.
CREATE OR REPLACE FUNCTION public.mahaja_attendance_sheet(p_date DATE, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token);
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.period, a.recorded_at)
      FROM public.mahaja_attendance a
     WHERE a.attendance_date = p_date
       AND a.student_id IN (SELECT public.mahaja_scope_students(v_scope, NULL))), '[]'::jsonb);
END $$;

-- Entry: present / late (entry time recorded automatically, today only), absent, excused.
-- p_status NULL removes the record. p_note NULL keeps the current note, '' clears it.
CREATE OR REPLACE FUNCTION public.mahaja_attendance_mark(
  p_date DATE, p_period TEXT, p_student_ids UUID[], p_status TEXT, p_note TEXT DEFAULT NULL, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_scope JSONB := public.mahaja_attendance_scope(p_token);
  v_actor TEXT := v_scope->>'label';
  v_student UUID; v_prev public.mahaja_attendance; v_in BOOLEAN;
  v_note TEXT := CASE WHEN p_note IS NULL THEN NULL ELSE nullif(btrim(p_note), '') END;
  -- Times are recorded automatically for today only (a past day filled in later has no time).
  v_now TIMESTAMPTZ := CASE WHEN p_date = current_date THEN now() END;
BEGIN
  PERFORM public.mahaja_attendance_check_args(p_date, p_period);
  IF p_status IS NOT NULL AND p_status NOT IN ('present', 'absent', 'late', 'excused') THEN
    RAISE EXCEPTION 'MAHAJA_BAD_STATUS' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 300 THEN RAISE EXCEPTION 'MAHAJA_BAD_RECORDS' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_student_ids, '{}'::UUID[])) x
              WHERE x NOT IN (SELECT public.mahaja_scope_students(v_scope, p_period))) THEN
    RAISE EXCEPTION 'MAHAJA_NOT_YOUR_STUDENT' USING ERRCODE = '42501';
  END IF;
  v_in := p_status IN ('present', 'late');

  FOREACH v_student IN ARRAY coalesce(p_student_ids, '{}'::UUID[]) LOOP
    SELECT * INTO v_prev FROM public.mahaja_attendance
     WHERE student_id = v_student AND attendance_date = p_date AND period = p_period FOR UPDATE;

    IF p_status IS NULL THEN
      IF FOUND THEN
        DELETE FROM public.mahaja_attendance WHERE id = v_prev.id;
        INSERT INTO public.mahaja_student_log (student_id, action, details, actor)
        VALUES (v_student, 'attendance_cleared', jsonb_build_object('date', p_date, 'period', p_period), v_actor);
      END IF;
      CONTINUE;
    END IF;

    IF NOT FOUND THEN
      INSERT INTO public.mahaja_attendance (student_id, attendance_date, period, status, note, recorded_by, recorded_at, check_in_at)
      VALUES (v_student, p_date, p_period, p_status, v_note, v_actor, now(), CASE WHEN v_in THEN v_now END);
    ELSIF v_prev.status IS DISTINCT FROM p_status OR (p_note IS NOT NULL AND v_prev.note IS DISTINCT FROM v_note) THEN
      UPDATE public.mahaja_attendance SET
        status = p_status,
        note = CASE WHEN p_note IS NULL THEN note ELSE v_note END,
        recorded_by = v_actor, recorded_at = now(),
        -- Keep the original entry time when switching between present and late.
        check_in_at = CASE WHEN NOT v_in THEN NULL
                           WHEN v_prev.status IN ('present', 'late') THEN check_in_at
                           ELSE v_now END,
        checkout_status = CASE WHEN v_in THEN checkout_status END,
        check_out_at = CASE WHEN v_in THEN check_out_at END,
        checkout_by = CASE WHEN v_in THEN checkout_by END
      WHERE id = v_prev.id;
    ELSE
      CONTINUE;
    END IF;

    IF v_prev.status IS DISTINCT FROM p_status THEN
      INSERT INTO public.mahaja_student_log (student_id, action, details, actor)
      VALUES (v_student, 'attendance', jsonb_build_object('date', p_date, 'period', p_period, 'status', p_status,
              'previous', v_prev.status, 'note', v_note), v_actor);
    END IF;
  END LOOP;

  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM public.mahaja_attendance a
                    WHERE a.attendance_date = p_date AND a.period = p_period AND a.student_id = ANY (p_student_ids)), '[]'::jsonb);
END $$;

-- Exit: left (end of session) / left_early. NULL = still inside (removes the exit).
-- Exit time is recorded automatically (today only). Students not checked in (absent, excused,
-- not recorded) are skipped.
CREATE OR REPLACE FUNCTION public.mahaja_attendance_checkout(
  p_date DATE, p_period TEXT, p_student_ids UUID[], p_checkout TEXT, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_scope JSONB := public.mahaja_attendance_scope(p_token);
  v_actor TEXT := v_scope->>'label';
  r public.mahaja_attendance;
  v_now TIMESTAMPTZ := CASE WHEN p_date = current_date THEN now() END;
BEGIN
  PERFORM public.mahaja_attendance_check_args(p_date, p_period);
  IF p_checkout IS NOT NULL AND p_checkout NOT IN ('left', 'left_early') THEN
    RAISE EXCEPTION 'MAHAJA_BAD_STATUS' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_student_ids, '{}'::UUID[])) x
              WHERE x NOT IN (SELECT public.mahaja_scope_students(v_scope, p_period))) THEN
    RAISE EXCEPTION 'MAHAJA_NOT_YOUR_STUDENT' USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT * FROM public.mahaja_attendance
     WHERE attendance_date = p_date AND period = p_period AND student_id = ANY (p_student_ids)
       AND status IN ('present', 'late')
       AND checkout_status IS DISTINCT FROM p_checkout
     FOR UPDATE
  LOOP
    UPDATE public.mahaja_attendance SET
      checkout_status = p_checkout,
      check_out_at = CASE WHEN p_checkout IS NULL THEN NULL ELSE v_now END,
      checkout_by = CASE WHEN p_checkout IS NULL THEN NULL ELSE v_actor END
    WHERE id = r.id;
    INSERT INTO public.mahaja_student_log (student_id, action, details, actor)
    VALUES (r.student_id, 'checkout', jsonb_build_object('date', p_date, 'period', p_period,
            'checkout', p_checkout, 'previous', r.checkout_status), v_actor);
  END LOOP;

  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM public.mahaja_attendance a
                    WHERE a.attendance_date = p_date AND a.period = p_period AND a.student_id = ANY (p_student_ids)), '[]'::jsonb);
END $$;

-- Weekly (or any range up to 3 months) totals per student and period.
CREATE OR REPLACE FUNCTION public.mahaja_attendance_report(p_from DATE, p_to DATE, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token);
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 92 THEN
    RAISE EXCEPTION 'MAHAJA_BAD_DATE' USING ERRCODE = '22023';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'student_id', t.student_id, 'period', t.period, 'sessions', t.sessions,
      'present', t.present, 'late', t.late, 'absent', t.absent, 'excused', t.excused,
      'left', t.left_n, 'left_early', t.left_early))
    FROM (
      SELECT a.student_id, a.period, count(*) AS sessions,
             count(*) FILTER (WHERE a.status = 'present') AS present,
             count(*) FILTER (WHERE a.status = 'late') AS late,
             count(*) FILTER (WHERE a.status = 'absent') AS absent,
             count(*) FILTER (WHERE a.status = 'excused') AS excused,
             count(*) FILTER (WHERE a.checkout_status = 'left') AS left_n,
             count(*) FILTER (WHERE a.checkout_status = 'left_early') AS left_early
        FROM public.mahaja_attendance a
       WHERE a.attendance_date BETWEEN p_from AND p_to
         AND a.student_id IN (SELECT public.mahaja_scope_students(v_scope, NULL))
       GROUP BY a.student_id, a.period) t), '[]'::jsonb);
END $$;

-- ----------------------------------------------------------
-- 5. Classes management
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mahaja_require_manager(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token);
BEGIN
  IF NOT (v_scope->>'is_manager')::BOOLEAN THEN RAISE EXCEPTION 'ADMIN_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN v_scope;
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_class_save(p_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_require_manager(p_token); c public.mahaja_classes;
  v_periods TEXT := coalesce(nullif(p_data->>'periods', ''), 'both');
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO public.mahaja_classes (name, periods, is_active, created_by)
    VALUES (btrim(p_data->>'name'), v_periods, coalesce((p_data->>'is_active')::BOOLEAN, true), v_scope->>'label')
    RETURNING * INTO c;
  ELSE
    UPDATE public.mahaja_classes SET name = btrim(p_data->>'name'), periods = v_periods,
           is_active = coalesce((p_data->>'is_active')::BOOLEAN, is_active), updated_at = now()
     WHERE id = p_id RETURNING * INTO c;
    IF NOT FOUND THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN to_jsonb(c);
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_class_delete(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.mahaja_require_manager(p_token);
  -- Attendance records are kept: they belong to the students, not to the class.
  DELETE FROM public.mahaja_classes WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_class_set_students(p_class_id UUID, p_student_ids UUID[], p_token TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_n INTEGER;
BEGIN
  PERFORM public.mahaja_require_manager(p_token);
  IF NOT EXISTS (SELECT 1 FROM public.mahaja_classes WHERE id = p_class_id) THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  DELETE FROM public.mahaja_class_students WHERE class_id = p_class_id AND student_id <> ALL (coalesce(p_student_ids, '{}'::UUID[]));
  INSERT INTO public.mahaja_class_students (class_id, student_id)
  SELECT p_class_id, s.id FROM public.mahaja_students s WHERE s.id = ANY (coalesce(p_student_ids, '{}'::UUID[]))
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_n FROM public.mahaja_class_students WHERE class_id = p_class_id;
  RETURN v_n;
END $$;

-- Assigning supervisors is admin management: Super Admin only.
CREATE OR REPLACE FUNCTION public.mahaja_supervisor_options(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.admin_require_super(p_token);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'label', coalesce(nullif(btrim(a.display_name), ''), a.username),
                                                       'username', a.username, 'is_active', a.is_active) ORDER BY a.username)
                     FROM public.system_admins a
                    WHERE a.role <> 'Super Admin' AND 'mahaja' = ANY (coalesce(a.sections, '{}'::TEXT[]))), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_class_set_supervisors(p_class_id UUID, p_admin_ids UUID[], p_token TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_n INTEGER;
BEGIN
  PERFORM public.admin_require_super(p_token);
  IF NOT EXISTS (SELECT 1 FROM public.mahaja_classes WHERE id = p_class_id) THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  DELETE FROM public.mahaja_class_supervisors WHERE class_id = p_class_id AND admin_id <> ALL (coalesce(p_admin_ids, '{}'::UUID[]));
  INSERT INTO public.mahaja_class_supervisors (class_id, admin_id)
  SELECT p_class_id, a.id FROM public.system_admins a
   WHERE a.id = ANY (coalesce(p_admin_ids, '{}'::UUID[])) AND a.role <> 'Super Admin'
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_n FROM public.mahaja_class_supervisors WHERE class_id = p_class_id;
  RETURN v_n;
END $$;

-- ----------------------------------------------------------
-- 6. Previous attendance functions keep working (morning period)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mahaja_attendance_day(p_date DATE, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM public.mahaja_attendance a
                    WHERE a.attendance_date = p_date AND a.period = 'morning'
                      AND a.student_id IN (SELECT public.mahaja_scope_students(v_scope, NULL))), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_attendance_save(p_date DATE, p_records JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE r JSONB; v_status TEXT;
BEGIN
  IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'MAHAJA_BAD_RECORDS' USING ERRCODE = '22023'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_records) LOOP
    v_status := nullif(r->>'status', '');
    IF v_status = 'left_early' THEN
      PERFORM public.mahaja_attendance_mark(p_date, 'morning', ARRAY[(r->>'student_id')::UUID], 'present', coalesce(r->>'note', ''), p_token);
      PERFORM public.mahaja_attendance_checkout(p_date, 'morning', ARRAY[(r->>'student_id')::UUID], 'left_early', p_token);
    ELSE
      PERFORM public.mahaja_attendance_mark(p_date, 'morning', ARRAY[(r->>'student_id')::UUID], v_status, coalesce(r->>'note', ''), p_token);
    END IF;
  END LOOP;
  RETURN public.mahaja_attendance_day(p_date, p_token);
END $$;

-- ----------------------------------------------------------
-- 7. Grants
-- ----------------------------------------------------------
DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mahaja_attendance_scope(text)', 'public.mahaja_scope_students(jsonb, text)',
    'public.mahaja_require_manager(text)', 'public.mahaja_attendance_check_args(date, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.mahaja_attendance_context(text)', 'public.mahaja_attendance_sheet(date, text)',
    'public.mahaja_attendance_mark(date, text, uuid[], text, text, text)',
    'public.mahaja_attendance_checkout(date, text, uuid[], text, text)',
    'public.mahaja_attendance_report(date, date, text)',
    'public.mahaja_class_save(uuid, jsonb, text)', 'public.mahaja_class_delete(uuid, text)',
    'public.mahaja_class_set_students(uuid, uuid[], text)', 'public.mahaja_supervisor_options(text)',
    'public.mahaja_class_set_supervisors(uuid, uuid[], text)',
    'public.mahaja_attendance_day(date, text)', 'public.mahaja_attendance_save(date, jsonb, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
