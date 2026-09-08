export enum LedgerAccount {
  GATEWAY_RECEIVABLE = "1000_GATEWAY_RECEIVABLE",
  BANK_CLEARING = "1100_BANK_CLEARING",
  BANK_PRIMARY = "1200_BANK_PRIMARY",
  CUSTOMER_UNEARNED_REVENUE = "2000_CUSTOMER_UNEARNED_REVENUE",
  COMMISSION_PAYABLE = "2100_COMMISSION_PAYABLE",
  SALES_REVENUE = "4000_SALES_REVENUE",
  SALES_REFUND_CONTRA = "4100_SALES_REFUND_CONTRA",
  GATEWAY_MDR_FEE = "5000_GATEWAY_MDR_FEE",
  SETTLEMENT_ADJUSTMENT = "5100_SETTLEMENT_ADJUSTMENT",
  COMMISSION_EXPENSE = "5200_COMMISSION_EXPENSE"
}

export const LEDGER_ACCOUNT_NAMES: Record<LedgerAccount, string> = {
  [LedgerAccount.GATEWAY_RECEIVABLE]: "Payment Gateway Receivable",
  [LedgerAccount.BANK_CLEARING]: "Bank Clearing Account",
  [LedgerAccount.BANK_PRIMARY]: "Corporate Bank Account",
  [LedgerAccount.CUSTOMER_UNEARNED_REVENUE]: "Unearned Revenue / Customer Liability",
  [LedgerAccount.COMMISSION_PAYABLE]: "Affiliate Commission Payable",
  [LedgerAccount.SALES_REVENUE]: "Gross Sales Revenue",
  [LedgerAccount.SALES_REFUND_CONTRA]: "Sales Refund Contra",
  [LedgerAccount.GATEWAY_MDR_FEE]: "Gateway Processing Fee",
  [LedgerAccount.SETTLEMENT_ADJUSTMENT]: "Settlement Adjustment",
  [LedgerAccount.COMMISSION_EXPENSE]: "Commission Expense"
};

export type LedgerEventType = 
  | 'PAYMENT_RECEIVED'
  | 'FULFILLMENT_SUCCESS'
  | 'REFUND_EXECUTED'
  | 'SETTLEMENT_CLOSED'
  | 'SETTLEMENT_ADJUSTMENT'
  | 'MANUAL_REVERSAL'
  | 'COMMISSION_ACCRUAL'
  | 'COMMISSION_ACCRUAL_REVERSAL'
  | 'COMMISSION_PAYOUT';

export interface LedgerLineItem {
  accountId: LedgerAccount | string;
  accountName: string;
  debit: number;  // Non-negative integer IDR
  credit: number; // Non-negative integer IDR
}

export interface LedgerJournalEntry {
  id: string; // Document ID: `ledger_${idempotencyKey}`
  idempotencyKey: string;
  eventType: LedgerEventType;
  source: {
    collection: string;
    documentId: string;
    eventId?: string;
  };
  lineItems: LedgerLineItem[];
  totalAmount: number; // Sum of debits (which equals sum of credits)
  currency: 'IDR';
  reversalOf?: string | null;
  createdBy: string;
  createdAt: string;
  metadata?: Record<string, any>;
}
