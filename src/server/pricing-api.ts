import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { adminDb } from "./firebase-admin";
import { PricingService } from "./pricing-service";
import { PricingRule } from "../types/core";

const pricingService = PricingService.getInstance();

export async function createPricingRule(req: AuthenticatedRequest, res: Response) {
  try {
    const data = req.body;
    const docRef = adminDb.collection("pricingRules").doc();
    const rule: PricingRule = {
      ...data,
      id: docRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.uid,
      updatedBy: req.user.uid
    };

    await docRef.set(rule);
    return res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPricingRules(req: AuthenticatedRequest, res: Response) {
  try {
    const snap = await adminDb.collection("pricingRules").get();
    const rules = snap.docs.map(doc => doc.data());
    return res.status(200).json({ success: true, data: rules });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updatePricingRule(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;
    updates.updatedAt = new Date().toISOString();
    updates.updatedBy = req.user.uid;

    await adminDb.collection("pricingRules").doc(id).update(updates);
    return res.status(200).json({ success: true, message: "Rule updated" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPriceHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const { variantId } = req.params;
    const snap = await adminDb.collection("priceHistories")
      .where("variantId", "==", variantId)
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();
    
    const history = snap.docs.map(doc => doc.data());
    return res.status(200).json({ success: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function previewPriceCalculation(req: AuthenticatedRequest, res: Response) {
  try {
    const { cost, method, value } = req.body;
    const result = pricingService.calculatePrice(cost, method, value);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function refreshVariantPrice(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await pricingService.refreshVariantPrice(id, { uid: req.user.uid, email: req.user.email });
    return res.status(200).json({ success: true, message: "Price refreshed" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
