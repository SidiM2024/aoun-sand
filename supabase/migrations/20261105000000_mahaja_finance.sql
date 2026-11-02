-- ==========================================================
-- النظام المالي لمعهد المحجة البيضاء (مستقل)
-- Al-Mahaja institute finance: donations, expenses, student sponsorships, statistics, reports.
-- ==========================================================
-- Requires 20261104000000_mahaja_teams.sql (mahaja_require_manager). Safe to re-run.
-- New tables only (prefix mahaja_fin_). Completely separate from the association's finance
-- (donation_revenues, donation_expenses, ...): nothing is read from or written to them.
--
-- * Access: managers of the Mahaja section only (Super Admin, or a Mahaja admin who is not
--   limited to classes), through the section's existing access scope. Tables are not reachable
--   directly; everything goes through the functions below.
-- * Every addition, change and deletion is written to mahaja_fin_log (who, when, what).
-- * Sponsorships: amount per period and frequency; the amount due accrues per period from the
--   start date while the sponsorship is active (until its pause / end date otherwise); received
--   = recorded payments; overdue = due - received (never negative).
-- * Balance = donations + sponsorship payments received - expenses.
-- ==========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.mahaja_fin_donations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name     TEXT NOT NULL CHECK (char_length(btrim(donor_name)) BETWEEN 2 AND 120),
  donor_phone    TEXT CHECK (donor_phone IS NULL OR donor_phone ~ '^\+?[0-9 ]{6,20}$'),
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  donation_date  DATE NOT NULL,
  notes          TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by     TEXT, updated_by TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mahaja_fin_donations_date_idx ON public.mahaja_fin_donations (donation_date DESC);

CREATE TABLE IF NOT EXISTS public.mahaja_fin_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description    TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 2 AND 200),
  category       TEXT NOT NULL CHECK (char_length(btrim(category)) BETWEEN 2 AND 60),
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  expense_date   DATE NOT NULL,
  notes          TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by     TEXT, updated_by TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mahaja_fin_expenses_date_idx ON public.mahaja_fin_expenses (expense_date DESC);

