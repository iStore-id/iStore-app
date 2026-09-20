import { supabaseAdmin } from "../supabase-admin";
import { Order } from "../../types/order";

export class OrderRepository {
  private static instance: OrderRepository;

  private constructor() {}

  public static getInstance(): OrderRepository {
    if (!OrderRepository.instance) {
      OrderRepository.instance = new OrderRepository();
    }
    return OrderRepository.instance;
  }

  private get client() {
    return supabaseAdmin;
  }

  // Helper to map DB row to Domain Order
  private mapRowToOrder(row: any): Order {
    return {
      id: row.id,
      invoice: row.invoice,
      userId: row.user_id,
      customerData: row.customer_data,
      productId: row.product_id,
      productName: row.product_name,
      variantId: row.variant_id,
      variantName: row.variant_name,
      providerId: row.provider_id,
      providerSkuId: row.provider_sku_id,
      providerSku: row.provider_sku,
      routingDecisionCode: row.routing_decision_code,
      quantity: row.quantity,
      price: row.price,
      adminFee: row.admin_fee,
      discount: row.discount,
      totalAmount: row.total_amount,
      paymentStatus: row.payment_status,
      transactionStatus: row.transaction_status,
      paymentGatewayCode: row.payment_gateway_code,
      gatewayTransactionId: row.gateway_transaction_id,
      gatewayPaymentType: row.gateway_payment_type,
      gatewayResponse: row.gateway_response,
      providerReferenceId: row.provider_reference_id,
      providerReference: row.provider_reference_id,
      serialNumber: row.serial_number,
      fulfillmentResponse: row.fulfillment_response,
      failureReason: row.failure_reason,
      idempotencyKey: row.idempotency_key,
      paidAt: row.paid_at,
      fulfilledAt: row.fulfilled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      promoId: row.promo_id,
      promoSnapshot: row.promo_snapshot,
      flashSaleSnapshot: row.flash_sale_snapshot,
      referralCode: row.referral_code,
      snapToken: row.snap_token,
      paymentUrl: row.payment_url,
    };
  }

  // Helper to map Domain Order to DB row (supports Partial<Order> without overwriting undefined fields)
  private mapOrderToRow(order: Partial<Order>): any {
    const row: any = {};
    if (order.id !== undefined) row.id = order.id;
    if (order.invoice !== undefined) row.invoice = order.invoice;
    if (order.userId !== undefined) {
      row.user_id = (order.userId && order.userId !== "guest") ? order.userId : null;
    }
    if (order.customerData !== undefined) row.customer_data = order.customerData;
    if (order.productId !== undefined) row.product_id = order.productId;
    if (order.productName !== undefined) row.product_name = order.productName;
    if (order.variantId !== undefined) row.variant_id = order.variantId;
    if (order.variantName !== undefined) row.variant_name = order.variantName;
    if (order.providerId !== undefined) row.provider_id = order.providerId;
    if (order.providerSkuId !== undefined) row.provider_sku_id = order.providerSkuId;
    if (order.providerSku !== undefined) row.provider_sku = order.providerSku;
    if (order.routingDecisionCode !== undefined) row.routing_decision_code = order.routingDecisionCode;
    if (order.quantity !== undefined) row.quantity = order.quantity;
    if (order.price !== undefined) row.price = order.price;
    if (order.adminFee !== undefined) row.admin_fee = order.adminFee;
    if (order.discount !== undefined) row.discount = order.discount;
    if (order.totalAmount !== undefined) row.total_amount = order.totalAmount;
    if (order.paymentStatus !== undefined) row.payment_status = order.paymentStatus;
    if (order.transactionStatus !== undefined) row.transaction_status = order.transactionStatus;
    if (order.paymentGatewayCode !== undefined) row.payment_gateway_code = order.paymentGatewayCode;
    if (order.gatewayTransactionId !== undefined) row.gateway_transaction_id = order.gatewayTransactionId;
    if (order.gatewayPaymentType !== undefined) row.gateway_payment_type = order.gatewayPaymentType;
    if (order.gatewayResponse !== undefined) row.gateway_response = order.gatewayResponse;
    if (order.providerReferenceId !== undefined || order.providerReference !== undefined) {
      row.provider_reference_id = order.providerReferenceId || order.providerReference;
    }
    if (order.serialNumber !== undefined) row.serial_number = order.serialNumber;
    if (order.fulfillmentResponse !== undefined) row.fulfillment_response = order.fulfillmentResponse;
    if (order.failureReason !== undefined) row.failure_reason = order.failureReason;
    if (order.idempotencyKey !== undefined) row.idempotency_key = order.idempotencyKey;
    if (order.paidAt !== undefined) row.paid_at = order.paidAt;
    if (order.fulfilledAt !== undefined) row.fulfilled_at = order.fulfilledAt;
    if (order.createdAt !== undefined) row.created_at = order.createdAt;
    if (order.updatedAt !== undefined) row.updated_at = order.updatedAt;
    if (order.promoId !== undefined) row.promo_id = order.promoId;
    if (order.promoSnapshot !== undefined) row.promo_snapshot = order.promoSnapshot;
    if (order.flashSaleSnapshot !== undefined) row.flash_sale_snapshot = order.flashSaleSnapshot;
    if (order.referralCode !== undefined) row.referral_code = order.referralCode;
    if (order.snapToken !== undefined) row.snap_token = order.snapToken;
    if (order.paymentUrl !== undefined) row.payment_url = order.paymentUrl;
    return row;
  }

