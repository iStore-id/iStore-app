import { Response } from "express";
import { adminDb } from "./firebase-admin";
import { AuthenticatedRequest } from "./middleware";
import { NotificationService } from "./notification-service";
import { logCoreAudit } from "./core-service";
import { getUserRole } from "./auth-service";

const notificationService = NotificationService.getInstance();

export async function getCustomerNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.uid;
    const { status, limit = 50, lastId } = req.query;

    let query = adminDb.collection("notifications")
      .where("recipientId", "==", userId)
      .orderBy("createdAt", "desc");

    if (status) {
      query = query.where("status", "==", status);
    }

    if (lastId) {
      const lastDoc = await adminDb.collection("notifications").doc(lastId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.limit(Number(limit)).get();
    const notifications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const unreadCount = await adminDb.collection("notifications")
      .where("recipientId", "==", userId)
      .where("status", "==", "UNREAD")
      .count()
      .get()
      .then(s => s.data().count);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, severity, type, limit = 50, lastId } = req.query;

    let query = adminDb.collection("notifications")
      .where("recipientType", "==", "ADMIN")
      .orderBy("createdAt", "desc");

    if (status) query = query.where("status", "==", status);
    if (severity) query = query.where("severity", "==", severity);
    if (type) query = query.where("type", "==", type);

    if (lastId) {
      const lastDoc = await adminDb.collection("notifications").doc(lastId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.limit(Number(limit)).get();
    const notifications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const unreadCount = await adminDb.collection("notifications")
      .where("recipientId", "==", "ADMIN_ALL")
      .where("status", "==", "UNREAD")
      .count()
      .get()
      .then(s => s.data().count);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function markNotificationRead(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    await notificationService.markAsRead(id, userId);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function markAllNotificationsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.uid;
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'pemilik';
    const type = isAdmin && req.query.scope === 'admin' ? 'ADMIN' : 'CUSTOMER';
    
    await notificationService.markAllAsRead(userId, type);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminNotificationSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const settings = await notificationService.getGlobalSettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateAdminNotificationSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user!.uid,
      email: req.user!.email || "unknown@istore.id"
    };
    const actorRole = await getUserRole(actor.uid);

    const { channels, events } = req.body;

    if (!channels || !events) {
      return res.status(400).json({ success: false, message: "Struktur pengaturan tidak lengkap." });
    }

    // Force strict rules: only IN_APP can be ACTIVE. Others are strictly NOT_CONFIGURED.
    const cleanChannels = {
      IN_APP: {
        enabled: channels.IN_APP?.enabled !== undefined ? !!channels.IN_APP.enabled : true,
        status: "ACTIVE"
      },
      EMAIL: {
        enabled: false, // Force disabled as it's not configured
        status: "NOT_CONFIGURED"
      },
      WHATSAPP: {
        enabled: false, // Force disabled as it's not configured
        status: "NOT_CONFIGURED"
      },
      PUSH: {
        enabled: false, // Force disabled as it's not configured
        status: "NOT_CONFIGURED"
      }
    };

    const allTypes = [
      'ORDER_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'ORDER_PROCESSING', 
      'ORDER_SUCCESS', 'ORDER_FAILED', 'ORDER_EXPIRED', 'REFUND_PROCESSING', 
      'REFUND_SUCCESS', 'REFUND_FAILED', 'REFUND_EXCEPTION', 'FAILED_ORDER_ALERT', 
      'PAYMENT_EXCEPTION', 'FULFILLMENT_EXCEPTION', 'QUEUE_DEAD_LETTER', 'SLA_BREACH', 
      'INCIDENT_OPENED', 'INCIDENT_ACKNOWLEDGED', 'INCIDENT_RESOLVED', 'STOCK_ALERT', 
      'SYSTEM_ALERT'
    ];

    const cleanEvents: Record<string, boolean> = {};
    allTypes.forEach(t => {
      cleanEvents[t] = events[t] !== undefined ? !!events[t] : true;
    });

    const docRef = adminDb.collection("notificationSettings").doc("global");
    
    // Fetch current settings for audit comparison
    const currentSnap = await docRef.get();
    const currentData = currentSnap.exists ? currentSnap.data() : null;

    const updatedData = {
      id: "global",
      channels: cleanChannels,
      events: cleanEvents,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email
    };

    await docRef.set(updatedData);

    // Audit Log logging
    await logCoreAudit(
      actor,
      actorRole,
      "UPDATE_NOTIFICATION_SETTINGS",
      "notificationSettings/global",
      currentData,
      updatedData,
      "Pembaruan Konfigurasi Notifikasi Global via Admin Panel"
    );

    return res.status(200).json({
      success: true,
      message: "Pengaturan notifikasi berhasil disimpan.",
      data: updatedData
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
