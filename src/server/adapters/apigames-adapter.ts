import * as crypto from "crypto";
import { 
  ProviderAdapter, 
  ProviderFulfillmentRequest, 
  ProviderFulfillmentResponse,
  BaseProviderAdapter
} from "../provider-adapters.js";
import { getApiGamesServerConfig } from "../providers.js";

// API Games Adapter with real integration logic
export class ApiGamesAdapter extends BaseProviderAdapter {
  code = "apigames";
  
  private async getCredentials(): Promise<{ merchantId: string | null; secretKey: string | null }> {
    try {
      const config = await getApiGamesServerConfig();
      return { 
        merchantId: config.merchantId || null, 
        secretKey: config.secret || null 
      };
    } catch {
      return { merchantId: null, secretKey: null };
    }
  }

  private async generateSignature(refId: string): Promise<string> {
    const { merchantId, secretKey } = await this.getCredentials();
    if (!merchantId || !secretKey) throw new Error("APIGames credentials not configured");
    const str = `${merchantId}:${secretKey}:${refId}`;
    return crypto.createHash('md5').update(str).digest('hex');
  }

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const { merchantId, secretKey } = await this.getCredentials();
    if (!merchantId || !secretKey) {
      return { success: false, message: 'APIGames not configured', latencyMs: 0 };
    }

    const start = Date.now();
    try {
      const refId = "TEST";
      const signature = crypto.createHash('md5').update(`${merchantId}:${secretKey}:${refId}`).digest('hex');
      
      const response = await fetch(`https://v1.apigames.id/v2/transaksi/status?merchant_id=${merchantId}&ref_id=${refId}&signature=${signature}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      const latencyMs = Date.now() - start;
      
      if (response.status === 200 || response.status === 404 || response.status === 400) {
        return { success: true, message: 'Connection verified', latencyMs };
      }
      
      return { success: false, message: `Connectivity check failed: HTTP ${response.status}`, latencyMs };
    } catch (err: any) {
      return { success: false, message: `Connectivity error: ${err.message}`, latencyMs: Date.now() - start };
    }
  }

  async validate(request: ProviderFulfillmentRequest): Promise<boolean> {
    return !!request.providerSku && !!request.idempotencyKey;
  }

  async submit(request: ProviderFulfillmentRequest): Promise<ProviderFulfillmentResponse> {
    const { merchantId, secretKey } = await this.getCredentials();
    if (!merchantId || !secretKey) {
      return { success: false, status: 'failed', message: 'APIGames not configured' };
    }

    const refId = request.idempotencyKey;
    const signature = await this.generateSignature(refId);

    try {
      const response = await fetch("https://v1.apigames.id/v2/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref_id: refId,
          merchant_id: merchantId,
          produk: request.providerSku,
          tujuan: request.customerData.destination,
          server_id: request.customerData.serverId || "",
          signature: signature
        })
      });

      if (!response.ok) {
        return { success: false, status: 'pending', message: 'HTTP Error - Pending reconciliation' };
      }

      const data = await response.json();
      
      const statusMap: Record<string, 'pending' | 'success' | 'failed' | 'ambiguous'> = {
        'Sukses': 'success',
        'Gagal': 'failed',
        'Pending': 'pending',
        'Proses': 'pending',
        'Sukses Sebagian': 'pending',
        'Validasi Provider': 'pending'
      };

      const status = statusMap[data.status] || 'pending';
      
      return {
        success: status === 'success',
        status: status,
        providerReference: data.ref_id,
        message: data.message
      };
    } catch (err) {
      return { success: false, status: 'pending', message: 'Network failure - Pending reconciliation' };
    }
  }

  async queryStatus(providerReference: string, orderId: string): Promise<ProviderFulfillmentResponse> {
    const { merchantId, secretKey } = await this.getCredentials();
    if (!merchantId || !secretKey) {
      return { success: false, status: 'failed', message: 'APIGames not configured' };
    }

    // The ref_id to query. The new adapter uses orderId-REQ, legacy uses orderId.
    // We prefer providerReference if available (which should be the ref_id we sent).
    const refId = providerReference || `${orderId}-REQ`;
    const signature = await this.generateSignature(refId);

    try {
      const response = await fetch(`https://v1.apigames.id/v2/transaksi/status?merchant_id=${merchantId}&ref_id=${refId}&signature=${signature}`, {
        method: "GET"
      });

      if (response.status === 404) {
        return { success: false, status: 'not_found', message: 'Transaction not found at provider (404)' };
      }

      if (!response.ok) {
        return { success: false, status: 'ambiguous', message: `HTTP Error ${response.status}` };
      }

      const data = await response.json();
      
      // APIGames status mapping based on observed provider behavior
      const statusMap: Record<string, 'pending' | 'success' | 'failed' | 'ambiguous'> = {
        'Sukses': 'success',
        'Gagal': 'failed',
        'Pending': 'pending',
        'Proses': 'pending',
        'Sukses Sebagian': 'pending',
        'Validasi Provider': 'pending'
      };

      // Extract status from either top-level or data object
      const rawProviderStatus = data.status || (data.data && data.data.status);
      
      // Explicit NOT_FOUND check in response body
      const isNotFound = !rawProviderStatus && (
        (data.error_msg && data.error_msg.toLowerCase().includes('tidak ditemukan')) ||
        (data.message && data.message.toLowerCase().includes('tidak ditemukan')) ||
        (data.status === 0 && data.error_msg?.includes('Invalid'))
      );

      if (isNotFound) {
        return { success: false, status: 'not_found', message: data.error_msg || data.message || 'Transaction not found' };
      }

      const status = statusMap[rawProviderStatus] || 'ambiguous';
      
      return {
        success: status === 'success',
        status: status,
        providerReference: data.ref_id || (data.data && data.data.ref_id) || providerReference,
        message: data.message || data.error_msg,
        rawResponse: data
      };
    } catch (err: any) {
      return { success: false, status: 'ambiguous', message: `Status check failed: ${err.message}` };
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unavailable'; message?: string }> {
    return { status: 'unavailable', message: 'Health check pending API documentation' };
  }
}
