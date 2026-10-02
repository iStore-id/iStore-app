import { OrderRepository } from "./supabase/order-repository.js";
import { IpaymuProviderAdapter } from "./adapters/ipaymu-adapter.js";
import { logSystem } from "./system-log-service.js";

export async function getPaymentStatusHandler(req: any, res: any) {
  try {
    const { invoice } = req.params;
    if (!invoice) return res.status(400).json({ success: false, message: "Invoice is required" });

    // 1. Auth check: Assume existing middleware (e.g., in server.ts or implied context)
    // For now, assume this is mounted under an authenticated route
    const orderRepo = OrderRepository.getInstance();
    const order = await orderRepo.getOrderByInvoice(invoice) || await orderRepo.getOrderById(invoice);

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    
    // Check ownership if user ID is available
    if (req.user && order.userId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (order.paymentGatewayCode !== 'ipaymu') {
      return res.status(400).json({ success: false, message: "Gateway not supported for status inquiry" });
    }

    // 2. Call iPaymu inquiry
    const adapter = IpaymuProviderAdapter.getInstance();
    const statusResult = await adapter.getPaymentStatus({ orderId: order.invoice || order.id });

    // 3. Optional: Sync local status if changed (if settlement reached)
    // Keep it minimal as requested: don't auto-update to FAILED if PENDING.
    
    return res.status(200).json({ success: true, data: statusResult });
  } catch (error: any) {
    console.error("[Payment Status Inquiry Error]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
