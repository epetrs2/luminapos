-- ============================================================================
-- LuminaPOS - Migration 008: Delivery Signature for Business/Store Clients
-- ============================================================================
-- Stores high-contrast delivery signature + receiver name + timestamp on
-- transactions so thermal tickets can be reprinted anytime with the signature.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS delivery_signature JSONB;