  async createOrder(order: Order): Promise<void> {
    const { error } = await this.client.from("orders").insert(this.mapOrderToRow(order));
    if (error) {
      console.error("[Supabase createOrder] Detailed Error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        status: (error as any).status,
        cause: (error as any).cause || (error as any).originalError
      });
      throw new Error(`Supabase createOrder error: ${error.message}`);
    }
  }

  async getOrderById(id: string): Promise<Order | null> {
    const { data, error } = await this.client.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase getOrderById error: ${error.message}`);
    return data ? this.mapRowToOrder(data) : null;
  }

  async getOrderByInvoice(invoice: string): Promise<Order | null> {
    const { data, error } = await this.client.from("orders").select("*").eq("invoice", invoice).maybeSingle();
    if (error) throw new Error(`Supabase getOrderByInvoice error: ${error.message}`);
    return data ? this.mapRowToOrder(data) : null;
  }

  async getOrderByProviderReferenceId(providerReferenceId: string): Promise<Order | null> {
    const { data, error } = await this.client.from("orders").select("*").eq("provider_reference_id", providerReferenceId).maybeSingle();
    if (error) throw new Error(`Supabase getOrderByProviderReferenceId error: ${error.message}`);
    return data ? this.mapRowToOrder(data) : null;
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    const { data, error } = await this.client.from("orders").select("*").eq("user_id", userId);
    if (error) throw new Error(`Supabase getOrdersByUser error: ${error.message}`);
    return (data || []).map(this.mapRowToOrder.bind(this));
  }

  async getOrdersByUsers(userIds: string[]): Promise<Order[]> {
    if (userIds.length === 0) return [];
    const { data, error } = await this.client.from("orders").select("*").in("user_id", userIds);
    if (error) throw new Error(`Supabase getOrdersByUsers error: ${error.message}`);
    return (data || []).map(this.mapRowToOrder.bind(this));
  }

  async getOrdersByProviderSkuId(providerSkuId: string): Promise<Order[]> {
    const { data, error } = await this.client.from("orders").select("*").eq("provider_sku_id", providerSkuId);
    if (error) throw new Error(`Supabase getOrdersByProviderSkuId error: ${error.message}`);
    return (data || []).map(this.mapRowToOrder.bind(this));
  }

  async getAllOrders(): Promise<Order[]> {
    const { data, error } = await this.client.from("orders").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`Supabase getAllOrders error: ${error.message}`);
    return (data || []).map(this.mapRowToOrder.bind(this));
  }

  async queryOrdersWithFilter(filterKey: string, filterVal: any): Promise<Order[]> {
    const { data, error } = await this.client.from("orders").select("*").eq(filterKey, filterVal);
    if (error) throw new Error(`Supabase queryOrdersWithFilter error: ${error.message}`);
    return (data || []).map(this.mapRowToOrder.bind(this));
  }

  async listOrders(limit: number = 50, offset: number = 0): Promise<Order[]> {
    const { data, error } = await this.client.from("orders").select("*").range(offset, offset + limit - 1);
    if (error) throw new Error(`Supabase listOrders error: ${error.message}`);
    return (data || []).map(this.mapRowToOrder.bind(this));
  }

  async getRecentOrders(limit: number = 100): Promise<Order[]> {
    const { data, error } = await this.client.from("orders").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(`Supabase getRecentOrders error: ${error.message}`);
    return (data || []).map(this.mapRowToOrder.bind(this));
  }

  async countOrders(): Promise<number> {
    const { count, error } = await this.client.from("orders").select("*", { count: 'exact', head: true });
    if (error) throw new Error(`Supabase countOrders error: ${error.message}`);
    return count || 0;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<void> {
    const { error } = await this.client.from("orders").update(this.mapOrderToRow(updates)).eq("id", id);
    if (error) throw new Error(`Supabase updateOrder error: ${error.message}`);
  }

  async updateOrderPayment(id: string, paymentStatus: string, gatewayResponse: any): Promise<void> {
    const { error } = await this.client.from("orders").update({
      payment_status: paymentStatus,
      gateway_response: gatewayResponse,
      updated_at: new Date().toISOString()
    }).eq("id", id);
    if (error) throw new Error(`Supabase updateOrderPayment error: ${error.message}`);
  }

  async updateOrderFulfillment(id: string, transactionStatus: string, fulfillmentResponse: any): Promise<void> {
    const { error } = await this.client.from("orders").update({
      transaction_status: transactionStatus,
      fulfillment_response: fulfillmentResponse,
      updated_at: new Date().toISOString()
    }).eq("id", id);
    if (error) throw new Error(`Supabase updateOrderFulfillment error: ${error.message}`);
  }

  async updateOrderState(id: string, paymentStatus: string, transactionStatus: string): Promise<void> {
    const { error } = await this.client.from("orders").update({
      payment_status: paymentStatus,
      transaction_status: transactionStatus,
      updated_at: new Date().toISOString()
    }).eq("id", id);
    if (error) throw new Error(`Supabase updateOrderState error: ${error.message}`);
  }

  async idempotencyLookup(idempotencyKey: string): Promise<Order | null> {
    const { data, error } = await this.client.from("orders").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (error) throw new Error(`Supabase idempotencyLookup error: ${error.message}`);
    return data ? this.mapRowToOrder(data) : null;
  }

  // TODO: Implement transaction-safe operations
  // Supabase JS client doesn't support SELECT FOR UPDATE directly.
  // Requires:
  // 1. Database-side functions (RPC) or stored procedures.
  // 2. Transactional locking on the database side to replace adminDb.runTransaction.
  async getOrderForUpdate(id: string): Promise<Order | null> {
      throw new Error("getOrderForUpdate requires transactional locking - implement via DB RPC.");
  }

  async transitionOrderState(
    id: string,
    newState: string,
    payload: any = {},
    reason: string = ""
  ): Promise<{ success: boolean; error_message: string | null; order_before: any; order_after: any }> {
    const { data, error } = await this.client.rpc("transition_order_state_v1", {
      p_order_id: id,
      p_new_state: newState,
      p_payload: payload,
      p_reason: reason
    });

    if (error) {
      throw new Error(`Supabase transition_order_state_v1 RPC error: ${error.message}`);
    }

    return data;
  }
}
