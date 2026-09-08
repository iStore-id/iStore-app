import crypto from "crypto";
import { adminDb } from "./firebase-admin";
import { SettlementBatch, SettlementRecord } from "../types/core";

// Standalone audit logger helper for settlement
export async function logAudit(userId: string, action: string, resource: string, resourceId: string, payload: any, ip: string = "") {
  const auditRef = adminDb.collection("auditLogs").doc();
  await auditRef.set({
    id: auditRef.id,
    adminUid: userId,
    action,
    resource,
    resourceId,
    payload,
    ip,
    createdAt: new Date().toISOString()
  });
}

// State-machine based robust CSV parser
export function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentField = "";

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // skip LF
      }
      row.push(currentField.trim());
      lines.push(row);
      row = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }
  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    lines.push(row);
  }
  return lines.filter(r => r.length > 0 && r.some(field => field !== ""));
}

const HEADER_MAPPING = {
  orderId: ["order_id", "order id", "orderid", "payment_reference_number", "payment reference number", "order_number", "order number"],
  grossAmount: ["gross_amount", "gross amount", "amount", "gross", "gross_amount_idr", "gross amount (idr)"],
  feeAmount: ["fee", "mdr", "charge", "gateway_fee", "fee_amount", "mdr_amount", "fee amount", "mdr amount"],
  refundAmount: ["refund", "refund_amount", "refund amount", "refund_amount_idr"],
  netAmount: ["net", "net_amount", "net amount", "amount_net", "amount (net)", "net amount (idr)"],
  paymentType: ["payment_type", "payment type", "payment_method", "payment method"],
  settlementTime: ["settlement_time", "settlement time", "settled_at", "settled at", "transaction_time", "transaction time", "settlement_date", "settlement date", "date"]
};

function findIndex(headers: string[], keys: string[]): number {
  return headers.findIndex(h => keys.includes(h.toLowerCase().trim()));
}

interface ProcessResult {
  success: boolean;
  code?: string;
  message: string;
  batch?: SettlementBatch;
  recordsCount?: number;
}

