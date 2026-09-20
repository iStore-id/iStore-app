import { supabaseAdmin } from "./supabase-admin.js";
import { SupportCase, SupportMessage, SupportStatus, SupportPriority } from "../types/support.js";
import { logCoreAudit } from "./core-service.js";
import { NotificationService } from "./notification-service.js";
import { SLAService } from "./sla-service.js";
import * as crypto from "crypto";

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

  private mapRowToCase(row: any): SupportCase {
    return {
      id: row.id,
      customerUid: row.customer_uid,
      customerEmail: row.customer_email,
      customerName: row.customer_name,
      orderId: row.order_id,
      subject: row.subject,
      description: row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      channel: row.channel,
      assignedTo: row.assigned_to,
      assignedAt: row.assigned_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      firstResponseAt: row.first_response_at,
      resolvedAt: row.resolved_at,
      closedAt: row.closed_at,
      lastMessageAt: row.last_message_at,
      lastMessagePreview: row.last_message_preview,
      idempotencyKey: row.idempotency_key,
      metadata: row.metadata,
    };
  }

  private mapCaseToRow(data: Partial<SupportCase>): any {
    const row: any = {};
    if (data.id !== undefined) row.id = data.id;
    if (data.customerUid !== undefined) row.customer_uid = data.customerUid;
    if (data.customerEmail !== undefined) row.customer_email = data.customerEmail;
    if (data.customerName !== undefined) row.customer_name = data.customerName;
    if (data.orderId !== undefined) row.order_id = data.orderId;
    if (data.subject !== undefined) row.subject = data.subject;
    if (data.description !== undefined) row.description = data.description;
    if (data.category !== undefined) row.category = data.category;
    if (data.priority !== undefined) row.priority = data.priority;
    if (data.status !== undefined) row.status = data.status;
    if (data.channel !== undefined) row.channel = data.channel;
    if (data.assignedTo !== undefined) row.assigned_to = data.assignedTo;
    if (data.assignedAt !== undefined) row.assigned_at = data.assignedAt;
    if (data.createdAt !== undefined) row.created_at = data.createdAt;
    if (data.updatedAt !== undefined) row.updated_at = data.updatedAt;
    if (data.firstResponseAt !== undefined) row.first_response_at = data.firstResponseAt;
    if (data.resolvedAt !== undefined) row.resolved_at = data.resolvedAt;
    if (data.closedAt !== undefined) row.closed_at = data.closedAt;
    if (data.lastMessageAt !== undefined) row.last_message_at = data.lastMessageAt;
    if (data.lastMessagePreview !== undefined) row.last_message_preview = data.lastMessagePreview;
    if (data.idempotencyKey !== undefined) row.idempotency_key = data.idempotencyKey;
    if (data.metadata !== undefined) row.metadata = data.metadata;
    return row;
  }

  async createCase(data: Partial<SupportCase>, actor: { uid: string, email: string, name: string }): Promise<SupportCase> {
    // Idempotency check
    if (data.idempotencyKey) {
      const { data: existing } = await supabaseAdmin!
        .from("support_cases")
        .select("*")
        .eq("idempotency_key", data.idempotencyKey)
        .maybeSingle();
      
      if (existing) {
        return this.mapRowToCase(existing);
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

    const row = this.mapCaseToRow(newCase);
    await supabaseAdmin!.from("support_cases").insert(row);

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
        relatedEntity: { type: 'ORDER', id: caseId },
        actionUrl: `/admin/support`
      }
    );

    return newCase;
  }

  async addMessage(caseId: string, messageData: Partial<SupportMessage>, actor: { uid: string, email: string, name: string, type: 'USER' | 'AGENT' | 'SYSTEM' }): Promise<SupportMessage> {
    const { data: caseRow } = await supabaseAdmin!
      .from("support_cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();
    
    if (!caseRow) {
      throw new Error("Support case not found");
    }
    
    const caseData = this.mapRowToCase(caseRow);
    const now = new Date().toISOString();

    // Idempotency check
    if (messageData.idempotencyKey) {
      const { data: existing } = await supabaseAdmin!
        .from("support_messages")
        .select("*")
        .eq("idempotency_key", messageData.idempotencyKey)
        .maybeSingle();
      
      if (existing) {
        return {
          id: existing.id,
          caseId: existing.case_id,
          senderId: existing.sender_id,
          senderType: existing.sender_type,
          senderName: existing.sender_name,
          text: existing.text,
          attachments: existing.attachments,
          isInternal: existing.is_internal,
          createdAt: existing.created_at,
          idempotencyKey: existing.idempotency_key
        } as SupportMessage;
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

    await supabaseAdmin!.from("support_messages").insert({
      id: newMessage.id,
      case_id: newMessage.caseId,
      sender_id: newMessage.senderId,
      sender_type: newMessage.senderType,
      sender_name: newMessage.senderName,
      text: newMessage.text,
      attachments: newMessage.attachments,
      is_internal: newMessage.isInternal,
      created_at: newMessage.createdAt,
      idempotency_key: newMessage.idempotencyKey
    });

    // Update case metadata
    const caseUpdate: any = {
      updated_at: now,
      last_message_at: now,
      last_message_preview: newMessage.text.substring(0, 100)
    };

    // If agent replies, move to ACKNOWLEDGED if currently OPEN
    if (actor.type === 'AGENT') {
      if (caseData.status === 'OPEN') {
        caseUpdate.status = 'ACKNOWLEDGED';
      }
      if (!caseData.firstResponseAt && !newMessage.isInternal) {
        caseUpdate.first_response_at = now;
      }
    }

    await supabaseAdmin!.from("support_cases").update(caseUpdate).eq("id", caseId);

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
      await this.notificationService.notifyCustomer(
        caseData.customerUid,
        'SYSTEM_ALERT',
        'New Response',
        `Agent ${actor.name} replied to your case: ${caseData.subject}`,
        {
          relatedEntity: { type: 'ORDER', id: caseId },
          actionUrl: `/support`,
          idempotencyKey: `support_reply_${messageId}`
        }
      );
    }

    return newMessage;
  }

  async updateStatus(caseId: string, status: SupportStatus, actor: { uid: string, email: string }, role: string = 'admin'): Promise<void> {
    const now = new Date().toISOString();
    const { data: caseRow } = await supabaseAdmin!
      .from("support_cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();
    
    if (!caseRow) throw new Error("Case not found");
    
    const before = this.mapRowToCase(caseRow);
    const update: any = {
      status,
      updated_at: now
    };
    if (status === 'RESOLVED') update.resolved_at = now;
    if (status === 'CLOSED') update.closed_at = now;
    
    await supabaseAdmin!.from("support_cases").update(update).eq("id", caseId);
    
    await logCoreAudit(
      actor,
      role,
      `SUPPORT_CASE_${status}`,
      `supportCases/${caseId}`,
      { status: before.status },
      { status },
      `Changed status to ${status}`
    );
  }

  async assignAgent(caseId: string, agentUid: string, actor: { uid: string, email: string }, role: string = 'admin'): Promise<void> {
    const now = new Date().toISOString();
    const { data: caseRow } = await supabaseAdmin!
      .from("support_cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();
    
    if (!caseRow) throw new Error("Case not found");
    
    const before = this.mapRowToCase(caseRow);
    
    await supabaseAdmin!.from("support_cases").update({
      assigned_to: agentUid,
      assigned_at: now,
      updated_at: now
    }).eq("id", caseId);
    
    await logCoreAudit(
      actor,
      role,
      'SUPPORT_CASE_ASSIGNED',
      `supportCases/${caseId}`,
      { assignedTo: before.assignedTo },
      { assignedTo: agentUid },
      `Assigned case to agent ${agentUid}`
    );
  }

  async updatePriority(caseId: string, priority: SupportPriority, actor: { uid: string, email: string }, role: string = 'admin'): Promise<void> {
    const now = new Date().toISOString();
    const { data: caseRow } = await supabaseAdmin!
      .from("support_cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();
    
    if (!caseRow) throw new Error("Case not found");
    
    const before = this.mapRowToCase(caseRow);
    
    await supabaseAdmin!.from("support_cases").update({
      priority,
      updated_at: now
    }).eq("id", caseId);
    
    await logCoreAudit(
      actor,
      role,
      'SUPPORT_CASE_PRIORITY_CHANGED',
      `supportCases/${caseId}`,
      { priority: before.priority },
      { priority },
      `Changed priority to ${priority}`
    );
  }
}
