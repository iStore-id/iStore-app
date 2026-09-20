-- ============================================================================
-- DOMAIN: LOYALTY & REWARDS SYSTEM
-- RPC: Concurrency-Safe Atomic Point Redemption (redeem_points_atomic)
-- IDEMPOTENT & TRANSACTION-ISOLATED
-- NO TABLE MUTATION / NO SEED DATA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.redeem_points_atomic(
    p_customer_id UUID,
    p_points_to_use INTEGER,
    p_order_id VARCHAR(100) DEFAULT NULL,
    p_reference VARCHAR(255) DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_created_by VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reference VARCHAR(255);
    v_order_id VARCHAR(100);
    v_reason TEXT;
    v_created_by VARCHAR(100);
    v_config_enabled BOOLEAN;
    v_min_redeem_points INTEGER;
    v_redeem_rate NUMERIC;
    v_max_redemption_percent NUMERIC;
    v_current_balance INTEGER;
    v_existing_id UUID;
    v_existing_points INTEGER;
    v_new_tx_id UUID;
    v_discount_amount NUMERIC;
BEGIN
    -- 1. Validasi Input Parameter
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer ID wajib diisi dan harus berupa UUID valid.' USING ERRCODE = 'P0002';
    END IF;

    IF p_points_to_use IS NULL OR p_points_to_use <= 0 THEN
        RAISE EXCEPTION 'Jumlah poin yang ditukarkan harus lebih besar dari 0.' USING ERRCODE = 'P0003';
    END IF;

    -- Normalisasi parameter metadata
    v_order_id := NULLIF(trim(p_order_id), '');
    
    IF p_reference IS NOT NULL AND trim(p_reference) <> '' THEN
        v_reference := trim(p_reference);
    ELSIF v_order_id IS NOT NULL THEN
        v_reference := 'points_redeem_' || v_order_id;
    ELSE
        RAISE EXCEPTION 'Reference atau Order ID wajib disertakan sebagai idempotency key.' USING ERRCODE = 'P0004';
    END IF;

    v_reason := COALESCE(NULLIF(trim(p_reason), ''), 'Penukaran poin untuk pesanan ' || COALESCE(v_order_id, '-'));
    v_created_by := COALESCE(NULLIF(trim(p_created_by), ''), p_customer_id::text);

    -- 2. Concurrency-Safe Transaction Lock per Customer
    -- pg_advisory_xact_lock mengunci alur eksekusi per customer ID selama masa transaksi.
    -- Dua transaksi paralel untuk customer yang sama akan dieksekusi secara serial.
    PERFORM pg_advisory_xact_lock(hashtext('loyalty_redeem'), hashtext(p_customer_id::text));

    -- Verifikasi bahwa profil customer terdaftar di public.profiles
    PERFORM 1 FROM public.profiles WHERE id = p_customer_id FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer profile tidak ditemukan: %', p_customer_id USING ERRCODE = 'P0005';
    END IF;

    -- 3. Ambil Konfigurasi Aktif (public.loyalty_configs id = 'main')
    SELECT enabled, min_redeem_points, redeem_rate_idr, max_redemption_percent
    INTO v_config_enabled, v_min_redeem_points, v_redeem_rate, v_max_redemption_percent
    FROM public.loyalty_configs
    WHERE id = 'main';

    IF NOT FOUND THEN
        v_config_enabled := true;
        v_min_redeem_points := 10;
        v_redeem_rate := 100;
        v_max_redemption_percent := 50;
    END IF;

    -- 4. Idempotency Check (Berdasarkan reference UNIQUE)
    SELECT id, points INTO v_existing_id, v_existing_points
    FROM public.point_transactions
    WHERE reference = v_reference;

    -- Jika sudah pernah diproses, kembalikan data transaksi yang ada tanpa membuat entri baru
    IF FOUND THEN
        SELECT COALESCE(SUM(points), 0) INTO v_current_balance
        FROM public.point_transactions
        WHERE customer_id = p_customer_id;

        v_discount_amount := abs(v_existing_points) * v_redeem_rate;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'tx_id', v_existing_id,
            'points_redeemed', abs(v_existing_points),
            'discount_amount', v_discount_amount,
            'remaining_balance', v_current_balance,
            'message', 'Transaksi penukaran poin sudah pernah diproses sebelumnya.'
        );
    END IF;

    -- 5. Validasi Aturan Bisnis Konfigurasi
    IF NOT v_config_enabled THEN
        RAISE EXCEPTION 'Sistem loyalty sedang tidak aktif.' USING ERRCODE = 'P0006';
    END IF;

    IF p_points_to_use < v_min_redeem_points THEN
        RAISE EXCEPTION 'Minimal penukaran poin adalah % poin.', v_min_redeem_points USING ERRCODE = 'P0007';
    END IF;

    -- 6. Hitung Saldo Customer saat ini di dalam Lock
    SELECT COALESCE(SUM(points), 0)
    INTO v_current_balance
    FROM public.point_transactions
    WHERE customer_id = p_customer_id;

    -- 7. Pencegahan Saldo Negatif
    IF v_current_balance < p_points_to_use THEN
        RAISE EXCEPTION 'Poin tidak cukup. Saldo Anda saat ini: % poin.', v_current_balance USING ERRCODE = 'P0008';
    END IF;

    -- 8. Catat Mutasi REDEEM ke point_transactions (Append-Only)
    INSERT INTO public.point_transactions (
        id,
        customer_id,
        type,
        points,
        reference,
        order_id,
        reason,
        created_at,
        created_by
    ) VALUES (
        gen_random_uuid(),
        p_customer_id,
        'REDEEM',
        -p_points_to_use,
        v_reference,
        v_order_id,
        v_reason,
        now(),
        v_created_by
    )
    RETURNING id INTO v_new_tx_id;

    -- 9. Kalkulasi Nilai Diskon dan Saldo Akhir
    v_discount_amount := p_points_to_use * v_redeem_rate;
    v_current_balance := v_current_balance - p_points_to_use;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'tx_id', v_new_tx_id,
        'points_redeemed', p_points_to_use,
        'discount_amount', v_discount_amount,
        'remaining_balance', v_current_balance
    );
END;
$$;

-- 10. Hak Akses (Hanya service_role yang dapat memanggil fungsi ini dari backend)
REVOKE EXECUTE ON FUNCTION public.redeem_points_atomic(UUID, INTEGER, VARCHAR, VARCHAR, TEXT, VARCHAR) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.redeem_points_atomic(UUID, INTEGER, VARCHAR, VARCHAR, TEXT, VARCHAR) TO service_role;
