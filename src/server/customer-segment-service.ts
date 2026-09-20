import { SupabaseCMSRepository } from "./supabase/cms-repository";
import { supabaseAdmin } from "./supabase-admin";
import { 
  CustomerSegment, 
  CustomerSegmentMembership, 
  CustomerSegmentView, 
  CustomerEvaluationContext,
  SegmentRuleGroup,
  SegmentRule,
  SegmentOperator
} from "../types/customer";
import { logCoreAudit } from "./core-service";
import * as crypto from "crypto";

export class CustomerSegmentService {
  private static instance: CustomerSegmentService;
  private cmsRepository = SupabaseCMSRepository.getInstance();

  private constructor() {}

  public static getInstance(): CustomerSegmentService {
    if (!CustomerSegmentService.instance) {
      CustomerSegmentService.instance = new CustomerSegmentService();
    }
    return CustomerSegmentService.instance;
  }

  // ============================================================================
  // SEGMENT MANAGEMENT
  // ============================================================================

  async getSegments(filters?: any): Promise<any> {
    let query = supabaseAdmin!.from("customer_segments").select("*");
    if (filters?.type && filters.type !== "ALL") query = query.eq("type", filters.type);
    if (filters?.search) query = query.ilike("name", `%${filters.search}%`);
    const { data } = await query;
    const items = (data || []).map(row => this.mapRowToSegment(row));
    return {
      items,
      total: items.length,
      page: filters?.page || 1,
      limit: filters?.limit || 20,
      totalPages: 1,
      metrics: {
        totalSegments: items.length,
        activeSegments: items.length,
        dynamicSegments: items.filter((i: any) => i.type === 'DYNAMIC').length
      }
    };
  }

  async activateSegment(id: string, actor: { uid: string, email: string }, role: string): Promise<CustomerSegment> {
    await this.updateSegment(id, { evaluationStatus: 'COMPLETED' }, actor, role);
    const seg = await this.getSegmentById(id);
    if (!seg) throw new Error("Segment not found");
    return seg;
  }

  async deactivateSegment(id: string, actor: { uid: string, email: string }, role: string): Promise<CustomerSegment> {
    await this.updateSegment(id, { evaluationStatus: 'IDLE' }, actor, role);
    const seg = await this.getSegmentById(id);
    if (!seg) throw new Error("Segment not found");
    return seg;
  }

  async addStaticMember(segmentId: string, customerUid: string, actor: { uid: string, email: string }, role: string): Promise<CustomerSegmentMembership> {
    const now = new Date().toISOString();
    const mem: CustomerSegmentMembership = {
      id: `${segmentId}_${customerUid}`,
      segmentId,
      customerUid,
      source: 'STATIC',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    await supabaseAdmin!.from("customer_segment_memberships").upsert({
      id: mem.id,
      segment_id: segmentId,
      customer_uid: customerUid,
      source: 'STATIC',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now
    });
    await logCoreAudit(actor, role, "STATIC_MEMBER_ADDED", `customerSegments/${segmentId}`, null, { customerUid });
    return mem;
  }

  async removeStaticMember(segmentId: string, customerUid: string, actor: { uid: string, email: string }, role: string): Promise<{ message: string }> {
    await supabaseAdmin!.from("customer_segment_memberships").delete().eq("segment_id", segmentId).eq("customer_uid", customerUid);
    await logCoreAudit(actor, role, "STATIC_MEMBER_REMOVED", `customerSegments/${segmentId}`, null, { customerUid });
    return { message: "Anggota berhasil dikeluarkan dari segmen." };
  }

  async exportSegmentMembersCsv(segmentId: string, actor?: any, role?: string): Promise<string> {
    const res = await this.getSegmentMembers(segmentId, { limit: 1000 }, true);
    const header = "ID,Name,Email,Status,SpentIdr,Orders\n";
    const rows = res.items.map(i => `"${i.customer.uid}","${i.customer.name || ''}","${i.customer.email}","${i.customer.status}",${i.customer.totalSpentIdr},${i.customer.orderCount}`).join("\n");
    return header + rows;
  }

  async getSegmentById(id: string): Promise<CustomerSegment | null> {
    const { data } = await supabaseAdmin!.from("customer_segments").select("*").eq("id", id).maybeSingle();
    return data ? this.mapRowToSegment(data) : null;
  }

  async createSegment(data: Partial<CustomerSegment>, actor: { uid: string, email: string }, role: string): Promise<CustomerSegment> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const segment: CustomerSegment = {
      id,
      name: data.name || "Unnamed Segment",
      description: data.description || "",
      type: data.type || 'STATIC',
      ruleGroup: data.ruleGroup,
      memberCount: 0,
      evaluationStatus: 'IDLE',
      createdAt: now,
      updatedAt: now,
      metadata: data.metadata || {}
    };

    await supabaseAdmin!.from("customer_segments").insert(this.mapSegmentToRow(segment));
    await logCoreAudit(actor, role, "SEGMENT_CREATED", `customerSegments/${id}`, null, segment);
    return segment;
  }

