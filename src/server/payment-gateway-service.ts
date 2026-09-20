import { SupabasePaymentRepository } from "./supabase/payment-repository.js";
import { PaymentGateway } from "../types/core.js";

export class PaymentGatewayService {
  private static instance: PaymentGatewayService;

  private constructor() {}

  static getInstance(): PaymentGatewayService {
    if (!PaymentGatewayService.instance) {
      PaymentGatewayService.instance = new PaymentGatewayService();
    }
    return PaymentGatewayService.instance;
  }

  private get repo() {
    return SupabasePaymentRepository.getInstance();
  }

  async createGateway(data: Partial<PaymentGateway>): Promise<PaymentGateway> {
    const id = data.id || `gw_${Date.now()}`;
    const gateway = await this.repo.savePaymentGateway({ id, ...data });
    return gateway as unknown as PaymentGateway;
  }

  async updateGateway(id: string, data: Partial<PaymentGateway>): Promise<void> {
    await this.repo.savePaymentGateway({ id, ...data });
  }

  async getGateways(): Promise<PaymentGateway[]> {
    const gateways = await this.repo.getPaymentGateways();
    return gateways as unknown as PaymentGateway[];
  }
}

