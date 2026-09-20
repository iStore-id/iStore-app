import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin.js";
import { BlogPost, BlogStatus } from "../../types/blog.js";
import { FAQItem, FAQStatus } from "../../types/faq.js";
import { LandingPage, LandingStatus } from "../../types/landing.js";
import { Banner, Popup, Campaign, CampaignStatus, computeCampaignStatus } from "../../types/cms.js";

export class SupabaseCMSRepository {
  private static instance: SupabaseCMSRepository;

  private constructor() {}

  public static getInstance(): SupabaseCMSRepository {
    if (!SupabaseCMSRepository.instance) {
      SupabaseCMSRepository.instance = new SupabaseCMSRepository();
    }
    return SupabaseCMSRepository.instance;
  }

  private ensureClient() {
    if (!supabaseAdmin || !isSupabaseAdminConfigured) {
      throw new Error("Supabase Admin is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    return supabaseAdmin;
  }

  // ==========================================
  // BANNERS
  // ==========================================

  async getBanner(id: string): Promise<Banner | null> {
    const client = this.ensureClient();
    const { data, error } = await client.from("banners").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase getBanner error: ${error.message}`);
    return data ? this.mapRowToBanner(data) : null;
  }

  async listBanners(onlyActive = true): Promise<Banner[]> {
    const client = this.ensureClient();
    let query = client.from("banners").select("*").order("sort_order", { ascending: true });

    if (onlyActive) {
      const now = new Date().toISOString();
      query = query
        .eq("enabled", true)
        .eq("published", true)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listBanners error: ${error.message}`);
    return (data || []).map(row => this.mapRowToBanner(row));
  }

  async createBanner(banner: Omit<Banner, "id" | "createdAt" | "updatedAt">): Promise<Banner> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("banners")
      .insert({
        name: banner.name,
        media_id: typeof banner.mediaId === 'string' && banner.mediaId.trim() ? banner.mediaId.trim() : null,
        media_url: banner.mediaUrl,
        placement: banner.placement,
        title: banner.title,
        alt_text: banner.altText,
        target: banner.target,
        sort_order: banner.sortOrder,
        enabled: banner.enabled,
        published: banner.published,
        start_at: typeof banner.startAt === 'string' && banner.startAt.trim() ? banner.startAt.trim() : null,
        end_at: typeof banner.endAt === 'string' && banner.endAt.trim() ? banner.endAt.trim() : null,
        created_by: banner.createdBy,
        updated_by: banner.updatedBy
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createBanner error: ${error.message}`);
    return this.mapRowToBanner(data);
  }

  async updateBanner(id: string, banner: Partial<Banner>): Promise<void> {
    const client = this.ensureClient();
    const updatePayload: Record<string, any> = {
      updated_by: banner.updatedBy,
      updated_at: new Date().toISOString()
    };

    if (banner.name !== undefined) updatePayload.name = banner.name;
    if (banner.mediaId !== undefined) {
      updatePayload.media_id = typeof banner.mediaId === 'string' && banner.mediaId.trim() ? banner.mediaId.trim() : null;
    }
    if (banner.mediaUrl !== undefined) updatePayload.media_url = banner.mediaUrl;
    if (banner.placement !== undefined) updatePayload.placement = banner.placement;
    if (banner.title !== undefined) updatePayload.title = banner.title;
    if (banner.altText !== undefined) updatePayload.alt_text = banner.altText;
    if (banner.target !== undefined) updatePayload.target = banner.target;
    if (banner.sortOrder !== undefined) updatePayload.sort_order = banner.sortOrder;
    if (banner.enabled !== undefined) updatePayload.enabled = banner.enabled;
    if (banner.published !== undefined) updatePayload.published = banner.published;
    if (banner.startAt !== undefined) {
      updatePayload.start_at = typeof banner.startAt === 'string' && banner.startAt.trim() ? banner.startAt.trim() : null;
    }
    if (banner.endAt !== undefined) {
      updatePayload.end_at = typeof banner.endAt === 'string' && banner.endAt.trim() ? banner.endAt.trim() : null;
    }

    const { error } = await client
      .from("banners")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw new Error(`Supabase updateBanner error: ${error.message}`);
  }

  async deleteBanner(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("banners").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteBanner error: ${error.message}`);
  }

  // ==========================================
  // POPUPS
  // ==========================================

  async getPopup(id: string): Promise<Popup | null> {
    const client = this.ensureClient();
    const { data, error } = await client.from("popups").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase getPopup error: ${error.message}`);
    return data ? this.mapRowToPopup(data) : null;
  }

  async listPopups(onlyActive = true): Promise<Popup[]> {
    const client = this.ensureClient();
    let query = client.from("popups").select("*").order("priority", { ascending: false });

    if (onlyActive) {
      const now = new Date().toISOString();
      query = query
        .eq("enabled", true)
        .eq("published", true)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listPopups error: ${error.message}`);
    return (data || []).map(row => this.mapRowToPopup(row));
  }

