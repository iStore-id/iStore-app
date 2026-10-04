import { OrderRepository } from "./supabase/order-repository.js";
import { PaymentRouter } from "./payment-router.js";
import { logSystem } from "./system-log-service.js";

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
    if (gatewayCode !== 'ipaymu' && gatewayCode !== 'doit') {
      return res.status(400).json({ success: false, message: "Gateway not supported for status inquiry" });
    }

    // 2. Call provider inquiry
    const provider = PaymentRouter.getInstance().getProvider(gatewayCode);
    const statusResult = await provider.getPaymentStatus({
      orderId: order.invoice || order.id,
      transactionId: order.gatewayTransactionId || undefined
    });

    return res.status(200).json({ success: true, data: statusResult });
  } catch (error: any) {
    console.error("[Payment Status Inquiry Error]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