export async function processSettlementCsv(
  fileBuffer: Buffer,
  fileName: string,
  processedByUserId: string,
  ipAddress: string = ""
): Promise<ProcessResult> {
  // 1. File validation
  if (fileBuffer.length > 10 * 1024 * 1024) {
    await logAudit(processedByUserId, "SETTLEMENT_IMPORT_REJECTED", "settlements", "none", {
      reason: "FILE_SIZE_LIMIT_EXCEEDED",
      fileName,
      fileSize: fileBuffer.length
    }, ipAddress);
    return { success: false, code: "FILE_SIZE_EXCEEDED", message: "File size exceeds the 10MB limit." };
  }

  // 2. Hash computation for idempotency
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Check if this file hash was already imported
  const existingBatchQuery = await adminDb.collection("settlementBatches")
    .where("sourceFileHash", "==", fileHash)
    .limit(1)
    .get();

  if (!existingBatchQuery.empty) {
    await logAudit(processedByUserId, "SETTLEMENT_DUPLICATE_DETECTED", "settlements", "none", {
      fileName,
      fileHash
    }, ipAddress);
    return { success: false, code: "DUPLICATE_FILE", message: "This exact settlement report file has already been imported previously." };
  }

  // 3. Parser
  const csvText = fileBuffer.toString("utf-8");
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    return { success: false, code: "MALFORMED_FILE", message: "The CSV file is empty or missing data rows." };
  }

  const headers = rows[0];
  const orderIdIdx = findIndex(headers, HEADER_MAPPING.orderId);
  const grossAmountIdx = findIndex(headers, HEADER_MAPPING.grossAmount);
  const feeAmountIdx = findIndex(headers, HEADER_MAPPING.feeAmount);
  const refundAmountIdx = findIndex(headers, HEADER_MAPPING.refundAmount);
  const netAmountIdx = findIndex(headers, HEADER_MAPPING.netAmount);
  const paymentTypeIdx = findIndex(headers, HEADER_MAPPING.paymentType);
  const settlementTimeIdx = findIndex(headers, HEADER_MAPPING.settlementTime);

  // Core Columns Check
  if (orderIdIdx === -1 || grossAmountIdx === -1) {
    await logAudit(processedByUserId, "SETTLEMENT_IMPORT_REJECTED", "settlements", "none", {
      reason: "CONFIGURATION_REQUIRED",
      headers,
      fileName
    }, ipAddress);
    return {
      success: false,
      code: "CONFIGURATION_REQUIRED",
      message: "Required columns for order_id and gross_amount could not be mapped. Please verify the CSV header structure."
    };
  }

  // Fetch Payment Method Fee Configuration Fallback
  const feeConfigSnap = await adminDb.collection("systemConfigs").doc("payment_method_fees").get();
  const fallbackConfig = feeConfigSnap.exists ? feeConfigSnap.data()?.value : null;

  const recordsToInsert: SettlementRecord[] = [];
  let totalGross = 0;
  let totalMdr = 0;
  let totalRefund = 0;
  let totalAdjustment = 0;
  let totalNet = 0;
  let isDisputed = false;

  const dateStr = new Date().toISOString().split("T")[0];
  const batchId = `sett_batch_${dateStr}_${crypto.randomBytes(4).toString("hex")}`;

  // 4. Match with database
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[orderIdIdx]) continue; // Skip rows without order ID

    const orderId = row[orderIdIdx].trim();
    const grossAmount = parseFloat(row[grossAmountIdx].replace(/[^0-9.-]+/g, "")) || 0;

    let feeAmount = 0;
    let isFeeFallbackUsed = false;
    if (feeAmountIdx !== -1 && row[feeAmountIdx]) {
      feeAmount = parseFloat(row[feeAmountIdx].replace(/[^0-9.-]+/g, "")) || 0;
    } else {
      // Fee Fallback calculation
      const rowPaymentType = paymentTypeIdx !== -1 ? row[paymentTypeIdx].trim().toLowerCase() : "";
      if (fallbackConfig && fallbackConfig[rowPaymentType]) {
        const { percentage, flat } = fallbackConfig[rowPaymentType];
        feeAmount = (grossAmount * (percentage || 0)) + (flat || 0);
        isFeeFallbackUsed = true;
      } else {
        isDisputed = true; // No fee info found anywhere
      }
    }

    let refundAmount = 0;
    if (refundAmountIdx !== -1 && row[refundAmountIdx]) {
      refundAmount = parseFloat(row[refundAmountIdx].replace(/[^0-9.-]+/g, "")) || 0;
    }

    let netAmount = 0;
    if (netAmountIdx !== -1 && row[netAmountIdx]) {
      netAmount = parseFloat(row[netAmountIdx].replace(/[^0-9.-]+/g, "")) || 0;
    } else {
      netAmount = grossAmount - feeAmount - refundAmount;
    }

    const paymentType = paymentTypeIdx !== -1 && row[paymentTypeIdx] ? row[paymentTypeIdx].trim() : "unknown";
    const gatewaySettledAt = settlementTimeIdx !== -1 && row[settlementTimeIdx] ? row[settlementTimeIdx].trim() : new Date().toISOString();

    // Verification step
    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    let recordStatus = "SUCCESS";
    let isRecordDisputed = false;

    if (!orderSnap.exists) {
      isDisputed = true;
      isRecordDisputed = true;
      recordStatus = "ORDER_NOT_FOUND";
    } else {
      const orderData = orderSnap.data();
      const orderPaymentStatus = (orderData?.paymentStatus || "").toLowerCase();

      if (orderPaymentStatus !== "paid" && orderPaymentStatus !== "success") {
        isDisputed = true;
        isRecordDisputed = true;
        recordStatus = "PAYMENT_STATUS_MISMATCH";
      }

      // Check for Succeeded Refunds
      const refundsQuery = await adminDb.collection("refunds")
        .where("orderId", "==", orderId)
        .where("status", "==", "SUCCEEDED")
        .get();

      let fsRefundTotal = 0;
      refundsQuery.forEach(doc => {
        fsRefundTotal += doc.data().amount || 0;
      });

      // Verification of refund consistency
      if (fsRefundTotal !== refundAmount) {
        isDisputed = true;
        isRecordDisputed = true;
        recordStatus = "REFUND_MISMATCH";
      }

      // Check unique deterministic ID for record duplicates
      const recordRefId = `sett_rec_${orderId}`;
      const recordSnap = await adminDb.collection("settlementRecords").doc(recordRefId).get();
      if (recordSnap.exists) {
        isDisputed = true;
        isRecordDisputed = true;
        recordStatus = "ALREADY_SETTLED";
      }
    }

    const sourceRowHash = crypto.createHash("md5").update(row.join(",")).digest("hex");

    const record: SettlementRecord = {
      id: `sett_rec_${orderId}`,
      batchId,
      orderId,
      grossAmount,
      mdrFeeAmount: feeAmount,
      refundAmount,
      adjustmentAmount: 0,
      netAmount,
      paymentType,
      gatewayTransactionStatus: recordStatus,
      gatewaySettledAt,
      sourceRowHash,
      createdAt: new Date().toISOString()
    };

    recordsToInsert.push(record);
    totalGross += grossAmount;
    totalMdr += feeAmount;
    totalRefund += refundAmount;
    totalNet += netAmount;
  }

  if (recordsToInsert.length === 0) {
    return { success: false, code: "EMPTY_RECORDS", message: "No valid rows found to be imported." };
  }

  // 5. Build and Write atomic transaction
  const batchDoc: SettlementBatch = {
    id: batchId,
    periodDate: dateStr,
    periodStart: dateStr,
    periodEnd: dateStr,
    sourceType: "MIDTRANS_MAP_CSV",
    sourceFileName: fileName,
    sourceFileHash: fileHash,
    grossAmount: totalGross,
    mdrFeeAmount: totalMdr,
    refundAmount: totalRefund,
    adjustmentAmount: totalAdjustment,
    netSettledAmount: totalNet,
    orderCount: recordsToInsert.length,
    status: isDisputed ? "DISPUTED" : "CALCULATED",
    idempotencyKey: `sett_batch_key_${fileHash}`,
    processedBy: processedByUserId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await adminDb.runTransaction(async (transaction) => {
      const batchRef = adminDb.collection("settlementBatches").doc(batchId);
      transaction.set(batchRef, batchDoc);

      for (const rec of recordsToInsert) {
        const recRef = adminDb.collection("settlementRecords").doc(rec.id);
        transaction.set(recRef, rec);
      }
    });

    await logAudit(processedByUserId, "SETTLEMENT_BATCH_CREATED", "settlementBatches", batchId, {
      recordCount: recordsToInsert.length,
      isDisputed,
      gross: totalGross,
      net: totalNet
    }, ipAddress);

    return {
      success: true,
      batch: batchDoc,
      recordsCount: recordsToInsert.length,
      message: isDisputed
        ? "Batch settlement berhasil ditambahkan sebagai DISPUTED karena terdeteksi ketidakcocokan data."
        : "Batch settlement berhasil diimpor dan divalidasi secara sempurna."
    };
  } catch (err: any) {
    console.error("Settlement Transaction Fail:", err);
    return { success: false, code: "TRANSACTION_FAIL", message: `Transaction write failed: ${err.message}` };
  }
}