  async createPopup(popup: Omit<Popup, "id" | "createdAt" | "updatedAt">): Promise<Popup> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("popups")
      .insert({
        name: popup.name,
        title: popup.title,
        content: popup.content,
        media_id: popup.mediaId,
        media_url: popup.mediaUrl,
        placement: popup.placement,
        trigger: popup.trigger,
        target: popup.target,
        priority: popup.priority,
        enabled: popup.enabled,
        published: popup.published,
        start_at: popup.startAt,
        end_at: popup.endAt,
        created_by: popup.createdBy,
        updated_by: popup.updatedBy
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createPopup error: ${error.message}`);
    return this.mapRowToPopup(data);
  }

  async updatePopup(id: string, popup: Partial<Popup>): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client
      .from("popups")
      .update({
        name: popup.name,
        title: popup.title,
        content: popup.content,
        media_id: popup.mediaId,
        media_url: popup.mediaUrl,
        placement: popup.placement,
        trigger: popup.trigger,
        target: popup.target,
        priority: popup.priority,
        enabled: popup.enabled,
        published: popup.published,
        start_at: popup.startAt,
        end_at: popup.endAt,
        updated_by: popup.updatedBy,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) throw new Error(`Supabase updatePopup error: ${error.message}`);
  }

  async deletePopup(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("popups").delete().eq("id", id);
    if (error) throw new Error(`Supabase deletePopup error: ${error.message}`);
  }

  // ==========================================
  // FAQS
  // ==========================================

  async getFAQ(id: string): Promise<FAQItem | null> {
    const client = this.ensureClient();
    const { data, error } = await client.from("faqs").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase getFAQ error: ${error.message}`);
    return data ? this.mapRowToFAQ(data) : null;
  }

  async listFAQs(params: { onlyActive?: boolean; category?: string } = {}): Promise<FAQItem[]> {
    const client = this.ensureClient();
    let query = client.from("faqs").select("*").order("sort_order", { ascending: true });

    if (params.onlyActive) {
      query = query.eq("enabled", true).eq("published", true).eq("archived", false);
    }
    if (params.category) {
      query = query.eq("category", params.category);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listFAQs error: ${error.message}`);
    return (data || []).map(row => this.mapRowToFAQ(row));
  }

  async createFAQ(faq: Omit<FAQItem, "id" | "createdAt" | "updatedAt">): Promise<FAQItem> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("faqs")
      .insert({
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        sort_order: faq.sortOrder,
        published: faq.published,
        enabled: faq.enabled,
        archived: faq.archived,
        related_game_id: faq.relatedGameId,
        related_promo_id: faq.relatedPromoId,
        related_blog_id: faq.relatedBlogId,
        created_by: faq.createdBy,
        updated_by: faq.updatedBy,
        published_at: faq.publishedAt
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createFAQ error: ${error.message}`);
    return this.mapRowToFAQ(data);
  }

  async updateFAQ(id: string, faq: Partial<FAQItem>): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client
      .from("faqs")
      .update({
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        sort_order: faq.sortOrder,
        published: faq.published,
        enabled: faq.enabled,
        archived: faq.archived,
        related_game_id: faq.relatedGameId,
        related_promo_id: faq.relatedPromoId,
        related_blog_id: faq.relatedBlogId,
        updated_by: faq.updatedBy,
        updated_at: new Date().toISOString(),
        published_at: faq.publishedAt
      })
      .eq("id", id);

