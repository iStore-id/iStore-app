import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { processCheckout } from "./src/server/order-engine";
import { midtransWebhook, tokovoucherWebhook } from "./src/server/webhooks";
import { optionalAuth, requireAuth, requireAdmin, requirePermission, AuthenticatedRequest } from "./src/server/middleware";
import { createProduct, updateProduct, deactivateProduct, updateUserRole, updateOrderState, getAdminOrders, getDashboardSummary, getAdminOrderDetail, retryOrderFulfillment, createGame, updateGame, deleteGame, createCategory, updateCategory, deleteCategory, createVariant, updateVariant, createProvider, updateProvider, createProviderSku, updateProviderSku, createProviderMapping, updateProviderMapping, getProviderCatalogDiscovery, createPaymentGateway, updatePaymentGateway, getApiGamesCredentialStatus, updateApiGamesCredentials, testApiGamesConnection, createRefund, getAdminRefunds, getMidtransIntegration, updateMidtransIntegration, testMidtransIntegration, removeMidtransIntegration, getTokoVoucherIntegration, updateTokoVoucherIntegration, testTokoVoucherIntegrationApi, removeTokoVoucherIntegration, getAdminPromos, createAdminPromo, updateAdminPromo, deleteAdminPromo, getAdminFlashSales, createAdminFlashSale, updateAdminFlashSale, deleteAdminFlashSale, getProviderMappingSuggestions, bulkCreateProviderMappings, listMappingsApi, mapSkuApi } from "./src/server/admin-api";
import { getStoreConfig, updateStoreConfig, getSystemConfigs, updateSystemConfig, getPublicStoreConfig, getSystemConfigOverview, getPublicMidtransConfig } from "./src/server/config-api";
import { getAdminFeatureFlags, updateAdminFeatureFlags } from "./src/server/feature-flag-api";
import { getAdminBackupStatusApi, triggerAdminBackupApi } from "./src/server/backup-api";
import { getRoles, createRoleApi, updateRoleApi, deleteRoleApi, assignRoleApi, getUserPermissionsApi, checkPermissionApi, getAdminUsersApi, updateProfileApi } from "./src/server/auth-api";
import { getPublicGames, getPublicGameDetail, getPublicVariants, getPublicCategories } from "./src/server/public-catalog-api";
import { createPricingRule, getPricingRules, updatePricingRule, getPriceHistory, previewPriceCalculation, refreshVariantPrice } from "./src/server/pricing-api";
import { reconcileSingleOrder, triggerReconciliationBatch, getReconciliationOverviewApi, getReconciliationRunsApi, getReconciliationRecordsApi, getReconciliationRunDetailApi } from "./src/server/reconciliation-api";
import { getTaxAndFeeConfigApi, updateTaxAndFeeConfigApi } from "./src/server/taxes-api";
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
} from "./src/server/commission-api";
import { importSettlement, getSettlementBatches, getSettlementBatchDetail, verifySettlementBatch, settleSettlementBatch, addBatchAdjustment, addPostSettlementAdjustment, reconcileSettlementAdjustments } from "./src/server/settlement-api";
import { getLoyaltyConfigAdmin, updateLoyaltyConfigAdmin, getAllLoyaltyTransactionsAdmin, adjustCustomerPointsAdmin, getCustomerPointsInfo } from "./src/server/loyalty-api";
import referralApi from "./src/server/referral-api";
import adminReferralApi from "./src/server/admin-referral-api";
import membershipApi from "./src/server/membership-api";
import adminMembershipApi from "./src/server/admin-membership-api";
import { getPublicRewards, redeemCustomerReward, getCustomerRedemptionsApi, getAdminRewards, createAdminReward, updateAdminReward, deleteAdminReward, getAdminRedemptions } from "./src/server/reward-api";
import { getCustomerWishlist, addToCustomerWishlist, removeFromCustomerWishlist } from "./src/server/wishlist-api";
import { getPublicProductReviews, createCustomerReview, getAdminReviewsApi, updateAdminReviewStatusApi, deleteAdminReviewApi } from "./src/server/review-api";
import { getMediaLibraryApi, uploadMediaApi, updateMediaMetadataApi, deleteMediaApi, uploadMiddleware } from "./src/server/media-api";
import { getPublicBannersApi, getAdminBannersApi, createBannerApi, updateBannerApi, deleteBannerApi } from "./src/server/banner-api";
import { getPublicPopupsApi, getAdminPopupsApi, createPopupApi, updatePopupApi, deletePopupApi } from "./src/server/popup-api";
import { getPublicCampaignsApi, getPublicCampaignDetailApi, getAdminCampaignsApi, getCampaignComponentsDataApi, createCampaignApi, updateCampaignApi, archiveCampaignApi, deleteCampaignApi } from "./src/server/campaign-api";
import { getPublicLandingPageApi, getAdminLandingPagesApi, getAdminLandingPageByIdApi, getAdminLandingPagePreviewApi, getAdminLandingComponentsApi, createLandingPageApi, updateLandingPageApi, publishLandingPageApi, archiveLandingPageApi, deleteLandingPageApi } from "./src/server/landing-api";
import { getPublicBlogsApi, getPublicBlogBySlugApi, getAdminBlogsApi, getAdminBlogComponentsApi, getAdminBlogByIdApi, getAdminBlogPreviewApi, createBlogApi, updateBlogApi, publishBlogApi, archiveBlogApi, deleteBlogApi } from "./src/server/blog-api";
import { getPublicFaqsApi, getPublicFaqByIdApi, getAdminFaqsApi, getAdminFaqComponentsApi, getAdminFaqByIdApi, createFaqApi, updateFaqApi, publishFaqApi, toggleEnableFaqApi, archiveFaqApi, reorderFaqsApi, deleteFaqApi } from "./src/server/faq-api";
import { getPublicSEOSettings, getAdminSEOSettings, updateAdminSEOSettings, resetAdminSEOSettings, getRobotsTxt, getSitemapXml } from "./src/server/seo-api";
import { getLedgerEntriesApi, getLedgerOverviewApi, getLedgerEntryDetailApi, exportLedgerCsvApi } from "./src/server/ledger-api";
import { adminDb, ISTORE_PROJECT_ID, ISTORE_FIRESTORE_DATABASE_ID } from "./src/server/firebase-admin";
import { migrateInitialRoles, isOwnerIdentity, OWNER_EMAIL } from "./src/server/auth-service";
import { getQuotas, saveQuota, getVariantStock, adjustStock, getStockMovements, getReservations } from "./src/server/inventory-api";
import { getCustomerDelivery, getAdminDeliveries, getAdminDeliveryDetail } from "./src/server/delivery-api";
import { getAdminJobs, getAdminJobDetail, retryJob, cancelJob, triggerJobWorker } from "./src/server/job-api";
import { getCustomerNotifications, getAdminNotifications, markNotificationRead, markAllNotificationsRead, getAdminNotificationSettings, updateAdminNotificationSettings } from "./src/server/notification-api";
import { getSystemHealth } from "./src/server/health-api";
import { getAdminIncidents, acknowledgeIncidentApi, assignIncidentApi, resolveIncidentApi, closeIncidentApi } from "./src/server/incident-api";
import { 
  getSLAPolicies, createSLAPolicy, updateSLAPolicy, deleteSLAPolicy, 
  getSLAMonitor, getOrderSLADetail 
} from "./src/server/sla-api";
import { 
  getCalendarConfig, updateCalendarConfig, upsertCalendarException, deleteCalendarException, getCalendarPreview 
} from "./src/server/business-calendar-api";
import {
  getPublicPrivacyApi,
  getAdminPrivacyApi,
  updateAdminPrivacyApi,
  resetAdminPrivacyApi
} from "./src/server/privacy-api";
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
} from "./src/server/security-api";
import {
  getAuditLogsApi,
  getAuditMetricsApi,
  getAuditDetailApi,
  exportAuditLogsApi
} from "./src/server/audit-api";
import supportApi from "./src/server/support-api";
import adminSupportApi from "./src/server/admin-support-api";
import {
  getSystemLogsApi,
  getSystemLogMetricsApi,
  getSystemLogDetailApi,
  exportSystemLogsApi,
  emitDiagnosticLogApi
} from "./src/server/system-log-api";
import {
  securityHeadersMiddleware,
  ipFirewallMiddleware,
  rateLimitMiddleware,
  emergencyLockdownMiddleware
} from "./src/server/security-middleware";
import {
  getCustomersDirectoryApi,
  getCustomer360ProfileApi,
  updateCustomerStatusApi,
  addCustomerNoteApi,
  updateCustomerTagsApi,
  unmaskCustomerPiiApi,
  exportCustomersCsvApi
} from "./src/server/customer-api";
import { customerSegmentRouter } from "./src/server/customer-segment-api";
import { validateBulkImport, executeBulkImport, importDiscoveryItems } from "./src/server/provider-import";

