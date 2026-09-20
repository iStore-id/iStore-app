import { supabaseAdmin } from "./supabase-admin.js";
import { SupportCase } from "../types/support.js";
import { CustomerService } from "./customer-service.js";
import { MembershipService } from "./membership-service.js";
import { LoyaltyService } from "./loyalty-service.js";
import { ReferralService } from "./referral-service.js";
import { SLAService } from "./sla-service.js";
import { OrderRepository } from "./supabase/order-repository.js";

export class SupportService {
  private static instance: SupportService;
  private customerService = CustomerService.getInstance();
  private membershipService = MembershipService.getInstance();
  private loyaltyService = LoyaltyService.getInstance();
  private referralService = ReferralService.getInstance();
  private slaService = SLAService.getInstance();

  private constructor() {}

  static getInstance(): SupportService {
    if (!SupportService.instance) {
      SupportService.instance = new SupportService();
    }
    return SupportService.instance;
  }

  private mapRowToCase(row: any): SupportCase {
    return {
      id: row.id,
      customerUid: row.customer_uid,
      customerEmail: row.customer_email || "",
      customerName: row.customer_name || "",
      description: row.description || "",
      channel: row.channel || "WEB",
      orderId: row.order_id,
      subject: row.subject,
      category: row.category,
      priority: row.priority,
      status: row.status,
      assignedTo: row.assigned_to,
      assignedAt: row.assigned_at,
      closedAt: row.closed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata
    };
  }

  async getSupport360(caseId: string): Promise<any> {
    const { data: caseRow } = await supabaseAdmin!
      .from("support_cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();

    if (!caseRow) throw new Error("Support case not found");
    const caseData = this.mapRowToCase(caseRow);

    const [customer, order, membership, loyalty, referral, previousCases, slaPolicies, messagesData] = await Promise.all([
      this.customerService.getCustomerById(caseData.customerUid),
      caseData.orderId ? OrderRepository.getInstance().getOrderById(caseData.orderId) : Promise.resolve(null),
      this.membershipService.getCustomerMembership(caseData.customerUid),
      this.loyaltyService.getBalance(caseData.customerUid),
      this.referralService.getReferralStatus(caseData.customerUid),
      this.getPreviousCases(caseData.customerUid, caseData.id),
      this.slaService.getPolicies(),
      supabaseAdmin!.from("support_messages").select("*").eq("case_id", caseId).order("created_at", { ascending: true })
    ]);

    const messages = (messagesData.data || []).map(m => ({
      id: m.id,
      caseId: m.case_id,
      authorUid: m.author_uid,
      authorName: m.author_name,
      authorType: m.author_type,
      content: m.content,
      isInternal: m.is_internal,
      createdAt: m.created_at
    }));

    const sla = await this.slaService.calculateSupportSLA(caseData, slaPolicies);

    return {
      case: caseData,
      messages,
      customer,
      order,
      membership,
      loyalty,
      referral,
      previousCases,
      sla
    };
  }

  private async getPreviousCases(customerUid: string, currentCaseId: string): Promise<SupportCase[]> {
    const { data } = await supabaseAdmin!
      .from("support_cases")
      .select("*")
      .eq("customer_uid", customerUid)
      .neq("id", currentCaseId)
      .limit(10);
    
    return (data || []).map(row => this.mapRowToCase(row));
  }

  async getAdminQueue(filters: { status?: string, priority?: string, category?: string, assignedTo?: string } = {}): Promise<SupportCase[]> {
    let query = supabaseAdmin!.from("support_cases").select("*").order("updated_at", { ascending: false });
    
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.priority) query = query.eq("priority", filters.priority);
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
    
    const { data } = await query.limit(100);
    return (data || []).map(row => this.mapRowToCase(row));
  }

  async getCustomerCases(customerUid: string): Promise<SupportCase[]> {
    const { data } = await supabaseAdmin!
      .from("support_cases")
      .select("*")
      .eq("customer_uid", customerUid)
      .order("updated_at", { ascending: false })
      .limit(50);
    
    return (data || []).map(row => this.mapRowToCase(row));
  }
}