    if (error) throw new Error(`Supabase updateFAQ error: ${error.message}`);
  }

  async deleteFAQ(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("faqs").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteFAQ error: ${error.message}`);
  }

  // ==========================================
  // BLOGS
  // ==========================================

  async getBlog(id: string): Promise<BlogPost | null> {
    const client = this.ensureClient();
    const { data, error } = await client.from("blogs").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase getBlog error: ${error.message}`);
    return data ? this.mapRowToBlog(data) : null;
  }

  async getBlogBySlug(slug: string): Promise<BlogPost | null> {
    const client = this.ensureClient();
    const { data, error } = await client.from("blogs").select("*").eq("slug", slug).maybeSingle();
    if (error) throw new Error(`Supabase getBlogBySlug error: ${error.message}`);
    return data ? this.mapRowToBlog(data) : null;
  }

  async listBlogs(params: { onlyActive?: boolean; category?: string; limit?: number; offset?: number } = {}): Promise<{ items: BlogPost[]; total: number }> {
    const client = this.ensureClient();
    let query = client.from("blogs").select("*", { count: "exact" }).order("published_at", { ascending: false });

    if (params.onlyActive) {
      const now = new Date().toISOString();
      query = query
        .eq("enabled", true)
        .eq("published", true)
        .eq("is_archived", false)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`);
    }
    if (params.category) {
      query = query.eq("category", params.category);
    }
    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Supabase listBlogs error: ${error.message}`);
    return {
      items: (data || []).map(row => this.mapRowToBlog(row)),
      total: count || 0
    };
  }

  async createBlog(blog: Omit<BlogPost, "id" | "createdAt" | "updatedAt">): Promise<BlogPost> {
    const client = this.ensureClient();
    const toSafeTimestamp = (val?: string | null): string | null => {
      if (!val || typeof val !== 'string' || !val.trim()) return null;
      const d = new Date(val.trim());
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    const toSafeStringOrNull = (val?: string | null): string | null => {
      if (!val || typeof val !== 'string' || !val.trim()) return null;
      return val.trim();
    };

    const { data, error } = await client
      .from("blogs")
      .insert({
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        content: blog.content,
        cover_media_id: toSafeStringOrNull(blog.coverMediaId),
        cover_media_url: toSafeStringOrNull(blog.coverMediaUrl),
        category: blog.category,
        tags: Array.isArray(blog.tags) ? blog.tags : [],
        author: blog.author,
        read_time: blog.readTime,
        published: typeof blog.published === "boolean" ? blog.published : false,
        enabled: typeof blog.enabled === "boolean" ? blog.enabled : true,
        is_archived: typeof blog.isArchived === "boolean" ? blog.isArchived : false,
        published_at: toSafeTimestamp(blog.publishedAt),
        start_at: toSafeTimestamp(blog.startAt),
        end_at: toSafeTimestamp(blog.endAt),
        seo_title: toSafeStringOrNull(blog.seoTitle),
        seo_description: toSafeStringOrNull(blog.seoDescription),
        related_game_id: toSafeStringOrNull(blog.relatedGameId),
        related_promo_id: toSafeStringOrNull(blog.relatedPromoId),
        related_campaign_id: toSafeStringOrNull(blog.relatedCampaignId),
        related_landing_id: toSafeStringOrNull(blog.relatedLandingId),
        created_by: blog.createdBy,
        updated_by: blog.updatedBy,
        status: blog.status
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createBlog error: ${error.message}`);
    return this.mapRowToBlog(data);
  }

  async updateBlog(id: string, blog: Partial<BlogPost>): Promise<void> {
    const client = this.ensureClient();

    const toSafeTimestamp = (val?: string | null): string | null => {
      if (!val || typeof val !== 'string' || !val.trim()) return null;
      const d = new Date(val.trim());
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    const toSafeStringOrNull = (val?: string | null): string | null => {
      if (!val || typeof val !== 'string' || !val.trim()) return null;
      return val.trim();
    };

    const payload: Record<string, any> = {
      updated_by: blog.updatedBy,
      updated_at: new Date().toISOString()
    };

    if (blog.title !== undefined) payload.title = blog.title;
    if (blog.slug !== undefined) payload.slug = blog.slug;
    if (blog.excerpt !== undefined) payload.excerpt = blog.excerpt;
    if (blog.content !== undefined) payload.content = blog.content;
    if (blog.coverMediaId !== undefined) payload.cover_media_id = toSafeStringOrNull(blog.coverMediaId);
    if (blog.coverMediaUrl !== undefined) payload.cover_media_url = toSafeStringOrNull(blog.coverMediaUrl);
    if (blog.category !== undefined) payload.category = blog.category;
    if (blog.tags !== undefined) payload.tags = Array.isArray(blog.tags) ? blog.tags : [];
    if (blog.author !== undefined) payload.author = blog.author;
    if (blog.readTime !== undefined) payload.read_time = blog.readTime;
    if (blog.published !== undefined) payload.published = blog.published;
    if (blog.enabled !== undefined) payload.enabled = blog.enabled;
    if (blog.isArchived !== undefined) payload.is_archived = blog.isArchived;
    if (blog.publishedAt !== undefined) payload.published_at = toSafeTimestamp(blog.publishedAt);
    if (blog.startAt !== undefined) payload.start_at = toSafeTimestamp(blog.startAt);
    if (blog.endAt !== undefined) payload.end_at = toSafeTimestamp(blog.endAt);
    if (blog.seoTitle !== undefined) payload.seo_title = toSafeStringOrNull(blog.seoTitle);
    if (blog.seoDescription !== undefined) payload.seo_description = toSafeStringOrNull(blog.seoDescription);
    if (blog.relatedGameId !== undefined) payload.related_game_id = toSafeStringOrNull(blog.relatedGameId);
    if (blog.relatedPromoId !== undefined) payload.related_promo_id = toSafeStringOrNull(blog.relatedPromoId);
    if (blog.relatedCampaignId !== undefined) payload.related_campaign_id = toSafeStringOrNull(blog.relatedCampaignId);
    if (blog.relatedLandingId !== undefined) payload.related_landing_id = toSafeStringOrNull(blog.relatedLandingId);
    if (blog.status !== undefined) payload.status = blog.status;

    const { error } = await client
      .from("blogs")
      .update(payload)
      .eq("id", id);

    if (error) throw new Error(`Supabase updateBlog error: ${error.message}`);
  }

  async deleteBlog(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("blogs").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteBlog error: ${error.message}`);
  }

  // ==========================================
  // LANDINGS
  // ==========================================

  async getLanding(id: string): Promise<LandingPage | null> {
    const client = this.ensureClient();
    const { data, error } = await client.from("landings").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase getLanding error: ${error.message}`);
    return data ? this.mapRowToLanding(data) : null;
  }

  async getLandingBySlug(slug: string): Promise<LandingPage | null> {
    const client = this.ensureClient();
    const { data, error } = await client.from("landings").select("*").eq("slug", slug).maybeSingle();
    if (error) throw new Error(`Supabase getLandingBySlug error: ${error.message}`);
    return data ? this.mapRowToLanding(data) : null;
  }

  async listLandings(onlyActive = true): Promise<LandingPage[]> {
    const client = this.ensureClient();
    let query = client.from("landings").select("*").order("created_at", { ascending: false });

    if (onlyActive) {
      const now = new Date().toISOString();
      query = query
        .eq("enabled", true)
        .eq("published", true)
        .eq("is_archived", false)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listLandings error: ${error.message}`);
    return (data || []).map(row => this.mapRowToLanding(row));
  }

  async createLanding(landing: Omit<LandingPage, "id" | "createdAt" | "updatedAt">): Promise<LandingPage> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("landings")
      .insert({
        name: landing.name,
        title: landing.title,
        slug: landing.slug,
        description: landing.description,
        seo_title: landing.seoTitle,
        seo_description: landing.seoDescription,
        media_id: landing.mediaId,
        media_url: landing.mediaUrl,
        sections: landing.sections,
        cta_text: landing.ctaText,
        cta_url: landing.ctaUrl,
        campaign_id: landing.campaignId,
        game_id: landing.gameId,
        category_id: landing.categoryId,
        product_id: landing.productId,
        start_at: landing.startAt,
        end_at: landing.endAt,
        enabled: landing.enabled,
        published: landing.published,
        is_archived: landing.isArchived,
        status: landing.status,
        created_by: landing.createdBy,
        updated_by: landing.updatedBy
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createLanding error: ${error.message}`);
    return this.mapRowToLanding(data);
  }

  async updateLanding(id: string, landing: Partial<LandingPage>): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client
      .from("landings")
      .update({
        name: landing.name,
        title: landing.title,
        slug: landing.slug,
        description: landing.description,
        seo_title: landing.seoTitle,
        seo_description: landing.seoDescription,
        media_id: landing.mediaId,
        media_url: landing.mediaUrl,
        sections: landing.sections,
        cta_text: landing.ctaText,
        cta_url: landing.ctaUrl,
        campaign_id: landing.campaignId,
        game_id: landing.gameId,
        category_id: landing.categoryId,
        product_id: landing.productId,
        start_at: landing.startAt,
        end_at: landing.endAt,
        enabled: landing.enabled,
        published: landing.published,
        is_archived: landing.isArchived,
        status: landing.status,
        updated_by: landing.updatedBy,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) throw new Error(`Supabase updateLanding error: ${error.message}`);
  }

  async deleteLanding(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("landings").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteLanding error: ${error.message}`);
  }

  // ==========================================
  // CAMPAIGNS
  // ==========================================

  async getCampaign(id: string): Promise<Campaign | null> {
    const client = this.ensureClient();
    const { data, error } = await client.from("campaigns").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase getCampaign error: ${error.message}`);
    return data ? this.mapRowToCampaign(data) : null;
  }

  async getCampaignBySlug(slug: string): Promise<Campaign | null> {
    const client = this.ensureClient();
    const { data, error } = await client.from("campaigns").select("*").eq("slug", slug).maybeSingle();
    if (error) throw new Error(`Supabase getCampaignBySlug error: ${error.message}`);
    return data ? this.mapRowToCampaign(data) : null;
  }

  async listCampaigns(onlyActive = true): Promise<Campaign[]> {
    const client = this.ensureClient();
    let query = client.from("campaigns").select("*").order("priority", { ascending: false });

    if (onlyActive) {
      const now = new Date().toISOString();
      query = query
        .eq("enabled", true)
        .eq("published", true)
        .eq("is_archived", false)
        .lte("start_at", now)
        .or(`end_at.is.null,end_at.gte.${now}`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listCampaigns error: ${error.message}`);
    return (data || []).map(row => this.mapRowToCampaign(row));
  }

  async createCampaign(campaign: Omit<Campaign, "id" | "createdAt" | "updatedAt">): Promise<Campaign> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("campaigns")
      .insert({
        name: campaign.name,
        title: campaign.title,
        description: campaign.description,
        slug: campaign.slug,
        media_id: (campaign.mediaId && campaign.mediaId.trim()) ? campaign.mediaId.trim() : null,
        media_url: (campaign.mediaUrl && campaign.mediaUrl.trim()) ? campaign.mediaUrl.trim() : null,
        promo_ids: Array.isArray(campaign.promoIds) ? campaign.promoIds : [],
        flash_sale_ids: Array.isArray(campaign.flashSaleIds) ? campaign.flashSaleIds : [],
        banner_ids: Array.isArray(campaign.bannerIds) ? campaign.bannerIds : [],
        popup_ids: Array.isArray(campaign.popupIds) ? campaign.popupIds : [],
        target_type: campaign.targetType || 'all',
        target_id: (campaign.targetId && campaign.targetId.trim()) ? campaign.targetId.trim() : null,
        target_url: (campaign.targetUrl && campaign.targetUrl.trim()) ? campaign.targetUrl.trim() : null,
        priority: typeof campaign.priority === 'number' ? campaign.priority : 0,
        enabled: typeof campaign.enabled === 'boolean' ? campaign.enabled : true,
        published: typeof campaign.published === 'boolean' ? campaign.published : false,
        is_archived: typeof campaign.isArchived === 'boolean' ? campaign.isArchived : false,
        start_at: campaign.startAt && !isNaN(new Date(campaign.startAt).getTime())
          ? new Date(campaign.startAt).toISOString()
          : new Date().toISOString(),
        end_at: campaign.endAt && campaign.endAt.trim() && !isNaN(new Date(campaign.endAt).getTime())
          ? new Date(campaign.endAt).toISOString()
          : null,
        created_by: campaign.createdBy || null,
        updated_by: campaign.updatedBy || null
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createCampaign error: ${error.message}`);
    return this.mapRowToCampaign(data);
  }

  async updateCampaign(id: string, campaign: Partial<Campaign>): Promise<void> {
    const client = this.ensureClient();
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (campaign.name !== undefined) updatePayload.name = campaign.name;
    if (campaign.title !== undefined) updatePayload.title = campaign.title;
    if (campaign.description !== undefined) updatePayload.description = campaign.description;
    if (campaign.slug !== undefined) updatePayload.slug = campaign.slug;
    if (campaign.mediaId !== undefined) {
      updatePayload.media_id = (campaign.mediaId && campaign.mediaId.trim()) ? campaign.mediaId.trim() : null;
    }
    if (campaign.mediaUrl !== undefined) {
      updatePayload.media_url = (campaign.mediaUrl && campaign.mediaUrl.trim()) ? campaign.mediaUrl.trim() : null;
    }
    if (campaign.promoIds !== undefined) {
      updatePayload.promo_ids = Array.isArray(campaign.promoIds) ? campaign.promoIds : [];
    }
    if (campaign.flashSaleIds !== undefined) {
      updatePayload.flash_sale_ids = Array.isArray(campaign.flashSaleIds) ? campaign.flashSaleIds : [];
    }
    if (campaign.bannerIds !== undefined) {
      updatePayload.banner_ids = Array.isArray(campaign.bannerIds) ? campaign.bannerIds : [];
    }
    if (campaign.popupIds !== undefined) {
      updatePayload.popup_ids = Array.isArray(campaign.popupIds) ? campaign.popupIds : [];
    }
    if (campaign.targetType !== undefined) updatePayload.target_type = campaign.targetType;
    if (campaign.targetId !== undefined) {
      updatePayload.target_id = (campaign.targetId && campaign.targetId.trim()) ? campaign.targetId.trim() : null;
    }
    if (campaign.targetUrl !== undefined) {
      updatePayload.target_url = (campaign.targetUrl && campaign.targetUrl.trim()) ? campaign.targetUrl.trim() : null;
    }
    if (campaign.priority !== undefined) updatePayload.priority = campaign.priority;
    if (campaign.enabled !== undefined) updatePayload.enabled = campaign.enabled;
    if (campaign.published !== undefined) updatePayload.published = campaign.published;
    if (campaign.isArchived !== undefined) updatePayload.is_archived = campaign.isArchived;
    if (campaign.startAt !== undefined) {
      updatePayload.start_at = campaign.startAt && !isNaN(new Date(campaign.startAt).getTime())
        ? new Date(campaign.startAt).toISOString()
        : new Date().toISOString();
    }
    if (campaign.endAt !== undefined) {
      updatePayload.end_at = campaign.endAt && campaign.endAt.trim() && !isNaN(new Date(campaign.endAt).getTime())
        ? new Date(campaign.endAt).toISOString()
        : null;
    }
    if (campaign.updatedBy !== undefined) updatePayload.updated_by = campaign.updatedBy;

    // Status translation if status is passed directly instead of boolean flags
    if (campaign.status !== undefined) {
      if (campaign.status === 'ARCHIVED') {
        updatePayload.is_archived = true;
      } else if (campaign.status === 'DRAFT') {
        updatePayload.published = false;
      } else if (campaign.status === 'INACTIVE') {
        updatePayload.enabled = false;
      } else if (campaign.status === 'ACTIVE') {
        updatePayload.enabled = true;
        updatePayload.published = true;
        updatePayload.is_archived = false;
      }
    }

    const { error } = await client
      .from("campaigns")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw new Error(`Supabase updateCampaign error: ${error.message}`);
  }

  async deleteCampaign(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("campaigns").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteCampaign error: ${error.message}`);
  }

  // ==========================================
  // HELPERS / MAPPING
  // ==========================================

  private mapRowToBanner(row: any): Banner {
    return {
      id: row.id,
      name: row.name,
      mediaId: row.media_id,
      mediaUrl: row.media_url,
      placement: row.placement,
      title: row.title,
      altText: row.alt_text,
      target: row.target,
      sortOrder: row.sort_order,
      enabled: row.enabled,
      published: row.published,
      startAt: row.start_at,
      endAt: row.end_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToPopup(row: any): Popup {
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      content: row.content,
      mediaId: row.media_id,
      mediaUrl: row.media_url,
      placement: row.placement,
      trigger: row.trigger,
      target: row.target,
      priority: row.priority,
      enabled: row.enabled,
      published: row.published,
      startAt: row.start_at,
      endAt: row.end_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToFAQ(row: any): FAQItem {
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      category: row.category,
      sortOrder: row.sort_order,
      published: row.published,
      enabled: row.enabled,
      archived: row.archived,
      relatedGameId: row.related_game_id,
      relatedPromoId: row.related_promo_id,
      relatedBlogId: row.related_blog_id,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at
    };
  }

  private mapRowToBlog(row: any): BlogPost {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      content: row.content,
      coverMediaId: row.cover_media_id,
      coverMediaUrl: row.cover_media_url,
      category: row.category,
      tags: row.tags,
      author: row.author,
      readTime: row.read_time,
      published: row.published,
      enabled: row.enabled,
      isArchived: row.is_archived,
      publishedAt: row.published_at,
      startAt: row.start_at,
      endAt: row.end_at,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      relatedGameId: row.related_game_id,
      relatedPromoId: row.related_promo_id,
      relatedCampaignId: row.related_campaign_id,
      relatedLandingId: row.related_landing_id,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status as BlogStatus
    };
  }

  private mapRowToLanding(row: any): LandingPage {
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      slug: row.slug,
      description: row.description,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      mediaId: row.media_id,
      mediaUrl: row.media_url,
      sections: row.sections,
      ctaText: row.cta_text,
      ctaUrl: row.cta_url,
      campaignId: row.campaign_id,
      gameId: row.game_id,
      categoryId: row.category_id,
      productId: row.product_id,
      startAt: row.start_at,
      endAt: row.end_at,
      enabled: row.enabled,
      published: row.published,
      isArchived: row.is_archived,
      status: row.status as LandingStatus,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToCampaign(row: any): Campaign {
    const startAt = row.start_at || new Date().toISOString();
    const endAt = row.end_at || undefined;
    const enabled = typeof row.enabled === 'boolean' ? row.enabled : true;
    const published = typeof row.published === 'boolean' ? row.published : false;
    const isArchived = typeof row.is_archived === 'boolean' ? row.is_archived : false;

    const status = computeCampaignStatus({
      published,
      enabled,
      isArchived,
      startAt,
      endAt
    });

    return {
      id: row.id,
      name: row.name,
      title: row.title,
      description: row.description,
      slug: row.slug,
      mediaId: row.media_id || undefined,
      mediaUrl: row.media_url || undefined,
      promoIds: Array.isArray(row.promo_ids) ? row.promo_ids : [],
      flashSaleIds: Array.isArray(row.flash_sale_ids) ? row.flash_sale_ids : [],
      bannerIds: Array.isArray(row.banner_ids) ? row.banner_ids : [],
      popupIds: Array.isArray(row.popup_ids) ? row.popup_ids : [],
      targetType: row.target_type || 'all',
      targetId: row.target_id || undefined,
      targetUrl: row.target_url || undefined,
      priority: typeof row.priority === 'number' ? row.priority : 0,
      enabled,
      published,
      isArchived,
      startAt,
      endAt,
      status,
      createdBy: row.created_by || '',
      updatedBy: row.updated_by || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    };
  }
}
