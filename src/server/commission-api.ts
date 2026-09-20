import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { logCoreAudit } from "./core-service";
import { encryptSecret, decryptSecret } from "./midtrans";
import { SupabaseRefundRepository } from "./supabase/refund-repository";
import * as repo from "./commission-repository";
import * as crypto from "crypto";
import { 
  CommissionConfig, 
  CommissionRecipient, 
  CommissionRule, 
  CommissionRecord,
  RecipientType, 
  PayoutAccount,
  FirestorePayoutAccount 
} from "../types/commission";

const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  enabled: false,
  defaultCalculationMethod: "PERCENTAGE_OF_SELLING_PRICE",
  defaultCurrency: "IDR",
  minimumPayoutThreshold: 50000,
  supportedRecipientTypes: ["AFFILIATE"],
  updatedAt: new Date().toISOString(),
  updatedBy: "system"
};

// Helper: Normalize affiliate code
export function normalizeAffiliateCode(code: string): string {
  if (!code) return "";
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

// Helper: Mask bank account for audit / display safety
export function maskAccountNumber(acc: string): string {
  if (!acc) return "";
  const clean = acc.trim();
  if (clean.length <= 4) return "••••" + clean;
  return clean.slice(0, 2) + "*".repeat(Math.max(4, clean.length - 4)) + clean.slice(-2);
}

// Helper: Detect if string is already a masked representation
export function isMaskedAccountNumber(acc: string): boolean {
  if (!acc) return false;
  return acc.includes("*") || acc.includes("•");
}

// Helper: Sanitize recipient document for safe client API responses (NO plaintext, NO ciphertext keys)
export function sanitizeRecipientForResponse(raw: any): CommissionRecipient {
  const payout = raw.payoutAccount;
  let sanitizedPayout: PayoutAccount | null = null;

  if (payout) {
    let masked = payout.accountNumberMasked;
    if (!masked && payout.accountNumber) {
      masked = maskAccountNumber(payout.accountNumber);
    } else if (!masked && payout.encryptedAccountNumber) {
      try {
        const decrypted = decryptSecret(payout.encryptedAccountNumber);
        masked = maskAccountNumber(decrypted);
      } catch {
        masked = "••••****";
      }
    }

    sanitizedPayout = {
      bankName: payout.bankName || "",
      accountNumberMasked: masked || "••••",
      accountHolderName: payout.accountHolderName || ""
    };
  }

  return {
    id: raw.id,
    userId: raw.userId || null,
    code: raw.code,
    name: raw.name,
    type: raw.type,
    status: raw.status,
    notes: raw.notes || "",
    payoutAccount: sanitizedPayout,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy,
    updatedBy: raw.updatedBy
  };
}

// Helper: Sanitize recipient document for safe audit log records (NO plaintext, NO ciphertext, NO secrets)
export function sanitizeRecipientForAudit(raw: any): any {
  if (!raw) return null;
  const sanitized = sanitizeRecipientForResponse(raw);
  return {
    id: sanitized.id,
    code: sanitized.code,
    name: sanitized.name,
    type: sanitized.type,
    status: sanitized.status,
    userId: sanitized.userId,
    notes: sanitized.notes,
    payoutAccount: sanitized.payoutAccount ? {
      bankName: sanitized.payoutAccount.bankName,
      accountNumberMasked: sanitized.payoutAccount.accountNumberMasked,
      accountHolderName: sanitized.payoutAccount.accountHolderName
    } : null,
    createdAt: sanitized.createdAt,
    updatedAt: sanitized.updatedAt,
    createdBy: sanitized.createdBy,
    updatedBy: sanitized.updatedBy
  };
}

// ==========================================
// CONFIGURATION APIs
// ==========================================

export async function getCommissionConfigApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { SystemConfigRepository } = await import("./supabase/system-config-repository");
    const config = await SystemConfigRepository.getInstance().getConfig("commission_config") || DEFAULT_COMMISSION_CONFIG;

    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error("[Get Commission Config Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal mengambil konfigurasi komisi" });
  }
}

