import * as crypto from "crypto";
import { 
  ProviderFulfillmentRequest, 
  ProviderFulfillmentResponse,
  BaseProviderAdapter
} from "../provider-adapters.js";
import { getTokoVoucherServerConfig } from "../providers.js";
import { createTokoVoucherReference, resolveTokoVoucherReference, isTokoVoucherInsufficientBalance } from "../tokovoucher-utils.js";

export class TokoVoucherAdapter extends BaseProviderAdapter {
  code = "tokovoucher";
  
  private async getCredentials() {
    const config = await getTokoVoucherServerConfig();
    return {
      memberCode: config.memberCode || null,
      secret: config.secret || null,
      isEnabled: config.isEnabled !== undefined ? config.isEnabled : true
    };
  }

  private generateSignature(memberCode: string, secret: string, refId: string): string {
    return crypto.createHash("md5").update(`${memberCode}:${secret}:${refId}`).digest("hex");
  }

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const { memberCode, secret, isEnabled } = await this.getCredentials();
    if (!isEnabled) {
      return { success: false, message: 'TokoVoucher is disabled', latencyMs: 0 };
    }
    if (!memberCode || !secret) {
      return { success: false, message: 'TokoVoucher not configured', latencyMs: 0 };
    }
    
    const start = Date.now();
    try {
      const signature = crypto.createHash('md5').update(`${memberCode}${secret}`).digest('hex');
      const url = `https://api.tokovoucher.net/member?member_code=${encodeURIComponent(memberCode)}&signature=${signature}`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      
      const latencyMs = Date.now() - start;
      const data = await response.json();
      
      if (data.status === 1 || data.status === "1" || data.status === "Sukses" || data.member) {
        return { success: true, message: 'Connection verified', latencyMs };
      }
      
      return { success: false, message: `Connectivity check failed`, latencyMs };
    } catch (err: any) {
      return { success: false, message: `Connectivity error: ${err.message}`, latencyMs: Date.now() - start };
    }
  }

  async validate(request: ProviderFulfillmentRequest): Promise<boolean> {
    return !!request.providerSku && !!request.idempotencyKey;
  }

  async submit(request: ProviderFulfillmentRequest): Promise<ProviderFulfillmentResponse> {
    const { memberCode, secret, isEnabled } = await this.getCredentials();

    if (!isEnabled || !memberCode || !secret) {
      return { success: false, status: 'failed', message: 'TokoVoucher disabled or not configured' };
    }

    const refId = request.idempotencyKey || createTokoVoucherReference(request.orderId);
    const signature = this.generateSignature(memberCode, secret, refId);

    try {
      const response = await fetch("https://api.tokovoucher.net/v1/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref_id: refId,
          produk: request.providerSku,
          tujuan: request.customerData.destination || request.customerData.userId,
          server_id: request.customerData.serverId || request.customerData.zoneId || "",
          member_code: memberCode,
          signature
        })
      });

      const data = await response.json();
      const rawStatus = data?.status !== undefined
        ? data.status
        : (data?.data?.status !== undefined ? data.data.status : (data?.code !== undefined ? data.code : ""));
      const statusStr = String(rawStatus).toLowerCase().trim();
      const message = String(data?.error_msg || data?.message || data?.data?.message || data?.catatan || "");
      const sn = data?.sn || data?.data?.sn || data?.catatan || data?.data?.catatan || "";

      if (
        Boolean(data?.error_msg) ||
        isTokoVoucherInsufficientBalance(message) ||
        statusStr === "2" || statusStr === "gagal" || statusStr === "failed"
      ) {
        return {
          success: false,
          status: 'failed',
          providerReference: refId,
          message: message || "Transaction failed at provider",
          rawResponse: data
        };
      }

      if (statusStr === "1" || statusStr === "sukses" || statusStr === "success") {
        return {
          success: true,
          status: 'success',
          providerReference: refId,
          message: sn || message,
          rawResponse: data
        };
      }

      // Unknown, status 0, and non-final responses must be reconciled, never retried blindly.
      return {
        success: false,
        status: 'pending',
        providerReference: refId,
        message: message || "Awaiting provider confirmation",
        rawResponse: data
      };
    } catch (err) {
      return {
        success: false,
        status: 'ambiguous',
        providerReference: refId,
        message: 'Network failure - pending reconciliation'
      };
    }
  }

  async queryStatus(providerReference: string, orderId: string): Promise<ProviderFulfillmentResponse> {
    const { memberCode, secret, isEnabled } = await this.getCredentials();
    if (!isEnabled || !memberCode || !secret) {
      return { success: false, status: 'failed', message: 'TokoVoucher disabled or not configured' };
    }

    const primaryRefId = resolveTokoVoucherReference(providerReference, orderId);
    const refIds = [...new Set([primaryRefId, orderId])];
    let lastData: any = null;

    try {
      for (const refId of refIds) {
        const signature = this.generateSignature(memberCode, secret, refId);
        const query = new URLSearchParams({
          ref_id: refId,
          member_code: memberCode,
          signature
        });
        const response = await fetch(`https://api.tokovoucher.net/v1/transaksi/status?${query.toString()}`, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });
        const data = await response.json();
        lastData = data;

        const rawStatus = data?.status !== undefined
          ? data.status
          : (data?.data?.status !== undefined ? data.data.status : (data?.code !== undefined ? data.code : ""));
        const statusStr = String(rawStatus).toLowerCase().trim();
        const message = String(data?.error_msg || data?.message || data?.data?.message || data?.catatan || "");
        const notFound = /not.?found|tidak ditemukan|belum terdaftar/i.test(message);

        // Older records may have been submitted with the legacy orderId reference.
        // Only fall back when the canonical reference is explicitly not found.
        if (notFound && refId !== orderId) continue;

        if (
          Boolean(data?.error_msg) && !notFound ||
          isTokoVoucherInsufficientBalance(message) ||
          statusStr === "2" || statusStr === "gagal" || statusStr === "failed"
        ) {
          return {
            success: false,
            status: 'failed',
            providerReference: refId,
            message: message || "Transaction failed",
            rawResponse: data
          };
        }

        if (statusStr === "1" || statusStr === "sukses" || statusStr === "success") {
          const sn = data?.sn || data?.data?.sn || data?.catatan || data?.data?.catatan || "";
          return {
            success: true,
            status: 'success',
            providerReference: refId,
            message: sn || message,
            rawResponse: data
          };
        }

        if (notFound) {
          return {
            success: false,
            status: 'not_found',
            providerReference: refId,
            message: "Transaction reference was not found",
            rawResponse: data
          };
        }

        return {
          success: false,
          status: 'pending',
          providerReference: refId,
          message: message || "Processing",
          rawResponse: data
        };
      }

      return {
        success: false,
        status: 'not_found',
        providerReference: primaryRefId,
        message: "Transaction reference was not found",
        rawResponse: lastData
      };
    } catch (err) {
      return { success: false, status: 'ambiguous', providerReference: primaryRefId, message: 'Status check failed' };
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unavailable'; message?: string }> {
    return { status: 'unavailable', message: 'Health check pending API documentation' };
  }
}
