import re

with open("src/server/notification-service.ts", "r") as f:
    content = f.read()

# Replace import
content = content.replace('import { adminDb } from "./firebase-admin";', 'import { supabaseAdmin } from "./supabase-admin";')
content = content.replace('import * as admin from "firebase-admin";', '')

# addNotification:
content = re.sub(
    r'const docRef = await adminDb\.collection\("notifications"\)\.add\(fullNotification\);[\s\S]*?return fullNotification;',
    r'''const { data, error } = await supabaseAdmin!.from("notifications").insert({
          id: fullNotification.id,
          user_id: fullNotification.userId,
          title: fullNotification.title,
          message: fullNotification.message,
          type: fullNotification.type,
          metadata: fullNotification.metadata,
          read: fullNotification.read,
          created_at: fullNotification.createdAt
        }).select().single();
        if (error) throw error;
        return fullNotification;''',
    content
)

# getNotifications
content = re.sub(
    r'let query: any = adminDb\.collection\("notifications"\)\.where\("userId", "==", userId\);[\s\S]*?return notifications;\n  \}',
    r'''let query = supabaseAdmin!.from("notifications").select("*").eq("user_id", userId);
    if (unreadOnly) {
      query = query.eq("read", false);
    }
    const { data: snapshot } = await query.order("created_at", { ascending: false }).limit(limit);
    
    const notifications = (snapshot || []).map(doc => ({
      id: doc.id,
      userId: doc.user_id,
      title: doc.title,
      message: doc.message,
      type: doc.type,
      metadata: doc.metadata,
      read: doc.read,
      createdAt: doc.created_at
    }));
    
    return notifications;
  }''',
    content
)

# markAsRead
content = re.sub(
    r'const docRef = adminDb\.collection\("notifications"\)\.doc\(notificationId\);[\s\S]*?await adminDb\.runTransaction\(async \(transaction\) => \{[\s\S]*?\}\);',
    r'''const { data } = await supabaseAdmin!.from("notifications").select("user_id").eq("id", notificationId).maybeSingle();
    if (!data) throw new Error("Notification not found");
    if (data.user_id !== userId) throw new Error("Unauthorized to modify this notification");
    
    await supabaseAdmin!.from("notifications").update({ read: true }).eq("id", notificationId);''',
    content
)

# markAllAsRead
content = re.sub(
    r'const snap = await adminDb\.collection\("notifications"\)[\s\S]*?await batch\.commit\(\);',
    r'''await supabaseAdmin!.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);''',
    content
)


with open("src/server/notification-service.ts", "w") as f:
    f.write(content)