export async function updateCommissionConfigApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const role = req.user?.role || "admin";
    const body = req.body as Partial<CommissionConfig>;

    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
      return res.status(400).json({ success: false, message: "Field 'enabled' harus boolean." });
    }

    if (body.defaultCalculationMethod && !["PERCENTAGE_OF_SELLING_PRICE", "FIXED_AMOUNT", "PERCENTAGE_OF_MARGIN"].includes(body.defaultCalculationMethod)) {
      return res.status(400).json({ success: false, message: "Metode kalkulasi default tidak valid." });
    }

    if (body.minimumPayoutThreshold !== undefined && (typeof body.minimumPayoutThreshold !== "number" || body.minimumPayoutThreshold < 0)) {
      return res.status(400).json({ success: false, message: "Minimum payout threshold harus angka >= 0." });
    }

    if (body.supportedRecipientTypes && !Array.isArray(body.supportedRecipientTypes)) {
      return res.status(400).json({ success: false, message: "supportedRecipientTypes harus array." });
    }

    // MVP restriction
    if (body.supportedRecipientTypes && body.supportedRecipientTypes.some(t => t !== "AFFILIATE")) {
      return res.status(400).json({ success: false, message: "Untuk Phase 1 MVP, hanya tipe 'AFFILIATE' yang didukung." });
    }

    const { SystemConfigRepository } = await import("./supabase/system-config-repository");
    const existing = await SystemConfigRepository.getInstance().getConfig("commission_config") || DEFAULT_COMMISSION_CONFIG;

    const now = new Date().toISOString();
    const updatedConfig: CommissionConfig = {
      ...existing,
      ...body,
      defaultCurrency: "IDR",
      supportedRecipientTypes: ["AFFILIATE"],
      updatedAt: now,
      updatedBy: actor.uid
    };

    // Store in Supabase as Single Source of Truth
    await SystemConfigRepository.getInstance().upsertConfig("commission_config", updatedConfig);

    await logCoreAudit(
      actor,
      role,
      "UPDATE_COMMISSION_CONFIG",
      "systemConfigs/commission_config",
      existing,
      updatedConfig,
      "Updated commission foundation configuration in Supabase"
    );

    return res.status(200).json({
      success: true,
      message: "Konfigurasi komisi berhasil disimpan di Supabase",
      data: updatedConfig
    });
  } catch (error: any) {
    console.error("[Update Commission Config Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal menyimpan konfigurasi komisi" });
  }
}

// ==========================================
// RECIPIENTS APIs
// ==========================================

export async function getCommissionRecipientsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, type, search } = req.query;
    const recipientsList = await repo.getRecipients({
      status: status && typeof status === "string" ? status : undefined,
      type: type && typeof type === "string" ? type : undefined,
      search: search && typeof search === "string" ? search : undefined
    });

    const sanitized = recipientsList.map(sanitizeRecipientForResponse);

    return res.status(200).json({
      success: true,
      data: sanitized
    });
  } catch (error: any) {
    console.error("[Get Commission Recipients Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal mengambil daftar penerima komisi" });
  }
}

export async function getCommissionRecipientByIdApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const recipient = await repo.getRecipientById(id);

    if (!recipient) {
      return res.status(404).json({ success: false, message: "Penerima komisi tidak ditemukan." });
    }

    const sanitized = sanitizeRecipientForResponse(recipient);

    return res.status(200).json({
      success: true,
      data: sanitized
    });
  } catch (error: any) {
    console.error("[Get Commission Recipient Detail Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal mengambil detail penerima komisi" });
  }
}

