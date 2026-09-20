import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { NotificationService } from "./notification-service";
import { logCoreAudit } from "./core-service";
import { getUserRole } from "./auth-service";
import { supabaseAdmin } from "./supabase-admin";

const notificationService = NotificationService.getInstance();

export async function getCustomerNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.uid;
    const { status, limit = 50, lastId } = req.query;
    
    let query = supabaseAdmin!
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    
    // In Supabase/PostgreSQL we usually use offset or cursor-based pagination
    // Since lastId was used for startAfter in Firestore, we'll try to find the timestamp of lastId
    if (lastId) {
      const { data: lastDoc } = await supabaseAdmin!
        .from("notifications")
        .select("created_at")
        .eq("id", lastId)
        .maybeSingle();
      
      if (lastDoc) {
        query = query.lt("created_at", lastDoc.created_at);
      }
    }

    const { data: notificationsData } = await query.limit(Number(limit));
    
    const notifications = (notificationsData || []).map(doc => ({
      id: doc.id,
      recipientId: doc.recipient_id,
      recipientType: doc.recipient_type,
      title: doc.title,
      message: doc.message,
      type: doc.type,
      metadata: doc.metadata,
      status: doc.status,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at
    }));

    const { count } = await supabaseAdmin!
      .from("notifications")
      .select("*", { count: 'exact', head: true })
      .eq("recipient_id", userId)
      .eq("status", "UNREAD");

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount: count || 0
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, severity, type, limit = 50, lastId } = req.query;
    
    let query = supabaseAdmin!
      .from("notifications")
      .select("*")
      .eq("recipient_type", "ADMIN")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (severity) query = query.eq("metadata->severity", severity); // Assuming severity is in metadata
    if (type) query = query.eq("type", type);
    
    if (lastId) {
      const { data: lastDoc } = await supabaseAdmin!
        .from("notifications")
        .select("created_at")
        .eq("id", lastId)
        .maybeSingle();
      
      if (lastDoc) {
        query = query.lt("created_at", lastDoc.created_at);
      }
    }

    const { data: notificationsData } = await query.limit(Number(limit));
    
    const notifications = (notificationsData || []).map(doc => ({
      id: doc.id,
      recipientId: doc.recipient_id,
      recipientType: doc.recipient_type,
      title: doc.title,
      message: doc.message,
      type: doc.type,
      metadata: doc.metadata,
      status: doc.status,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at
    }));

    const { count } = await supabaseAdmin!
      .from("notifications")
      .select("*", { count: 'exact', head: true })
      .eq("recipient_id", "ADMIN_ALL")
      .eq("status", "UNREAD");

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount: count || 0
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

    const cleanChannels = {
      IN_APP: {
        enabled: channels.IN_APP?.enabled !== undefined ? !!channels.IN_APP.enabled : true,
        status: "ACTIVE"
      },
      EMAIL: {
        enabled: false,
        status: "NOT_CONFIGURED"
      },
      WHATSAPP: {
        enabled: false,
        status: "NOT_CONFIGURED"
      },
      PUSH: {
        enabled: false,
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

    const { data: currentData } = await supabaseAdmin!
      .from("notification_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    const updatedData = {
      id: "global",
      channels: cleanChannels,
      events: cleanEvents,
      updated_at: new Date().toISOString(),
      updated_by: actor.email
    };

    await supabaseAdmin!.from("notification_settings").upsert(updatedData);

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
      data: {
        ...updatedData,
        updatedAt: updatedData.updated_at,
        updatedBy: updatedData.updated_by
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
