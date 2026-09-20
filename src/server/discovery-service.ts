import { DiscoveryResult, ProviderCatalogDiscoveryAdapter } from "../types/discovery.js";

export class ProviderCatalogDiscoveryService {
  private adapters: Map<string, ProviderCatalogDiscoveryAdapter> = new Map();

  constructor() {}

  registerAdapter(adapter: ProviderCatalogDiscoveryAdapter) {
    this.adapters.set(adapter.code, adapter);
  }

  async discover(providerCode: string, code?: string): Promise<DiscoveryResult[]> {
    const adapter = this.adapters.get(providerCode);
    if (!adapter) {
      throw new Error(`Adapter for ${providerCode} not found`);
    }
    return await adapter.discoverProducts(code);
  }

  getSupportedProviders(): string[] {
    return Array.from(this.adapters.keys());
  }
}
