export type CustomerStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface CustomerNote {
  id: string;
  note: string;
  authorUid: string;
  authorEmail: string;
  createdAt: string;
}

export interface CustomerUser {
  uid: string;
  email: string;
  name?: string;
  displayName?: string;
  phone?: string;
  role: 'customer' | 'admin' | 'pemilik' | string;
  status: CustomerStatus;
  suspendReason?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  tags?: string[];
  notes?: CustomerNote[];
  referralCode?: string; // Unique referral code for this user
  referredBy?: string; // UID of the referrer
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
  metadata?: Record<string, any>;
}

export interface CustomerCommerceSummary {
  totalOrders: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  failedOrdersCount: number;
  totalSpentIdr: number;
  totalRefundedIdr: number;
  averageOrderValueIdr: number;
  firstOrderDate?: string | null;
  lastOrderDate?: string | null;
  recentOrders: {
    id: string;
    invoice: string;
    productName: string;
    variantName?: string;
    totalAmount: number;
    paymentStatus: string;
    transactionStatus: string;
    createdAt: string;
  }[];
}

export interface CustomerLoyaltySummary {
  pointsBalance: number;
  totalEarnedPoints: number;
  totalRedeemedPoints: number;
  recentTransactions: {
    id: string;
    type: 'EARN' | 'REDEEM' | 'REFUND_REVERSAL' | 'ADMIN_ADJUSTMENT';
    points: number;
    reference: string;
    createdAt: string;
    reason?: string;
  }[];
}

export interface Customer360Profile {
  customer: CustomerUser;
  commerce: CustomerCommerceSummary;
  loyalty: CustomerLoyaltySummary;
  auditTrail: {
    id: string;
    action: string;
    role: string;
    actorEmail: string;
    timestamp: string;
    reason?: string;
    before?: any;
    after?: any;
  }[];
}

export interface CustomerDirectoryQuery {
  search?: string;
  status?: string;
  role?: string;
  tag?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name' | 'lastLogin' | 'totalSpent';
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
}

export interface CustomerDirectoryResponse {
  items: (CustomerUser & {
    orderCount?: number;
    totalSpentIdr?: number;
    pointsBalance?: number;
  })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metrics: {
    totalCustomers: number;
    activeCount: number;
    suspendedCount: number;
    disabledCount: number;
    totalCustomerLtvIdr: number;
  };
  nextCursor?: string;
}

export interface PointTransaction {
  id: string;
  user_id: string;
  type: 'EARN' | 'REDEEM' | 'REFUND_REVERSAL' | 'ADMIN_ADJUSTMENT';
  points: number;
  reference: string;
  created_at: string;
  reason?: string;
}

export type SegmentOperator = 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS';

export interface SegmentRule {
  field: string;
  operator: SegmentOperator;
  value: any;
}

export interface SegmentRuleGroup {
  conjunction: 'AND' | 'OR';
  rules: SegmentRule[];
}

export interface CustomerSegment {
  id: string;
  name: string;
  description?: string;
  type: 'STATIC' | 'DYNAMIC';
  status: 'ACTIVE' | 'INACTIVE';
  ruleGroup?: SegmentRuleGroup;
  memberCount: number;
  evaluationStatus: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  evaluationError?: string | null;
  lastEvaluatedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface CustomerSegmentMembership {
  id: string;
  segmentId: string;
  customerUid: string;
  source: 'STATIC' | 'DYNAMIC';
  status: 'ACTIVE' | 'INACTIVE';
  evaluatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSegmentView {
  membership: CustomerSegmentMembership;
  customer: {
    uid: string;
    name?: string;
    email: string;
    phone?: string;
    status: string;
    role: string;
    tags: string[];
    totalSpentIdr: number;
    orderCount: number;
  };
}

export interface CustomerEvaluationContext {
  uid: string;
  email: string;
  name?: string;
  totalSpentIdr: number;
  orderCount: number;
  tags: string[];
  registrationDate?: string;
  lastLoginAt?: string;
}
