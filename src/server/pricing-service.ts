import { supabaseAdmin } from "./supabase-admin";
import { PricingMethod, ProductVariant, PricingRule, PriceHistory } from "../types/core";

export class PricingService {
  private static instance: PricingService;
  
  private constructor() {}
  
  public static getInstance(): PricingService {
    if (!PricingService.instance) {
      PricingService.instance = new PricingService();
    }
    return PricingService.instance;
  }

  calculatePrice(cost: number, method: PricingMethod, value: number): { 
     sellingPrice: number, 
     margin: number, 
     marginPercentage: number,
    status: 'active' | 'negative_margin'
  } {
    let sellingPrice = 0;
    switch (method) {
      case 'fixed':
        sellingPrice = value;
        break;
      case 'markup_fixed':
        sellingPrice = cost + value;
        break;
      case 'markup_percentage':
        sellingPrice = cost * (1 + (value / 100));
        break;
      case 'target_margin':
        if (value >= 100) {
          throw new Error("Target margin must be less than 100%");
        }
        sellingPrice = cost / (1 - (value / 100));
        break;
      default:
        sellingPrice = value;
    }
    
    sellingPrice = Math.round(sellingPrice);
    const margin = sellingPrice - cost;
    const marginPercentage = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;
    const status = sellingPrice < cost ? 'negative_margin' : 'active';
    
    return {
      sellingPrice,
      margin,
      marginPercentage: parseFloat(marginPercentage.toFixed(2)),
      status
    };
  }

  private rulesCache: { data: PricingRule[] | null, timestamp: number } | null = null;
  private readonly CACHE_TTL = 10000; // 10 seconds

  public invalidateRulesCache(): void {
    this.rulesCache = null;
  }

  async resolvePricingRule(variant: ProductVariant, product: any, context: { userId?: string } = {}): Promise<PricingRule | null> {
    const now = new Date().toISOString();
    const nowMs = Date.now();
    
    let rulesData: any[] | null = null;
    
    if (this.rulesCache && (nowMs - this.rulesCache.timestamp) < this.CACHE_TTL) {
      rulesData = this.rulesCache.data;
    } else {
      const { data } = await supabaseAdmin!
        .from("pricing_rules")
        .select("*")
        .eq("status", "active");
      rulesData = data;
      this.rulesCache = { data: data as any, timestamp: nowMs };
    }
    
    if (!rulesData || rulesData.length === 0) return null;
    
    let memberPlanId: string | null = null;
    if (context.userId) {
      const { MembershipService } = await import("./membership-service");
      const membership = await MembershipService.getInstance().getCustomerMembership(context.userId);
      if (membership && membership.status === 'ACTIVE') {
        memberPlanId = membership.plan_id;
      }
    }

    const rules: PricingRule[] = rulesData
      .map(row => ({
        id: row.id,
        name: row.name,
        method: row.method,
        value: row.value,
        scope: row.scope,
        scopeId: row.scope_id,
        priority: row.priority,
        status: row.status,
        effectiveFrom: row.effective_from,
        effectiveUntil: row.effective_until,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      } as PricingRule))
      .filter(rule => {
        if (rule.effectiveFrom && rule.effectiveFrom > now) return false;
        if (rule.effectiveUntil && rule.effectiveUntil < now) return false;
        
        if (rule.scope === 'variant' && rule.scopeId === variant.id) return true;
        if (rule.scope === 'membership' && memberPlanId && rule.scopeId === memberPlanId) return true;
        if (rule.scope === 'product' && rule.scopeId === variant.productId) return true;
        if (rule.scope === 'game' && rule.scopeId === product.game_id) return true;
        if (rule.scope === 'category' && product.category_ids?.includes(rule.scopeId)) return true;
        if (rule.scope === 'global') return true;
        return false;
      });

    if (rules.length === 0) return null;

    const scopePriority: Record<string, number> = {
      variant: 6,
      membership: 5,
      product: 4,
      game: 3,
      category: 2,
      global: 1
    };

    rules.sort((a, b) => {
      if (scopePriority[a.scope] !== scopePriority[b.scope]) {
        return scopePriority[b.scope] - scopePriority[a.scope];
      }
      return b.priority - a.priority;
    });

    return rules[0];
  }

