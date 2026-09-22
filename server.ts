import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { processCheckout } from "./src/server/order-engine.js";
import { midtransWebhook, tokovoucherWebhook } from "./src/server/webhooks.js";
import { optionalAuth, requireAuth, requireAdmin, requirePermission, AuthenticatedRequest } from "./src/server/middleware.js";
import { ApiGamesProvider } from "./src/server/providers.js";
import { performGameAccountInquiry } from "./src/server/inquiry-adapter.js";
const ISTORE_PROJECT_ID = process.env.ISTORE_PROJECT_ID || "istore-id";
const ISTORE_FIRESTORE_DATABASE_ID = process.env.ISTORE_FIRESTORE_DATABASE_ID || "(default)";

import {
  createProduct, updateProduct, deactivateProduct, getProductResetPreview, resetProductAndMapping, updateUserRole, updateOrderState, getAdminOrders, getDashboardSummary, getAdminOrderDetail, retryOrderFulfillment, 
  createGame, updateGame, deleteGame, createCategory, updateCategory, deleteCategory, createVariant, updateVariant, 
  createProvider, updateProvider, getProviders, deleteProvider,
  createProviderSku, updateProviderSku, deleteProviderSku, 
  createProviderMapping, updateProviderMapping, deleteProviderMapping, getProviderCatalogDiscovery, 
  createPaymentGateway, updatePaymentGateway, getApiGamesCredentialStatus, updateApiGamesCredentials, testApiGamesConnection, 
  createRefund, getAdminRefunds, getMidtransIntegration, updateMidtransIntegration, testMidtransIntegration, removeMidtransIntegration, 
  getTokoVoucherIntegration, updateTokoVoucherIntegration, testTokoVoucherIntegrationApi, removeTokoVoucherIntegration, 
  getAdminPromos, createAdminPromo, updateAdminPromo, deleteAdminPromo, 
  getAdminFlashSales, getAdminGateways, updateAdminGateway, createAdminFlashSale, updateAdminFlashSale, deleteAdminFlashSale, 
  getProviderMappingSuggestions, bulkCreateProviderMappings, listMappingsApi, mapSkuApi, getProviderSkusApi,
  getAdminGames, getAdminCategories, getAdminProducts, getAdminVariants,
  importFromCatalogDiscovery, bulkImportProviderSkus
} from "./src/server/admin-api.js";
import { validateBulkImport, commitBulkImport, getAllProviderSkus } from "./src/server/provider-import.js";
import { getStoreConfig, updateStoreConfig, getSystemConfigs, updateSystemConfig, getPublicStoreConfig, getSystemConfigOverview, getPublicMidtransConfig } from "./src/server/config-api.js";
import { getAdminFeatureFlags, updateAdminFeatureFlags } from "./src/server/feature-flag-api.js";
import { getCustomerProfileApi, getCustomerOrdersApi } from "./src/server/customer-api.js";
import { getRoles, createRoleApi, updateRoleApi, deleteRoleApi, assignRoleApi, getUserPermissionsApi, checkPermissionApi, getAdminUsersApi, updateProfileApi } from "./src/server/auth-api.js";
import { getPublicGames, getPublicGameDetail, getPublicVariants, getPublicCategories, getPublicFlashSales } from "./src/server/public-catalog-api.js";
import { createPricingRule, getPricingRules, updatePricingRule, getPriceHistory, previewPriceCalculation, refreshVariantPrice, bulkRefreshPrices } from "./src/server/pricing-api.js";
import { reconcileSingleOrder, triggerReconciliationBatch, getReconciliationOverviewApi, getReconciliationRunsApi, getReconciliationRecordsApi, getReconciliationRunDetailApi } from "./src/server/reconciliation-api.js";
import { getTaxAndFeeConfigApi, updateTaxAndFeeConfigApi } from "./src/server/taxes-api.js";
import { 
  getCommissionConfigApi, 
  updateCommissionConfigApi, 
  getCommissionRecipientsApi, 
  getCommissionRecipientByIdApi, 
  createCommissionRecipientApi, 
  updateCommissionRecipientApi, 
  getCommissionRulesApi, 
  getCommissionRuleByIdApi, 
  createCommissionRuleApi, 
  updateCommissionRuleApi,
  getCommissionRecordsApi,
  getCommissionRecordByIdApi,
  getCommissionReconciliationApi,
  triggerCommissionRefundClawbackApi,
  handleListPayoutBatches,
  handleGetPayoutBatchDetail,
  handleCreatePayoutBatch,
  handleSubmitPayoutBatch,
  handleApprovePayoutBatch,
  handleConfirmPayoutPaid,
  handleCancelPayoutBatch,
  handleMarkPayoutBatchFailed,
  handleExportTransferInstruction
} from "./src/server/commission-api.js";
import { triggerSupabaseCatalogSyncApi } from "./src/server/supabase-sync-api.js";
import { getLoyaltyConfigAdmin, updateLoyaltyConfigAdmin, getAllLoyaltyTransactionsAdmin, adjustCustomerPointsAdmin, getCustomerPointsInfo } from "./src/server/loyalty-api.js";
import referralApi from "./src/server/referral-api.js";
import adminReferralApi from "./src/server/admin-referral-api.js";
import membershipApi from "./src/server/membership-api.js";
import adminMembershipApi from "./src/server/admin-membership-api.js";
import { getPublicRewards, redeemCustomerReward, getCustomerRedemptionsApi, getAdminRewards, createAdminReward, updateAdminReward, deleteAdminReward, getAdminRedemptions } from "./src/server/reward-api.js";
import { getCustomerWishlist, addToCustomerWishlist, removeFromCustomerWishlist } from "./src/server/wishlist-api.js";
import { getPublicProductReviews, createCustomerReview, getAdminReviewsApi, updateAdminReviewStatusApi, deleteAdminReviewApi } from "./src/server/review-api.js";
import { getMediaLibraryApi, uploadMediaApi, updateMediaMetadataApi, deleteMediaApi, uploadMiddleware } from "./src/server/media-api.js";
import { getPublicBannersApi, getAdminBannersApi, createBannerApi, updateBannerApi, deleteBannerApi } from "./src/server/banner-api.js";
import { getPublicPopupsApi, getAdminPopupsApi, createPopupApi, updatePopupApi, deletePopupApi } from "./src/server/popup-api.js";
import { getPublicCampaignsApi, getPublicCampaignDetailApi, getAdminCampaignsApi, getCampaignComponentsDataApi, createCampaignApi, updateCampaignApi, archiveCampaignApi, deleteCampaignApi } from "./src/server/campaign-api.js";
import { getPublicLandingPageApi, getPublicLandingsApi, getAdminLandingPagesApi, getAdminLandingPageByIdApi, getAdminLandingPagePreviewApi, getAdminLandingComponentsApi, createLandingPageApi, updateLandingPageApi, publishLandingPageApi, archiveLandingPageApi, deleteLandingPageApi } from "./src/server/landing-api.js";
import { getPublicBlogsApi, getPublicBlogBySlugApi, getAdminBlogsApi, getAdminBlogComponentsApi, getAdminBlogByIdApi, getAdminBlogPreviewApi, createBlogApi, updateBlogApi, publishBlogApi, archiveBlogApi, deleteBlogApi } from "./src/server/blog-api.js";
import { getPublicFaqsApi, getPublicFaqByIdApi, getAdminFaqsApi, getAdminFaqComponentsApi, getAdminFaqByIdApi, createFaqApi, updateFaqApi, publishFaqApi, toggleEnableFaqApi, archiveFaqApi, reorderFaqsApi, deleteFaqApi } from "./src/server/faq-api.js";
import { getPublicSEOSettings, getAdminSEOSettings, updateAdminSEOSettings, resetAdminSEOSettings, getRobotsTxt, getSitemapXml } from "./src/server/seo-api.js";
import { getLedgerEntriesApi, getLedgerOverviewApi, getLedgerEntryDetailApi, exportLedgerCsvApi } from "./src/server/ledger-api.js";
import { migrateInitialRoles, isOwnerIdentity, OWNER_EMAIL } from "./src/server/auth-service.js";
import { AuthRepository } from "./src/server/supabase/auth-repository.js";
import { getQuotas, saveQuota, getVariantStock, adjustStock, getStockMovements, getReservations, getStocks } from "./src/server/inventory-api.js";
import { getCustomerDelivery, getAdminDeliveries, getAdminDeliveryDetail } from "./src/server/delivery-api.js";
import { getCustomerNotifications, getAdminNotifications, markNotificationRead, markAllNotificationsRead, getAdminNotificationSettings, updateAdminNotificationSettings } from "./src/server/notification-api.js";
import { getSystemHealth } from "./src/server/health-api.js";
import { getAdminIncidents, acknowledgeIncidentApi, assignIncidentApi, resolveIncidentApi, closeIncidentApi } from "./src/server/incident-api.js";
import { 
  getSLAPolicies, createSLAPolicy, updateSLAPolicy, deleteSLAPolicy, 
  getSLAMonitor, getOrderSLADetail 
} from "./src/server/sla-api.js";
import { 
  getCalendarConfig, updateCalendarConfig, upsertCalendarException, deleteCalendarException, getCalendarPreview 
} from "./src/server/business-calendar-api.js";
import {
  getPublicPrivacyApi,
  getAdminPrivacyApi,
  updateAdminPrivacyApi,
  resetAdminPrivacyApi
} from "./src/server/privacy-api.js";
import {
  getSecuritySettingsApi,
  updateSecuritySettingsApi,
  testIpSecurityApi,
  getSecurityOverviewApi,
  validatePasswordApi,
  getPasswordPolicyApi,
  auditPasswordChangeApi,
  auditPasswordResetApi,
  auditMfaChangeApi
} from "./src/server/security-api.js";
import {
  getAuditLogsApi,
  getAuditMetricsApi,
  getAuditDetailApi,
  exportAuditLogsApi
} from "./src/server/audit-api.js";
import supportApi from "./src/server/support-api.js";
import adminSupportApi from "./src/server/admin-support-api.js";
import {
  getSystemLogsApi,
  getSystemLogMetricsApi,
  getSystemLogDetailApi,
  exportSystemLogsApi,
  emitDiagnosticLogApi
} from "./src/server/system-log-api.js";
import {
  securityHeadersMiddleware,
  ipFirewallMiddleware,
  rateLimitMiddleware,
  emergencyLockdownMiddleware
} from "./src/server/security-middleware.js";
import {
} from "./src/server/customer-api.js";
import { customerSegmentRouter } from "./src/server/customer-segment-api.js";
import { supabaseAdmin } from "./src/server/supabase-admin.js";
import { OrderRepository } from "./src/server/supabase/order-repository.js";

