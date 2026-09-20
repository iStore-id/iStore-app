-- ============================================================================
-- DOMAIN: REFERRAL SYSTEM ATOMIC PROCEDURES
-- DESCRIPTION: Atomic PL/pgSQL RPCs for Customer Attribution, Qualification, and Reversals
-- TARGET: Supabase (PostgreSQL)
-- ============================================================================

-- 1. Atomic Customer Attribution
CREATE OR REPLACE FUNCTION public.attribute_customer_atomic(
    p_referred_uid UUID,
    p_referral_code VARCHAR,
    p_source VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config JSONB;
    v_config_enabled BOOLEAN;
    v_referrer_uid UUID;
    v_existing_referred_by UUID;
    v_existing_relationship_referrer UUID;
    v_relationship_id VARCHAR(255);
    v_normalized_code VARCHAR(255);
BEGIN
    -- A. Check System Configuration
    SELECT value, enabled INTO v_config, v_config_enabled 
    FROM public.system_configs 
    WHERE key = 'referral_config';

    IF NOT FOUND OR NOT v_config_enabled OR NOT (v_config->>'enabled')::BOOLEAN THEN
        RAISE EXCEPTION 'Program referral sedang tidak aktif.' USING ERRCODE = 'R0001';
    END IF;

    -- B. Normalize and Validate Referral Code
    v_normalized_code := TRIM(UPPER(p_referral_code));
    IF v_normalized_code IS NULL OR v_normalized_code = '' THEN
        RAISE EXCEPTION 'Kode referral tidak valid.' USING ERRCODE = 'R0002';
    END IF;

    -- C. Validate Source
    IF p_source NOT IN ('URL', 'MANUAL_INPUT', 'API') THEN
        RAISE EXCEPTION 'Source tidak valid.' USING ERRCODE = 'R0006';
    END IF;

    -- D. Find Referrer by Referral Code
    SELECT id INTO v_referrer_uid 
    FROM public.profiles 
    WHERE referral_code = v_normalized_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Kode referral tidak ditemukan.' USING ERRCODE = 'R0002';
    END IF;

    -- E. Self-Referral Validation
    -- Strictly enforced by the database table constraint: check_no_self_referral CHECK (referrer_uid <> referred_uid)
    IF v_referrer_uid = p_referred_uid THEN
        RAISE EXCEPTION 'Anda tidak dapat menggunakan kode referral milik sendiri.' USING ERRCODE = 'R0003';
    END IF;

    -- F. Transactional Advisory Locking (On Referred Customer to prevent race conditions during attribution)
    PERFORM pg_advisory_xact_lock(hashtext('referral_attribute'), hashtext(p_referred_uid::text));

    -- G. First-Referrer-Wins Validation & Check Profile Existence
    SELECT referred_by INTO v_existing_referred_by 
    FROM public.profiles 
    WHERE id = p_referred_uid 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pelanggan tidak ditemukan.' USING ERRCODE = 'R0005';
    END IF;

    SELECT referrer_uid INTO v_existing_relationship_referrer
    FROM public.referral_relationships
    WHERE referred_uid = p_referred_uid;

    IF v_existing_referred_by IS NOT NULL OR v_existing_relationship_referrer IS NOT NULL THEN
        RAISE EXCEPTION 'Pelanggan sudah teratribusi ke referrer lain.' USING ERRCODE = 'R0004';
    END IF;

    -- H. Execution
    v_relationship_id := 'REF_' || v_referrer_uid::text || '_' || p_referred_uid::text;

    -- 1. Insert Relationship Record
    INSERT INTO public.referral_relationships (
        id,
        referrer_uid,
        referred_uid,
        status,
        referral_code,
        source,
        reward_status,
        reward_type,
        created_at,
        updated_at
    ) VALUES (
        v_relationship_id,
        v_referrer_uid,
        p_referred_uid,
        'PENDING',
        v_normalized_code,
        p_source,
        'PENDING',
        'NONE',
        now(),
        now()
    );

    -- 2. Update Profile Attribution
    UPDATE public.profiles 
    SET referred_by = v_referrer_uid,
        updated_at = now()
    WHERE id = p_referred_uid;

    RETURN jsonb_build_object(
        'success', true,
        'relationship_id', v_relationship_id,
        'referrer_uid', v_referrer_uid,
        'referred_uid', p_referred_uid,
        'referral_code', v_normalized_code,
        'message', 'Referral berhasil dikaitkan.'
    );
END;
$$;


-- 2. Atomic Referral Qualification with Distributed Retry Safety
CREATE OR REPLACE FUNCTION public.qualify_referral_atomic(
    p_order_id VARCHAR,
    p_total_amount NUMERIC,
    p_transaction_status VARCHAR,
    p_referred_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config JSONB;
    v_config_enabled BOOLEAN;
    v_relationship_id VARCHAR(255);
    v_referrer_uid UUID;
    v_status VARCHAR(50);
    v_reward_status VARCHAR(50);
    v_reward_type VARCHAR(50);
    v_referral_code VARCHAR(255);
    v_qualified_order_id VARCHAR(255);
BEGIN
    -- A. Check System Configuration
    SELECT value, enabled INTO v_config, v_config_enabled 
    FROM public.system_configs 
    WHERE key = 'referral_config';

    IF NOT FOUND OR NOT v_config_enabled OR NOT (v_config->>'enabled')::BOOLEAN THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Referral program disabled');
    END IF;

    -- B. Validate Order Success
    IF COALESCE((v_config->>'requireOrderSuccess')::BOOLEAN, TRUE) AND p_transaction_status <> 'success' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Qualifying order is not successful');
    END IF;

    -- C. Validate Minimum Order Amount
    IF p_total_amount < COALESCE((v_config->>'minQualifyingOrderAmount')::NUMERIC, 0) THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Order amount below minimum qualification limit');
    END IF;

    -- D. Row Locking on relationship to prevent concurrent qualification calls
    SELECT id, referrer_uid, status, reward_status, reward_type, referral_code, qualified_order_id
    INTO v_relationship_id, v_referrer_uid, v_status, v_reward_status, v_reward_type, v_referral_code, v_qualified_order_id
    FROM public.referral_relationships
    WHERE referred_uid = p_referred_uid
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'No referral relationship found for this user');
    END IF;

    -- E. State Transition & Self-Healing Retry Logic
    IF v_status = 'CONVERTED' THEN
        IF v_reward_status = 'PENDING' THEN
            -- Relationship was previously qualified/converted, but reward distribution crashed before marking as GRANTED.
            -- This allows the service layer to safe-retry points & commission issuance.
            -- Ledger idempotency is guaranteed:
            --   - Point transactions have a UNIQUE constraint on the `reference` column.
            --   - Commission accruals are tied idempotently to the unique qualified_order_id.
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', false,
                'needs_distribution', true,
                'relationship_id', v_relationship_id,
                'referrer_uid', v_referrer_uid,
                'referred_uid', p_referred_uid,
                'reward_type', v_reward_type,
                'reward_status', v_reward_status,
                'qualified_order_id', v_qualified_order_id,
                'referral_code', v_referral_code,
                'referrer_reward_points', COALESCE((v_config->>'referrerRewardPoints')::INTEGER, 0),
                'referred_reward_points', COALESCE((v_config->>'referredRewardPoints')::INTEGER, 0),
                'referrer_reward_type', COALESCE(v_config->>'referrerRewardType', 'NONE'),
                'referred_reward_type', COALESCE(v_config->>'referredRewardType', 'NONE'),
                'message', 'Referral already qualified. Retrying pending reward distribution.'
            );
        ELSE
            -- reward_status is 'GRANTED', 'REVERSED', or 'CANCELLED'. Reward flow is already completed/finalized.
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'needs_distribution', false,
                'relationship_id', v_relationship_id,
                'referrer_uid', v_referrer_uid,
                'referred_uid', p_referred_uid,
                'reward_type', v_reward_type,
                'reward_status', v_reward_status,
                'qualified_order_id', v_qualified_order_id,
                'message', 'Referral has already been fully processed.'
            );
        END IF;
    END IF;

    -- F. Expiration Check
    IF v_status = 'EXPIRED' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Referral relationship has expired');
    END IF;

    -- G. Deterministic Reward Type Determination
    v_reward_type := CASE WHEN v_config->>'referrerRewardType' = 'BOTH' THEN 'BOTH'
                          ELSE COALESCE(v_config->>'referrerRewardType', 'NONE') END;

    -- H. Update Relationship Status (Transition state to CONVERTED, initial reward_status is PENDING)
    UPDATE public.referral_relationships SET
        status = 'CONVERTED',
        qualified_order_id = p_order_id,
        reward_status = 'PENDING',
        reward_type = v_reward_type,
        converted_at = now(),
        updated_at = now()
    WHERE id = v_relationship_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'needs_distribution', true,
        'relationship_id', v_relationship_id,
        'referrer_uid', v_referrer_uid,
        'referred_uid', p_referred_uid,
        'reward_type', v_reward_type,
        'reward_status', 'PENDING',
        'qualified_order_id', p_order_id,
        'referral_code', v_referral_code,
        'referrer_reward_points', COALESCE((v_config->>'referrerRewardPoints')::INTEGER, 0),
        'referred_reward_points', COALESCE((v_config->>'referredRewardPoints')::INTEGER, 0),
        'referrer_reward_type', COALESCE(v_config->>'referrerRewardType', 'NONE'),
        'referred_reward_type', COALESCE(v_config->>'referredRewardType', 'NONE')
    );
