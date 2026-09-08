export type SupportStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CLOSED';
export type SupportPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type SupportCategory = 'ORDER' | 'PAYMENT' | 'MEMBERSHIP' | 'LOYALTY' | 'TECHNICAL' | 'ACCOUNT' | 'REFUND' | 'OTHER';
export type SenderType = 'USER' | 'AGENT' | 'SYSTEM';

export interface SupportCase {
  id: string;
  customerUid: string;
  customerEmail: string;
  customerName: string;
  orderId?: string;
  subject: string;
  description: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  channel: 'IN_APP' | 'EMAIL' | 'WHATSAPP';
  assignedTo?: string; // agent UID
  assignedAt?: string;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface SupportMessage {
  id: string;
  caseId: string;
  senderId: string;
  senderType: SenderType;
  senderName: string;
  text: string;
  attachments?: {
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  isInternal: boolean;
  createdAt: string;
  idempotencyKey?: string;
}

export interface Support360 {
  case: SupportCase;
  messages: SupportMessage[];
  customer: any;
  order?: any;
  membership?: any;
  loyalty?: any;
  referral?: any;
  previousCases?: SupportCase[];
  sla?: any;
}
