export type RecipientType = 'AFFILIATE' | 'RESELLER' | 'AGENT' | 'PARTNER';

export type RecipientStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export type CommissionCalculationMethod = 
  | 'PERCENTAGE_OF_SELLING_PRICE'
  | 'FIXED_AMOUNT'
  | 'PERCENTAGE_OF_MARGIN';

export type CommissionRuleStatus = 'ACTIVE' | 'INACTIVE';

export type CommissionRecordStatus = 'PAYABLE' | 'CANCELLED';

export type CommissionCancelReason = 
  | 'CANCELLED_BY_REFUND'
  | 'CANCELLED_BY_FRAUD'
  | 'CANCELLED_BY_ADMIN'
  | string;

export interface CommissionReversalSnapshot {
  refundKey: string;
  refundAmount: number;
  deltaReversedCommission: number;
  cumulativeReversedCommission: number;
  remainingPayableCommission: number;
  ledgerJournalId: string | null;
  reversedAt: string;
}

export interface PayoutAccount {
  bankName: string;
  accountNumberMasked: string;
  accountHolderName: string;
  accountNumber?: string; // Optional: only used when submitting a new account number in form payloads
}

export interface FirestorePayoutAccount {
  bankName: string;
  encryptedAccountNumber: string; // Encrypted-at-rest with AES-256
  accountNumberMasked: string; // Masked for safe display (e.g. ••••1234 or 88******81)
  accountHolderName: string;
}

export interface CommissionRecord {
  id: string; // Document ID / commissionId: comm_order_{orderId}_{recipientId}
  orderId: string;
  recipientId: string;
  recipientCode: string;
  recipientName: string;
  recipientType: 'AFFILIATE';
  ruleId: string;
  ruleName: string;
  calculationMethod: CommissionCalculationMethod;
  sellingPriceSnapshot: number;
  baseCostSnapshot: number | null;
  commissionRateSnapshot: number; // percentage (e.g. 5 for 5%) or 0 if fixed
  fixedAmountSnapshot: number; // fixed amount in IDR or 0 if percentage
  commissionAmount: number; // final rounded integer in IDR
  currency: 'IDR';
  status: CommissionRecordStatus;
  createdAt: string;
  updatedAt: string;
  earnedAt: string;
  reversedAt: string | null;
  cancelReason?: CommissionCancelReason | null;
  cumulativeReversedAmount?: number; // Total cumulative reversed commission in IDR
  remainingPayableAmount?: number;   // Sisa komisi yang masih valid (commissionAmount - cumulativeReversedAmount)
  reversalSnapshots?: CommissionReversalSnapshot[];
  payoutStatus?: 'UNPAID' | 'ALLOCATED' | 'PAID';
  payoutBatchId?: string | null;
  paidAt?: string | null;
  ledgerStatus?: 'POSTED' | 'FAILED' | 'PENDING' | null;
  ledgerJournalId?: string | null;
  ledgerPostedAt?: string | null;
  metadata?: Record<string, any>;
}

export type PayoutBatchStatus = 
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export interface PayoutAllocationItem {
  commissionId: string;
  orderId: string;
  allocatedAmount: number; // Snapshot nominal saat allocation dibuat (Integer IDR)
}

export interface PayoutRecipientSnapshot {
  recipientId: string;
  name: string;
  email?: string;
  bankName: string;
  accountHolderName: string;
  accountNumberMasked: string;
}

export interface PayoutBatch {
  id: string; // `payout_batch_${recipientId}_${Date.now()}`
  batchNumber: string; // "PO-YYYYMMDD-XXXX"
  recipientId: string;
  recipientSnapshot: PayoutRecipientSnapshot;
  allocations: PayoutAllocationItem[];
  commissionRecordIds: string[];
  totalCommissionAmount: number;
  payoutFee: number; // 0 for MVP
  netPayoutAmount: number; // totalCommissionAmount - payoutFee
  status: PayoutBatchStatus;
  payoutMethod: 'MANUAL_BANK_TRANSFER';
  transferReference?: string | null;
  proofReference?: string | null;
  ledgerJournalId?: string | null;
  createdBy: string;
  createdAt: string;
  submittedBy?: string | null;
  submittedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  paidBy?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  reviewReason?: string | null;
}

export interface CommissionConfig {
  enabled: boolean;
  defaultCalculationMethod: CommissionCalculationMethod;
  defaultCurrency: 'IDR';
  minimumPayoutThreshold: number;
  supportedRecipientTypes: RecipientType[];
  updatedAt: string;
  updatedBy: string;
}

export interface CommissionRecipient {
  id: string; // Document ID / recipientId (e.g. rec_aff_xyz)
  userId?: string | null;
  code: string; // Unique, uppercase normalized code
  name: string;
  type: RecipientType;
  status: RecipientStatus;
  notes?: string;
  payoutAccount?: PayoutAccount | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CommissionRule {
  id: string; // Document ID / ruleId
  name: string;
  recipientType: RecipientType;
  recipientId?: string | null; // Specific affiliate recipient ID or null for all
  gameId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  calculationMethod: CommissionCalculationMethod;
  rate: number; // percentage (0-100) or fixed amount in IDR
  minOrderAmount: number; // minimum order gross amount for rule to apply
  maxCommissionAmount?: number | null; // optional cap
  priority: number; // 1 = highest priority
  effectiveFrom: string; // ISO Date / YYYY-MM-DD
  effectiveUntil?: string | null; // ISO Date / YYYY-MM-DD
  status: CommissionRuleStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
