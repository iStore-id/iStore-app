
import { Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { PricingService } from "./pricing-service.js";
import { PricingRule } from "../types/core.js";
import { supabaseAdmin } from "./supabase-admin.js";

const pricingService = PricingService.getInstance();

export async function createPricingRule(req: AuthenticatedRequest, res: Response) {
  try {
    const data = req.body;
    
    // Map camelCase to snake_case for Supabase
    const ruleToInsert = {
      name: data.name,
      description: data.description,
      method: data.method,
      value: data.value,
      scope: data.scope,
      scope_id: data.scopeId,
      priority: data.priority || 0,
      status: data.status || 'active',
      effective_from: data.effectiveFrom || null,
      effective_until: data.effectiveUntil || null,
      created_by: req.user.uid,
      updated_by: req.user.uid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertedData, error } = await supabaseAdmin
      .from("pricing_rules")
      .insert(ruleToInsert)
      .select()
      .single();

    if (error) throw error;

    pricingService.invalidateRulesCache();

    return res.status(201).json({ success: true, data: insertedData });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPricingRules(req: AuthenticatedRequest, res: Response) {
  try {
    const { data, error } = await supabaseAdmin
      .from("pricing_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map snake_case to camelCase
    const rules = (data || []).map(rule => ({
      ...rule,
      scopeId: rule.scope_id,
      effectiveFrom: rule.effective_from,
      effectiveUntil: rule.effective_until,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
      createdBy: rule.created_by,
      updatedBy: rule.updated_by
    }));

    return res.status(200).json({ success: true, data: rules });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updatePricingRule(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const data = req.body;
    
    // Map camelCase to snake_case for Supabase
    const updates: any = {};
    if (data.name) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.method) updates.method = data.method;
    if (data.value !== undefined) updates.value = data.value;
    if (data.scope) updates.scope = data.scope;
    if (data.scopeId !== undefined) updates.scope_id = data.scopeId;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.status) updates.status = data.status;
    if (data.effectiveFrom !== undefined) updates.effective_from = data.effectiveFrom;
    if (data.effectiveUntil !== undefined) updates.effective_until = data.effectiveUntil;
    updates.updated_at = new Date().toISOString();
    updates.updated_by = req.user.uid;

    const { error } = await supabaseAdmin
      .from("pricing_rules")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    pricingService.invalidateRulesCache();

    return res.status(200).json({ success: true, message: "Rule updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPriceHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const { variantId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("price_histories")
      .select("*")
      .eq("variant_id", variantId)
      .order("timestamp", { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    const history = (data || []).map(h => ({
      ...h,
      variantId: h.variant_id,
      oldCost: h.old_cost,
      newCost: h.new_cost,
      oldSellingPrice: h.old_selling_price,
      newSellingPrice: h.new_selling_price,
      oldMargin: h.old_margin,
      newMargin: h.new_margin,
      pricingMethod: h.pricing_method,
      ruleId: h.rule_id,
      effectiveAt: h.effective_at,
      actor: h.actor
    }));
    
    return res.status(200).json({ success: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function previewPriceCalculation(req: AuthenticatedRequest, res: Response) {
  try {
    const { cost, method, value } = req.body;
    const result = pricingService.calculatePrice(cost, method, value);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function refreshVariantPrice(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await pricingService.refreshVariantPrice(id, { uid: req.user.uid, email: req.user.email });
    return res.status(200).json({ success: true, message: "Price refreshed" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function bulkRefreshPrices(req: AuthenticatedRequest, res: Response) {
  try {
    const { scope, scopeId, variantIds, rule } = req.body;

    if (!variantIds || !Array.isArray(variantIds) || variantIds.length === 0) {
      return res.status(400).json({ success: false, message: "variantIds is required and must be a non-empty array." });
    }

    // Invalidate pricing rules cache to ensure we fetch newly created rule instantly
    pricingService.invalidateRulesCache();

    // Jika ada rule yang dikirim, buat atau update rule tersebut terlebih dahulu
    if (rule) {
      const allowedMethods = ['fixed', 'markup_fixed', 'markup_percentage', 'target_margin'];
      if (!allowedMethods.includes(rule.method)) {
        return res.status(400).json({ success: false, message: `Method '${rule.method}' is not allowed. Allowed methods: ${allowedMethods.join(', ')}` });
      }

      if (scope === 'product') {
        if (!scopeId) {
          return res.status(400).json({ success: false, message: "scopeId is required when scope is 'product'" });
        }

        // Nonaktifkan rule aktif lama untuk product ini demi mencegah duplikasi active rule pada scope yang sama
        await supabaseAdmin
          .from("pricing_rules")
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq("scope", "product")
          .eq("scope_id", scopeId)
          .eq("status", "active");

        // Insert rule baru
        const ruleToInsert = {
          name: rule.name || `Bulk Product Rule - ${scopeId}`,
          method: rule.method,
          value: rule.value,
          scope: 'product',
          scope_id: scopeId,
          priority: rule.priority || 10,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabaseAdmin
          .from("pricing_rules")
          .insert(ruleToInsert);

        if (insertError) throw insertError;

      } else if (scope === 'variant') {
        // Untuk scope variant, buat rule individual untuk setiap variant terpilih
        for (const variantId of variantIds) {
          // Nonaktifkan rule aktif lama untuk variant ini
          await supabaseAdmin
            .from("pricing_rules")
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq("scope", "variant")
            .eq("scope_id", variantId)
            .eq("status", "active");

          const ruleToInsert = {
            name: `${rule.name || 'Bulk Variant Rule'} - ${variantId}`,
            method: rule.method,
            value: rule.value,
            scope: 'variant',
            scope_id: variantId,
            priority: rule.priority || 20, // priority lebih tinggi karena scope variant lebih presisi
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { error: insertError } = await supabaseAdmin
            .from("pricing_rules")
            .insert(ruleToInsert);

          if (insertError) throw insertError;
        }
      }
    }

    // Refresh harga semua variant menggunakan PricingService existing
    await pricingService.refreshMultipleVariantsPrice(variantIds, { uid: req.user.uid, email: req.user.email });

    return res.status(200).json({ success: true, message: `Successfully applied bulk pricing rules and refreshed ${variantIds.length} variants.` });
  } catch (error: any) {
    console.error("[PricingAPI] Error in bulkRefreshPrices:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