dotenv.config();

export const app = express();
const PORT = 3000;

let isServerInitialized = false;

export async function initServerLogic() {
  if (isServerInitialized) return;
  
  app.use(cors());
  app.use(express.json());
  app.use(securityHeadersMiddleware);
  app.use(ipFirewallMiddleware);

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
      const userDocRef = adminDb.collection("users").doc(uid);
      const userDoc = await userDocRef.get();
      let role = isOwner ? "pemilik" : "customer";

      if (userDoc.exists) {
        const existingRole = userDoc.data()?.role;
        if (isOwner) {
          role = "pemilik";
        } else if (existingRole) {
          role = existingRole;
        }
      }

      const userData = {
        uid,
        email: req.user.email || email,
        name: req.user.name || req.body?.name || email.split("@")[0],
        role,
        lastLogin: new Date().toISOString()
      };
      await userDocRef.set(userData, { merge: true });
      res.json({ success: true, role, user: userData });
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
  
  // Pricing APIs
  app.get("/api/admin/pricing/rules", requirePermission("pricing", "view"), getPricingRules);
  app.post("/api/admin/pricing/rules", requirePermission("pricing", "create"), createPricingRule);
  app.put("/api/admin/pricing/rules/:id", requirePermission("pricing", "edit"), updatePricingRule);
  app.get("/api/admin/pricing/history/:variantId", requirePermission("pricing", "view"), getPriceHistory);
  app.post("/api/admin/pricing/preview", requirePermission("pricing", "view"), previewPriceCalculation);
  app.post("/api/admin/pricing/variants/:id/refresh", requirePermission("pricing", "edit"), refreshVariantPrice);
  
  app.get("/api/admin/roles", requirePermission("roles", "view"), getRoles);
  app.post("/api/admin/roles", requirePermission("roles", "create"), createRoleApi);
  app.put("/api/admin/roles/:id", requirePermission("roles", "edit"), updateRoleApi);
  app.delete("/api/admin/roles/:id", requirePermission("roles", "delete"), deleteRoleApi);
  app.get("/api/admin/users", requirePermission("users", "view"), getAdminUsersApi);
  app.post("/api/admin/users/:uid/role", requirePermission("users", "edit"), assignRoleApi);

  // Customer Management APIs (Phase C1: Pengguna / Customer Management Engine)
  app.get("/api/admin/customers", requirePermission("users", "view"), getCustomersDirectoryApi);
  app.get("/api/admin/customers/:id", requirePermission("users", "view"), getCustomer360ProfileApi);
  app.post("/api/admin/customers/:id/status", requirePermission("users", "edit"), updateCustomerStatusApi);
  app.post("/api/admin/customers/:id/notes", requirePermission("users", "edit"), addCustomerNoteApi);
  app.put("/api/admin/customers/:id/tags", requirePermission("users", "edit"), updateCustomerTagsApi);
  app.post("/api/admin/customers/:id/unmask", requirePermission("users", "view"), unmaskCustomerPiiApi);
  app.post("/api/admin/customers/export", requirePermission("users", "export"), exportCustomersCsvApi);

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
  app.post("/api/admin/settlement/import", requirePermission("finance", "edit"), importSettlement);
  app.get("/api/admin/settlement/batches", requirePermission("finance", "view"), getSettlementBatches);
  app.get("/api/admin/settlement/batches/:id", requirePermission("finance", "view"), getSettlementBatchDetail);
  app.post("/api/admin/settlement/batches/:id/verify", requirePermission("finance", "edit"), verifySettlementBatch);
  app.post("/api/admin/settlement/batches/:id/settle", requirePermission("finance", "edit"), settleSettlementBatch);
  app.post("/api/admin/settlement/batches/:id/adjustment", requirePermission("finance", "edit"), addBatchAdjustment);
  app.post("/api/admin/settlement/batches/:id/post-settlement-adjustment", requirePermission("finance", "edit"), addPostSettlementAdjustment);
  app.post("/api/admin/settlement/reconcile-adjustments", requirePermission("finance", "edit"), reconcileSettlementAdjustments);
  
  // Ledger Routes
  app.get("/api/admin/ledger/overview", requirePermission("finance", "view"), getLedgerOverviewApi);
  app.get("/api/admin/ledger/entries", requirePermission("finance", "view"), getLedgerEntriesApi);
  app.get("/api/admin/ledger/export", requirePermission("finance", "export"), exportLedgerCsvApi);
  app.get("/api/admin/ledger/entries/:id", requirePermission("finance", "view"), getLedgerEntryDetailApi);
  
  // Provider Routes
  app.post("/api/admin/providers", requirePermission("providers", "create"), createProvider);
  app.put("/api/admin/providers/:id", requirePermission("providers", "edit"), updateProvider);
  app.post("/api/admin/providers/skus", requirePermission("providers", "create"), createProviderSku);
  app.put("/api/admin/providers/skus/:id", requirePermission("providers", "edit"), updateProviderSku);
  app.post("/api/admin/providers/mappings", requirePermission("providers", "create"), createProviderMapping);
  app.put("/api/admin/providers/mappings/:id", requirePermission("providers", "edit"), updateProviderMapping);
  app.get("/api/admin/providers/mappings", requirePermission("providers", "view"), listMappingsApi);
  app.post("/api/admin/providers/mappings/map", requirePermission("providers", "edit"), mapSkuApi);
  app.post("/api/admin/providers/mappings/suggest", requirePermission("providers", "view"), getProviderMappingSuggestions);
  app.post("/api/admin/providers/mappings/bulk", requirePermission("providers", "create"), bulkCreateProviderMappings);
  app.get("/api/admin/providers/catalog-discovery", requirePermission("providers", "view"), getProviderCatalogDiscovery);
  app.post("/api/admin/providers/catalog-discovery/import", requirePermission("providers", "create"), importDiscoveryItems);
  
  // Provider SKU Bulk Import Routes
  app.post("/api/admin/providers/skus/import/validate", requirePermission("providers", "create"), validateBulkImport);
  app.post("/api/admin/providers/skus/import/:importId/execute", requirePermission("providers", "create"), executeBulkImport);
  
  // Payment Gateway Routes
  app.post("/api/admin/gateways", requirePermission("gateway", "create"), createPaymentGateway);
  app.put("/api/admin/gateways/:id", requirePermission("gateway", "edit"), updatePaymentGateway);
  
  // Inventory & Quota Routes
  app.get("/api/admin/quotas", requirePermission("stock", "quota.manage"), getQuotas);
  app.post("/api/admin/quotas", requirePermission("stock", "quota.manage"), saveQuota);
  app.get("/api/admin/variants/:variantId/stock", requirePermission("stock", "view"), getVariantStock);
  app.post("/api/admin/variants/:variantId/stock/adjust", requirePermission("stock", "adjust"), adjustStock);
  app.get("/api/admin/variants/:variantId/stock/movements", requirePermission("stock", "view"), getStockMovements);
  app.get("/api/admin/variants/:variantId/reservations", requirePermission("stock", "view"), getReservations);

  // Digital Delivery Routes
  app.get("/api/customer/orders/:orderId/delivery", optionalAuth, getCustomerDelivery); // Inside API, we check if customerId matches, wait, optionalAuth won't throw on missing user. So we must use authenticated. Let's create an auth-required version or just check in getCustomerDelivery.
  app.get("/api/admin/deliveries", requirePermission("delivery", "view"), getAdminDeliveries);
  app.get("/api/admin/deliveries/:deliveryId", requirePermission("delivery", "view"), getAdminDeliveryDetail);

  // Queue / Job Routes
  app.get("/api/admin/jobs", requirePermission("queue", "view"), getAdminJobs);
  app.get("/api/admin/jobs/:id", requirePermission("queue", "view"), getAdminJobDetail);
  app.post("/api/admin/jobs/:id/retry", requirePermission("queue", "retry"), retryJob);
  app.post("/api/admin/jobs/:id/cancel", requirePermission("queue", "cancel"), cancelJob);
  app.post("/api/admin/jobs/trigger-worker", requirePermission("queue", "retry"), triggerJobWorker);

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
  app.get("/api/admin/backup/status", requirePermission("system", "view"), getAdminBackupStatusApi);
  app.post("/api/admin/backup/trigger", requirePermission("system", "edit"), triggerAdminBackupApi);

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

  // Run migrations
  await migrateInitialRoles().catch(err => console.error("Migration error:", err));

  // Initialize Background Worker
  const { JobService } = await import("./src/server/job-service");
  const jobService = JobService.getInstance();
  const workerTimer = jobService.startWorkerLoop();

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  isServerInitialized = true;

  // Only open long-running HTTP server when not in Vercel Serverless environment
  if (process.env.VERCEL !== "1") {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful Shutdown
    const shutdown = () => {
      console.log("[Server] Received shutdown signal. Cleaning up...");
      clearInterval(workerTimer);
      server.close(() => {
        console.log("[Server] Closed HTTP server.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}

export default app;

if (process.env.VERCEL !== "1") {
  initServerLogic().catch(console.error);
}
