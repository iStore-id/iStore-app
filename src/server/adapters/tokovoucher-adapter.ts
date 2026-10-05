import * as crypto from "crypto";
import { 
  ProviderFulfillmentRequest, 
  ProviderFulfillmentResponse,
  BaseProviderAdapter
} from "../provider-adapters.js";
import { getTokoVoucherServerConfig } from "../providers.js";

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
    
    if (!isEnabled) {
      return { success: false, status: 'failed', message: 'TokoVoucher disabled' };
    }
    if (!memberCode || !secret) {
      return { success: false, status: 'failed', message: 'TokoVoucher not configured' };
    }
    
    const refId = request.idempotencyKey;
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
          signature: signature
        })
      });

      const data = await response.json();
      
      const rawStatus = data?.status !== undefined ? data.status : (data?.data?.status !== undefined ? data.data.status : (data?.code !== undefined ? data.code : ""));
      const statusStr = String(rawStatus).toLowerCase().trim();
      const sn = data?.sn || data?.data?.sn || data?.catatan || data?.data?.catatan || "";
      
      // 1. Explicit failure check
      if (data.error_msg || statusStr === "2" || statusStr === "gagal" || statusStr === "failed") {
        return { 
          success: false, 
          status: 'failed', 
          message: data.error_msg || data.message || "Transaction failed at provider" 
        };
      }
      
      // 2. Explicit success check: Map to 'success' if provider returns 1, sukses, or success.
      if (statusStr === "1" || statusStr === "sukses" || statusStr === "success") {
        return {
          success: true,
          status: 'success',
          providerReference: data.trx_id || data.data?.trx_id || `TV-${refId}`,
          message: sn || data.message
        };
      }
      
      // 3. All other cases (status 0, unknown status) are PENDING.
      // This ensures reconciliation will verify the final state asynchronously.
      return {
        success: false,
        status: 'pending',
        providerReference: data.trx_id || data.data?.trx_id || `TV-${refId}`,
        message: data.message || "Awaiting provider confirmation"
      };
    } catch (err) {
      return { success: false, status: 'pending', message: 'Network failure - Pending reconciliation' };
    }
  }

  async queryStatus(providerReference: string, orderId: string): Promise<ProviderFulfillmentResponse> {
    const { memberCode, secret, isEnabled } = await this.getCredentials();
    if (!isEnabled || !memberCode || !secret) {
      return { success: false, status: 'failed', message: 'TokoVoucher disabled or not configured' };
    }
    
    const signature = this.generateSignature(memberCode, secret, orderId);
    
    try {
      const response = await fetch(`https://api.tokovoucher.net/v1/transaksi/status?ref_id=${orderId}&member_code=${memberCode}&signature=${signature}`, {
        method: "GET"
      });
      const data = await response.json();
      
      const rawStatus = data?.status !== undefined ? data.status : (data?.data?.status !== undefined ? data.data.status : (data?.code !== undefined ? data.code : ""));
      const statusStr = String(rawStatus).toLowerCase().trim();
      const sn = data?.sn || data?.data?.sn || data?.catatan || data?.data?.catatan || "";
      
      if (statusStr === "1" || statusStr === "sukses" || statusStr === "success") {
        return { success: true, status: 'success', message: sn };
      } else if (statusStr === "2" || statusStr === "gagal" || statusStr === "failed") {
        return { success: false, status: 'failed', message: sn || data?.message || "Transaction failed" };
      } else {
        return { success: false, status: 'pending', message: 'Processing' };
      }
    } catch (err) {
      return { success: false, status: 'ambiguous', message: 'Status check failed' };
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unavailable'; message?: string }> {
    return { status: 'unavailable', message: 'Health check pending API documentation' };
  }
}
