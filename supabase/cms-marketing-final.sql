-- ============================================================================
-- DOMAIN: CONTENT / CMS & MARKETING
-- STRATEGY: UUID v4 (gen_random_uuid), Relational PostgreSQL, RLS Enabled
-- DEPENDENCY ORDER: Level 0 (Standalone) -> Level 1 -> Level 2 -> Level 3
-- BINARY STORAGE: Cloudinary (Supabase stores metadata only)
-- ============================================================================

-- LEVEL 0: STANDALONE TABLES
-- ----------------------------------------------------------------------------

-- Media Library (Metadata only, binary stored in Cloudinary)
CREATE TABLE IF NOT EXISTS public.media_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Cloudinary Public ID
    cloudinary_public_id TEXT,
    url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    folder TEXT DEFAULT 'general',
    uploaded_by TEXT, -- Firebase UID
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Promos (Vouchers/Discounts)
CREATE TABLE IF NOT EXISTS public.promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value NUMERIC NOT NULL,
    minimum_transaction NUMERIC NOT NULL DEFAULT 0,
    maximum_discount NUMERIC,
    usage_limit INTEGER,
    per_customer_usage_limit INTEGER,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    applicable_games VARCHAR[], -- Array of Game IDs (VARCHAR). Backend maintains referential integrity.
    applicable_products VARCHAR[], -- Array of Product IDs
    applicable_categories VARCHAR[], -- Array of Category IDs
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- LEVEL 1: DIRECT DEPENDENCIES (Refers to Catalog or Standalone)
-- ----------------------------------------------------------------------------

-- Flash Sales (Linked to catalog)
CREATE TABLE IF NOT EXISTS public.flash_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    product_id VARCHAR REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id VARCHAR REFERENCES public.product_variants(id) ON DELETE CASCADE, -- Business rule: Sale must have a specific variant
    sale_price NUMERIC NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    total_quota INTEGER,
    remaining_quota INTEGER,
    per_customer_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Banners
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    media_id UUID REFERENCES public.media_library(id) ON DELETE SET NULL,
    media_url TEXT NOT NULL,
    placement TEXT NOT NULL, -- e.g., 'homepage_hero', 'homepage_promo', 'game_promo'
    title TEXT,
    alt_text TEXT,
    target TEXT, -- URL or Deep Link
    sort_order INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    published BOOLEAN DEFAULT false,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    created_by TEXT, -- Firebase UID
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Popups
CREATE TABLE IF NOT EXISTS public.popups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    media_id UUID REFERENCES public.media_library(id) ON DELETE SET NULL,
    media_url TEXT,
    placement TEXT DEFAULT 'homepage' CHECK (placement IN ('homepage', 'all_pages', 'checkout')),
    trigger TEXT DEFAULT 'immediate' CHECK (trigger IN ('immediate', 'delay_3s', 'exit_intent')),
    target TEXT,
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    published BOOLEAN DEFAULT false,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- LEVEL 2: ORCHESTRATORS
-- ----------------------------------------------------------------------------

-- Campaigns (Groups multiple marketing assets)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- Required based on campaign-service.ts usage
    media_id UUID REFERENCES public.media_library(id) ON DELETE SET NULL,
    media_url TEXT,
    promo_ids UUID[], -- Array of Promo UUIDs. Backend handles referential integrity.
    flash_sale_ids UUID[], -- Array of FlashSale UUIDs
    banner_ids UUID[], -- Array of Banner UUIDs
    popup_ids UUID[], -- Array of Popup UUIDs
    target_type TEXT DEFAULT 'all' CHECK (target_type IN ('all', 'game', 'category', 'product', 'custom_url')),
    target_id TEXT, -- ID of game/product/category
    target_url TEXT,
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    published BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- LEVEL 3: CONTENT HIERARCHY
-- ----------------------------------------------------------------------------

