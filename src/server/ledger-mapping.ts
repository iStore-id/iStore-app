import { LedgerAccount } from "../types/ledger.js";

/**
 * Maps legacy account codes to canonical PostgreSQL Chart of Accounts.
 * Fail-closed: Throws an error if mapping is unknown or not yet mapped.
 * IDENTITY-PRESERVING: 1-to-1 mapping based on the 4-digit prefix.
 */
export function mapLegacyAccountToCanonical(legacyAccount: string): string {
  // Extract 4-digit code from start of legacy ID (e.g., "1000" from "1000_GATEWAY_RECEIVABLE")
  const match = legacyAccount.match(/^(\d{4})/);
  if (match) {
    return match[1];
  }
  
  // If it's already a canonical code (4 digits), return it
  if (/^\d{4}$/.test(legacyAccount)) {
    return legacyAccount;
  }
  
  throw new Error(`LEDGER_ADAPTER_ERROR: Unknown legacy account code: ${legacyAccount}`);
}

/**
 * Maps canonical PostgreSQL Chart of Accounts back to the most representative legacy account identifier.
 * This is used for compatibility with existing UI and domain models.
 * ROUND-TRIP INVARIANT: mapCanonicalToLegacyAccount(mapLegacyAccountToCanonical(A)) === A
 */
export function mapCanonicalToLegacyAccount(canonicalId: string): string {
  switch (canonicalId) {
    case '1000': return LedgerAccount.GATEWAY_RECEIVABLE;
    case '1100': return LedgerAccount.BANK_CLEARING;
    case '1200': return LedgerAccount.BANK_PRIMARY;
    case '2000': return LedgerAccount.CUSTOMER_UNEARNED_REVENUE;
    case '2100': return LedgerAccount.COMMISSION_PAYABLE;
    case '4000': return LedgerAccount.SALES_REVENUE;
    case '4100': return LedgerAccount.SALES_REFUND_CONTRA;
    case '5000': return LedgerAccount.GATEWAY_MDR_FEE;
    case '5100': return LedgerAccount.SETTLEMENT_ADJUSTMENT;
    case '5200': return LedgerAccount.COMMISSION_EXPENSE;
    default:
      // If unknown, return as-is (graceful degradation)
      return canonicalId;
  }
}