export async function createCommissionRecipientApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const role = req.user?.role || "admin";
    const { name, code, type = "AFFILIATE", status = "ACTIVE", notes, payoutAccount, userId } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Nama penerima wajib diisi (minimal 2 karakter)." });
    }

    const normalizedCode = normalizeAffiliateCode(code);
    if (!normalizedCode || normalizedCode.length < 3 || normalizedCode.length > 25) {
      return res.status(400).json({ success: false, message: "Kode afiliasi wajib diisi (3-25 karakter alfanumerik/tanda hubung/garis bawah)." });
    }

    if (type !== "AFFILIATE") {
      return res.status(400).json({ success: false, message: "Pada Phase 1 MVP, hanya tipe 'AFFILIATE' yang diizinkan." });
    }

    if (!["ACTIVE", "SUSPENDED", "INACTIVE"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status tidak valid." });
    }

    // Check code uniqueness in commissionRecipients
    const existingRecipient = await repo.getRecipientByCode(normalizedCode);
    if (existingRecipient) {
      return res.status(400).json({ success: false, message: `Kode afiliasi '${normalizedCode}' sudah digunakan oleh penerima lain.` });
    }

    const generatedId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Prepare encrypted payout account storage
    let firestorePayout: any = null;
    if (payoutAccount && (payoutAccount.bankName || payoutAccount.accountNumber)) {
      const rawAcc = String(payoutAccount.accountNumber || "").trim();
      const bank = String(payoutAccount.bankName || "").trim();
      const holder = String(payoutAccount.accountHolderName || "").trim();

      if (rawAcc && !isMaskedAccountNumber(rawAcc)) {
        firestorePayout = {
          bankName: bank,
          encryptedAccountNumber: encryptSecret(rawAcc),
          accountNumberMasked: maskAccountNumber(rawAcc),
          accountHolderName: holder
        };
      } else {
        firestorePayout = {
          bankName: bank,
          encryptedAccountNumber: "",
          accountNumberMasked: isMaskedAccountNumber(rawAcc) ? rawAcc : "",
          accountHolderName: holder
        };
      }
    }

    const newRecipientDoc = {
      id: generatedId,
      name: name.trim(),
      code: normalizedCode,
      type: "AFFILIATE" as any,
      status: status as any,
      notes: notes ? notes.trim() : "",
      userId: userId || null,
      payoutAccount: firestorePayout,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
      updatedBy: actor.uid
    };

    // Store in Supabase using Repository
    const savedRecipient = await repo.createRecipient(newRecipientDoc);

    // Audit with masked account number only (NO plaintext, NO ciphertext keys)
    const auditPayload = sanitizeRecipientForAudit(newRecipientDoc);

    await logCoreAudit(
      actor,
      role,
      "CREATE_COMMISSION_RECIPIENT",
      `commissionRecipients/${generatedId}`,
      null,
      auditPayload,
      `Created affiliate recipient: ${newRecipientDoc.name} (${newRecipientDoc.code})`
    );

    return res.status(201).json({
      success: true,
      message: "Penerima komisi afiliasi berhasil dibuat",
      data: sanitizeRecipientForResponse(savedRecipient)
    });
  } catch (error: any) {
    console.error("[Create Commission Recipient Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal membuat penerima komisi" });
  }
}

export async function updateCommissionRecipientApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const actor = {
      uid: req.user?.uid || "system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const role = req.user?.role || "admin";
    const { name, code, status, notes, payoutAccount, userId } = req.body;

    const existing = await repo.getRecipientById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Penerima komisi tidak ditemukan." });
    }

    if (name !== undefined && (typeof name !== "string" || name.trim().length < 2)) {
      return res.status(400).json({ success: false, message: "Nama penerima minimal 2 karakter." });
    }

    let normalizedCode = existing.code;
    if (code !== undefined) {
      normalizedCode = normalizeAffiliateCode(code);
      if (!normalizedCode || normalizedCode.length < 3 || normalizedCode.length > 25) {
        return res.status(400).json({ success: false, message: "Kode afiliasi tidak valid (3-25 karakter)." });
      }

      if (normalizedCode !== existing.code) {
        const checkRecipient = await repo.getRecipientByCode(normalizedCode);
        if (checkRecipient && checkRecipient.id !== id) {
          return res.status(400).json({ success: false, message: `Kode afiliasi '${normalizedCode}' sudah digunakan.` });
        }
      }
    }

    if (status !== undefined && !["ACTIVE", "SUSPENDED", "INACTIVE"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status penerima tidak valid." });
    }

    // Process payout account updates securely
    let firestorePayout: any = existing.payoutAccount || null;
    if (payoutAccount !== undefined) {
      if (payoutAccount === null) {
        firestorePayout = null;
      } else {
        const rawAcc = String(payoutAccount.accountNumber || "").trim();
        const bank = String(payoutAccount.bankName !== undefined ? payoutAccount.bankName : (existing.payoutAccount?.bankName || "")).trim();
        const holder = String(payoutAccount.accountHolderName !== undefined ? payoutAccount.accountHolderName : (existing.payoutAccount?.accountHolderName || "")).trim();

        if (rawAcc && !isMaskedAccountNumber(rawAcc)) {
          // New plaintext account number provided -> encrypt and mask
          firestorePayout = {
            bankName: bank,
            encryptedAccountNumber: encryptSecret(rawAcc),
            accountNumberMasked: maskAccountNumber(rawAcc),
            accountHolderName: holder
          };
        } else {
          // Preserve existing encrypted account number if unmodified or masked
          const prevEnc = existing.payoutAccount?.encryptedAccountNumber || "";
          const prevMask = existing.payoutAccount?.accountNumberMasked || "";

          firestorePayout = {
            bankName: bank,
            encryptedAccountNumber: prevEnc,
            accountNumberMasked: prevMask,
            accountHolderName: holder
          };
        }
      }
    }

    const now = new Date().toISOString();
    const updatedDoc = {
      ...existing,
      name: name !== undefined ? name.trim() : existing.name,
      code: normalizedCode,
      status: status !== undefined ? status : existing.status,
      notes: notes !== undefined ? notes.trim() : existing.notes,
      userId: userId !== undefined ? userId : existing.userId,
      payoutAccount: firestorePayout,
      updatedAt: now,
      updatedBy: actor.uid
    };

    // Clean any legacy plaintext accountNumber if present
    if (updatedDoc.payoutAccount && 'accountNumber' in updatedDoc.payoutAccount) {
      delete (updatedDoc.payoutAccount as any).accountNumber;
    }

    const savedRecipient = await repo.updateRecipient(id, updatedDoc);

    // Auditing with strictly masked data (NO secrets, NO cipher keys, NO plaintext)
    const auditBefore = sanitizeRecipientForAudit(existing);
    const auditAfter = sanitizeRecipientForAudit(updatedDoc);

    await logCoreAudit(
      actor,
      role,
      "UPDATE_COMMISSION_RECIPIENT",
      `commissionRecipients/${id}`,
      auditBefore,
      auditAfter,
      `Updated affiliate recipient: ${updatedDoc.name}`
    );

    return res.status(200).json({
      success: true,
      message: "Penerima komisi berhasil diperbarui",
      data: sanitizeRecipientForResponse(savedRecipient)
    });
  } catch (error: any) {
    console.error("[Update Commission Recipient Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal memperbarui penerima komisi" });
  }
}

