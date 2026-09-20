import { transitionOrderState } from "./state-machine.js";
import { OrderRepository } from "./supabase/order-repository.js";
import { ProviderService } from "./provider-service.js";
import { getProvider } from "./providers.js";
import { logSystem } from "./system-log-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";

export async function dispatchFulfillment(orderId: string): Promise<void> {
  console.log(`[Fulfillment Dispatcher] Initiating fulfillment process for order: ${orderId}`);
  logSystem("INFO", "FULFILLMENT", "FULFILLMENT_DISPATCH_STARTED", `Memulai proses dispatch pemenuhan untuk pesanan ${orderId}`, "fulfillment-dispatcher", {
    orderId,
    outcome: "PENDING"
  });

  // 1. Read order from Supabase
  const orderRepo = OrderRepository.getInstance();
  const orderData = await orderRepo.getOrderById(orderId);
  if (!orderData) {
    console.error(`[Fulfillment Dispatcher] Order not found in database: ${orderId}`);
    logSystem("ERROR", "FULFILLMENT", "ORDER_NOT_FOUND", `Order tidak ditemukan saat dispatch: ${orderId}`, "fulfillment-dispatcher", {
      orderId,
      outcome: "FAILURE"
    });
    return;
  }

  // 2. Validate if eligible for fulfillment claim
  // Only orders in 'paid' status and not yet processed (transactionStatus 'pending') are eligible
  const currentPaymentStatus = orderData.paymentStatus;
  const currentTransactionStatus = orderData.transactionStatus || 'pending';

  if (currentPaymentStatus !== 'paid') {
    console.warn(`[Fulfillment Dispatcher] Order ${orderId} has paymentStatus '${currentPaymentStatus}', aborting fulfillment.`);
    return;
  }

  if (currentTransactionStatus !== 'pending') {
    console.warn(`[Fulfillment Dispatcher] Order ${orderId} already has transactionStatus '${currentTransactionStatus}', aborting fulfillment to prevent duplicate.`);
    return;
  }

  // 3. Atomically lock and claim status to PROCESSING (Concurrent invocation and double-fulfillment protection)
  try {
    await transitionOrderState(orderId, 'PROCESSING', {}, "Dispatcher: Mengunci status untuk pemenuhan");
  } catch (err: any) {
    if (err.message.includes("INVALID_STATE_TRANSITION")) {
      console.log(`[Fulfillment Dispatcher] Idempotency Lock: Order ${orderId} is already locked/processed. Aborting.`);
      return;
    }
    throw err;
  }

  // 4. Submit to provider (DI LUAR TRANSAKSI FIRESTORE - BEBAS LATENSI HTTP)
  try {
    let result: { success: boolean; reference?: string; message?: string; status?: string; providerReference?: string };

    try {
      // Try to use the dynamic routing ProviderService
      const providerService = ProviderService.getInstance();
      const variantId = orderData.variantId || "";
      const providerSku = orderData.providerSku || (orderData as any).providerProductId || "";
      
      const mappedCustomerData = {
        destination: orderData.customerData?.userId || orderData.customerData?.destination || "",
        serverId: orderData.customerData?.zoneId || orderData.customerData?.serverId || ""
      };

      console.log(`[Fulfillment Dispatcher] Trying dynamic ProviderService routing for ${orderId}...`);
      const response = await providerService.fulfillOrder(orderId, variantId, providerSku, mappedCustomerData);
      
      result = {
        success: response.success,
        reference: response.providerReference || response.reference,
        message: response.message,
        status: response.status
      };
    } catch (routeErr: any) {
      console.warn(`[Fulfillment Dispatcher] ProviderService failed or not configured for ${orderId}: ${routeErr.message}. Falling back to legacy provider.`);
      logSystem("WARN", "PROVIDER", "PROVIDER_FALLBACK_TRIGGERED", `Dynamic routing gagal untuk ${orderId}, beralih ke legacy: ${routeErr.message}`, "fulfillment-dispatcher", {
        orderId,
        outcome: "WARNING",
        metadata: { error: routeErr.message }
      });
      
      // Legacy Fallback
      const legacyProviderName = (orderData as any).provider || orderData.providerId || "apigames";
      const legacyProvider = getProvider(legacyProviderName);
      
      // Format legacy order data structure to match expected
      const legacyOrderData = {
        id: orderId,
        providerProductId: (orderData as any).providerProductId || orderData.providerSku || "",
        customerData: {
          userId: orderData.customerData?.userId || orderData.customerData?.destination || "",
          zoneId: orderData.customerData?.zoneId || orderData.customerData?.serverId || ""
        },
        provider: legacyProviderName
      };

      const response = await legacyProvider.createTransaction(legacyOrderData);
      result = {
        success: response.success,
        reference: response.reference,
        message: response.message
      };
    }

    console.log(`[Fulfillment Dispatcher] Provider response for ${orderId}:`, result);

    // 5. Update state based on provider response
    if (result.success || result.status === 'success') {
      const refId = result.reference || `REF-${orderId}`;
      await transitionOrderState(orderId, 'SUCCESS', { providerReference: refId }, "Fulfillment Succeeded");
      
      logSystem("INFO", "FULFILLMENT", "FULFILLMENT_SUCCESS", `Pemenuhan pesanan ${orderId} berhasil diproses oleh provider (${refId})`, "fulfillment-dispatcher", {
        orderId,
        outcome: "SUCCESS",
        metadata: { providerReference: refId, message: result.message }
      });

      // Write audit log
      await AuditLogRepository.getInstance().createLog({
        actor: { uid: "system", email: "system@dispatcher" },
        role: "system",
        action: "FULFILLMENT_SUCCESS",
        target: `orders/${orderId}`,
        after: {
          providerReference: refId,
          message: "Dispatcher successfully completed fulfillment"
        },
        reason: "Fulfillment success",
        timestamp: new Date().toISOString()
      });
    } else {
      // If response indicates timeout or pending, KEEP status as PROCESSING (unknown outcome)
      const isPending = result.reference?.includes("PENDING") || result.status === 'pending' || result.message?.toLowerCase().includes("timeout") || result.message?.toLowerCase().includes("pending") || result.message?.toLowerCase().includes("network");
      
      if (isPending) {
        console.warn(`[Fulfillment Dispatcher] Provider returned pending or timeout status for ${orderId}. Keeping status as PROCESSING.`);
        logSystem("WARN", "PROVIDER", "PROVIDER_TIMEOUT_OR_PENDING", `Provider mengembalikan status pending/timeout untuk ${orderId}. Status dipertahankan PROCESSING`, "fulfillment-dispatcher", {
          orderId,
          outcome: "PENDING",
          metadata: { message: result.message }
        });
        await orderRepo.updateOrder(orderId, {
          fulfillmentResponse: { message: result.message || "Pending provider verification" },
          updatedAt: new Date().toISOString()
        });
      } else {
      // Only transition to FAILED if it's a permanent rejection
        // Define permanent failure reasons
        const permanentFailureReasons = [
            'invalid sku', 'product not found', 'invalid denomination', 
            'unsupported target', 'provider rejected', 'invalid product'
        ];
        const isPermanentFailure = permanentFailureReasons.some(reason => result.message?.toLowerCase().includes(reason));
        
        if (isPermanentFailure) {
            await transitionOrderState(orderId, 'FAILED', { providerStatus: result.message || "Rejected by provider" }, "Fulfillment Failed: Permanent");
            logSystem("ERROR", "FULFILLMENT", "FULFILLMENT_FAILED", `Pemenuhan pesanan ${orderId} ditolak permanen oleh provider: ${result.message}`, "fulfillment-dispatcher", {
                orderId,
                outcome: "FAILURE",
                metadata: { message: result.message }
            });
            // Audit log
            await AuditLogRepository.getInstance().createLog({
                actor: { uid: "system", email: "system@dispatcher" },
                role: "system",
                action: "FULFILLMENT_FAILED",
                target: `orders/${orderId}`,
                after: { message: result.message || "Provider returned failure response" },
                reason: result.message || "Fulfillment failed permanent",
                timestamp: new Date().toISOString()
            });
        } else {
            // Otherwise, keep as PROCESSING for reconciliation
            console.warn(`[Fulfillment Dispatcher] Ambiguous/Transient error for ${orderId}: ${result.message}. Keeping status as PROCESSING.`);
            await orderRepo.updateOrder(orderId, {
                fulfillmentResponse: { message: result.message || "Pending provider verification" },
                updatedAt: new Date().toISOString()
            });
        }
      }
    }
  } catch (err: any) {
    console.error(`[Fulfillment Dispatcher] Network/Unknown error during fulfillment of ${orderId}:`, err);
    logSystem("ERROR", "FULFILLMENT", "FULFILLMENT_CRASH", `Kesalahan jaringan tidak terduga saat pemenuhan ${orderId}: ${err.message}`, "fulfillment-dispatcher", {
      orderId,
      outcome: "FAILURE",
      stackTrace: err.stack
    });
    // Keep order status as PROCESSING for safety on unexpected crashes
    await orderRepo.updateOrder(orderId, {
      fulfillmentResponse: { message: `Error: ${err.message || "Unknown execution crash"}` },
      updatedAt: new Date().toISOString()
    });
  }
}
