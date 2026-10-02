export interface CreatePaymentInput {
  orderId: string;
  grossAmount: number;
  customerDetails: {
    first_name: string;
    email: string;
    phone: string;
  };
  itemDetails: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
  paymentMethod?: string;
  callbackUrl?: string;
  returnUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  token?: string;
  redirectUrl?: string;
  qrImage?: string;
  rawResponse?: any;
  message?: string;
}

export interface PaymentStatusInput {
  orderId: string;
  transactionId?: string;
}

export interface PaymentStatusResult {
  status: string;
  transactionStatus: string;
  grossAmount: number;
  rawData?: any;
}

export interface WebhookRequest {
  body: any;
  headers: any;
  ip?: string;
}

export interface NormalizedPaymentEvent {
  provider: string;
  orderId: string;
  transactionId: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';
  amount: number;
  rawPayload: any;
}

export interface RefundPaymentInput {
  orderId: string;
  transactionId: string;
  amount: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  message?: string;
}

export interface PaymentProviderAdapter {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult>;
  verifyWebhook(request: WebhookRequest): Promise<NormalizedPaymentEvent>;
  refundPayment(input: RefundPaymentInput): Promise<RefundResult>;
}