// ==========================================
// RULES APIs
// ==========================================

export async function getCommissionRulesApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, recipientType, search } = req.query;
    const rulesList = await repo.getRules({
      status: status && typeof status === "string" ? status : undefined,
      recipientType: recipientType && typeof recipientType === "string" ? recipientType : undefined,
      search: search && typeof search === "string" ? search : undefined
    });

    return res.status(200).json({
      success: true,
      data: rulesList
    });
  } catch (error: any) {
    console.error("[Get Commission Rules Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal mengambil daftar aturan komisi" });
  }
}

export async function getCommissionRuleByIdApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const rule = await repo.getRuleById(id);

    if (!rule) {
      return res.status(404).json({ success: false, message: "Aturan komisi tidak ditemukan." });
    }

    return res.status(200).json({
      success: true,
      data: rule
    });
  } catch (error: any) {
    console.error("[Get Commission Rule Detail Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal mengambil detail aturan komisi" });
  }
}

export async function createCommissionRuleApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const role = req.user?.role || "admin";
    const { 
      name, 
      recipientType = "AFFILIATE", 
      recipientId, 
      gameId, 
      productId, 
      variantId, 
      calculationMethod = "PERCENTAGE_OF_SELLING_PRICE", 
      rate, 
      minOrderAmount = 0, 
      maxCommissionAmount, 
      priority = 10, 
      effectiveFrom, 
      effectiveUntil, 
      status = "ACTIVE" 
    } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Nama aturan komisi wajib diisi (minimal 2 karakter)." });
    }

    if (recipientType !== "AFFILIATE") {
      return res.status(400).json({ success: false, message: "Pada Phase 1 MVP, hanya tipe 'AFFILIATE' yang diizinkan." });
    }

    if (!["PERCENTAGE_OF_SELLING_PRICE", "FIXED_AMOUNT", "PERCENTAGE_OF_MARGIN"].includes(calculationMethod)) {
      return res.status(400).json({ success: false, message: "Metode perhitungan komisi tidak valid." });
    }

    if (typeof rate !== "number" || rate < 0) {
      return res.status(400).json({ success: false, message: "Rate / nominal komisi harus angka non-negatif." });
    }

    if ((calculationMethod === "PERCENTAGE_OF_SELLING_PRICE" || calculationMethod === "PERCENTAGE_OF_MARGIN") && rate > 100) {
      return res.status(400).json({ success: false, message: "Persentase komisi tidak boleh melebihi 100%." });
    }

    if (typeof minOrderAmount !== "number" || minOrderAmount < 0) {
      return res.status(400).json({ success: false, message: "Minimum nominal order harus angka >= 0." });
    }

    if (maxCommissionAmount !== undefined && maxCommissionAmount !== null && (typeof maxCommissionAmount !== "number" || maxCommissionAmount < 0)) {
      return res.status(400).json({ success: false, message: "Batas maksimum komisi harus angka >= 0." });
    }

    if (typeof priority !== "number" || priority < 1) {
      return res.status(400).json({ success: false, message: "Prioritas aturan harus integer >= 1 (1 = tertinggi)." });
    }

    if (!effectiveFrom || isNaN(Date.parse(effectiveFrom))) {
      return res.status(400).json({ success: false, message: "Tanggal mulai berlaku (effectiveFrom) wajib diisi dan valid." });
    }

    if (effectiveUntil && isNaN(Date.parse(effectiveUntil))) {
      return res.status(400).json({ success: false, message: "Tanggal selesai berlaku (effectiveUntil) tidak valid." });
    }

    if (effectiveUntil && new Date(effectiveUntil) < new Date(effectiveFrom)) {
      return res.status(400).json({ success: false, message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." });
    }

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status aturan harus ACTIVE atau INACTIVE." });
    }

    // Verify recipientId if provided
    if (recipientId) {
      const recipient = await repo.getRecipientById(recipientId);
      if (!recipient) {
        return res.status(400).json({ success: false, message: `Penerima komisi dengan ID '${recipientId}' tidak ditemukan.` });
      }
    }

    const generatedId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newRule: CommissionRule = {
      id: generatedId,
      name: name.trim(),
      recipientType: "AFFILIATE",
      recipientId: recipientId || null,
      gameId: gameId ? gameId.trim() : null,
      productId: productId ? productId.trim() : null,
      variantId: variantId ? variantId.trim() : null,
      calculationMethod,
      rate,
      minOrderAmount,
      maxCommissionAmount: maxCommissionAmount !== undefined && maxCommissionAmount !== null ? maxCommissionAmount : null,
      priority: Math.floor(priority),
      effectiveFrom: new Date(effectiveFrom).toISOString().split("T")[0],
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString().split("T")[0] : null,
      status: status as any,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
      updatedBy: actor.uid
    };

    const savedRule = await repo.createRule(newRule);

    await logCoreAudit(
      actor,
      role,
      "CREATE_COMMISSION_RULE",
      `commissionRules/${generatedId}`,
      null,
      newRule,
      `Created commission rule: ${newRule.name}`
    );

    return res.status(201).json({
      success: true,
      message: "Aturan komisi berhasil dibuat",
      data: savedRule
    });
  } catch (error: any) {
    console.error("[Create Commission Rule Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal membuat aturan komisi" });
  }
}

