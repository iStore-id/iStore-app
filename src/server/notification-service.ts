import { supabaseAdmin } from "./supabase-admin.js";
import * as crypto from "crypto";

export class NotificationService {
  private static instance: NotificationService;
  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async sendNotification(userId: string, title: string, message: string, type: string = "system", metadata: any = {}): Promise<void> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    await supabaseAdmin!.from("notifications").insert({
      id,
      recipient_id: userId,
      recipient_type: 'CUSTOMER',
      title,
      message,
      type,
      metadata,
      status: 'UNREAD',
      created_at: createdAt,
      updated_at: createdAt
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const { data } = await supabaseAdmin!
      .from("notifications")
      .select("recipient_id")
      .eq("id", notificationId)
      .maybeSingle();

    if (!data) throw new Error("Notifikasi tidak ditemukan.");
    if (data.recipient_id !== userId && data.recipient_id !== 'ADMIN_ALL') {
      throw new Error("Unauthorized access to notification.");
    }

    await supabaseAdmin!
      .from("notifications")
      .update({ status: 'READ', updated_at: new Date().toISOString() })
      .eq("id", notificationId);
  }

  async markAllAsRead(userId: string, recipientType: 'CUSTOMER' | 'ADMIN'): Promise<void> {
    const recipientId = recipientType === 'ADMIN' ? 'ADMIN_ALL' : userId;
    await supabaseAdmin!
      .from("notifications")
      .update({ status: 'READ', updated_at: new Date().toISOString() })
      .eq("recipient_id", recipientId)
      .eq("status", "UNREAD");
  }

  async getGlobalSettings(): Promise<any> {
    const { data } = await supabaseAdmin!
      .from("notification_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    
    return data || {
      id: "global",
      channels: {
        IN_APP: { enabled: true, status: "ACTIVE" },
        EMAIL: { enabled: false, status: "NOT_CONFIGURED" },
        WHATSAPP: { enabled: false, status: "NOT_CONFIGURED" },
        PUSH: { enabled: false, status: "NOT_CONFIGURED" }
      },
      events: {}
    };
  }

  // Legacy compat stubs with rest params
  async notifyCustomer(...args: any[]): Promise<void> {
    if (args.length >= 3) {
      await this.sendNotification(args[0], args[1], args[2], args[3] || 'system', args[4] || {});
    }
  }

  async notifyAdmin(...args: any[]): Promise<void> {
    const title = args[0] || "Admin Notification";
    const message = args[1] || "";
    const type = args[2] || "system";
    const metadata = args[3] || {};
    
    const id = crypto.randomUUID();
    await supabaseAdmin!.from("notifications").insert({
      id,
      recipient_id: 'ADMIN_ALL',
      recipient_type: 'ADMIN',
      title,
      message,
      type,
      metadata,
      status: 'UNREAD',
      created_at: new Date().toISOString()
    });
  }
}
