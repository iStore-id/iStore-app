import {
  createMidtransTransaction,
  checkMidtransStatus,
  refundMidtransTransaction,
  verifySignatureKey
} from "../midtrans.js";
import {
  PaymentProviderAdapter,
  CreatePaymentInput,
  PaymentResult,
  PaymentStatusInput,
  PaymentStatusResult,
  WebhookRequest,
  NormalizedPaymentEvent,
  RefundPaymentInput,
  RefundResult
} from "./payment-provider-interface.js";

export class MidtransProviderAdapter implements PaymentProviderAdapter {
  private static instance: MidtransProviderAdapter;

  private constructor() {}

  public static getInstance(): MidtransProviderAdapter {
    if (!MidtransProviderAdapter.instance) {
      MidtransProviderAdapter.instance = new MidtransProviderAdapter();
    }
    return MidtransProviderAdapter.instance;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    try {
      const result = await createMidtransTransaction({
        orderId: input.orderId,
        grossAmount: input.grossAmount,
        customerDetails: input.customerDetails,
        itemDetails: input.itemDetails,
        paymentMethod: input.paymentMethod
      });
      return {
        success: true,
        token: result.token,
        redirectUrl: result.redirectUrl,
        rawResponse: result
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to create Midtrans transaction"
      };
    }
  }

  async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const status = await checkMidtransStatus(input.orderId);
    return {
      status: status?.transaction_status || "pending",
      transactionStatus: status?.transaction_status || "pending",
      grossAmount: status ? parseFloat(status.gross_amount || "0") : 0,
      rawData: status
    };
  }

  async verifyWebhook(request: WebhookRequest): Promise<NormalizedPaymentEvent> {
    const data = request.body;
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = data;

    const isValid = verifySignatureKey(order_id, status_code, gross_amount, signature_key);
    if (!isValid) {
      throw new Error("Invalid Midtrans signature");
    }

    let normalizedStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED' = 'PENDING';
    if (transaction_status === 'capture') {
      normalizedStatus = (fraud_status === 'accept') ? 'PAID' : 'PENDING';
    } else if (transaction_status === 'settlement') {
      normalizedStatus = 'PAID';
    } else if (transaction_status === 'expire') {
      normalizedStatus = 'EXPIRED';
    } else if (transaction_status === 'cancel' || transaction_status === 'deny') {
      normalizedStatus = 'CANCELLED';
    } else if (transaction_status === 'refund') {
      normalizedStatus = 'REFUNDED';
    }

    return {
      provider: 'midtrans',
      orderId: order_id,
      transactionId: data.transaction_id || order_id,
      status: normalizedStatus,
      amount: parseFloat(gross_amount || '0'),
      rawPayload: data
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundResult> {
    try {
      const res = await refundMidtransTransaction({
        orderId: input.orderId,
        refundKey: `ref_${Date.now()}`,
        amount: input.amount,
        reason: input.reason || "Admin requested refund"
      });
      return {
        success: true,
        refundId: res.refund_id || res.id,
        message: "Refund processed successfully by Midtrans"
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Midtrans refund failed"
      };
    }
  }
}
