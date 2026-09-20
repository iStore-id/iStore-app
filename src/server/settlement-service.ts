import { supabaseAdmin } from "./supabase-admin";
import { OrderRepository } from "./supabase/order-repository";
import { SystemConfigRepository } from "./supabase/system-config-repository";
import { SettlementBatch, SettlementRecord, ProcessResult } from "../types/core";
import * as crypto from "crypto";

const HEADER_MAPPING = {
  orderId: ['order_id', 'order id', 'orderid', 'p_order_id', 'reference_id'],
  grossAmount: ['gross_amount', 'gross amount', 'total_amount', 'amount', 'p_amount'],
  feeAmount: ['fee_amount', 'fee', 'mdr_fee', 'mdr'],
  refundAmount: ['refund_amount', 'refund'],
  netAmount: ['net_amount', 'net'],
  paymentType: ['payment_type', 'channel', 'method'],
  settlementTime: ['settlement_time', 'settled_at', 'time']
};

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  return lines.map(line => {
    const parts: string[] = [];
    let currentPart = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(currentPart);
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart);
    return parts;
  });
}

function findIndex(headers: string[], searchTerms: string[]): number {
  return headers.findIndex(h => {
    const normalized = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return searchTerms.some(term => normalized.includes(term.replace(/[^a-z0-9]/g, '')));
  });
}

export async function logAudit(userId: string, action: string, resource: string, resourceId: string, payload: any, ip: string = "") {
  await supabaseAdmin!.from("audit_logs").insert({
    actor: userId,
    action,
    entity: resource,
    entity_id: resourceId,
    details: payload,
    ip_address: ip,
    created_at: new Date().toISOString()
  });
}

export async function processSettlementCsv(fileBuffer: Buffer, fileName: string, processedByUserId: string, ipAddress: string = ""): Promise<ProcessResult> {
  return processSettlementImport(processedByUserId, fileName, fileBuffer, ipAddress);
}