  async updateSegment(id: string, updates: Partial<CustomerSegment>, actor: { uid: string, email: string }, role: string): Promise<CustomerSegment> {
    const before = await this.getSegmentById(id);
    if (!before) throw new Error("Segment not found");

    const now = new Date().toISOString();
    await supabaseAdmin!.from("customer_segments").update({
      ...this.mapSegmentToRow(updates),
      updated_at: now
    }).eq("id", id);

    await logCoreAudit(actor, role, "SEGMENT_UPDATED", `customerSegments/${id}`, before, updates);
    const updated = await this.getSegmentById(id);
    return updated!;
  }

  async deleteSegment(id: string, actor: { uid: string, email: string }, role: string): Promise<{ message: string }> {
    const before = await this.getSegmentById(id);
    if (!before) throw new Error("Segment not found");

    // Remove memberships first
    await supabaseAdmin!.from("customer_segment_memberships").delete().eq("segment_id", id);
    // Delete segment
    await supabaseAdmin!.from("customer_segments").delete().eq("id", id);

    await logCoreAudit(actor, role, "SEGMENT_DELETED", `customerSegments/${id}`, before, null);
    return { message: "Segmen berhasil dihapus." };
  }

  private mapRowToSegment(row: any): CustomerSegment {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      ruleGroup: row.rule_group,
      memberCount: row.member_count,
      evaluationStatus: row.evaluation_status,
      evaluationError: row.evaluation_error,
      lastEvaluatedAt: row.last_evaluated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata
    };
  }

  private mapSegmentToRow(seg: Partial<CustomerSegment>): any {
    const row: any = {};
    if (seg.id !== undefined) row.id = seg.id;
    if (seg.name !== undefined) row.name = seg.name;
    if (seg.description !== undefined) row.description = seg.description;
    if (seg.type !== undefined) row.type = seg.type;
    if (seg.ruleGroup !== undefined) row.rule_group = seg.ruleGroup;
    if (seg.memberCount !== undefined) row.member_count = seg.memberCount;
    if (seg.evaluationStatus !== undefined) row.evaluation_status = seg.evaluationStatus;
    if (seg.evaluationError !== undefined) row.evaluation_error = seg.evaluationError;
    if (seg.lastEvaluatedAt !== undefined) row.last_evaluated_at = seg.lastEvaluatedAt;
    if (seg.createdAt !== undefined) row.created_at = seg.createdAt;
    if (seg.updatedAt !== undefined) row.updated_at = seg.updatedAt;
    if (seg.metadata !== undefined) row.metadata = seg.metadata;
    return row;
  }

  // ============================================================================
  // MEMBERSHIP MANAGEMENT
  // ============================================================================

  async getSegmentMembers(
    segmentId: string, 
    filters: { search?: string; status?: 'ACTIVE' | 'INACTIVE'; limit?: number; page?: number } = {},
    includeCustomer: boolean = true
  ): Promise<{ items: CustomerSegmentView[], total: number, page: number, limit: number, totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    
    let query = supabaseAdmin!.from("customer_segment_memberships").select("*", { count: "exact" }).eq("segment_id", segmentId);
    if (filters.status) query = query.eq("status", filters.status);
    
    const { data: memberships, count } = await query
      .order("updated_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    const total = count || 0;
    
    const items: CustomerSegmentView[] = [];
    if (memberships && includeCustomer) {
      // Batch fetch customers
      const uids = memberships.map(m => m.customer_uid);
      const { data: customers } = await supabaseAdmin!.from("customers").select("*").in("id", uids);
      const customerMap = new Map(customers?.map(c => [c.id, c]));
      
      for (const m of memberships) {
        const customerRow = customerMap.get(m.customer_uid);
        if (customerRow) {
          items.push({
            membership: {
              id: m.id,
              segmentId: m.segment_id,
              customerUid: m.customer_uid,
              source: m.source,
              status: m.status,
              evaluatedAt: m.evaluated_at,
              createdAt: m.created_at,
              updatedAt: m.updated_at
            },
            customer: {
              uid: customerRow.id,
              name: customerRow.name,
              email: customerRow.email,
              phone: customerRow.phone || "",
              status: customerRow.status || "active",
              role: customerRow.role || "customer",
              tags: customerRow.tags || [],
              totalSpentIdr: customerRow.total_spent_idr || 0,
              orderCount: customerRow.order_count || 0
            }
          });
        }
      }
    }
    
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  async evaluateSegment(
    segmentId: string,
    actor: { uid: string; email: string },
    actorRole: string
  ): Promise<{ qualifiedCount: number; disqualifiedCount: number }> {
    const segment = await this.getSegmentById(segmentId);
    if (!segment) throw new Error(`Segmen ${segmentId} tidak ditemukan.`);
    if (segment.type !== "DYNAMIC") throw new Error("Hanya segmen bertipe DYNAMIC yang dapat dievaluasi secara otomatis.");
    if (!segment.ruleGroup) throw new Error("Segmen tidak memiliki ruleGroup.");

    // Concurrency check
    if (segment.evaluationStatus === "RUNNING" && segment.lastEvaluatedAt) {
      const leaseAge = Date.now() - new Date(segment.lastEvaluatedAt).getTime();
      if (leaseAge < 3 * 60 * 1000) {
        throw new Error("Evaluasi segmen ini sedang berjalan. Silakan tunggu hingga proses selesai.");
      }
    }

    const startTimestamp = new Date().toISOString();
    await supabaseAdmin!.from("customer_segments").update({
      evaluation_status: "RUNNING",
      last_evaluated_at: startTimestamp,
      evaluation_error: null
    }).eq("id", segmentId);

    try {
      const contexts = await this.buildCustomerContexts();
      const { data: existingMemberships } = await supabaseAdmin!
        .from("customer_segment_memberships")
        .select("*")
        .eq("segment_id", segmentId);
      
      const existingMemMap = new Map<string, any>(existingMemberships?.map(m => [m.customer_uid, m]));
      
      let qualifiedCount = 0;
      let disqualifiedCount = 0;
      const now = new Date().toISOString();
      
      const upsertRows: any[] = [];
      
      for (const ctx of contexts) {
        const isQualified = this.evaluateRuleGroup(ctx, segment.ruleGroup);
        const existing = existingMemMap.get(ctx.uid);
        
        if (isQualified) {
          qualifiedCount++;
          if (!existing || existing.status !== "ACTIVE") {
            upsertRows.push({
              id: existing?.id || `${segmentId}_${ctx.uid}`,
              segment_id: segmentId,
              customer_uid: ctx.uid,
              source: "DYNAMIC",
              status: "ACTIVE",
              evaluated_at: now,
              created_at: existing ? existing.created_at : now,
              updated_at: now
            });
          } else {
            upsertRows.push({
              ...existing,
              evaluated_at: now,
              updated_at: now
            });
          }
        } else if (existing && existing.status === "ACTIVE") {
          disqualifiedCount++;
          upsertRows.push({
            ...existing,
            status: "INACTIVE",
            evaluated_at: now,
            updated_at: now
          });
        }
      }

      if (upsertRows.length > 0) {
        // Chunked upsert to avoid payload limits
        const chunkSize = 100;
        for (let i = 0; i < upsertRows.length; i += chunkSize) {
          const chunk = upsertRows.slice(i, i + chunkSize);
          await supabaseAdmin!.from("customer_segment_memberships").upsert(chunk);
        }
      }

      await supabaseAdmin!.from("customer_segments").update({
        member_count: qualifiedCount,
        evaluation_status: "COMPLETED",
        last_evaluated_at: new Date().toISOString()
      }).eq("id", segmentId);

      await logCoreAudit(actor, actorRole, "SEGMENT_EVALUATED", `customerSegments/${segmentId}`, null, { qualifiedCount, disqualifiedCount });
      return { qualifiedCount, disqualifiedCount };
    } catch (err: any) {
      await supabaseAdmin!.from("customer_segments").update({
        evaluation_status: "FAILED",
        evaluation_error: err.message || "Gagal melakukan evaluasi.",
        updated_at: new Date().toISOString()
      }).eq("id", segmentId);
      throw err;
    }
  }

  private async buildCustomerContexts(): Promise<CustomerEvaluationContext[]> {
    const { data: customers } = await supabaseAdmin!.from("customers").select("*");
    if (!customers) return [];
    
    return customers.map(c => ({
      uid: c.id,
      email: c.email,
      name: c.name,
      totalSpentIdr: c.total_spent_idr || 0,
      orderCount: c.order_count || 0,
      tags: c.tags || [],
      registrationDate: c.created_at,
      lastLoginAt: c.last_login_at
    }));
  }

  private evaluateRuleGroup(ctx: CustomerEvaluationContext, group: SegmentRuleGroup): boolean {
    if (!group.rules.length) return true;
    const results = group.rules.map(rule => this.evaluateRule(ctx, rule));
    return group.conjunction === 'AND' ? results.every(r => r) : results.some(r => r);
  }

  private evaluateRule(ctx: CustomerEvaluationContext, rule: SegmentRule): boolean {
    const val = (ctx as any)[rule.field];
    switch (rule.operator) {
      case 'EQUALS': return val === rule.value;
      case 'NOT_EQUALS': return val !== rule.value;
      case 'GREATER_THAN': return val > rule.value;
      case 'LESS_THAN': return val < rule.value;
      case 'CONTAINS': return Array.isArray(val) ? val.includes(rule.value) : String(val).includes(String(rule.value));
      default: return false;
    }
  }

  async isCustomerInSegment(customerUid: string, segmentId: string): Promise<boolean> {
    const { data } = await supabaseAdmin!
      .from("customer_segment_memberships")
      .select("status")
      .eq("customer_uid", customerUid)
      .eq("segment_id", segmentId)
      .maybeSingle();
    return data?.status === "ACTIVE";
  }

  async getCustomerSegmentIds(customerUid: string): Promise<string[]> {
    const { data } = await supabaseAdmin!
      .from("customer_segment_memberships")
      .select("segment_id")
      .eq("customer_uid", customerUid)
      .eq("status", "ACTIVE");
    return data?.map(m => m.segment_id) || [];
  }
}
