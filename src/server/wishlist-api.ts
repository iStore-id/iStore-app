import { Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { WishlistService } from "./wishlist-service.js";

const wishlistService = WishlistService.getInstance();

export async function getCustomerWishlist(req: AuthenticatedRequest, res: Response) {
  try {
    const customerId = req.user.uid;
    const items = await wishlistService.getWishlist(customerId);
    return res.status(200).json({ success: true, data: items });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function addToCustomerWishlist(req: AuthenticatedRequest, res: Response) {
  try {
    const customerId = req.user.uid;
    const { productId, variantId } = req.body;
    const item = await wishlistService.addToWishlist(customerId, productId, variantId);
    return res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function removeFromCustomerWishlist(req: AuthenticatedRequest, res: Response) {
  try {
    const customerId = req.user.uid;
    const { id } = req.params;
    await wishlistService.removeFromWishlist(customerId, id);
    return res.status(200).json({ success: true, message: "Berhasil dihapus dari wishlist" });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
