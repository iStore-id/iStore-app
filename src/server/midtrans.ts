import { SupabasePaymentRepository } from "./supabase/payment-repository.js";
import * as crypto from "crypto";

let ENCRYPTION_KEY: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY;

  const secret = process.env.SESSION_SECRET || "istore-secure-midtrans-secret-key-2026";

  ENCRYPTION_KEY = crypto.scryptSync(secret, "salt", 32);
  return ENCRYPTION_KEY;
}

const IV_LENGTH = 16;

export function encryptSecret(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptSecret(text: string): string {
  if (!text) return "";
  try {
    const parts = text.split(":");
    if (parts.length !== 2) return text;
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return text;
  }
}

export async function getMidtransServerConfig() {
  const repo = SupabasePaymentRepository.getInstance();
  const config = await repo.getMidtransConfig();

  if (!config.isActive) {
    throw new Error("Midtrans Payment Gateway saat ini dinonaktifkan.");
  }
  
  if (config.serverKey) process.env.MIDTRANS_SERVER_KEY = config.serverKey;
  if (config.merchantId) process.env.MIDTRANS_MERCHANT_ID = config.merchantId;
  process.env.MIDTRANS_IS_PRODUCTION = config.isProduction ? "true" : "false";

  return config;
}

export async function testMidtransConnection(serverKey: string, isProduction: boolean) {
  if (!serverKey) {
    return { success: false, message: "Server Key tidak boleh kosong." };
  }
  
  // Non-transactional status check against Midtrans API using a dummy non-existent order ID
  // A valid server key returns 404 ("Transaction does not exist"), whereas invalid key returns 401.
  const apiUrl = isProduction 
    ? "https://api.midtrans.com/v2/ISTORE_TEST_CONNECTION_PING/status" 
    : "https://api.sandbox.midtrans.com/v2/ISTORE_TEST_CONNECTION_PING/status";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${Buffer.from(serverKey + ":").toString("base64")}`,
        "Accept": "application/json"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, message: "Koneksi Gagal: Server Key tidak valid (401 Unauthorized)." };
    }

    // 404 means the endpoint was reached and authenticated successfully but the test order id doesn't exist
    if (response.status === 404 || response.ok) {
      return { success: true, message: "Koneksi Berhasil: Autentikasi Midtrans Server Key valid." };
    }

    const text = await response.text();
    return { success: false, message: `Midtrans Error (${response.status}): ${text}` };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, message: "Koneksi Timeout: Midtrans API tidak merespons dalam 10 detik." };
    }
    return { success: false, message: `Network Error: ${err.message || "Gagal menghubungi Midtrans."}` };
  }
}

export async function createMidtransTransaction({
  orderId,
  grossAmount,
  customerDetails,
  itemDetails,
  paymentMethod
}: {
  orderId: string;
  grossAmount: number;
  customerDetails: { first_name: string; email: string; phone: string };
  itemDetails: Array<{ id: string; price: number; quantity: number; name: string }>;
  paymentMethod?: string;
}) {
  const config = await getMidtransServerConfig();
  const apiUrl = config.isProduction ? "https://app.midtrans.com/snap/v1/transactions" : "https://app.sandbox.midtrans.com/snap/v1/transactions";

  let enabledPayments: string[] | undefined = undefined;
  if (paymentMethod === "qris") {
    enabledPayments = ["other_qris"];
  } else if (paymentMethod === "gopay") {
    enabledPayments = ["gopay"];
  } else if (paymentMethod === "shopeepay") {
    enabledPayments = ["shopeepay"];
  } else if (paymentMethod === "bca_va") {
    enabledPayments = ["bca_va"];
  } else if (paymentMethod === "bni_va") {
    enabledPayments = ["bni_va"];
  } else if (paymentMethod === "bri_va") {
    enabledPayments = ["bri_va"];
  } else if (paymentMethod === "echannel") {
    enabledPayments = ["echannel"];
  } else if (paymentMethod === "permata_va") {
    enabledPayments = ["permata_va"];
  } else if (paymentMethod === "other_va") {
    enabledPayments = ["other_va"];
  }

  const payload: any = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount
    },
    customer_details: customerDetails,
    item_details: itemDetails
  };

  if (enabledPayments && enabledPayments.length > 0) {
    payload.enabled_payments = enabledPayments;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Basic ${Buffer.from(config.serverKey + ":").toString("base64")}`,
      "Idempotency-Key": orderId
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Midtrans Error: ${text}`);
  }

  const data = await response.json();
  return { token: data.token, redirectUrl: data.redirect_url };
}

export async function checkMidtransStatus(orderId: string) {
  const config = await getMidtransServerConfig();
  const apiUrl = config.isProduction ? `https://api.midtrans.com/v2/${orderId}/status` : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${Buffer.from(config.serverKey + ":").toString("base64")}`,
      "Accept": "application/json"
    }
  });

  if (!response.ok) return null;
  return await response.json();
}

export async function refundMidtransTransaction({
  orderId,
  refundKey,
  amount,
  reason
}: {
  orderId: string;
  refundKey: string;
  amount: number;
  reason: string;
}) {
  const config = await getMidtransServerConfig();
  const apiUrl = config.isProduction 
    ? `https://api.midtrans.com/v2/${orderId}/refund` 
    : `https://api.sandbox.midtrans.com/v2/${orderId}/refund`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Basic ${Buffer.from(config.serverKey + ":").toString("base64")}`
    },
    body: JSON.stringify({
      refund_key: refundKey,
      amount: amount,
      reason: reason
    })
  });

  if (!response.ok) {
    const text = await response.text();
    let errorData: any = null;
    try {
      errorData = JSON.parse(text);
    } catch {
      // ignore
    }
    throw {
      message: errorData?.status_message || `Midtrans HTTP Error: ${text}`,
      statusCode: response.status,
      raw: text
    };
  }

  return await response.json();
}

export function verifySignatureKey(orderId: string, statusCode: string, grossAmount: string, signatureKey: string) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const inputString = orderId + statusCode + grossAmount + serverKey;
  const hash = crypto.createHash("sha512").update(inputString).digest("hex");
  return hash === signatureKey;
}

