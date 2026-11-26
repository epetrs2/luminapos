-- ============================================================================
-- LuminaPOS - Migration 007: Live User Activity RPC (last_login & last_active)
-- ============================================================================
-- Allows ANY authenticated user (ADMIN, MANAGER, CASHIER) to safely record
-- their own login timestamp and live activity heartbeat without needing ADMIN
-- write permissions on public.profiles.

CREATE OR REPLACE FUNCTION public.rpc_touch_my_activity(p_is_login BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF p_is_login THEN
    UPDATE public.profiles
    SET last_login = NOW(),
        updated_at = NOW()
    WHERE id = auth.uid();
  ELSE
    UPDATE public.profiles
    SET updated_at = NOW()
    WHERE id = auth.uid();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_touch_my_activity(BOOLEAN) TO authenticated;
