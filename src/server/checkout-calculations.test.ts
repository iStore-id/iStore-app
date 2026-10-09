import { test, expect } from "bun:test";
import {
  calculateCheckoutTotal,
  calculateLoyaltyRedemption,
  isConfirmedPaymentFailure
} from "./checkout-calculations.js";

test("loyalty cap is calculated after promo discount", () => {
  const result = calculateLoyaltyRedemption({
    requestedPoints: 100,
    redeemRateIdr: 100,
    minRedeemPoints: 1,
    maxRedeemPercent: 50,
    remainingAmount: 1000
  });
  expect(result).toEqual({ pointsToRedeem: 5, discountAmount: 500 });
});

test("loyalty redemption rejects a cap below the minimum points", () => {
  expect(() => calculateLoyaltyRedemption({
    requestedPoints: 10,
    redeemRateIdr: 100,
    minRedeemPoints: 10,
    maxRedeemPercent: 10,
    remainingAmount: 500
  })).toThrow(/Nilai transaksi tidak mencukupi/);
});

test("invalid max percentage fails closed instead of allowing uncapped discount", () => {
  expect(() => calculateLoyaltyRedemption({
    requestedPoints: 10,
    redeemRateIdr: 100,
    minRedeemPoints: 10,
    maxRedeemPercent: Number.NaN,
    remainingAmount: 10000
  })).toThrow(/Nilai transaksi tidak mencukupi/);
});

test("checkout total includes admin fee after discounts", () => {
  expect(calculateCheckoutTotal(10000, 1000, 2000, 250)).toEqual({
    finalAmount: 7000,
    totalToPay: 7250
  });
});

test("checkout discounts cannot create a negative payable amount", () => {
  expect(calculateCheckoutTotal(1000, 900, 900, 50)).toEqual({
    finalAmount: 0,
    totalToPay: 50
  });
});

test("Midtrans explicit failure statuses are recognized but pending is not", () => {
  expect(isConfirmedPaymentFailure("midtrans", "deny")).toBe(true);
  expect(isConfirmedPaymentFailure("midtrans", "pending")).toBe(false);
});

test("Doit explicit failure statuses are recognized but unknown statuses are not", () => {
  expect(isConfirmedPaymentFailure("doit", "cancelled")).toBe(true);
  expect(isConfirmedPaymentFailure("doit", undefined)).toBe(false);
});

test("iPaymu status is not treated as confirmed without an authoritative query", () => {
  expect(isConfirmedPaymentFailure("ipaymu", "failed")).toBe(false);
});
