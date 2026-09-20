import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { ReviewService } from "./review-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";

const reviewService = ReviewService.getInstance();

async function logAudit(req: AuthenticatedRequest, action: string, resource: string, resourceId: string, payload: any) {
  await AuditLogRepository.getInstance().createLog({
    actor: { uid: req.user?.uid || "system", email: req.user?.email || "system" },
    role: req.user?.role || "admin",
    action,
    target: `${resource}/${resourceId}`,
    after: payload,
    reason: payload?.reason || "Review operation",
    timestamp: new Date().toISOString()
  });
}

export async function getPublicProductReviews(req: Request, res: Response) {
  try {
    const { productId } = req.params;
    const reviews = await reviewService.getPublicReviewsForProduct(productId);
    const summary = await reviewService.getProductRatingSummary(productId);
    return res.status(200).json({ success: true, data: { reviews, summary } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createCustomerReview(req: AuthenticatedRequest, res: Response) {
  try {
    const customerId = req.user.uid;
    const review = await reviewService.createReview(customerId, req.body);
    await logAudit(req, "CREATE_REVIEW", "reviews", review.id, { productId: review.productId, rating: review.rating });
    return res.status(201).json({ success: true, data: review });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function getAdminReviewsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const reviews = await reviewService.getAdminReviews();
    return res.status(200).json({ success: true, data: reviews });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateAdminReviewStatusApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['published', 'hidden', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Status tidak valid." });
    }
    const review = await reviewService.updateReviewStatus(id, status, req.user.uid);
    await logAudit(req, "REVIEW_MODERATION", "reviews", id, { status });
    return res.status(200).json({ success: true, data: review });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteAdminReviewApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await reviewService.deleteReview(id, req.user.uid);
    await logAudit(req, "REVIEW_DELETE", "reviews", id, {});
    return res.status(200).json({ success: true, message: "Ulasan berhasil dihapus." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
