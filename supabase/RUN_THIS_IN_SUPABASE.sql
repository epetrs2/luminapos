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
-- ============================================================================
-- LuminaPOS - Migration 002: Atomic ACID RPC Functions (PostgreSQL)
-- ============================================================================
-- Guarantees stock, customer debt, transactions, and cash register NEVER desync,
-- even with multiple POS devices (Web, Mac, Android) selling simultaneously.

-- 1. ATOMIC CUSTOMER PAYMENT (FIFO ticket settlement + debt reduction + cash movement)
CREATE OR REPLACE FUNCTION public.rpc_register_customer_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_channel TEXT DEFAULT 'CASH',
  p_user_id UUID DEFAULT auth.uid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_amount NUMERIC(12,2);
  v_remaining NUMERIC(12,2);
  v_tx RECORD;
  v_tx_due NUMERIC(12,2);
  v_apply NUMERIC(12,2);
  v_new_paid NUMERIC(12,2);
  v_new_status TEXT;
  v_shift_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del abono debe ser mayor a 0';
  END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  v_amount := LEAST(ROUND(p_amount, 2), ROUND(v_customer.current_debt, 2));
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'El cliente no tiene deuda pendiente';
  END IF;

  -- Update customer debt
  UPDATE public.customers
  SET current_debt = CASE WHEN ROUND(current_debt - v_amount, 2) < 0.01 THEN 0 ELSE ROUND(current_debt - v_amount, 2) END
  WHERE id = p_customer_id;

  -- Apply FIFO across unpaid transactions
  v_remaining := v_amount;
  FOR v_tx IN
    SELECT id, total, amount_paid
    FROM public.transactions
    WHERE customer_id = p_customer_id
      AND status = 'completed'
      AND payment_status IN ('pending', 'partial')
    ORDER BY date ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0.005;
    v_tx_due := ROUND(GREATEST(0, v_tx.total - COALESCE(v_tx.amount_paid, 0)), 2);
    IF v_tx_due > 0 THEN
      v_apply := LEAST(v_tx_due, v_remaining);
      v_new_paid := ROUND(COALESCE(v_tx.amount_paid, 0) + v_apply, 2);
      v_new_status := CASE WHEN v_new_paid >= v_tx.total - 0.01 THEN 'paid' ELSE 'partial' END;
      UPDATE public.transactions
      SET amount_paid = CASE WHEN v_new_status = 'paid' THEN total ELSE v_new_paid END,
          payment_status = v_new_status
      WHERE id = v_tx.id;
      v_remaining := ROUND(v_remaining - v_apply, 2);
    END IF;
  END LOOP;

  -- Link to open cash shift if CASH
  SELECT id INTO v_shift_id FROM public.cash_shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;

  INSERT INTO public.cash_movements (shift_id, customer_id, type, amount, description, category, sub_category, channel, created_by)
  VALUES (
    CASE WHEN p_channel = 'CASH' THEN v_shift_id ELSE NULL END,
    p_customer_id,
    'DEPOSIT',
    v_amount,
    CASE WHEN p_channel = 'VIRTUAL' THEN 'Abono a cuenta cliente (Banco/Transf.)' ELSE 'Abono a cuenta cliente' END,
    'SALES',
    'DEBT_PAYMENT',
    CASE WHEN p_channel IN ('CASH', 'VIRTUAL') THEN p_channel ELSE 'CASH' END,
    p_user_id
  );

  RETURN jsonb_build_object('status', 'ok', 'applied', v_amount);
END;
$$;

