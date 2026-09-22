import { Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { CustomerRepository } from "./supabase/customer-repository.js";
import { OrderRepository } from "./supabase/order-repository.js";
import { getUserRole } from "./auth-service.js";

export async function getCustomerProfileApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { uid } = req.params;
    const requesterUid = req.user?.uid;
    const requesterEmail = req.user?.email;

    if (!requesterUid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const role = await getUserRole(requesterUid, requesterEmail);
    const isPrivileged = role === "pemilik" || role === "admin";

    if (requesterUid !== uid && !isPrivileged) {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied to other user profiles" });
    }

    console.log("getCustomerProfileApi for uid:", uid);
    const data = await CustomerRepository.getInstance().getCustomer(uid);
    console.log("Customer profile data:", data);
    if (!data) return res.status(404).json({ success: false, message: "Not found" });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("getCustomerProfileApi error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getCustomerOrdersApi(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.uid;
    const orders = await OrderRepository.getInstance().getOrdersByUser(userId);
    // Sort by createdAt desc
    const sorted = orders.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return res.status(200).json({ success: true, data: sorted });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
