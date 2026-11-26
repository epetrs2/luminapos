-- ============================================================================
-- LuminaPOS - Migration 004: Auto-create Profile on Signup (First user = ADMIN)
-- ============================================================================
-- Run this in Supabase SQL Editor -> New Query -> Run

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_count INTEGER;
  v_role TEXT;
  v_username TEXT;
  v_full_name TEXT;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM public.profiles;
  v_role := CASE WHEN v_user_count = 0 THEN 'ADMIN' ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'CASHIER') END;
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', v_username);

  INSERT INTO public.profiles (id, username, full_name, role, active)
  VALUES (NEW.id, v_username, v_full_name, v_role, TRUE)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
