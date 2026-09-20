import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { logCoreAudit } from "./core-service";
import { SystemConfigRepository } from "./supabase/system-config-repository";

const DEFAULT_PAYMENT_FEES = {
  gopay: { name: "GoPay", percentage: 0.7, flat: 0, enabled: true },
  qris: { name: "QRIS", percentage: 0.7, flat: 0, enabled: true },
  bca_va: { name: "BCA Virtual Account", percentage: 0, flat: 4000, enabled: true },
  mandiri_va: { name: "Mandiri Virtual Account", percentage: 0, flat: 4000, enabled: true },
  bni_va: { name: "BNI Virtual Account", percentage: 0, flat: 4000, enabled: true },
  bri_va: { name: "BRI Virtual Account", percentage: 0, flat: 4000, enabled: true },
  shopeepay: { name: "ShopeePay", percentage: 0.7, flat: 0, enabled: true },
  permata_va: { name: "Permata Virtual Account", percentage: 0, flat: 4000, enabled: true }
};

const DEFAULT_TAX_CONFIG = {
  enabled: false,
  taxName: "PPN",
  percentage: 11,
  mode: "inclusive",
  effectiveDate: new Date().toISOString().split("T")[0],
  description: "Pajak Pertambahan Nilai (PPN) sesuai ketentuan perundang-undangan yang berlaku"
};

export async function getTaxAndFeeConfigApi(req: AuthenticatedRequest, res: Response) {
  try {
    const [feeVal, taxVal] = await Promise.all([
      SystemConfigRepository.getInstance().getConfig("payment_method_fees"),
      SystemConfigRepository.getInstance().getConfig("tax_config")
    ]);

    const paymentFees = feeVal || DEFAULT_PAYMENT_FEES;
    const taxConfig = taxVal || DEFAULT_TAX_CONFIG;

    return res.status(200).json({
      success: true,
      data: {
        paymentFees,
        taxConfig
      }
    });
  } catch (error: any) {
    console.error("[Get Tax & Fee Config Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch tax and fee configurations" });
  }
}

export async function updateTaxAndFeeConfigApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const role = req.user?.role || "admin";
    const { paymentFees, taxConfig } = req.body;

    // Server-side validation
    if (!taxConfig || typeof taxConfig.percentage !== "number" || taxConfig.percentage < 0 || taxConfig.percentage > 100) {
      return res.status(400).json({ success: false, message: "Persentase pajak tidak valid (0 - 100%)." });
    }

    if (taxConfig.mode && taxConfig.mode !== "inclusive" && taxConfig.mode !== "exclusive") {
      return res.status(400).json({ success: false, message: "Mode pajak harus 'inclusive' atau 'exclusive'." });
    }

    if (!paymentFees || typeof paymentFees !== "object") {
      return res.status(400).json({ success: false, message: "Konfigurasi payment method fees tidak valid." });
    }

    for (const [key, val] of Object.entries(paymentFees) as any) {
      if (typeof val.percentage !== "number" || val.percentage < 0 || typeof val.flat !== "number" || val.flat < 0) {
        return res.status(400).json({ success: false, message: `Fee untuk metode ${key} tidak valid (percentage & flat harus >= 0).` });
      }
    }

    const [oldFee, oldTax] = await Promise.all([
      SystemConfigRepository.getInstance().getConfig("payment_method_fees"),
      SystemConfigRepository.getInstance().getConfig("tax_config")
    ]);

    const before = {
      paymentFees: oldFee || null,
      taxConfig: oldTax || null
    };

    const now = new Date().toISOString();

    const newFeeData = {
      key: "payment_method_fees",
      value: paymentFees,
      updatedBy: actor.uid,
      updatedAt: now
    };

    const newTaxData = {
      key: "tax_config",
      value: taxConfig,
      updatedBy: actor.uid,
      updatedAt: now
    };

    await Promise.all([
      SystemConfigRepository.getInstance().upsertConfig("payment_method_fees", newFeeData),
      SystemConfigRepository.getInstance().upsertConfig("tax_config", newTaxData)
    ]);

    const after = {
      paymentFees,
      taxConfig
    };

    await logCoreAudit(
      actor,
      role,
      "UPDATE_TAX_AND_FEE_CONFIG",
      "systemConfigs/tax_config & payment_method_fees",
      before,
      after,
      "Admin updated tax and payment method fee configurations via Control Center"
    );

    return res.status(200).json({
      success: true,
      message: "Konfigurasi Fee & Pajak berhasil disimpan",
      data: after
    });
  } catch (error: any) {
    console.error("[Update Tax & Fee Config Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update tax and fee configurations" });
  }
}
