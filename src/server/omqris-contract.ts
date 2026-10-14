export type OmqrisNormalizedStatus = "PAID" | "EXPIRED" | "FAILED" | "PENDING";

export function mapOmqrisStatus(value: unknown): OmqrisNormalizedStatus {
  const status = String(value || "").toLowerCase().replace(/^payment\\./, "");
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
