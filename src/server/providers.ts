export interface ProviderAdapter {
  createTransaction(order: any): Promise<{ success: boolean; reference?: string; message?: string }>;
  checkTransaction(reference: string): Promise<{ status: string; message?: string; serialNumber?: string }>;
}

export class ApiGamesProvider implements ProviderAdapter {
  private async getCredentials() {
    const config = await getApiGamesServerConfig();
    return {
      merchantId: config.merchantId,
      secret: config.secret
    };
  }

  private generateSignature(merchantId: string, secret: string, refId: string) {
    const crypto = require("crypto");
    // Format: md5(merchant_id:secret_key:ref_id)
    return crypto.createHash("md5").update(`${merchantId}:${secret}:${refId}`).digest("hex");
  }

  async createTransaction(order: any) {
    const { merchantId, secret } = await this.getCredentials();
    if (!merchantId || !secret) {
      return { success: false, message: "API Games credentials not configured." };
    }

    console.log(`[API GAMES] Creating transaction for ${order.id} with product ${order.providerProductId}`);
    
    try {
      const response = await fetch('https://v1.apigames.id/v2/transaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref_id: order.id,
          merchant_id: merchantId,
          produk: order.providerProductId,
          tujuan: order.customerData.userId,
          server_id: order.customerData.zoneId || "",
          signature: this.generateSignature(merchantId, secret, order.id)
        })
      });
      
      const data = await response.json();
      
      if (data.status === 0 || data.status === "0" || data.error_msg) {
         return { success: false, message: data.error_msg || "Transaction failed at provider" };
      }
      
      // APIGames usually returns TrxID in data
      return { success: true, reference: data.data?.trx_id || `AG-${order.id}` };
    } catch (error: any) {
      console.error("[APIGames Error]", error);
      return { success: false, message: error.message };
    }
  }

  async checkTransaction(refId: string) {
    const { merchantId, secret } = await this.getCredentials();
    if (!merchantId || !secret) {
      return { status: "processing", message: "API Games not configured" };
    }

    try {
      // NOTE: Using general structure, specific check endpoint might vary
      const response = await fetch(`https://v1.apigames.id/v2/transaksi?ref_id=${refId}&merchant_id=${merchantId}&signature=${this.generateSignature(merchantId, secret, refId)}`);
      const data = await response.json();
      
      if (data.data?.status === "Sukses") {
         return { status: "success", serialNumber: data.data?.sn || "SN-FOUND" };
      } else if (data.data?.status === "Gagal") {
         return { status: "failed", message: data.data?.sn };
      }
      return { status: "processing" };
    } catch (error: any) {
       return { status: "processing", message: error.message };
    }
  }
}

import { adminDb } from "./firebase-admin";
import { decryptSecret } from "./midtrans";
import crypto from "crypto";

export async function getApiGamesServerConfig() {
  try {
    const snap = await adminDb.collection("systemConfigs").where("key", "==", "apigames_integration").limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      const encryptedMerchantId = data.encryptedMerchantId || "";
      const encryptedSecretKey = data.encryptedSecretKey || "";
      
      const merchantId = encryptedMerchantId ? decryptSecret(encryptedMerchantId) : (process.env.APIGAMES_MERCHANT_ID || "");
      const secret = encryptedSecretKey ? decryptSecret(encryptedSecretKey) : (process.env.APIGAMES_SECRET || "");
      
      if (merchantId) process.env.APIGAMES_MERCHANT_ID = merchantId;
      if (secret) process.env.APIGAMES_SECRET = secret;
      
      return { merchantId, secret, configured: !!(merchantId && secret) };
    }
  } catch (e) {
    // fallback
  }
  return {
    merchantId: process.env.APIGAMES_MERCHANT_ID || "",
    secret: process.env.APIGAMES_SECRET || "",
    configured: !!(process.env.APIGAMES_MERCHANT_ID && process.env.APIGAMES_SECRET)
  };
}

export async function getTokoVoucherServerConfig() {
  try {
    const snap = await adminDb.collection("systemConfigs").where("key", "==", "tokovoucher_integration").limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      const memberCode = data.memberCode || process.env.TOKOVOUCHER_MEMBER_CODE || "";
      const encryptedKey = data.encryptedSecretKey || "";
      const secret = encryptedKey ? decryptSecret(encryptedKey) : (process.env.TOKOVOUCHER_SECRET || "");
      const isEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
      
      if (memberCode) process.env.TOKOVOUCHER_MEMBER_CODE = memberCode;
      if (secret) process.env.TOKOVOUCHER_SECRET = secret;
      
      return { memberCode, secret, isEnabled };
    }
  } catch (e) {
    // fallback
  }
  return {
    memberCode: process.env.TOKOVOUCHER_MEMBER_CODE || "",
    secret: process.env.TOKOVOUCHER_SECRET || "",
    isEnabled: true
  };
}

