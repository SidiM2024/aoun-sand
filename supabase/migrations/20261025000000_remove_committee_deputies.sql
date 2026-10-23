-- ==========================================================
-- إلغاء مناصب نواب مسؤولي اللجان + تأكيد صوت واحد لكل عضو في كل منصب
-- Remove the committee deputy positions; keep one head per committee and the executive office.
-- ==========================================================
-- Requires 20261024000000_general_elections.sql. Safe to re-run.
--
-- * New elections: only «مسؤول <اللجنة>» is created for each committee.
-- * Existing elections: deputy positions without any application are deleted; the few that
--   already have applications are disabled (hidden from members, no applications, no votes)
--   and their open applications are closed with a note. No vote is ever deleted.
-- * Voting stays independent per position: the primary key (position_id, user_id) of
--   election_position_voters allows exactly one vote per member and position, and any
--   number of positions. Re-asserted below.
-- ==========================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.general_seed_positions(p_election UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c TEXT; i INT := 0;
BEGIN
  INSERT INTO public.election_positions (election_id, group_key, role, title, sort_order) VALUES
    (p_election, 'executive', 'president', 'الرئيس', 1),
    (p_election, 'executive', 'vice_president', 'نائب الرئيس', 2),
    (p_election, 'executive', 'secretary_general', 'الأمين العام', 3)
  ON CONFLICT (election_id, title) DO NOTHING;
  FOREACH c IN ARRAY ARRAY['اللجنة الانتسابية', 'اللجنة الرقمية', 'اللجنة الإعلامية', 'اللجنة المالية',
                           'اللجنة التعليمية', 'لجنة التنظيم والتنسيق', 'لجنة العلاقات الخارجية', 'لجنة المرضى'] LOOP
    i := i + 1;
    INSERT INTO public.election_positions (election_id, group_key, committee, role, title, sort_order)
    VALUES (p_election, 'committee', c, 'head', 'مسؤول ' || c, 10 + i)
    ON CONFLICT (election_id, title) DO NOTHING;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.general_seed_positions(uuid) FROM PUBLIC, anon, authenticated;

-- Existing elections ------------------------------------------------------------
-- 1. Deputy positions nobody applied to: removed.
DELETE FROM public.election_positions p
 WHERE p.group_key = 'committee' AND p.role = 'deputy'
   AND NOT EXISTS (SELECT 1 FROM public.election_applications a WHERE a.position_id = p.id);

-- 2. Deputy positions with applications: disabled (kept only as history).
UPDATE public.election_positions SET is_active = false
 WHERE group_key = 'committee' AND role = 'deputy' AND is_active;

-- 3. Their open applications are closed, unless votes were already cast for that position.
UPDATE public.election_applications a
   SET status = 'rejected', review_note = 'أُلغي منصب نائب مسؤول اللجنة من الانتخابات.',
       reviewed_by = 'النظام', reviewed_at = now(), updated_at = now()
  FROM public.election_positions p
 WHERE p.id = a.position_id AND p.group_key = 'committee' AND p.role = 'deputy'
   AND a.status IN ('pending', 'approved')
   AND NOT EXISTS (SELECT 1 FROM public.election_position_ballots b WHERE b.position_id = p.id);

-- 4. Committee heads keep a compact order.
UPDATE public.election_positions p SET sort_order = 10 + x.n
  FROM (SELECT id, row_number() OVER (PARTITION BY election_id ORDER BY sort_order, title) AS n
          FROM public.election_positions WHERE group_key = 'committee' AND role = 'head') x
 WHERE p.id = x.id AND p.sort_order IS DISTINCT FROM 10 + x.n;

-- One vote per member and position (independent between positions) ----------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.election_position_voters'::regclass AND c.contype IN ('p', 'u')
       AND (SELECT array_agg(a.attname::TEXT ORDER BY a.attname) FROM pg_attribute a
             WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)) = ARRAY['position_id', 'user_id']) THEN
    ALTER TABLE public.election_position_voters ADD CONSTRAINT election_position_voters_one_vote UNIQUE (position_id, user_id);
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
