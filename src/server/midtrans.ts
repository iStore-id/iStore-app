import { adminDb } from "./firebase-admin";
import crypto from "crypto";

const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SESSION_SECRET || "istore-secure-midtrans-secret-key-2026",
  "salt",
  32
);
const IV_LENGTH = 16;

export function encryptSecret(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
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
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return text;
  }
}

export async function getMidtransServerConfig() {
  try {
    const snap = await adminDb.collection("systemConfigs").where("key", "==", "midtrans_integration").limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      const merchantId = data.merchantId || process.env.MIDTRANS_MERCHANT_ID || "";
      const encryptedKey = data.encryptedServerKey || "";
      const serverKey = encryptedKey ? decryptSecret(encryptedKey) : (process.env.MIDTRANS_SERVER_KEY || "");
      const clientKey = data.clientKey || process.env.VITE_MIDTRANS_CLIENT_KEY || "";
      const isProduction = data.isProduction !== undefined ? data.isProduction : (process.env.MIDTRANS_IS_PRODUCTION === "true");
      
      // Sync process.env for synchronous consumers
      if (serverKey) process.env.MIDTRANS_SERVER_KEY = serverKey;
      if (merchantId) process.env.MIDTRANS_MERCHANT_ID = merchantId;
      process.env.MIDTRANS_IS_PRODUCTION = isProduction ? "true" : "false";

      return { 
        merchantId, 
        serverKey, 
        clientKey,
        isProduction, 
        configured: !!serverKey, 
        lastTestedAt: data.lastTestedAt, 
        lastTestResult: data.lastTestResult 
      };
    }
  } catch (err) {
    console.warn("Failed to load Midtrans config from DB:", err);
  }
  return {
    merchantId: process.env.MIDTRANS_MERCHANT_ID || "",
    serverKey: process.env.MIDTRANS_SERVER_KEY || "",
    clientKey: process.env.VITE_MIDTRANS_CLIENT_KEY || "",
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    configured: !!process.env.MIDTRANS_SERVER_KEY,
    lastTestedAt: null,
    lastTestResult: null
  };
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
  itemDetails
}: {
  orderId: string;
  grossAmount: number;
  customerDetails: { first_name: string; email: string; phone: string };
  itemDetails: Array<{ id: string; price: number; quantity: number; name: string }>;
}) {
  const config = await getMidtransServerConfig();
  const apiUrl = config.isProduction ? "https://app.midtrans.com/snap/v1/transactions" : "https://app.sandbox.midtrans.com/snap/v1/transactions";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Basic ${Buffer.from(config.serverKey + ":").toString("base64")}`,
      "Idempotency-Key": orderId
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount
      },
      customer_details: customerDetails,
      item_details: itemDetails
    })
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
  const crypto = require("crypto");
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const inputString = orderId + statusCode + grossAmount + serverKey;
  const hash = crypto.createHash("sha512").update(inputString).digest("hex");
  return hash === signatureKey;
}