dotenv.config();

// Auto-mocked adminDb for Supabase (backward compatibility during migration)
const adminDb: any = {
  collection: (name: string) => {
    const tableName = name === "users" ? "profiles" : name;
    return {
      doc: (id?: string) => ({
        id: id || "mock-id",
        get: async () => {
          const { data } = await supabaseAdmin!.from(tableName).select("*").eq("id", id).maybeSingle();
          return { exists: !!data, data: () => data };
        },
        set: async (d: any) => {
          const payload = { ...d, id };
          if (name === "users") {
            if (payload.name) { payload.display_name = payload.name; delete payload.name; }
            if (payload.role) { payload.role_id = payload.role; delete payload.role; }
          }
          await supabaseAdmin!.from(tableName).upsert(payload);
        },
        update: async (d: any) => {
          const payload = { ...d };
          if (name === "users") {
            if (payload.name) { payload.display_name = payload.name; delete payload.name; }
            if (payload.role) { payload.role_id = payload.role; delete payload.role; }
          }
          await supabaseAdmin!.from(tableName).update(payload).eq("id", id);
        },
        collection: (n: string) => adminDb.collection(n)
      }),
      where: () => adminDb.collection(name),
      orderBy: () => adminDb.collection(name),
      limit: () => adminDb.collection(name),
      get: async () => {
        const { data } = await supabaseAdmin!.from(tableName).select("*");
        return { docs: (data || []).map((d: any) => ({ data: () => d, exists: true, id: d.id })), empty: !(data && data.length), size: data?.length || 0 };
      },
      count: () => ({ get: async () => {
        const { count } = await supabaseAdmin!.from(tableName).select("*", { count: 'exact', head: true });
        return { data: () => ({ count: count || 0 }) };
      } })
    };
  },
  runTransaction: async (cb: any) => cb({
    get: async () => ({ exists: false, data: () => ({}), ref: {} }),
    set: () => {},
    update: () => {}
  }),
  batch: () => ({
    set: () => {},
    update: () => {},
    commit: async () => {}
  }),
  doc: (path: string) => adminDb.collection("doc").doc()
};

