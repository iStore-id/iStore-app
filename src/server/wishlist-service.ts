import { adminDb } from "./firebase-admin";

export interface WishlistItem {
  id: string;
  customerId: string;
  productId: string;
  variantId?: string;
  createdAt: string;
}

export class WishlistService {
  private static instance: WishlistService;

  public static getInstance(): WishlistService {
    if (!WishlistService.instance) {
      WishlistService.instance = new WishlistService();
    }
    return WishlistService.instance;
  }

  async getWishlist(customerId: string): Promise<WishlistItem[]> {
    if (!customerId || customerId === 'guest') return [];
    const snap = await adminDb.collection("wishlists")
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WishlistItem));
  }

  async addToWishlist(customerId: string, productId: string, variantId?: string): Promise<WishlistItem> {
    if (!customerId || customerId === 'guest') {
      throw new Error("Silakan login untuk menyimpan ke wishlist.");
    }
    if (!productId) {
      throw new Error("Product ID wajib diisi.");
    }

    // Check duplicate
    let query: FirebaseFirestore.Query = adminDb.collection("wishlists")
      .where("customerId", "==", customerId)
      .where("productId", "==", productId);
    
    if (variantId) {
      query = query.where("variantId", "==", variantId);
    } else {
      query = query.where("variantId", "==", null);
    }

    const existing = await query.get();
    if (!existing.empty) {
      // Already in wishlist, return existing
      const doc = existing.docs[0];
      return { id: doc.id, ...doc.data() } as WishlistItem;
    }

    const ref = adminDb.collection("wishlists").doc();
    const item: WishlistItem = {
      id: ref.id,
      customerId,
      productId,
      variantId: variantId || undefined,
      createdAt: new Date().toISOString()
    };
    await ref.set(item);
    return item;
  }

  async removeFromWishlist(customerId: string, wishlistItemId: string): Promise<void> {
    if (!customerId || customerId === 'guest') {
      throw new Error("Unauthorized");
    }
    const ref = adminDb.collection("wishlists").doc(wishlistItemId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Item wishlist tidak ditemukan.");
    const data = snap.data();
    if (data?.customerId !== customerId) {
      throw new Error("Akses ditolak.");
    }
    await ref.delete();
  }
}
