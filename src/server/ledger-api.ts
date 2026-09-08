import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { adminDb } from "./firebase-admin";
import { LedgerJournalEntry } from "../types/ledger";
import { logLedgerAudit } from "./ledger-service";

export async function getLedgerEntriesApi(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      page = "1",
      limit = "25",
      eventType,
      startDate,
      endDate,
      account,
      search
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 25, 100);

    let query: FirebaseFirestore.Query = adminDb.collection("ledgerJournalEntries");

    if (eventType && eventType !== "ALL") {
      query = query.where("eventType", "==", eventType);
    }

    // Order by createdAt desc for pagination
    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();
    let docs = snapshot.docs.map(doc => doc.data() as LedgerJournalEntry);

    // Server-side filtering for date range, account, search
    if (startDate) {
      const start = new Date(startDate as string).getTime();
      docs = docs.filter(d => new Date(d.createdAt).getTime() >= start);
    }

    if (endDate) {
      const end = new Date(endDate as string).setHours(23, 59, 59, 999);
      docs = docs.filter(d => new Date(d.createdAt).getTime() <= end);
    }

    if (account && account !== "ALL") {
      docs = docs.filter(d => d.lineItems.some(item => item.accountId === account));
    }

    if (search && typeof search === "string" && search.trim() !== "") {
      const term = search.toLowerCase();
      docs = docs.filter(d => 
        d.id.toLowerCase().includes(term) ||
        d.idempotencyKey.toLowerCase().includes(term) ||
        d.source?.documentId?.toLowerCase().includes(term) ||
        JSON.stringify(d.metadata || {}).toLowerCase().includes(term)
      );
    }

    const total = docs.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedDocs = docs.slice(startIndex, startIndex + limitNum);

    return res.status(200).json({
      success: true,
      data: {
        entries: paginatedDocs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error: any) {
    console.error("[Ledger API Error] getLedgerEntriesApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch ledger entries" });
  }
}

export async function getLedgerOverviewApi(req: AuthenticatedRequest, res: Response) {
  try {
    const snapshot = await adminDb.collection("ledgerJournalEntries").get();
    const entries = snapshot.docs.map(doc => doc.data() as LedgerJournalEntry);

    let totalDebitSum = 0;
    let totalCreditSum = 0;
    const accountSummary: Record<string, { debit: number; credit: number; net: number; name: string }> = {};

    for (const entry of entries) {
      for (const item of entry.lineItems) {
        if (!accountSummary[item.accountId]) {
          accountSummary[item.accountId] = { debit: 0, credit: 0, net: 0, name: item.accountName };
        }
        accountSummary[item.accountId].debit += item.debit;
        accountSummary[item.accountId].credit += item.credit;
        totalDebitSum += item.debit;
        totalCreditSum += item.credit;
      }
    }

    for (const accId of Object.keys(accountSummary)) {
      const acc = accountSummary[accId];
      acc.net = acc.debit - acc.credit;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalEntries: entries.length,
        totalDebit: totalDebitSum,
        totalCredit: totalCreditSum,
        accountSummary
      }
    });
  } catch (error: any) {
    console.error("[Ledger API Error] getLedgerOverviewApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch ledger overview" });
  }
}

export async function getLedgerEntryDetailApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const docRef = adminDb.collection("ledgerJournalEntries").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "Ledger entry not found" });
    }

    return res.status(200).json({
      success: true,
      data: doc.data() as LedgerJournalEntry
    });
  } catch (error: any) {
    console.error("[Ledger API Error] getLedgerEntryDetailApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch ledger entry detail" });
  }
}

export async function exportLedgerCsvApi(req: AuthenticatedRequest, res: Response) {
  try {
    const snapshot = await adminDb.collection("ledgerJournalEntries").orderBy("createdAt", "desc").limit(1000).get();
    const entries = snapshot.docs.map(doc => doc.data() as LedgerJournalEntry);

    // Audit the export action
    await logLedgerAudit(req.user?.uid || "ADMIN", "EXPORT_LEDGER_CSV", "ALL", { count: entries.length });

    let csv = "ID,CreatedAt,EventType,SourceCollection,SourceDocumentId,TotalAmount,Currency,CreatedBy\n";
    for (const e of entries) {
      csv += `"${e.id}","${e.createdAt}","${e.eventType}","${e.source?.collection || ''}","${e.source?.documentId || ''}",${e.totalAmount},"${e.currency}","${e.createdBy}"\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=ledger_export.csv");
    return res.status(200).send(csv);
  } catch (error: any) {
    console.error("[Ledger API Error] exportLedgerCsvApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to export ledger CSV" });
  }
}
