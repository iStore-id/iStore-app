import { OrderRepository } from "./supabase/order-repository.js";
import { PaymentRouter } from "./payment-router.js";
import { logSystem } from "./system-log-service.js";
import { transitionOrderState } from "./state-machine.js";
import { safeRecordPaymentReceived } from "./ledger-service.js";
import { processOmqrisCallbackLifecycle } from "./omqris-lifecycle.js";

export async function getPaymentStatusHandler(req: any, res: any) {
  try {
    const { invoice } = req.params;
    if (!invoice) return res.status(400).json({ success: false, message: "Invoice is required" });

    // 1. Auth check
    const orderRepo = OrderRepository.getInstance();
    const order = await orderRepo.getOrderByInvoice(invoice) || await orderRepo.getOrderById(invoice);

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    
    // Check ownership if user ID is available
    if (req.user && order.userId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const gatewayCode = (order.paymentGatewayCode || "").toLowerCase().trim();
    if (gatewayCode !== 'doit' && gatewayCode !== 'omqris' && gatewayCode !== 'tripay') {
      return res.status(400).json({ success: false, message: "Gateway not supported for status inquiry" });
    }

    // 2. Call provider inquiry
    const provider = PaymentRouter.getInstance().getProvider(gatewayCode);
    const statusResult = await provider.getPaymentStatus({
      orderId: order.invoice || order.id,
      transactionId: order.gatewayTransactionId || undefined
    });

    // OmQris status inquiry is also a recovery path when its webhook was delayed or missed.
    // Never trust a client-supplied status: this state transition uses the server-side provider inquiry.
    if (gatewayCode === "omqris" && String(statusResult.status || "").toUpperCase() === "PAID") {
      const providerBaseAmount = Number(statusResult.grossAmount || 0);
      const expectedBaseAmount = Number(order.totalAmount || 0);

      // OmQris reports the base amount separately from its documented fee/unique-code total.
      // Compare base-to-base; do not compare the QRIS total (which can include provider additions)
      // with the iStore order's base amount.
      if (
        !Number.isFinite(providerBaseAmount) ||
        providerBaseAmount <= 0 ||
        !Number.isFinite(expectedBaseAmount) ||
        Math.abs(providerBaseAmount - expectedBaseAmount) > 1
      ) {
        logSystem("CRITICAL", "PAYMENT", "OMQRIS_STATUS_AMOUNT_MISMATCH",
          `Nominal dasar OmQris tidak cocok untuk order ${order.id}`, "omqris-status-inquiry", {
            orderId: order.id,
            httpStatus: 409,
            outcome: "BLOCKED",
            metadata: { expectedBaseAmount, providerBaseAmount }
          });
        return res.status(409).json({
          success: false,
          message: "OmQris confirmed a payment status but the base amount requires review."
        });
      }

      if (String(order.paymentStatus || "").toLowerCase() !== "paid") {
        const lifecycleResult = await processOmqrisCallbackLifecycle(
          {
            orderId: order.id,
            targetState: "PAID",
            eventStatus: String(statusResult.transactionStatus || statusResult.status),
            order
          },
          {
            transitionOrderState: (orderId, state, payload, reason) =>
              transitionOrderState(orderId, state as any, payload, reason),
            getOrderById: (orderId) => orderRepo.getOrderById(orderId),
            recordPaymentReceived: (orderId, paidOrder, source) =>
              safeRecordPaymentReceived(orderId, paidOrder, "SYSTEM", { source }),
            enqueueFulfillment: async (orderId, idempotencyKey) => {
              const { JobService } = await import("./job-service.js");
              return JobService.getInstance().enqueue({
                type: "FULFILLMENT",
                payload: { orderId },
                priority: "HIGH",
                referenceId: orderId,
                idempotencyKey
              });
            },
            markProcessed: () => {},
            clearProcessing: () => {}
          }
        );

        if (lifecycleResult.statusCode !== 200) {
          return res.status(lifecycleResult.statusCode).json({
            success: false,
            message: lifecycleResult.body.message
          });
        }
      }

      const refreshedOrder = await orderRepo.getOrderById(order.id);
      return res.status(200).json({
        success: true,
        data: {
          ...statusResult,
          status: String(refreshedOrder?.paymentStatus || "").toUpperCase() === "PAID" ? "PAID" : statusResult.status,
          orderPaymentStatus: refreshedOrder?.paymentStatus || order.paymentStatus
        }
      });
    }

    return res.status(200).json({ success: true, data: statusResult });
  } catch (error: any) {
    console.error("[Payment Status Inquiry Error]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
