import test from "node:test";
import assert from "node:assert/strict";
import {
  createTokoVoucherReference,
  isTokoVoucherInsufficientBalance,
  normalizeTokoVoucherFailureReason,
  resolveTokoVoucherReference,
  toCustomerOrderView
} from "./tokovoucher-utils.js";

test("TokoVoucher submit and status inquiry share one canonical ref_id", () => {
  assert.equal(createTokoVoucherReference("order-123"), "order-123-REQ");
  assert.equal(resolveTokoVoucherReference("TV-order-123-REQ", "order-123"), "order-123-REQ");
  assert.equal(resolveTokoVoucherReference(null, "order-123"), "order-123-REQ");
});

test("insufficient supplier balance is normalized as a definitive failure reason", () => {
  assert.equal(isTokoVoucherInsufficientBalance("GAGAL, Saldo member tidak cukup, Sisa Saldo 100. HRG:1580."), true);
  assert.equal(isTokoVoucherInsufficientBalance("insufficient balance"), true);
  assert.equal(normalizeTokoVoucherFailureReason("Saldo member tidak cukup"), "Saldo member tidak mencukupi");
  assert.equal(isTokoVoucherInsufficientBalance("connection timeout"), false);
});

test("buyer order view excludes all supplier and internal diagnostics", () => {
  const view = toCustomerOrderView({
    id: "order-123",
    invoice: "INV-123",
    userId: "private-user-id",
    productName: "MLBB Diamonds",
    providerId: "tokovoucher",
    providerSku: "MLD5",
    providerReferenceId: "order-123-REQ",
    fulfillmentResponse: { rawResponse: { error_msg: "Saldo member tidak cukup" } },
    failureReason: "Saldo member tidak mencukupi",
    gatewayResponse: {
      rail: "qris",
      totalAmount: 1740,
      secret: "must-not-leak",
      providerResponse: { member_code: "private" }
    },
    customerData: { userId: "123456", serverId: "1234", email: "private@example.test" },
    paymentStatus: "paid",
    transactionStatus: "failed"
  }, false);

  assert.equal(view.productName, "MLBB Diamonds");
  assert.equal(view.paymentStatus, "paid");
  assert.equal(view.transactionStatus, "failed");
  assert.deepEqual(view.gatewayResponse, { rail: "qris", totalAmount: 1740 });
  assert.deepEqual(view.customerData, { userId: "123456", serverId: "1234" });
  for (const forbidden of ["userId", "providerId", "providerSku", "providerReferenceId", "fulfillmentResponse", "failureReason", "gatewayResponse"]) {
    if (forbidden !== "gatewayResponse") assert.equal(Object.hasOwn(view, forbidden), false);
  }
  assert.equal(JSON.stringify(view).includes("Saldo member"), false);
  assert.equal(JSON.stringify(view).includes("tokovoucher"), false);
  assert.equal(JSON.stringify(view).includes("MLD5"), false);
});
