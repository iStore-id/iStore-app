import { supabaseAdmin } from "./supabase-admin.js";
import { Stock, Quota, StockMovement, Reservation } from "../types/core.js";
import * as crypto from "crypto";

export class InventoryService {
  private static instance: InventoryService;

  private constructor() {}

  static getInstance(): InventoryService {
    if (!InventoryService.instance) {
      InventoryService.instance = new InventoryService();
    }
    return InventoryService.instance;
  }

  async getQuotas(): Promise<Quota[]> {
    const { data } = await supabaseAdmin!.from("quotas").select("*");
    return (data || []).map((d: any) => ({
      id: d.id,
      ...d
    })) as Quota[];
  }

  async getAllStocks(): Promise<Stock[]> {
    const { data, error } = await supabaseAdmin!.from("stocks").select("*");
    if (error) throw new Error(`Supabase select stocks error: ${error.message}`);
    return (data || []).map((d: any) => ({
      id: d.id,
      variantId: d.variant_id,
      quantity: d.quantity,
      reservedQuantity: d.reserved_quantity,
      availableQuantity: d.available_quantity,
      status: d.status || "active",
      updatedAt: d.updated_at
    })) as unknown as Stock[];
  }

  async saveQuota(data: Partial<Quota>): Promise<Quota> {
    if (data.id) {
      await supabaseAdmin!.from("quotas").update({
        ...data,
        updated_at: new Date().toISOString()
      }).eq("id", data.id);
      return data as Quota;
    } else {
      const newId = crypto.randomUUID();
      const payload = {
        ...data,
        id: newId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await supabaseAdmin!.from("quotas").insert(payload);
      return payload as unknown as Quota;
    }
  }

  async getStockForVariant(variantId: string): Promise<Stock | null> {
    const { data } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", variantId).limit(1).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      variantId: data.variant_id,
      quantity: data.quantity,
      reservedQuantity: data.reserved_quantity,
      availableQuantity: data.available_quantity,
      updatedAt: data.updated_at
    } as unknown as Stock;
  }

  async adjustStock(variantId: string, quantityChange: number, actor: string, reason: string): Promise<Stock> {
    const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", variantId).limit(1).maybeSingle();
    
    let currentQty = stockData ? (stockData.quantity || 0) : 0;
    let stockId = stockData ? stockData.id : crypto.randomUUID();
    
    const newQty = currentQty + quantityChange;
    if (newQty < 0) throw new Error("Stok tidak mencukupi");
    
    const currentReserved = stockData ? (stockData.reserved_quantity || 0) : 0;
    const newAvailableQuantity = newQty - currentReserved;
    if (newAvailableQuantity < 0) throw new Error("Stok tidak mencukupi");
    
    const payload = {
      variant_id: variantId,
      quantity: newQty,
      available_quantity: newAvailableQuantity,
      updated_at: new Date().toISOString()
    };
    
    if (stockData) {
      await supabaseAdmin!.from("stocks").update(payload).eq("id", stockId);
    } else {
      await supabaseAdmin!.from("stocks").insert({ id: stockId, ...payload });
    }
    
    await supabaseAdmin!.from("stock_movements").insert({
      id: crypto.randomUUID(),
      variant_id: variantId,
      type: quantityChange >= 0 ? 'RECEIVE' : 'CONSUME',
      quantity: Math.abs(quantityChange),
      before_quantity: currentQty,
      after_quantity: newQty,
      reason,
      created_at: new Date().toISOString()
    });
    
    return { id: stockId, ...payload } as unknown as Stock;
  }

  async reserveStock(orderId: string, variantId: string, quantity: number): Promise<boolean> {
    const { data, error } = await supabaseAdmin!.rpc('atomic_reserve_stock', {
      p_order_id: orderId,
      p_variant_id: variantId,
      p_quantity: quantity
    });

    if (error) {
      console.error("[InventoryService] atomic_reserve_stock error:", error.message);
      throw new Error(`Failed to reserve stock: ${error.message}`);
    }

    if (data && data.success === false) {
      if (data.error === 'INSUFFICIENT_STOCK') return false;
      throw new Error(`Stock reservation failed: ${data.error}`);
    }

    return true;
  }

  async releaseExpiredReservations(): Promise<{ success: boolean; processedCount: number }> {
    if (!supabaseAdmin) return { success: false, processedCount: 0 };
    
    const { data, error } = await supabaseAdmin.rpc('release_expired_reservations_v1');
    
    if (error) {
      console.error("[InventoryService] release_expired_reservations_v1 error:", error.message);
      throw new Error(`Failed to release expired reservations: ${error.message}`);
    }

    return {
      success: data?.success || false,
      processedCount: data?.processed_count || 0
    };
  }

  async consumeReservation(orderId: string): Promise<void> {
    const { data: resData } = await supabaseAdmin!.from("reservations").select("*").eq("id", orderId).maybeSingle();
    if (!resData) return;
    
    const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", resData.variant_id).limit(1).maybeSingle();
    
    await supabaseAdmin!.from("reservations").delete().eq("id", orderId);
    
    if (stockData) {
      const beforeQty = stockData.reserved_quantity || 0;
      const afterQty = Math.max(0, beforeQty - resData.quantity);
      
      await supabaseAdmin!.from("stocks").update({
        reserved_quantity: afterQty,
        updated_at: new Date().toISOString()
      }).eq("id", stockData.id);

      await supabaseAdmin!.from("stock_movements").insert({
        id: crypto.randomUUID(),
        variant_id: resData.variant_id,
        type: 'CONSUME',
        quantity: resData.quantity,
        before_quantity: beforeQty,
        after_quantity: afterQty,
        reason: "COMMIT_RESERVATION",
        reference_id: orderId,
        created_at: new Date().toISOString()
      });
    }
  }

  async releaseReservation(orderId: string): Promise<void> {
    const { data: resData } = await supabaseAdmin!.from("reservations").select("*").eq("id", orderId).maybeSingle();
    if (!resData) return;
    
    const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", resData.variant_id).limit(1).maybeSingle();
    
    await supabaseAdmin!.from("reservations").delete().eq("id", orderId);
    
    if (stockData) {
      const beforeQty = stockData.quantity || 0;
      const beforeRes = stockData.reserved_quantity || 0;
      const beforeAvail = stockData.available_quantity || 0;
      
      const afterRes = Math.max(0, beforeRes - resData.quantity);
      const afterAvail = beforeAvail + resData.quantity;
      
      await supabaseAdmin!.from("stocks").update({
        reserved_quantity: afterRes,
        available_quantity: afterAvail,
        updated_at: new Date().toISOString()
      }).eq("id", stockData.id);
      
      await supabaseAdmin!.from("stock_movements").insert({
        id: crypto.randomUUID(),
        variant_id: resData.variant_id,
        type: 'RELEASE',
        quantity: resData.quantity,
        before_quantity: beforeQty,
        after_quantity: beforeQty,
        reason: "CANCEL_RESERVATION",
        reference_id: orderId,
        created_at: new Date().toISOString()
      });
    }
  }
}
