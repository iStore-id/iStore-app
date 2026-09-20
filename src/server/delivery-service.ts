import { supabaseAdmin } from "./supabase-admin";

export interface Delivery {
  id?: string;
  orderId: string;
  customerId: string;
  variantId: string;
  type: 'TOP_UP' | 'DIGITAL_CODE' | 'INFORMATION';
  status: 'PENDING' | 'READY' | 'DELIVERED' | 'FAILED';
  providerTransactionId?: string;
  destinationMasked?: string;
  digitalCode?: string;
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

  private mapRowToDelivery(row: any): Delivery {
    return {
      id: row.id,
      orderId: row.order_id,
      customerId: row.customer_id,
      variantId: row.variant_id,
      type: row.type,
      status: row.status,
      providerTransactionId: row.provider_transaction_id,
      destinationMasked: row.destination_masked,
      digitalCode: row.digital_code,
      resultMessage: row.result_message,
      deliveredAt: row.delivered_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDeliveryToRow(d: Partial<Delivery>): any {
    const row: any = {};
    if (d.id !== undefined) row.id = d.id;
    if (d.orderId !== undefined) row.order_id = d.orderId;
    if (d.customerId !== undefined) row.customer_id = d.customerId;
    if (d.variantId !== undefined) row.variant_id = d.variantId;
    if (d.type !== undefined) row.type = d.type;
    if (d.status !== undefined) row.status = d.status;
    if (d.providerTransactionId !== undefined) row.provider_transaction_id = d.providerTransactionId;
    if (d.destinationMasked !== undefined) row.destination_masked = d.destinationMasked;
    if (d.digitalCode !== undefined) row.digital_code = d.digitalCode;
    if (d.resultMessage !== undefined) row.result_message = d.resultMessage;
    if (d.deliveredAt !== undefined) row.delivered_at = d.deliveredAt;
    if (d.createdAt !== undefined) row.created_at = d.createdAt;
    if (d.updatedAt !== undefined) row.updated_at = d.updatedAt;
    return row;
  }

  async handleFulfillmentResult(orderData: any, success: boolean, reason?: string): Promise<void> {
    const orderId = orderData.id;
    const deliveryId = `delivery_${orderId}`;

    const { data: existingSnap } = await supabaseAdmin!
      .from("deliveries")
      .select("*")
      .eq("id", deliveryId)
      .maybeSingle();

    if (existingSnap) {
      if (existingSnap.status === 'DELIVERED' || existingSnap.status === 'READY') {
        return;
      }
    }

    let type: Delivery['type'] = 'TOP_UP';
    let digitalCode: string | undefined = undefined;

    if (success) {
      const { data: resSnap } = await supabaseAdmin!
        .from("reservations")
        .select("status")
        .eq("id", orderId)
        .maybeSingle();
      
      if (resSnap && resSnap.status === 'CONSUMED') {
        type = 'DIGITAL_CODE';
        digitalCode = "DUMMY_CODE_TODO_REPLACE_WITH_REAL";
      }
    }

    const destination = orderData.customerData?.destination || orderData.customerData?.userId || "";
    const destinationMasked = destination ? `${destination.substring(0, 2)}***${destination.substring(destination.length - 2)}` : "";

    const now = new Date().toISOString();
    const delivery: Partial<Delivery> = {
      id: deliveryId,
      orderId: orderData.id,
      customerId: orderData.userId,
      variantId: orderData.variantId,
      type,
      status: success ? 'DELIVERED' : 'FAILED',
      providerTransactionId: orderData.providerReference,
      resultMessage: reason,
      destinationMasked,
      digitalCode,
      createdAt: existingSnap ? existingSnap.created_at : now,
      updatedAt: now
    };

    if (success) {
      delivery.deliveredAt = now;
    }

    await supabaseAdmin!.from("deliveries").upsert(this.mapDeliveryToRow(delivery));
  }

  async getCustomerDelivery(orderId: string, customerId: string): Promise<Partial<Delivery> | null> {
    const deliveryId = `delivery_${orderId}`;
    const { data: row } = await supabaseAdmin!
      .from("deliveries")
      .select("*")
      .eq("id", deliveryId)
      .maybeSingle();

    if (!row) return null;
    if (row.customer_id !== customerId) {
      throw new Error("Unauthorized delivery access");
    }

    const data = this.mapRowToDelivery(row);
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
    const { data } = await supabaseAdmin!
      .from("deliveries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    
    return (data || []).map(row => {
      const d = this.mapRowToDelivery(row);
      return {
        ...d,
        digitalCode: d.digitalCode ? "********" : undefined
      };
    });
  }

  async getAdminDeliveryDetail(deliveryId: string): Promise<Delivery | null> {
    const { data } = await supabaseAdmin!
      .from("deliveries")
      .select("*")
      .eq("id", deliveryId)
      .maybeSingle();
    
    return data ? this.mapRowToDelivery(data) : null;
  }
}
