
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  tierLevel: number;
  status: 'ACTIVE' | 'INACTIVE';
  price: number;
  durationDays: number;
  pointMultiplier: number;
  discountRate: number; // 0-100 percentage
  accessTags: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CustomerMembership {
  id: string; // Typically same as userId for canonical active membership
  userId: string;
  planId: string;
  status: MembershipStatus;
  startDate?: string;
  expiryDate?: string;
  assignedAt: string;
  updatedAt: string;
  source: 'PURCHASE' | 'MANUAL';
  orderId?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface MembershipStats {
  totalActive: number;
  totalExpired: number;
  totalSuspended: number;
  distribution: Record<string, number>;
  expiringSoon: number;
}
