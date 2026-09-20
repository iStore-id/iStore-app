import { DiscoveryResult, ProviderCatalogDiscoveryAdapter } from "../../types/discovery.js";
import { getTokoVoucherServerConfig } from "../providers.js";
import * as crypto from "crypto";

export class TokoVoucherDiscoveryAdapter implements ProviderCatalogDiscoveryAdapter {
  code = "tokovoucher";

  async discoverProducts(code?: string): Promise<DiscoveryResult[]> {
    const config = await getTokoVoucherServerConfig();
    if (!config.memberCode || !config.secret) {
      throw new Error("NOT_CONFIGURED");
    }

    const kode = code || "";
    const signature = crypto.createHash('md5').update(`${config.memberCode}:${config.secret}`).digest('hex');
    
    // 1. Fetch categories and then operators for each category efficiently into a lookup map
    const operatorLogoMap = new Map<string, string>();
    try {
      const catUrl = `https://api.tokovoucher.net/member/produk/category/list?member_code=${encodeURIComponent(config.memberCode)}&signature=${signature}`;
      const catRes = await fetch(catUrl);
      if (catRes.ok) {
        const catData = await catRes.json();
        const categories = Array.isArray(catData.data) ? catData.data : (catData.data ? [catData.data] : []);
        
        // Fetch operators for each category (capped/efficiently)
        for (const cat of categories) {
          const catId = cat.id || cat.kategori_id;
          if (!catId) continue;
          try {
            const opUrl = `https://api.tokovoucher.net/member/produk/operator/list?id=${catId}&member_code=${encodeURIComponent(config.memberCode)}&signature=${signature}`;
            const opRes = await fetch(opUrl);
            if (opRes.ok) {
              const opData = await opRes.json();
              const operators = Array.isArray(opData.data) ? opData.data : (opData.data ? [opData.data] : []);
              for (const op of operators) {
                const opName = (op.nama || op.name || op.operator || "").toString().trim().toLowerCase();
                const logoUrl = (op.logo || op.icon || "").toString().trim();
                if (opName && logoUrl && logoUrl !== "-" && logoUrl !== "null" && logoUrl.startsWith("http")) {
                  operatorLogoMap.set(opName, logoUrl);
                }
              }
            }
          } catch (opErr: any) {
            // Non-fatal per category
          }
        }
      }
    } catch (err: any) {
      console.warn("[TokoVoucher] Non-fatal: Failed to fetch categories or operator logos during discovery:", err?.message);
    }

    const url = `https://api.tokovoucher.net/produk/code?member_code=${encodeURIComponent(config.memberCode)}&signature=${signature}&kode=${encodeURIComponent(kode)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("PROVIDER_ERROR");
    
    const data = await response.json();
    
    if (data.status !== 1 && data.status !== "1" && data.status !== "Sukses") {
        return [];
    }

    const products = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
    
    return products.map((p: any) => {
      const operatorName = (p.operator_produk || "").toString().trim();
      const opKey = operatorName.toLowerCase();
      let logoUrl = operatorLogoMap.get(opKey) || undefined;
      if (logoUrl === "-" || !logoUrl || !logoUrl.startsWith("http")) {
        logoUrl = undefined;
      }

      return {
        providerId: "tokovoucher",
        providerProductId: p.id || "",
        providerSku: p.code || "",
        name: p.nama_produk || "Unknown",
        baseCost: parseFloat(p.price || 0),
        isActive: p.status === 1 || p.status === "1",
        targetFields: p.format_form ? Object.keys(JSON.parse(p.format_form)) : [],
        metadata: {
          category: p.category_name,
          operator: p.operator_produk,
          type: p.jenis_name,
          description: p.deskripsi,
          ...(logoUrl ? { logo: logoUrl } : {})
        }
      };
    });
  }
}
