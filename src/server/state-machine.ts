import { OrderRepository } from "./supabase/order-repository.js";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { safeRecordPaymentReceived, safeRecordFulfillmentSuccess } from "./ledger-service.js";
import { LoyaltyService } from "./loyalty-service.js";
import { NotificationService } from "./notification-service.js";

const loyaltyService = LoyaltyService.getInstance();
const notificationService = NotificationService.getInstance();

export const VALID_TRANSITIONS: Record<string, string[]> = {
  'PENDING_PAYMENT': ['PAID', 'EXPIRED'],
  'PAID': ['PROCESSING', 'FAILED'], // Failed if provider permanently rejects immediately
  'PROCESSING': ['SUCCESS', 'FAILED'], // FAILED includes timeout/manual abort
  'SUCCESS': [], // Terminal
  'FAILED': [], // Terminal
  'EXPIRED': [] // Terminal
};

function mapRowToDomainOrder(row: any) {
  if (!row) return {};
  return {
    ...row,
    id: row.id,
    invoice: row.invoice,
    userId: row.user_id || row.userId,
    customerData: row.customer_data || row.customerData,
    productId: row.product_id || row.productId,
    productName: row.product_name || row.productName,
    variantId: row.variant_id || row.variantId,
    variantName: row.variant_name || row.variantName,
    providerId: row.provider_id || row.providerId,
    providerSkuId: row.provider_sku_id || row.providerSkuId,
    providerSku: row.provider_sku || row.providerSku,
    routingDecisionCode: row.routing_decision_code || row.routingDecisionCode,
    quantity: row.quantity,
    price: row.price,
    adminFee: row.admin_fee || row.adminFee,
    discount: row.discount,
    totalAmount: row.total_amount || row.totalAmount,
    paymentStatus: row.payment_status || row.paymentStatus,
    transactionStatus: row.transaction_status || row.transactionStatus,
    paymentGatewayCode: row.payment_gateway_code || row.paymentGatewayCode,
    gatewayTransactionId: row.gateway_transaction_id || row.gatewayTransactionId,
    gatewayPaymentType: row.gateway_payment_type || row.gatewayPaymentType,
    gatewayResponse: row.gateway_response || row.gatewayResponse,
    providerReferenceId: row.provider_reference_id || row.providerReferenceId || row.providerReference,
    providerReference: row.provider_reference_id || row.providerReferenceId || row.providerReference,
    serialNumber: row.serial_number || row.serialNumber,
    fulfillmentResponse: row.fulfillment_response || row.fulfillmentResponse,
    failureReason: row.failure_reason || row.failureReason,
    idempotencyKey: row.idempotency_key || row.idempotencyKey,
    paidAt: row.paid_at || row.paidAt,
    fulfilledAt: row.fulfilled_at || row.fulfilledAt,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    promoId: row.promo_id || row.promoId,
    promoSnapshot: row.promo_snapshot || row.promoSnapshot,
    flashSaleSnapshot: row.flash_sale_snapshot || row.flashSaleSnapshot,
    referralCode: row.referral_code || row.referralCode,
    snapToken: row.snap_token || row.snapToken,
    paymentUrl: row.payment_url || row.paymentUrl,
  };
}

