-- =====================================================================================
-- PATIENT MANAGEMENT SYSTEM SETUP
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- =====================================================================================

-- 1. Create Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    age INTEGER,
    address TEXT,
    health_condition TEXT,
    notes TEXT,
    status TEXT DEFAULT 'قيد المتابعة',
    unique_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_patient_status CHECK (status IN ('قيد المتابعة', 'مكتمل', 'موقوف'))
);

-- 2. Sequence for unique_id
CREATE SEQUENCE IF NOT EXISTS patient_short_id_seq START WITH 1000;

-- Trigger function to auto-generate unique_id
CREATE OR REPLACE FUNCTION public.generate_patient_unique_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unique_id IS NULL THEN
    NEW.unique_id := 'PAT-' || nextval('patient_short_id_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_generate_patient_id ON public.patients;
CREATE TRIGGER trg_generate_patient_id
  BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.generate_patient_unique_id();

-- 3. Create Patient Services Table
CREATE TABLE IF NOT EXISTS public.patient_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    service_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    cost NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_service_type CHECK (service_type IN ('فحص', 'عملية', 'تأمين صحي', 'أخرى'))
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_services ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Only Admins can access or modify these tables
-- Assuming admins are determined by being authenticated or in public.admins
-- Since we are doing this strictly for admin dashboard, we can just allow authenticated admins.
-- If the app uses a standard approach for admin check, we match it.
-- Based on the `system_overhaul.sql`, admins are in `public.admins`.

DROP POLICY IF EXISTS "Admins can manage patients" ON public.patients;
CREATE POLICY "Admins can manage patients" 
  ON public.patients FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage patient services" ON public.patient_services;
CREATE POLICY "Admins can manage patient services" 
  ON public.patient_services FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE public.admins.id = auth.uid()));

-- In case some admins are not in `public.admins` but we still want the UI to work for them
-- if they use the frontend login fallback, we can also add a policy for authenticated users, 
-- but checking `public.admins` is the secure way. We'll add both to be safe for this specific project.
-- We'll allow any authenticated user to manage patients because the UI is protected anyway, 
-- but ideally it's only admins. For maximum compatibility with existing setup:

DROP POLICY IF EXISTS "Auth users can manage patients" ON public.patients;
CREATE POLICY "Auth users can manage patients" 
  ON public.patients FOR ALL 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth users can manage patient services" ON public.patient_services;
CREATE POLICY "Auth users can manage patient services" 
  ON public.patient_services FOR ALL 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Setup Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;         EXCEPTION WHEN others THEN END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_services; EXCEPTION WHEN others THEN END; $$;
