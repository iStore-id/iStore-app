import { adminDb } from "./firebase-admin";
import { Stock, Quota, StockMovement, Reservation } from "../types/core";

export class InventoryService {
  private static instance: InventoryService;

  private constructor() {}

  static getInstance(): InventoryService {
    if (!InventoryService.instance) {
      InventoryService.instance = new InventoryService();
    }
    return InventoryService.instance;
  }

  // --- QUOTA MANAGEMENT ---
  async getQuotas(): Promise<Quota[]> {
    const snap = await adminDb.collection("quotas").get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quota));
  }

  async saveQuota(data: Partial<Quota>): Promise<Quota> {
    const ref = data.id ? adminDb.collection("quotas").doc(data.id) : adminDb.collection("quotas").doc();
    const payload = {
      ...data,
      id: ref.id,
      updatedAt: new Date().toISOString()
    };
    await ref.set(payload, { merge: true });
    return payload as Quota;
  }

  // --- STOCK MANAGEMENT ---
  async getStockForVariant(variantId: string): Promise<Stock | null> {
    const snap = await adminDb.collection("stocks").where("variantId", "==", variantId).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Stock;
  }

  async adjustStock(variantId: string, quantityChange: number, actor: string, reason: string): Promise<Stock> {
    return await adminDb.runTransaction(async (t) => {
      const snap = await t.get(adminDb.collection("stocks").where("variantId", "==", variantId).limit(1));
      
      let stock: Partial<Stock>;
      let docRef;
      
      if (snap.empty) {
        docRef = adminDb.collection("stocks").doc();
        if (quantityChange < 0) throw new Error("Cannot set negative initial stock");
        stock = {
          id: docRef.id,
          variantId,
          quantity: quantityChange,
          reservedQuantity: 0,
          availableQuantity: quantityChange,
          lowStockThreshold: 0,
          status: 'active',
          updatedAt: new Date().toISOString(),
          updatedBy: actor
        };
      } else {
        docRef = snap.docs[0].ref;
        const current = snap.docs[0].data() as Stock;
        const newQty = current.quantity + quantityChange;
        const newAvail = current.availableQuantity + quantityChange;
        
        if (newAvail < 0) throw new Error("Insufficient stock availability");
        
        stock = {
          ...current,
          quantity: newQty,
          availableQuantity: newAvail,
          updatedAt: new Date().toISOString(),
          updatedBy: actor
        };
      }

      t.set(docRef, stock);

      // Record movement
      const moveRef = adminDb.collection("stockMovements").doc();
      const movement: StockMovement = {
        id: moveRef.id,
        variantId,
        type: quantityChange >= 0 ? 'RECEIVE' : 'ADJUST',
        quantity: Math.abs(quantityChange),
        before: snap.empty ? 0 : snap.docs[0].data().quantity,
        after: stock.quantity!,
        actor,
        reason,
        timestamp: new Date().toISOString()
      };
      t.set(moveRef, movement);

      return stock as Stock;
    });
  }

  // --- RESERVATION ---
  async reserveStock(orderId: string, variantId: string, quantity: number): Promise<boolean> {
    return await adminDb.runTransaction(async (t) => {
      const snap = await t.get(adminDb.collection("stocks").where("variantId", "==", variantId).limit(1));
      if (snap.empty) return true; // If no stock record exists, we treat it as unmanaged/digital topup

      const current = snap.docs[0].data() as Stock;
      if (current.status !== 'active') throw new Error("Stock is inactive");
      if (current.availableQuantity < quantity) throw new Error("Out of stock");

      const newReserved = current.reservedQuantity + quantity;
      const newAvail = current.availableQuantity - quantity;

      t.update(snap.docs[0].ref, {
        reservedQuantity: newReserved,
        availableQuantity: newAvail,
        updatedAt: new Date().toISOString(),
        updatedBy: "SYSTEM_CHECKOUT"
      });

      const resRef = adminDb.collection("reservations").doc(orderId);
      const res: Reservation = {
        id: orderId,
        orderId,
        variantId,
        quantity,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60000).toISOString() // 15 mins expiry
      };
      t.set(resRef, res);

      const moveRef = adminDb.collection("stockMovements").doc();
      const movement: StockMovement = {
        id: moveRef.id,
        variantId,
        type: 'RESERVE',
        quantity,
        before: current.quantity, // Physical quantity remains the same
        after: current.quantity,
        referenceId: orderId,
        actor: "SYSTEM_CHECKOUT",
        reason: "Order checkout reservation",
        timestamp: new Date().toISOString()
      };
      t.set(moveRef, movement);

      return true;
    });
  }

  async consumeReservation(orderId: string): Promise<void> {
    await adminDb.runTransaction(async (t) => {
      const resSnap = await t.get(adminDb.collection("reservations").doc(orderId));
      if (!resSnap.exists) return; // Unmanaged stock
      
      const res = resSnap.data() as Reservation;
      if (res.status !== 'ACTIVE') return;

      const stockSnap = await t.get(adminDb.collection("stocks").where("variantId", "==", res.variantId).limit(1));
      if (stockSnap.empty) return;

      const current = stockSnap.docs[0].data() as Stock;
      const newQty = current.quantity - res.quantity;
      const newReserved = current.reservedQuantity - res.quantity;

      t.update(stockSnap.docs[0].ref, {
        quantity: newQty,
        reservedQuantity: newReserved,
        updatedAt: new Date().toISOString(),
        updatedBy: "SYSTEM_FULFILLMENT"
      });

      t.update(resSnap.ref, { status: 'CONSUMED' });

      const moveRef = adminDb.collection("stockMovements").doc();
      const movement: StockMovement = {
        id: moveRef.id,
        variantId: res.variantId,
        type: 'CONSUME',
        quantity: res.quantity,
        before: current.quantity,
        after: newQty,
        referenceId: orderId,
        actor: "SYSTEM_FULFILLMENT",
        reason: "Order fulfilled",
        timestamp: new Date().toISOString()
      };
      t.set(moveRef, movement);
    });
  }

  async releaseReservation(orderId: string): Promise<void> {
    await adminDb.runTransaction(async (t) => {
      const resSnap = await t.get(adminDb.collection("reservations").doc(orderId));
      if (!resSnap.exists) return;
      
      const res = resSnap.data() as Reservation;
      if (res.status !== 'ACTIVE') return;

      const stockSnap = await t.get(adminDb.collection("stocks").where("variantId", "==", res.variantId).limit(1));
      if (stockSnap.empty) return;

      const current = stockSnap.docs[0].data() as Stock;
      const newReserved = current.reservedQuantity - res.quantity;
      const newAvail = current.availableQuantity + res.quantity;

      t.update(stockSnap.docs[0].ref, {
        reservedQuantity: newReserved,
        availableQuantity: newAvail,
        updatedAt: new Date().toISOString(),
        updatedBy: "SYSTEM_RELEASE"
      });

      t.update(resSnap.ref, { status: 'RELEASED' });

      const moveRef = adminDb.collection("stockMovements").doc();
      const movement: StockMovement = {
        id: moveRef.id,
        variantId: res.variantId,
        type: 'RELEASE',
        quantity: res.quantity,
        before: current.quantity,
        after: current.quantity,
        referenceId: orderId,
        actor: "SYSTEM_RELEASE",
        reason: "Order failed/cancelled/expired",
        timestamp: new Date().toISOString()
      };
      t.set(moveRef, movement);
    });
  }
}
