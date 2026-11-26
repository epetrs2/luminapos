-- ============================================================================
-- LuminaPOS - Migration 005: Users Security Hardening & Admin Profile RPC
-- ============================================================================
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. Store email on public.profiles so Admins can manage & send recovery links
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill existing profiles with emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 2. Harden handle_new_auth_user():
--    - First user is ALWAYS ADMIN.
--    - Every subsequent user is ALWAYS CASHIER (never trust client metadata for role!).
--    - Prevents duplicate username collisions.
--    - Saves email into public.profiles.
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

-- 3. Secure Admin RPC to update user profiles (enforces last-ADMIN protection on DB level)
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

-- 4. Update Realtime publication safely to include profiles, activity_logs & remaining tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles','activity_logs','business_settings','categories','suppliers','purchases']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%s;', tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
