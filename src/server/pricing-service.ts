import { adminDb } from "./firebase-admin";
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

  /**
   * Core Calculation Engine
   */
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
        // Formula: sellingPrice = cost / (1 - targetMarginPercentage)
        // Validasi: targetMarginPercentage < 100%
        if (value >= 100) {
          throw new Error("Target margin must be less than 100%");
        }
        sellingPrice = cost / (1 - (value / 100));
        break;
      default:
        sellingPrice = value;
    }

    // Rounding: Default to rounding to 0 decimal places for IDR
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

  /**
   * Resolves the effective pricing rule for a given context
   */
  async resolvePricingRule(variant: ProductVariant, product: any, context: { userId?: string } = {}): Promise<PricingRule | null> {
    // Priority Hierarchy: Variant > Membership > Product > Game > Category > Global
    const now = new Date().toISOString();
    const rulesSnap = await adminDb.collection("pricingRules")
      .where("status", "==", "active")
      .get();
    
    if (rulesSnap.empty) return null;

    let memberPlanId: string | null = null;
    if (context.userId) {
      const { MembershipService } = await import("./membership-service");
      const membership = await MembershipService.getInstance().getCustomerMembership(context.userId);
      if (membership && membership.status === 'ACTIVE') {
        memberPlanId = membership.planId;
      }
    }

    const rules = rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PricingRule))
      .filter(rule => {
        // Filter by effective date
        if (rule.effectiveFrom && rule.effectiveFrom > now) return false;
        if (rule.effectiveUntil && rule.effectiveUntil < now) return false;

        // Filter by scope
        if (rule.scope === 'variant' && rule.scopeId === variant.id) return true;
        if (rule.scope === 'membership' && memberPlanId && rule.scopeId === memberPlanId) return true;
        if (rule.scope === 'product' && rule.scopeId === variant.productId) return true;
        if (rule.scope === 'game' && rule.scopeId === product.gameId) return true;
        if (rule.scope === 'category' && product.categoryIds?.includes(rule.scopeId)) return true;
        if (rule.scope === 'global') return true;

        return false;
      });

    if (rules.length === 0) return null;

    // Sort by scope specificity (Variant > Membership > Product > Game > Category > Global) and priority
    const scopePriority = {
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

  /**
   * Logs price changes to history
   */
  async logPriceHistory(variantId: string, oldData: any, newData: any, actor: { uid: string, email: string }, reason: string): Promise<void> {
    const historyRef = adminDb.collection("priceHistories").doc();
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

    await historyRef.set(history);
  }

  /**
   * Refreshes variant price based on current cost and effective rules
   */
  async refreshVariantPrice(variantId: string, actor: { uid: string, email: string }): Promise<void> {
    const variantRef = adminDb.collection("productVariants").doc(variantId);
    const variantSnap = await variantRef.get();
    if (!variantSnap.exists) return;

    const variant = { id: variantSnap.id, ...variantSnap.data() } as ProductVariant;
    const productSnap = await adminDb.collection("products").doc(variant.productId).get();
    const product = productSnap.exists ? productSnap.data() : {};
    
    const rule = await this.resolvePricingRule(variant, product, null);
    
    const method = variant.pricing.pricingMethod || 'fixed';
    const value = rule ? rule.value : variant.pricing.sellingPrice; // Fallback to current selling price if fixed and no rule

    // If there is a rule, it overrides the variant's own manual fixed setting if the rule is more specific or higher priority
    // But usually rules are meant to be the authority.
    
    let effectiveMethod = method;
    let effectiveValue = value;

    if (rule) {
      effectiveMethod = rule.method;
      effectiveValue = rule.value;
    }

    const { sellingPrice, margin, marginPercentage, status } = this.calculatePrice(
      variant.pricing.baseCost,
      effectiveMethod,
      effectiveValue
    );

    const updates = {
      "pricing.sellingPrice": sellingPrice,
      "pricing.margin": margin,
      "pricing.marginPercentage": marginPercentage,
      "pricing.status": status,
      "pricing.appliedRuleId": rule?.id || null,
      "pricing.lastPriceUpdate": new Date().toISOString(),
      "updatedAt": new Date().toISOString()
    };

    await variantRef.update(updates);
    
    if (variant.pricing.sellingPrice !== sellingPrice || variant.pricing.baseCost !== variant.pricing.baseCost) {
      await this.logPriceHistory(variantId, variant, { pricing: { ...variant.pricing, ...updates } }, actor, "System Refresh");
    }
  }

  /**
   * Helper to resolve the final price for a user/context without updating the database
   */
  async resolveEffectivePrice(variant: ProductVariant, context: { userId?: string } = {}): Promise<{ finalPrice: number, ruleId?: string }> {
    const productSnap = await adminDb.collection("products").doc(variant.productId).get();
    const product = productSnap.exists ? productSnap.data() : {};
    
    const rule = await this.resolvePricingRule(variant, product, context);
    
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
