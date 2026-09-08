import { adminDb } from "./firebase-admin";

export interface Delivery {
  id?: string;
  orderId: string;
  customerId: string;
  variantId: string;
  type: 'TOP_UP' | 'DIGITAL_CODE' | 'INFORMATION';
  status: 'PENDING' | 'READY' | 'DELIVERED' | 'FAILED';
  providerTransactionId?: string;
  destinationMasked?: string;
  digitalCode?: string; // Encrypted or plaintext internally, but sanitized for API
  resultMessage?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class DeliveryService {
  private static instance: DeliveryService;

  private constructor() {}

  static getInstance(): DeliveryService {
    if (!DeliveryService.instance) {
      DeliveryService.instance = new DeliveryService();
    }
    return DeliveryService.instance;
  }

  // Called when fulfillment succeeds or fails (hooked from State Machine)
  async handleFulfillmentResult(orderData: any, success: boolean, reason?: string): Promise<void> {
    const orderId = orderData.id;
    const deliveryId = `delivery_${orderId}`;

    await adminDb.runTransaction(async (t) => {
      const ref = adminDb.collection("deliveries").doc(deliveryId);
      const snap = await t.get(ref);

      if (snap.exists) {
        // Prevent duplicate updates if already handled
        if (snap.data()?.status === 'DELIVERED' || snap.data()?.status === 'READY') {
          return; 
        }
      }

      // Determine Type (in a real app, variant would define this. We assume TOP_UP if no digital code is found in stock)
      let type: Delivery['type'] = 'TOP_UP';
      let digitalCode: string | undefined = undefined;

      if (success) {
        // Check if there's a reservation consumed
        const resSnap = await t.get(adminDb.collection("reservations").doc(orderId));
        if (resSnap.exists && resSnap.data()?.status === 'CONSUMED') {
          type = 'DIGITAL_CODE';
          digitalCode = "DUMMY_CODE_TODO_REPLACE_WITH_REAL"; // We don't have digital codes in stock model yet
        }
      }

      const destination = orderData.customerData?.destination || orderData.customerData?.userId || "";
      const destinationMasked = destination ? `${destination.substring(0, 2)}***${destination.substring(destination.length - 2)}` : "";

      const delivery: Delivery = {
        id: deliveryId,
        orderId: orderData.id,
        customerId: orderData.userId,
        variantId: orderData.variantId,
        type,
        status: success ? 'READY' : 'FAILED',
        providerTransactionId: orderData.providerReference,
        resultMessage: reason,
        destinationMasked,
        digitalCode,
        createdAt: snap.exists ? snap.data()!.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (success) {
        delivery.deliveredAt = new Date().toISOString();
        delivery.status = 'DELIVERED';
      }

      t.set(ref, delivery, { merge: true });
    });
  }

  async getCustomerDelivery(orderId: string, customerId: string): Promise<Partial<Delivery> | null> {
    const deliveryId = `delivery_${orderId}`;
    const snap = await adminDb.collection("deliveries").doc(deliveryId).get();
    
    if (!snap.exists) return null;
    
    const data = snap.data() as Delivery;
    if (data.customerId !== customerId) {
      throw new Error("Unauthorized delivery access");
    }

    // Sanitize response
    return {
      id: data.id,
      orderId: data.orderId,
      type: data.type,
      status: data.status,
      providerTransactionId: data.providerTransactionId,
      resultMessage: data.resultMessage,
      destinationMasked: data.destinationMasked,
      digitalCode: data.status === 'DELIVERED' || data.status === 'READY' ? data.digitalCode : undefined,
      deliveredAt: data.deliveredAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  async getAdminDeliveries(limit: number = 100): Promise<Delivery[]> {
    const snap = await adminDb.collection("deliveries").orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs.map(doc => {
      const data = doc.data() as Delivery;
      // Mask digital code for admin list view
      return {
        ...data,
        digitalCode: data.digitalCode ? "********" : undefined
      };
    });
  }

  async getAdminDeliveryDetail(deliveryId: string): Promise<Delivery | null> {
    const snap = await adminDb.collection("deliveries").doc(deliveryId).get();
    if (!snap.exists) return null;
    return snap.data() as Delivery; // Plaintext for detail view, assuming permission check passed
  }
}
