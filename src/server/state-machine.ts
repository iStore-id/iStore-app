import { adminDb } from "./firebase-admin";
import { safeRecordPaymentReceived, safeRecordFulfillmentSuccess } from "./ledger-service";
import { LoyaltyService } from "./loyalty-service";
import { NotificationService } from "./notification-service";

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

export async function transitionOrderState(
  orderId: string, 
  newState: 'PAID' | 'EXPIRED' | 'PROCESSING' | 'SUCCESS' | 'FAILED', 
  payload: any = {}, 
  reason: string
) {
   const transitionResult = await adminDb.runTransaction(async (t) => {
      const ref = adminDb.collection("orders").doc(orderId);
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");
      
      const order = snap.data()!;
      
      // Determine logical current state
      let currentState = 'UNKNOWN';
      if (order.paymentStatus === 'pending') currentState = 'PENDING_PAYMENT';
      else if (order.paymentStatus === 'paid' && order.transactionStatus === 'pending') currentState = 'PAID';
      else if (order.transactionStatus === 'processing') currentState = 'PROCESSING';
      else if (order.transactionStatus === 'success') currentState = 'SUCCESS';
      else if (order.transactionStatus === 'failed' || order.paymentStatus === 'failed') currentState = 'FAILED';
      else if (order.paymentStatus === 'expired') currentState = 'EXPIRED';

      // Validation
      if (!VALID_TRANSITIONS[currentState] || !VALID_TRANSITIONS[currentState].includes(newState)) {
         throw new Error(`INVALID_STATE_TRANSITION: Cannot move from ${currentState} to ${newState}. Reason: ${reason}`);
      }

      let dbPaymentStatus = order.paymentStatus;
      let dbTransactionStatus = order.transactionStatus;

      if (newState === 'PAID') { dbPaymentStatus = 'paid'; }
      if (newState === 'EXPIRED') { dbPaymentStatus = 'expired'; dbTransactionStatus = 'expired'; }
      if (newState === 'PROCESSING') { dbTransactionStatus = 'processing'; }
      if (newState === 'SUCCESS') { dbTransactionStatus = 'success'; }
      if (newState === 'FAILED') { dbTransactionStatus = 'failed'; if(dbPaymentStatus === 'pending') dbPaymentStatus = 'failed'; }

      const updateData = {
         ...payload,
         paymentStatus: dbPaymentStatus,
         transactionStatus: dbTransactionStatus,
         updatedAt: new Date().toISOString()
      };

      t.update(ref, updateData);
      
      // Audit log entry within the transaction
      const auditRef = adminDb.collection("auditLogs").doc();
      t.set(auditRef, {
        id: auditRef.id,
        action: "STATE_TRANSITION",
        resource: "orders",
        resourceId: orderId,
        before: { paymentStatus: order.paymentStatus, transactionStatus: order.transactionStatus },
        after: { paymentStatus: dbPaymentStatus, transactionStatus: dbTransactionStatus },
        reason: reason,
        createdAt: new Date().toISOString()
      });

      return { orderBefore: order, updateData };
   });

   const mergedOrderData = {
      ...transitionResult.orderBefore,
      ...transitionResult.updateData
   };
   const userId = mergedOrderData.userId;

   // Post-transaction hook: Notifications
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
            const productSnap = await adminDb.collection("products").doc(mergedOrderData.productId).get();
            if (productSnap.exists && productSnap.data()?.type === 'membership') {
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

   return transitionResult;
}

