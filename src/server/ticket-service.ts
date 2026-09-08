import { adminDb } from "./firebase-admin";
import { SupportCase, SupportMessage, SupportStatus, SupportPriority } from "../types/support";
import { logCoreAudit } from "./core-service";
import { NotificationService } from "./notification-service";
import { SLAService } from "./sla-service";

export class TicketService {
  private static instance: TicketService;
  private notificationService = NotificationService.getInstance();
  private slaService = SLAService.getInstance();

  private constructor() {}

  static getInstance(): TicketService {
    if (!TicketService.instance) {
      TicketService.instance = new TicketService();
    }
    return TicketService.instance;
  }

  async createCase(data: Partial<SupportCase>, actor: { uid: string, email: string, name: string }): Promise<SupportCase> {
    return await adminDb.runTransaction(async (transaction) => {
      // Idempotency check
      if (data.idempotencyKey) {
        const existingSnap = await transaction.get(
          adminDb.collection("supportCases").where("idempotencyKey", "==", data.idempotencyKey).limit(1)
        );
        if (!existingSnap.empty) {
          return { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() } as SupportCase;
        }
      }

      const now = new Date().toISOString();
      const caseId = `case-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      const newCase: SupportCase = {
        id: caseId,
        customerUid: actor.uid,
        customerEmail: actor.email,
        customerName: actor.name,
        orderId: data.orderId || undefined,
        subject: data.subject || "No Subject",
        description: data.description || "",
        category: data.category || 'OTHER',
        priority: data.priority || 'NORMAL',
        status: 'OPEN',
        channel: data.channel || 'IN_APP',
        createdAt: now,
        updatedAt: now,
        idempotencyKey: data.idempotencyKey,
        metadata: data.metadata || {},
      };

      const docRef = adminDb.collection("supportCases").doc(caseId);
      transaction.set(docRef, newCase);

      // Audit
      await logCoreAudit(
        { uid: actor.uid, email: actor.email },
        'customer',
        'SUPPORT_CASE_CREATED',
        `supportCases/${caseId}`,
        null,
        newCase,
        `Customer created support case: ${newCase.subject}`
      );

      // Notification
      await this.notificationService.notifyAdmin(
        'SYSTEM_ALERT',
        "New Support Case",
        `New case from ${actor.name}: ${newCase.subject}`,
        {
          relatedEntity: { type: 'ORDER', id: caseId }, // Close enough
          actionUrl: `/admin/support`
        }
      );

      return newCase;
    });
  }

  async addMessage(caseId: string, messageData: Partial<SupportMessage>, actor: { uid: string, email: string, name: string, type: 'USER' | 'AGENT' | 'SYSTEM' }): Promise<SupportMessage> {
    return await adminDb.runTransaction(async (transaction) => {
      const caseRef = adminDb.collection("supportCases").doc(caseId);
      const caseSnap = await transaction.get(caseRef);
      
      if (!caseSnap.exists) {
        throw new Error("Support case not found");
      }

      const caseData = caseSnap.data() as SupportCase;
      const now = new Date().toISOString();

      // Idempotency check
      if (messageData.idempotencyKey) {
        const existingSnap = await transaction.get(
          adminDb.collection("messages").where("idempotencyKey", "==", messageData.idempotencyKey).limit(1)
        );
        if (!existingSnap.empty) {
          return { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() } as SupportMessage;
        }
      }

      const messageId = `msg-${Date.now()}`;
      const newMessage: SupportMessage = {
        id: messageId,
        caseId,
        senderId: actor.uid,
        senderType: actor.type,
        senderName: actor.name,
        text: messageData.text || "",
        attachments: messageData.attachments || [],
        isInternal: messageData.isInternal || false,
        createdAt: now,
        idempotencyKey: messageData.idempotencyKey
      };

      const msgRef = adminDb.collection("messages").doc(messageId);
      transaction.set(msgRef, newMessage);

      // Update case metadata
      const caseUpdate: Partial<SupportCase> = {
        updatedAt: now,
        lastMessageAt: now,
        lastMessagePreview: newMessage.text.substring(0, 100)
      };

      // If agent replies, move to ACKNOWLEDGED if currently OPEN
      if (actor.type === 'AGENT') {
        if (caseData.status === 'OPEN') {
          caseUpdate.status = 'ACKNOWLEDGED';
        }
        if (!caseData.firstResponseAt && !newMessage.isInternal) {
          caseUpdate.firstResponseAt = now;
        }
      }

      transaction.update(caseRef, caseUpdate);

      // Audit
      await logCoreAudit(
        { uid: actor.uid, email: actor.email },
        actor.type === 'USER' ? 'customer' : 'admin',
        newMessage.isInternal ? 'SUPPORT_INTERNAL_NOTE_ADDED' : 'SUPPORT_REPLY_SENT',
        `supportCases/${caseId}`,
        null,
        newMessage,
        newMessage.isInternal ? 'Added internal note' : 'Sent support reply'
      );

      // Notification to customer if agent replied publicly
      if (actor.type === 'AGENT' && !newMessage.isInternal) {
        await this.notificationService.notifyCustomer(caseData.customerUid, 'SYSTEM_ALERT', 'New Response', `Agent ${actor.name} replied to your case: ${caseData.subject}`, {
          relatedEntity: { type: 'ORDER', id: caseId },
          actionUrl: `/support`,
          idempotencyKey: `support_reply_${messageId}`
        });
      }

      return newMessage;
    });
  }

  async updateStatus(caseId: string, status: SupportStatus, actor: { uid: string, email: string }, role: string = 'admin'): Promise<void> {
    const now = new Date().toISOString();
    await adminDb.runTransaction(async (transaction) => {
      const caseRef = adminDb.collection("supportCases").doc(caseId);
      const caseSnap = await transaction.get(caseRef);
      if (!caseSnap.exists) throw new Error("Case not found");
      
      const before = caseSnap.data() as SupportCase;
      const update: Partial<SupportCase> = { 
        status, 
        updatedAt: now 
      };

      if (status === 'RESOLVED') update.resolvedAt = now;
      if (status === 'CLOSED') update.closedAt = now;

      transaction.update(caseRef, update);

      await logCoreAudit(
        actor,
        role,
        `SUPPORT_CASE_${status}`,
        `supportCases/${caseId}`,
        { status: before.status },
        { status },
        `Changed status to ${status}`
      );
    });
  }

  async assignAgent(caseId: string, agentUid: string, actor: { uid: string, email: string }, role: string = 'admin'): Promise<void> {
    const now = new Date().toISOString();
    await adminDb.runTransaction(async (transaction) => {
      const caseRef = adminDb.collection("supportCases").doc(caseId);
      const caseSnap = await transaction.get(caseRef);
      if (!caseSnap.exists) throw new Error("Case not found");
      
      const before = caseSnap.data() as SupportCase;
      
      transaction.update(caseRef, {
        assignedTo: agentUid,
        assignedAt: now,
        updatedAt: now
      });

      await logCoreAudit(
        actor,
        role,
        'SUPPORT_CASE_ASSIGNED',
        `supportCases/${caseId}`,
        { assignedTo: before.assignedTo },
        { assignedTo: agentUid },
        `Assigned case to agent ${agentUid}`
      );
    });
  }

  async updatePriority(caseId: string, priority: SupportPriority, actor: { uid: string, email: string }, role: string = 'admin'): Promise<void> {
    const now = new Date().toISOString();
    const caseRef = adminDb.collection("supportCases").doc(caseId);
    const before = (await caseRef.get()).data();
    
    await caseRef.update({
      priority,
      updatedAt: now
    });

    await logCoreAudit(
      actor,
      role,
      'SUPPORT_CASE_PRIORITY_CHANGED',
      `supportCases/${caseId}`,
      { priority: before?.priority },
      { priority },
      `Changed priority to ${priority}`
    );
  }
}