export async function updateCommissionRuleApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const actor = {
      uid: req.user?.uid || "system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const role = req.user?.role || "admin";
    const body = req.body;

    const existing = await repo.getRuleById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Aturan komisi tidak ditemukan." });
    }

    if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length < 2)) {
      return res.status(400).json({ success: false, message: "Nama aturan komisi minimal 2 karakter." });
    }

    if (body.calculationMethod !== undefined && !["PERCENTAGE_OF_SELLING_PRICE", "FIXED_AMOUNT", "PERCENTAGE_OF_MARGIN"].includes(body.calculationMethod)) {
      return res.status(400).json({ success: false, message: "Metode perhitungan komisi tidak valid." });
    }

    const method = body.calculationMethod !== undefined ? body.calculationMethod : existing.calculationMethod;
    const rate = body.rate !== undefined ? body.rate : existing.rate;

    if (typeof rate !== "number" || rate < 0) {
      return res.status(400).json({ success: false, message: "Rate / nominal komisi harus non-negatif." });
    }

    if ((method === "PERCENTAGE_OF_SELLING_PRICE" || method === "PERCENTAGE_OF_MARGIN") && rate > 100) {
      return res.status(400).json({ success: false, message: "Persentase komisi tidak boleh melebihi 100%." });
    }

    if (body.minOrderAmount !== undefined && (typeof body.minOrderAmount !== "number" || body.minOrderAmount < 0)) {
      return res.status(400).json({ success: false, message: "Minimum nominal order harus angka >= 0." });
    }

    if (body.maxCommissionAmount !== undefined && body.maxCommissionAmount !== null && (typeof body.maxCommissionAmount !== "number" || body.maxCommissionAmount < 0)) {
      return res.status(400).json({ success: false, message: "Batas maksimum komisi harus angka >= 0." });
    }

    if (body.priority !== undefined && (typeof body.priority !== "number" || body.priority < 1)) {
      return res.status(400).json({ success: false, message: "Prioritas aturan harus integer >= 1." });
    }

    const effectiveFrom = body.effectiveFrom !== undefined ? body.effectiveFrom : existing.effectiveFrom;
    const effectiveUntil = body.effectiveUntil !== undefined ? body.effectiveUntil : existing.effectiveUntil;

    if (effectiveUntil && new Date(effectiveUntil) < new Date(effectiveFrom)) {
      return res.status(400).json({ success: false, message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." });
    }

    if (body.status !== undefined && !["ACTIVE", "INACTIVE"].includes(body.status)) {
      return res.status(400).json({ success: false, message: "Status aturan harus ACTIVE atau INACTIVE." });
    }

    if (body.recipientId) {
      const recipient = await repo.getRecipientById(body.recipientId);
      if (!recipient) {
        return res.status(400).json({ success: false, message: `Penerima komisi dengan ID '${body.recipientId}' tidak ditemukan.` });
      }
    }

    const now = new Date().toISOString();
    const updatedRule: CommissionRule = {
      ...existing,
      name: body.name !== undefined ? body.name.trim() : existing.name,
      recipientType: "AFFILIATE",
      recipientId: body.recipientId !== undefined ? (body.recipientId || null) : existing.recipientId,
      gameId: body.gameId !== undefined ? (body.gameId ? body.gameId.trim() : null) : existing.gameId,
      productId: body.productId !== undefined ? (body.productId ? body.productId.trim() : null) : existing.productId,
      variantId: body.variantId !== undefined ? (body.variantId ? body.variantId.trim() : null) : existing.variantId,
      calculationMethod: method,
      rate,
      minOrderAmount: body.minOrderAmount !== undefined ? body.minOrderAmount : existing.minOrderAmount,
      maxCommissionAmount: body.maxCommissionAmount !== undefined ? body.maxCommissionAmount : existing.maxCommissionAmount,
      priority: body.priority !== undefined ? Math.floor(body.priority) : existing.priority,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString().split("T")[0] : existing.effectiveFrom,
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString().split("T")[0] : null,
      status: body.status !== undefined ? body.status : existing.status,
      updatedAt: now,
      updatedBy: actor.uid
    };

    const savedRule = await repo.updateRule(id, updatedRule);

    await logCoreAudit(
      actor,
      role,
      "UPDATE_COMMISSION_RULE",
      `commissionRules/${id}`,
      existing,
      updatedRule,
      `Updated commission rule: ${updatedRule.name}`
    );

    return res.status(200).json({
      success: true,
      message: "Aturan komisi berhasil diperbarui",
      data: savedRule
    });
  } catch (error: any) {
    console.error("[Update Commission Rule Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal memperbarui aturan komisi" });
  }
}

