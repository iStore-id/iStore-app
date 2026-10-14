import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildOmqrisWebhookEventKey,
  isOmqrisApiError,
  mapOmqrisStatus,
  normalizeOmqrisAmounts,
  validateOmqrisAmounts
} from "./omqris-contract.js";

test("OmQris documented success, failure, and expiry statuses normalize correctly", () => {
  assert.equal(mapOmqrisStatus("sukses"), "PAID");
  assert.equal(mapOmqrisStatus("payment.sukses"), "PAID");
  assert.equal(mapOmqrisStatus("expired"), "EXPIRED");
  assert.equal(mapOmqrisStatus("gagal"), "FAILED");
  assert.equal(mapOmqrisStatus("pending"), "PENDING");
});

test("OmQris webhook idempotency key distinguishes status changes for one invoice", () => {
  const pending = buildOmqrisWebhookEventKey("INV-123", "pending");
  const paid = buildOmqrisWebhookEventKey("INV-123", "sukses");
  assert.equal(pending, "INV-123:PENDING");
  assert.equal(paid, "INV-123:PAID");
  assert.notEqual(pending, paid);
  assert.equal(buildOmqrisWebhookEventKey("INV-123", "payment.sukses"), paid);
  assert.equal(buildOmqrisWebhookEventKey("", "sukses"), "");
});

test("OmQris API ok:false error payload is rejected even on HTTP 200", () => {
  assert.equal(isOmqrisApiError(true, { ok: false, code: "DUPLICATE_MERCHANT_REF" }), true);
  assert.equal(isOmqrisApiError(false, { ok: true }), true);
  assert.equal(isOmqrisApiError(true, { ok: true }), false);
});

test("OmQris unique fee, MDR, customer total, and net amount remain distinct", () => {
  const amounts = normalizeOmqrisAmounts({
    base_amount: 10000,
    fee: 143,
    mdr_amount: 250,
    mdr_bearer: "customer",
    total_amount: 10393,
    net_amount: 10000
  }, 10000);

  assert.deepEqual(amounts, {
    baseAmount: 10000,
    feeAmount: 143,
    mdrAmount: 250,
    mdrBearer: "customer",
    totalAmount: 10393,
    netAmount: 10000
  });
});

test("OmQris malformed or missing optional amount fields fail safely to documented defaults", () => {
  assert.deepEqual(normalizeOmqrisAmounts({ fee: "not-a-number", mdr_amount: -2 }, 28000), {
    baseAmount: 28000,
    feeAmount: 0,
    mdrAmount: 0,
    mdrBearer: undefined,
    totalAmount: 28000,
    netAmount: 28000
  });
});

test("OmQris accepts the documented amount equation and rejects mismatched invoices", () => {
  assert.equal(validateOmqrisAmounts({
    base_amount: 10000, fee: 143, mdr_amount: 0, mdr_bearer: "merchant",
    total_amount: 10143, net_amount: 10000
  }, 10000), null);

  assert.equal(validateOmqrisAmounts({
    base_amount: 10000, fee: 143, mdr_amount: 250, mdr_bearer: "customer",
    total_amount: 10393, net_amount: 10000
  }, 10000), null);

  assert.match(String(validateOmqrisAmounts({
    base_amount: 10000, fee: 143, mdr_amount: 0, mdr_bearer: "merchant",
    total_amount: 10142, net_amount: 10000
  }, 10000)), /Total pembayaran/);

  assert.match(String(validateOmqrisAmounts({
    base_amount: 10001, fee: 143, mdr_amount: 0, mdr_bearer: "merchant",
    total_amount: 10144, net_amount: 10001
  }, 10000)), /Nominal pokok/);

  assert.match(String(validateOmqrisAmounts({
    base_amount: 10000, mdr_amount: 0, mdr_bearer: "merchant",
    total_amount: 10000, net_amount: 10000
  }, 10000)), /fee/);
});
