export type NotificationRecipientType = 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED';
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'PUSH';

export type NotificationType = 
  | 'ORDER_CREATED' 
  | 'PAYMENT_CONFIRMED' 
  | 'PAYMENT_FAILED' 
  | 'ORDER_PROCESSING' 
  | 'ORDER_SUCCESS' 
  | 'ORDER_FAILED' 
  | 'ORDER_EXPIRED'
  | 'REFUND_PROCESSING'
  | 'REFUND_SUCCESS'
  | 'REFUND_FAILED'
  | 'REFUND_EXCEPTION'
  | 'FAILED_ORDER_ALERT'
  | 'PAYMENT_EXCEPTION'
  | 'FULFILLMENT_EXCEPTION'
  | 'QUEUE_DEAD_LETTER'
  | 'SLA_BREACH'
  | 'INCIDENT_OPENED'
  | 'INCIDENT_ACKNOWLEDGED'
  | 'INCIDENT_RESOLVED'
  | 'STOCK_ALERT'
  | 'SYSTEM_ALERT';

export interface Notification {
  id?: string;
  recipientId: string; // User UID or 'ADMIN_ALL'
  recipientType: NotificationRecipientType;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  channels: NotificationChannel[];
  relatedEntityType?: 'ORDER' | 'REFUND' | 'JOB' | 'INCIDENT' | 'PRODUCT';
  relatedEntityId?: string;
  actionUrl?: string;
  status: NotificationStatus;
  metadata?: Record<string, any>;
  readAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationPreference {
  userId: string;
  channels: {
    [key in NotificationChannel]: boolean;
  };
  types: {
    [key in NotificationType]: boolean;
  };
}
