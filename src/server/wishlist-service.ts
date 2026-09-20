import { SupabaseWishlistRepository } from "./supabase/wishlist-repository.js";

export interface WishlistItem {
  id: string;
  customerId: string;
  productId: string;
  variantId?: string;
  createdAt: string;
}

export class WishlistService {
  private static instance: WishlistService;
  private wishlistRepo: SupabaseWishlistRepository;

  private constructor() {
    this.wishlistRepo = SupabaseWishlistRepository.getInstance();
  }

  public static getInstance(): WishlistService {
    if (!WishlistService.instance) {
      WishlistService.instance = new WishlistService();
    }
    return WishlistService.instance;
  }

  async getWishlist(customerId: string): Promise<WishlistItem[]> {
    if (!customerId || customerId === 'guest') return [];
    return this.wishlistRepo.getWishlist(customerId);
  }

  async addToWishlist(customerId: string, productId: string, variantId?: string): Promise<WishlistItem> {
    if (!customerId || customerId === 'guest') {
      throw new Error("Silakan login untuk menyimpan ke wishlist.");
    }
    if (!productId) {
      throw new Error("Product ID wajib diisi.");
    }

    // Check duplicate
    const existing = await this.wishlistRepo.getWishlistItem(customerId, productId, variantId);
    if (existing) {
      return existing;
    }

    return this.wishlistRepo.addToWishlist(customerId, productId, variantId);
  }

  async removeFromWishlist(customerId: string, wishlistItemId: string): Promise<void> {
    if (!customerId || customerId === 'guest') {
      throw new Error("Unauthorized");
    }
    const item = await this.wishlistRepo.getWishlistItemById(wishlistItemId);
    if (!item) {
      throw new Error("Item wishlist tidak ditemukan.");
    }
    if (item.customerId !== customerId) {
      throw new Error("Akses ditolak.");
    }
    await this.wishlistRepo.removeFromWishlist(wishlistItemId);
  }
}

