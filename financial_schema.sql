-- =====================================================
-- الوحدة المالية - Financial Module Schema
-- قم بتشغيل هذا الملف في Supabase SQL Editor
-- =====================================================

-- 1. جدول مداخيل الانتساب (Membership Revenues)
CREATE TABLE IF NOT EXISTS membership_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_number BIGSERIAL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  member_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول مداخيل التبرعات (Donation Revenues)
CREATE TABLE IF NOT EXISTS donation_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول مصاريف الانتساب (Membership Expenses)
CREATE TABLE IF NOT EXISTS membership_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  beneficiary TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول مصاريف التبرعات (Donation Expenses)
CREATE TABLE IF NOT EXISTS donation_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_source TEXT,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  beneficiary TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_membership_revenues_date ON membership_revenues(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_membership_revenues_user ON membership_revenues(user_id);
CREATE INDEX IF NOT EXISTS idx_donation_revenues_date ON donation_revenues(donation_date DESC);
CREATE INDEX IF NOT EXISTS idx_membership_expenses_date ON membership_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_donation_expenses_date ON donation_expenses(expense_date DESC);

-- =====================================================
-- RLS Policies (Row Level Security)
-- =====================================================

-- Enable RLS
ALTER TABLE membership_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_expenses ENABLE ROW LEVEL SECURITY;

-- Allow admin full access (using service role / anon for admin panel)
CREATE POLICY "Allow all for authenticated" ON membership_revenues
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON donation_revenues
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON membership_expenses
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON donation_expenses
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- Storage bucket for financial receipts/invoices
-- =====================================================
-- Run this separately if needed:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('financial-docs', 'financial-docs', true)
-- ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Sample data (optional - remove before production)
-- =====================================================
-- INSERT INTO membership_revenues (member_name, amount, payment_method, payment_date)
-- VALUES ('أحمد محمد', 5000, 'cash', CURRENT_DATE);