// ==========================================
// COMMISSION RECORDS APIs (Phase 2)
// ==========================================

export async function getCommissionRecordsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      orderId, 
      recipientId, 
      status, 
      calculationMethod, 
      startDate, 
      endDate, 
      search 
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

    // Fetch from Supabase via Repository
    let allRecords = await repo.getRecords({
      orderId: orderId && typeof orderId === "string" ? orderId.trim() : undefined,
      recipientId: recipientId && typeof recipientId === "string" ? recipientId.trim() : undefined,
      status: status && typeof status === "string" && status !== "ALL" ? status.trim() : undefined,
      calculationMethod: calculationMethod && typeof calculationMethod === "string" && calculationMethod !== "ALL" ? calculationMethod.trim() : undefined
    });

    // Client-side date filtering & search matching for maximum precision without complex composite indexes
    if (startDate && typeof startDate === "string") {
      const startIso = new Date(startDate).toISOString().slice(0, 10);
      allRecords = allRecords.filter(r => (r.earnedAt || r.createdAt).slice(0, 10) >= startIso);
    }

    if (endDate && typeof endDate === "string") {
      const endIso = new Date(endDate).toISOString().slice(0, 10);
      allRecords = allRecords.filter(r => (r.earnedAt || r.createdAt).slice(0, 10) <= endIso);
    }

    if (search && typeof search === "string") {
      const q = search.toLowerCase().trim();
      allRecords = allRecords.filter(r => 
        r.id.toLowerCase().includes(q) ||
        r.orderId.toLowerCase().includes(q) ||
        r.recipientCode.toLowerCase().includes(q) ||
        r.recipientName.toLowerCase().includes(q) ||
        r.ruleName.toLowerCase().includes(q) ||
        (r.metadata?.invoice && String(r.metadata.invoice).toLowerCase().includes(q))
      );
    }

    // Sort by earnedAt / createdAt desc
    allRecords.sort((a, b) => (b.earnedAt || b.createdAt).localeCompare(a.earnedAt || a.createdAt));

    // Compute Summary Stats
    const totalRecords = allRecords.length;
    let totalPayable = 0;
    let totalCancelled = 0;
    let totalCommissionAmount = 0;
    let payableAmount = 0;
    let cancelledAmount = 0;

    allRecords.forEach(r => {
      const amt = Number(r.commissionAmount) || 0;
      totalCommissionAmount += amt;
      if (r.status === "PAYABLE") {
        totalPayable++;
        payableAmount += amt;
      } else if (r.status === "CANCELLED") {
        totalCancelled++;
        cancelledAmount += amt;
      }
    });

    // Pagination slice
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedRecords = allRecords.slice(startIndex, startIndex + limitNum);
    const totalPages = Math.ceil(totalRecords / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: {
        records: paginatedRecords,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalRecords,
          totalPages
        },
        summary: {
          totalRecords,
          totalPayable,
          totalCancelled,
          totalCommissionAmount,
          payableAmount,
          cancelledAmount
        }
      }
    });
  } catch (error: any) {
    console.error("[Get Commission Records Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal mengambil riwayat catatan komisi" });
  }
}

