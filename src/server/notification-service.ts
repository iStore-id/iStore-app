import { adminDb } from "./firebase-admin";
import { 
  Notification, 
  NotificationType, 
  NotificationSeverity, 
  NotificationRecipientType 
} from "../types/notification";

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Fetch current global settings or fallback to safe defaults.
   */
  async getGlobalSettings(): Promise<any> {
    const docRef = adminDb.collection("notificationSettings").doc("global");
    const snap = await docRef.get();
    
    const allTypes: NotificationType[] = [
      'ORDER_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'ORDER_PROCESSING', 
      'ORDER_SUCCESS', 'ORDER_FAILED', 'ORDER_EXPIRED', 'REFUND_PROCESSING', 
      'REFUND_SUCCESS', 'REFUND_FAILED', 'REFUND_EXCEPTION', 'FAILED_ORDER_ALERT', 
      'PAYMENT_EXCEPTION', 'FULFILLMENT_EXCEPTION', 'QUEUE_DEAD_LETTER', 'SLA_BREACH', 
      'INCIDENT_OPENED', 'INCIDENT_ACKNOWLEDGED', 'INCIDENT_RESOLVED', 'STOCK_ALERT', 
      'SYSTEM_ALERT'
    ];

    const defaultEvents = allTypes.reduce((acc, t) => {
      acc[t] = true;
      return acc;
    }, {} as Record<NotificationType, boolean>);

    const defaultSettings = {
      id: "global",
      channels: {
        IN_APP: { enabled: true, status: "ACTIVE" },
        EMAIL: { enabled: false, status: "NOT_CONFIGURED" },
        WHATSAPP: { enabled: false, status: "NOT_CONFIGURED" },
        PUSH: { enabled: false, status: "NOT_CONFIGURED" }
      },
      events: defaultEvents,
      updatedAt: new Date().toISOString(),
      updatedBy: "system"
    };

    if (!snap.exists) {
      return defaultSettings;
    }

    const data = snap.data() || {};
    
    const channels = {
      IN_APP: { 
        enabled: data.channels?.IN_APP?.enabled ?? true, 
        status: data.channels?.IN_APP?.status || "ACTIVE" 
      },
      EMAIL: { 
        enabled: data.channels?.EMAIL?.enabled ?? false, 
        status: data.channels?.EMAIL?.status || "NOT_CONFIGURED" 
      },
      WHATSAPP: { 
        enabled: data.channels?.WHATSAPP?.enabled ?? false, 
        status: data.channels?.WHATSAPP?.status || "NOT_CONFIGURED" 
      },
      PUSH: { 
        enabled: data.channels?.PUSH?.enabled ?? false, 
        status: data.channels?.PUSH?.status || "NOT_CONFIGURED" 
      }
    };

    const events = { ...defaultEvents };
    if (data.events) {
      allTypes.forEach(t => {
        if (data.events[t] !== undefined) {
          events[t] = data.events[t];
        }
      });
    }

    return {
      id: "global",
      channels,
      events,
      updatedAt: data.updatedAt || new Date().toISOString(),
      updatedBy: data.updatedBy || "system"
    };
  }

  /**
   * Creates a notification with idempotency support and global settings filter.
   * @param notification The notification data.
   * @param idempotencyKey Optional key to prevent duplicate notifications for the same event.
   */
  async createNotification(
    notification: Omit<Notification, 'id' | 'createdAt' | 'status'>,
    idempotencyKey?: string
  ): Promise<string> {
    const now = new Date().toISOString();
    const docId = idempotencyKey ? `notif_${idempotencyKey}` : undefined;

    try {
      const settings = await this.getGlobalSettings();

      // 1. Is the event active?
      if (settings.events[notification.type] === false) {
        console.log(`[NotificationService] Event ${notification.type} is disabled by global settings. Skipping.`);
        return "";
      }

      // 2. Which channels are active and configured?
      const filteredChannels = (notification.channels || []).filter(c => {
        const channelConfig = settings.channels[c];
        return channelConfig && channelConfig.enabled && channelConfig.status === "ACTIVE";
      });

      if (filteredChannels.length === 0) {
        console.log(`[NotificationService] No active/configured channels for ${notification.type}. Skipping.`);
        return "";
      }

      const fullNotification: Notification = {
        ...notification,
        metadata: notification.metadata || null,
        channels: filteredChannels,
        status: 'UNREAD',
        createdAt: now
      };

      if (docId) {
        const docRef = adminDb.collection("notifications").doc(docId);
        await adminDb.runTransaction(async (transaction) => {
          const snap = await transaction.get(docRef);
          if (!snap.exists) {
            transaction.set(docRef, fullNotification);
          }
        });
        return docId;
      } else {
        const docRef = await adminDb.collection("notifications").add(fullNotification);
        return docRef.id;
      }
    } catch (error) {
      console.error("[NotificationService] error in createNotification:", error);
      // Fallback: if settings load fails, allow IN_APP as default behaviour to prevent regression in critical flows
      const fullNotification: Notification = {
        ...notification,
        channels: (notification.channels || []).filter(c => c === 'IN_APP'),
        status: 'UNREAD',
        createdAt: now
      };
      if (docId) {
        const docRef = adminDb.collection("notifications").doc(docId);
        await adminDb.runTransaction(async (transaction) => {
          const snap = await transaction.get(docRef);
          if (!snap.exists) {
            transaction.set(docRef, fullNotification);
          }
        });
        return docId;
      } else {
        const docRef = await adminDb.collection("notifications").add(fullNotification);
        return docRef.id;
      }
    }
  }

  /**
   * Shorthand for customer notifications
   */
  async notifyCustomer(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    options: {
      severity?: NotificationSeverity;
      relatedEntity?: { type: Notification['relatedEntityType']; id: string };
      actionUrl?: string;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    } = {}
  ) {
    return this.createNotification({
      recipientId: userId,
      recipientType: 'CUSTOMER',
      type,
      title,
      message,
      severity: options.severity || 'INFO',
      channels: ['IN_APP'],
      relatedEntityType: options.relatedEntity?.type,
      relatedEntityId: options.relatedEntity?.id,
      actionUrl: options.actionUrl,
      metadata: options.metadata
    }, options.idempotencyKey);
  }

  /**
   * Shorthand for admin notifications
   */
  async notifyAdmin(
    type: NotificationType,
    title: string,
    message: string,
    options: {
      severity?: NotificationSeverity;
      relatedEntity?: { type: Notification['relatedEntityType']; id: string };
      actionUrl?: string;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    } = {}
  ) {
    return this.createNotification({
      recipientId: 'ADMIN_ALL',
      recipientType: 'ADMIN',
      type,
      title,
      message,
      severity: options.severity || 'WARNING',
      channels: ['IN_APP'],
      relatedEntityType: options.relatedEntity?.type,
      relatedEntityId: options.relatedEntity?.id,
      actionUrl: options.actionUrl,
      metadata: options.metadata
    }, options.idempotencyKey);
  }

  async markAsRead(notificationId: string, userId: string) {
    const docRef = adminDb.collection("notifications").doc(notificationId);
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (snap.exists) {
        const data = snap.data() as Notification;
        // Verify ownership
        if (data.recipientId === userId || data.recipientId === 'ADMIN_ALL') {
          transaction.update(docRef, {
            status: 'READ',
            readAt: new Date().toISOString()
          });
        }
      }
    });
  }

  async markAllAsRead(userId: string, recipientType: NotificationRecipientType = 'CUSTOMER') {
    const recipientId = recipientType === 'ADMIN' ? 'ADMIN_ALL' : userId;
    const snap = await adminDb.collection("notifications")
      .where("recipientId", "==", recipientId)
      .where("status", "==", "UNREAD")
      .limit(100)
      .get();

    if (snap.empty) return;

    const batch = adminDb.batch();
    const now = new Date().toISOString();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'READ', readAt: now });
    });
    await batch.commit();
  }
}
