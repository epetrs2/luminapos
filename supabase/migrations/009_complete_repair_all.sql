-- ============================================================================
-- LuminaPOS - Migration 009: MASTER COMPLETE REPAIR (Idempotent All-in-One)
-- ============================================================================
-- Safe to run anytime in Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- Repairs missing columns, backfills ADMIN profile for existing auth users,
-- installs all RPCs/triggers (004, 005, 007, 008), recreates all RLS policies,
-- and enables Realtime on every POS table.

-- 1. Ensure all required columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS delivery_signature JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_added BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill public.profiles for ALL existing auth.users (and guarantee ADMIN)
INSERT INTO public.profiles (id, username, email, full_name, role, active, last_login)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'username'), ''), split_part(u.email, '@', 1)) || '_' || substr(replace(u.id::text, '-', ''), 1, 4),
  u.email,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
  'ADMIN',
  TRUE,
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Backfill email on existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Ensure owner account (and at least one user) is active ADMIN
UPDATE public.profiles
SET role = 'ADMIN', active = TRUE
WHERE lower(email) = 'antoniosalemdet@gmail.com'
   OR id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1);

-- 3. Helper function for RLS role check
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active = TRUE;
$$;

-- 4. Auto-create profile trigger on new auth signups (Migration 004 + 005)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_count INTEGER;
  v_role TEXT;
  v_base_username TEXT;
  v_username TEXT;
  v_full_name TEXT;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM public.profiles;
  v_role := CASE WHEN v_user_count = 0 THEN 'ADMIN' ELSE 'CASHIER' END;

  v_base_username := regexp_replace(
    lower(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''), split_part(NEW.email, '@', 1))),
    '[^a-z0-9._-]',
    '',
    'g'
  );
  IF v_base_username = '' THEN
    v_base_username := 'user';
  END IF;

  v_username := v_base_username;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) THEN
    v_username := v_base_username || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  END IF;

  v_full_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), v_username);

  INSERT INTO public.profiles (id, username, email, full_name, role, active, last_login)
  VALUES (NEW.id, v_username, NEW.email, v_full_name, v_role, TRUE, NOW())
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        last_login = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5. Admin profile update RPC (Migration 005)
CREATE OR REPLACE FUNCTION public.rpc_admin_update_profile(
  p_target_id UUID,
  p_full_name TEXT,
  p_role TEXT,
  p_active BOOLEAN
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_target public.profiles;
  v_active_admins INTEGER;
  v_caller_name TEXT;
  v_updated public.profiles;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_name
  FROM public.profiles
  WHERE id = auth.uid() AND active = TRUE;

  IF v_caller_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Solo un administrador activo puede modificar usuarios.';
  END IF;

  IF p_role NOT IN ('ADMIN', 'MANAGER', 'CASHIER') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_role;
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;

  IF p_target_id = auth.uid() AND p_active = FALSE THEN
    RAISE EXCEPTION 'No puedes desactivar tu propia cuenta.';
  END IF;

  IF v_target.role = 'ADMIN' AND (p_role <> 'ADMIN' OR p_active = FALSE) THEN
    SELECT COUNT(*) INTO v_active_admins
    FROM public.profiles
    WHERE role = 'ADMIN' AND active = TRUE AND id <> p_target_id;

    IF v_active_admins = 0 THEN
      RAISE EXCEPTION 'Debe existir al menos un administrador activo.';
    END IF;
  END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
      role = p_role,
      active = p_active,
      updated_at = NOW()
  WHERE id = p_target_id
  RETURNING * INTO v_updated;

  INSERT INTO public.activity_logs (user_id, user_name, user_role, action, details)
  VALUES (
    auth.uid(),
    COALESCE(v_caller_name, 'admin'),
    'ADMIN',
    'USER_MGMT',
    format('Actualizó usuario @%s (rol: %s, activo: %s)', v_updated.username, v_updated.role, v_updated.active)
  );

  RETURN v_updated;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_admin_update_profile(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- 6. Live user activity heartbeat RPC (Migration 007)
CREATE OR REPLACE FUNCTION public.rpc_touch_my_activity(p_is_login BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF p_is_login THEN
    UPDATE public.profiles SET last_login = NOW(), updated_at = NOW() WHERE id = auth.uid();
  ELSE
    UPDATE public.profiles SET updated_at = NOW() WHERE id = auth.uid();
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_touch_my_activity(BOOLEAN) TO authenticated;

-- 7. Grant schema/table/sequence/function privileges to authenticated role (required on Postgres 15+)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- 7b. Cleanly recreate ALL RLS policies across all 19 tables
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles','business_settings','categories','products','product_variants',
    'inventory_movements','customers','suppliers','purchases','purchase_items',
    'cash_shifts','cash_movements','transactions','transaction_items',
    'transaction_returns','orders','order_items','period_closures','activity_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY;', tbl);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%s;', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- PROFILES
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.get_my_role() = 'ADMIN') WITH CHECK (public.get_my_role() = 'ADMIN');

-- BUSINESS SETTINGS
CREATE POLICY "settings_read" ON public.business_settings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "settings_admin_write" ON public.business_settings FOR ALL TO authenticated
  USING (public.get_my_role() = 'ADMIN') WITH CHECK (public.get_my_role() = 'ADMIN');

-- CATALOG
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

-- CUSTOMERS & ORDERS
CREATE POLICY "customers_read_write" ON public.customers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "customers_insert_update" ON public.customers FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "customers_delete_mgr" ON public.customers FOR DELETE TO authenticated USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "orders_all_auth" ON public.orders FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "order_items_all_auth" ON public.order_items FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- SUPPLIERS & PURCHASES
CREATE POLICY "suppliers_mgr" ON public.suppliers FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));
CREATE POLICY "purchases_mgr" ON public.purchases FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));
CREATE POLICY "purchase_items_mgr" ON public.purchase_items FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));

-- TRANSACTIONS & CASH
CREATE POLICY "tx_read" ON public.transactions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "tx_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "tx_update_mgr" ON public.transactions FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));
CREATE POLICY "tx_delete_mgr" ON public.transactions FOR DELETE TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "tx_items_read" ON public.transaction_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "tx_items_insert" ON public.transaction_items FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "tx_items_delete_auth" ON public.transaction_items FOR DELETE TO authenticated USING (TRUE);

CREATE POLICY "tx_returns_mgr" ON public.transaction_returns FOR ALL TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "shifts_all_auth" ON public.cash_shifts FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "cash_mov_read" ON public.cash_movements FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "cash_mov_insert" ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "cash_mov_delete_mgr" ON public.cash_movements FOR DELETE TO authenticated USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));

-- PERIOD CLOSURES & ACTIVITY LOGS
CREATE POLICY "closures_read" ON public.period_closures FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "closures_admin_write" ON public.period_closures FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "logs_read_mgr" ON public.activity_logs FOR SELECT TO authenticated USING (public.get_my_role() IN ('ADMIN', 'MANAGER'));
CREATE POLICY "logs_insert_auth" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

-- 8. Ensure Supabase Realtime publication includes all POS tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'products','product_variants','customers','orders','transactions',
    'cash_movements','cash_shifts','profiles','activity_logs',
    'business_settings','categories','suppliers','purchases'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%s;', tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 9. Verification output
SELECT
  email,
  username,
  role,
  active,
  'LISTO PARA SUBIR DATOS' AS estado
FROM public.profiles;
