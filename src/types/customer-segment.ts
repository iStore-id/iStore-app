/**
 * CUSTOMER SEGMENTATION ENGINE TYPES (Phase C2)
 */

export type SegmentType = 'STATIC' | 'DYNAMIC';
export type SegmentStatus = 'ACTIVE' | 'INACTIVE';
export type EvaluationStatus = 'IDLE' | 'RUNNING' | 'FAILED' | 'COMPLETED';

export type RuleCategory = 'CUSTOMER' | 'COMMERCE' | 'LOYALTY' | 'TAGGING';

export type RuleOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'greater_than' 
  | 'greater_than_or_equal' 
  | 'less_than' 
  | 'less_than_or_equal' 
  | 'contains' 
  | 'not_contains'
  | 'in' 
  | 'not_in'
  | 'between' 
  | 'within_days';

export interface FieldDefinition {
  field: string;
  label: string;
  category: RuleCategory;
  valueType: 'string' | 'number' | 'boolean' | 'enum' | 'date' | 'array_string' | 'number_range';
  allowedOperators: RuleOperator[];
  enumValues?: { label: string; value: string }[];
  description?: string;
}

export const SEGMENT_FIELD_CATALOG: Record<string, FieldDefinition> = {
  // CUSTOMER PROFILE FIELDS
  'customer.status': {
    field: 'customer.status',
    label: 'Status Akun',
    category: 'CUSTOMER',
    valueType: 'enum',
    allowedOperators: ['equals', 'not_equals', 'in', 'not_in'],
    enumValues: [
      { label: 'Aktif (ACTIVE)', value: 'ACTIVE' },
      { label: 'Ditangguhkan (SUSPENDED)', value: 'SUSPENDED' },
      { label: 'Dinonaktifkan (DISABLED)', value: 'DISABLED' }
    ],
    description: 'Status akun pelanggan di iStore'
  },
  'customer.role': {
    field: 'customer.role',
    label: 'Peran Akun (Role)',
    category: 'CUSTOMER',
    valueType: 'enum',
    allowedOperators: ['equals', 'not_equals', 'in'],
    enumValues: [
      { label: 'Customer', value: 'customer' },
      { label: 'Admin', value: 'admin' },
      { label: 'Pemilik', value: 'pemilik' }
    ]
  },
  'customer.createdAt': {
    field: 'customer.createdAt',
    label: 'Tanggal Pendaftaran',
    category: 'CUSTOMER',
    valueType: 'date',
    allowedOperators: ['greater_than_or_equal', 'less_than_or_equal', 'within_days', 'between'],
    description: 'Waktu pelanggan pertama kali mendaftar'
  },
  'customer.email': {
    field: 'customer.email',
    label: 'Email Terdaftar',
    category: 'CUSTOMER',
    valueType: 'string',
    allowedOperators: ['equals', 'not_equals', 'contains', 'not_contains']
  },
  'customer.phone': {
    field: 'customer.phone',
    label: 'Nomor Telepon / WhatsApp',
    category: 'CUSTOMER',
    valueType: 'string',
    allowedOperators: ['equals', 'not_equals', 'contains', 'not_contains']
  },

  // TAGGING METADATA
  'tagging.tags': {
    field: 'tagging.tags',
    label: 'Customer Tags (Label)',
    category: 'TAGGING',
    valueType: 'array_string',
    allowedOperators: ['contains', 'not_contains', 'in'],
    description: 'Tag manual yang disematkan pada profil pelanggan (e.g. VIP, RESELLER)'
  },

  // COMMERCE METRICS
  'commerce.totalSpentIdr': {
    field: 'commerce.totalSpentIdr',
    label: 'Total Belanja (LTV - IDR)',
    category: 'COMMERCE',
    valueType: 'number',
    allowedOperators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    description: 'Total akumulasi pembayaran pesanan sukses'
  },
  'commerce.orderCount': {
    field: 'commerce.orderCount',
    label: 'Total Semua Pesanan',
    category: 'COMMERCE',
    valueType: 'number',
    allowedOperators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    description: 'Jumlah total seluruh invoice yang dibuat'
  },
  'commerce.successfulOrdersCount': {
    field: 'commerce.successfulOrdersCount',
    label: 'Pesanan Sukses / Lunas',
    category: 'COMMERCE',
    valueType: 'number',
    allowedOperators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    description: 'Jumlah transaksi yang berhasil diselesaikan'
  },
  'commerce.lastOrderAt': {
    field: 'commerce.lastOrderAt',
    label: 'Waktu Pesanan Terakhir',
    category: 'COMMERCE',
    valueType: 'date',
    allowedOperators: ['greater_than_or_equal', 'less_than_or_equal', 'within_days', 'between'],
    description: 'Waktu transaksi terakhir pelanggan'
  },
  'commerce.purchasedGameIds': {
    field: 'commerce.purchasedGameIds',
    label: 'Game / Kategori yang Pernah Dibeli',
    category: 'COMMERCE',
    valueType: 'array_string',
    allowedOperators: ['contains', 'not_contains', 'in'],
    description: 'ID Game atau Nama Game yang pernah ditransaksikan'
  },

  // LOYALTY METRICS
  'loyalty.pointsBalance': {
    field: 'loyalty.pointsBalance',
    label: 'Saldo Poin Reward',
    category: 'LOYALTY',
    valueType: 'number',
    allowedOperators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    description: 'Jumlah poin reward aktif saat ini'
  },
  'loyalty.lifetimePointsEarned': {
    field: 'loyalty.lifetimePointsEarned',
    label: 'Total Akumulasi Poin Didapat',
    category: 'LOYALTY',
    valueType: 'number',
    allowedOperators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    description: 'Total akumulasi poin reward sepanjang masa'
  },
  'referral.referralCount': {
    field: 'referral.referralCount',
    label: 'Jumlah Referral (Total)',
    category: 'CUSTOMER',
    valueType: 'number',
    allowedOperators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    description: 'Jumlah total pelanggan yang pernah diajak menggunakan kode referral'
  },
  'referral.successfulReferralCount': {
    field: 'referral.successfulReferralCount',
    label: 'Jumlah Referral Sukses (Order)',
    category: 'CUSTOMER',
    valueType: 'number',
    allowedOperators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    description: 'Jumlah pelanggan diajak yang sudah melakukan transaksi sukses'
  },
  'referral.isReferrer': {
    field: 'referral.isReferrer',
    label: 'Adalah Referrer',
    category: 'CUSTOMER',
    valueType: 'enum',
    allowedOperators: ['equals'],
    enumValues: [
      { label: 'Ya', value: 'true' },
      { label: 'Tidak', value: 'false' }
    ]
  },
  'referral.referredBy': {
    field: 'referral.referredBy',
    label: 'Direferensikan Oleh (UID)',
    category: 'CUSTOMER',
    valueType: 'string',
    allowedOperators: ['equals', 'not_equals']
  },
  // MEMBERSHIP FIELDS (Phase C4)
  'membership.planId': {
    field: 'membership.planId',
    label: 'ID Membership Plan',
    category: 'CUSTOMER',
    valueType: 'string',
    allowedOperators: ['equals', 'not_equals', 'in', 'not_in'],
    description: 'ID paket membership yang aktif saat ini'
  },
  'membership.tierLevel': {
    field: 'membership.tierLevel',
    label: 'Tier Level Membership',
    category: 'CUSTOMER',
    valueType: 'number',
    allowedOperators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    description: 'Level tier membership aktif (0 jika tidak ada)'
  },
  'membership.status': {
    field: 'membership.status',
    label: 'Status Membership',
    category: 'CUSTOMER',
    valueType: 'enum',
    allowedOperators: ['equals', 'not_equals', 'in'],
    enumValues: [
      { label: 'Aktif (ACTIVE)', value: 'ACTIVE' },
      { label: 'Ditangguhkan (SUSPENDED)', value: 'SUSPENDED' },
      { label: 'Kadaluwarsa (EXPIRED)', value: 'EXPIRED' },
      { label: 'Dibatalkan (CANCELLED)', value: 'CANCELLED' },
      { label: 'Tidak Ada (NONE)', value: 'NONE' }
    ]
  },
  'membership.expiryDate': {
    field: 'membership.expiryDate',
    label: 'Tanggal Kadaluwarsa Membership',
    category: 'CUSTOMER',
    valueType: 'date',
    allowedOperators: ['greater_than_or_equal', 'less_than_or_equal', 'within_days', 'between'],
    description: 'Waktu berakhirnya masa aktif membership'
  }
};

