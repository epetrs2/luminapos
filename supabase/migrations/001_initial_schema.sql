-- ============================================================================
-- LuminaPOS - Migration 001: Solid Relational PostgreSQL Schema (Supabase)
-- ============================================================================
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. PROFILES (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CASHIER' CHECK (role IN ('ADMIN', 'MANAGER', 'CASHIER')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BUSINESS SETTINGS (Single row per workspace)
CREATE TABLE IF NOT EXISTS public.business_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Mi Negocio',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'MXN',
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  enable_tax BOOLEAN NOT NULL DEFAULT FALSE,
  logo_url TEXT,
  receipt_logo_url TEXT,
  receipt_header TEXT DEFAULT '',
  receipt_footer TEXT DEFAULT 'Gracias por su preferencia',
  ticket_paper_width TEXT NOT NULL DEFAULT '58mm' CHECK (ticket_paper_width IN ('58mm', '80mm')),
  invoice_padding INTEGER NOT NULL DEFAULT 10,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  budget_config JSONB NOT NULL DEFAULT '{"expensesPercentage":50,"investmentPercentage":30,"profitPercentage":20,"cycleType":"MONTHLY","cycleLength":30}'::jsonb,
  sound_config JSONB NOT NULL DEFAULT '{"enabled":true,"volume":0.5,"saleSound":"SUCCESS","errorSound":"ERROR","clickSound":"POP","notificationSound":"NOTE"}'::jsonb,
  security_config JSONB NOT NULL DEFAULT '{"autoLockMinutes":0,"blurAppOnBackground":false}'::jsonb,
  print_config JSONB NOT NULL DEFAULT '{"customerCopyBehavior":"ASK"}'::jsonb,
  production_doc JSONB NOT NULL DEFAULT '{"title":"Orden de Producción","showPrices":false,"showCustomerContact":true,"showDates":true,"customFooter":""}'::jsonb,
  next_ticket_seq INTEGER NOT NULL DEFAULT 1,
  next_customer_seq INTEGER NOT NULL DEFAULT 1,
  next_order_seq INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.business_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.categories (name) VALUES ('General') ON CONFLICT (name) DO NOTHING;

-- 4. PRODUCTS & VARIANTS
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  category TEXT NOT NULL DEFAULT 'General',
  type TEXT NOT NULL DEFAULT 'PRODUCT' CHECK (type IN ('PRODUCT', 'SERVICE', 'SUPPLY')),
  unit TEXT NOT NULL DEFAULT 'PIECE',
  presentation_value NUMERIC(12,3),
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  has_variants BOOLEAN NOT NULL DEFAULT FALSE,
  is_consignment BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

-- 5. INVENTORY MOVEMENTS (Immutable Kardex)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  delta NUMERIC(12,3) NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('SALE', 'SALE_CANCEL', 'RETURN', 'PURCHASE', 'PURCHASE_DELETE', 'ADJUSTMENT', 'PRODUCTION')),
  reference_id TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_movements_product ON public.inventory_movements(product_id, created_at DESC);

-- 6. CUSTOMERS (CRM & Credit)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  client_type TEXT NOT NULL DEFAULT 'INDIVIDUAL' CHECK (client_type IN ('INDIVIDUAL', 'BUSINESS')),
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  current_debt NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_debt >= 0),
  has_unlimited_credit BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SUPPLIERS & PURCHASES
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  name TEXT NOT NULL,
  contact_person TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_name TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  channel TEXT NOT NULL DEFAULT 'CASH' CHECK (channel IN ('CASH', 'VIRTUAL')),
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  variant_name TEXT,
  name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0)
);

-- 8. CASH SHIFTS & CASH MOVEMENTS
CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opened_by UUID REFERENCES public.profiles(id),
  closed_by UUID REFERENCES public.profiles(id),
  opening_fund NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_fund >= 0),
  expected_cash NUMERIC(12,2),
  declared_cash NUMERIC(12,2),
  difference NUMERIC(12,2),
  z_report_data JSONB,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED'))
);

-- 9. TRANSACTIONS, ITEMS & IMMUTABLE RETURNS
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_name TEXT,
  shift_id UUID REFERENCES public.cash_shifts(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'split', 'credit')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'pending', 'partial')),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  tendered_amount NUMERIC(12,2),
  split_details JSONB,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'returned')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON public.transactions(customer_id);

CREATE TABLE IF NOT EXISTS public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  variant_name TEXT,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  unit TEXT DEFAULT 'PIECE',
  is_consignment BOOLEAN NOT NULL DEFAULT FALSE,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tx_items_tx ON public.transaction_items(transaction_id);

CREATE TABLE IF NOT EXISTS public.transaction_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  items JSONB NOT NULL,
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES public.cash_shifts(id),
  transaction_id UUID REFERENCES public.transactions(id),
  purchase_id UUID REFERENCES public.purchases(id),
  customer_id UUID REFERENCES public.customers(id),
  type TEXT NOT NULL CHECK (type IN ('OPEN', 'CLOSE', 'EXPENSE', 'DEPOSIT', 'WITHDRAWAL')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  description TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'OTHER',
  sub_category TEXT,
  channel TEXT NOT NULL DEFAULT 'CASH' CHECK (channel IN ('CASH', 'VIRTUAL')),
  is_z_cut BOOLEAN NOT NULL DEFAULT FALSE,
  z_report_data JSONB,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_cash_movements_date ON public.cash_movements(date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_customer ON public.cash_movements(customer_id);

-- 10. ORDERS (Production / Pedidos)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Cliente General',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_date DATE,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'READY', 'COMPLETED')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'HIGH')),
  notes TEXT,
  stock_added BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  variant_name TEXT,
  name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0)
);

-- 11. PERIOD CLOSURES & ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.period_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by UUID REFERENCES public.profiles(id),
  report_data JSONB NOT NULL,
  UNIQUE(period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_ts ON public.activity_logs(timestamp DESC);

-- Apply updated_at triggers
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles','business_settings','products','product_variants','customers','suppliers','transactions','orders']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s;', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', tbl, tbl);
  END LOOP;
END $$;