-- Landing Pages
CREATE TABLE IF NOT EXISTS public.landings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    seo_title TEXT,
    seo_description TEXT,
    media_id UUID REFERENCES public.media_library(id) ON DELETE SET NULL,
    media_url TEXT,
    sections JSONB DEFAULT '[]', -- LandingBlock[] array (JSONB is best for flexible layouts)
    cta_text TEXT,
    cta_url TEXT,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    game_id VARCHAR REFERENCES public.games(id) ON DELETE SET NULL,
    category_id VARCHAR REFERENCES public.categories(id) ON DELETE SET NULL,
    product_id VARCHAR REFERENCES public.products(id) ON DELETE SET NULL,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    enabled BOOLEAN DEFAULT true,
    published BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    status TEXT CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'ENDED', 'INACTIVE', 'ARCHIVED')),
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Blogs
CREATE TABLE IF NOT EXISTS public.blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL, -- Markdown or structured text
    cover_media_id UUID REFERENCES public.media_library(id) ON DELETE SET NULL,
    cover_media_url TEXT,
    category TEXT,
    tags TEXT[],
    author TEXT,
    read_time INTEGER,
    published BOOLEAN DEFAULT false,
    enabled BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    seo_title TEXT,
    seo_description TEXT,
    related_game_id VARCHAR REFERENCES public.games(id) ON DELETE SET NULL,
    related_promo_id UUID REFERENCES public.promos(id) ON DELETE SET NULL,
    related_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    related_landing_id UUID REFERENCES public.landings(id) ON DELETE SET NULL,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    status TEXT CHECK (status IN ('PUBLISHED', 'SCHEDULED', 'DRAFT', 'ENDED', 'INACTIVE', 'ARCHIVED'))
);

-- FAQs
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    sort_order INTEGER DEFAULT 0,
    published BOOLEAN DEFAULT false,
    enabled BOOLEAN DEFAULT true,
    archived BOOLEAN DEFAULT false,
    related_game_id VARCHAR REFERENCES public.games(id) ON DELETE SET NULL,
    related_promo_id UUID REFERENCES public.promos(id) ON DELETE SET NULL,
    related_blog_id UUID REFERENCES public.blogs(id) ON DELETE SET NULL,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    published_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_media_folder ON public.media_library(folder);
CREATE INDEX IF NOT EXISTS idx_promos_code ON public.promos(code);
CREATE INDEX IF NOT EXISTS idx_promos_status_dates ON public.promos(status, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_flash_sales_variant ON public.flash_sales(variant_id, status);
CREATE INDEX IF NOT EXISTS idx_banners_placement ON public.banners(placement, enabled, published);
CREATE INDEX IF NOT EXISTS idx_popups_placement ON public.popups(placement, enabled, published);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON public.campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_landings_slug ON public.landings(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_slug ON public.blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_published_status ON public.blogs(published, enabled, is_archived);
CREATE INDEX IF NOT EXISTS idx_faqs_category_sort ON public.faqs(category, sort_order);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS for all 9 tables
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- 1. Media Library Policies
CREATE POLICY "Public Read Active Media" ON public.media_library FOR SELECT USING (status = 'active');

-- 2. Promos Policies
CREATE POLICY "Public Read Active Promos" ON public.promos FOR SELECT 
USING (status = 'active' AND start_at <= now() AND end_at >= now());

-- 3. Flash Sales Policies
CREATE POLICY "Public Read Active Flash Sales" ON public.flash_sales FOR SELECT 
USING (status = 'active' AND start_at <= now() AND end_at >= now());

-- 4. Banners Policies
CREATE POLICY "Public Read Active Banners" ON public.banners FOR SELECT 
USING (enabled = true AND published = true AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()));

-- 5. Popups Policies
CREATE POLICY "Public Read Active Popups" ON public.popups FOR SELECT 
USING (enabled = true AND published = true AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()));

-- 6. Campaigns Policies
CREATE POLICY "Public Read Active Campaigns" ON public.campaigns FOR SELECT 
USING (enabled = true AND published = true AND is_archived = false AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()));

-- 7. Landings Policies
CREATE POLICY "Public Read Active Landings" ON public.landings FOR SELECT 
USING (enabled = true AND published = true AND is_archived = false AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()));

-- 8. Blogs Policies
CREATE POLICY "Public Read Active Blogs" ON public.blogs FOR SELECT 
USING (enabled = true AND published = true AND is_archived = false AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()));

-- 9. FAQs Policies
CREATE POLICY "Public Read Active FAQs" ON public.faqs FOR SELECT 
USING (enabled = true AND published = true AND archived = false);

-- Admin/Backend Access (Service Role)
-- Standard Supabase setup: service_role has full bypass.
-- For Authenticated Admin access via UID/Claims, policies would be added here.
-- Example: CREATE POLICY "Admins full access" ON public.blogs TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
