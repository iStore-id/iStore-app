import { AuthenticatedRequest } from "./middleware";
import { Response } from "express";
import { adminDb } from "./firebase-admin";
import { ProviderSku } from "../types/core";
import crypto from "crypto";

// Event logger utility referencing administrative audit log
async function logAudit(req: AuthenticatedRequest, action: string, collection: string, targetId: string, details: Record<string, any>) {
  try {
    const logRef = adminDb.collection("auditLogs").doc();
    await logRef.set({
      id: logRef.id,
      actorId: req.user?.uid || "system",
      actorEmail: req.user?.email || "system@istore.id",
      actorRole: req.user?.role || "admin",
      action,
      collection,
      targetId,
      details,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
      userAgent: req.headers["user-agent"] || "unknown",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// Safe CSV parser
function parseSafeCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current);
        current = "";
      } else if (char === "\r" || char === "\n") {
        row.push(current);
        current = "";
        if (row.some(val => val.trim() !== "")) {
          result.push(row);
        }
        row = [];
        if (char === "\r" && next === "\n") {
          i++;
        }
      } else {
        current += char;
      }
    }
  }
  
  if (current || row.length > 0) {
    row.push(current);
    if (row.some(val => val.trim() !== "")) {
      result.push(row);
    }
  }
  
  return result;
}

// Clean & neutralize spreadsheet formula injection attacks
function sanitizeCellValue(val: string): string {
  const trimmed = val.trim();
  const cleaned = trimmed.replace(/[\x00-\x1F\x7F]/g, ""); // strip control chars
  if (
    cleaned.startsWith("=") ||
    cleaned.startsWith("+") ||
    cleaned.startsWith("@") ||
    (cleaned.startsWith("-") && isNaN(Number(cleaned)))
  ) {
    return "'" + cleaned;
  }
  return cleaned;
}

