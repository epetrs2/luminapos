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