export async function testTokoVoucherConnection(memberCode: string, secret: string) {
  if (!memberCode || !secret) {
    return { success: false, message: "Member Code dan Secret Key TokoVoucher belum dikonfigurasi." };
  }
  try {
    const signature = crypto.createHash('md5').update(`${memberCode}${secret}`).digest('hex');
    const url = `https://api.tokovoucher.net/member?member_code=${encodeURIComponent(memberCode)}&signature=${signature}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const data = await response.json();
    
    if (data.status === 1 || data.status === "1" || data.status === "Sukses" || data.member || data.balance !== undefined || data.saldo !== undefined) {
      return {
        success: true,
        message: "Koneksi TokoVoucher berhasil diverifikasi.",
        data: {
          memberName: data.member?.nama || data.nama || data.username || "TokoVoucher Member",
          balance: data.member?.saldo || data.balance || data.saldo || 0,
          memberCode
        }
      };
    }
    
    const signatureAlt = crypto.createHash('md5').update(`${memberCode}:${secret}`).digest('hex');
    const urlAlt = `https://api.tokovoucher.net/member?member_code=${encodeURIComponent(memberCode)}&signature=${signatureAlt}`;
    const responseAlt = await fetch(urlAlt, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const dataAlt = await responseAlt.json();
    if (dataAlt.status === 1 || dataAlt.status === "1" || dataAlt.status === "Sukses" || dataAlt.member || dataAlt.balance !== undefined || dataAlt.saldo !== undefined) {
      return {
        success: true,
        message: "Koneksi TokoVoucher berhasil diverifikasi.",
        data: {
          memberName: dataAlt.member?.nama || dataAlt.nama || dataAlt.username || "TokoVoucher Member",
          balance: dataAlt.member?.saldo || dataAlt.balance || dataAlt.saldo || 0,
          memberCode
        }
      };
    }

    return {
      success: false,
      message: data.error_msg || data.message || dataAlt.error_msg || dataAlt.message || "Autentikasi TokoVoucher gagal (Signature/Kredensial tidak valid)."
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Network error / Timeout saat menghubungkan ke TokoVoucher: ${error.message}`
    };
  }
}

export class TokoVoucherProvider implements ProviderAdapter {
  private async getCredentials() {
    const config = await getTokoVoucherServerConfig();
    return {
      memberCode: config.memberCode,
      secret: config.secret,
      isEnabled: config.isEnabled
    };
  }

  private generateSignature(memberCode: string, secret: string, refId: string) {
    return crypto.createHash("md5").update(`${memberCode}:${secret}:${refId}`).digest("hex");
  }

  async createTransaction(order: any) {
    const { memberCode, secret, isEnabled } = await this.getCredentials();
    if (!isEnabled) {
      return { success: false, message: "TokoVoucher provider is currently disabled by Owner." };
    }
    if (!memberCode || !secret) {
      return { success: false, message: "TokoVoucher credentials not configured." };
    }

    console.log(`[TOKOVOUCHER] Creating transaction for ${order.id} with product ${order.providerProductId}`);
    
    try {
      const signature = this.generateSignature(memberCode, secret, order.id);
      const response = await fetch('https://api.tokovoucher.net/v1/transaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref_id: order.id,
          produk: order.providerProductId,
          tujuan: order.customerData.userId,
          server_id: order.customerData.zoneId || "",
          member_code: memberCode,
          signature
        })
      });
      
      const data = await response.json();
      
      if (data.status === 0 || data.status === "0" || data.error_msg) {
         return { success: false, message: data.error_msg || "Transaction failed at provider" };
      }
      
      return { success: true, reference: data.trx_id || `TV-${order.id}` };
    } catch (error: any) {
      console.error("[TokoVoucher Error]", error);
      return { success: true, message: error.message, reference: `TV-PENDING-${order.id}` };
    }
  }

  async checkTransaction(refId: string) {
    const { memberCode, secret, isEnabled } = await this.getCredentials();
    if (!isEnabled || !memberCode || !secret) {
      return { status: "processing", message: "TokoVoucher disabled or not configured" };
    }

    try {
      const signature = this.generateSignature(memberCode, secret, refId);
      const response = await fetch(`https://api.tokovoucher.net/v1/transaksi/status?ref_id=${refId}&member_code=${memberCode}&signature=${signature}`);
      const data = await response.json();
      
      if (data.status === "Sukses" || data.status === 1 || data.data?.status === "Sukses") {
         return { status: "success", serialNumber: data.sn || data.data?.sn || "SN-FOUND" };
      } else if (data.status === "Gagal" || data.status === 2 || data.data?.status === "Gagal") {
         return { status: "failed", message: data.sn || data.data?.sn };
      }
      return { status: "processing" };
    } catch (error: any) {
       return { status: "processing", message: error.message };
    }
  }
}

export function getProvider(name: string): ProviderAdapter {
  if (name === "apigames") return new ApiGamesProvider();
  if (name === "tokovoucher") return new TokoVoucherProvider();
  throw new Error(`Provider ${name} not supported`);
}
