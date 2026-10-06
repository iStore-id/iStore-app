import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { ProviderCatalogDiscoveryService } from "./discovery-service.js";
import { ProviderMappingService } from "./provider-mapping-service.js";
import { TokoVoucherDiscoveryAdapter } from "./adapters/tokovoucher-discovery-adapter.js";
import { ApiGamesDiscoveryAdapter } from "./adapters/apigames-discovery-adapter.js";
import { CatalogService } from "./catalog-service.js";
import { ProviderService } from "./provider-service.js";
import { SupabaseProviderRepository } from "./supabase/provider-repository.js";
import { SupabaseRefundRepository } from "./supabase/refund-repository.js";
import { OrderRepository } from "./supabase/order-repository.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { DualLedgerRepository } from "./ledger-dual-repository.js";
// Admin API Logic using Supabase and existing services
import { DateTime } from "luxon";
import { ProviderSku, ProviderMapping, Product, Game, ProductVariant } from "../types/core.js";

const discoveryService = new ProviderCatalogDiscoveryService();
discoveryService.registerAdapter(new TokoVoucherDiscoveryAdapter());
discoveryService.registerAdapter(new ApiGamesDiscoveryAdapter());


// ... (existing exports)

export async function getProviderCatalogDiscovery(req: AuthenticatedRequest, res: Response) {
  try {
    const { provider, code, limit } = req.query;
    if (!provider || typeof provider !== "string") {
      return res.status(400).json({ success: false, message: "Provider required" });
    }

    const discoveryMode = typeof limit === "string" ? limit : "brand";
    const allowedModes = ["brand", "50", "100", "full"];
    if (!allowedModes.includes(discoveryMode)) {
      return res.status(400).json({ success: false, message: "Invalid discovery mode" });
    }

    if (discoveryMode === "brand" && (!code || typeof code !== "string" || code.trim() === "")) {
      return res.status(400).json({ success: false, message: "Prefix produk diperlukan untuk mode Per Brand / Kategori." });
    }

    let results = await discoveryService.discover(provider, code as string);

    // Apply slicing based on bounded mode
    if (discoveryMode === "50") {
      results = results.slice(0, 50);
    } else if (discoveryMode === "100") {
      results = results.slice(0, 100);
    } else if (discoveryMode === "brand") {
      // Bounded safety limit for brand mode just in case
      results = results.slice(0, 150); 
    }

    let enhancedResults;

    if (discoveryMode === "full") {
      // Full Catalog: bypass existence lookup completely to save Firestore quota
      enhancedResults = results.map(r => ({
        ...r,
        isExisting: null
      }));
    } else {
      // Bounded lookup for existing SKUs
      const targetSkusToLookup = results
        .map(r => r.providerSku ? String(r.providerSku).trim() : "")
        .filter(Boolean);
        
      // Deduplicate SKUs before lookup
      const uniqueSkus = Array.from(new Set(targetSkusToLookup));
        
      const dbSkuMap = new Map();
      
      enhancedResults = results.map(r => {
        const normSku = r.providerSku ? String(r.providerSku).trim().toLowerCase() : "";
        return {
          ...r,
          isExisting: dbSkuMap.has(normSku)
        };
      });
    }

    await logAudit(req, "PROVIDER_CATALOG_DISCOVERY", "providers", provider, { code, mode: discoveryMode, count: results.length });
    return res.status(200).json({ success: true, data: enhancedResults });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function importFromCatalogDiscovery(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId, items, mode } = req.body;
    
    if (!providerId || !items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "providerId and items array are required" });
    }

    const results = {
      processed: items.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // Use Promise.all with a small concurrency limit or just loop for safety
    // For simplicity and since it's typically < 100 items, we can loop
    for (const item of items) {
      try {
        const skuData: Partial<ProviderSku> = {
          providerId,
          providerSku: item.providerSku,
          name: item.name,
          type: item.type || 'other',
          status: 'active',
          metadata: {
            category: item.category,
            brand: item.brand,
            importedFrom: 'discovery',
            importMode: mode,
            originalData: item,
            price: item.price
          }
        };

        // Check if exists if mode is SKIP_DUPLICATES
        if (mode === 'SKIP_DUPLICATES') {
          const existing = await providerRepo.getProviderSku(providerId, item.providerSku);
          if (existing) {
            results.skipped++;
            continue;
          }
        }

        await providerService.createProviderSku(skuData);
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${item.providerSku}: ${err.message}`);
      }
    }

    await logAudit(req, "IMPORT_FROM_DISCOVERY", "providers", providerId, { 
      count: items.length, 
      success: results.success,
      mode 
    });

    return res.status(200).json({ 
      success: true, 
      data: {
        processed: results.processed,
        successCount: results.success,
        failedCount: results.failed,
        skippedCount: results.skipped,
        errors: results.errors
      } 
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
import { PaymentGatewayService } from "./payment-gateway-service.js";
import { refundMidtransTransaction } from "./midtrans.js";
import { IpaymuProviderAdapter } from "./adapters/ipaymu-adapter.js";
import * as crypto from "crypto";
import { transitionOrderState } from "./state-machine.js";
import { dispatchFulfillment } from "./fulfillment-dispatcher.js";
import { safeRecordRefundExecuted, getOrderSettlementContext } from "./ledger-service.js";
import { PromoService } from "./promo-service.js";
import { FlashSaleService } from "./flash-sale-service.js";
import { LoyaltyService } from "./loyalty-service.js";
import { ReferralService } from "./referral-service.js";
import { BusinessCalendarService } from "./business-calendar-service.js";
import { JobService } from "./job-service.js";
import { NotificationService } from "./notification-service.js";

const catalogService = CatalogService.getInstance();
const providerService = ProviderService.getInstance();
const providerRepo = SupabaseProviderRepository.getInstance();
const paymentGatewayService = PaymentGatewayService.getInstance();
const promoService = PromoService.getInstance();
const flashSaleService = FlashSaleService.getInstance();
const loyaltyService = LoyaltyService.getInstance();
const referralService = ReferralService.getInstance();
const notificationService = NotificationService.getInstance();

export async function createPaymentGateway(req: AuthenticatedRequest, res: Response) {
  try {
    const gateway = await paymentGatewayService.createGateway(req.body);
    await logAudit(req, "CREATE_GATEWAY", "paymentGateways", gateway.id!, gateway);
    return res.status(201).json({ success: true, data: gateway });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updatePaymentGateway(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await paymentGatewayService.updateGateway(id, req.body);
    await logAudit(req, "UPDATE_GATEWAY", "paymentGateways", id, req.body);
    return res.status(200).json({ success: true, message: "Gateway updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}


async function logAudit(req: AuthenticatedRequest, action: string, resource: string, resourceId: string, payload: any) {
  await AuditLogRepository.getInstance().createLog({
    actor: { uid: req.user?.uid || "admin", email: req.user?.email || "admin@istore.co.id" },
    role: req.user?.role || "admin",
    action,
    target: `${resource}/${resourceId}`,
    after: payload,
    reason: payload?.reason || "Admin operation",
    timestamp: new Date().toISOString()
  });
}

// ===================
// CATALOG MANAGEMENT
// ===================

// Games
export async function createGame(req: AuthenticatedRequest, res: Response) {
  try {
    const game = await catalogService.createGame(req.body, req.user.uid);
    await logAudit(req, "CREATE_GAME", "games", game.id!, game);
    return res.status(201).json({ success: true, data: game });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateGame(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await catalogService.updateGame(id, req.body, req.user.uid);
    await logAudit(req, "UPDATE_GAME", "games", id, req.body);
    return res.status(200).json({ success: true, message: "Game updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Categories
export async function createCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const category = await catalogService.createCategory(req.body, req.user.uid);
    await logAudit(req, "CREATE_CATEGORY", "categories", category.id!, category);
    return res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await catalogService.updateCategory(id, req.body, req.user.uid);
    await logAudit(req, "UPDATE_CATEGORY", "categories", id, req.body);
    return res.status(200).json({ success: true, message: "Category updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteGame(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await catalogService.deleteGame(id, req.user.uid);
    await logAudit(req, "DELETE_GAME", "games", id, {});
    return res.status(200).json({ success: true, message: "Game deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await catalogService.deleteCategory(id, req.user.uid);
    await logAudit(req, "DELETE_CATEGORY", "categories", id, {});
    return res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Products
export async function createProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const product = await catalogService.createProduct(req.body, req.user.uid);
    await logAudit(req, "CREATE_PRODUCT", "products", product.id!, product);
    return res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Variants
export async function createVariant(req: AuthenticatedRequest, res: Response) {
  try {
    const variant = await catalogService.createVariant(req.body, req.user.uid);
    await logAudit(req, "CREATE_VARIANT", "productVariants", variant.id!, variant);
    return res.status(201).json({ success: true, data: variant });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateVariant(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await catalogService.updateVariant(id, req.body, req.user.uid);
    await logAudit(req, "UPDATE_VARIANT", "productVariants", id, req.body);
    return res.status(200).json({ success: true, message: "Variant updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Legacy / Compatibility methods (Refactored to use CatalogService or existing collection if needed)
export async function updateProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await catalogService.updateProduct(id, req.body, req.user.uid);
    await logAudit(req, "UPDATE_PRODUCT", "products", id, req.body);
    return res.status(200).json({ success: true, message: "Product updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deactivateProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await catalogService.updateProduct(id, { status: "inactive" }, req.user.uid);
    
    await logAudit(req, "DEACTIVATE_PRODUCT", "products", id, { status: "inactive" });
    return res.status(200).json({ success: true, message: "Product deactivated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getProductResetPreview(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const preview = await catalogService.getProductResetPreview(id);
    return res.status(200).json({ success: true, data: preview });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function resetProductAndMapping(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await catalogService.resetProductAndMapping(id, req.user.uid);
    await logAudit(req, "RESET_PRODUCT_AND_MAPPING", "products", id, {
      product_id: id,
      product_name: result.productName,
      game_id: result.gameId,
      deleted_variant_count: result.deletedVariantCount,
      deleted_mapping_count: result.deletedMappingCount,
      actor: { uid: req.user.uid, email: req.user.email },
      timestamp: new Date().toISOString()
    });
    return res.status(200).json({ success: true, message: "Product and its mappings reset successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ===================
// USER MANAGEMENT
// ===================

export async function createProvider(req: AuthenticatedRequest, res: Response) {
  try {
    const provider = await providerService.createProvider(req.body);
    await logAudit(req, "CREATE_PROVIDER", "providers", provider.id!, provider);
    return res.status(201).json({ success: true, data: provider });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateProvider(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await providerService.updateProvider(id, req.body);
    await logAudit(req, "UPDATE_PROVIDER", "providers", id, req.body);
    return res.status(200).json({ success: true, message: "Provider updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getProviders(req: AuthenticatedRequest, res: Response) {
  try {
    const providers = await providerService.listProviders();
    return res.status(200).json({ success: true, data: providers });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteProvider(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    // Note: ProviderService doesn't have deleteProvider yet, calling repo directly or adding it
    // For now I'll use repo indirectly if I add it to service
    const repo = (providerService as any).providerRepo || SupabaseProviderRepository.getInstance();
    await repo.deleteProvider(id);
    await logAudit(req, "DELETE_PROVIDER", "providers", id, {});
    return res.status(200).json({ success: true, message: "Provider deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createProviderSku(req: AuthenticatedRequest, res: Response) {
  try {
    const sku = await providerService.createProviderSku(req.body);
    await logAudit(req, "CREATE_PROVIDER_SKU", "providerSkus", sku.id!, sku);
    return res.status(201).json({ success: true, data: sku });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateProviderSku(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await providerService.updateProviderSku(id, req.body);
    await logAudit(req, "UPDATE_PROVIDER_SKU", "providerSkus", id, req.body);
    return res.status(200).json({ success: true, message: "Provider SKU updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createProviderMapping(req: AuthenticatedRequest, res: Response) {
  try {
    const mapping = await providerService.createMapping(req.body, req.user.uid);
    await logAudit(req, "CREATE_PROVIDER_MAPPING", "providerMappings", mapping.id!, mapping);
    return res.status(201).json({ success: true, data: mapping });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateProviderMapping(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await providerService.updateMapping(id, req.body, req.user.uid);
    await logAudit(req, "UPDATE_PROVIDER_MAPPING", "providerMappings", id, req.body);
    return res.status(200).json({ success: true, message: "Provider Mapping updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteProviderMapping(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await providerService.deleteMapping(id, req.user.uid);
    await logAudit(req, "DELETE_PROVIDER_MAPPING", "providerMappings", id, {});
    return res.status(200).json({ success: true, message: "Provider mapping deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function approveProviderMapping(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const actor = { uid: req.user.uid, email: req.user.email };
    const mapping = await providerRepo.getMapping(id);
    
    if (!mapping) {
      return res.status(404).json({ success: false, message: "Provider Mapping not found" });
    }

    if (mapping.status !== "NEEDS_REVIEW") {
      return res.status(400).json({ success: false, message: `Only mappings with status 'NEEDS_REVIEW' can be approved. Current status is '${mapping.status}'.` });
    }

    await mappingService.approveMapping(id, actor);
    await logAudit(req, "APPROVE_PROVIDER_MAPPING", "providerMappings", id, { status: "APPROVED", routingEligibility: true });
    return res.status(200).json({ success: true, message: "Provider Mapping approved" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function rejectProviderMapping(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const actor = { uid: req.user.uid, email: req.user.email };
    const mapping = await providerRepo.getMapping(id);
    
    if (!mapping) {
      return res.status(404).json({ success: false, message: "Provider Mapping not found" });
    }

    await mappingService.rejectMapping(id, actor);
    await logAudit(req, "REJECT_PROVIDER_MAPPING", "providerMappings", id, { status: "REJECTED" });
    return res.status(200).json({ success: true, message: "Provider Mapping rejected" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ===================
// USER MANAGEMENT
// ===================

export async function updateUserRole(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!["admin", "customer"].includes(role)) {
       return res.status(400).json({ success: false, message: "Invalid role" });
    }

    await supabaseAdmin!.from("customers").update({ role, updated_at: new Date().toISOString() }).eq("id", id);
    
    await logAudit(req, "UPDATE_USER_ROLE", "users", id, { role });
    return res.status(200).json({ success: true, message: "User role updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ===================
// ORDER MANAGEMENT
// ===================

export async function updateOrderState(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { paymentStatus, transactionStatus, reason } = req.body;
    
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Alasan perubahan status wajib diisi." });
    }

    // Map target state to state machine valid values
    let targetState: 'PAID' | 'EXPIRED' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | null = null;
    
    if (paymentStatus === 'paid' && transactionStatus === 'pending') {
      return res.status(400).json({
        success: false,
        message: "Perubahan manual ke status PAID tidak diizinkan. Status PAID harus berasal dari bukti pembayaran terverifikasi (Midtrans Webhook, Checkout Recovery, atau Rekonsiliasi)."
      });
    } else if (transactionStatus === 'processing') {
      targetState = 'PROCESSING';
    } else if (transactionStatus === 'success') {
      targetState = 'SUCCESS';
    } else if (paymentStatus === 'expired') {
      targetState = 'EXPIRED';
    } else if (paymentStatus === 'failed' || transactionStatus === 'failed') {
      targetState = 'FAILED';
    }

    if (!targetState) {
      return res.status(400).json({ 
        success: false, 
        message: `Kombinasi status pembayaran (${paymentStatus}) dan status pengiriman (${transactionStatus}) tidak didukung oleh state machine.` 
      });
    }

    // Use transitionOrderState to perform atomic check, state-machine validation, and audit logging
    const auditReason = `Admin Override (by ${req.user.email || req.user.uid}): ${reason.trim()}`;
    await transitionOrderState(id, targetState, {}, auditReason);

    // Also write a specific manual audit override log
    await logAudit(req, "ADMIN_OVERRIDE_ORDER_STATE", "orders", id, { 
      targetState,
      paymentStatus, 
      transactionStatus, 
      reason: reason.trim() 
    });

    return res.status(200).json({ success: true, message: "Order state overridden successfully via state machine" });
  } catch (error: any) {
    console.error("[Admin Override Error]", error);
    return res.status(400).json({ success: false, message: error.message || "Terjadi kesalahan saat memproses transisi status." });
  }
}

export async function getAdminRefunds(req: AuthenticatedRequest, res: Response) {
  try {
    const { limit = "100" } = req.query;
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: "Supabase client not initialized" });
    }
    const { data, error } = await supabaseAdmin
      .from("refunds")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(parseInt(limit as string) || 100);

    if (error) {
      throw new Error(error.message);
    }

    const refunds = (data || []).map((item: any) => ({
      id: item.id,
      orderId: item.order_id,
      refundKey: item.refund_key,
      amount: Number(item.amount),
      currency: item.currency || "IDR",
      reason: item.reason || undefined,
      status: item.status,
      provider: item.provider || undefined,
      providerRefundId: item.provider_refund_id || undefined,
      requestedBy: item.requested_by || undefined,
      processedAt: item.processed_at || undefined,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    return res.status(200).json({ success: true, data: refunds });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function testApiGamesConnection(req: AuthenticatedRequest, res: Response) {
  try {
    // Audit log
    await logAudit(req, "TEST_APIGAMES_CONNECTION", "providers", "apigames", {});
    const result = await providerService.testApiGamesConnection();
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ===================
// API GAMES CREDENTIALS (Secure)
// ===================
import { getApiGamesServerConfig } from "./providers.js";

export async function getApiGamesCredentialStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const config = await getApiGamesServerConfig();
    return res.status(200).json({ success: true, data: { configured: config.configured } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateApiGamesCredentials(req: AuthenticatedRequest, res: Response) {
  try {
    const { merchantId, secretKey } = req.body;
    if (!merchantId || !secretKey) return res.status(400).json({ success: false, message: "Missing credentials" });
    
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    const existingData = await SystemConfigRepository.getInstance().getConfig("apigames_integration") || {};

    const encryptedMerchantId = encryptSecret(String(merchantId).trim());
    const encryptedSecretKey = encryptSecret(String(secretKey).trim());

    const now = new Date().toISOString();
    const newData = {
      key: "apigames_integration",
      encryptedMerchantId,
      encryptedSecretKey,
      updatedBy: actor.uid,
      updatedAt: now,
      createdAt: existingData.createdAt || now
    };

    await SystemConfigRepository.getInstance().upsertConfig("apigames_integration", newData);

    // Sync process.env
    process.env.APIGAMES_MERCHANT_ID = String(merchantId).trim();
    process.env.APIGAMES_SECRET = String(secretKey).trim();
    
    await logCoreAudit(actor, role, "UPDATE_APIGAMES_CREDENTIALS", "systemConfigs/apigames_integration", {
      merchantId: existingData.encryptedMerchantId ? "****" : null
    }, {
      merchantId: "****"
    }, "Updated API Games configuration");

    return res.status(200).json({ success: true, message: "Credentials updated securely" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createRefund(req: AuthenticatedRequest, res: Response) {
  try {
    const { orderId, amount, reason, refundKey: clientRefundKey } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Missing orderId" });
    }
    if (!amount || typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ success: false, message: "Amount must be a positive integer" });
    }
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Reason is required" });
    }

    const refundKey = clientRefundKey && typeof clientRefundKey === "string" && clientRefundKey.trim()
      ? clientRefundKey.trim()
      : `ref_${orderId}_${crypto.randomBytes(8).toString("hex")}`;

    let transactionResult;
    try {
      // 1. Check existing refund in Supabase
      const existingRefund = await SupabaseRefundRepository.getInstance().getRefundById(refundKey);

      if (existingRefund) {
        if (existingRefund.status === "SUCCEEDED") {
          transactionResult = { isIdempotentSuccess: true, data: existingRefund };
        } else if (existingRefund.status === "PROCESSING" || existingRefund.status === "PENDING") {
          throw new Error("REFUND_ALREADY_PROCESSING");
        } else {
          throw new Error("REFUND_ALREADY_EXISTS_WITH_FAILED_STATUS");
        }
      } else {
        // 2. Fetch order from Supabase OrderRepository
        const orderData = await OrderRepository.getInstance().getOrderById(orderId);

        if (!orderData) {
          throw new Error("ORDER_NOT_FOUND");
        }

        const paymentStatus = orderData.paymentStatus?.toLowerCase();
        if (paymentStatus !== "paid" && paymentStatus !== "success") {
          throw new Error("ORDER_NOT_PAID");
        }

        const totalAmount = orderData.totalAmount || 0;

        // 3. Get existing refunds for order from Supabase
        const existingRefunds = await SupabaseRefundRepository.getInstance().getRefundsByOrderId(orderId);

        let totalRefunded = 0;
        for (const r of existingRefunds) {
          if (r.status !== "FAILED") {
            totalRefunded += r.amount || 0;
          }
        }

        const remainingRefundable = totalAmount - totalRefunded;
        if (amount > remainingRefundable) {
          throw new Error("REFUND_AMOUNT_EXCEEDS_REMAINING_BALANCE");
        }

        const gatewayCode = (orderData.paymentGatewayCode || "midtrans").toLowerCase().trim();
        const now = new Date().toISOString();
        const refundRecord = {
          id: refundKey,
          orderId,
          refundKey,
          amount,
          currency: "IDR",
          reason,
          status: "PROCESSING",
          provider: gatewayCode === "ipaymu" ? "ipaymu" : "midtrans",
          requestedBy: req.user.uid,
          createdAt: now,
          updatedAt: now
        };

        // Create in Supabase
        await SupabaseRefundRepository.getInstance().createRefund(refundRecord);

        transactionResult = {
          isIdempotentSuccess: false,
          data: refundRecord,
          orderInfo: {
            userId: orderData.userId,
            invoice: orderData.invoice,
            gatewayCode: gatewayCode,
            gatewayTransactionId: orderData.gatewayTransactionId
          }
        };
      }
    } catch (txError: any) {
      if (txError.message === "REFUND_ALREADY_PROCESSING") {
        return res.status(409).json({ success: false, message: "Transaksi refund ini sedang dalam antrean proses." });
      }
      if (txError.message === "REFUND_ALREADY_EXISTS_WITH_FAILED_STATUS") {
        return res.status(400).json({ success: false, message: "Transaksi refund ini sebelumnya gagal. Silakan gunakan kunci refund baru." });
      }
      if (txError.message === "ORDER_NOT_FOUND") {
        return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
      }
      if (txError.message === "ORDER_NOT_PAID") {
        return res.status(400).json({ success: false, message: "Pesanan belum dibayar sehingga tidak memenuhi syarat refund." });
      }
      if (txError.message === "REFUND_AMOUNT_EXCEEDS_REMAINING_BALANCE") {
        return res.status(400).json({ success: false, message: "Nominal refund melebihi sisa dana pembayaran yang dapat dikembalikan." });
      }
      return res.status(500).json({ success: false, message: `Gagal memverifikasi kelayakan refund: ${txError.message}` });
    }

    if (transactionResult.isIdempotentSuccess) {
      return res.status(200).json({
        success: true,
        message: "Refund sudah sukses diproses sebelumnya (Idempotent Match).",
        data: transactionResult.data
      });
    }

    await logAudit(req, "REFUND_REQUESTED", "refunds", refundKey, { orderId, amount, reason, refundKey });

    const { userId, invoice, gatewayCode, gatewayTransactionId } = (transactionResult as any).orderInfo;

    // Notify customer: REFUND_PROCESSING
    await notificationService.notifyCustomer(userId, 'REFUND_PROCESSING', 'Refund Sedang Diproses', `Permintaan pengembalian dana untuk pesanan ${invoice} sedang diproses.`, {
      relatedEntity: { type: 'REFUND', id: refundKey },
      idempotencyKey: `refund_proc_${refundKey}`
    });

    try {
      let providerRefundId: string | null = null;

      if (gatewayCode === "ipaymu") {
        const ipaymuAdapter = IpaymuProviderAdapter.getInstance();
        const ipaymuRes = await ipaymuAdapter.refundPayment({
          orderId,
          amount,
          reason,
          transactionId: gatewayTransactionId || orderId
        });
        if (!ipaymuRes.success) {
          throw new Error(ipaymuRes.message || "Gagal memproses refund iPaymu");
        }
        providerRefundId = ipaymuRes.refundId || refundKey;
      } else {
        const midtransRes = await refundMidtransTransaction({
          orderId,
          refundKey,
          amount,
          reason
        });
        providerRefundId = midtransRes.refund_id || midtransRes.id || null;
      }

      const now = new Date().toISOString();
      await SupabaseRefundRepository.getInstance().updateRefund(refundKey, {
        status: "SUCCEEDED",
        providerRefundId,
        processedAt: now
      });

      await logAudit(req, "REFUND_SUCCEEDED", "refunds", refundKey, {
        orderId,
        amount,
        reason,
        refundKey,
        providerRefundId
      });

      // Notify customer: REFUND_SUCCESS
      await notificationService.notifyCustomer(userId, 'REFUND_SUCCESS', 'Refund Berhasil', `Dana sebesar Rp ${amount.toLocaleString('id-ID')} untuk pesanan ${invoice} telah berhasil dikembalikan.`, {
        severity: 'SUCCESS',
        relatedEntity: { type: 'REFUND', id: refundKey },
        idempotencyKey: `refund_success_${refundKey}`
      });

      // Post-commit Ledger Hook: Record REFUND_EXECUTED event safely
      const settlementContext = await getOrderSettlementContext(orderId);
      await safeRecordRefundExecuted(
        orderId,
        refundKey,
        amount,
        settlementContext,
        req.user?.email || req.user?.uid || "ADMIN",
        { providerRefundId, reason }
      );

      return res.status(200).json({
        success: true,
        message: "Refund berhasil diproses oleh Midtrans.",
        data: {
          id: refundKey,
          refundId: refundKey,
          orderId,
          refundKey,
          amount,
          status: "SUCCEEDED",
          providerRefundId,
          processedAt: new Date().toISOString()
        }
      });
    } catch (midtransError: any) {
      console.error("Midtrans API Error for Refund:", midtransError);

      const isFatal = midtransError.statusCode && midtransError.statusCode >= 400 && midtransError.statusCode < 500;

      if (isFatal) {
        const failureMessage = midtransError.message || "Midtrans API rejected the refund request";
        const failureCode = midtransError.statusCode?.toString() || "MIDTRANS_REJECTED";

        const now = new Date().toISOString();
        await SupabaseRefundRepository.getInstance().updateRefund(refundKey, {
          status: "FAILED",
          reason: `${failureCode}: ${failureMessage}`
        });

        await logAudit(req, "REFUND_FAILED", "refunds", refundKey, {
          orderId,
          amount,
          reason,
          refundKey,
          error: failureMessage,
          code: failureCode
        });

        // Notify customer: REFUND_FAILED
        await notificationService.notifyCustomer(userId, 'REFUND_FAILED', 'Refund Gagal', `Pengembalian dana untuk pesanan ${invoice} gagal diproses. Silakan hubungi dukungan.`, {
          severity: 'ERROR',
          relatedEntity: { type: 'REFUND', id: refundKey },
          idempotencyKey: `refund_failed_${refundKey}`
        });

        // Notify admin: REFUND_EXCEPTION
        await notificationService.notifyAdmin('REFUND_EXCEPTION', 'Gagal Refund', `Refund untuk pesanan ${invoice} (ID: ${orderId}) gagal. Alasan: ${failureMessage}`, {
          severity: 'CRITICAL',
          relatedEntity: { type: 'REFUND', id: refundKey },
          actionUrl: `/admin/refunds`
        });

        return res.status(400).json({
          success: false,
          message: `Refund ditolak oleh Midtrans: ${failureMessage}`,
          data: {
            id: refundKey,
            status: "FAILED",
            failureCode,
            failureMessage
          }
        });
      } else {
        await logAudit(req, "REFUND_TIMEOUT_RETAINED_PROCESSING", "refunds", refundKey, {
          orderId,
          amount,
          reason,
          refundKey,
          error: midtransError.message || "Network timeout"
        });

        return res.status(500).json({
          success: false,
          message: "Koneksi ke Midtrans mengalami gangguan atau timeout. Status refund saat ini dipertahankan dalam status PROCESSING demi keselamatan data finansial.",
          data: {
            id: refundKey,
            status: "PROCESSING"
          }
        });
      }
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Terjadi kesalahan internal." });
  }
}

// ===================
// MIDTRANS INTEGRATION MANAGEMENT
// ===================
import { getMidtransServerConfig, encryptSecret, decryptSecret, testMidtransConnection } from "./midtrans.js";
import { getTokoVoucherServerConfig, testTokoVoucherConnection } from "./providers.js";
import { logCoreAudit } from "./core-service.js";

export async function getMidtransIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const config = await getMidtransServerConfig();
    const serverKeyMasked = config.serverKey 
      ? config.serverKey.substring(0, 8) + "************************" 
      : "";
    
    return res.status(200).json({
      success: true,
      data: {
        merchantId: config.merchantId,
        clientKey: config.clientKey || "",
        isProduction: config.isProduction,
        configured: config.configured,
        serverKeyMasked,
        lastTestedAt: config.lastTestedAt || null,
        lastTestResult: config.lastTestResult || null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch Midtrans integration config." });
  }
}

export async function updateMidtransIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const { merchantId, serverKey, clientKey, isProduction, isActive } = req.body;
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    const existingData = await SystemConfigRepository.getInstance().getConfig("midtrans_integration") || {};

    let encryptedServerKey = existingData.encryptedServerKey || "";
    if (serverKey && typeof serverKey === "string" && serverKey.trim() && !serverKey.includes("****")) {
      encryptedServerKey = encryptSecret(serverKey.trim());
    }

    const now = new Date().toISOString();
    const newData = {
      key: "midtrans_integration",
      merchantId: merchantId !== undefined ? String(merchantId).trim() : (existingData.merchantId || ""),
      clientKey: clientKey !== undefined ? String(clientKey).trim() : (existingData.clientKey || ""),
      encryptedServerKey,
      isProduction: isProduction !== undefined ? !!isProduction : (existingData.isProduction || false),
      isActive: isActive !== undefined ? !!isActive : (existingData.isActive !== false), // default true
      lastTestedAt: existingData.lastTestedAt || null,
      lastTestResult: existingData.lastTestResult || null,
      updatedBy: actor.uid,
      updatedAt: now,
      createdAt: existingData.createdAt || now
    };

    await SystemConfigRepository.getInstance().upsertConfig("midtrans_integration", newData);

    // Single active gateway enforcement: If Midtrans is explicitly set to active, deactivate iPaymu and Doit
    if (isActive === true || isActive === "true") {
      const existingIpaymu = await SystemConfigRepository.getInstance().getConfig("ipaymu_integration");
      if (existingIpaymu && existingIpaymu.isActive) {
        await SystemConfigRepository.getInstance().upsertConfig("ipaymu_integration", {
          ...existingIpaymu,
          isActive: false,
          updatedAt: now
        });
      }
      const existingDoit = await SystemConfigRepository.getInstance().getConfig("doit_integration");
      if (existingDoit && existingDoit.isActive) {
        await SystemConfigRepository.getInstance().upsertConfig("doit_integration", {
          ...existingDoit,
          isActive: false,
          updatedAt: now
        });
      }
      process.env.IPAYMU_IS_ACTIVE = "false";
      process.env.DOIT_IS_ACTIVE = "false";
    }

    if (serverKey && !serverKey.includes("****")) {
      process.env.MIDTRANS_SERVER_KEY = serverKey.trim();
    }
    process.env.MIDTRANS_MERCHANT_ID = newData.merchantId;
    process.env.MIDTRANS_IS_PRODUCTION = newData.isProduction ? "true" : "false";
    process.env.MIDTRANS_IS_ACTIVE = newData.isActive ? "true" : "false";

    await logCoreAudit(actor, role, "UPDATE_MIDTRANS_INTEGRATION", "systemConfigs/midtrans_integration", {
      merchantId: existingData.merchantId ? "****" : null,
      isProduction: existingData.isProduction,
      isActive: existingData.isActive
    }, {
      merchantId: newData.merchantId ? "****" : null,
      isProduction: newData.isProduction,
      isActive: newData.isActive
    }, "Updated Midtrans configuration");

    const serverKeyMasked = newData.encryptedServerKey ? "SB-Mid-****..." : "";

    return res.status(200).json({
      success: true,
      message: "Konfigurasi Midtrans berhasil disimpan.",
      data: {
        merchantId: newData.merchantId,
        isProduction: newData.isProduction,
        isActive: newData.isActive,
        configured: !!newData.encryptedServerKey,
        serverKeyMasked
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal menyimpan konfigurasi Midtrans." });
  }
}

export async function testMidtransIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const config = await getMidtransServerConfig();
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    if (!config.serverKey) {
      return res.status(400).json({ success: false, message: "Midtrans Server Key belum dikonfigurasi." });
    }

    const testResult = await testMidtransConnection(config.serverKey, config.isProduction);
    const now = new Date().toISOString();

    const existingMidtrans = await SystemConfigRepository.getInstance().getConfig("midtrans_integration") || {};
    await SystemConfigRepository.getInstance().upsertConfig("midtrans_integration", {
      ...existingMidtrans,
      lastTestedAt: now,
      lastTestResult: testResult.success ? "SUCCESS" : "FAILED",
      lastTestMessage: testResult.message
    });

    await logCoreAudit(actor, role, "TEST_MIDTRANS_CONNECTION", "systemConfigs/midtrans_integration", null, {
      success: testResult.success,
      message: testResult.message,
      environment: config.isProduction ? "production" : "sandbox"
    }, testResult.message);

    return res.status(200).json({
      success: testResult.success,
      message: testResult.message,
      data: {
        success: testResult.success,
        testedAt: now
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal melakukan tes koneksi Midtrans." });
  }
}

export async function removeMidtransIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    await SystemConfigRepository.getInstance().deleteConfig("midtrans_integration");

    delete process.env.MIDTRANS_SERVER_KEY;
    delete process.env.MIDTRANS_MERCHANT_ID;
    process.env.MIDTRANS_IS_PRODUCTION = "false";

    await logCoreAudit(actor, role, "REMOVE_MIDTRANS_INTEGRATION", "systemConfigs/midtrans_integration", null, null, "Removed Midtrans configuration");

    return res.status(200).json({
      success: true,
      message: "Konfigurasi Midtrans berhasil dihapus."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal menghapus konfigurasi Midtrans." });
  }
}

// ===================
// TOKOVOUCHER INTEGRATION MANAGEMENT
// ===================

export async function getTokoVoucherIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await SystemConfigRepository.getInstance().getConfig("tokovoucher_integration") || {};
    const memberCode = data.memberCode || process.env.TOKOVOUCHER_MEMBER_CODE || "";
    const encryptedSecretKey = data.encryptedSecretKey || "";
    const configured = !!encryptedSecretKey || !!process.env.TOKOVOUCHER_SECRET;
    const isEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
    const secretKeyMasked = encryptedSecretKey ? "TV-****..." : "";

    return res.status(200).json({
      success: true,
      data: {
        memberCode,
        configured,
        isEnabled,
        secretKeyMasked,
        memberName: data.memberName || null,
        balance: data.balance !== undefined ? data.balance : null,
        lastChecked: data.lastChecked || null,
        lastTestedAt: data.lastTestedAt || null,
        lastTestResult: data.lastTestResult || null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal memuat konfigurasi TokoVoucher." });
  }
}

export async function updateTokoVoucherIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const { memberCode, secretKey, isEnabled } = req.body;
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    const existingData = await SystemConfigRepository.getInstance().getConfig("tokovoucher_integration") || {};

    let encryptedSecretKey = existingData.encryptedSecretKey || "";
    if (secretKey && typeof secretKey === "string" && secretKey.trim() && !secretKey.includes("****")) {
      encryptedSecretKey = encryptSecret(secretKey.trim());
    }

    const now = new Date().toISOString();
    const newData = {
      key: "tokovoucher_integration",
      memberCode: memberCode !== undefined ? String(memberCode).trim() : (existingData.memberCode || ""),
      encryptedSecretKey,
      isEnabled: isEnabled !== undefined ? !!isEnabled : (existingData.isEnabled !== undefined ? existingData.isEnabled : true),
      lastTestedAt: existingData.lastTestedAt || null,
      lastTestResult: existingData.lastTestResult || null,
      updatedBy: actor.uid,
      updatedAt: now,
      createdAt: existingData.createdAt || now
    };

    await SystemConfigRepository.getInstance().upsertConfig("tokovoucher_integration", newData);

    if (secretKey && !secretKey.includes("****")) {
      process.env.TOKOVOUCHER_SECRET = secretKey.trim();
    }
    process.env.TOKOVOUCHER_MEMBER_CODE = newData.memberCode;

    await logCoreAudit(actor, role, "UPDATE_TOKOVOUCHER_INTEGRATION", "systemConfigs/tokovoucher_integration", {
      memberCode: existingData.memberCode ? "****" : null
    }, {
      memberCode: newData.memberCode ? "****" : null,
      isEnabled: newData.isEnabled
    }, "Updated TokoVoucher configuration");

    return res.status(200).json({
      success: true,
      message: "Konfigurasi TokoVoucher berhasil disimpan secara aman.",
      data: {
        memberCode: newData.memberCode,
        configured: !!newData.encryptedSecretKey,
        isEnabled: newData.isEnabled,
        secretKeyMasked: newData.encryptedSecretKey ? "TV-****..." : ""
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal menyimpan konfigurasi TokoVoucher." });
  }
}

export async function testTokoVoucherIntegrationApi(req: AuthenticatedRequest, res: Response) {
  try {
    const config = await getTokoVoucherServerConfig();
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    if (!config.memberCode || !config.secret) {
      return res.status(400).json({ success: false, message: "Member Code dan Secret Key TokoVoucher belum dikonfigurasi." });
    }

    const testResult = await testTokoVoucherConnection(config.memberCode, config.secret);
    const now = new Date().toISOString();

    const existingToko = await SystemConfigRepository.getInstance().getConfig("tokovoucher_integration") || {};
    await SystemConfigRepository.getInstance().upsertConfig("tokovoucher_integration", {
      ...existingToko,
      lastTestedAt: now,
      lastTestResult: testResult.success ? "SUCCESS" : "FAILED",
      lastTestMessage: testResult.message,
      memberName: testResult.data?.memberName || null,
      balance: testResult.data?.balance !== undefined ? testResult.data.balance : null,
      lastChecked: now
    });

    await logCoreAudit(actor, role, "TEST_TOKOVOUCHER_CONNECTION", "systemConfigs/tokovoucher_integration", null, {
      success: testResult.success,
      message: testResult.message
    }, testResult.message);

    return res.status(200).json({
      success: testResult.success,
      message: testResult.message,
      data: testResult.data || {}
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal melakukan tes koneksi TokoVoucher." });
  }
}

export async function removeTokoVoucherIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    await SystemConfigRepository.getInstance().deleteConfig("tokovoucher_integration");

    delete process.env.TOKOVOUCHER_SECRET;
    delete process.env.TOKOVOUCHER_MEMBER_CODE;

    await logCoreAudit(actor, role, "REMOVE_TOKOVOUCHER_INTEGRATION", "systemConfigs/tokovoucher_integration", null, null, "Removed TokoVoucher configuration");

    return res.status(200).json({
      success: true,
      message: "Konfigurasi TokoVoucher berhasil dihapus."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal menghapus konfigurasi TokoVoucher." });
  }
}

export async function getDashboardSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const { range = "24h" } = req.query;
    
    const calendarService = BusinessCalendarService.getInstance();
    await calendarService.ensureLoaded();
    const tz = calendarService.getTimezone();
    
    // Boundary setting using business timezone
    const now = DateTime.now().setZone(tz);
    let startTime: DateTime;
    let prevStartTime: DateTime;
    let prevEndTime: DateTime;

    switch (range) {
      case "7d":
        startTime = now.minus({ days: 7 }).startOf("day");
        prevStartTime = startTime.minus({ days: 7 });
        prevEndTime = startTime;
        break;
      case "30d":
        startTime = now.minus({ days: 30 }).startOf("day");
        prevStartTime = startTime.minus({ days: 30 });
        prevEndTime = startTime;
        break;
      case "24h":
      default:
        startTime = now.minus({ hours: 24 });
        prevStartTime = startTime.minus({ hours: 24 });
        prevEndTime = startTime;
        break;
    }

    const fetchMetrics = async (start: DateTime, end: DateTime) => {
      const startIso = start.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
      const endIso = end.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
      
      const ledgerRepo = DualLedgerRepository.getInstance();

      // Order Stats
      const allOrders = await OrderRepository.getInstance().getAllOrders();
      const ordersInPeriod = allOrders.filter(o => {
        const createdAt = o.createdAt;
        return createdAt && createdAt >= startIso && createdAt < endIso;
      });
      const totalOrders = ordersInPeriod.length;
      const successOrders = ordersInPeriod.filter(o => o.transactionStatus === "success").length;
      
      // Financial Metrics (Authoritative from Ledger Repository)
      const metrics = await ledgerRepo.getFinancialMetrics(startIso, endIso);

      // Operational Latency (Jobs) - Successful fulfillment only
      const { data: successfulJobsData } = await supabaseAdmin!.from("jobs")
        .select("*")
        .eq("type", "FULFILLMENT")
        .eq("status", "SUCCEEDED")
        .gte("created_at", startIso)
        .lt("created_at", endIso);
        
      const successfulJobs = (successfulJobsData || []).map(j => ({
        id: j.id,
        type: j.type,
        referenceId: j.reference_id,
        payload: j.payload,
        status: j.status,
        attempts: j.attempts,
        maxAttempts: j.max_attempts,
        lastError: j.last_error,
        nextRunAt: j.next_run_at,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        createdAt: j.created_at,
        updatedAt: j.updated_at
      }));
      
      const avgFulfillmentTime = successfulJobs.length > 0
        ? successfulJobs.reduce((acc, j) => {
            const completionTs = j.completedAt || j.updatedAt;
            if (completionTs && j.createdAt) {
              const duration = (new Date(completionTs).getTime() - new Date(j.createdAt).getTime()) / 1000;
              return acc + (duration > 0 ? duration : 0);
            }
            return acc;
          }, 0) / successfulJobs.length
        : 0;

      return {
        totalOrders,
        successOrders,
        grossRevenue: metrics.grossRevenue,
        realizedRevenue: metrics.realizedRevenue,
        refundTotal: metrics.refundTotal,
        totalSettled: metrics.totalSettled,
        totalMdr: metrics.totalMdr,
        avgFulfillmentTime
      };
    };

    const currentMetrics = await fetchMetrics(startTime, now);
    const prevMetrics = await fetchMetrics(prevStartTime, prevEndTime);

    const calculateTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const trends = {
      gross: calculateTrend(currentMetrics.grossRevenue, prevMetrics.grossRevenue),
      orders: calculateTrend(currentMetrics.totalOrders, prevMetrics.totalOrders),
      realized: calculateTrend(currentMetrics.realizedRevenue, prevMetrics.realizedRevenue),
      settled: calculateTrend(currentMetrics.totalSettled, prevMetrics.totalSettled)
    };

    const storeStatus = calendarService.isOpen();

    const { count: queueDepth } = await supabaseAdmin!.from("jobs")
      .select("*", { count: 'exact', head: true })
      .in("status", ["QUEUED", "RETRYING"]);

    const { count: activeWorkers } = await supabaseAdmin!.from("jobs")
      .select("*", { count: 'exact', head: true })
      .eq("status", "PROCESSING");

    const { count: totalCustomers } = await supabaseAdmin!.from("customers").select("*", { count: 'exact', head: true });

    const recentOrdersList = await OrderRepository.getInstance().getRecentOrders(10);
    const recentOrders = recentOrdersList.map(data => {
      return {
        id: data.id,
        invoice: data.invoice,
        productName: data.productName,
        gameName: (data as any).gameName,
        totalAmount: data.totalAmount,
        paymentStatus: data.paymentStatus,
        transactionStatus: data.transactionStatus,
        createdAt: data.createdAt,
        customerId: data.userId ? `${data.userId.substring(0, 4)}***` : 'GUEST'
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        range,
        timezone: tz,
        metrics: {
          orders: {
            total: currentMetrics.totalOrders,
            success: currentMetrics.successOrders,
            trend: trends.orders
          },
          financial: {
            grossRevenue: currentMetrics.grossRevenue,
            grossTrend: trends.gross,
            realizedRevenue: currentMetrics.realizedRevenue,
            realizedTrend: trends.realized,
            refundTotal: currentMetrics.refundTotal,
            totalSettled: currentMetrics.totalSettled,
            settledTrend: trends.settled,
            totalMdr: currentMetrics.totalMdr,
            currency: "IDR"
          },
          operational: {
            isOpen: storeStatus.isOpen,
            reason: storeStatus.reason,
            queueDepth,
            activeWorkers,
            avgFulfillmentTime: Math.round(currentMetrics.avgFulfillmentTime)
          },
          customers: {
            total: totalCustomers
          }
        },
        recentOrders
      }
    });
  } catch (error: any) {
    console.error("[Dashboard Stats Error]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminOrders(req: AuthenticatedRequest, res: Response) {
  try {
    const { search, paymentStatus, transactionStatus, limit = "50" } = req.query;
    let orders = await OrderRepository.getInstance().getAllOrders();

    if (paymentStatus && paymentStatus !== "all") {
      orders = orders.filter(o => o.paymentStatus === paymentStatus);
    }
    if (transactionStatus && transactionStatus !== "all") {
      orders = orders.filter(o => o.transactionStatus === transactionStatus);
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.toLowerCase();
      orders = orders.filter((o: any) => 
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.invoice && o.invoice.toLowerCase().includes(q)) ||
        (o.productName && o.productName.toLowerCase().includes(q)) ||
        (o.userId && o.userId.toLowerCase().includes(q)) ||
        (o.customerData?.userId && o.customerData.userId.toLowerCase().includes(q))
      );
    }

    const limitNum = parseInt(limit as string) || 50;
    const finalOrders = orders.slice(0, limitNum);

    return res.status(200).json({ success: true, data: finalOrders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminGames(req: AuthenticatedRequest, res: Response) {
  try {
    const games = await catalogService.listGames();
    return res.status(200).json({ success: true, data: games });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminCategories(req: AuthenticatedRequest, res: Response) {
  try {
    const categories = await catalogService.listCategories();
    return res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminProducts(req: AuthenticatedRequest, res: Response) {
  try {
    const { gameId } = req.query;
    const products = await catalogService.listProducts(gameId as string);
    return res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminVariants(req: AuthenticatedRequest, res: Response) {
  try {
    const { productId } = req.query;
    const variants = await catalogService.listVariants(productId as string);
    return res.status(200).json({ success: true, data: variants });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminOrderDetail(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orderData = await OrderRepository.getInstance().getOrderById(id);
    if (!orderData) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const allAuditLogs = await AuditLogRepository.getInstance().queryLogs(500);
    const auditLogs = allAuditLogs.filter(l => l.target?.includes(id));

    const refundRecords = await SupabaseRefundRepository.getInstance().getRefundsByOrderId(id);
    const refunds = refundRecords.map(item => ({
      id: item.id,
      orderId: item.orderId,
      refundKey: item.refundKey,
      amount: item.amount,
      currency: item.currency,
      reason: item.reason,
      status: item.status,
      provider: item.provider,
      providerRefundId: item.providerRefundId,
      requestedBy: item.requestedBy,
      processedAt: item.processedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    return res.status(200).json({
      success: true,
      data: {
        order: orderData,
        auditLogs,
        refunds
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function retryOrderFulfillment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orderData = await OrderRepository.getInstance().getOrderById(id);
    if (!orderData) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (orderData.paymentStatus !== "paid") {
      return res.status(400).json({ success: false, message: "Order is not paid" });
    }

    await dispatchFulfillment(id);
    await logAudit(req, "RETRY_FULFILLMENT", "orders", id, { triggeredBy: req.user.uid });

    return res.status(200).json({ success: true, message: "Fulfillment dispatch triggered" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ===================
// PROMO & VOUCHER MANAGEMENT
// ===================

export async function getAdminPromos(req: AuthenticatedRequest, res: Response) {
  try {
    const promos = await promoService.getPromos();
    return res.status(200).json({ success: true, data: promos });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createAdminPromo(req: AuthenticatedRequest, res: Response) {
  try {
    const promo = await promoService.createPromo(req.body, req.user.uid);
    await logAudit(req, "CREATE_PROMO", "promos", promo.id!, promo);
    return res.status(201).json({ success: true, data: promo });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateAdminPromo(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const promo = await promoService.updatePromo(id, req.body, req.user.uid);
    await logAudit(req, "UPDATE_PROMO", "promos", id, req.body);
    return res.status(200).json({ success: true, data: promo });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteAdminPromo(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await promoService.deletePromo(id, req.user.uid);
    await logAudit(req, "DELETE_PROMO", "promos", id, {});
    return res.status(200).json({ success: true, message: "Promo berhasil dinonaktifkan." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ===================
// FLASH SALE MANAGEMENT
// ===================

export async function getAdminFlashSales(req: AuthenticatedRequest, res: Response) {
  try {
    const list = await flashSaleService.getFlashSales();
    return res.status(200).json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createAdminFlashSale(req: AuthenticatedRequest, res: Response) {
  try {
    const fs = await flashSaleService.createFlashSale(req.body, req.user.uid);
    await logAudit(req, "CREATE_FLASH_SALE", "flashSales", fs.id!, fs);
    return res.status(201).json({ success: true, data: fs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateAdminFlashSale(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const fs = await flashSaleService.updateFlashSale(id, req.body, req.user.uid);
    await logAudit(req, "UPDATE_FLASH_SALE", "flashSales", id, req.body);
    return res.status(200).json({ success: true, data: fs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteAdminFlashSale(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await flashSaleService.deleteFlashSale(id, req.user.uid);
    await logAudit(req, "DELETE_FLASH_SALE", "flashSales", id, {});
    return res.status(200).json({ success: true, message: "Flash sale berhasil dinonaktifkan." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getProviderMappingSuggestions(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId, providerSkuIds } = req.body;
    if (!providerId) {
      return res.status(400).json({ success: false, message: "providerId wajib ditentukan." });
    }

    const { supabaseAdmin } = await import("./supabase-admin");
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: "Supabase Admin not configured" });
    }

    // 1. Fetch providerSkus
    const skusRes = await supabaseAdmin.from("provider_skus").select("*").eq("provider_id", providerId);
    if (skusRes.error) throw skusRes.error;
    
    let skus = skusRes.data.map(d => ({
      id: d.id, providerId: d.provider_id, name: d.name, code: d.code, description: d.description,
      price: d.price, originalPrice: d.original_price, status: d.status
    } as unknown as ProviderSku));

    if (providerSkuIds && Array.isArray(providerSkuIds) && providerSkuIds.length > 0) {
      const idSet = new Set(providerSkuIds);
      skus = skus.filter(s => idSet.has(s.id!));
    }

    if (skus.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 2. Fetch all variants, products, games for reference
    const [variantsRes, productsRes, gamesRes] = await Promise.all([
      supabaseAdmin.from("product_variants").select("*"),
      supabaseAdmin.from("products").select("*"),
      supabaseAdmin.from("games").select("*")
    ]);

    if (variantsRes.error) throw variantsRes.error;
    if (productsRes.error) throw productsRes.error;
    if (gamesRes.error) throw gamesRes.error;

    const variants = (variantsRes.data || []).map(d => ({
      id: d.id, productId: d.product_id, name: d.name, displayName: d.display_name,
      nominalValue: d.nominal_value, unit: d.unit, sku: d.sku
    } as unknown as ProductVariant));

    const products = (productsRes.data || []).map(d => ({
      id: d.id, gameId: d.game_id, name: d.name, slug: d.slug, type: d.type
    } as unknown as Product));

    const games = (gamesRes.data || []).map(d => ({
      id: d.id, name: d.name, slug: d.slug
    } as unknown as Game));

    const gamesMap = new Map<string, Game>();
    games.forEach(g => { if (g.id) gamesMap.set(g.id, g); });

    const productsMap = new Map<string, Product>();
    products.forEach(p => { if (p.id) productsMap.set(p.id, p); });

    // Helper functions for normalization
    const normalizeString = (str: string): string => {
      if (!str) return "";
      return str
        .toLowerCase()
        .replace(/[^\w\s]/g, " ") // replace punctuation with space
        .replace(/\s+/g, " ")     // normalize multiple spaces
        .trim();
    };

    const extractNumbers = (str: string): number[] => {
      const norm = normalizeString(str);
      const matches = norm.match(/\d+/g) || [];
      return matches.map(m => parseInt(m, 10));
    };

    const suggestions = skus.map(sku => {
      const skuNameNorm = normalizeString(sku.name);
      const skuCodeNorm = normalizeString(sku.providerSku);
      const skuNumbers = extractNumbers(sku.name + " " + sku.providerSku);

      let bestVariantId: string | null = null;
      let bestConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_MATCH' = 'NO_MATCH';
      let bestReasons: string[] = [];
      let maxScore = -1;

      for (const variant of variants) {
        const prod = productsMap.get(variant.productId);
        if (!prod) continue;
        const game = gamesMap.get(prod.gameId);
        if (!game) continue;

        const variantNameNorm = normalizeString(variant.name);
        const variantDisplayNameNorm = normalizeString(variant.displayName || "");
        const variantSkuNorm = normalizeString(variant.sku);
        const variantNumbers = extractNumbers(variant.name + " " + (variant.displayName || "") + " " + variant.sku);

        const prodNameNorm = normalizeString(prod.name);
        const gameNameNorm = normalizeString(game.name);

        let score = 0;
        let reasons: string[] = [];

        // 1. Game/Product match check
        const gameWords = gameNameNorm.split(" ").filter(w => w.length > 0);
        const gameInitials = gameWords.map(w => w[0]).join(""); // e.g., "ff" for free fire, "ml" for mobile legends
        const isInitialsMatch = gameInitials.length >= 2 && (
          skuNameNorm.split(" ").includes(gameInitials) ||
          skuCodeNorm.split(" ").includes(gameInitials) ||
          skuCodeNorm.startsWith(gameInitials) ||
          variantSkuNorm.startsWith(gameInitials)
        );

        const hasGameMatch = skuNameNorm.includes(gameNameNorm) || 
                             gameNameNorm.includes(skuNameNorm) ||
                             isInitialsMatch ||
                             (game.searchKeywords && game.searchKeywords.some(kw => kw && skuNameNorm.includes(normalizeString(kw))));

        const hasProductMatch = skuNameNorm.includes(prodNameNorm) || prodNameNorm.includes(skuNameNorm);

        if (hasGameMatch || hasProductMatch) {
          score += 10;
          reasons.push("Game/Product cocok");
        } else {
          continue;
        }

        // 2. Denomination / Number matching
        const commonNumbers = skuNumbers.filter(n => variantNumbers.includes(n));
        const hasDenominationMatch = commonNumbers.length > 0;

        if (hasDenominationMatch) {
          score += 20;
          reasons.push(`Denominasi angka cocok (${commonNumbers.join(", ")})`);
        } else if (skuNumbers.length > 0 || variantNumbers.length > 0) {
          score -= 10;
        }

        // 3. Name/SKU Match score
        const skuTokens = skuNameNorm.split(" ").filter(t => t.length > 1);
        const variantTokens = variantNameNorm.split(" ").concat(variantDisplayNameNorm.split(" ")).filter(t => t.length > 1);
        
        let tokenMatches = 0;
        skuTokens.forEach(token => {
          if (variantTokens.includes(token)) {
            tokenMatches++;
          }
        });

        if (tokenMatches > 0) {
          score += tokenMatches * 5;
          reasons.push(`${tokenMatches} kata kunci cocok`);
        }

        if (skuNameNorm.includes(variantNameNorm) || variantNameNorm.includes(skuNameNorm)) {
          score += 15;
          reasons.push("Nama varian sangat cocok");
        }

        // Determine confidence
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_MATCH' = 'LOW';
        if (hasGameMatch && hasDenominationMatch && tokenMatches >= 1) {
          confidence = 'HIGH';
        } else if (hasGameMatch && (hasDenominationMatch || tokenMatches >= 1)) {
          confidence = 'MEDIUM';
        } else if (hasGameMatch) {
          confidence = 'LOW';
        } else {
          confidence = 'NO_MATCH';
        }

        if (score > maxScore && confidence !== 'NO_MATCH') {
          maxScore = score;
          bestVariantId = variant.id!;
          bestConfidence = confidence;
          bestReasons = reasons;
        }
      }

      const baseCost = sku.metadata?.baseCost || 0;

      return {
        providerSkuId: sku.id!,
        providerSku: sku.providerSku,
        name: sku.name,
        baseCost,
        candidateVariantId: bestVariantId,
        confidenceScore: bestConfidence,
        matchReasons: bestReasons.length > 0 ? bestReasons : ["Tidak ada kecocokan yang meyakinkan"]
      };
    });

    await logAudit(req, "PROVIDER_MAPPING_SUGGESTIONS_GENERATED", "providerSkus", providerId, {
      providerId,
      skuCount: skus.length,
      suggestionCount: suggestions.length
    });

    return res.status(200).json({ success: true, data: suggestions });
  } catch (error: any) {
    console.error("Mapping suggestion error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function bulkCreateProviderMappings(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId, mappings, duplicateHandling } = req.body;
    const mode = duplicateHandling || "SKIP";

    if (!providerId) {
      return res.status(400).json({ success: false, message: "providerId wajib ditentukan." });
    }
    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ success: false, message: "mappings array wajib diisi." });
    }

    const { supabaseAdmin } = await import("./supabase-admin");
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: "Supabase Admin not configured" });
    }

    const providerRes = await supabaseAdmin.from("providers").select("*").eq("id", providerId).maybeSingle();
    if (!providerRes.data) {
      return res.status(404).json({ success: false, message: "Provider tidak ditemukan." });
    }

    await logAudit(req, "PROVIDER_BULK_MAPPING_STARTED", "providerMappings", providerId, {
      providerId,
      itemCount: mappings.length,
      mode
    });

    const existingMappingsRes = await supabaseAdmin.from("provider_mappings")
      .select("*")
      .eq("provider_id", providerId);

    const existingMap = new Map<string, { id: string, data: any }>();
    (existingMappingsRes.data || []).forEach(row => {
      // mapping row to camelCase for the write logic
      const data = {
        id: row.id,
        variantId: row.variant_id,
        providerId: row.provider_id,
        providerSkuId: row.provider_sku_id,
        status: row.status,
        priority: row.priority,
        routingEligibility: row.routing_eligibility,
        notes: row.notes,
        metadata: row.metadata
      };
      if (data.variantId && data.providerSkuId) {
        existingMap.set(`${data.variantId}_${data.providerSkuId}`, { id: row.id, data });
      }
    });

    const variantIds = mappings.map(m => m.variantId).filter(Boolean);
    const skuIds = mappings.map(m => m.providerSkuId).filter(Boolean);

    if (variantIds.length === 0 || skuIds.length === 0) {
      return res.status(400).json({ success: false, message: "variantId dan providerSkuId wajib disertakan pada semua entitas." });
    }

    const [variantsRes, skusRes] = await Promise.all([
      supabaseAdmin.from("product_variants").select("*").in("id", variantIds),
      supabaseAdmin.from("provider_skus").select("*").eq("provider_id", providerId).in("id", skuIds)
    ]);

    const variantsMap = new Map<string, any>();
    (variantsRes.data || []).forEach(row => {
      variantsMap.set(row.id, {
        id: row.id,
        productId: row.product_id,
        name: row.name,
        sku: row.sku
      });
    });

    const skusMap = new Map<string, any>();
    (skusRes.data || []).forEach(row => {
      skusMap.set(row.id, {
        id: row.id,
        providerId: row.provider_id,
        providerSku: row.provider_sku,
        name: row.name
      });
    });

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const timestamp = new Date().toISOString();

    for (const mappingReq of mappings) {
      const { variantId, providerSkuId, priority, status, routingEligibility, notes, metadata } = mappingReq;

      if (!variantId || !providerSkuId) {
        failedCount++;
        continue;
      }

      const variantData = variantsMap.get(variantId);
      const skuData = skusMap.get(providerSkuId);

      if (!variantData || !skuData) {
        failedCount++;
        continue;
      }

      const key = `${variantId}_${providerSkuId}`;
      const hasExisting = existingMap.has(key);

      if (hasExisting) {
        if (mode === "SKIP") {
          skippedCount++;
          continue;
        } else if (mode === "UPDATE") {
          const existingInfo = existingMap.get(key)!;
          await providerRepo.upsertMapping({
            id: existingInfo.id,
            variantId: variantId,
            providerId: providerId,
            providerSku: skuData.providerSku || "", // Should be provider_sku from db
            providerSkuId: providerSkuId,
            priority: (typeof priority === "number" && priority >= 1) ? priority : Math.max(1, existingInfo.data.priority || 1),
            status: (status || existingInfo.data.status) as any,
            routingEligibility: typeof routingEligibility === "boolean" ? routingEligibility : existingInfo.data.routingEligibility,
            notes: notes !== undefined ? notes : (existingInfo.data.notes || ""),
            metadata: metadata !== undefined ? metadata : (existingInfo.data.metadata || {})
          });
          successCount++;
        }
      } else {
        await providerRepo.upsertMapping({
          variantId,
          providerId,
          providerSku: skuData.providerSku || "",
          providerSkuId,
          status: (status || "NEEDS_REVIEW") as any,
          priority: (typeof priority === "number" && priority >= 1) ? priority : 1,
          routingEligibility: typeof routingEligibility === "boolean" ? routingEligibility : true,
          notes: notes || "",
          metadata: metadata || {}
        });
        successCount++;
        // Update existingMap to avoid duplicates in the same batch if necessary
        existingMap.set(key, { id: "new", data: {} }); 
      }
    }

    await logAudit(req, "PROVIDER_BULK_MAPPING_COMPLETED", "providerMappings", providerId, {
      providerId,
      acceptedCount: successCount,
      skippedCount,
      failedCount
    });

    return res.status(200).json({
      success: true,
      message: `Pemetaan massal berhasil diselesaikan. Berhasil: ${successCount}, Dilewati: ${skippedCount}, Gagal: ${failedCount}.`,
      data: {
        successCount,
        skippedCount,
        failedCount
      }
    });

  } catch (error: any) {
    console.error("Bulk mapping execution error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

const mappingService = ProviderMappingService.getInstance();

export async function listMappingsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId, status, pageSize, page, search } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const sizeNum = parseInt(pageSize as string) || 20;
    const result = await mappingService.listMappings(
      providerId as string, 
      (status as any) || 'ALL', 
      pageNum, 
      sizeNum, 
      search as string
    );
    return res.status(200).json({ 
      success: true, 
      data: result.data, 
      total: result.total, 
      page: result.page, 
      pageSize: result.pageSize 
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function mapSkuApi(req: AuthenticatedRequest, res: Response) {
    try {
      const { skuId, variantId } = req.body;
      const actor = { uid: req.user.uid, email: req.user.email };
      const id = await mappingService.mapSku(skuId, variantId, actor);
      return res.status(201).json({ success: true, data: { id } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
}

export async function getProviderSkusApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId, search, limit } = req.query;
    
    // We'll use the service which uses the repository
    const skus = await providerService.listProviderSkus(providerId as string);
    
    // Apply search filter if present (simple client-side for now or service could handle it)
    let filteredSkus = skus;
    if (search && typeof search === "string") {
      const term = search.toLowerCase();
      filteredSkus = skus.filter(s => 
        s.providerSku.toLowerCase().includes(term) || 
        s.name.toLowerCase().includes(term)
      );
    }

    if (limit) {
      const l = parseInt(limit as string, 10);
      if (!isNaN(l)) {
        filteredSkus = filteredSkus.slice(0, l);
      }
    }

    return res.status(200).json({
      success: true,
      data: filteredSkus,
      count: filteredSkus.length
    });
  } catch (error: any) {
    console.error("getProviderSkusApi error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch provider SKUs" });
  }
}

export async function deleteProviderSku(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await providerService.deleteProviderSku(id);
    await logAudit(req, "DELETE_PROVIDER_SKU", "providerSkus", id, {});
    return res.status(200).json({ success: true, message: "Provider SKU deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}




export async function getAdminGateways(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await PaymentGatewayService.getInstance().getGateways();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateAdminGateway(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;
    await PaymentGatewayService.getInstance().updateGateway(id, updates);
    return res.status(200).json({ success: true, data: { id, ...updates } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function bulkImportProviderSkus(req: AuthenticatedRequest, res: Response) {
  try {
    const { gameId, providerSkuIds } = req.body;

    if (!gameId) {
      return res.status(400).json({ success: false, message: "gameId wajib ditentukan." });
    }
    if (!providerSkuIds || !Array.isArray(providerSkuIds) || providerSkuIds.length === 0) {
      return res.status(400).json({ success: false, message: "providerSkuIds array wajib diisi." });
    }

    const actor = { uid: req.user.uid, email: req.user.email || 'admin@system' };
    const catalogService = CatalogService.getInstance();

    await logAudit(req, "BULK_IMPORT_SKUS_STARTED", "catalog", gameId, {
      gameId,
      skuCount: providerSkuIds.length
    });

    const results = await catalogService.bulkImportSkus(gameId, providerSkuIds, actor);

    await logAudit(req, "BULK_IMPORT_SKUS_COMPLETED", "catalog", gameId, {
      gameId,
      total: results.length,
      successCount: results.filter(r => r.success).length
    });

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getIpaymuIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const config = await SystemConfigRepository.getInstance().getConfig("ipaymu_integration") || {};
    const apiKey = config.encryptedApiKey ? decryptSecret(config.encryptedApiKey) : "";
    const apiKeyMasked = apiKey ? apiKey.substring(0, 6) + "************************" : "";
    
    return res.status(200).json({
      success: true,
      data: {
        va: config.va || "",
        apiKeyMasked,
        isProduction: config.isProduction || false,
        isActive: config.isActive === true,
        callbackUrl: config.callbackUrl || "https://ist.web.id/api/webhooks/ipaymu",
        configured: !!config.encryptedApiKey || !!config.va,
        lastTestedAt: config.lastTestedAt || null,
        lastTestResult: config.lastTestResult || null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal mengambil konfigurasi iPaymu." });
  }
}

export async function updateIpaymuIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const { va, apiKey, isProduction, isActive, callbackUrl } = req.body;
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    const existingData = await SystemConfigRepository.getInstance().getConfig("ipaymu_integration") || {};

    let encryptedApiKey = existingData.encryptedApiKey || "";
    if (apiKey && typeof apiKey === "string" && apiKey.trim() && !apiKey.includes("****")) {
      encryptedApiKey = encryptSecret(apiKey.trim());
    }

    const now = new Date().toISOString();
    const newData = {
      key: "ipaymu_integration",
      va: va !== undefined ? String(va).trim() : (existingData.va || ""),
      encryptedApiKey,
      isProduction: isProduction !== undefined ? !!isProduction : (existingData.isProduction || false),
      isActive: isActive !== undefined ? !!isActive : (existingData.isActive === true),
      callbackUrl: callbackUrl !== undefined ? String(callbackUrl).trim() : (existingData.callbackUrl || ""),
      lastTestedAt: existingData.lastTestedAt || null,
      lastTestResult: existingData.lastTestResult || null,
      updatedBy: actor.uid,
      updatedAt: now,
      createdAt: existingData.createdAt || now
    };

    await SystemConfigRepository.getInstance().upsertConfig("ipaymu_integration", newData);

    // Single active gateway enforcement: If iPaymu is explicitly set to active, deactivate Midtrans and Doit
    if (isActive === true || isActive === "true") {
      const existingMidtrans = await SystemConfigRepository.getInstance().getConfig("midtrans_integration");
      if (existingMidtrans && existingMidtrans.isActive) {
        await SystemConfigRepository.getInstance().upsertConfig("midtrans_integration", {
          ...existingMidtrans,
          isActive: false,
          updatedAt: now
        });
      }
      const existingDoit = await SystemConfigRepository.getInstance().getConfig("doit_integration");
      if (existingDoit && existingDoit.isActive) {
        await SystemConfigRepository.getInstance().upsertConfig("doit_integration", {
          ...existingDoit,
          isActive: false,
          updatedAt: now
        });
      }
      process.env.MIDTRANS_IS_ACTIVE = "false";
      process.env.DOIT_IS_ACTIVE = "false";
      process.env.IPAYMU_IS_ACTIVE = "true";
    } else if (isActive === false || isActive === "false") {
      process.env.IPAYMU_IS_ACTIVE = "false";
    }

    await logCoreAudit(actor, role, "UPDATE_IPAYMU_INTEGRATION", "systemConfigs/ipaymu_integration", {
      va: existingData.va ? "****" : null,
      isProduction: existingData.isProduction,
      isActive: existingData.isActive,
      callbackUrl: existingData.callbackUrl || null
    }, {
      va: newData.va ? "****" : null,
      isProduction: newData.isProduction,
      isActive: newData.isActive,
      callbackUrl: newData.callbackUrl || null
    }, "Updated iPaymu configuration");

    const apiKeyMasked = newData.encryptedApiKey ? "••••••••" : "";

    return res.status(200).json({
      success: true,
      message: "Konfigurasi iPaymu berhasil disimpan.",
      data: {
        va: newData.va,
        isProduction: newData.isProduction,
        isActive: newData.isActive,
        callbackUrl: newData.callbackUrl || "https://ist.web.id/api/webhooks/ipaymu",
        configured: !!newData.encryptedApiKey,
        apiKeyMasked
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal menyimpan konfigurasi iPaymu." });
  }
}

export async function testIpaymuIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    const config = await SystemConfigRepository.getInstance().getConfig("ipaymu_integration") || {};
    const apiKey = config.encryptedApiKey ? decryptSecret(config.encryptedApiKey) : "";
    const va = config.va || "";

    if (!va || !apiKey) {
      return res.status(400).json({ success: false, message: "iPaymu VA atau API Key belum dikonfigurasi." });
    }

    const adapter = IpaymuProviderAdapter.getInstance();
    await adapter.getPaymentStatus({ orderId: "ping_test_" + Date.now() });

    const now = new Date().toISOString();
    await SystemConfigRepository.getInstance().upsertConfig("ipaymu_integration", {
      ...config,
      lastTestedAt: now,
      lastTestResult: "SUCCESS",
      lastTestMessage: "Koneksi iPaymu berhasil diuji"
    });

    await logCoreAudit(actor, role, "TEST_IPAYMU_CONNECTION", "systemConfigs/ipaymu_integration", null, {
      success: true,
      message: "Connection OK"
    }, "Tested iPaymu connection");

    return res.status(200).json({
      success: true,
      message: "Koneksi ke iPaymu berhasil!",
      data: { success: true, testedAt: now }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Tes koneksi iPaymu gagal." });
  }
}

export async function removeIpaymuIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    await SystemConfigRepository.getInstance().deleteConfig("ipaymu_integration");
    await logCoreAudit(actor, role, "REMOVE_IPAYMU_INTEGRATION", "systemConfigs/ipaymu_integration", null, null, "Removed iPaymu configuration");

    return res.status(200).json({
      success: true,
      message: "Konfigurasi iPaymu berhasil dihapus."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal menghapus konfigurasi iPaymu." });
  }
}

const ALLOWED_DOIT_HOSTS = new Set([
  "pay.doit.id"
]);

function sanitizeAndValidateDoitBaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "https://pay.doit.id";
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "https://pay.doit.id";
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Format Base API URL tidak valid.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Base API URL harus menggunakan protokol HTTPS (https://).");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_DOIT_HOSTS.has(hostname)) {
    throw new Error(`Host '${hostname}' tidak diizinkan. Base URL Doit.id harus menggunakan domain resmi (pay.doit.id).`);
  }

  if (parsed.port && parsed.port !== "443" && parsed.port !== "") {
    throw new Error("Port kustom tidak diizinkan pada Base URL.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Userinfo credentials tidak diizinkan pada Base URL.");
  }

  return `${parsed.protocol}//${parsed.host}`;
}

export async function getDoitIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const config = await SystemConfigRepository.getInstance().getConfig("doit_integration") || {};
    const hasApiKey = !!config.encryptedApiKey || !!config.apiKey || !!process.env.DOIT_API_KEY;
    const hasWebhookSecret = !!config.encryptedWebhookSecret || !!config.webhookSecret || !!process.env.DOIT_WEBHOOK_SECRET;
    
    // Masking without revealing length, prefix, suffix, or plaintext
    const apiKeyMasked = hasApiKey ? "••••••••••••••••" : "";
    const webhookSecretMasked = hasWebhookSecret ? "••••••••••••••••" : "";

    return res.status(200).json({
      success: true,
      data: {
        apiKeyMasked,
        webhookSecretMasked,
        isProduction: config.isProduction || false,
        isActive: config.isActive === true,
        baseUrl: config.baseUrl || "https://pay.doit.id",
        callbackUrl: config.callbackUrl || "https://ist.web.id/api/webhooks/doit",
        configured: hasApiKey,
        hasWebhookSecret,
        lastTestedAt: config.lastTestedAt || null,
        lastTestResult: config.lastTestResult || null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "Gagal mengambil konfigurasi Doit.id." });
  }
}

export async function updateDoitIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const { apiKey, webhookSecret, baseUrl, isProduction, isActive, callbackUrl } = req.body;
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    const existingData = await SystemConfigRepository.getInstance().getConfig("doit_integration") || {};

    // Validate and sanitize base URL with strict allowlist (SSRF Protection)
    const safeBaseUrl = sanitizeAndValidateDoitBaseUrl(baseUrl !== undefined ? String(baseUrl) : existingData.baseUrl);

    // Secure secret preservation & migration of legacy plaintext fields
    let encryptedApiKey = existingData.encryptedApiKey || "";
    if (apiKey && typeof apiKey === "string" && apiKey.trim() && !apiKey.includes("****") && !apiKey.includes("••••")) {
      encryptedApiKey = encryptSecret(apiKey.trim());
    } else if (!encryptedApiKey && existingData.apiKey && typeof existingData.apiKey === "string" && existingData.apiKey.trim()) {
      encryptedApiKey = encryptSecret(existingData.apiKey.trim());
    }

    let encryptedWebhookSecret = existingData.encryptedWebhookSecret || "";
    if (webhookSecret && typeof webhookSecret === "string" && webhookSecret.trim() && !webhookSecret.includes("****") && !webhookSecret.includes("••••")) {
      encryptedWebhookSecret = encryptSecret(webhookSecret.trim());
    } else if (!encryptedWebhookSecret && existingData.webhookSecret && typeof existingData.webhookSecret === "string" && existingData.webhookSecret.trim()) {
      encryptedWebhookSecret = encryptSecret(existingData.webhookSecret.trim());
    }

    const now = new Date().toISOString();
    const newData = {
      key: "doit_integration",
      encryptedApiKey,
      encryptedWebhookSecret,
      baseUrl: safeBaseUrl,
      isProduction: isProduction !== undefined ? !!isProduction : (existingData.isProduction || false),
      isActive: isActive !== undefined ? !!isActive : (existingData.isActive === true),
      callbackUrl: callbackUrl !== undefined ? String(callbackUrl).trim() : (existingData.callbackUrl || "https://ist.web.id/api/webhooks/doit"),
      lastTestedAt: existingData.lastTestedAt || null,
      lastTestResult: existingData.lastTestResult || null,
      updatedBy: actor.uid,
      updatedAt: now,
      createdAt: existingData.createdAt || now
    };

    await SystemConfigRepository.getInstance().upsertConfig("doit_integration", newData);

    // Single active gateway enforcement: If Doit.id is explicitly set to active, deactivate Midtrans & iPaymu
    if (isActive === true || isActive === "true") {
      const existingMidtrans = await SystemConfigRepository.getInstance().getConfig("midtrans_integration");
      if (existingMidtrans && existingMidtrans.isActive) {
        await SystemConfigRepository.getInstance().upsertConfig("midtrans_integration", {
          ...existingMidtrans,
          isActive: false,
          updatedAt: now
        });
      }
      const existingIpaymu = await SystemConfigRepository.getInstance().getConfig("ipaymu_integration");
      if (existingIpaymu && existingIpaymu.isActive) {
        await SystemConfigRepository.getInstance().upsertConfig("ipaymu_integration", {
          ...existingIpaymu,
          isActive: false,
          updatedAt: now
        });
      }
      process.env.MIDTRANS_IS_ACTIVE = "false";
      process.env.IPAYMU_IS_ACTIVE = "false";
      process.env.DOIT_IS_ACTIVE = "true";
    } else if (isActive === false || isActive === "false") {
      process.env.DOIT_IS_ACTIVE = "false";
    }

    await logCoreAudit(actor, role, "UPDATE_DOIT_INTEGRATION", "systemConfigs/doit_integration", {
      isProduction: existingData.isProduction,
      isActive: existingData.isActive,
      callbackUrl: existingData.callbackUrl || null
    }, {
      isProduction: newData.isProduction,
      isActive: newData.isActive,
      callbackUrl: newData.callbackUrl || null
    }, "Updated Doit.id configuration");

    const apiKeyMasked = newData.encryptedApiKey ? "••••••••••••••••" : "";
    const webhookSecretMasked = newData.encryptedWebhookSecret ? "••••••••••••••••" : "";

    return res.status(200).json({
      success: true,
      message: "Konfigurasi Doit.id berhasil disimpan.",
      data: {
        isProduction: newData.isProduction,
        isActive: newData.isActive,
        baseUrl: newData.baseUrl,
        callbackUrl: newData.callbackUrl || "https://ist.web.id/api/webhooks/doit",
        configured: !!newData.encryptedApiKey,
        hasWebhookSecret: !!newData.encryptedWebhookSecret,
        apiKeyMasked,
        webhookSecretMasked
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal menyimpan konfigurasi Doit.id." });
  }
}

export async function testDoitIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    const config = await SystemConfigRepository.getInstance().getConfig("doit_integration") || {};
    const encryptedKey = config.encryptedApiKey || "";
    const apiKey = encryptedKey ? decryptSecret(encryptedKey) : (config.apiKey || process.env.DOIT_API_KEY || "");

    if (!apiKey) {
      return res.status(400).json({ success: false, message: "Doit.id API Key belum dikonfigurasi." });
    }

    // SSRF-validated base URL
    const safeBaseUrl = sanitizeAndValidateDoitBaseUrl(config.baseUrl || process.env.DOIT_BASE_URL);
    
    // Official Doit.id GET payments listing/status query by reference (non-transactional read contract)
    const testEndpoint = `${safeBaseUrl}/v1/payments?reference=TEST_CONN_PING`;

    try {
      const response = await fetch(testEndpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Autentikasi gagal: API Key Doit.id tidak valid (401/403 Unauthorized).");
      }

      if (response.status === 429) {
        throw new Error("Uji koneksi Doit.id gagal (HTTP 429 Too Many Requests): Batas frekuensi request terlampaui.");
      }

      if (response.status === 404) {
        throw new Error("Uji koneksi Doit.id gagal (HTTP 404): Endpoint atau resource tidak ditemukan.");
      }

      if (response.status >= 500) {
        throw new Error(`Uji koneksi Doit.id gagal (HTTP ${response.status}): Server Doit.id mengalami gangguan internal.`);
      }

      if (response.status !== 200) {
        throw new Error(`Uji koneksi Doit.id gagal (HTTP ${response.status}): Server mengembalikan status tidak terduga.`);
      }

      // Validate JSON response payload structure strictly matching doit-adapter.ts contract
      const data = await response.json().catch(() => null);
      if (!data || typeof data !== "object") {
        throw new Error("Uji koneksi Doit.id gagal: Respons server bukan format JSON yang valid.");
      }

      let isValidStructure = false;

      if (Array.isArray(data)) {
        // Direct array format: [] (empty probe reference) or [{ ...payment fields... }]
        if (data.length === 0) {
          isValidStructure = true;
        } else {
          const first = data[0];
          isValidStructure = typeof first === "object" && first !== null && 
            (typeof first.id === "string" || typeof first.reference === "string" || typeof first.amount === "number" || typeof first.status === "string");
        }
      } else if (Array.isArray(data.data)) {
        // Standard Doit API envelope format: { data: [] } or { data: [{ ...payment fields... }] }
        if (data.data.length === 0) {
          isValidStructure = true;
        } else {
          const first = data.data[0];
          isValidStructure = typeof first === "object" && first !== null && 
            (typeof first.id === "string" || typeof first.reference === "string" || typeof first.amount === "number" || typeof first.status === "string");
        }
      } else if (typeof data.id === "string" || typeof data.reference === "string") {
        // Direct single payment object with Doit payment contract fields
        isValidStructure = typeof data.status === "string" && (typeof data.amount === "number" || typeof data.amount === "string");
      }

      if (!isValidStructure) {
        throw new Error("Uji koneksi Doit.id gagal: Struktur payload respons Doit.id tidak sesuai kontrak API GET payments.");
      }
    } catch (fetchErr: any) {
      if (fetchErr.message && (fetchErr.message.includes("Autentikasi gagal") || fetchErr.message.includes("Uji koneksi Doit.id gagal"))) {
        throw fetchErr;
      }
      throw new Error("Gagal menghubungi server Doit.id: Koneksi jaringan terputus atau timeout.");
    }

    const now = new Date().toISOString();
    await SystemConfigRepository.getInstance().upsertConfig("doit_integration", {
      ...config,
      lastTestedAt: now,
      lastTestResult: "SUCCESS",
      lastTestMessage: "Koneksi Doit.id berhasil diuji"
    });

    await logCoreAudit(actor, role, "TEST_DOIT_CONNECTION", "systemConfigs/doit_integration", null, {
      success: true,
      message: "Connection OK"
    }, "Tested Doit.id connection");

    return res.status(200).json({
      success: true,
      message: "Koneksi ke Doit.id berhasil terverifikasi!",
      data: { success: true, testedAt: now }
    });
  } catch (err: any) {
    const now = new Date().toISOString();
    try {
      const config = await SystemConfigRepository.getInstance().getConfig("doit_integration") || {};
      await SystemConfigRepository.getInstance().upsertConfig("doit_integration", {
        ...config,
        lastTestedAt: now,
        lastTestResult: "FAILED",
        lastTestMessage: err.message || "Tes koneksi Doit.id gagal"
      });
    } catch {
      // Ignore background state save failure
    }
    return res.status(500).json({ success: false, message: err.message || "Tes koneksi Doit.id gagal." });
  }
}

export async function removeDoitIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    await SystemConfigRepository.getInstance().deleteConfig("doit_integration");
    process.env.DOIT_IS_ACTIVE = "false";
    await logCoreAudit(actor, role, "REMOVE_DOIT_INTEGRATION", "systemConfigs/doit_integration", null, null, "Removed Doit.id configuration");

    return res.status(200).json({
      success: true,
      message: "Konfigurasi Doit.id berhasil dihapus."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Gagal menghapus konfigurasi Doit.id." });
  }
}


