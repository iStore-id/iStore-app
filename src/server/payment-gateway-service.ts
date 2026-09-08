import { adminDb } from "./firebase-admin";
import { PaymentGateway } from "../types/core";

export class PaymentGatewayService {
  private static instance: PaymentGatewayService;

  private constructor() {}

  static getInstance(): PaymentGatewayService {
    if (!PaymentGatewayService.instance) {
      PaymentGatewayService.instance = new PaymentGatewayService();
    }
    return PaymentGatewayService.instance;
  }

  async createGateway(data: Partial<PaymentGateway>): Promise<PaymentGateway> {
    const docRef = adminDb.collection("paymentGateways").doc();
    const gateway: PaymentGateway = {
      id: docRef.id,
      name: data.name || "",
      code: data.code || "",
      type: data.type || "aggregator",
      environment: data.environment || "sandbox",
      status: data.status || "inactive",
      enabled: data.enabled || false,
      priority: data.priority || 0,
      capabilities: data.capabilities || [],
      createdAt: new Date().toISOString()
    };

    await docRef.set(gateway);
    return gateway;
  }

  async updateGateway(id: string, data: Partial<PaymentGateway>): Promise<void> {
    const docRef = adminDb.collection("paymentGateways").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error("Payment Gateway not found");

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString()
    });
  }

  async getGateways(): Promise<PaymentGateway[]> {
    const snap = await adminDb.collection("paymentGateways").orderBy("priority", "asc").get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentGateway));
  }
}
