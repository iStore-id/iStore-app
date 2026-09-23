import { Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { LedgerJournalEntry } from "../types/ledger.js";
import { logLedgerAudit } from "./ledger-service.js";
import { DualLedgerRepository } from "./ledger-dual-repository";

const ledgerRepo = DualLedgerRepository.getInstance();

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

    const { entries, total } = await ledgerRepo.listJournalEntries({
      page: pageNum,
      limit: limitNum,
      eventType: eventType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      accountId: account as string,
      search: search as string
    });

    return res.status(200).json({
      success: true,
      data: {
        entries,
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
    const data = await ledgerRepo.getLedgerOverview();

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error("[Ledger API Error] getLedgerOverviewApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch ledger overview" });
  }
}

export async function getLedgerEntryDetailApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const entry = await ledgerRepo.getJournalEntryById(id);

    if (!entry) {
      return res.status(404).json({ success: false, message: "Ledger entry not found" });
    }

    return res.status(200).json({
      success: true,
      data: entry
    });
  } catch (error: any) {
    console.error("[Ledger API Error] getLedgerEntryDetailApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch ledger entry detail" });
  }
}

export async function exportLedgerCsvApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { entries } = await ledgerRepo.listJournalEntries({ limit: 1000 });

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