export async function processSettlementImport(processedByUserId: string, fileName: string, fileBuffer: Buffer, ipAddress: string = ""): Promise<ProcessResult> {
  if (fileBuffer.length > 10 * 1024 * 1024) {
    await logAudit(processedByUserId, "SETTLEMENT_IMPORT_REJECTED", "settlements", "none", {
      reason: "FILE_SIZE_LIMIT_EXCEEDED",
      fileName,
      fileSize: fileBuffer.length
    }, ipAddress);
    return { success: false, code: "FILE_SIZE_EXCEEDED", message: "File size exceeds the 10MB limit." };
  }

  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  
  const { data: existingBatch } = await supabaseAdmin!
    .from("settlement_batches")
    .select("id")
    .eq("source_file_hash", fileHash)
    .maybeSingle();

  if (existingBatch) {
    await logAudit(processedByUserId, "SETTLEMENT_DUPLICATE_DETECTED", "settlements", "none", {
      fileName,
      fileHash
    }, ipAddress);
    return { success: false, code: "DUPLICATE_FILE", message: "This exact settlement report file has already been imported previously." };
  }

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

  const fallbackConfig = await SystemConfigRepository.getInstance().getConfig("payment_method_fees");
  const recordsToInsert: any[] = [];
  let totalGross = 0;
  let totalMdr = 0;
  let totalRefund = 0;
  let totalAdjustment = 0;
  let totalNet = 0;
  let isDisputed = false;
  const dateStr = new Date().toISOString().split("T")[0];
  const batchId = `sett_batch_${dateStr}_${crypto.randomBytes(4).toString("hex")}`;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[orderIdIdx]) continue;
    const orderId = row[orderIdIdx].trim();
    const grossAmount = parseFloat(row[grossAmountIdx].replace(/[^0-9.-]+/g, "")) || 0;
    
    let feeAmount = 0;
    if (feeAmountIdx !== -1 && row[feeAmountIdx]) {
      feeAmount = parseFloat(row[feeAmountIdx].replace(/[^0-9.-]+/g, "")) || 0;
    } else {
      const rowPaymentType = paymentTypeIdx !== -1 ? row[paymentTypeIdx].trim().toLowerCase() : "";
      if (fallbackConfig && (fallbackConfig as any)[rowPaymentType]) {
        const { percentage, flat } = (fallbackConfig as any)[rowPaymentType];
        feeAmount = (grossAmount * (percentage || 0)) + (flat || 0);
      } else {
        isDisputed = true;
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

    const orderData = await OrderRepository.getInstance().getOrderById(orderId);
    let recordStatus = "SUCCESS";
    
    if (!orderData) {
      isDisputed = true;
      recordStatus = "ORDER_NOT_FOUND";
    } else {
      const orderPaymentStatus = (orderData?.paymentStatus || "").toLowerCase();
      if (orderPaymentStatus !== "paid" && orderPaymentStatus !== "success") {
        isDisputed = true;
        recordStatus = "PAYMENT_STATUS_MISMATCH";
      }

      const { data: refunds } = await supabaseAdmin!
        .from("refunds")
        .select("amount")
        .eq("order_id", orderId)
        .eq("status", "SUCCEEDED");
      
      let fsRefundTotal = 0;
      refunds?.forEach(r => { fsRefundTotal += r.amount || 0; });

      if (fsRefundTotal !== refundAmount) {
        isDisputed = true;
        recordStatus = "REFUND_MISMATCH";
      }

      const recordRefId = `sett_rec_${orderId}`;
      const { data: existingRecord } = await supabaseAdmin!
        .from("settlement_records")
        .select("id")
        .eq("id", recordRefId)
        .maybeSingle();
      
      if (existingRecord) {
        isDisputed = true;
        recordStatus = "ALREADY_SETTLED";
      }
    }

    const sourceRowHash = crypto.createHash("md5").update(row.join(",")).digest("hex");
    recordsToInsert.push({
      id: `sett_rec_${orderId}`,
      batch_id: batchId,
      order_id: orderId,
      gross_amount: grossAmount,
      mdr_fee_amount: feeAmount,
      refund_amount: refundAmount,
      adjustment_amount: 0,
      net_amount: netAmount,
      payment_type: paymentType,
      gateway_transaction_status: recordStatus,
      gateway_settled_at: gatewaySettledAt,
      source_row_hash: sourceRowHash,
      created_at: new Date().toISOString()
    });

    totalGross += grossAmount;
    totalMdr += feeAmount;
    totalRefund += refundAmount;
    totalNet += netAmount;
  }

  if (recordsToInsert.length === 0) {
    return { success: false, code: "EMPTY_RECORDS", message: "No valid rows found to be imported." };
  }

  const batchRow = {
    id: batchId,
    period_date: dateStr,
    period_start: dateStr,
    period_end: dateStr,
    source_type: "MIDTRANS_MAP_CSV",
    source_file_name: fileName,
    source_file_hash: fileHash,
    gross_amount: totalGross,
    mdr_fee_amount: totalMdr,
    refund_amount: totalRefund,
    adjustment_amount: totalAdjustment,
    net_settled_amount: totalNet,
    order_count: recordsToInsert.length,
    status: isDisputed ? "DISPUTED" : "CALCULATED",
    idempotency_key: `sett_batch_key_${fileHash}`,
    processed_by: processedByUserId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    await supabaseAdmin!.from("settlement_batches").insert(batchRow);
    
    // Chunked insert for records
    const chunkSize = 100;
    for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
      const chunk = recordsToInsert.slice(i, i + chunkSize);
      await supabaseAdmin!.from("settlement_records").insert(chunk);
    }

    await logAudit(processedByUserId, "SETTLEMENT_BATCH_CREATED", "settlementBatches", batchId, {
      recordCount: recordsToInsert.length,
      isDisputed,
      gross: totalGross,
      net: totalNet
    }, ipAddress);

    return {
      success: true,
      batch: {
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
        createdAt: batchRow.created_at,
        updatedAt: batchRow.updated_at
      },
      recordsCount: recordsToInsert.length,
      message: isDisputed
        ? "Batch settlement berhasil ditambahkan sebagai DISPUTED karena terdeteksi ketidakcocokan data."
        : "Batch settlement berhasil diimpor dan divalidasi secara sempurna."
    };
  } catch (err: any) {
    console.error("Settlement Insert Fail:", err);
    return { success: false, code: "INSERT_FAIL", message: `Database insert failed: ${err.message}` };
  }
}
