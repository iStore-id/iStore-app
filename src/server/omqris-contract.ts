export type OmqrisNormalizedStatus = "PAID" | "EXPIRED" | "FAILED" | "PENDING";

export function mapOmqrisStatus(value: unknown): OmqrisNormalizedStatus {
  const status = String(value || "").toLowerCase().replace(/^payment\./, "");
  if (["paid", "success", "sukses", "settlement", "completed", "berhasil"].includes(status)) return "PAID";
  if (["expired", "expire", "kadaluarsa"].includes(status)) return "EXPIRED";
  if (["failed", "failure", "gagal", "cancelled", "canceled"].includes(status)) return "FAILED";
  return "PENDING";
}

/**
 * OmQris can send multiple status-change webhooks for one invoice.
 * Deduplicate per invoice AND normalized status, never by invoice alone.
 */
export function buildOmqrisWebhookEventKey(identifier: unknown, status: unknown): string {
  const id = String(identifier || "").trim();
  if (!id) return "";
  return `${id}:${mapOmqrisStatus(status)}`;
}

export function isOmqrisApiError(responseOk: boolean, payload: any): boolean {
  return !responseOk || payload?.ok === false || payload?.success === false || payload?.status === "error";
}

export function isOmqrisPersonalMode(value: unknown): boolean {
  return String(value || "").trim().toLowerCase() === "pribadi";
}

/** Only a verified OmQris PAID event may reopen a locally expired OmQris order. */
export function isOmqrisAuthoritativeLatePaid(
  gatewayCode: unknown,
  paymentStatus: unknown,
  eventStatus: unknown
): boolean {
  return String(gatewayCode || "").trim().toLowerCase() === "omqris" &&
    String(paymentStatus || "").trim().toLowerCase() === "expired" &&
    mapOmqrisStatus(eventStatus) === "PAID";
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : fallback;
}

export function normalizeOmqrisAmounts(data: any, requestedAmount: number) {
  return {
    baseAmount: nonNegativeInteger(data?.base_amount ?? data?.amount, requestedAmount),
    feeAmount: nonNegativeInteger(data?.fee, 0),
    mdrAmount: nonNegativeInteger(data?.mdr_amount, 0),
    mdrBearer: data?.mdr_bearer ? String(data.mdr_bearer).toLowerCase() : undefined,
    totalAmount: nonNegativeInteger(data?.total_amount, requestedAmount),
    netAmount: nonNegativeInteger(data?.net_amount, requestedAmount)
  };
}

export function validateOmqrisAmounts(data: any, requestedAmount: number): string | null {
  const requiredFields = ["base_amount", "fee", "mdr_amount", "total_amount", "net_amount"];
  for (const field of requiredFields) {
    const value = Number(data?.[field]);
    if (data?.[field] === undefined || data?.[field] === null || data?.[field] === "" ||
        !Number.isSafeInteger(value) || value < 0) {
      return `Respons OmQris memiliki nominal ${field} yang hilang atau tidak valid.`;
    }
  }

  const amounts = normalizeOmqrisAmounts(data, requestedAmount);
  if (amounts.baseAmount !== requestedAmount) {
    return "Nominal pokok OmQris tidak cocok dengan nominal pesanan iStore.";
  }
  if (amounts.mdrBearer !== "merchant" && amounts.mdrBearer !== "customer") {
    return "Respons OmQris memiliki mdr_bearer yang tidak valid.";
  }

  const expectedTotal = amounts.baseAmount + amounts.feeAmount +
    (amounts.mdrBearer === "customer" ? amounts.mdrAmount : 0);
  if (amounts.totalAmount !== expectedTotal) {
    return "Total pembayaran OmQris tidak sesuai dengan base amount, fee, dan MDR.";
  }
  return null;
}