export async function getCommissionRecordByIdApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "ID catatan komisi diperlukan." });
    }

    const record = await repo.getRecordById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Catatan komisi tidak ditemukan." });
    }

    return res.status(200).json({
      success: true,
      data: record
    });
  } catch (error: any) {
    console.error("[Get Commission Record By ID Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal mengambil detail catatan komisi" });
  }
}

// ==========================================
// COMMISSION - LEDGER RECONCILIATION API (Phase 3)
// ==========================================

export async function getCommissionReconciliationApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { reconcileCommissionLedger } = await import("./ledger-service");
    const report = await reconcileCommissionLedger();

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error: any) {
    console.error("[Commission Reconciliation Error]", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Gagal menjalankan verifikasi rekonsiliasi komisi dan buku besar" 
    });
  }
}

// ==========================================
// COMMISSION REFUND CLAWBACK API (Phase 4: Manual / Recovery Trigger)
// ==========================================

export async function triggerCommissionRefundClawbackApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "admin",
      email: req.user?.email || "admin@istore.co.id"
    };
    const { orderId, refundKey } = req.body;

    if (!orderId || !refundKey) {
      return res.status(400).json({
        success: false,
        message: "orderId dan refundKey wajib diisi."
      });
    }

    // Verify refundKey is SUCCEEDED via Supabase
    const refundData = await SupabaseRefundRepository.getInstance().getRefundById(String(refundKey).trim());
    if (!refundData) {
      return res.status(404).json({
        success: false,
        message: `Dokumen refund '${refundKey}' tidak ditemukan.`
      });
    }

    if (refundData.status !== "SUCCEEDED") {
      return res.status(400).json({
        success: false,
        message: `Refund '${refundKey}' berstatus '${refundData.status}', harus 'SUCCEEDED' untuk memproses clawback komisi.`
      });
    }

    const { CommissionService } = await import("./commission-service");
    const result = await CommissionService.getInstance().handleOrderRefund(
      String(orderId).trim(),
      String(refundKey).trim(),
      Number(refundData.amount) || 0,
      actor
    );

    return res.status(200).json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    console.error("[Trigger Commission Clawback Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal memproses pembalikan komisi untuk refund"
    });
  }
}

// ============================================================================
// PHASE 5: PAYOUT & DISBURSEMENT HANDLERS
// ============================================================================

/**
 * GET /api/admin/commission/payouts
 * List payout batches with optional status / recipient filter.
 */
export async function handleListPayoutBatches(req: any, res: any) {
  try {
    const { status, recipientId, limit = "50" } = req.query;
    
    const batches = await repo.getPayoutBatches({
      status: status ? String(status).trim() : undefined,
      recipientId: recipientId ? String(recipientId).trim() : undefined
    });

    const maxLimit = Math.min(parseInt(String(limit), 10) || 50, 100);
    const limitedBatches = batches.slice(0, maxLimit);

    return res.status(200).json({
      success: true,
      batches: limitedBatches,
      count: limitedBatches.length
    });
  } catch (error: any) {
    console.error("[List Payout Batches Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal memuat daftar batch payout"
    });
  }
}

/**
 * GET /api/admin/commission/payouts/:batchId
 * Get payout batch detail.
 */
export async function handleGetPayoutBatchDetail(req: any, res: any) {
  try {
    const { batchId } = req.params;
    const batch = await repo.getPayoutBatchById(String(batchId).trim());
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: `Batch payout '${batchId}' tidak ditemukan.`
      });
    }

    // Also fetch associated commission records details from Supabase
    const allocations = Array.isArray(batch.allocations) ? batch.allocations : [];
    const commissionDetails: any[] = [];
    for (const item of allocations) {
      const record = await repo.getRecordById(item.commissionId);
      if (record) {
        commissionDetails.push(record);
      }
    }

    return res.status(200).json({
      success: true,
      batch,
      commissionRecords: commissionDetails
    });
  } catch (error: any) {
    console.error("[Get Payout Batch Detail Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal memuat detail batch payout"
    });
  }
}

