export type ReferralRelationshipStatus = 'PENDING' | 'CONVERTED' | 'EXPIRED';

export type ReferralRewardStatus = 'PENDING' | 'GRANTED' | 'CANCELLED' | 'REVERSED';

export type ReferralRewardType = 'POINTS' | 'COMMISSION' | 'BOTH' | 'NONE';

export interface ReferralRelationship {
  id: string; // Deterministic: REF_${referrerUid}_${referredUid}
  referrerUid: string;
  referredUid: string;
  status: ReferralRelationshipStatus;
  referralCode: string; // The code used by the referred customer
  source: 'URL' | 'MANUAL_INPUT' | 'API';
  qualifiedOrderId?: string | null;
  rewardStatus: ReferralRewardStatus;
  rewardType: ReferralRewardType;
  createdAt: string;
  updatedAt: string;
  convertedAt?: string | null;
  metadata?: Record<string, any>;
}

export interface ReferralConfig {
  enabled: boolean;
  
  // Referrer Reward
  referrerRewardType: ReferralRewardType;
  referrerRewardPoints: number;
  referrerRewardCommissionId?: string | null; // ID of a CommissionRule if using Commission Engine
  
  // Referred Customer Reward (Welcome Bonus)
  referredRewardType: ReferralRewardType;
  referredRewardPoints: number;
  
  // Qualification
  minQualifyingOrderAmount: number;
  maxRewardsPerReferrer?: number | null;
  
  // Constraints
  allowSelfReferral: boolean; // Default false
  requireOrderSuccess: boolean; // Default true (SUCCESS state)
  
  updatedAt: string;
  updatedBy: string;
}

export interface ReferralStats {
  totalReferrals: number;
  convertedReferrals: number;
  pointsEarned: number;
  commissionEarned: number;
}
