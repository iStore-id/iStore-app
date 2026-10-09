import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  calculateCheckoutTotal,
  calculateLoyaltyRedemption,
  isConfirmedPaymentFailure
} from "./checkout-calculations.js";

test("loyalty cap is calculated after promo discount", () => {
  const result = calculateLoyaltyRedemption({
    requestedPoints: 100,
    redeemRateIdr: 100,
    minRedeemPoints: 10,
    maxRedeemPercent: 50,
    remainingAmount: 1000
  });
  assert.deepEqual(result, { pointsToRedeem: 5, discountAmount: 500 });
});

test("loyalty redemption rejects a cap below the minimum points", () => {
  assert.throws(() => calculateLoyaltyRedemption({
    requestedPoints: 10,
    redeemRateIdr: 100,
    minRedeemPoints: 10,
    maxRedeemPercent: 10,
    remainingAmount: 500
  }), /Nilai transaksi tidak mencukupi/);
});

test("invalid max percentage fails closed instead of allowing uncapped discount", () => {
  assert.throws(() => calculateLoyaltyRedemption({
    requestedPoints: 10,
    redeemRateIdr: 100,
    minRedeemPoints: 10,
    maxRedeemPercent: Number.NaN,
    remainingAmount: 10000
  }), /Nilai transaksi tidak mencukupi/);
});

test("checkout total includes admin fee after discounts", () => {
  assert.deepEqual(calculateCheckoutTotal(10000, 1000, 2000, 250), {
    finalAmount: 7000,
    totalToPay: 7250
  });
});

test("checkout discounts cannot create a negative payable amount", () => {
  assert.deepEqual(calculateCheckoutTotal(1000, 900, 900, 50), {
    finalAmount: 0,
    totalToPay: 50
  });
});

test("Midtrans explicit failure statuses are recognized but pending is not", () => {
  assert.equal(isConfirmedPaymentFailure("midtrans", "deny"), true);
  assert.equal(isConfirmedPaymentFailure("midtrans", "pending"), false);
});

test("Doit explicit failure statuses are recognized but unknown statuses are not", () => {
  assert.equal(isConfirmedPaymentFailure("doit", "cancelled"), true);
  assert.equal(isConfirmedPaymentFailure("doit", undefined), false);
});

test("iPaymu status is not treated as confirmed without an authoritative query", () => {
  assert.equal(isConfirmedPaymentFailure("ipaymu", "failed"), false);
});
