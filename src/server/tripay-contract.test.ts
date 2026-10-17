import test from "node:test";
import assert from "node:assert/strict";
import {
  mapTripayMethod, mapTripayStatus, createTripayTransactionSignature,
  createTripayCallbackSignature, safeTripaySignatureEqual, buildTripayWebhookEventKey,
  resolveTripayCustomerTotal
} from "./tripay-contract.js";

test("TriPay transaction signature follows merchantCode + merchantRef + amount", () => {
  assert.equal(
    createTripayTransactionSignature("T0001", "INV55567", 1500000, "ytf6ooi2gmlNPfpchd94jDOk8hRWOu"),
    "9f167eba844d1fcb369404e2bda53702e2f78f7aa12e91da6715414e65b8c86a"
  );
  assert.notEqual(
    createTripayTransactionSignature("T123", "INV-1", 15000, "private"),
    createTripayTransactionSignature("T123", "INV-1", 15001, "private")
  );
});

test("TriPay maps only supported checkout methods", () => {
  assert.equal(mapTripayMethod("qris"), "QRIS");
  assert.equal(mapTripayMethod("bca_va"), "BCAVA");
  assert.throws(() => mapTripayMethod("unsupported"));
});

test("TriPay maps terminal and pending statuses safely", () => {
  assert.equal(mapTripayStatus("PAID"), "PAID");
  assert.equal(mapTripayStatus("EXPIRED"), "EXPIRED");
  assert.equal(mapTripayStatus("FAILED"), "FAILED");
  assert.equal(mapTripayStatus("REFUND"), "REFUNDED");
  assert.equal(mapTripayStatus("UNKNOWN"), "PENDING");
});

test("TriPay callback signature validates exact raw body and event keys include status", () => {
  const raw = Buffer.from('{"reference":"REF-1","status":"PAID"}');
  const signature = createTripayCallbackSignature(raw, "private");
  assert.equal(safeTripaySignatureEqual(signature, signature), true);
  assert.equal(safeTripaySignatureEqual(signature, "bad"), false);
  assert.notEqual(buildTripayWebhookEventKey("REF-1", "PAID"), buildTripayWebhookEventKey("REF-1", "EXPIRED"));
});


test("TriPay customer total uses amount plus customer fee and ignores inconsistent total_amount", () => {
  // Sandbox may expose an undocumented total_amount that already contains the fee
  // twice. The documented amount + fee_customer fields match the checkout bill.
  assert.equal(resolveTripayCustomerTotal(10536, 4250), 14786);
  assert.equal(resolveTripayCustomerTotal(10536, 0), 10536);
});

test("TriPay customer total rejects invalid amount and fee values", () => {
  assert.throws(() => resolveTripayCustomerTotal(0, 4250));
  assert.throws(() => resolveTripayCustomerTotal(10536, -1));
  assert.throws(() => resolveTripayCustomerTotal("invalid", 0));
});