-- 2. ATOMIC SALE CANCELLATION (Idempotent: reverses stock, customer debt, and paid cash)
CREATE OR REPLACE FUNCTION public.rpc_cancel_sale(
  p_transaction_id UUID,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_item RECORD;
  v_pending NUMERIC(12,2);
  v_shift_id UUID;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transacción no encontrada';
  END IF;
  IF v_tx.status = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'already_cancelled');
  END IF;

  -- 1. Restore stock + Kardex
  FOR v_item IN SELECT * FROM public.transaction_items WHERE transaction_id = p_transaction_id LOOP
    IF v_item.variant_id IS NOT NULL THEN
      UPDATE public.product_variants SET stock = ROUND(stock + v_item.quantity, 3) WHERE id = v_item.variant_id;
    END IF;
    IF v_item.product_id IS NOT NULL THEN
      UPDATE public.products SET stock = ROUND(stock + v_item.quantity, 3) WHERE id = v_item.product_id;
      INSERT INTO public.inventory_movements (product_id, variant_id, delta, reason, reference_id, created_by)
      VALUES (v_item.product_id, v_item.variant_id, v_item.quantity, 'SALE_CANCEL', v_tx.ticket_number, p_user_id);
    END IF;
  END LOOP;

  -- 2. Revert unpaid customer debt
  IF v_tx.customer_id IS NOT NULL AND v_tx.payment_status IN ('pending', 'partial') THEN
    v_pending := ROUND(GREATEST(0, v_tx.total - COALESCE(v_tx.amount_paid, 0)), 2);
    IF v_pending > 0 THEN
      UPDATE public.customers
      SET current_debt = ROUND(GREATEST(0, current_debt - v_pending), 2)
      WHERE id = v_tx.customer_id;
    END IF;
  END IF;

  -- 3. Refund paid amount in cash_movements
  SELECT id INTO v_shift_id FROM public.cash_shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
  IF COALESCE(v_tx.amount_paid, 0) > 0 THEN
    INSERT INTO public.cash_movements (shift_id, transaction_id, customer_id, type, amount, description, category, channel, created_by)
    VALUES (
      CASE WHEN v_tx.payment_method IN ('cash', 'credit') THEN v_shift_id ELSE NULL END,
      v_tx.id,
      v_tx.customer_id,
      'WITHDRAWAL',
      v_tx.amount_paid,
      'Devolución por anulación #' || v_tx.ticket_number,
      'SALES',
      CASE WHEN v_tx.payment_method IN ('cash', 'credit') THEN 'CASH' ELSE 'VIRTUAL' END,
      p_user_id
    );
  END IF;

  UPDATE public.transactions SET status = 'cancelled' WHERE id = p_transaction_id;

  RETURN jsonb_build_object('status', 'cancelled', 'ticket', v_tx.ticket_number);
END;
$$;
-- ============================================================================
-- LuminaPOS - Migration 003: Row Level Security (RLS) & Realtime Publication
-- ============================================================================

-- Helper to get current authenticated user's role safely
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active = TRUE;
$$;

-- Enable RLS on ALL tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles','business_settings','categories','products','product_variants',
    'inventory_movements','customers','suppliers','purchases','purchase_items',
    'cash_shifts','cash_movements','transactions','transaction_items',
    'transaction_returns','orders','order_items','period_closures','activity_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- PROFILES: users can read all active profiles; only ADMIN can modify roles/users
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.get_my_role() = 'ADMIN') WITH CHECK (public.get_my_role() = 'ADMIN');

-- BUSINESS SETTINGS: everyone authenticated can read; only ADMIN can update
CREATE POLICY "settings_read" ON public.business_settings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "settings_admin_write" ON public.business_settings FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'ADMIN') WITH CHECK (public.get_my_role() = 'ADMIN');

-- CATALOG (categories, products, product_variants): everyone reads; MANAGER/ADMIN write
CREATE POLICY "categories_read" ON public.categories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "categories_mgr_write" ON public.categories FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "products_read" ON public.products FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "products_mgr_write" ON public.products FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "variants_read" ON public.product_variants FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "variants_mgr_write" ON public.product_variants FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "inv_mov_read" ON public.inventory_movements FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "inv_mov_insert" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (TRUE);

-- CUSTOMERS & ORDERS: all authenticated POS users can read/insert/update; only MANAGER/ADMIN delete
CREATE POLICY "customers_read_write" ON public.customers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "customers_insert_update" ON public.customers FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "customers_delete_mgr" ON public.customers FOR DELETE TO authenticated USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "orders_all_auth" ON public.orders FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "order_items_all_auth" ON public.order_items FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- SUPPLIERS & PURCHASES: MANAGER/ADMIN only
CREATE POLICY "suppliers_mgr" ON public.suppliers FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));
CREATE POLICY "purchases_mgr" ON public.purchases FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));
CREATE POLICY "purchase_items_mgr" ON public.purchase_items FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));

-- TRANSACTIONS & CASH: all authenticated can read/create; updates/returns restricted to MANAGER/ADMIN (or RPC)
CREATE POLICY "tx_read" ON public.transactions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "tx_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "tx_update_mgr" ON public.transactions FOR UPDATE TO authenticated USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "tx_items_read" ON public.transaction_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "tx_items_insert" ON public.transaction_items FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "tx_returns_mgr" ON public.transaction_returns FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "shifts_all_auth" ON public.cash_shifts FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "cash_mov_read_insert" ON public.cash_movements FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "cash_mov_insert" ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "cash_mov_delete_mgr" ON public.cash_movements FOR DELETE TO authenticated USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

-- PERIOD CLOSURES & ACTIVITY LOGS
CREATE POLICY "closures_read" ON public.period_closures FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "closures_admin_write" ON public.period_closures FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "logs_read_mgr" ON public.activity_logs FOR SELECT TO authenticated USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));
CREATE POLICY "logs_insert_auth" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

-- Enable Supabase Realtime for multi-device sync (Web, Mac, Android)
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.products,
  public.product_variants,
  public.customers,
  public.orders,
  public.transactions,
  public.cash_movements,
  public.cash_shifts;