// Expire/cleanup older staging sessions (> 24 hours old)
async function cleanupStaleSessions() {
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const expiredSnap = await adminDb.collection("providerSkuImportSessions")
      .where("createdAt", "<", threshold)
      .limit(50)
      .get();
    
    if (!expiredSnap.empty) {
      const batch = adminDb.batch();
      expiredSnap.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Cleaned up ${expiredSnap.size} stale import sessions.`);
    }
  } catch (err) {
    console.error("Error cleaning stale import sessions:", err);
  }
}

export async function validateBulkImport(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId, fileName, fileContent } = req.body;

    if (!providerId) {
      return res.status(400).json({ success: false, message: "providerId wajib ditentukan." });
    }
    if (!fileContent) {
      return res.status(400).json({ success: false, message: "Konten file tidak boleh kosong." });
    }

    // 1. Validate provider existence
    const providerSnap = await adminDb.collection("providers").doc(providerId).get();
    if (!providerSnap.exists) {
      return res.status(404).json({ success: false, message: "Provider tidak ditemukan." });
    }

    // Run background cleanup
    cleanupStaleSessions().catch(console.error);

    // 2. Compute file SHA-256 hash
    const rawBuffer = Buffer.from(fileContent, "base64");
    const fileContentStr = rawBuffer.toString("utf8");
    const fileHash = crypto.createHash("sha256").update(rawBuffer).digest("hex");

    // 3. IDEMPOTENCY check (if imported previously)
    const existingSessionSnap = await adminDb.collection("providerSkuImportSessions")
      .where("fileHash", "==", fileHash)
      .where("status", "==", "IMPORTED")
      .limit(1)
      .get();

    let idempotencyWarning = "";
    if (!existingSessionSnap.empty) {
      idempotencyWarning = "File pricelist ini sudah pernah diimpor sebelumnya.";
    }

    // 4. Fetch DB list of existing SKUs to avoid O(N) database reads during validation
    const existingSkusSnap = await adminDb.collection("providerSkus")
      .where("providerId", "==", providerId)
      .get();

    const dbSkuMap = new Map<string, string>(); // providerSku (lowercase) -> documentId
    existingSkusSnap.forEach(doc => {
      const d = doc.data();
      if (d.providerSku) {
        dbSkuMap.set(d.providerSku.trim().toLowerCase(), doc.id);
      }
    });

    // 5. Parsing & Validation
    let parsedRows: any[] = [];
    let isJson = false;

    if (fileName?.endsWith(".json") || fileContentStr.trim().startsWith("[") || fileContentStr.trim().startsWith("{")) {
      isJson = true;
      try {
        const parsedJson = JSON.parse(fileContentStr);
        if (!Array.isArray(parsedJson)) {
          return res.status(400).json({ success: false, message: "Format berkas JSON harus berupa Array dari objek SKU." });
        }
        parsedRows = parsedJson;
      } catch (err) {
        return res.status(400).json({ success: false, message: "Format berkas JSON tidak valid atau malformed." });
      }
    } else {
      // Parse CSV
      const rawCsvRows = parseSafeCSV(fileContentStr);
      if (rawCsvRows.length < 2) {
        return res.status(400).json({ success: false, message: "Berkas CSV kosong atau tidak memiliki baris data." });
      }

      const headers = rawCsvRows[0].map(h => h.trim().toLowerCase());
      const skuIdx = headers.indexOf("providersku");
      const nameIdx = headers.indexOf("name");
      const typeIdx = headers.indexOf("type");
      const costIdx = headers.indexOf("basecost");
      const statusIdx = headers.indexOf("status");
      const targetIdx = headers.indexOf("targetfields");
      const metaIdx = headers.indexOf("metadata");

      if (skuIdx === -1 || nameIdx === -1) {
        return res.status(400).json({ success: false, message: "Header CSV harus memiliki minimal kolom 'providerSku' dan 'name'." });
      }

      // Convert rows
      for (let i = 1; i < rawCsvRows.length; i++) {
        const csvRow = rawCsvRows[i];
        if (csvRow.length === 0 || csvRow.every(cell => !cell.trim())) continue;

        const rowSku = csvRow[skuIdx] !== undefined ? sanitizeCellValue(csvRow[skuIdx]) : "";
        const rowName = csvRow[nameIdx] !== undefined ? sanitizeCellValue(csvRow[nameIdx]) : "";
        const rowType = typeIdx !== -1 && csvRow[typeIdx] !== undefined ? sanitizeCellValue(csvRow[typeIdx]) : "other";
        const rowCostStr = costIdx !== -1 && csvRow[costIdx] !== undefined ? sanitizeCellValue(csvRow[costIdx]) : "0";
        const rowStatus = statusIdx !== -1 && csvRow[statusIdx] !== undefined ? sanitizeCellValue(csvRow[statusIdx]) : "inactive";
        const rowTarget = targetIdx !== -1 && csvRow[targetIdx] !== undefined ? csvRow[targetIdx].trim() : "";
        const rowMeta = metaIdx !== -1 && csvRow[metaIdx] !== undefined ? csvRow[metaIdx].trim() : "";

        parsedRows.push({
          providerSku: rowSku,
          name: rowName,
          type: rowType,
          baseCost: rowCostStr,
          status: rowStatus,
          targetFields: rowTarget,
          metadata: rowMeta
        });
      }
    }

    // 6. Validate parsed rows
    const validatedRows: any[] = [];
    const seenFileSkus = new Set<string>();

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let idx = 0; idx < parsedRows.length; idx++) {
      const row = parsedRows[idx];
      const rowNum = idx + 1;
      const errors: string[] = [];

      let skuCode = "";
      let name = "";
      let type = "other";
      let baseCost = 0;
      let status: "active" | "inactive" = "inactive";
      let targetFields: string[] = [];
      let metadata: Record<string, any> = {};

      // Parse and check SKU
      if (typeof row.providerSku === "string" || typeof row.providerSku === "number") {
        skuCode = String(row.providerSku).trim();
      }
      if (!skuCode) {
        errors.push("providerSku wajib diisi.");
      } else if (skuCode.length > 100) {
        errors.push("providerSku terlalu panjang (maksimum 100 karakter).");
      }

      // Parse and check Name
      if (typeof row.name === "string") {
        name = row.name.trim();
      }
      if (!name) {
        errors.push("name wajib diisi.");
      } else if (name.length > 255) {
        errors.push("name terlalu panjang (maksimum 255 karakter).");
      }

      // Parse Type
      if (row.type) {
        const t = String(row.type).trim().toLowerCase();
        if (["topup", "voucher", "other"].includes(t)) {
          type = t;
        } else {
          errors.push("type harus berupa salah satu dari: topup, voucher, other.");
        }
      }

      // Parse BaseCost
      const rawCost = row.baseCost;
      if (rawCost !== undefined && rawCost !== null && rawCost !== "") {
        const parsedCost = Number(rawCost);
        if (isNaN(parsedCost) || !isFinite(parsedCost)) {
          errors.push("baseCost harus berupa angka valid.");
        } else if (parsedCost < 0) {
          errors.push("baseCost tidak boleh bernilai negatif.");
        } else {
          baseCost = parsedCost;
        }
      }

      // Parse Status
      if (row.status) {
        const s = String(row.status).trim().toLowerCase();
        if (["active", "inactive"].includes(s)) {
          status = s as "active" | "inactive";
        } else {
          errors.push("status harus bernilai active atau inactive.");
        }
      }

      // Parse Target Fields
      if (row.targetFields) {
        if (Array.isArray(row.targetFields)) {
          targetFields = row.targetFields.map((f: any) => String(f).trim()).filter(Boolean);
        } else if (typeof row.targetFields === "string") {
          const tfStr = row.targetFields.trim();
          if (tfStr.startsWith("[")) {
            try {
              const parsed = JSON.parse(tfStr);
              if (Array.isArray(parsed)) {
                targetFields = parsed.map((item: any) => String(item).trim()).filter(Boolean);
              }
            } catch {
              // fall through to comma splitted
              targetFields = tfStr.split(",").map(item => item.trim()).filter(Boolean);
            }
          } else {
            targetFields = tfStr.split(",").map(item => item.trim()).filter(Boolean);
          }
        }
      }

      // Parse Metadata
      if (row.metadata) {
        if (typeof row.metadata === "object") {
          metadata = row.metadata;
        } else if (typeof row.metadata === "string" && row.metadata.trim()) {
          try {
            metadata = JSON.parse(row.metadata.trim());
          } catch {
            errors.push("metadata harus berupa objek JSON yang valid.");
          }
        }
      }

      // Consolidate baseCost into metadata.baseCost to reuse core logic
      metadata.baseCost = baseCost;

      // Duplicate detection within the file
      const normSku = skuCode.toLowerCase();
      let rowStatus: "READY" | "DUPLICATE" | "INVALID" | "WARNING" = "READY";

      if (skuCode) {
        if (seenFileSkus.has(normSku)) {
          errors.push("Pemberitahuan: SKU terduplikasi di dalam berkas impor ini.");
          rowStatus = "DUPLICATE";
          duplicateCount++;
        } else {
          seenFileSkus.add(normSku);
        }
      }

      // Duplicate check against existing DB
      const isDbDuplicate = skuCode ? dbSkuMap.has(normSku) : false;
      const dbDocId = isDbDuplicate ? dbSkuMap.get(normSku) : undefined;

      if (isDbDuplicate && rowStatus !== "DUPLICATE") {
        rowStatus = "WARNING"; // Mark as warning of existing SKU
        duplicateCount++;
      }

      if (errors.length > 0 && rowStatus !== "DUPLICATE" && rowStatus !== "WARNING") {
        rowStatus = "INVALID";
        invalidCount++;
      } else if (errors.length === 0) {
        validCount++;
      }

      validatedRows.push({
        rowNumber: rowNum,
        skuCode,
        name,
        type,
        baseCost,
        status,
        targetFields,
        metadata,
        isValid: errors.length === 0,
        errors,
        rowStatus,
        isDbDuplicate,
        dbDocId
      });
    }

    // 7. Store the Session temporarily in Firestore
    const sessionRef = adminDb.collection("providerSkuImportSessions").doc();
    const importSession = {
      id: sessionRef.id,
      providerId,
      fileName: fileName ? String(fileName).replace(/[^a-zA-Z0-9._-]/g, "") : "import.csv",
      fileHash,
      createdBy: req.user?.uid || "system",
      createdAt: new Date().toISOString(),
      rowCount: validatedRows.length,
      validCount,
      invalidCount,
      duplicateCount,
      idempotencyWarning,
      status: "READY_FOR_REVIEW",
      rows: validatedRows
    };

    await sessionRef.set(importSession);
    await logAudit(req, "PROVIDER_SKU_BULK_IMPORT_STARTED", "providerSkuImportSessions", sessionRef.id, {
      providerId,
      fileName,
      fileHash,
      rowCount: validatedRows.length
    });

    return res.status(200).json({
      success: true,
      importId: sessionRef.id,
      data: importSession
    });

  } catch (error: any) {
    console.error("Bulk validation crash:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function executeBulkImport(req: AuthenticatedRequest, res: Response) {
  try {
    const { importId } = req.params;
    const { mode } = req.body; // 'SKIP_DUPLICATES' (default) or 'UPDATE_EXISTING'

    if (!importId) {
      return res.status(400).json({ success: false, message: "importId wajib ditentukan." });
    }

    const importMode = mode || "SKIP_DUPLICATES";

    // 1. Load session from database
    const sessionRef = adminDb.collection("providerSkuImportSessions").doc(importId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return res.status(404).json({ success: false, message: "Sesi impor tidak ditemukan." });
    }

    const sessionData = sessionSnap.data();
    if (sessionData?.status === "IMPORTED") {
      return res.status(400).json({ success: false, message: "Sesi impor ini sudah dieksekusi sebelumnya." });
    }

    // Double-check provider
    const providerId = sessionData?.providerId;
    const providerSnap = await adminDb.collection("providers").doc(providerId).get();
    if (!providerSnap.exists) {
      return res.status(400).json({ success: false, message: "Provider yang berasosiasi dengan berkas impor tidak ditemukan." });
    }

    const rows: any[] = sessionData?.rows || [];
    const createdSkus: string[] = [];
    const updatedSkus: string[] = [];
    
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // We process batch updates
    const batchSize = 100;
    let currentBatch = adminDb.batch();
    let opCounter = 0;

    // Double check collisions right before committing to avoid races
    const currentSkusSnap = await adminDb.collection("providerSkus")
      .where("providerId", "==", providerId)
      .get();
    const liveSkuMap = new Map<string, string>();
    currentSkusSnap.forEach(doc => {
      const d = doc.data();
      if (d.providerSku) {
        liveSkuMap.set(d.providerSku.trim().toLowerCase(), doc.id);
      }
    });

    const timestamp = new Date().toISOString();

    for (const row of rows) {
      if (!row.isValid && row.rowStatus !== "DUPLICATE" && row.rowStatus !== "WARNING") {
        failedCount++;
        continue; // skip invalid rows completely
      }

      if (row.rowStatus === "DUPLICATE") {
        skippedCount++;
        continue; // skip files duplicate
      }

      const normSku = row.skuCode.toLowerCase();
      const hasLiveColl = liveSkuMap.has(normSku);
      const liveDocId = hasLiveColl ? liveSkuMap.get(normSku) : undefined;

      if (hasLiveColl) {
        if (importMode === "SKIP_DUPLICATES") {
          skippedCount++;
          continue; // standard skip
        } else if (importMode === "UPDATE_EXISTING") {
          // UPDATE
          const updateRef = adminDb.collection("providerSkus").doc(liveDocId!);
          currentBatch.update(updateRef, {
            name: row.name,
            type: row.type,
            status: row.status,
            metadata: row.metadata,
            updatedAt: timestamp
          });
          updatedSkus.push(liveDocId!);
          successCount++;
          opCounter++;
        }
      } else {
        // CREATE
        const createRef = adminDb.collection("providerSkus").doc();
        const newSku: ProviderSku = {
          id: createRef.id,
          providerId,
          providerSku: row.skuCode,
          name: row.name,
          type: row.type,
          status: row.status,
          metadata: row.metadata,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        currentBatch.set(createRef, newSku);
        createdSkus.push(createRef.id);
        successCount++;
        opCounter++;
        
        // Add to live mapping in memory in case file has rows that create duplicates of itself
        liveSkuMap.set(normSku, createRef.id);
      }

      // Check batch boundaries
      if (opCounter >= batchSize) {
        await currentBatch.commit();
        currentBatch = adminDb.batch();
        opCounter = 0;
      }
    }

    // Flush any remaining operations
    if (opCounter > 0) {
      await currentBatch.commit();
    }

    // Update Session status
    await sessionRef.update({
      status: "IMPORTED",
      executedAt: timestamp,
      successCount,
      skippedCount,
      failedCount
    });

    await logAudit(req, "PROVIDER_SKU_BULK_IMPORT_COMPLETED", "providerSkuImportSessions", importId, {
      providerId,
      importId,
      successCount,
      skippedCount,
      failedCount,
      createdCount: createdSkus.length,
      updatedCount: updatedSkus.length
    });

    // Write audit logs for individual creations if needed
    for (const cId of createdSkus) {
      await logAudit(req, "CREATE_PROVIDER_SKU", "providerSkus", cId, { source: "bulk_import", importId });
    }
    for (const uId of updatedSkus) {
      await logAudit(req, "UPDATE_PROVIDER_SKU", "providerSkus", uId, { source: "bulk_import", importId });
    }

    return res.status(200).json({
      success: true,
      message: `Impor berhasil diselesaikan. Berhasil: ${successCount}, Dilewati: ${skippedCount}, Gagal: ${failedCount}.`,
      data: {
        successCount,
        skippedCount,
        failedCount,
        createdCount: createdSkus.length,
        updatedCount: updatedSkus.length
      }
    });

  } catch (error: any) {
    console.error("Bulk execution crash:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function importDiscoveryItems(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId, items, mode } = req.body;
    const importMode = mode || "SKIP_DUPLICATES";

    if (!providerId) {
      return res.status(400).json({ success: false, message: "providerId wajib ditentukan." });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items array wajib diisi." });
    }

    // Validate provider existence
    const providerSnap = await adminDb.collection("providers").doc(providerId).get();
    if (!providerSnap.exists) {
      return res.status(404).json({ success: false, message: "Provider tidak ditemukan." });
    }

    await logAudit(req, "PROVIDER_CATALOG_DISCOVERY_IMPORT_STARTED", "providerSkus", providerId, {
      providerId,
      itemCount: items.length,
      mode: importMode
    });

    // Fetch DB list of existing SKUs
    const existingSkusSnap = await adminDb.collection("providerSkus")
      .where("providerId", "==", providerId)
      .get();

    const dbSkuMap = new Map<string, string>(); // providerSku (lowercase) -> documentId
    existingSkusSnap.forEach(doc => {
      const d = doc.data();
      if (d.providerSku) {
        dbSkuMap.set(d.providerSku.trim().toLowerCase(), doc.id);
      }
    });

    const createdSkus: string[] = [];
    const updatedSkus: string[] = [];
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const batchSize = 100;
    let currentBatch = adminDb.batch();
    let opCounter = 0;
    const timestamp = new Date().toISOString();

    for (const item of items) {
      const skuRaw = item.providerSku ? String(item.providerSku).trim() : "";
      const nameRaw = item.name ? String(item.name).trim() : "";
      
      if (!skuRaw || !nameRaw) {
        failedCount++;
        continue;
      }

      const skuCode = sanitizeCellValue(skuRaw);
      const name = sanitizeCellValue(nameRaw);
      const normSku = skuCode.toLowerCase();

      const baseCost = typeof item.baseCost === "number" && item.baseCost >= 0 ? item.baseCost : 0;
      const status = item.isActive === true || item.isActive === "true" || item.status === "active" ? "active" : "inactive";
      const targetFields = Array.isArray(item.targetFields) ? item.targetFields : [];
      
      const itemMetadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
      const metadata = {
        ...itemMetadata,
        baseCost,
        targetFields
      };

      const hasLiveColl = dbSkuMap.has(normSku);
      const liveDocId = hasLiveColl ? dbSkuMap.get(normSku) : undefined;

      if (hasLiveColl) {
        if (importMode === "SKIP_DUPLICATES") {
          skippedCount++;
          continue;
        } else if (importMode === "UPDATE_EXISTING") {
          const updateRef = adminDb.collection("providerSkus").doc(liveDocId!);
          currentBatch.update(updateRef, {
            name,
            status,
            metadata,
            updatedAt: timestamp
          });
          updatedSkus.push(liveDocId!);
          successCount++;
          opCounter++;
        }
      } else {
        const createRef = adminDb.collection("providerSkus").doc();
        const newSku: ProviderSku = {
          id: createRef.id,
          providerId,
          providerSku: skuCode,
          name,
          type: item.type || "other",
          status,
          metadata,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        currentBatch.set(createRef, newSku);
        createdSkus.push(createRef.id);
        successCount++;
        opCounter++;
        dbSkuMap.set(normSku, createRef.id);
      }

      if (opCounter >= batchSize) {
        await currentBatch.commit();
        currentBatch = adminDb.batch();
        opCounter = 0;
      }
    }

    if (opCounter > 0) {
      await currentBatch.commit();
    }

    await logAudit(req, "PROVIDER_CATALOG_DISCOVERY_IMPORT_COMPLETED", "providerSkus", providerId, {
      providerId,
      successCount,
      skippedCount,
      failedCount,
      createdCount: createdSkus.length,
      updatedCount: updatedSkus.length,
      mode: importMode
    });

    for (const cId of createdSkus) {
      await logAudit(req, "CREATE_PROVIDER_SKU", "providerSkus", cId, { source: "catalog_discovery" });
    }
    for (const uId of updatedSkus) {
      await logAudit(req, "UPDATE_PROVIDER_SKU", "providerSkus", uId, { source: "catalog_discovery" });
    }

    return res.status(200).json({
      success: true,
      message: `Discovery import completed. Created: ${createdSkus.length}, Updated: ${updatedSkus.length}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
      data: {
        successCount,
        skippedCount,
        failedCount,
        createdCount: createdSkus.length,
        updatedCount: updatedSkus.length
      }
    });

  } catch (error: any) {
    console.error("Discovery import crash:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