END;
$$;


-- 3. Atomic Referral Refund Reversal
CREATE OR REPLACE FUNCTION public.handle_referral_refund_atomic(
    p_order_id VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_relationship_id VARCHAR(255);
    v_status VARCHAR(50);
    v_reward_status VARCHAR(50);
    v_referrer_uid UUID;
    v_referred_uid UUID;
BEGIN
    -- A. Row Lock Relationship by qualified_order_id
    SELECT id, status, reward_status, referrer_uid, referred_uid
    INTO v_relationship_id, v_status, v_reward_status, v_referrer_uid, v_referred_uid
    FROM public.referral_relationships
    WHERE qualified_order_id = p_order_id
    FOR UPDATE;

    -- B. Idempotency Check
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'No referral relationship found for this order ID');
    END IF;

    IF v_reward_status = 'REVERSED' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'relationship_id', v_relationship_id,
            'message', 'Referral reward status is already marked as REVERSED.'
        );
    END IF;

    -- C. Update Status
    UPDATE public.referral_relationships SET
        reward_status = 'REVERSED',
        updated_at = now()
    WHERE id = v_relationship_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'relationship_id', v_relationship_id,
        'referrer_uid', v_referrer_uid,
        'referred_uid', v_referred_uid,
        'message', 'Referral reward status successfully marked as REVERSED.'
    );
END;
$$;


-- 4. Access Control
REVOKE ALL ON FUNCTION public.attribute_customer_atomic(UUID, VARCHAR, VARCHAR) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.qualify_referral_atomic(VARCHAR, NUMERIC, VARCHAR, UUID) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_referral_refund_atomic(VARCHAR) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.attribute_customer_atomic(UUID, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.qualify_referral_atomic(VARCHAR, NUMERIC, VARCHAR, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_referral_refund_atomic(VARCHAR) TO service_role;
