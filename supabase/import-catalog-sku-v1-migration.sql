-- Migration: Atomic Catalog Import SKU RPC
-- Objective: Provide atomic unit for importing Provider SKU to Game Catalog

CREATE OR REPLACE FUNCTION public.import_catalog_sku_v1(
  p_game_id UUID,
  p_provider_id TEXT,
  p_provider_sku_id UUID,
  p_provider_sku_code TEXT,
  p_sku_name TEXT,
  p_brand_name TEXT,
  p_cost NUMERIC,
  p_type TEXT DEFAULT 'game_currency',
  p_user_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_variant_id UUID;
  v_mapping_id UUID;
  v_product_slug TEXT;
  v_provider_code TEXT;
  v_internal_sku TEXT;
  v_result JSONB;
BEGIN
  -- 1. Validate Game
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = p_game_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Game not found', 'sku_id', p_provider_sku_id);
  END IF;

  -- 2. Validate Provider and Get Code
  SELECT code INTO v_provider_code FROM public.providers WHERE id = p_provider_id;
  IF v_provider_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Provider not found', 'sku_id', p_provider_sku_id);
  END IF;

  -- 3. Resolve Product
  -- Grouping by Brand Name within the same Game
  v_product_slug := lower(regexp_replace(p_brand_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_product_slug := trim(both '-' from v_product_slug);
  
  -- Find or Create Product
  SELECT id INTO v_product_id FROM public.products WHERE game_id = p_game_id AND slug = v_product_slug;
  
  IF v_product_id IS NULL THEN
    v_product_id := gen_random_uuid();
    INSERT INTO public.products (id, game_id, name, slug, type, status, created_at, updated_at)
    VALUES (v_product_id, p_game_id, p_brand_name, v_product_slug, p_type, 'active', now(), now());
  END IF;

  -- 4. Resolve Variant
  v_internal_sku := v_provider_code || '-' || p_provider_sku_code;
  
  -- Idempotency: Use p_provider_sku_id as variant_id to ensure 1:1 mapping per supplier SKU
  -- and prevent duplicates on retry.
  v_variant_id := p_provider_sku_id; 

  IF EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_variant_id) THEN
    -- Variant exists, update cost but keep other pricing data (will be refreshed by PricingService later)
    UPDATE public.product_variants 
    SET base_cost = p_cost, updated_at = now() 
    WHERE id = v_variant_id;
  ELSE
    INSERT INTO public.product_variants (
      id, product_id, name, display_name, sku, base_cost, selling_price, pricing_method, status, metadata, created_at, updated_at
    ) VALUES (
      v_variant_id, v_product_id, p_sku_name, p_sku_name, v_internal_sku, p_cost, p_cost, 'fixed', 'inactive', 
      jsonb_build_object('pricing_status', 'pending'), now(), now()
    );
  END IF;

  -- 5. Resolve Mapping
  SELECT id INTO v_mapping_id FROM public.provider_mappings 
  WHERE variant_id = v_variant_id AND provider_id = p_provider_id AND provider_sku_id = p_provider_sku_id;

  IF v_mapping_id IS NULL THEN
    v_mapping_id := gen_random_uuid();
    INSERT INTO public.provider_mappings (
      id, variant_id, provider_id, provider_sku, provider_sku_id, status, priority, created_at, updated_at
    ) VALUES (
      v_mapping_id, v_variant_id, p_provider_id, p_provider_sku_code, p_provider_sku_id, 'NEEDS_REVIEW', 1, now(), now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'productId', v_product_id, 
    'variantId', v_variant_id, 
    'mappingId', v_mapping_id,
    'sku_id', p_provider_sku_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM, 'sku_id', p_provider_sku_id);
END;
$$;