export const app = express();
const PORT = 3000;

let isServerInitialized = false;

export async function initServerLogic() {
  if (isServerInitialized) return;
  
  app.use(cors());
  app.use(express.json());
  app.use(securityHeadersMiddleware);
  app.use(ipFirewallMiddleware);

  const distPath = "/app/applet/dist";
  app.use("/assets", express.static(path.join(distPath, "assets")));
  app.use(express.static(distPath, { index: false }));

  // API Routes
  app.get("/api/health", async (req, res) => {
    let adminInitialized = false;
    let dbStatus = "fail";
    let errorDetail = null;
    
    try {
      adminInitialized = !!adminDb;
      // TEST FIREBASE ADMIN SECARA LANGSUNG
      await adminDb.collection("_health").limit(1).get();
      dbStatus = "PASS";
    } catch (err: any) {
      dbStatus = "fail";
      errorDetail = {
        message: err.message,
        code: err.code
      };
    }

    res.json({ 
      status: dbStatus === "PASS" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      firebaseAdminInitialized: adminInitialized,
      projectId: ISTORE_PROJECT_ID,
      database: ISTORE_FIRESTORE_DATABASE_ID,
      firestoreConnectivity: dbStatus,
      error: errorDetail
    });
  });

  app.get("/api/firebase-config-status", (req, res) => {
    res.json({
      targetProject: ISTORE_PROJECT_ID,
      serverProjectId: ISTORE_PROJECT_ID,
      serverDatabaseId: ISTORE_FIRESTORE_DATABASE_ID,
      isDecoupledFromAiStudio: true
    });
  });

  // Synchronize authenticated Firebase user with Firestore and guarantee owner role
  app.post("/api/auth/sync-user", optionalAuth, async (req: AuthenticatedRequest, res) => {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ success: false, message: "Unauthorized. Valid Firebase ID Token required." });
    }

    const uid = req.user.uid;
    const email = (req.user.email || "").toLowerCase();
    const isOwner = isOwnerIdentity(email);

    try {
      // Use AuthRepository for canonical profile sync
      const authRepo = AuthRepository.getInstance();
      const existingProfile = await authRepo.getUser(uid);
      
      let role_id = isOwner ? "pemilik" : "customer";

      if (existingProfile) {
        const existingRole = existingProfile.role_id;
        if (isOwner) {
          role_id = "pemilik";
        } else if (existingRole) {
          role_id = existingRole;
        }
      }

      const profileData = {
        id: uid,
        email: req.user.email || email,
        display_name: req.user.name || req.body?.name || email.split("@")[0],
        phone: req.user.phone || req.body?.phone || undefined,
        role_id,
        status: "ACTIVE",
        updated_at: new Date().toISOString()
      };

      // Canonical Write to public.profiles
      await authRepo.upsertProfile(profileData);
      
      res.json({ success: true, role: role_id, user: profileData });
    } catch (err: any) {
      console.error("User sync error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Auth & Roles API
  app.get("/api/auth/permissions", optionalAuth, getUserPermissionsApi);
  app.put("/api/auth/profile", requireAuth, updateProfileApi);
  app.get("/api/auth/check", requirePermission("system", "view"), checkPermissionApi);
  
  // Public Catalog API
  app.get("/api/public/catalog/games", getPublicGames);
  app.get("/api/public/catalog/categories", getPublicCategories);
  app.get("/api/public/catalog/games/:slug", getPublicGameDetail);
  app.get("/api/public/catalog/products/:productId/variants", getPublicVariants);
  app.get("/api/public/flash-sales", getPublicFlashSales);
  
  // Pricing APIs
  app.get("/api/admin/pricing/rules", requirePermission("pricing", "view"), getPricingRules);
  app.post("/api/admin/pricing/rules", requirePermission("pricing", "create"), createPricingRule);
  app.put("/api/admin/pricing/rules/:id", requirePermission("pricing", "edit"), updatePricingRule);
  app.get("/api/admin/pricing/history/:variantId", requirePermission("pricing", "view"), getPriceHistory);
  app.post("/api/admin/pricing/preview", requirePermission("pricing", "view"), previewPriceCalculation);
  app.post("/api/admin/pricing/variants/:id/refresh", requirePermission("pricing", "edit"), refreshVariantPrice);
  app.post("/api/admin/pricing/bulk-refresh", requirePermission("pricing", "edit"), bulkRefreshPrices);
  
  app.get("/api/admin/roles", requirePermission("roles", "view"), getRoles);
  app.post("/api/admin/roles", requirePermission("roles", "create"), createRoleApi);
  app.put("/api/admin/roles/:id", requirePermission("roles", "edit"), updateRoleApi);
  app.delete("/api/admin/roles/:id", requirePermission("roles", "delete"), deleteRoleApi);
  app.get("/api/admin/users", requirePermission("users", "view"), getAdminUsersApi);
  app.post("/api/admin/users/:uid/role", requirePermission("users", "edit"), assignRoleApi);

  // Customer Management APIs (Phase C1: Pengguna / Customer Management Engine)

  // Customer Segmentation APIs (Phase C2: Customer Segments Engine)
  app.use("/api/admin/customer-segments", customerSegmentRouter);

  // Support & Ticketing APIs (Phase C5)
  app.use("/api/support", supportApi);
  app.use("/api/admin/support", adminSupportApi);

  // Security Management APIs
  app.get("/api/admin/security/settings", requirePermission("system", "view"), getSecuritySettingsApi);
  app.put("/api/admin/security/settings", requirePermission("system", "edit"), updateSecuritySettingsApi);
  app.get("/api/admin/security/overview", requirePermission("system", "view"), getSecurityOverviewApi);
  app.post("/api/admin/security/test-ip", requirePermission("system", "view"), testIpSecurityApi);
  // Password Policy & Auth Enforcement (P1, P1-B & P1-C-A)
  app.get("/api/auth/password-policy", getPasswordPolicyApi);
  app.post("/api/auth/validate-password", validatePasswordApi);
  app.post("/api/auth/audit-password-change", requireAuth, auditPasswordChangeApi);
  app.post("/api/auth/audit-password-reset", auditPasswordResetApi);
  app.post("/api/auth/audit-mfa-change", requireAuth, auditMfaChangeApi);

  // Audit Logs APIs
  app.get("/api/admin/audit-logs", requirePermission("audit_logs", "view"), getAuditLogsApi);
  app.get("/api/admin/audit-logs/metrics", requirePermission("audit_logs", "view"), getAuditMetricsApi);
  app.get("/api/admin/audit-logs/:id", requirePermission("audit_logs", "view"), getAuditDetailApi);
  app.post("/api/admin/audit-logs/export", requirePermission("audit_logs", "export"), exportAuditLogsApi);

  // System Logs APIs
  app.get("/api/admin/system-logs", requirePermission("system_logs", "view"), getSystemLogsApi);
  app.get("/api/admin/system-logs/metrics", requirePermission("system_logs", "view"), getSystemLogMetricsApi);
  app.get("/api/admin/system-logs/:id", requirePermission("system_logs", "view"), getSystemLogDetailApi);
  app.post("/api/admin/system-logs/export", requirePermission("system_logs", "export"), exportSystemLogsApi);
  app.post("/api/admin/system-logs/simulate", requirePermission("system_logs", "edit"), emitDiagnosticLogApi);

  // Order & Webhooks
  app.get("/api/orders/:invoice", async (req, res) => {
    try {
      const { invoice } = req.params;
      if (!invoice) {
        return res.status(400).json({ success: false, message: "Invoice is required" });
      }
      const orderRepo = OrderRepository.getInstance();
      let order = await orderRepo.getOrderByInvoice(invoice);
      if (!order) {
        order = await orderRepo.getOrderById(invoice);
      }
      if (!order) {
        return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan." });
      }
      return res.status(200).json({ success: true, data: order });
    } catch (error: any) {
      console.error("Get order by invoice error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/checkout", emergencyLockdownMiddleware, rateLimitMiddleware("checkout"), optionalAuth, processCheckout);
  app.post("/api/webhooks/midtrans", midtransWebhook);
  app.post("/api/webhooks/tokovoucher", tokovoucherWebhook);

  // Admin Routes (Using Permissions instead of just requireAdmin)
  app.post("/api/admin/games", requirePermission("games", "create"), createGame);
  app.put("/api/admin/games/:id", requirePermission("games", "edit"), updateGame);
  app.delete("/api/admin/games/:id", requirePermission("games", "delete"), deleteGame);
  app.post("/api/admin/categories", requirePermission("games", "create"), createCategory);
  app.put("/api/admin/categories/:id", requirePermission("games", "edit"), updateCategory);
  app.delete("/api/admin/categories/:id", requirePermission("games", "delete"), deleteCategory);
  
  app.post("/api/admin/products", requirePermission("products", "create"), createProduct);
  app.put("/api/admin/products/:id", requirePermission("products", "edit"), updateProduct);
  app.post("/api/admin/products/:id/deactivate", requirePermission("products", "delete"), deactivateProduct);
  app.get("/api/admin/products/:id/reset-preview", requirePermission("products", "view"), getProductResetPreview);
  app.delete("/api/admin/products/:id/reset", requirePermission("products", "delete"), resetProductAndMapping);
  app.post("/api/admin/catalog/bulk-import-skus", requirePermission("products", "create"), bulkImportProviderSkus);

  app.post("/api/admin/product-variants", requirePermission("products", "create"), createVariant);
  app.put("/api/admin/product-variants/:id", requirePermission("products", "edit"), updateVariant);

  app.put("/api/admin/users/:id/role", requirePermission("users", "edit"), updateUserRole);
  app.get("/api/admin/dashboard/stats", requirePermission("dashboard", "view"), getDashboardSummary);
  app.get("/api/admin/orders", requirePermission("orders", "view"), getAdminOrders);
  app.get("/api/admin/orders/:id", requirePermission("orders", "view"), getAdminOrderDetail);
  app.post("/api/admin/orders/:id/override", requirePermission("orders", "edit"), updateOrderState);
  app.post("/api/admin/orders/:id/retry-fulfillment", requirePermission("orders", "edit"), retryOrderFulfillment);
  app.post("/api/admin/refunds", requirePermission("finance", "edit"), createRefund);
  app.get("/api/admin/refunds", requirePermission("finance", "view"), getAdminRefunds);
  app.get("/api/admin/reconciliation/overview", requirePermission("finance", "view"), getReconciliationOverviewApi);
  app.get("/api/admin/reconciliation/runs", requirePermission("finance", "view"), getReconciliationRunsApi);
  app.get("/api/admin/reconciliation/runs/:id", requirePermission("finance", "view"), getReconciliationRunDetailApi);
  app.get("/api/admin/reconciliation/records", requirePermission("finance", "view"), getReconciliationRecordsApi);
  app.post("/api/admin/reconciliation/orders/:id", requirePermission("finance", "edit"), reconcileSingleOrder);
  app.post("/api/admin/reconciliation/runs", requirePermission("finance", "edit"), triggerReconciliationBatch);

  // Provider SKU Migration Runner Route (Owner-only)

  // Tax & Fee Configuration Routes
  app.get("/api/admin/taxes/config", requirePermission("finance", "view"), getTaxAndFeeConfigApi);
  app.put("/api/admin/taxes/config", requirePermission("finance", "edit"), updateTaxAndFeeConfigApi);

  // Commission Foundation & Accrual Routes (Phase 1 & Phase 2)
  app.get("/api/admin/commission/config", requirePermission("finance", "view"), getCommissionConfigApi);
  app.put("/api/admin/commission/config", requirePermission("finance", "edit"), updateCommissionConfigApi);
  app.get("/api/admin/commission/recipients", requirePermission("finance", "view"), getCommissionRecipientsApi);
  app.post("/api/admin/commission/recipients", requirePermission("finance", "edit"), createCommissionRecipientApi);
  app.get("/api/admin/commission/recipients/:id", requirePermission("finance", "view"), getCommissionRecipientByIdApi);
  app.put("/api/admin/commission/recipients/:id", requirePermission("finance", "edit"), updateCommissionRecipientApi);
  app.get("/api/admin/commission/rules", requirePermission("finance", "view"), getCommissionRulesApi);
  app.post("/api/admin/commission/rules", requirePermission("finance", "edit"), createCommissionRuleApi);
  app.get("/api/admin/commission/rules/:id", requirePermission("finance", "view"), getCommissionRuleByIdApi);
  app.put("/api/admin/commission/rules/:id", requirePermission("finance", "edit"), updateCommissionRuleApi);
  app.get("/api/admin/commission/records", requirePermission("finance", "view"), getCommissionRecordsApi);
  app.get("/api/admin/commission/records/:id", requirePermission("finance", "view"), getCommissionRecordByIdApi);
  app.get("/api/admin/commission/reconciliation", requirePermission("finance", "view"), getCommissionReconciliationApi);
  app.post("/api/admin/commission/reversal/trigger", requirePermission("finance", "edit"), triggerCommissionRefundClawbackApi);

  // Commission Payout & Disbursement Routes (Phase 5)
  app.get("/api/admin/commission/payouts", requirePermission("finance", "view"), handleListPayoutBatches);
  app.get("/api/admin/commission/payouts/:batchId", requirePermission("finance", "view"), handleGetPayoutBatchDetail);
  app.post("/api/admin/commission/payouts/create", requirePermission("finance", "edit"), handleCreatePayoutBatch);
  app.post("/api/admin/commission/payouts/:batchId/submit", requirePermission("finance", "edit"), handleSubmitPayoutBatch);
  app.post("/api/admin/commission/payouts/:batchId/approve", requirePermission("finance", "edit"), handleApprovePayoutBatch);
  app.post("/api/admin/commission/payouts/:batchId/confirm-paid", requirePermission("finance", "edit"), handleConfirmPayoutPaid);
  app.post("/api/admin/commission/payouts/:batchId/cancel", requirePermission("finance", "edit"), handleCancelPayoutBatch);
  app.post("/api/admin/commission/payouts/:batchId/mark-failed", requirePermission("finance", "edit"), handleMarkPayoutBatchFailed);
  app.get("/api/admin/commission/payouts/:batchId/export-instruction", requirePermission("finance", "export"), handleExportTransferInstruction);

  // Settlement Routes
  // app.post("/api/admin/settlement/import", requirePermission("finance", "edit"), );
  
  // Ledger Routes
  app.get("/api/admin/ledger/overview", requirePermission("finance", "view"), getLedgerOverviewApi);
  app.get("/api/admin/ledger/entries", requirePermission("finance", "view"), getLedgerEntriesApi);
  app.get("/api/admin/ledger/export", requirePermission("finance", "export"), exportLedgerCsvApi);
  app.get("/api/admin/ledger/entries/:id", requirePermission("finance", "view"), getLedgerEntryDetailApi);
  
  // Provider Routes
  app.get("/api/admin/providers", requirePermission("providers", "view"), getProviders);
  app.post("/api/admin/providers", requirePermission("providers", "create"), createProvider);
  app.put("/api/admin/providers/:id", requirePermission("providers", "edit"), updateProvider);
  app.delete("/api/admin/providers/:id", requirePermission("providers", "delete"), deleteProvider);
  
  app.get("/api/admin/providers/skus", requirePermission("providers", "view"), getProviderSkusApi);
  app.post("/api/admin/providers/skus", requirePermission("providers", "create"), createProviderSku);
  app.put("/api/admin/providers/skus/:id", requirePermission("providers", "edit"), updateProviderSku);
  app.delete("/api/admin/providers/skus/:id", requirePermission("providers", "delete"), deleteProviderSku);

  // Admin Catalog Listings
  app.get("/api/admin/catalog/games", requirePermission("games", "view"), getAdminGames);
  app.get("/api/admin/catalog/categories", requirePermission("games", "view"), getAdminCategories);
  app.get("/api/admin/catalog/products", requirePermission("products", "view"), getAdminProducts);
  app.get("/api/admin/catalog/variants", requirePermission("products", "view"), getAdminVariants);

  app.post("/api/admin/providers/mappings", requirePermission("providers", "create"), createProviderMapping);
  app.put("/api/admin/providers/mappings/:id", requirePermission("providers", "edit"), updateProviderMapping);
  app.delete("/api/admin/providers/mappings/:id", requirePermission("providers", "delete"), deleteProviderMapping);
  app.get("/api/admin/providers/mappings", requirePermission("providers", "view"), listMappingsApi);
  app.post("/api/admin/providers/mappings/map", requirePermission("providers", "edit"), mapSkuApi);
  app.post("/api/admin/providers/mappings/suggest", requirePermission("providers", "view"), getProviderMappingSuggestions);
  app.post("/api/admin/providers/mappings/bulk", requirePermission("providers", "create"), bulkCreateProviderMappings);
  app.get("/api/admin/providers/catalog-discovery", requirePermission("providers", "view"), getProviderCatalogDiscovery);
  app.post("/api/admin/providers/catalog-discovery/import", requirePermission("providers", "create"), importFromCatalogDiscovery);
  
  // Supabase Fresh Catalog Sync API (STEP 4.5B)
  app.post("/api/admin/supabase/catalog-sync", requirePermission("providers", "create"), triggerSupabaseCatalogSyncApi);
  
  // Provider SKU Bulk Import Routes
  app.get("/api/admin/providers/:providerId/skus", requirePermission("providers", "view"), getAllProviderSkus);
  app.post("/api/admin/providers/skus/import/validate", requirePermission("providers", "create"), validateBulkImport);
  app.post("/api/admin/providers/skus/import/:sessionId/execute", requirePermission("providers", "create"), commitBulkImport);
  
  // Payment Gateway Routes
  app.get("/api/admin/gateways", requirePermission("gateway", "view"), getAdminGateways);
  app.post("/api/admin/gateways", requirePermission("gateway", "create"), createPaymentGateway);
  app.put("/api/admin/gateways/:id", requirePermission("gateway", "edit"), updatePaymentGateway);
  
  // Inventory & Quota Routes
  app.get("/api/admin/quotas", requirePermission("stock", "quota.manage"), getQuotas);
  app.post("/api/admin/quotas", requirePermission("stock", "quota.manage"), saveQuota);
  app.get("/api/admin/stocks", requirePermission("stock", "view"), getStocks);
  app.get("/api/admin/variants/:variantId/stock", requirePermission("stock", "view"), getVariantStock);
  app.post("/api/admin/variants/:variantId/stock/adjust", requirePermission("stock", "adjust"), adjustStock);
  app.get("/api/admin/variants/:variantId/stock/movements", requirePermission("stock", "view"), getStockMovements);
  app.get("/api/admin/variants/:variantId/reservations", requirePermission("stock", "view"), getReservations);

  // Digital Delivery Routes
  app.get("/api/customer/orders", requireAuth, getCustomerOrdersApi); app.get("/api/customer/profile/:uid", requireAuth, getCustomerProfileApi); app.get("/api/customer/orders/:orderId/delivery", optionalAuth, getCustomerDelivery); // Inside API, we check if customerId matches, wait, optionalAuth won't throw on missing user. So we must use authenticated. Let's create an auth-required version or just check in getCustomerDelivery.
  app.post("/api/customer/games/inquiry", optionalAuth, async (req: any, res: any) => {
    try {
      const { gameCode, userId, zoneId } = req.body || {};
      if (!gameCode || !userId) {
        return res.status(400).json({ isValid: false, username: null, message: "gameCode and userId are required" });
      }

      const result = await performGameAccountInquiry(gameCode, userId, zoneId);
      return res.json(result);
    } catch (error: any) {
      console.error("[Games Inquiry API Error]", error);
      return res.status(500).json({ isValid: false, username: null, message: error.message || "Gagal melakukan inquiry akun" });
    }
  });
  app.get("/api/admin/deliveries", requirePermission("delivery", "view"), getAdminDeliveries);
  app.get("/api/admin/deliveries/:deliveryId", requirePermission("delivery", "view"), getAdminDeliveryDetail);

  // Queue / Job Routes

  // API Games Credential Management
  app.get("/api/admin/providers/apigames/credentials/status", requirePermission("integration", "credentials.view"), getApiGamesCredentialStatus);
  app.put("/api/admin/providers/apigames/credentials", requirePermission("integration", "credentials.manage"), updateApiGamesCredentials);
  app.post("/api/admin/providers/test/apigames", requirePermission("integration", "credentials.test"), testApiGamesConnection);

  // Midtrans Integration Management
  app.get("/api/admin/integrations/midtrans", requirePermission("system", "view"), getMidtransIntegration);
  app.put("/api/admin/integrations/midtrans", requirePermission("system", "edit"), updateMidtransIntegration);
  app.post("/api/admin/integrations/midtrans/test", requirePermission("system", "edit"), testMidtransIntegration);
  app.delete("/api/admin/integrations/midtrans", requirePermission("system", "edit"), removeMidtransIntegration);

  // TokoVoucher Integration Management
  app.get("/api/admin/integrations/tokovoucher", requirePermission("system", "view"), getTokoVoucherIntegration);
  app.put("/api/admin/integrations/tokovoucher", requirePermission("system", "edit"), updateTokoVoucherIntegration);
  app.post("/api/admin/integrations/tokovoucher/test", requirePermission("system", "edit"), testTokoVoucherIntegrationApi);
  app.delete("/api/admin/integrations/tokovoucher", requirePermission("system", "edit"), removeTokoVoucherIntegration);

  // Promo & Voucher Management Routes
  app.get("/api/admin/promos", requirePermission("marketing", "view"), getAdminPromos);
  app.post("/api/admin/promos", requirePermission("marketing", "create"), createAdminPromo);
  app.put("/api/admin/promos/:id", requirePermission("marketing", "edit"), updateAdminPromo);
  app.delete("/api/admin/promos/:id", requirePermission("marketing", "edit"), deleteAdminPromo);

  // Flash Sale Management Routes
  app.get("/api/admin/flash-sales", requirePermission("marketing", "view"), getAdminFlashSales);
  app.post("/api/admin/flash-sales", requirePermission("marketing", "create"), createAdminFlashSale);
  app.put("/api/admin/flash-sales/:id", requirePermission("marketing", "edit"), updateAdminFlashSale);
  app.delete("/api/admin/flash-sales/:id", requirePermission("marketing", "edit"), deleteAdminFlashSale);
  
  // SLA Routes
  app.get("/api/admin/sla/policies", requirePermission("sla", "view"), getSLAPolicies);
  app.post("/api/admin/sla/policies", requirePermission("sla", "create"), createSLAPolicy);
  app.put("/api/admin/sla/policies/:id", requirePermission("sla", "edit"), updateSLAPolicy);
  app.delete("/api/admin/sla/policies/:id", requirePermission("sla", "edit"), deleteSLAPolicy);
  app.get("/api/admin/sla/monitor", requirePermission("sla", "view"), getSLAMonitor);
  app.get("/api/admin/sla/orders/:orderId", requirePermission("sla", "view"), getOrderSLADetail);

  // Business Calendar Routes
  app.get("/api/admin/calendar/config", requirePermission("calendar", "view"), getCalendarConfig);
  app.put("/api/admin/calendar/config", requirePermission("calendar", "edit"), updateCalendarConfig);
  app.post("/api/admin/calendar/exceptions", requirePermission("calendar", "create"), upsertCalendarException);
  app.put("/api/admin/calendar/exceptions", requirePermission("calendar", "edit"), upsertCalendarException);
  app.delete("/api/admin/calendar/exceptions/:id", requirePermission("calendar", "delete"), deleteCalendarException);
  app.get("/api/admin/calendar/preview", requirePermission("calendar", "view"), getCalendarPreview);

  // Customer Loyalty API
  app.get("/api/customer/points", optionalAuth, getCustomerPointsInfo);

  // Public Reward API
  app.get("/api/rewards", getPublicRewards);

  // Customer Reward API
  app.get("/api/customer/rewards/redemptions", optionalAuth, getCustomerRedemptionsApi);
  app.post("/api/customer/rewards/redeem", optionalAuth, redeemCustomerReward);

  // Admin Loyalty Management Routes
  app.get("/api/admin/loyalty/config", requirePermission("marketing", "view"), getLoyaltyConfigAdmin);
  app.put("/api/admin/loyalty/config", requirePermission("marketing", "edit"), updateLoyaltyConfigAdmin);
  app.get("/api/admin/loyalty/transactions", requirePermission("marketing", "view"), getAllLoyaltyTransactionsAdmin);
  app.post("/api/admin/loyalty/adjust", requirePermission("marketing", "edit"), adjustCustomerPointsAdmin);
  
  // Referral APIs (Phase C3)
  app.use("/api/referral", referralApi);
  app.use("/api/admin/referral", adminReferralApi);
  app.use("/api/membership", membershipApi);
  app.use("/api/admin/membership", adminMembershipApi);

  // Admin Reward Management Routes
  app.get("/api/admin/rewards", requirePermission("marketing", "view"), getAdminRewards);
  app.post("/api/admin/rewards", requirePermission("marketing", "create"), createAdminReward);
  app.put("/api/admin/rewards/:id", requirePermission("marketing", "edit"), updateAdminReward);
  app.delete("/api/admin/rewards/:id", requirePermission("marketing", "edit"), deleteAdminReward);
  app.get("/api/admin/reward-redemptions", requirePermission("marketing", "view"), getAdminRedemptions);

  // Customer Wishlist API
  app.get("/api/customer/wishlist", optionalAuth, getCustomerWishlist);
  app.post("/api/customer/wishlist", optionalAuth, addToCustomerWishlist);
  app.delete("/api/customer/wishlist/:id", optionalAuth, removeFromCustomerWishlist);

  // Public & Customer Review API
  app.get("/api/products/:productId/reviews", getPublicProductReviews);
  app.post("/api/customer/reviews", optionalAuth, createCustomerReview);

  // Admin Review Management Routes
  app.get("/api/admin/reviews", requirePermission("marketing", "view"), getAdminReviewsApi);
  app.put("/api/admin/reviews/:id/status", requirePermission("marketing", "edit"), updateAdminReviewStatusApi);
  app.delete("/api/admin/reviews/:id", requirePermission("marketing", "edit"), deleteAdminReviewApi);

  // Admin Media Library Routes
  app.get("/api/admin/media", requirePermission("content", "view"), getMediaLibraryApi);
  app.post("/api/admin/media", requirePermission("content", "create"), uploadMiddleware, uploadMediaApi);
  app.put("/api/admin/media/:id", requirePermission("content", "edit"), updateMediaMetadataApi);
  app.delete("/api/admin/media/:id", requirePermission("content", "delete"), deleteMediaApi);

  // Public & Admin Banner Routes
  app.get("/api/public/banners", getPublicBannersApi);
  app.get("/api/admin/banners", requirePermission("content", "view"), getAdminBannersApi);
  app.post("/api/admin/banners", requirePermission("content", "create"), createBannerApi);
  app.put("/api/admin/banners/:id", requirePermission("content", "edit"), updateBannerApi);
  app.delete("/api/admin/banners/:id", requirePermission("content", "delete"), deleteBannerApi);

  // Public & Admin Popup Routes
  app.get("/api/public/popups", getPublicPopupsApi);
  app.get("/api/admin/popups", requirePermission("content", "view"), getAdminPopupsApi);
  app.post("/api/admin/popups", requirePermission("content", "create"), createPopupApi);
  app.put("/api/admin/popups/:id", requirePermission("content", "edit"), updatePopupApi);
  app.delete("/api/admin/popups/:id", requirePermission("content", "delete"), deletePopupApi);

  // Public & Admin Campaign Routes
  app.get("/api/public/campaigns", getPublicCampaignsApi);
  app.get("/api/public/campaigns/:id", getPublicCampaignDetailApi);
  app.get("/api/admin/campaigns", requirePermission("marketing", "view"), getAdminCampaignsApi);
  app.get("/api/admin/campaigns/components-data", requirePermission("marketing", "view"), getCampaignComponentsDataApi);
  app.post("/api/admin/campaigns", requirePermission("marketing", "create"), createCampaignApi);
  app.put("/api/admin/campaigns/:id", requirePermission("marketing", "edit"), updateCampaignApi);
  app.post("/api/admin/campaigns/:id/archive", requirePermission("marketing", "edit"), archiveCampaignApi);
  app.delete("/api/admin/campaigns/:id", requirePermission("marketing", "delete"), deleteCampaignApi);

  // Marketing & Konten - Landing Pages
  app.get("/api/public/landings", getPublicLandingsApi);
  app.get("/api/public/landings/:slug", getPublicLandingPageApi);
  app.get("/api/admin/landings", requirePermission("content", "view"), getAdminLandingPagesApi);
  app.get("/api/admin/landings/components-data", requirePermission("content", "view"), getAdminLandingComponentsApi);
  app.get("/api/admin/landings/:id/preview", requirePermission("content", "view"), getAdminLandingPagePreviewApi);
  app.get("/api/admin/landings/:id", requirePermission("content", "view"), getAdminLandingPageByIdApi);
  app.post("/api/admin/landings", requirePermission("content", "create"), createLandingPageApi);
  app.put("/api/admin/landings/:id", requirePermission("content", "edit"), updateLandingPageApi);
  app.post("/api/admin/landings/:id/publish", requirePermission("content", "edit"), publishLandingPageApi);
  app.post("/api/admin/landings/:id/archive", requirePermission("content", "edit"), archiveLandingPageApi);
  app.delete("/api/admin/landings/:id", requirePermission("content", "delete"), deleteLandingPageApi);

  // Marketing & Konten - Blog & Berita
  app.get("/api/public/blog", getPublicBlogsApi);
  app.get("/api/public/blog/:slug", getPublicBlogBySlugApi);
  app.get("/api/admin/blog", requirePermission("content", "view"), getAdminBlogsApi);
  app.get("/api/admin/blog/components-data", requirePermission("content", "view"), getAdminBlogComponentsApi);
  app.get("/api/admin/blog/:id/preview", requirePermission("content", "view"), getAdminBlogPreviewApi);
  app.get("/api/admin/blog/:id", requirePermission("content", "view"), getAdminBlogByIdApi);
  app.post("/api/admin/blog", requirePermission("content", "create"), createBlogApi);
  app.put("/api/admin/blog/:id", requirePermission("content", "edit"), updateBlogApi);
  app.post("/api/admin/blog/:id/publish", requirePermission("content", "edit"), publishBlogApi);
  app.post("/api/admin/blog/:id/archive", requirePermission("content", "edit"), archiveBlogApi);
  app.delete("/api/admin/blog/:id", requirePermission("content", "delete"), deleteBlogApi);

  // Marketing & Konten - FAQ
  app.get("/api/public/faq", getPublicFaqsApi);
  app.get("/api/public/faq/:id", getPublicFaqByIdApi);
  app.get("/api/admin/faq", requirePermission("faq", "view"), getAdminFaqsApi);
  app.get("/api/admin/faq/components-data", requirePermission("faq", "view"), getAdminFaqComponentsApi);
  app.get("/api/admin/faq/:id", requirePermission("faq", "view"), getAdminFaqByIdApi);
  app.post("/api/admin/faq", requirePermission("faq", "create"), createFaqApi);
  app.put("/api/admin/faq/:id", requirePermission("faq", "edit"), updateFaqApi);
  app.post("/api/admin/faq/:id/publish", requirePermission("faq", "publish"), publishFaqApi);
  app.post("/api/admin/faq/:id/toggle", requirePermission("faq", "edit"), toggleEnableFaqApi);
  app.post("/api/admin/faq/:id/archive", requirePermission("faq", "archive"), archiveFaqApi);
  app.post("/api/admin/faq/reorder", requirePermission("faq", "edit"), reorderFaqsApi);
  app.delete("/api/admin/faq/:id", requirePermission("faq", "delete"), deleteFaqApi);

  // Configuration Routes
  app.get("/api/admin/store-config", requirePermission("settings", "view"), getStoreConfig);
  app.put("/api/admin/store-config", requirePermission("settings", "edit"), updateStoreConfig);
  app.get("/api/admin/system-config/overview", requirePermission("settings", "view"), getSystemConfigOverview);
  app.get("/api/admin/system-config", requirePermission("settings", "view"), getSystemConfigs);
  app.put("/api/admin/system-config/:key", requirePermission("settings", "edit"), updateSystemConfig);
  app.get("/api/admin/feature-flags", requirePermission("settings", "view"), getAdminFeatureFlags);
  app.put("/api/admin/feature-flags", requirePermission("settings", "edit"), updateAdminFeatureFlags);

  // Backup & Recovery
  // app.get("/api/admin/backup/status", requirePermission("system", "view"), getAdminBackupStatusApi);
  // app.post("/api/admin/backup/trigger", requirePermission("system", "edit"), triggerAdminBackupApi);

  // Marketing & Konten - SEO, Robots.txt & Sitemap
  app.get("/robots.txt", getRobotsTxt);
  app.get("/sitemap.xml", getSitemapXml);
  app.get("/api/public/store-config", getPublicStoreConfig);
  app.get("/api/public/config/midtrans", getPublicMidtransConfig);
  app.get("/api/public/seo", getPublicSEOSettings);
  app.get("/api/admin/seo", requirePermission("seo", "view"), getAdminSEOSettings);
  app.put("/api/admin/seo", requirePermission("seo", "edit"), updateAdminSEOSettings);
  app.post("/api/admin/seo/reset", requirePermission("seo", "edit"), resetAdminSEOSettings);

  // Privacy & Legal APIs
  app.get("/api/public/privacy", getPublicPrivacyApi);
  app.get("/api/admin/privacy", requirePermission("settings", "view"), getAdminPrivacyApi);
  app.put("/api/admin/privacy", requirePermission("settings", "edit"), updateAdminPrivacyApi);
  app.post("/api/admin/privacy/reset", requirePermission("settings", "edit"), resetAdminPrivacyApi);

  // Notification APIs
  app.get("/api/customer/notifications", optionalAuth, getCustomerNotifications);
  app.post("/api/customer/notifications/:id/read", optionalAuth, markNotificationRead);
  app.post("/api/customer/notifications/mark-all-read", optionalAuth, markAllNotificationsRead);
  
  app.get("/api/admin/notifications", requirePermission("notifications", "view"), getAdminNotifications);
  app.post("/api/admin/notifications/:id/read", requirePermission("notifications", "edit"), markNotificationRead);
  app.post("/api/admin/notifications/mark-all-read", requirePermission("notifications", "edit"), markAllNotificationsRead);
  
  app.get("/api/admin/notification-settings", requirePermission("notifications", "view"), getAdminNotificationSettings);
  app.put("/api/admin/notification-settings", requirePermission("notifications", "edit"), updateAdminNotificationSettings);

  // System Health API
  app.get("/api/admin/health", requirePermission("health", "view"), getSystemHealth);

  // Incident Management API
  app.get("/api/admin/incidents", requirePermission("incidents", "view"), getAdminIncidents);
  app.post("/api/admin/incidents/:id/acknowledge", requirePermission("incidents", "manage"), acknowledgeIncidentApi);
  app.post("/api/admin/incidents/:id/assign", requirePermission("incidents", "manage"), assignIncidentApi);
  app.post("/api/admin/incidents/:id/resolve", requirePermission("incidents", "manage"), resolveIncidentApi);
  app.post("/api/admin/incidents/:id/close", requirePermission("incidents", "manage"), closeIncidentApi);

  isServerInitialized = true;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // SPA fallback
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/assets")) {
      return next();
    }
    res.sendFile(path.join("/app/applet/dist", "index.html"));
  });

  // Only open long-running HTTP server when not in Vercel Serverless environment
  if (process.env.VERCEL !== "1") {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });

    // Run async migrations and background workers after server is listening
    migrateInitialRoles().catch(err => console.warn("[Startup] Initial roles migration warning:", err?.message || err));

    // Initialize Background Worker
    import("./src/server/job-service.js")
      .then(({ JobService }) => {
        const jobService = JobService.getInstance();

        // Graceful Shutdown
        const shutdown = () => {
          console.log("[Server] Received shutdown signal. Cleaning up...");
          // if () clearInterval();
          server.close(() => {
            console.log("[Server] Closed HTTP server.");
            process.exit(0);
          });
        };

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
      })
      .catch(err => console.warn("[Startup] Job worker init warning:", err?.message || err));
  }
}

export default app;

if (process.env.VERCEL !== "1") {
  initServerLogic().catch(console.error);
}