export async function transitionOrderState(
  orderId: string, 
  newState: 'PAID' | 'EXPIRED' | 'PROCESSING' | 'SUCCESS' | 'FAILED', 
  payload: any = {}, 
  reason: string
) {
   const orderRepo = OrderRepository.getInstance();

   // Invoke Supabase RPC State Machine (Source of Truth)
   const rpcResult = await orderRepo.transitionOrderState(orderId, newState, payload, reason);

   if (!rpcResult || !rpcResult.success) {
      const errorMsg = rpcResult?.error_message || "UNKNOWN_STATE_TRANSITION_ERROR";
      if (errorMsg === "ORDER_NOT_FOUND") {
         throw new Error("ORDER_NOT_FOUND");
      }
      if (errorMsg === "INVALID_STATE_TRANSITION") {
         throw new Error(`INVALID_STATE_TRANSITION: Cannot move to ${newState}. Reason: ${reason}`);
      }
      throw new Error(`STATE_TRANSITION_FAILED: ${errorMsg}`);
   }

   const orderBefore = mapRowToDomainOrder(rpcResult.order_before);
   const orderAfter = mapRowToDomainOrder(rpcResult.order_after);

   const mergedOrderData = {
      ...orderBefore,
      ...orderAfter,
      ...payload
   };

   const userId = mergedOrderData.userId;

   // Post-transaction hook: Notifications & downstream actions
   if (newState === 'PAID') {
      await notificationService.notifyCustomer(userId, 'PAYMENT_CONFIRMED', 'Pembayaran Diterima', `Pembayaran untuk pesanan ${mergedOrderData.invoice} telah dikonfirmasi.`, {
        relatedEntity: { type: 'ORDER', id: orderId },
        actionUrl: `/transactions/${mergedOrderData.invoice}`,
        idempotencyKey: `payment_paid_${orderId}`
      });

      await safeRecordPaymentReceived(orderId, mergedOrderData, "SYSTEM", { reason });

      try {
         const { JobService } = await import("./job-service");
         const jobService = JobService.getInstance();
         await jobService.enqueue({
            type: 'FULFILLMENT',
            payload: { orderId },
            priority: 'HIGH',
            referenceId: orderId,
            idempotencyKey: `fulfillment_${orderId}`
         });
         console.log(`[Queue] Enqueued fulfillment job for order ${orderId}`);
      } catch (e) {
         console.error("[Queue] Failed to enqueue fulfillment job", e);
      }
   }

   if (newState === 'PROCESSING') {
      await notificationService.notifyCustomer(userId, 'ORDER_PROCESSING', 'Pesanan Diproses', `Pesanan ${mergedOrderData.invoice} sedang diproses oleh sistem.`, {
        relatedEntity: { type: 'ORDER', id: orderId },
        idempotencyKey: `order_processing_${orderId}`
      });
   }

   if (newState === 'SUCCESS') {
      await notificationService.notifyCustomer(userId, 'ORDER_SUCCESS', 'Pesanan Berhasil', `Item digital untuk pesanan ${mergedOrderData.invoice} telah berhasil dikirim.`, {
        relatedEntity: { type: 'ORDER', id: orderId },
        actionUrl: `/transactions/${mergedOrderData.invoice}`,
        severity: 'SUCCESS',
        idempotencyKey: `order_success_${orderId}`
      });

      await safeRecordFulfillmentSuccess(orderId, mergedOrderData, "SYSTEM", { reason });

      try {
         const deliveryService = (await import('./delivery-service')).DeliveryService.getInstance();
         await deliveryService.handleFulfillmentResult(mergedOrderData, true, reason);
      } catch (e) {
         console.error("[Delivery] Failed to record success delivery for order", orderId, e);
      }

      try {
         const inventoryService = (await import('./inventory-service')).InventoryService.getInstance();
         await inventoryService.consumeReservation(orderId);
      } catch (e) {
         console.error("[Inventory] Failed to consume reservation for order", orderId, e);
      }

      try {
         await loyaltyService.awardOrderPoints(orderId, mergedOrderData.userId, mergedOrderData.totalAmount);
      } catch (e) {
         console.error("[Loyalty] Failed to award points for order", orderId, e);
      }

      try {
         const { ReferralService } = await import('./referral-service');
         await ReferralService.getInstance().qualifyReferral(orderId, mergedOrderData);
      } catch (e) {
         console.error("[Referral] Non-blocking failure in referral qualification for order", orderId, e);
      }

      // MEMBERSHIP ACTIVATION ENGINE
      try {
         if (mergedOrderData.productId) {
            const product = await SupabaseCatalogRepository.getInstance().getProduct(mergedOrderData.productId);
            if (product && product.type === 'membership') {
               const { MembershipService } = await import('./membership-service');
               const membershipService = MembershipService.getInstance();
               await membershipService.activateMembership(
                  mergedOrderData.userId,
                  mergedOrderData.variantId, // In membership products, variant usually maps to the Plan
                  'PURCHASE',
                  orderId,
                  `Order Success: ${orderId}`
               );
               console.log(`[Membership] Activated membership for user ${mergedOrderData.userId} via order ${orderId}`);
            }
         }
      } catch (e) {
         console.error("[Membership] Failed to activate membership for order", orderId, e);
      }

      // Commission Accrual Engine (Phase 2: Non-blocking, idempotent consumer of SUCCESS)
      try {
         const { CommissionService } = await import('./commission-service');
         await CommissionService.getInstance().accrueCommissionForOrder(
           orderId, 
           mergedOrderData, 
           { uid: "SYSTEM", email: "system@istore.co.id" }
         );
      } catch (e) {
         console.error("[Commission] Non-blocking failure in commission accrual for order", orderId, e);
      }
   }

   if (newState === 'FAILED') {
      await notificationService.notifyCustomer(userId, 'ORDER_FAILED', 'Pesanan Gagal', `Pesanan ${mergedOrderData.invoice} gagal diproses. Silakan hubungi bantuan.`, {
        relatedEntity: { type: 'ORDER', id: orderId },
        severity: 'ERROR',
        idempotencyKey: `order_failed_${orderId}`
      });

      // Admin alert for failed order
      await notificationService.notifyAdmin('FAILED_ORDER_ALERT', 'Gagal Fulfillment', `Pesanan ${mergedOrderData.invoice} (ID: ${orderId}) gagal diproses. Alasan: ${reason}`, {
        severity: 'CRITICAL',
        relatedEntity: { type: 'ORDER', id: orderId },
        actionUrl: `/admin/orders`
      });

      try {
         const deliveryService = (await import('./delivery-service')).DeliveryService.getInstance();
         await deliveryService.handleFulfillmentResult(mergedOrderData, false, reason);
      } catch (e) {
         console.error("[Delivery] Failed to record failure delivery for order", orderId, e);
      }

      try {
         const inventoryService = (await import('./inventory-service')).InventoryService.getInstance();
         await inventoryService.releaseReservation(orderId);
      } catch (e) {
         console.error("[Inventory] Failed to release reservation for order", orderId, e);
      }
   }

   if (newState === 'EXPIRED') {
      await notificationService.notifyCustomer(userId, 'ORDER_EXPIRED', 'Pesanan Kedaluwarsa', `Batas waktu pembayaran pesanan ${mergedOrderData.invoice} telah habis.`, {
        relatedEntity: { type: 'ORDER', id: orderId },
        idempotencyKey: `order_expired_${orderId}`
      });

      try {
         const inventoryService = (await import('./inventory-service')).InventoryService.getInstance();
         await inventoryService.releaseReservation(orderId);
      } catch (e) {
         console.error("[Inventory] Failed to release reservation for order", orderId, e);
      }
   }

   return {
      orderBefore,
      orderAfter,
      updateData: orderAfter
   };
}


