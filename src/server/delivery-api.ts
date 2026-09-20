import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { DeliveryService } from "./delivery-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";

const deliveryService = DeliveryService.getInstance();

export async function getCustomerDelivery(req: AuthenticatedRequest, res: Response) {
  try {
    const { orderId } = req.params;
    const customerId = req.user?.uid;
    
    if (!customerId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Please login" });
    }

    const delivery = await deliveryService.getCustomerDelivery(orderId, customerId);
    
    if (!delivery) {
      return res.status(404).json({ success: false, message: "Delivery not found" });
    }

    return res.status(200).json({ success: true, data: delivery });
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminDeliveries(req: AuthenticatedRequest, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const deliveries = await deliveryService.getAdminDeliveries(limit);
    return res.status(200).json({ success: true, data: deliveries });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminDeliveryDetail(req: AuthenticatedRequest, res: Response) {
  try {
    const { deliveryId } = req.params;
    const delivery = await deliveryService.getAdminDeliveryDetail(deliveryId);
    
    if (!delivery) {
      return res.status(404).json({ success: false, message: "Delivery not found" });
    }
    
    // Log audit for accessing sensitive delivery detail (especially if it has digital code)
    if (delivery.digitalCode) {
       await AuditLogRepository.getInstance().createLog({
         actor: { uid: req.user.uid, email: req.user.email || "system" },
         role: req.user.role || "admin",
         action: "VIEW_DELIVERY_SENSITIVE",
         target: `deliveries/${delivery.id}`,
         reason: "View sensitive delivery detail",
         timestamp: new Date().toISOString()
       });
    }

    return res.status(200).json({ success: true, data: delivery });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
