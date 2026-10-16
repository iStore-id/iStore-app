import test from "node:test";
import assert from "node:assert/strict";
import {
  mapTripayMethod, mapTripayStatus, createTripayTransactionSignature,
  createTripayCallbackSignature, safeTripaySignatureEqual, buildTripayWebhookEventKey
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
