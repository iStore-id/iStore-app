export interface LoyaltyRedemptionInput {
  requestedPoints: number;
  redeemRateIdr: number;
  minRedeemPoints: number;
  maxRedeemPercent: number;
  remainingAmount: number;
}

export interface LoyaltyRedemptionResult {
  pointsToRedeem: number;
  discountAmount: number;
}

export function calculateLoyaltyRedemption(input: LoyaltyRedemptionInput): LoyaltyRedemptionResult {
  const requestedPoints = Math.max(0, Math.floor(Number(input.requestedPoints) || 0));
  if (requestedPoints <= 0) return { pointsToRedeem: 0, discountAmount: 0 };

  if (!Number.isFinite(input.redeemRateIdr) || input.redeemRateIdr <= 0) {
    throw new Error("Konfigurasi nilai penukaran poin tidak valid.");
  }

  const minimum = Math.max(0, Math.floor(Number.isFinite(input.minRedeemPoints) ? input.minRedeemPoints : 0));
  if (requestedPoints < minimum) {
    throw new Error(`Minimal penukaran poin adalah ${minimum}.`);
  }

  const remainingAmount = Math.max(0, Number.isFinite(input.remainingAmount) ? input.remainingAmount : 0);
  const configuredMaxPercent = Number.isFinite(input.maxRedeemPercent) ? input.maxRedeemPercent : 0;
  const maxPercent = Math.max(0, Math.min(100, configuredMaxPercent));
  const maxDiscount = Math.floor((remainingAmount * maxPercent) / 100);
  const pointsToRedeem = Math.min(requestedPoints, Math.floor(maxDiscount / input.redeemRateIdr));

  if (pointsToRedeem < minimum) {
    throw new Error("Nilai transaksi tidak mencukupi untuk penukaran poin minimum.");
  }

  return {
    pointsToRedeem,
    discountAmount: pointsToRedeem * input.redeemRateIdr
  };
}

export function calculateCheckoutTotal(
  baseAmount: number,
  promoDiscount: number,
  loyaltyDiscount: number,
  adminFee: number
): { finalAmount: number; totalToPay: number } {
  const safeBaseAmount = Math.max(0, Number.isFinite(baseAmount) ? baseAmount : 0);
  const safePromoDiscount = Math.max(0, Number.isFinite(promoDiscount) ? promoDiscount : 0);
  const safeLoyaltyDiscount = Math.max(0, Number.isFinite(loyaltyDiscount) ? loyaltyDiscount : 0);
  const safeAdminFee = Math.max(0, Math.round(Number.isFinite(adminFee) ? adminFee : 0));
  const finalAmount = Math.max(0, safeBaseAmount - safePromoDiscount - safeLoyaltyDiscount);
  return { finalAmount, totalToPay: finalAmount + safeAdminFee };
}

export function isConfirmedPaymentFailure(gatewayCode: string, status: unknown): boolean {
  const normalized = String(status ?? "").toLowerCase();
  if (gatewayCode === "midtrans") {
    return ["deny", "cancel", "expire", "failure"].includes(normalized);
  }
  if (gatewayCode === "doit") {
    return ["failed", "failure", "cancelled", "canceled", "expired", "deny", "rejected"].includes(normalized);
  }
  // No authoritative status query is implemented for iPaymu in checkout recovery.
  return false;
}
