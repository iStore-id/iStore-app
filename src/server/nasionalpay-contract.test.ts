import test from "node:test";
import assert from "node:assert/strict";
import {
  createNasionalPaySignature,
  safeNasionalPaySignatureEqual,
  mapNasionalPayStatus,
  normalizeNasionalPayAmount
} from "./nasionalpay-contract.js";

test("NasionalPay callback signature uses HMAC-SHA256 over exact raw body", () => {
  const body = Buffer.from('{"success":true,"data":{"transaction_id":"TX-1"}}');
  const signature = createNasionalPaySignature(body, "test-store-key");
  assert.equal(signature.length, 64);
  assert.equal(safeNasionalPaySignatureEqual(signature, createNasionalPaySignature(body, "test-store-key")), true);
  assert.equal(safeNasionalPaySignatureEqual(signature, createNasionalPaySignature(body, "wrong-key")), false);
  assert.equal(safeNasionalPaySignatureEqual("bad", signature), false);
});

test("NasionalPay status maps documented success and pending values", () => {
  assert.equal(mapNasionalPayStatus("success"), "PAID");
  assert.equal(mapNasionalPayStatus("pending"), "PENDING");
  assert.equal(mapNasionalPayStatus("expired"), "EXPIRED");
  assert.equal(mapNasionalPayStatus("failed"), "FAILED");
});

test("NasionalPay amount accepts only positive safe integer rupiah", () => {
  assert.equal(normalizeNasionalPayAmount("15000"), 15000);
  assert.throws(() => normalizeNasionalPayAmount("15.50"));
  assert.throws(() => normalizeNasionalPayAmount("0"));
  assert.throws(() => normalizeNasionalPayAmount("invalid"));
});
