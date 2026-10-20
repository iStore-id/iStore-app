import * as crypto from "crypto";

export function createNasionalPaySignature(rawBody: Buffer | string, storeKey: string): string {
  return crypto.createHmac("sha256", storeKey).update(rawBody).digest("hex");
}

export function safeNasionalPaySignatureEqual(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function mapNasionalPayStatus(status: unknown): "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" {
  const value = String(status || "").trim().toLowerCase();
  if (value === "success" || value === "paid" || value === "settlement") return "PAID";
  if (value === "expired") return "EXPIRED";
  if (value === "failed" || value === "cancelled" || value === "canceled") return "FAILED";
  return "PENDING";
}

export function normalizeNasionalPayAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Nominal transaksi NasionalPay tidak valid.");
  }
  return amount;
}
