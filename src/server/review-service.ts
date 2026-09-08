import { adminDb } from "./firebase-admin";

export interface ReviewItem {
  id: string;
  customerId: string;
  customerName?: string;
  productId: string;
  variantId?: string;
  orderId?: string;
  rating: number; // 1 to 5 integer
  content: string;
  status: 'published' | 'hidden' | 'rejected';
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

export class ReviewService {
  private static instance: ReviewService;

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  async getPublicReviewsForProduct(productId: string): Promise<ReviewItem[]> {
    if (!productId) return [];
    const snap = await adminDb.collection("reviews")
      .where("productId", "==", productId)
      .where("status", "==", "published")
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReviewItem));
  }

  async getProductRatingSummary(productId: string): Promise<{ averageRating: number; reviewCount: number }> {
    const reviews = await this.getPublicReviewsForProduct(productId);
    if (reviews.length === 0) return { averageRating: 0, reviewCount: 0 };
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = Number((sum / reviews.length).toFixed(1));
    return { averageRating, reviewCount: reviews.length };
  }

  async createReview(customerId: string, data: { productId: string; variantId?: string; orderId?: string; rating: number; content: string }): Promise<ReviewItem> {
    if (!customerId || customerId === 'guest') {
      throw new Error("Silakan login untuk memberikan ulasan.");
    }
    if (!data.productId) {
      throw new Error("Product ID wajib diisi.");
    }

    // Validate rating
    const rating = Number(data.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("Rating harus berupa angka bulat antara 1 sampai 5.");
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new Error("Konten ulasan tidak boleh kosong.");
    }

    // Check duplicate review (one review per customer per product)
    const existingSnap = await adminDb.collection("reviews")
      .where("customerId", "==", customerId)
      .where("productId", "==", data.productId)
      .get();

    if (!existingSnap.empty) {
      throw new Error("Anda sudah pernah memberikan ulasan untuk produk ini.");
    }

    // Check verified purchase if orderId is provided
    let verifiedPurchase = false;
    if (data.orderId) {
      const orderDoc = await adminDb.collection("orders").doc(data.orderId).get();
      if (orderDoc.exists) {
        const orderData = orderDoc.data();
        if (orderData?.userId === customerId) {
          verifiedPurchase = true;
        }
      }
    }

    const ref = adminDb.collection("reviews").doc();
    const review: ReviewItem = {
      id: ref.id,
      customerId,
      productId: data.productId,
      variantId: data.variantId || undefined,
      orderId: data.orderId || undefined,
      rating,
      content: data.content.trim(),
      status: 'published', // default published or moderated
      verifiedPurchase,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await ref.set(review);
    return review;
  }

  async getAdminReviews(): Promise<ReviewItem[]> {
    const snap = await adminDb.collection("reviews").orderBy("createdAt", "desc").limit(200).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReviewItem));
  }

  async updateReviewStatus(reviewId: string, status: 'published' | 'hidden' | 'rejected', adminUid: string): Promise<ReviewItem> {
    const ref = adminDb.collection("reviews").doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Ulasan tidak ditemukan.");

    const updateData = {
      status,
      updatedAt: new Date().toISOString()
    };
    await ref.update(updateData);
    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as ReviewItem;
  }

  async deleteReview(reviewId: string, adminUid: string): Promise<void> {
    const ref = adminDb.collection("reviews").doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Ulasan tidak ditemukan.");
    await ref.delete();
  }
}
