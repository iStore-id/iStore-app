export function createTokoVoucherReference(orderId: string): string {
  return `${orderId}-REQ`;
}

export function isTokoVoucherInsufficientBalance(message: unknown): boolean {
  const value = String(message || "").toLowerCase();
  return /insufficient\s+(?:member\s+)?balance|not enough balance|saldo\s+(?:member\s+)?(?:tidak\s+cukup|tidak\s+mencukupi|kurang)/i.test(value);
}

export function normalizeTokoVoucherFailureReason(message: unknown): string {
  if (isTokoVoucherInsufficientBalance(message)) {
    return "Saldo member tidak mencukupi";
  }
  return String(message || "Transaksi ditolak oleh supplier").trim();
}

export function resolveTokoVoucherReference(providerReference: string | null | undefined, orderId: string): string {
  const canonical = createTokoVoucherReference(orderId);
  const reference = String(providerReference || "").trim();
  if (reference === orderId || reference === canonical) return reference;
  if (reference === `TV-${canonical}`) return canonical;
  return canonical;
}

const CUSTOMER_GATEWAY_FIELDS = [
  "rail", "qrImage", "qrContent", "qrisString", "qris_string",
  "vaNumber", "vaBank", "totalAmount", "feeAmount", "expiresAt"
] as const;

function customerGatewayResponse(value: any): Record<string, any> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const safe: Record<string, any> = {};
  for (const key of CUSTOMER_GATEWAY_FIELDS) {
    if (value[key] !== undefined && value[key] !== null) safe[key] = value[key];
  }
  return Object.keys(safe).length ? safe : null;
}

function customerDataView(value: any): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key]) =>
      !/(email|phone|token|secret|password|credential|signature|api.?key|member.?code)/i.test(key)
    )
  );
}

/**
 * Explicit allow-list for buyer-facing order APIs. Supplier diagnostics, routing,
 * credentials, raw provider responses and internal references never cross this boundary.
 */
export function toCustomerOrderView(order: any, isOwner = false): Record<string, any> {
  return {
    id: order.id,
    invoice: order.invoice,
    isOwner,
    customerData: customerDataView(order.customerData),
    productId: order.productId,
    productName: order.productName,
    variantName: order.variantName,
    quantity: order.quantity,
    price: order.price,
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    transactionStatus: order.transactionStatus,
    paymentGatewayCode: order.paymentGatewayCode,
    gatewayPaymentType: order.gatewayPaymentType,
    gatewayResponse: customerGatewayResponse(order.gatewayResponse),
    paymentUrl: order.paymentUrl,
    snapToken: order.snapToken,
    qrImage: order.qrImage,
    expiresAt: order.expiresAt,
    serialNumber: order.serialNumber,
    createdAt: order.createdAt
  };
}
