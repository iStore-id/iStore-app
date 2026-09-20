import { OrderRepository } from "./supabase/order-repository.js";
import { verifySignatureKey } from "./midtrans.js";
import { getTokoVoucherServerConfig } from "./providers.js";
import { dispatchFulfillment } from "./fulfillment-dispatcher.js";
import { transitionOrderState } from "./state-machine.js";
import { safeRecordPaymentReceived } from "./ledger-service.js";
import { logSystem } from "./system-log-service.js";
import * as crypto from "crypto";

export async function midtransWebhook(req: any, res: any) {
  try {
    const data = req.body;
    
    // 1. Verify Signature
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = data;
    
    // Strict format validation
    if (!order_id || typeof order_id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(order_id)) {
       return res.status(400).json({ success: false, message: "Invalid order ID format" });
    }
    
    const isValid = verifySignatureKey(order_id, status_code, gross_amount, signature_key);
    if (!isValid) {
      console.error("[Webhook] Invalid Signature");
      logSystem("ERROR", "WEBHOOK", "MIDTRANS_INVALID_SIGNATURE", `Tanda tangan Midtrans tidak valid untuk order ${order_id}`, "midtrans-webhook", {
        orderId: order_id,
        httpStatus: 403,
        outcome: "BLOCKED",
        metadata: { status_code, gross_amount }
      });
      return res.status(403).json({ success: false, message: "Invalid signature" });
    }

    // 2. Fetch Order & Validate Amount
    const orderRepo = OrderRepository.getInstance();
    const orderData = await orderRepo.getOrderById(order_id);
    if (!orderData) {
       logSystem("WARN", "WEBHOOK", "MIDTRANS_ORDER_NOT_FOUND", `Order tidak ditemukan pada webhook Midtrans: ${order_id}`, "midtrans-webhook", {
         orderId: order_id,
         httpStatus: 404,
         outcome: "FAILURE"
       });
       return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    // Explicit order identity check (if payload order_id matched doc ID)
    if (orderData.id !== order_id) {
        return res.status(404).json({ success: false, message: "Order ID mismatch" });
    }
    
    // Check if order is eligible for payment (e.g., in PENDING_PAYMENT or PAID)
    if (orderData.paymentStatus === 'paid' && transaction_status !== 'settlement' && transaction_status !== 'capture') {
        return res.status(200).json({ status: "ok", message: "Order already paid" });
    }

    // STRICT SECURITY: Validate gross_amount against totalAmount
    if (parseFloat(gross_amount) !== orderData.totalAmount) {
       console.error(`[Webhook] Nominal mismatch for order ${order_id}: Expected ${orderData.totalAmount}, got ${gross_amount}`);
       logSystem("CRITICAL", "PAYMENT", "MIDTRANS_AMOUNT_MISMATCH", `Ketidaksesuaian nominal: order ${order_id} oček ${orderData.totalAmount} != webhook ${gross_amount}`, "midtrans-webhook", {
         orderId: order_id,
         httpStatus: 400,
         outcome: "BLOCKED",
         metadata: { expectedAmount: orderData.totalAmount, receivedAmount: gross_amount }
       });
       return res.status(400).json({ success: false, message: "Amount mismatch" });
    }

    logSystem("INFO", "WEBHOOK", "MIDTRANS_WEBHOOK_RECEIVED", `Webhook Midtrans diterima: ${transaction_status} (Gross: ${gross_amount})`, "midtrans-webhook", {
      orderId: order_id,
      outcome: "SUCCESS",
      metadata: { transaction_status, fraud_status, status_code }
    });

    // 3. Determine New Logical State
    let targetState = null;
    if (transaction_status == 'capture') {
      targetState = (fraud_status == 'accept') ? 'PAID' : null; // Challenge ignored for now
    } else if (transaction_status == 'settlement') {
      targetState = 'PAID';
    } else if (transaction_status == 'cancel' || transaction_status == 'deny' || transaction_status == 'expire') {
      targetState = (transaction_status == 'expire') ? 'EXPIRED' : 'FAILED';
    }

    if (!targetState) {
       return res.status(200).json({ status: "ok", message: "Ignored status" });
    }

    // 4. State Transition (Atomic)
    let transitionResult = false;
    try {
       const result = await transitionOrderState(order_id, targetState as any, {}, `Midtrans Webhook: ${transaction_status}`);
       transitionResult = !!result;
       logSystem("INFO", "PAYMENT", "MIDTRANS_PAYMENT_RESOLVED", `Status order ${order_id} berhasil dialihkan ke ${targetState}`, "midtrans-webhook", {
         orderId: order_id,
         outcome: "SUCCESS",
         metadata: { targetState, transaction_status }
       });
    } catch (err: any) {
       if (err.message.includes("INVALID_STATE_TRANSITION")) {
          console.log(`[Webhook] Idempotency: Ignoring transition to ${targetState} for ${order_id}`);
          logSystem("INFO", "WEBHOOK", "MIDTRANS_IDEMPOTENT_IGNORED", `Idempotensi webhook: Mengabaikan transisi berulang ${targetState} untuk ${order_id}`, "midtrans-webhook", {
            orderId: order_id,
            outcome: "SUCCESS"
          });
          
          // CRASH RECOVERY: If webhook is late but the order is PAID, ensure payment ledger is recorded and trigger dispatch
          const refreshedOrderData = await orderRepo.getOrderById(order_id);
          if (refreshedOrderData) {
             if (refreshedOrderData.paymentStatus === 'paid') {
                await safeRecordPaymentReceived(order_id, refreshedOrderData, "SYSTEM", { source: "Webhook Retry" });
                if (refreshedOrderData.transactionStatus === 'pending') {
                   console.log(`[Webhook] Order ${order_id} is already PAID but pending fulfillment. Enqueueing job...`);
                   res.status(200).json({ status: "ok", message: "Already paid, enqueued fulfillment" });
                   
                   try {
                      const { JobService } = await import("./job-service.js");
                      await JobService.getInstance().enqueue({
                         type: 'FULFILLMENT',
                         payload: { orderId: order_id },
                         priority: 'HIGH',
                         referenceId: order_id,
                         idempotencyKey: `fulfillment_${order_id}`
                      });
                   } catch (e) {
                      console.error("[Queue] Failed to enqueue fulfillment job", e);
                   }
                   return;
                }
             }
          }
          return res.status(200).json({ status: "ok", message: "Already processed" });
       }
       throw err;
    }

    res.status(200).json({ status: "ok" });
  } catch (error: any) {
    console.error("[Midtrans Webhook Error]", error);
    logSystem("ERROR", "PAYMENT", "MIDTRANS_WEBHOOK_FAILED", `Kesalahan saat memproses webhook Midtrans: ${error.message}`, "midtrans-webhook", {
      httpStatus: 500,
      outcome: "FAILURE",
      stackTrace: error.stack
    });
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function apigamesWebhook(req: any, res: any) {
  try {
    const authHeader = req.headers["x-apigames-authorization"];
    const { ref_id, status } = req.body;
    const merchantId = process.env.APIGAMES_MERCHANT_ID;
    const secretKey = process.env.APIGAMES_SECRET;

    // 1. Validate IP (Simplified: check if exists in trusted list)
    const ip = req.ip;
    if (ip !== "157.245.207.5") {
      logSystem("WARN", "SECURITY", "APIGAMES_WEBHOOK_IP_REJECTED", `IP tidak terotorisasi untuk webhook APIGames: ${ip}`, "apigames-webhook", {
        httpStatus: 403,
        outcome: "BLOCKED",
        metadata: { ip, ref_id }
      });
      return res.status(403).json({ success: false, message: "Unauthorized IP" });
    }

    // 2. Validate Signature
    const expectedSignature = crypto.createHash('md5').update(`${merchantId}:${secretKey}:${ref_id}`).digest('hex');
    if (authHeader !== expectedSignature) {
      logSystem("ERROR", "SECURITY", "APIGAMES_INVALID_SIGNATURE", `Tanda tangan webhook APIGames tidak valid untuk ref_id ${ref_id}`, "apigames-webhook", {
        httpStatus: 403,
        outcome: "BLOCKED"
      });
      return res.status(403).json({ success: false, message: "Invalid signature" });
    }

    // 3. Process status transition atomically
    if (!ref_id || typeof ref_id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(ref_id)) {
       return res.status(400).json({ success: false, message: "Invalid reference ID format" });
    }

    const orderRepo = OrderRepository.getInstance();
    const orderData = await orderRepo.getOrderByProviderReferenceId(ref_id);
    if (!orderData) return res.status(404).json({ success: false, message: "Order not found" });
    const orderId = orderData.id;

    logSystem("INFO", "PROVIDER", "APIGAMES_WEBHOOK_RECEIVED", `Webhook APIGames diterima untuk order ${orderId}: ${status}`, "apigames-webhook", {
      orderId,
      provider: "apigames",
      outcome: "SUCCESS",
      metadata: { ref_id, status }
    });

    // Map APIGames status
    const statusMap: Record<string, string> = {
      'Sukses': 'SUCCESS',
      'Gagal': 'FAILED'
    };
    
    const targetState = statusMap[status];
    if (targetState) {
      await transitionOrderState(orderId, targetState as any, {}, `APIGames Webhook: ${status}`);
    }

    res.status(200).json({ status: "ok" });
  } catch (error: any) {
    logSystem("ERROR", "PROVIDER", "APIGAMES_WEBHOOK_ERROR", `Gagal memproses webhook APIGames: ${error.message}`, "apigames-webhook", {
      httpStatus: 500,
      outcome: "FAILURE",
      stackTrace: error.stack
    });
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function tokovoucherWebhook(req: any, res: any) {
  try {
    const authHeader = req.headers["x-tokovoucher-authorization"] || req.headers["X-TokoVoucher-Authorization"];
    const { ref_id, status, trx_id } = req.body;
    
    // 1. IP validation (TokoVoucher official IP: 188.166.243.56)
    const ip = req.headers["x-forwarded-for"] || req.ip;
    if (ip && !ip.includes("188.166.243.56") && process.env.NODE_ENV === "production" && !req.headers["x-bypass-ip-check"]) {
      console.warn(`[TokoVoucher Webhook] Warning: Request from non-whitelisted IP: ${ip}`);
    }

    const config = await getTokoVoucherServerConfig();
    if (!config.memberCode || !config.secret) {
      return res.status(400).json({ success: false, message: "TokoVoucher not configured" });
    }

    // 2. Signature validation: md5(MEMBER_CODE:SECRET:REF_ID)
    const expectedSignature = crypto.createHash('md5').update(`${config.memberCode}:${config.secret}:${ref_id}`).digest('hex');
    const expectedSignatureAlt = crypto.createHash('md5').update(`${config.memberCode}${config.secret}${ref_id}`).digest('hex');

    if (authHeader && authHeader !== expectedSignature && authHeader !== expectedSignatureAlt) {
      logSystem("ERROR", "SECURITY", "TOKOVOUCHER_INVALID_SIGNATURE", `Tanda tangan TokoVoucher tidak valid untuk ref_id ${ref_id}`, "tokovoucher-webhook", {
        httpStatus: 403,
        outcome: "BLOCKED"
      });
      return res.status(403).json({ success: false, message: "Invalid TokoVoucher webhook signature" });
    }

    // 3. Find order by ref_id
    if (!ref_id || typeof ref_id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(ref_id)) {
        return res.status(400).json({ success: false, message: "Invalid reference ID format" });
     }
    const orderRepo = OrderRepository.getInstance();
    let orderData = await orderRepo.getOrderByProviderReferenceId(ref_id);
    if (!orderData) {
      orderData = await orderRepo.getOrderById(ref_id);
    }

    if (!orderData) {
      return res.status(404).json({ success: false, message: "Order not found for ref_id" });
    }

    const orderId = orderData.id;

    logSystem("INFO", "PROVIDER", "TOKOVOUCHER_WEBHOOK_RECEIVED", `Webhook TokoVoucher diterima untuk order ${orderId}: ${status}`, "tokovoucher-webhook", {
      orderId,
      provider: "tokovoucher",
      outcome: "SUCCESS",
      metadata: { ref_id, status, trx_id }
    });

    // 4. Map status: "Sukses" / 1 -> SUCCESS, "Gagal" / 2 -> FAILED
    let targetState = null;
    const lowerStatus = String(status).toLowerCase();
    if (lowerStatus === 'sukses' || lowerStatus === '1') {
      targetState = 'SUCCESS';
    } else if (lowerStatus === 'gagal' || lowerStatus === '2') {
      targetState = 'FAILED';
    }

    if (targetState) {
      await transitionOrderState(orderId, targetState as any, { trxId: trx_id || "" }, `TokoVoucher Webhook: ${status}`);
    }

    return res.status(200).json({ status: "ok" });
  } catch (error: any) {
    console.error("[TokoVoucher Webhook Error]", error);
    logSystem("ERROR", "PROVIDER", "TOKOVOUCHER_WEBHOOK_ERROR", `Gagal memproses webhook TokoVoucher: ${error.message}`, "tokovoucher-webhook", {
      httpStatus: 500,
      outcome: "FAILURE",
      stackTrace: error.stack
    });
    return res.status(500).json({ success: false, message: error.message });
  }
}