/**
 * POST /api/admin/commission/payouts/create
 * Create a new payout batch locking commission records.
 */
export async function handleCreatePayoutBatch(req: any, res: any) {
  try {
    const actor = {
      uid: req.user?.uid || "admin_system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const { recipientId, commissionRecordIds, overrideThreshold, overrideReason } = req.body;

    const { CommissionService } = await import("./commission-service");
    const result = await CommissionService.getInstance().createPayoutBatch({
      recipientId,
      commissionRecordIds,
      actor,
      overrideThreshold,
      overrideReason
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error: any) {
    console.error("[Create Payout Batch Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal membuat batch payout"
    });
  }
}

/**
 * POST /api/admin/commission/payouts/:batchId/submit
 * Submit batch for approval (DRAFT -> PENDING_APPROVAL).
 */
export async function handleSubmitPayoutBatch(req: any, res: any) {
  try {
    const actor = {
      uid: req.user?.uid || "admin_system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const { batchId } = req.params;

    const { CommissionService } = await import("./commission-service");
    const result = await CommissionService.getInstance().submitPayoutBatch(String(batchId).trim(), actor);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Submit Payout Batch Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengajukan batch payout"
    });
  }
}

/**
 * POST /api/admin/commission/payouts/:batchId/approve
 * Approve batch (PENDING_APPROVAL -> PROCESSING) with Maker-Checker check.
 */
export async function handleApprovePayoutBatch(req: any, res: any) {
  try {
    const actor = {
      uid: req.user?.uid || "admin_system",
      email: req.user?.email || "admin@istore.co.id",
      isOwner: req.user?.role === "OWNER" || req.user?.isOwner === true
    };
    const { batchId } = req.params;

    const { CommissionService } = await import("./commission-service");
    const result = await CommissionService.getInstance().approvePayoutBatch(String(batchId).trim(), actor);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Approve Payout Batch Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal menyetujui batch payout"
    });
  }
}

/**
 * POST /api/admin/commission/payouts/:batchId/confirm-paid
 * Confirm paid with bank transfer reference & post to ledger.
 */
export async function handleConfirmPayoutPaid(req: any, res: any) {
  try {
    const actor = {
      uid: req.user?.uid || "admin_system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const { batchId } = req.params;
    const { transferReference, proofReference } = req.body;

    const { CommissionService } = await import("./commission-service");
    const result = await CommissionService.getInstance().confirmPayoutPaid({
      batchId: String(batchId).trim(),
      transferReference,
      proofReference,
      actor
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Confirm Payout Paid Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengonfirmasi pembayaran payout"
    });
  }
}

/**
 * POST /api/admin/commission/payouts/:batchId/cancel
 * Cancel batch & unlock commission records back to UNPAID.
 */
export async function handleCancelPayoutBatch(req: any, res: any) {
  try {
    const actor = {
      uid: req.user?.uid || "admin_system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const { batchId } = req.params;
    const { cancellationReason } = req.body;

    const { CommissionService } = await import("./commission-service");
    const result = await CommissionService.getInstance().cancelPayoutBatch({
      batchId: String(batchId).trim(),
      cancellationReason,
      actor
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Cancel Payout Batch Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal membatalkan batch payout"
    });
  }
}

/**
 * POST /api/admin/commission/payouts/:batchId/mark-failed
 * Mark batch FAILED & unlock commission records.
 */
export async function handleMarkPayoutBatchFailed(req: any, res: any) {
  try {
    const actor = {
      uid: req.user?.uid || "admin_system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const { batchId } = req.params;
    const { failureReason } = req.body;

    const { CommissionService } = await import("./commission-service");
    const result = await CommissionService.getInstance().markPayoutBatchFailed({
      batchId: String(batchId).trim(),
      failureReason,
      actor
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Mark Payout Batch Failed Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal menandai batch FAILED"
    });
  }
}

/**
 * GET /api/admin/commission/payouts/:batchId/export-instruction
 * Export Generic Bank Transfer CSV.
 */
export async function handleExportTransferInstruction(req: any, res: any) {
  try {
    const actor = {
      uid: req.user?.uid || "admin_system",
      email: req.user?.email || "admin@istore.co.id"
    };
    const { batchId } = req.params;

    const { CommissionService } = await import("./commission-service");
    const result = await CommissionService.getInstance().exportTransferInstruction(String(batchId).trim(), actor);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.csvContent);
  } catch (error: any) {
    console.error("[Export Transfer Instruction Error]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengekspor instruksi transfer"
    });
  }
}

