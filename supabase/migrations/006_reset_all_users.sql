-- ============================================================================
-- LuminaPOS - Migration 006: Clean-Slate Users Reset ("Borrón y Cuenta Nueva")
-- ============================================================================
-- Run this ONLY when you want to wipe all existing test/old users so the very
-- next person who signs up in the app becomes the fresh primary ADMIN.
-- Your business data (products, customers, sales, orders, etc.) is NOT deleted!

UPDATE public.inventory_movements SET created_by = NULL WHERE created_by IS NOT NULL;
UPDATE public.purchases SET created_by = NULL WHERE created_by IS NOT NULL;
UPDATE public.cash_shifts SET opened_by = NULL, closed_by = NULL WHERE opened_by IS NOT NULL OR closed_by IS NOT NULL;
UPDATE public.transactions SET created_by = NULL WHERE created_by IS NOT NULL;
UPDATE public.transaction_returns SET created_by = NULL WHERE created_by IS NOT NULL;
UPDATE public.cash_movements SET created_by = NULL WHERE created_by IS NOT NULL;
UPDATE public.orders SET created_by = NULL WHERE created_by IS NOT NULL;
UPDATE public.period_closures SET closed_by = NULL WHERE closed_by IS NOT NULL;
UPDATE public.activity_logs SET user_id = NULL WHERE user_id IS NOT NULL;

DELETE FROM public.profiles;
DELETE FROM auth.users;
