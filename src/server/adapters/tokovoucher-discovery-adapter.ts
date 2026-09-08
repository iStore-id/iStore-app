import { DiscoveryResult, ProviderCatalogDiscoveryAdapter } from "../../types/discovery";
import { getTokoVoucherServerConfig } from "../providers";
import crypto from "crypto";

export class TokoVoucherDiscoveryAdapter implements ProviderCatalogDiscoveryAdapter {
  code = "tokovoucher";

  async discoverProducts(code?: string): Promise<DiscoveryResult[]> {
    const config = await getTokoVoucherServerConfig();
    if (!config.memberCode || !config.secret) {
      throw new Error("NOT_CONFIGURED");
    }

    const kode = code || "";
    // Correct signature for discovery (member_code:secret)
    const signature = crypto.createHash('md5').update(`${config.memberCode}:${config.secret}`).digest('hex');
    
    const url = `https://api.tokovoucher.net/produk/code?member_code=${encodeURIComponent(config.memberCode)}&signature=${signature}&kode=${encodeURIComponent(kode)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("PROVIDER_ERROR");
    
    const data = await response.json();
    
    if (data.status !== 1 && data.status !== "1" && data.status !== "Sukses") {
        return [];
    }

    // Normalization logic based on audit
    const products = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
    
    return products.map((p: any) => ({
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
        description: p.deskripsi
      }
    }));
  }
}
