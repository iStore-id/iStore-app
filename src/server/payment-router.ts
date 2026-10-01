import { PaymentProviderAdapter } from "./adapters/payment-provider-interface.js";
import { MidtransProviderAdapter } from "./adapters/midtrans-adapter.js";
import { IpaymuProviderAdapter } from "./adapters/ipaymu-adapter.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";

export class PaymentRouter {
  private static instance: PaymentRouter;

  private constructor() {}

  public static getInstance(): PaymentRouter {
    if (!PaymentRouter.instance) {
      PaymentRouter.instance = new PaymentRouter();
    }
    return PaymentRouter.instance;
  }

  public async getActiveGateway(): Promise<string> {
    const repo = SystemConfigRepository.getInstance();
    const [midtransConfig, ipaymuConfig] = await Promise.all([
      repo.getConfig("midtrans_integration").catch(() => null),
      repo.getConfig("ipaymu_integration").catch(() => null)
    ]);

    const isMidtransActive = midtransConfig
      ? midtransConfig.isActive === true
      : process.env.MIDTRANS_IS_ACTIVE === "true";

    const isIpaymuActive = ipaymuConfig
      ? ipaymuConfig.isActive === true
      : process.env.IPAYMU_IS_ACTIVE === "true";

    if (isMidtransActive && isIpaymuActive) {
      throw new Error("Konfigurasi payment gateway tidak valid: lebih dari satu gateway aktif");
    }

    if (isMidtransActive) {
      return "midtrans";
    }

    if (isIpaymuActive) {
      return "ipaymu";
    }

    throw new Error("Tidak ada gateway pembayaran yang aktif");
  }

  public getProvider(gatewayCode?: string | null): PaymentProviderAdapter {
    const code = (gatewayCode || "").toLowerCase().trim();
    if (code === "ipaymu") {
      return IpaymuProviderAdapter.getInstance();
    }
    // Default fallback to Midtrans for 'midtrans', empty, or legacy NULL orders
    return MidtransProviderAdapter.getInstance();
  }
}
