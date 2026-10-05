import { RoutingDecision } from "../types/core.js";

export interface ProviderFulfillmentRequest {
  orderId: string;
  providerSku: string;
  customerData: Record<string, any>;
  metadata?: Record<string, any>;
  idempotencyKey: string;
}

export interface ProviderFulfillmentResponse {
  success: boolean;
  providerReference?: string;
  status: 'pending' | 'success' | 'failed' | 'ambiguous' | 'not_found';
  rawResponse?: any;
  message?: string;
}

export interface ProviderAdapter {
  code: string;
  
  /**
   * Validates if the request can be processed by this provider
   */
  validate(request: ProviderFulfillmentRequest): Promise<boolean>;
  
  /**
   * Submits the transaction to the provider API
   */
  submit(request: ProviderFulfillmentRequest): Promise<ProviderFulfillmentResponse>;
  
  /**
   * Queries the status of an existing transaction
   */
  queryStatus(providerReference: string, orderId: string): Promise<ProviderFulfillmentResponse>;
  
  /**
   * Performs a non-transactional connectivity test
   */
  testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }>;
  
  /**
   * Checks the health of the provider API
   */
  healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unavailable'; message?: string }>;
}

export class ProviderAdapterRegistry {
  private static instance: ProviderAdapterRegistry;
  private adapters: Map<string, ProviderAdapter> = new Map();

  private constructor() {}

  public static getInstance(): ProviderAdapterRegistry {
    if (!ProviderAdapterRegistry.instance) {
      ProviderAdapterRegistry.instance = new ProviderAdapterRegistry();
    }
    return ProviderAdapterRegistry.instance;
  }

  registerAdapter(adapter: ProviderAdapter) {
    this.adapters.set(adapter.code, adapter);
  }

  getAdapter(code: string): ProviderAdapter | undefined {
    return this.adapters.get(code);
  }
}

// FUTURE: Base class for common logic
export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract code: string;
  abstract validate(request: ProviderFulfillmentRequest): Promise<boolean>;
  abstract submit(request: ProviderFulfillmentRequest): Promise<ProviderFulfillmentResponse>;
  abstract queryStatus(providerReference: string, orderId: string): Promise<ProviderFulfillmentResponse>;
  abstract testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }>;
  abstract healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unavailable'; message?: string }>;

  protected normalizeError(error: any): ProviderFulfillmentResponse {
    return {
      success: false,
      status: 'failed',
      message: error.message || "Unknown provider error",
      rawResponse: error
    };
  }
}