export interface SegmentRule {
  id: string;
  category: RuleCategory;
  field: string;
  operator: RuleOperator;
  value: string | number | boolean | string[] | [number, number];
}

export interface SegmentRuleGroup {
  combinator: 'AND' | 'OR';
  rules: (SegmentRule | SegmentRuleGroup)[];
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  type: SegmentType;
  status: SegmentStatus;
  ruleGroup?: SegmentRuleGroup;
  memberCount: number;
  lastEvaluatedAt?: string | null;
  evaluationStatus: EvaluationStatus;
  evaluationError?: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSegmentMembership {
  id: string; // Deterministic: `${segmentId}_${customerUid}`
  segmentId: string;
  customerUid: string;
  source: 'MANUAL' | 'DYNAMIC';
  status: 'ACTIVE' | 'INACTIVE';
  evaluatedAt: string;
  createdAt: string;
  updatedAt: string;
  addedBy?: string;
}

export interface SegmentMemberView {
  membership: CustomerSegmentMembership;
  customer: {
    uid: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    role: string;
    tags: string[];
    totalSpentIdr: number;
    orderCount: number;
  };
}

export interface CustomerSegmentsQuery {
  search?: string;
  type?: SegmentType | 'ALL';
  status?: SegmentStatus | 'ALL';
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'memberCount' | 'lastEvaluatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CustomerSegmentsResponse {
  items: CustomerSegment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  metrics: {
    totalSegments: number;
    activeCount: number;
    inactiveCount: number;
    staticCount: number;
    dynamicCount: number;
    totalActiveMemberships: number;
  };
}

export interface EvaluatedCustomerContext {
  uid: string;
  email: string;
  name: string;
  phone: string;
  status: string;
  role: string;
  tags: string[];
  createdAt: string;
  totalSpentIdr: number;
  orderCount: number;
  successfulOrdersCount: number;
  lastOrderAt: string | null;
  purchasedGameIds: string[];
  pointsBalance: number;
  lifetimePointsEarned: number;
  referralCount: number;
  successfulReferralCount: number;
  isReferrer: boolean;
  referredBy?: string | null;
  membershipPlanId?: string | null;
  membershipTierLevel: number;
  membershipStatus: string;
  membershipExpiryDate?: string | null;
}
