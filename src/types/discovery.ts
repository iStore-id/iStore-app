export interface DiscoveryResult {
  providerId: string;
  providerProductId: string;
  providerSku: string;
  name: string;
  baseCost: number;
  isActive: boolean;
  targetFields: string[];
  metadata?: Record<string, unknown>;
}

export interface ProviderCatalogDiscoveryAdapter {
  code: string;
  discoverProducts(code?: string): Promise<DiscoveryResult[]>;
}
