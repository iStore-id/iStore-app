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
    
    let currentQty = 0;
    let stockId = null;
    
    if (stockData) {
      currentQty = stockData.quantity || 0;
      stockId = stockData.id;
    } else {
      stockId = crypto.randomUUID();
    }
    
    const newQty = currentQty + quantityChange;
    if (newQty < 0) throw new Error("Stok tidak mencukupi");
    
    const payload = {
      variant_id: variantId,
      quantity: newQty,
      updated_at: new Date().toISOString()
    };
    
    if (stockData) {
      await supabaseAdmin!.from("stocks").update(payload).eq("id", stockId);
    } else {
      await supabaseAdmin!.from("stocks").insert({ id: stockId, ...payload });
    }
    
    await supabaseAdmin!.from("stock_movements").insert({
      id: crypto.randomUUID(),
      stock_id: stockId,
      variant_id: variantId,
      delta: quantityChange,
      reason,
      created_at: new Date().toISOString()
    });
    
    return { id: stockId, ...payload } as unknown as Stock;
  }

  async reserveStock(orderId: string, variantId: string, quantity: number): Promise<boolean> {
    const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", variantId).limit(1).maybeSingle();
    if (!stockData) return false;
    
    const currentQty = stockData.quantity || 0;
    if (currentQty < quantity) return false;
    
    const newQty = currentQty - quantity;
    
    await supabaseAdmin!.from("stocks").update({
      quantity: newQty,
      updated_at: new Date().toISOString()
    }).eq("id", stockData.id);
    
    await supabaseAdmin!.from("reservations").insert({
      id: orderId,
      variant_id: variantId,
      quantity,
      expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
      created_at: new Date().toISOString()
    });
    
    await supabaseAdmin!.from("stock_movements").insert({
      id: crypto.randomUUID(),
      stock_id: stockData.id,
      variant_id: variantId,
      delta: -quantity,
      reason: "RESERVE",
      reference_id: orderId,
      created_at: new Date().toISOString()
    });
    
    return true;
  }

  async consumeReservation(orderId: string): Promise<void> {
    const { data: resData } = await supabaseAdmin!.from("reservations").select("*").eq("id", orderId).maybeSingle();
    if (!resData) return;
    
    await supabaseAdmin!.from("reservations").delete().eq("id", orderId);
    
    const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", resData.variant_id).limit(1).maybeSingle();
    if (stockData) {
      await supabaseAdmin!.from("stock_movements").insert({
        id: crypto.randomUUID(),
        stock_id: stockData.id,
        variant_id: resData.variant_id,
        delta: 0,
        reason: "COMMIT_RESERVATION",
        reference_id: orderId,
        created_at: new Date().toISOString()
      });
    }
  }

  async releaseReservation(orderId: string): Promise<void> {
    const { data: resData } = await supabaseAdmin!.from("reservations").select("*").eq("id", orderId).maybeSingle();
    if (!resData) return;
    
    await supabaseAdmin!.from("reservations").delete().eq("id", orderId);
    
    const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", resData.variant_id).limit(1).maybeSingle();
    if (stockData) {
      await supabaseAdmin!.from("stocks").update({
        quantity: (stockData.quantity || 0) + resData.quantity,
        updated_at: new Date().toISOString()
      }).eq("id", stockData.id);
      
      await supabaseAdmin!.from("stock_movements").insert({
        id: crypto.randomUUID(),
        stock_id: stockData.id,
        variant_id: resData.variant_id,
        delta: resData.quantity,
        reason: "CANCEL_RESERVATION",
        reference_id: orderId,
        created_at: new Date().toISOString()
      });
    }
  }
}
