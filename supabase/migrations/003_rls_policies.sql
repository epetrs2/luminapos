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
