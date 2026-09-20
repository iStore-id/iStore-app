import { SupabaseReviewRepository } from "./supabase/review-repository";
import { OrderRepository } from "./supabase/order-repository";

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
  private reviewRepo: SupabaseReviewRepository;
  private orderRepo: OrderRepository;

  private constructor() {
    this.reviewRepo = SupabaseReviewRepository.getInstance();
    this.orderRepo = OrderRepository.getInstance();
  }

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  async getPublicReviewsForProduct(productId: string): Promise<ReviewItem[]> {
    return this.reviewRepo.getPublicReviewsForProduct(productId);
  }

  async getProductRatingSummary(productId: string): Promise<{ averageRating: number; reviewCount: number }> {
    return this.reviewRepo.getProductRatingSummary(productId);
  }

  async createReview(customerId: string, data: { productId: string; variantId?: string; orderId?: string; rating: number; content: string; customerName?: string }): Promise<ReviewItem> {
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
    const existing = await this.reviewRepo.getReviewByCustomerAndProduct(customerId, data.productId);
    if (existing) {
      throw new Error("Anda sudah pernah memberikan ulasan untuk produk ini.");
    }

    // Check verified purchase if orderId is provided
    let verifiedPurchase = false;
    if (data.orderId) {
      const order = await this.orderRepo.getOrderById(data.orderId);
      if (order && order.userId === customerId) {
        verifiedPurchase = true;
      }
    }

    return this.reviewRepo.createReview({
      customerId,
      customerName: data.customerName,
      productId: data.productId,
      variantId: data.variantId || undefined,
      orderId: data.orderId || undefined,
      rating,
      content: data.content.trim(),
      status: 'published',
      verifiedPurchase
    });
  }

  async getAdminReviews(): Promise<ReviewItem[]> {
    return this.reviewRepo.getAdminReviews(200);
  }

  async updateReviewStatus(reviewId: string, status: 'published' | 'hidden' | 'rejected', adminUid: string): Promise<ReviewItem> {
    const existing = await this.reviewRepo.getReviewById(reviewId);
    if (!existing) throw new Error("Ulasan tidak ditemukan.");

    return this.reviewRepo.updateReviewStatus(reviewId, status);
  }

  async deleteReview(reviewId: string, adminUid: string): Promise<void> {
    const existing = await this.reviewRepo.getReviewById(reviewId);
    if (!existing) throw new Error("Ulasan tidak ditemukan.");

    await this.reviewRepo.deleteReview(reviewId);
  }
}