CREATE TABLE IF NOT EXISTS public.mahaja_fin_sponsors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_name      TEXT NOT NULL CHECK (char_length(btrim(sponsor_name)) BETWEEN 2 AND 120),
  sponsor_phone     TEXT CHECK (sponsor_phone IS NULL OR sponsor_phone ~ '^\+?[0-9 ]{6,20}$'),
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),          -- per period, all sponsored students
  frequency         TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'semiannual', 'yearly', 'once')),
  start_date        DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  status_changed_at DATE,                                               -- pause / end date
  notes             TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by        TEXT, updated_by TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mahaja_fin_sponsor_students (
  sponsor_id  UUID NOT NULL REFERENCES public.mahaja_fin_sponsors(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.mahaja_students(id) ON DELETE CASCADE,
  PRIMARY KEY (sponsor_id, student_id)
);
CREATE INDEX IF NOT EXISTS mahaja_fin_sponsor_students_student_idx ON public.mahaja_fin_sponsor_students (student_id);

CREATE TABLE IF NOT EXISTS public.mahaja_fin_sponsor_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id    UUID NOT NULL REFERENCES public.mahaja_fin_sponsors(id) ON DELETE RESTRICT,
  amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date  DATE NOT NULL,
  period_label  TEXT CHECK (period_label IS NULL OR char_length(period_label) <= 60),
  notes         TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by    TEXT, updated_by TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mahaja_fin_sponsor_payments_idx ON public.mahaja_fin_sponsor_payments (sponsor_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS mahaja_fin_sponsor_payments_date_idx ON public.mahaja_fin_sponsor_payments (payment_date DESC);

CREATE TABLE IF NOT EXISTS public.mahaja_fin_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action      TEXT NOT NULL,          -- created / updated / deleted
  entity      TEXT NOT NULL,          -- donation / expense / sponsor / payment
  entity_id   UUID,
  summary     TEXT,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mahaja_fin_log_created_idx ON public.mahaja_fin_log (created_at DESC);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['mahaja_fin_donations', 'mahaja_fin_expenses', 'mahaja_fin_sponsors', 'mahaja_fin_sponsor_students',
                           'mahaja_fin_sponsor_payments', 'mahaja_fin_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------

-- Managers of the Mahaja section only; returns the acting admin's label.
CREATE OR REPLACE FUNCTION public.mahaja_fin_require(p_token TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_scope JSONB := public.mahaja_attendance_scope(p_token);
BEGIN
  PERFORM public.mahaja_require_manager(v_scope);
  RETURN coalesce(v_scope->>'label', '—');
END $$;
REVOKE ALL ON FUNCTION public.mahaja_fin_require(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mahaja_fin_period_months(p_frequency TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_frequency WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3 WHEN 'semiannual' THEN 6 WHEN 'yearly' THEN 12 ELSE NULL END;
$$;

-- Amount due by a date: one period at the start date, then one per period (paid in advance).
CREATE OR REPLACE FUNCTION public.mahaja_fin_sponsor_due(s public.mahaja_fin_sponsors, p_on DATE)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_until DATE := CASE WHEN s.status = 'active' THEN p_on ELSE least(p_on, coalesce(s.status_changed_at, p_on)) END;
        v_months INT := public.mahaja_fin_period_months(s.frequency); v_elapsed INT;
BEGIN
  IF v_until < s.start_date THEN RETURN 0; END IF;
  IF v_months IS NULL THEN RETURN s.amount; END IF;                     -- once
  v_elapsed := (extract(year FROM age(v_until, s.start_date)) * 12 + extract(month FROM age(v_until, s.start_date)))::INT;
  RETURN s.amount * (v_elapsed / v_months + 1);
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_fin_today() RETURNS DATE LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Africa/Nouakchott')::date;
$$;

CREATE OR REPLACE FUNCTION public.mahaja_fin_sponsor_json(s public.mahaja_fin_sponsors)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(s) || jsonb_build_object(
    'students', coalesce((SELECT jsonb_agg(jsonb_build_object('id', st.id, 'full_name', st.full_name, 'student_number', st.student_number)
                                           ORDER BY st.student_number)
                            FROM public.mahaja_fin_sponsor_students x JOIN public.mahaja_students st ON st.id = x.student_id
                           WHERE x.sponsor_id = s.id), '[]'::jsonb),
    'students_count', (SELECT count(*) FROM public.mahaja_fin_sponsor_students x WHERE x.sponsor_id = s.id),
    'received', (SELECT coalesce(sum(p.amount), 0) FROM public.mahaja_fin_sponsor_payments p WHERE p.sponsor_id = s.id),
    'due', public.mahaja_fin_sponsor_due(s, public.mahaja_fin_today()),
    'overdue', greatest(0, public.mahaja_fin_sponsor_due(s, public.mahaja_fin_today())
                          - (SELECT coalesce(sum(p.amount), 0) FROM public.mahaja_fin_sponsor_payments p WHERE p.sponsor_id = s.id)),
    'last_payment', (SELECT max(p.payment_date) FROM public.mahaja_fin_sponsor_payments p WHERE p.sponsor_id = s.id));
$$;
REVOKE ALL ON FUNCTION public.mahaja_fin_sponsor_json(public.mahaja_fin_sponsors) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mahaja_fin_write_log(p_action TEXT, p_entity TEXT, p_id UUID, p_summary TEXT, p_details JSONB, p_actor TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.mahaja_fin_log (action, entity, entity_id, summary, details, actor)
  VALUES (p_action, p_entity, p_id, p_summary, coalesce(p_details, '{}'::jsonb), p_actor);
$$;
REVOKE ALL ON FUNCTION public.mahaja_fin_write_log(text, text, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;

-- All money movements between two dates (donation +, payment +, expense -).
CREATE OR REPLACE FUNCTION public.mahaja_fin_movements(p_from DATE, p_to DATE)
RETURNS TABLE (kind TEXT, id UUID, op_date DATE, label TEXT, detail TEXT, amount NUMERIC, notes TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'donation', d.id, d.donation_date, d.donor_name, coalesce(d.donor_phone, ''), d.amount, d.notes, d.created_at
    FROM public.mahaja_fin_donations d WHERE d.donation_date BETWEEN p_from AND p_to
  UNION ALL
  SELECT 'expense', e.id, e.expense_date, e.description, e.category, e.amount, e.notes, e.created_at
    FROM public.mahaja_fin_expenses e WHERE e.expense_date BETWEEN p_from AND p_to
  UNION ALL
  SELECT 'payment', p.id, p.payment_date, s.sponsor_name, coalesce(p.period_label, ''), p.amount, p.notes, p.created_at
    FROM public.mahaja_fin_sponsor_payments p JOIN public.mahaja_fin_sponsors s ON s.id = p.sponsor_id
   WHERE p.payment_date BETWEEN p_from AND p_to;
$$;
REVOKE ALL ON FUNCTION public.mahaja_fin_movements(date, date) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------
-- Statistics
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mahaja_fin_overview(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_label TEXT := public.mahaja_fin_require(p_token); v_don NUMERIC; v_exp NUMERIC; v_rec NUMERIC; v_due NUMERIC; v_over NUMERIC;
BEGIN
  SELECT coalesce(sum(amount), 0) INTO v_don FROM public.mahaja_fin_donations;
  SELECT coalesce(sum(amount), 0) INTO v_exp FROM public.mahaja_fin_expenses;
  SELECT coalesce(sum(amount), 0) INTO v_rec FROM public.mahaja_fin_sponsor_payments;
  SELECT coalesce(sum(public.mahaja_fin_sponsor_due(s, public.mahaja_fin_today())), 0),
         coalesce(sum(greatest(0, public.mahaja_fin_sponsor_due(s, public.mahaja_fin_today())
                  - (SELECT coalesce(sum(p.amount), 0) FROM public.mahaja_fin_sponsor_payments p WHERE p.sponsor_id = s.id))), 0)
    INTO v_due, v_over FROM public.mahaja_fin_sponsors s;
  RETURN jsonb_build_object(
    'today', public.mahaja_fin_today(), 'me', v_label,
    'donations_total', v_don, 'donations_count', (SELECT count(*) FROM public.mahaja_fin_donations),
    'expenses_total', v_exp, 'expenses_count', (SELECT count(*) FROM public.mahaja_fin_expenses),
    'sponsorship_received', v_rec, 'sponsorship_due', v_due, 'sponsorship_overdue', v_over,
    'balance', v_don + v_rec - v_exp,
    'sponsors_count', (SELECT count(*) FROM public.mahaja_fin_sponsors),
    'sponsors_active', (SELECT count(*) FROM public.mahaja_fin_sponsors WHERE status = 'active'),
    'sponsored_students', (SELECT count(DISTINCT x.student_id) FROM public.mahaja_fin_sponsor_students x
                             JOIN public.mahaja_fin_sponsors s ON s.id = x.sponsor_id WHERE s.status = 'active'),
    'month', (SELECT jsonb_build_object(
        'donations', coalesce(sum(amount) FILTER (WHERE kind = 'donation'), 0),
        'payments', coalesce(sum(amount) FILTER (WHERE kind = 'payment'), 0),
        'expenses', coalesce(sum(amount) FILTER (WHERE kind = 'expense'), 0))
      FROM public.mahaja_fin_movements(date_trunc('month', public.mahaja_fin_today())::date, public.mahaja_fin_today())),
    'categories', coalesce((SELECT jsonb_agg(jsonb_build_object('category', category, 'total', total) ORDER BY total DESC)
                              FROM (SELECT category, sum(amount) AS total FROM public.mahaja_fin_expenses GROUP BY category) c), '[]'::jsonb),
    'latest', coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.op_date DESC, m.created_at DESC)
                          FROM (SELECT * FROM public.mahaja_fin_movements('1900-01-01', '2999-12-31')
                                 ORDER BY op_date DESC, created_at DESC LIMIT 10) m), '[]'::jsonb));
END $$;

-- ----------------------------------------------------------
-- Lists
-- ----------------------------------------------------------

-- p_kind: donations | expenses | sponsors | payments | movements | log. Optional dates / search / sponsor.
CREATE OR REPLACE FUNCTION public.mahaja_fin_list(p_kind TEXT, p_filters JSONB DEFAULT '{}'::jsonb, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_label TEXT := public.mahaja_fin_require(p_token);
  v_from DATE := coalesce(nullif(p_filters->>'from', '')::date, '1900-01-01');
  v_to   DATE := coalesce(nullif(p_filters->>'to', '')::date, '2999-12-31');
  v_q    TEXT := '%' || lower(btrim(coalesce(p_filters->>'q', ''))) || '%';
  v_type TEXT := nullif(p_filters->>'type', '');
  v_sponsor UUID := nullif(p_filters->>'sponsor_id', '')::uuid;
BEGIN
  CASE p_kind
    WHEN 'donations' THEN RETURN coalesce((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.donation_date DESC, d.created_at DESC) FROM public.mahaja_fin_donations d
       WHERE d.donation_date BETWEEN v_from AND v_to
         AND lower(d.donor_name || ' ' || coalesce(d.donor_phone, '') || ' ' || coalesce(d.notes, '')) LIKE v_q), '[]'::jsonb);
    WHEN 'expenses' THEN RETURN coalesce((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.expense_date DESC, e.created_at DESC) FROM public.mahaja_fin_expenses e
       WHERE e.expense_date BETWEEN v_from AND v_to AND (v_type IS NULL OR e.category = v_type)
         AND lower(e.description || ' ' || e.category || ' ' || coalesce(e.notes, '')) LIKE v_q), '[]'::jsonb);
    WHEN 'sponsors' THEN RETURN coalesce((
      SELECT jsonb_agg(public.mahaja_fin_sponsor_json(s) ORDER BY (s.status = 'active') DESC, s.sponsor_name) FROM public.mahaja_fin_sponsors s
       WHERE (v_type IS NULL OR s.status = v_type)
         AND lower(s.sponsor_name || ' ' || coalesce(s.sponsor_phone, '') || ' ' || coalesce(s.notes, '') || ' ' ||
                   coalesce((SELECT string_agg(st.full_name, ' ') FROM public.mahaja_fin_sponsor_students x
                               JOIN public.mahaja_students st ON st.id = x.student_id WHERE x.sponsor_id = s.id), '')) LIKE v_q), '[]'::jsonb);
    WHEN 'payments' THEN RETURN coalesce((
      SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object('sponsor_name', s.sponsor_name) ORDER BY p.payment_date DESC, p.created_at DESC)
        FROM public.mahaja_fin_sponsor_payments p JOIN public.mahaja_fin_sponsors s ON s.id = p.sponsor_id
       WHERE p.payment_date BETWEEN v_from AND v_to AND (v_sponsor IS NULL OR p.sponsor_id = v_sponsor)
         AND lower(s.sponsor_name || ' ' || coalesce(p.period_label, '') || ' ' || coalesce(p.notes, '')) LIKE v_q), '[]'::jsonb);
    WHEN 'movements' THEN RETURN coalesce((
      SELECT jsonb_agg(to_jsonb(m) ORDER BY m.op_date, m.created_at)
        FROM public.mahaja_fin_movements(v_from, v_to) m
       WHERE (v_type IS NULL OR m.kind = v_type)
         AND lower(m.label || ' ' || m.detail || ' ' || coalesce(m.notes, '')) LIKE v_q), '[]'::jsonb);
    WHEN 'log' THEN RETURN coalesce((
      SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC)
        FROM (SELECT * FROM public.mahaja_fin_log
               WHERE (created_at AT TIME ZONE 'Africa/Nouakchott')::date BETWEEN v_from AND v_to
                 AND (v_type IS NULL OR entity = v_type)
                 AND lower(coalesce(summary, '') || ' ' || coalesce(actor, '')) LIKE v_q
               ORDER BY created_at DESC LIMIT 1000) l), '[]'::jsonb);
    ELSE RAISE EXCEPTION 'FIN_BAD_KIND' USING ERRCODE = '22023';
  END CASE;
END $$;

-- ----------------------------------------------------------
-- Add / change / delete
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mahaja_fin_save(p_kind TEXT, p_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_label TEXT := public.mahaja_fin_require(p_token); v_id UUID := p_id; v_old JSONB; v_new JSONB;
  v_amount NUMERIC; v_date DATE;
  v_notes TEXT := nullif(btrim(coalesce(p_data->>'notes', '')), '');
  v_phone TEXT := nullif(regexp_replace(btrim(coalesce(p_data->>'phone', '')), '\s+', ' ', 'g'), '');
  v_ids UUID[]; v_entity TEXT; v_summary TEXT; s public.mahaja_fin_sponsors;
BEGIN
  -- Converted here (not in DECLARE) so that malformed values reach the handler below.
  v_amount := nullif(p_data->>'amount', '')::numeric;
  v_date := nullif(p_data->>'date', '')::date;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'FIN_BAD_AMOUNT' USING ERRCODE = '22023'; END IF;
  IF v_date IS NULL THEN RAISE EXCEPTION 'FIN_DATE_REQUIRED' USING ERRCODE = '22023'; END IF;

  CASE p_kind
    WHEN 'donation' THEN
      v_entity := 'donation';
      IF v_id IS NULL THEN
        INSERT INTO public.mahaja_fin_donations (donor_name, donor_phone, amount, donation_date, notes, created_by, updated_by)
        VALUES (btrim(p_data->>'name'), v_phone, v_amount, v_date, v_notes, v_label, v_label) RETURNING id INTO v_id;
      ELSE
        SELECT to_jsonb(d) INTO v_old FROM public.mahaja_fin_donations d WHERE id = v_id FOR UPDATE;
        IF v_old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
        UPDATE public.mahaja_fin_donations SET donor_name = btrim(p_data->>'name'), donor_phone = v_phone, amount = v_amount,
          donation_date = v_date, notes = v_notes, updated_by = v_label, updated_at = now() WHERE id = v_id;
      END IF;
      SELECT to_jsonb(d) INTO v_new FROM public.mahaja_fin_donations d WHERE id = v_id;
      v_summary := format('تبرع: %s — %s', v_new->>'donor_name', v_amount);

    WHEN 'expense' THEN
      v_entity := 'expense';
      IF v_id IS NULL THEN
        INSERT INTO public.mahaja_fin_expenses (description, category, amount, expense_date, notes, created_by, updated_by)
        VALUES (btrim(p_data->>'description'), btrim(p_data->>'category'), v_amount, v_date, v_notes, v_label, v_label) RETURNING id INTO v_id;
      ELSE
        SELECT to_jsonb(e) INTO v_old FROM public.mahaja_fin_expenses e WHERE id = v_id FOR UPDATE;
        IF v_old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
        UPDATE public.mahaja_fin_expenses SET description = btrim(p_data->>'description'), category = btrim(p_data->>'category'),
          amount = v_amount, expense_date = v_date, notes = v_notes, updated_by = v_label, updated_at = now() WHERE id = v_id;
      END IF;
      SELECT to_jsonb(e) INTO v_new FROM public.mahaja_fin_expenses e WHERE id = v_id;
      v_summary := format('مصروف: %s (%s) — %s', v_new->>'description', v_new->>'category', v_amount);

    WHEN 'sponsor' THEN
      v_entity := 'sponsor';
      IF coalesce(p_data->>'status', 'active') NOT IN ('active', 'paused', 'ended') THEN RAISE EXCEPTION 'FIN_BAD_STATUS' USING ERRCODE = '22023'; END IF;
      IF v_id IS NULL THEN
        INSERT INTO public.mahaja_fin_sponsors (sponsor_name, sponsor_phone, amount, frequency, start_date, status, status_changed_at, notes, created_by, updated_by)
        VALUES (btrim(p_data->>'name'), v_phone, v_amount, p_data->>'frequency', v_date, coalesce(p_data->>'status', 'active'),
                CASE WHEN coalesce(p_data->>'status', 'active') <> 'active' THEN coalesce(nullif(p_data->>'status_date', '')::date, public.mahaja_fin_today()) END,
                v_notes, v_label, v_label) RETURNING id INTO v_id;
      ELSE
        SELECT * INTO s FROM public.mahaja_fin_sponsors WHERE id = v_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
        v_old := public.mahaja_fin_sponsor_json(s);
        UPDATE public.mahaja_fin_sponsors SET sponsor_name = btrim(p_data->>'name'), sponsor_phone = v_phone, amount = v_amount,
          frequency = p_data->>'frequency', start_date = v_date, status = coalesce(p_data->>'status', 'active'),
          status_changed_at = CASE WHEN coalesce(p_data->>'status', 'active') = 'active' THEN NULL
                                   WHEN coalesce(p_data->>'status', 'active') = s.status THEN coalesce(nullif(p_data->>'status_date', '')::date, s.status_changed_at)
                                   ELSE coalesce(nullif(p_data->>'status_date', '')::date, public.mahaja_fin_today()) END,
          notes = v_notes, updated_by = v_label, updated_at = now() WHERE id = v_id;
      END IF;
      -- Sponsored students (from the Mahaja students list).
      SELECT coalesce(array_agg(DISTINCT x::uuid), '{}') INTO v_ids FROM jsonb_array_elements_text(coalesce(p_data->'student_ids', '[]'::jsonb)) x;
      IF (SELECT count(*) FROM public.mahaja_students WHERE id = ANY (v_ids)) <> coalesce(array_length(v_ids, 1), 0) THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
      END IF;
      DELETE FROM public.mahaja_fin_sponsor_students WHERE sponsor_id = v_id AND NOT (student_id = ANY (v_ids));
      INSERT INTO public.mahaja_fin_sponsor_students (sponsor_id, student_id) SELECT v_id, x FROM unnest(v_ids) x ON CONFLICT DO NOTHING;
      SELECT public.mahaja_fin_sponsor_json(x) INTO v_new FROM public.mahaja_fin_sponsors x WHERE id = v_id;
      v_summary := format('كفالة: %s — %s (%s طالب)', v_new->>'sponsor_name', v_amount, v_new->>'students_count');

    WHEN 'payment' THEN
      v_entity := 'payment';
      IF NOT EXISTS (SELECT 1 FROM public.mahaja_fin_sponsors WHERE id = nullif(p_data->>'sponsor_id', '')::uuid) THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
      END IF;
      IF v_id IS NULL THEN
        INSERT INTO public.mahaja_fin_sponsor_payments (sponsor_id, amount, payment_date, period_label, notes, created_by, updated_by)
        VALUES ((p_data->>'sponsor_id')::uuid, v_amount, v_date, nullif(btrim(coalesce(p_data->>'period_label', '')), ''), v_notes, v_label, v_label)
        RETURNING id INTO v_id;
      ELSE
        SELECT to_jsonb(p) INTO v_old FROM public.mahaja_fin_sponsor_payments p WHERE id = v_id FOR UPDATE;
        IF v_old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
        UPDATE public.mahaja_fin_sponsor_payments SET sponsor_id = (p_data->>'sponsor_id')::uuid, amount = v_amount, payment_date = v_date,
          period_label = nullif(btrim(coalesce(p_data->>'period_label', '')), ''), notes = v_notes, updated_by = v_label, updated_at = now()
         WHERE id = v_id;
      END IF;
      SELECT to_jsonb(p) || jsonb_build_object('sponsor_name', s2.sponsor_name) INTO v_new
        FROM public.mahaja_fin_sponsor_payments p JOIN public.mahaja_fin_sponsors s2 ON s2.id = p.sponsor_id WHERE p.id = v_id;
      v_summary := format('دفعة كفالة: %s — %s', v_new->>'sponsor_name', v_amount);

    ELSE RAISE EXCEPTION 'FIN_BAD_KIND' USING ERRCODE = '22023';
  END CASE;

  PERFORM public.mahaja_fin_write_log(CASE WHEN p_id IS NULL THEN 'created' ELSE 'updated' END, v_entity, v_id, v_summary,
                                      jsonb_build_object('before', v_old, 'after', v_new), v_label);
  RETURN v_new;
EXCEPTION
  WHEN check_violation THEN RAISE EXCEPTION 'FIN_INVALID_DATA' USING ERRCODE = '22023';
  WHEN not_null_violation THEN RAISE EXCEPTION 'FIN_MISSING_DATA' USING ERRCODE = '22023';
  WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'FIN_INVALID_DATA' USING ERRCODE = '22023';
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_fin_delete(p_kind TEXT, p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_label TEXT := public.mahaja_fin_require(p_token); v_old JSONB; v_summary TEXT;
BEGIN
  CASE p_kind
    WHEN 'donation' THEN
      DELETE FROM public.mahaja_fin_donations WHERE id = p_id RETURNING to_jsonb(mahaja_fin_donations.*) INTO v_old;
      v_summary := format('حذف تبرع: %s — %s', v_old->>'donor_name', v_old->>'amount');
    WHEN 'expense' THEN
      DELETE FROM public.mahaja_fin_expenses WHERE id = p_id RETURNING to_jsonb(mahaja_fin_expenses.*) INTO v_old;
      v_summary := format('حذف مصروف: %s — %s', v_old->>'description', v_old->>'amount');
    WHEN 'payment' THEN
      DELETE FROM public.mahaja_fin_sponsor_payments WHERE id = p_id RETURNING to_jsonb(mahaja_fin_sponsor_payments.*) INTO v_old;
      v_summary := format('حذف دفعة كفالة — %s', v_old->>'amount');
    WHEN 'sponsor' THEN
      -- Payments are financial records: a sponsorship with payments is ended, not deleted.
      IF EXISTS (SELECT 1 FROM public.mahaja_fin_sponsor_payments WHERE sponsor_id = p_id) THEN
        RAISE EXCEPTION 'FIN_SPONSOR_HAS_PAYMENTS' USING ERRCODE = '22023';
      END IF;
      DELETE FROM public.mahaja_fin_sponsors WHERE id = p_id RETURNING to_jsonb(mahaja_fin_sponsors.*) INTO v_old;
      v_summary := format('حذف كفالة: %s', v_old->>'sponsor_name');
    ELSE RAISE EXCEPTION 'FIN_BAD_KIND' USING ERRCODE = '22023';
  END CASE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.mahaja_fin_write_log('deleted', p_kind, p_id, v_summary, jsonb_build_object('before', v_old), v_label);
END $$;

-- Mahaja students to link to a sponsorship (managers only).
CREATE OR REPLACE FUNCTION public.mahaja_fin_student_options(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_label TEXT := public.mahaja_fin_require(p_token);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'full_name', s.full_name, 'student_number', s.student_number, 'status', s.status,
                                                       'sponsored', EXISTS (SELECT 1 FROM public.mahaja_fin_sponsor_students x JOIN public.mahaja_fin_sponsors sp ON sp.id = x.sponsor_id
                                                                            WHERE x.student_id = s.id AND sp.status = 'active'))
                                    ORDER BY s.student_number)
                     FROM public.mahaja_students s), '[]'::jsonb);
END $$;

DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mahaja_fin_overview(text)', 'public.mahaja_fin_list(text, jsonb, text)', 'public.mahaja_fin_save(text, uuid, jsonb, text)',
    'public.mahaja_fin_delete(text, uuid, text)', 'public.mahaja_fin_student_options(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.mahaja_fin_sponsor_due(public.mahaja_fin_sponsors, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mahaja_fin_period_months(text) FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
