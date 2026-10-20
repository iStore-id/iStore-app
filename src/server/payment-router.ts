import { PaymentProviderAdapter } from "./adapters/payment-provider-interface.js";
import { MidtransProviderAdapter } from "./adapters/midtrans-adapter.js";
import { DoitProviderAdapter } from "./adapters/doit-adapter.js";
import { OmqrisProviderAdapter } from "./adapters/omqris-adapter.js";
import { TripayProviderAdapter } from "./adapters/tripay-adapter.js";
import { NasionalPayProviderAdapter } from "./adapters/nasionalpay-adapter.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";

export class PaymentRouter {
  private static instance: PaymentRouter;

  private constructor() {}

  public static getInstance(): PaymentRouter {
    if (!PaymentRouter.instance) PaymentRouter.instance = new PaymentRouter();
    return PaymentRouter.instance;
  }

  public async getActiveGateway(): Promise<string> {
    const repo = SystemConfigRepository.getInstance();
    const [midtransConfig, doitConfig, omqrisConfig, tripayConfig, nasionalpayConfig] = await Promise.all([
      repo.getConfig("midtrans_integration").catch(() => null),
      repo.getConfig("doit_integration").catch(() => null),
      repo.getConfig("omqris_integration").catch(() => null),
      repo.getConfig("tripay_integration").catch(() => null),
      repo.getConfig("nasionalpay_integration").catch(() => null)
    ]);

    const isMidtransActive = midtransConfig
      ? midtransConfig.isActive === true
      : process.env.MIDTRANS_IS_ACTIVE === "true";
    const isDoitActive = doitConfig
      ? doitConfig.isActive === true
      : process.env.DOIT_IS_ACTIVE === "true";
    const isOmqrisActive = omqrisConfig
      ? omqrisConfig.isActive === true
      : process.env.OMQRIS_IS_ACTIVE === "true";
    const isTripayActive = tripayConfig
      ? tripayConfig.isActive === true
      : process.env.TRIPAY_IS_ACTIVE === "true";
    const isNasionalPayActive = nasionalpayConfig
      ? nasionalpayConfig.isActive === true
      : process.env.NASIONALPAY_IS_ACTIVE === "true";

    const activeCount = [isMidtransActive, isDoitActive, isOmqrisActive, isTripayActive, isNasionalPayActive].filter(Boolean).length;
    if (activeCount > 1) {
      throw new Error("Konfigurasi payment gateway tidak valid: lebih dari satu gateway aktif");
    }

    if (isDoitActive) return "doit";
    if (isMidtransActive) return "midtrans";
    if (isOmqrisActive) return "omqris";
    if (isTripayActive) return "tripay";
    if (isNasionalPayActive) return "nasionalpay";
    throw new Error("Tidak ada gateway pembayaran yang aktif");
  }

  public getProvider(gatewayCode?: string | null): PaymentProviderAdapter {
    const code = (gatewayCode || "").toLowerCase().trim();
    if (code === "doit") return DoitProviderAdapter.getInstance();
    if (code === "omqris") return OmqrisProviderAdapter.getInstance();
    if (code === "tripay") return TripayProviderAdapter.getInstance();
    if (code === "nasionalpay") return NasionalPayProviderAdapter.getInstance();
    // Keep the established Midtrans fallback for 'midtrans', empty, and legacy NULL orders.
    return MidtransProviderAdapter.getInstance();
  }
}
