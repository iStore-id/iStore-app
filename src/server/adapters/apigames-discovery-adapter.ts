import { DiscoveryResult, ProviderCatalogDiscoveryAdapter } from "../../types/discovery.js";
import { getApiGamesServerConfig } from "../providers.js";
import * as crypto from "crypto";

export class ApiGamesDiscoveryAdapter implements ProviderCatalogDiscoveryAdapter {
  code = "apigames";

  async discoverProducts(code?: string): Promise<DiscoveryResult[]> {
    const config = await getApiGamesServerConfig();
    if (!config.merchantId || !config.secret) {
      throw new Error("API Games credentials are not configured in Admin > Providers > Tab Integration.");
    }

    try {
      // Primary candidate for price list in many resellers using this engine
      const url = "https://v1.apigames.id/merchant/pricelist";
      // Try common signature pattern for this endpoint
      const signature = crypto.createHash("md5").update(`${config.merchantId}:${config.secret}`).digest("hex");
      
      const response = await fetch(`${url}?merchant_id=${config.merchantId}&signature=${signature}`);
      const data = await response.json();

      if (data.status === 1 || data.rc === 200) {
        const products = Array.isArray(data.data) ? data.data : [];
        return products.map((p: any) => ({
          providerId: "apigames",
          providerProductId: p.id || p.code || "",
          providerSku: p.code || "",
          name: p.product_name || p.name || "Unknown",
          baseCost: parseFloat(p.price || 0),
          isActive: true,
          targetFields: ["userId", "zoneId"], // Standard for games
          metadata: {
            category: p.category,
            operator: p.operator
          }
        }));
      }

      // If specific endpoint fails, provide a clear explanation as requested by user
      if (data.error_msg === "Invalid signature" || data.rc === 401) {
         throw new Error("APIGames API returned 'Invalid signature'. Please verify your Merchant ID and Secret Key in Admin > Providers tab.");
      }

      throw new Error(`APIGames Discovery Error: ${data.error_msg || "Endpoint not found or permission denied for this account type."}`);
    } catch (err: any) {
      if (err.message.includes("APIGames")) throw err;
      throw new Error(`Discovery APIGames failed: ${err.message}. Note: Some APIGames account levels do not support catalog discovery via API.`);
    }
  }
}
