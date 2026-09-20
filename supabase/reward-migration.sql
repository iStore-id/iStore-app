-- ============================================================================
-- DOMAIN: REWARD SYSTEM MIGRATION
-- DESCRIPTION: Schema and Atomic Logic for Reward Service
-- TARGET: Supabase (PostgreSQL)
-- ============================================================================

-- 1. Create Rewards Table
CREATE TABLE IF NOT EXISTS public.rewards (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image TEXT,
    points_cost INTEGER NOT NULL CHECK (points_cost >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    quota INTEGER,
    remaining_quota INTEGER,
    per_customer_limit INTEGER,
    reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('voucher', 'item', 'benefit')),
    voucher_code VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_quota CHECK (quota IS NULL OR (remaining_quota IS NOT NULL AND remaining_quota <= quota AND remaining_quota >= 0))
);

-- 2. Create Reward Redemptions Table
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
    id UUID PRIMARY KEY,
    reward_id VARCHAR(255) NOT NULL REFERENCES public.rewards(id),
    reward_name VARCHAR(255) NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.profiles(id),
    points_cost INTEGER NOT NULL,
    remaining_balance INTEGER NOT NULL,
    reward_type VARCHAR(50) NOT NULL,
    voucher_code VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- 4. Atomic Redemption RPC
CREATE OR REPLACE FUNCTION public.redeem_reward_atomic(
    p_reward_id VARCHAR(255),
    p_customer_id UUID,
    p_redemption_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reward_name VARCHAR(255);
    v_points_cost INTEGER;
    v_reward_status VARCHAR(50);
    v_reward_type VARCHAR(50);
    v_voucher_code VARCHAR(255);
    v_quota INTEGER;
    v_remaining_quota INTEGER;
    v_per_customer_limit INTEGER;
    v_current_balance INTEGER;
    v_customer_redemption_count INTEGER;
    v_reference VARCHAR(255);
    -- Variabel pelacak idempotency
    v_existing_reward_id VARCHAR(255);
    v_existing_customer_id UUID;
    v_existing_status VARCHAR(50);
BEGIN
    -- A. Transactional Locking (Order: Customer Lock -> Reward Lock)
    -- 1. Customer Lock (Compatible dengan loyalty-redeem)
    PERFORM pg_advisory_xact_lock(hashtext('loyalty_redeem'), hashtext(p_customer_id::text));

    -- 0. Idempotency Check
    SELECT reward_id, customer_id, points_cost, remaining_balance, voucher_code, reward_name, status
    INTO v_existing_reward_id, v_existing_customer_id, v_points_cost, v_current_balance, v_voucher_code, v_reward_name, v_existing_status
    FROM public.reward_redemptions
    WHERE id = p_redemption_id;

    IF FOUND THEN
        -- Validasi kecocokan identitas customer dan reward
        IF v_existing_customer_id <> p_customer_id OR v_existing_reward_id <> p_reward_id THEN
            RAISE EXCEPTION 'ID penukaran sudah terdaftar untuk pengguna atau reward lain.' USING ERRCODE = 'P0006';
        END IF;

        -- Jika transaksi sukses, kembalikan respons idempotent dengan saldo setelah transaksi tersebut
        IF v_existing_status = 'SUCCESS' THEN
            RETURN jsonb_build_object(
                'success', true,
                'redemption_id', p_redemption_id,
                'points_spent', v_points_cost,
                'remaining_balance', v_current_balance,
                'voucher_code', v_voucher_code,
                'message', 'Transaksi sudah diproses sebelumnya (idempotent).',
                'reward_name', v_reward_name
            );
        END IF;
    END IF;

    -- 2. Reward Row Lock
    SELECT name, points_cost, status, reward_type, voucher_code, quota, remaining_quota, per_customer_limit
    INTO v_reward_name, v_points_cost, v_reward_status, v_reward_type, v_voucher_code, v_quota, v_remaining_quota, v_per_customer_limit
    FROM public.rewards
    WHERE id = p_reward_id
    FOR UPDATE;

    -- B. Validations
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reward tidak ditemukan.' USING ERRCODE = 'P0001';
    END IF;

    IF v_reward_status <> 'active' THEN
        RAISE EXCEPTION 'Reward saat ini tidak tersedia.' USING ERRCODE = 'P0002';
    END IF;

    -- Validate Quota
    IF v_quota IS NOT NULL AND v_remaining_quota <= 0 THEN
        RAISE EXCEPTION 'Stok reward sudah habis.' USING ERRCODE = 'P0003';
    END IF;

    -- Validate Per Customer Limit
    IF v_per_customer_limit IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_customer_redemption_count
        FROM public.reward_redemptions
        WHERE customer_id = p_customer_id 
          AND reward_id = p_reward_id 
          AND status = 'SUCCESS';

        IF v_customer_redemption_count >= v_per_customer_limit THEN
            RAISE EXCEPTION 'Anda sudah mencapai batas penukaran untuk reward ini.' USING ERRCODE = 'P0004';
        END IF;
    END IF;

    -- Calculate Point Balance (Dynamic dari point_transactions)
    SELECT COALESCE(SUM(points), 0)
    INTO v_current_balance
    FROM public.point_transactions
    WHERE customer_id = p_customer_id;

    IF v_current_balance < v_points_cost THEN
        RAISE EXCEPTION 'Poin tidak cukup. Saldo Anda: % poin, Biaya: % poin.', v_current_balance, v_points_cost USING ERRCODE = 'P0005';
    END IF;

    -- C. Execution (All mutations inside lock)
    v_reference := 'reward_redeem_' || p_redemption_id::text;

    -- 1. Insert Point Transaction (Shared ledger)
    INSERT INTO public.point_transactions (
        id,
        customer_id,
        type,
        points,
        reference,
        reason,
        created_at,
        created_by
    ) VALUES (
        gen_random_uuid(),
        p_customer_id,
        'REDEEM',
        -v_points_cost,
        v_reference,
        'Penukaran reward: ' || v_reward_name,
        now(),
        p_customer_id::text
    );

    -- 2. Decrement Reward Quota
    IF v_quota IS NOT NULL THEN
        UPDATE public.rewards 
        SET remaining_quota = remaining_quota - 1,
            updated_at = now()
        WHERE id = p_reward_id;
    END IF;

    -- 3. Insert Redemption Record
    INSERT INTO public.reward_redemptions (
        id,
        reward_id,
        reward_name,
        customer_id,
        points_cost,
        remaining_balance,
        reward_type,
        voucher_code,
        status,
        created_at
    ) VALUES (
        p_redemption_id,
        p_reward_id,
        v_reward_name,
        p_customer_id,
        v_points_cost,
        v_current_balance - v_points_cost,
        v_reward_type,
        v_voucher_code,
        'SUCCESS',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'redemption_id', p_redemption_id,
        'points_spent', v_points_cost,
        'remaining_balance', v_current_balance - v_points_cost,
        'voucher_code', v_voucher_code
    );
END;
$$;

-- 5. Access Control
REVOKE ALL ON public.rewards FROM anon, authenticated, public;
REVOKE ALL ON public.reward_redemptions FROM anon, authenticated, public;

GRANT SELECT ON public.rewards TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.rewards TO service_role;

GRANT SELECT ON public.reward_redemptions TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.reward_redemptions TO service_role;

GRANT EXECUTE ON FUNCTION public.redeem_reward_atomic(VARCHAR, UUID, UUID) TO service_role;
