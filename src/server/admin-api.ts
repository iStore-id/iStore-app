import { Request, Response } from "express";
import { adminDb } from "./firebase-admin";
import { AuthenticatedRequest } from "./middleware";
import { ProviderCatalogDiscoveryService } from "./discovery-service";
import { ProviderMappingService } from "./provider-mapping-service";
import { TokoVoucherDiscoveryAdapter } from "./adapters/tokovoucher-discovery-adapter";
import { ApiGamesDiscoveryAdapter } from "./adapters/apigames-discovery-adapter";
import { CatalogService } from "./catalog-service";
import { ProviderService } from "./provider-service";
import { DateTime } from "luxon";
import { ProviderSku, ProviderMapping, Product, Game, ProductVariant } from "../types/core";

const discoveryService = new ProviderCatalogDiscoveryService();
discoveryService.registerAdapter(new TokoVoucherDiscoveryAdapter());
discoveryService.registerAdapter(new ApiGamesDiscoveryAdapter());

// ... (existing exports)

export async function getProviderCatalogDiscovery(req: AuthenticatedRequest, res: Response) {
  try {
    const { provider, code } = req.query;
    if (!provider || typeof provider !== "string") {
      return res.status(400).json({ success: false, message: "Provider required" });
    }
    const results = await discoveryService.discover(provider, code as string);
    await logAudit(req, "PROVIDER_CATALOG_DISCOVERY", "providers", provider, { code, count: results.length });
    return res.status(200).json({ success: true, data: results });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
import { PaymentGatewayService } from "./payment-gateway-service";
import { refundMidtransTransaction } from "./midtrans";
import crypto from "crypto";
import { transitionOrderState } from "./state-machine";
import { dispatchFulfillment } from "./fulfillment-dispatcher";
import { safeRecordRefundExecuted, getOrderSettlementContext } from "./ledger-service";
import { PromoService } from "./promo-service";
import { FlashSaleService } from "./flash-sale-service";
import { BusinessCalendarService } from "./business-calendar-service";
import { JobService } from "./job-service";
import { NotificationService } from "./notification-service";

const catalogService = CatalogService.getInstance();
const providerService = ProviderService.getInstance();
const paymentGatewayService = PaymentGatewayService.getInstance();
const promoService = PromoService.getInstance();
const flashSaleService = FlashSaleService.getInstance();
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
  const auditRef = adminDb.collection("auditLogs").doc();
  await auditRef.set({
    id: auditRef.id,
    adminUid: req.user.uid,
    action,
    resource,
    resourceId,
    payload,
    ip: req.ip || "",
    createdAt: new Date().toISOString()
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
    const ref = adminDb.collection("products").doc(id);
    await ref.update({ status: "inactive", updatedAt: new Date().toISOString() });
    
    await logAudit(req, "DEACTIVATE_PRODUCT", "products", id, { status: "inactive" });
    return res.status(200).json({ success: true, message: "Product deactivated" });
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

    const ref = adminDb.collection("users").doc(id);
    await ref.update({ role, updatedAt: new Date().toISOString() });
    
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
    const refundsSnap = await adminDb.collection("refunds")
      .orderBy("createdAt", "desc")
      .limit(parseInt(limit as string) || 100)
      .get();
    const refunds = refundsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
import { getApiGamesServerConfig } from "./providers";

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

    const snap = await adminDb.collection("systemConfigs").where("key", "==", "apigames_integration").limit(1).get();
    let existingData: any = {};
    let docRef = snap.empty ? adminDb.collection("systemConfigs").doc() : snap.docs[0].ref;
    if (!snap.empty) {
      existingData = snap.docs[0].data();
    }

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

    await docRef.set(newData, { merge: true });

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
      transactionResult = await adminDb.runTransaction(async (transaction) => {
        const refundRef = adminDb.collection("refunds").doc(refundKey);
        const refundSnap = await transaction.get(refundRef);

        if (refundSnap.exists) {
          const existingData = refundSnap.data();
          if (existingData?.status === "SUCCEEDED") {
            return {
              isIdempotentSuccess: true,
              data: existingData
            };
          } else if (existingData?.status === "PROCESSING" || existingData?.status === "PENDING") {
            throw new Error("REFUND_ALREADY_PROCESSING");
          } else {
            throw new Error("REFUND_ALREADY_EXISTS_WITH_FAILED_STATUS");
          }
        }

        const orderRef = adminDb.collection("orders").doc(orderId);
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists) {
          throw new Error("ORDER_NOT_FOUND");
        }

        const orderData = orderSnap.data();
        const paymentStatus = orderData?.paymentStatus?.toLowerCase();
        
        if (paymentStatus !== "paid" && paymentStatus !== "success") {
          throw new Error("ORDER_NOT_PAID");
        }

        const totalAmount = orderData?.totalAmount || 0;

        const refundsQuery = adminDb.collection("refunds").where("orderId", "==", orderId);
        const refundsSnap = await transaction.get(refundsQuery);

        let totalRefunded = 0;
        refundsSnap.forEach((doc) => {
          const rData = doc.data();
          if (rData.status !== "FAILED") {
            totalRefunded += rData.amount || 0;
          }
        });

        const remainingRefundable = totalAmount - totalRefunded;
        if (amount > remainingRefundable) {
          throw new Error("REFUND_AMOUNT_EXCEEDS_REMAINING_BALANCE");
        }

        const refundDoc = {
          id: refundKey,
          refundId: refundKey,
          orderId,
          refundKey,
          amount,
          currency: "IDR",
          reason,
          status: "PROCESSING",
          provider: "midtrans",
          requestedBy: req.user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        transaction.set(refundRef, refundDoc);
        return {
          isIdempotentSuccess: false,
          data: refundDoc,
          orderInfo: {
            userId: orderData.userId,
            invoice: orderData.invoice
          }
        };
      });
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

    const { userId, invoice } = (transactionResult as any).orderInfo;

    // Notify customer: REFUND_PROCESSING
    await notificationService.notifyCustomer(userId, 'REFUND_PROCESSING', 'Refund Sedang Diproses', `Permintaan pengembalian dana untuk pesanan ${invoice} sedang diproses.`, {
      relatedEntity: { type: 'REFUND', id: refundKey },
      idempotencyKey: `refund_proc_${refundKey}`
    });

    try {
      const midtransRes = await refundMidtransTransaction({
        orderId,
        refundKey,
        amount,
        reason
      });

      const providerRefundId = midtransRes.refund_id || midtransRes.id || null;

      await adminDb.collection("refunds").doc(refundKey).update({
        status: "SUCCEEDED",
        providerRefundId,
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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

      // Post-commit Commission Hook (Phase 4: Refund & Clawback)
      // Executes only after refund status is persisted as SUCCEEDED
      try {
        const { CommissionService } = await import("./commission-service");
        await CommissionService.getInstance().handleOrderRefund(
          orderId,
          refundKey,
          amount,
          { uid: req.user?.uid || "ADMIN", email: req.user?.email || "admin@istore.co.id" }
        );
      } catch (commErr) {
        console.error(`[Commission Refund Hook Error] Failed to handle commission clawback for order ${orderId}, refund ${refundKey}:`, commErr);
      }

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

        await adminDb.collection("refunds").doc(refundKey).update({
          status: "FAILED",
          failureCode,
          failureMessage,
          updatedAt: new Date().toISOString()
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
import { getMidtransServerConfig, encryptSecret, decryptSecret, testMidtransConnection } from "./midtrans";
import { getTokoVoucherServerConfig, testTokoVoucherConnection } from "./providers";
import { logCoreAudit } from "./core-service";

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
    const { merchantId, serverKey, clientKey, isProduction } = req.body;
    const actor = {
      uid: req.user.uid,
      email: req.user.email || req.user.uid
    };
    const role = req.user.role || "pemilik";

    const snap = await adminDb.collection("systemConfigs").where("key", "==", "midtrans_integration").limit(1).get();
    
    let existingData: any = {};
    let docRef = snap.empty ? adminDb.collection("systemConfigs").doc() : snap.docs[0].ref;
    if (!snap.empty) {
      existingData = snap.docs[0].data();
    }

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
      lastTestedAt: existingData.lastTestedAt || null,
      lastTestResult: existingData.lastTestResult || null,
      updatedBy: actor.uid,
      updatedAt: now,
      createdAt: existingData.createdAt || now
    };

    await docRef.set(newData, { merge: true });

    if (serverKey && !serverKey.includes("****")) {
      process.env.MIDTRANS_SERVER_KEY = serverKey.trim();
    }
    process.env.MIDTRANS_MERCHANT_ID = newData.merchantId;
    process.env.MIDTRANS_IS_PRODUCTION = newData.isProduction ? "true" : "false";

    await logCoreAudit(actor, role, "UPDATE_MIDTRANS_INTEGRATION", "systemConfigs/midtrans_integration", {
      merchantId: existingData.merchantId ? "****" : null,
      isProduction: existingData.isProduction
    }, {
      merchantId: newData.merchantId ? "****" : null,
      isProduction: newData.isProduction
    }, "Updated Midtrans configuration");

    const serverKeyMasked = newData.encryptedServerKey ? "SB-Mid-****..." : "";

    return res.status(200).json({
      success: true,
      message: "Konfigurasi Midtrans berhasil disimpan.",
      data: {
        merchantId: newData.merchantId,
        isProduction: newData.isProduction,
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

    const snap = await adminDb.collection("systemConfigs").where("key", "==", "midtrans_integration").limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({
        lastTestedAt: now,
        lastTestResult: testResult.success ? "SUCCESS" : "FAILED",
        lastTestMessage: testResult.message
      });
    }

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

    const snap = await adminDb.collection("systemConfigs").where("key", "==", "midtrans_integration").limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.delete();
    }

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
    const snap = await adminDb.collection("systemConfigs").where("key", "==", "tokovoucher_integration").limit(1).get();
    let data: any = {};
    if (!snap.empty) {
      data = snap.docs[0].data();
    }
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

    const snap = await adminDb.collection("systemConfigs").where("key", "==", "tokovoucher_integration").limit(1).get();
    let existingData: any = {};
    let docRef = snap.empty ? adminDb.collection("systemConfigs").doc() : snap.docs[0].ref;
    if (!snap.empty) {
      existingData = snap.docs[0].data();
    }

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

    await docRef.set(newData, { merge: true });

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

    const snap = await adminDb.collection("systemConfigs").where("key", "==", "tokovoucher_integration").limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({
        lastTestedAt: now,
        lastTestResult: testResult.success ? "SUCCESS" : "FAILED",
        lastTestMessage: testResult.message,
        memberName: testResult.data?.memberName || null,
        balance: testResult.data?.balance !== undefined ? testResult.data.balance : null,
        lastChecked: now
      });
    }

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

    const snap = await adminDb.collection("systemConfigs").where("key", "==", "tokovoucher_integration").limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.delete();
    }

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
      
      // Order Stats
      const ordersCountSnap = await adminDb.collection("orders")
        .where("createdAt", ">=", startIso)
        .where("createdAt", "<", endIso)
        .count()
        .get();
      const totalOrders = ordersCountSnap.data().count;
      
      // Financial Metrics (Authoritative from Ledger)
      const grossSnap = await adminDb.collection("ledgerJournalEntries")
        .where("eventType", "==", "PAYMENT_RECEIVED")
        .where("createdAt", ">=", startIso)
        .where("createdAt", "<", endIso)
        .get();
      let grossRevenue = 0;
      grossSnap.docs.forEach(doc => grossRevenue += (doc.data().totalAmount || 0));

      const realizedSnap = await adminDb.collection("ledgerJournalEntries")
        .where("eventType", "==", "FULFILLMENT_SUCCESS")
        .where("createdAt", ">=", startIso)
        .where("createdAt", "<", endIso)
        .get();
      let realizedRevenue = 0;
      realizedSnap.docs.forEach(doc => realizedRevenue += (doc.data().totalAmount || 0));

      const refundSnap = await adminDb.collection("ledgerJournalEntries")
        .where("eventType", "==", "REFUND_EXECUTED")
        .where("createdAt", ">=", startIso)
        .where("createdAt", "<", endIso)
        .get();
      let refundTotal = 0;
      refundSnap.docs.forEach(doc => refundTotal += (doc.data().totalAmount || 0));

      const settlementSnap = await adminDb.collection("ledgerJournalEntries")
        .where("eventType", "==", "SETTLEMENT_CLOSED")
        .where("createdAt", ">=", startIso)
        .where("createdAt", "<", endIso)
        .get();
      let totalSettled = 0;
      let totalMdr = 0;
      settlementSnap.docs.forEach(doc => {
        const data = doc.data();
        const netItem = data.lineItems.find((l: any) => l.accountId === "1100");
        const mdrItem = data.lineItems.find((l: any) => l.accountId === "5000");
        if (netItem) totalSettled += netItem.debit;
        if (mdrItem) totalMdr += mdrItem.debit;
      });

      // Operational Latency (Jobs) - Successful fulfillment only
      const jobsSnap = await adminDb.collection("jobs")
        .where("type", "==", "FULFILLMENT")
        .where("status", "==", "SUCCEEDED")
        .where("createdAt", ">=", startIso)
        .where("createdAt", "<", endIso)
        .get();
      const successfulJobs = jobsSnap.docs.map(doc => doc.data());
      
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
        grossRevenue,
        realizedRevenue,
        refundTotal,
        totalSettled,
        totalMdr,
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

    const queueDepth = await adminDb.collection("jobs")
      .where("status", "in", ["QUEUED", "RETRYING"])
      .count().get().then(s => s.data().count);

    const activeWorkers = await adminDb.collection("jobs")
      .where("status", "==", "PROCESSING")
      .count().get().then(s => s.data().count);

    const totalCustomers = await adminDb.collection("users").count().get().then(s => s.data().count);

    const recentOrdersSnap = await adminDb.collection("orders")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    
    const recentOrders = recentOrdersSnap.docs.map(doc => {
      const data = { id: doc.id, ...doc.data() as any };
      return {
        id: data.id,
        invoice: data.invoice,
        productName: data.productName,
        gameName: data.gameName,
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
    let queryRef: FirebaseFirestore.Query = adminDb.collection("orders").orderBy("createdAt", "desc");

    if (paymentStatus && paymentStatus !== "all") {
      queryRef = queryRef.where("paymentStatus", "==", paymentStatus);
    }
    if (transactionStatus && transactionStatus !== "all") {
      queryRef = queryRef.where("transactionStatus", "==", transactionStatus);
    }

    const snap = await queryRef.limit(parseInt(limit as string) || 50).get();
    let orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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

    return res.status(200).json({ success: true, data: orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminOrderDetail(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orderRef = adminDb.collection("orders").doc(id);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderData = { id: orderSnap.id, ...orderSnap.data() };

    const auditSnap = await adminDb.collection("auditLogs").where("resourceId", "==", id).get();
    const auditLogs = auditSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const refundSnap = await adminDb.collection("refunds").where("orderId", "==", id).get();
    const refunds = refundSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
    const orderRef = adminDb.collection("orders").doc(id);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const orderData = orderSnap.data()!;
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

    // 1. Fetch providerSkus
    let skusQuery: any = adminDb.collection("providerSkus").where("providerId", "==", providerId);
    let skusSnap = await skusQuery.get();
    let skus = skusSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ProviderSku));

    if (providerSkuIds && Array.isArray(providerSkuIds) && providerSkuIds.length > 0) {
      const idSet = new Set(providerSkuIds);
      skus = skus.filter(s => idSet.has(s.id!));
    }

    if (skus.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 2. Fetch all variants, products, games for reference
    const [variantsSnap, productsSnap, gamesSnap] = await Promise.all([
      adminDb.collection("productVariants").get(),
      adminDb.collection("products").get(),
      adminDb.collection("games").get()
    ]);

    const variants = variantsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ProductVariant));
    const products = productsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Product));
    const games = gamesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Game));

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
        const hasGameMatch = skuNameNorm.includes(gameNameNorm) || 
                             gameNameNorm.includes(skuNameNorm) ||
                             (game.searchKeywords && game.searchKeywords.some(kw => skuNameNorm.includes(normalizeString(kw))));

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

    const providerSnap = await adminDb.collection("providers").doc(providerId).get();
    if (!providerSnap.exists) {
      return res.status(404).json({ success: false, message: "Provider tidak ditemukan." });
    }

    await logAudit(req, "PROVIDER_BULK_MAPPING_STARTED", "providerMappings", providerId, {
      providerId,
      itemCount: mappings.length,
      mode
    });

    const existingMappingsSnap = await adminDb.collection("providerMappings")
      .where("providerId", "==", providerId)
      .get();

    const existingMap = new Map<string, { id: string, data: any }>();
    existingMappingsSnap.forEach(doc => {
      const data = doc.data();
      if (data.variantId && data.providerSkuId) {
        existingMap.set(`${data.variantId}_${data.providerSkuId}`, { id: doc.id, data });
      }
    });

    const variantIds = mappings.map(m => m.variantId).filter(Boolean);
    const skuIds = mappings.map(m => m.providerSkuId).filter(Boolean);

    if (variantIds.length === 0 || skuIds.length === 0) {
      return res.status(400).json({ success: false, message: "variantId dan providerSkuId wajib disertakan pada semua entitas." });
    }

    const [variantsSnap, skusSnap] = await Promise.all([
      adminDb.collection("productVariants").get(),
      adminDb.collection("providerSkus").where("providerId", "==", providerId).get()
    ]);

    const variantsMap = new Map<string, any>();
    variantsSnap.forEach(doc => {
      variantsMap.set(doc.id, doc.data());
    });

    const skusMap = new Map<string, any>();
    skusSnap.forEach(doc => {
      skusMap.set(doc.id, doc.data());
    });

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const timestamp = new Date().toISOString();
    const batchSize = 100;
    let currentBatch = adminDb.batch();
    let opCounter = 0;

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
          const updateRef = adminDb.collection("providerMappings").doc(existingInfo.id);
          currentBatch.update(updateRef, {
            priority: typeof priority === "number" ? priority : existingInfo.data.priority,
            status: status || existingInfo.data.status,
            routingEligibility: typeof routingEligibility === "boolean" ? routingEligibility : existingInfo.data.routingEligibility,
            notes: notes !== undefined ? notes : (existingInfo.data.notes || ""),
            metadata: metadata !== undefined ? metadata : (existingInfo.data.metadata || {}),
            updatedAt: timestamp,
            updatedBy: req.user.uid
          });
          successCount++;
          opCounter++;
        }
      } else {
        const createRef = adminDb.collection("providerMappings").doc();
        const newMapping: ProviderMapping = {
          id: createRef.id,
          productId: variantData.productId || "",
          variantId,
          sku: variantData.sku || "",
          providerId,
          providerSkuId,
          providerSku: skuData.providerSku,
          status: status || "active",
          priority: typeof priority === "number" ? priority : 0,
          routingEligibility: typeof routingEligibility === "boolean" ? routingEligibility : true,
          notes: notes || "",
          metadata: metadata || {},
          createdAt: timestamp,
          updatedAt: timestamp,
          updatedBy: req.user.uid
        };
        currentBatch.set(createRef, newMapping);
        successCount++;
        opCounter++;
        existingMap.set(key, { id: createRef.id, data: newMapping });
      }

      if (opCounter >= batchSize) {
        await currentBatch.commit();
        currentBatch = adminDb.batch();
        opCounter = 0;
      }
    }

    if (opCounter > 0) {
      await currentBatch.commit();
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
    const { providerId, status, pageSize, lastDoc } = req.query;
    const result = await mappingService.listMappings(
      providerId as string, 
      (status as any) || 'ALL', 
      1, 
      parseInt(pageSize as string) || 20, 
      lastDoc ? JSON.parse(lastDoc as string) : undefined
    );
    return res.status(200).json({ success: true, data: result });
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