  async logPriceHistory(variantId: string, oldData: any, newData: any, actor: { uid: string, email: string }, reason: string): Promise<void> {
    const history: PriceHistory = {
      variantId,
      oldCost: oldData.pricing?.baseCost || 0,
      newCost: newData.pricing?.baseCost || 0,
      oldSellingPrice: oldData.pricing?.sellingPrice || 0,
      newSellingPrice: newData.pricing?.sellingPrice || 0,
      oldMargin: oldData.pricing?.margin || 0,
      newMargin: newData.pricing?.margin || 0,
      pricingMethod: newData.pricing?.pricingMethod || 'fixed',
      ruleId: newData.pricing?.appliedRuleId,
      effectiveAt: new Date().toISOString(),
      actor,
      reason,
      timestamp: new Date().toISOString()
    };

    await supabaseAdmin!.from("price_histories").insert({
      variant_id: history.variantId,
      old_cost: history.oldCost,
      new_cost: history.newCost,
      old_selling_price: history.oldSellingPrice,
      new_selling_price: history.newSellingPrice,
      old_margin: history.oldMargin,
      new_margin: history.newMargin,
      pricing_method: history.pricingMethod,
      rule_id: history.ruleId,
      actor_uid: actor.uid,
      actor_email: actor.email,
      reason: history.reason,
      created_at: history.timestamp
    });
  }

  async refreshVariantPrice(variantId: string, actor: { uid: string, email: string }): Promise<void> {
    const { data: variantRow } = await supabaseAdmin!
      .from("product_variants")
      .select("*")
      .eq("id", variantId)
      .maybeSingle();
    
    if (!variantRow) return;

    const variant: ProductVariant = {
      id: variantRow.id,
      productId: variantRow.product_id,
      name: variantRow.name,
      sku: variantRow.sku,
      status: variantRow.status,
      pricing: {
        baseCost: variantRow.base_cost,
        sellingPrice: variantRow.selling_price,
        pricingMethod: variantRow.pricing_method,
        currency: variantRow.currency || "IDR",
        margin: variantRow.margin,
        marginPercentage: variantRow.margin_percentage,
        status: variantRow.metadata?.pricing_status || 'active',
        appliedRuleId: variantRow.metadata?.applied_rule_id,
        lastPriceUpdate: variantRow.metadata?.last_price_update
      },
      displayName: variantRow.display_name || variantRow.name,
      availability: variantRow.availability || "available",
      sortOrder: variantRow.sort_order || 0,
      createdBy: variantRow.created_by || "system",
      updatedBy: variantRow.updated_by || "system",
      createdAt: variantRow.created_at,
      updatedAt: variantRow.updated_at
    };

    const { data: productRow } = await supabaseAdmin!
      .from("products")
      .select("*")
      .eq("id", variant.productId)
      .maybeSingle();
    
    const product = productRow || {};
    const rule = await this.resolvePricingRule(variant, product, {});
    
    const method = variant.pricing.pricingMethod || 'fixed';
    let effectiveMethod = method;
    let effectiveValue = variant.pricing.sellingPrice;

    if (rule) {
      effectiveMethod = rule.method;
      effectiveValue = rule.value;
    }

    const { sellingPrice, margin, marginPercentage, status } = this.calculatePrice(
      variant.pricing.baseCost,
      effectiveMethod,
      effectiveValue
    );

    const updates: any = {
      selling_price: sellingPrice,
      margin: margin,
      margin_percentage: marginPercentage,
      metadata: {
        ...(variantRow.metadata || {}),
        pricing_status: status,
        applied_rule_id: rule?.id || null,
        last_price_update: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabaseAdmin!.from("product_variants").update(updates).eq("id", variantId);
    if (updateError) {
      console.error(`[PricingService] Failed to refresh price for ${variantId}:`, updateError);
      return;
    }
    
    if (variant.pricing.sellingPrice !== sellingPrice) {
      await this.logPriceHistory(variantId, variant, { pricing: { ...variant.pricing, sellingPrice } }, actor, "System Refresh");
    }
  }

  async refreshMultipleVariantsPrice(variantIds: string[], actor: { uid: string, email: string }): Promise<void> {
    for (const id of variantIds) {
      await this.refreshVariantPrice(id, actor);
    }
  }

  async resolveEffectivePrice(variant: ProductVariant, context: { userId?: string } = {}, product?: any): Promise<{ finalPrice: number, ruleId?: string }> {
    let productObj = product;
    
    if (!productObj) {
      if (variant.productId.startsWith("virtual-product-")) {
        productObj = {};
      } else {
        const { data: productRow } = await supabaseAdmin!
          .from("products")
          .select("*")
          .eq("id", variant.productId)
          .maybeSingle();
        productObj = productRow || {};
      }
    }
    
    const rule = await this.resolvePricingRule(variant, productObj, context);
    
    const method = rule ? rule.method : (variant.pricing?.pricingMethod || 'fixed');
    const value = rule ? rule.value : (variant.pricing?.sellingPrice || 0);
    
    const { sellingPrice } = this.calculatePrice(
      variant.pricing?.baseCost || 0,
      method,
      value
    );
    
    return {
      finalPrice: sellingPrice,
      ruleId: rule?.id
    };
  }
}
