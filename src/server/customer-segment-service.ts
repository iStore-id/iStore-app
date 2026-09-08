import { adminDb } from "./firebase-admin";
import { 
  CustomerSegment, 
  CustomerSegmentMembership, 
  CustomerSegmentsQuery, 
  CustomerSegmentsResponse, 
  SegmentMemberView, 
  SegmentRule, 
  SegmentRuleGroup, 
  SEGMENT_FIELD_CATALOG, 
  EvaluatedCustomerContext,
  SegmentType,
  SegmentStatus
} from "../types/customer-segment";
import { logCoreAudit } from "./core-service";
import { LoyaltyService } from "./loyalty-service";
import { maskEmail, maskPhone } from "./customer-service";

export class CustomerSegmentService {
  private static instance: CustomerSegmentService;
  private loyaltyService: LoyaltyService;

  private constructor() {
    this.loyaltyService = LoyaltyService.getInstance();
  }

  public static getInstance(): CustomerSegmentService {
    if (!CustomerSegmentService.instance) {
      CustomerSegmentService.instance = new CustomerSegmentService();
    }
    return CustomerSegmentService.instance;
  }

  /**
   * Validate Segment Rule Group against the strict Field Catalog
   */
  public validateRuleGroup(group: SegmentRuleGroup): void {
    if (!group || typeof group !== "object") {
      throw new Error("Struktur rule group tidak valid.");
    }
    if (group.combinator !== "AND" && group.combinator !== "OR") {
      throw new Error(`Kombinator group tidak valid: ${group.combinator}. Gunakan 'AND' atau 'OR'.`);
    }
    if (!Array.isArray(group.rules) || group.rules.length === 0) {
      throw new Error("Rule group harus memiliki minimal satu aturan (rule).");
    }

    for (const ruleItem of group.rules) {
      if ("combinator" in ruleItem) {
        // Nested Rule Group
        this.validateRuleGroup(ruleItem as SegmentRuleGroup);
      } else {
        // Individual Rule
        this.validateSingleRule(ruleItem as SegmentRule);
      }
    }
  }

  private validateSingleRule(rule: SegmentRule): void {
    if (!rule.field || typeof rule.field !== "string") {
      throw new Error("Field rule wajib diisi.");
    }

    const fieldDef = SEGMENT_FIELD_CATALOG[rule.field];
    if (!fieldDef) {
      throw new Error(`Field '${rule.field}' tidak terdaftar dalam Field Catalog segmen.`);
    }

    if (!fieldDef.allowedOperators.includes(rule.operator)) {
      throw new Error(
        `Operator '${rule.operator}' tidak diizinkan untuk field '${rule.field}'. Operator valid: ${fieldDef.allowedOperators.join(", ")}`
      );
    }

    if (rule.value === undefined || rule.value === null || rule.value === "") {
      throw new Error(`Nilai (value) untuk field '${rule.field}' tidak boleh kosong.`);
    }

    // Type validation
    switch (fieldDef.valueType) {
      case "number":
        if (rule.operator === "between") {
          if (!Array.isArray(rule.value) || rule.value.length !== 2 || typeof rule.value[0] !== "number" || typeof rule.value[1] !== "number") {
            throw new Error(`Field '${rule.field}' dengan operator 'between' memerlukan array dua angka [min, max].`);
          }
        } else {
          if (typeof rule.value !== "number" || isNaN(rule.value)) {
            throw new Error(`Nilai untuk field numerik '${rule.field}' harus berupa angka.`);
          }
        }
        break;

      case "enum":
        if (rule.operator === "in" || rule.operator === "not_in") {
          if (!Array.isArray(rule.value) || rule.value.length === 0) {
            throw new Error(`Nilai untuk operator '${rule.operator}' harus berupa array pilihan.`);
          }
        } else {
          if (typeof rule.value !== "string") {
            throw new Error(`Nilai untuk enum '${rule.field}' harus berupa string.`);
          }
          if (fieldDef.enumValues && !fieldDef.enumValues.some(e => e.value === rule.value)) {
            throw new Error(`Nilai '${rule.value}' bukan opsi valid untuk enum '${rule.field}'.`);
          }
        }
        break;

      case "date":
        if (rule.operator === "within_days") {
          if (typeof rule.value !== "number" || rule.value <= 0) {
            throw new Error(`Operator 'within_days' memerlukan input jumlah hari berupa angka positif.`);
          }
        } else if (rule.operator === "between") {
          if (!Array.isArray(rule.value) || rule.value.length !== 2) {
            throw new Error(`Operator 'between' pada tanggal memerlukan array [startIsoDate, endIsoDate].`);
          }
        } else {
          if (typeof rule.value !== "string" || isNaN(Date.parse(rule.value))) {
            throw new Error(`Format tanggal tidak valid untuk field '${rule.field}'.`);
          }
        }
        break;

      case "array_string":
        if (typeof rule.value !== "string" && !Array.isArray(rule.value)) {
          throw new Error(`Nilai untuk array '${rule.field}' harus berupa string atau array string.`);
        }
        break;

      case "string":
        if (typeof rule.value !== "string") {
          throw new Error(`Nilai untuk teks '${rule.field}' harus berupa string.`);
        }
        break;
    }
  }

  /**
   * Evaluate a single rule against a customer context (Strict, No arbitrary code execution)
   */
  public evaluateSingleRule(ctx: EvaluatedCustomerContext, rule: SegmentRule): boolean {
    const fieldDef = SEGMENT_FIELD_CATALOG[rule.field];
    if (!fieldDef) return false;

    let targetValue: any;
    switch (rule.field) {
      case "customer.status": targetValue = ctx.status; break;
      case "customer.role": targetValue = ctx.role; break;
      case "customer.createdAt": targetValue = ctx.createdAt; break;
      case "customer.email": targetValue = ctx.email; break;
      case "customer.phone": targetValue = ctx.phone; break;
      case "tagging.tags": targetValue = ctx.tags; break;
      case "commerce.totalSpentIdr": targetValue = ctx.totalSpentIdr; break;
      case "commerce.orderCount": targetValue = ctx.orderCount; break;
      case "commerce.successfulOrdersCount": targetValue = ctx.successfulOrdersCount; break;
      case "commerce.lastOrderAt": targetValue = ctx.lastOrderAt; break;
      case "commerce.purchasedGameIds": targetValue = ctx.purchasedGameIds; break;
      case "loyalty.pointsBalance": targetValue = ctx.pointsBalance; break;
      case "loyalty.lifetimePointsEarned": targetValue = ctx.lifetimePointsEarned; break;
      case "membership.planId": targetValue = ctx.membershipPlanId; break;
      case "membership.tierLevel": targetValue = ctx.membershipTierLevel; break;
      case "membership.status": targetValue = ctx.membershipStatus; break;
      case "membership.expiryDate": targetValue = ctx.membershipExpiryDate; break;
      default: return false;
    }

    switch (rule.operator) {
      case "equals":
        if (typeof targetValue === "string") {
          return targetValue.toLowerCase() === String(rule.value).toLowerCase();
        }
        return targetValue === rule.value;

      case "not_equals":
        if (typeof targetValue === "string") {
          return targetValue.toLowerCase() !== String(rule.value).toLowerCase();
        }
        return targetValue !== rule.value;

      case "greater_than":
        return typeof targetValue === "number" && targetValue > Number(rule.value);

      case "greater_than_or_equal":
        if (fieldDef.valueType === "date") {
          if (!targetValue) return false;
          return new Date(targetValue).getTime() >= new Date(rule.value as string).getTime();
        }
        return typeof targetValue === "number" && targetValue >= Number(rule.value);

      case "less_than":
        return typeof targetValue === "number" && targetValue < Number(rule.value);

      case "less_than_or_equal":
        if (fieldDef.valueType === "date") {
          if (!targetValue) return false;
          return new Date(targetValue).getTime() <= new Date(rule.value as string).getTime();
        }
        return typeof targetValue === "number" && targetValue <= Number(rule.value);

      case "between":
        if (Array.isArray(rule.value) && rule.value.length === 2) {
          if (fieldDef.valueType === "date") {
            if (!targetValue) return false;
            const t = new Date(targetValue).getTime();
            return t >= new Date(rule.value[0]).getTime() && t <= new Date(rule.value[1]).getTime();
          }
          return typeof targetValue === "number" && targetValue >= Number(rule.value[0]) && targetValue <= Number(rule.value[1]);
        }
        return false;

      case "within_days":
        if (!targetValue) return false;
        const days = Number(rule.value);
        const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
        return new Date(targetValue).getTime() >= threshold;

      case "contains":
        if (Array.isArray(targetValue)) {
          const needle = String(rule.value).toLowerCase();
          return targetValue.some(item => String(item).toLowerCase() === needle || String(item).toLowerCase().includes(needle));
        }
        if (typeof targetValue === "string") {
          return targetValue.toLowerCase().includes(String(rule.value).toLowerCase());
        }
        return false;

      case "not_contains":
        if (Array.isArray(targetValue)) {
          const needle = String(rule.value).toLowerCase();
          return !targetValue.some(item => String(item).toLowerCase() === needle || String(item).toLowerCase().includes(needle));
        }
        if (typeof targetValue === "string") {
          return !targetValue.toLowerCase().includes(String(rule.value).toLowerCase());
        }
        return true;

      case "in":
        if (Array.isArray(rule.value)) {
          const allowed = (rule.value as string[]).map(v => String(v).toLowerCase());
          if (Array.isArray(targetValue)) {
            return targetValue.some(item => allowed.includes(String(item).toLowerCase()));
          }
          return allowed.includes(String(targetValue).toLowerCase());
        }
        return false;

      case "not_in":
        if (Array.isArray(rule.value)) {
          const disallowed = (rule.value as string[]).map(v => String(v).toLowerCase());
          if (Array.isArray(targetValue)) {
            return !targetValue.some(item => disallowed.includes(String(item).toLowerCase()));
          }
          return !disallowed.includes(String(targetValue).toLowerCase());
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * Recursively evaluate a rule group
   */
  public evaluateRuleGroup(ctx: EvaluatedCustomerContext, group: SegmentRuleGroup): boolean {
    if (!group || !Array.isArray(group.rules) || group.rules.length === 0) {
      return false;
    }

    if (group.combinator === "AND") {
      for (const ruleItem of group.rules) {
        let match = false;
        if ("combinator" in ruleItem) {
          match = this.evaluateRuleGroup(ctx, ruleItem as SegmentRuleGroup);
        } else {
          match = this.evaluateSingleRule(ctx, ruleItem as SegmentRule);
        }
        if (!match) return false;
      }
      return true;
    } else { // OR
      for (const ruleItem of group.rules) {
        let match = false;
        if ("combinator" in ruleItem) {
          match = this.evaluateRuleGroup(ctx, ruleItem as SegmentRuleGroup);
        } else {
          match = this.evaluateSingleRule(ctx, ruleItem as SegmentRule);
        }
        if (match) return true;
      }
      return false;
    }
  }

  /**
   * Build complete customer evaluation contexts from Firestore
   */
  public async buildCustomerContexts(): Promise<EvaluatedCustomerContext[]> {
    const usersSnap = await adminDb.collection("users").get();
    const ordersSnap = await adminDb.collection("orders").get();
    const pointTxSnap = await adminDb.collection("pointTransactions").get();

    // Map commerce aggregation per user
    const commerceMap = new Map<string, {
      totalSpentIdr: number;
      orderCount: number;
      successfulOrdersCount: number;
      lastOrderAt: string | null;
      purchasedGameIds: Set<string>;
    }>();

    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const userId = order.userId;
      if (!userId || userId === "guest") continue;

      let c = commerceMap.get(userId);
      if (!c) {
        c = {
          totalSpentIdr: 0,
          orderCount: 0,
          successfulOrdersCount: 0,
          lastOrderAt: null,
          purchasedGameIds: new Set()
        };
        commerceMap.set(userId, c);
      }

      c.orderCount += 1;
      const isPaid = order.paymentStatus === "paid" || order.transactionStatus === "success";
      if (isPaid) {
        const amount = Number(order.totalAmount || 0);
        c.totalSpentIdr += amount;
        c.successfulOrdersCount += 1;

        const orderDate = order.createdAt || order.timestamp;
        if (orderDate) {
          if (!c.lastOrderAt || new Date(orderDate).getTime() > new Date(c.lastOrderAt).getTime()) {
            c.lastOrderAt = orderDate;
          }
        }
      }

      if (order.gameId) c.purchasedGameIds.add(String(order.gameId));
      if (order.gameName) c.purchasedGameIds.add(String(order.gameName));
      if (order.productName) c.purchasedGameIds.add(String(order.productName));
    }

    // Map loyalty points earned per user
    const loyaltyMap = new Map<string, { balance: number; lifetimeEarned: number }>();
    for (const doc of pointTxSnap.docs) {
      const tx = doc.data();
      const customerId = tx.customerId || tx.userId;
      if (!customerId) continue;

      let l = loyaltyMap.get(customerId);
      if (!l) {
        l = { balance: 0, lifetimeEarned: 0 };
        loyaltyMap.set(customerId, l);
      }
      const points = Number(tx.points || 0);
      if (tx.type === "EARN" || tx.type === "REFERRAL_EARN") {
        l.lifetimeEarned += points;
        l.balance += points;
      } else if (tx.type === "REDEEM" || tx.type === "EXPIRE") {
        l.balance -= points;
      }
    }

    // Map referral relationships for facts (Phase C3)
    const referralSnap = await adminDb.collection("referralRelationships").get();
    const referralStatsMap = new Map<string, { count: number; successfulCount: number }>();
    for (const doc of referralSnap.docs) {
      const rel = doc.data();
      const ref = rel.referrerUid;
      if (!ref) continue;
      
      let r = referralStatsMap.get(ref);
      if (!r) {
        r = { count: 0, successfulCount: 0 };
        referralStatsMap.set(ref, r);
      }
      r.count++;
      if (rel.status === 'CONVERTED') {
        r.successfulCount++;
      }
    }

    // Map membership status per user (Phase C4)
    const membershipSnap = await adminDb.collection("customerMemberships").get();
    const membershipMap = new Map<string, any>();
    for (const doc of membershipSnap.docs) {
      membershipMap.set(doc.id, doc.data());
    }

    // Construct evaluation contexts
    const contexts: EvaluatedCustomerContext[] = [];
    for (const doc of usersSnap.docs) {
      const u = doc.data();
      const uid = doc.id;
      const commerce = commerceMap.get(uid) || {
        totalSpentIdr: 0,
        orderCount: 0,
        successfulOrdersCount: 0,
        lastOrderAt: null,
        purchasedGameIds: new Set()
      };
      const loyalty = loyaltyMap.get(uid) || { balance: 0, lifetimeEarned: 0 };
      
      // Map referral relationships for facts (Phase C3)
      const referral = referralStatsMap.get(uid) || { count: 0, successfulCount: 0 };

      contexts.push({
        uid,
        email: u.email || "",
        name: u.name || u.displayName || u.email?.split("@")[0] || "Pelanggan",
        phone: u.phone || u.whatsapp || "",
        status: (u.status || "ACTIVE").toString().toUpperCase(),
        role: u.role || "customer",
        tags: Array.isArray(u.tags) ? u.tags : [],
        createdAt: u.createdAt || new Date().toISOString(),
        totalSpentIdr: commerce.totalSpentIdr,
        orderCount: commerce.orderCount,
        successfulOrdersCount: commerce.successfulOrdersCount,
        lastOrderAt: commerce.lastOrderAt,
        purchasedGameIds: Array.from(commerce.purchasedGameIds),
        pointsBalance: Math.max(0, loyalty.balance),
        lifetimePointsEarned: loyalty.lifetimeEarned,
        referralCount: referral.count,
        successfulReferralCount: referral.successfulCount,
        isReferrer: !!u.referralCode,
        referredBy: u.referredBy || null,
        membershipPlanId: membershipMap.get(uid)?.planId || null,
        membershipTierLevel: membershipMap.get(uid)?.metadata?.tierLevel || 0,
        membershipStatus: membershipMap.get(uid)?.status || "NONE",
        membershipExpiryDate: membershipMap.get(uid)?.expiryDate || null
      });
    }

    return contexts;
  }

  // ============================================================================
  // SEGMENT CRUD OPERATIONS
  // ============================================================================

  async getSegments(query: CustomerSegmentsQuery = {}): Promise<CustomerSegmentsResponse> {
    const {
      search = "",
      type = "ALL",
      status = "ALL",
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = query;

    const snap = await adminDb.collection("customerSegments").get();
    let segments: CustomerSegment[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerSegment));

    // Calculate global metrics
    let activeCount = 0;
    let inactiveCount = 0;
    let staticCount = 0;
    let dynamicCount = 0;
    let totalActiveMemberships = 0;

    for (const s of segments) {
      if (s.status === "ACTIVE") activeCount++;
      else inactiveCount++;

      if (s.type === "STATIC") staticCount++;
      else dynamicCount++;

      totalActiveMemberships += (s.memberCount || 0);
    }

    // Filter
    let filtered = segments.filter(s => {
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const matchesName = s.name.toLowerCase().includes(term);
        const matchesDesc = (s.description || "").toLowerCase().includes(term);
        if (!matchesName && !matchesDesc) return false;
      }
      if (type !== "ALL" && s.type !== type) return false;
      if (status !== "ALL" && s.status !== status) return false;
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA: any = a[sortBy] || "";
      let valB: any = b[sortBy] || "";
      if (sortBy === "createdAt" || sortBy === "lastEvaluatedAt") {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      }
      if (sortOrder === "asc") {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });

    // Pagination
    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      metrics: {
        totalSegments: segments.length,
        activeCount,
        inactiveCount,
        staticCount,
        dynamicCount,
        totalActiveMemberships
      }
    };
  }

  async getSegmentById(id: string): Promise<CustomerSegment | null> {
    const doc = await adminDb.collection("customerSegments").doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as CustomerSegment;
  }

  async createSegment(
    data: {
      name: string;
      description?: string;
      type: SegmentType;
      ruleGroup?: SegmentRuleGroup;
      initialMembers?: string[];
    },
    actor: { uid: string; email: string },
    actorRole: string
  ): Promise<CustomerSegment> {
    if (!data.name || !data.name.trim()) {
      throw new Error("Nama segmen wajib diisi.");
    }
    if (data.type !== "STATIC" && data.type !== "DYNAMIC") {
      throw new Error("Tipe segmen harus STATIC atau DYNAMIC.");
    }

    if (data.type === "DYNAMIC") {
      if (!data.ruleGroup) {
        throw new Error("Segmen DYNAMIC wajib menyertakan definisi Rule Group.");
      }
      this.validateRuleGroup(data.ruleGroup);
    }

    const segRef = adminDb.collection("customerSegments").doc();
    const now = new Date().toISOString();

    const newSegment: CustomerSegment = {
      id: segRef.id,
      name: data.name.trim(),
      description: data.description?.trim() || "",
      type: data.type,
      status: "ACTIVE",
      ruleGroup: data.type === "DYNAMIC" ? data.ruleGroup : undefined,
      memberCount: 0,
      lastEvaluatedAt: null,
      evaluationStatus: "IDLE",
      evaluationError: null,
      createdBy: actor.email,
      updatedBy: actor.email,
      createdAt: now,
      updatedAt: now
    };

    await segRef.set(newSegment);

    await logCoreAudit(
      actor,
      actorRole,
      "SEGMENT_CREATED",
      `customerSegments/${segRef.id}`,
      null,
      { id: segRef.id, name: newSegment.name, type: newSegment.type }
    );

    // If static and initial members provided
    if (data.type === "STATIC" && Array.isArray(data.initialMembers) && data.initialMembers.length > 0) {
      for (const uid of data.initialMembers) {
        await this.addStaticMember(segRef.id, uid, actor, actorRole, false);
      }
      // Reconcile member count
      const activeCount = await this.reconcileSegmentMemberCount(segRef.id);
      newSegment.memberCount = activeCount;
    } else if (data.type === "DYNAMIC") {
      // Evaluate immediately
      await this.evaluateSegment(segRef.id, actor, actorRole, false);
      const updated = await this.getSegmentById(segRef.id);
      if (updated) return updated;
    }

    return newSegment;
  }

  async updateSegment(
    id: string,
    data: {
      name?: string;
      description?: string;
      ruleGroup?: SegmentRuleGroup;
    },
    actor: { uid: string; email: string },
    actorRole: string
  ): Promise<CustomerSegment> {
    const segment = await this.getSegmentById(id);
    if (!segment) {
      throw new Error(`Segmen dengan ID ${id} tidak ditemukan.`);
    }

    const updates: Partial<CustomerSegment> = {
      updatedBy: actor.email,
      updatedAt: new Date().toISOString()
    };

    if (data.name !== undefined) {
      if (!data.name.trim()) throw new Error("Nama segmen tidak boleh kosong.");
      updates.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updates.description = data.description.trim();
    }

    let ruleUpdated = false;
    if (segment.type === "DYNAMIC" && data.ruleGroup !== undefined) {
      this.validateRuleGroup(data.ruleGroup);
      updates.ruleGroup = data.ruleGroup;
      ruleUpdated = true;
    }

    await adminDb.collection("customerSegments").doc(id).update(updates);

    if (ruleUpdated) {
      await logCoreAudit(actor, actorRole, "SEGMENT_RULE_UPDATED", `customerSegments/${id}`, segment.ruleGroup, data.ruleGroup);
      // Auto re-evaluate on rule change
      await this.evaluateSegment(id, actor, actorRole, false);
    } else {
      await logCoreAudit(actor, actorRole, "SEGMENT_UPDATED", `customerSegments/${id}`, segment, updates);
    }

    return (await this.getSegmentById(id))!;
  }

  async activateSegment(id: string, actor: { uid: string; email: string }, actorRole: string): Promise<CustomerSegment> {
    const segment = await this.getSegmentById(id);
    if (!segment) throw new Error(`Segmen dengan ID ${id} tidak ditemukan.`);

    const now = new Date().toISOString();
    await adminDb.collection("customerSegments").doc(id).update({
      status: "ACTIVE",
      updatedBy: actor.email,
      updatedAt: now
    });

    await logCoreAudit(actor, actorRole, "SEGMENT_ACTIVATED", `customerSegments/${id}`, { status: segment.status }, { status: "ACTIVE" });
    return (await this.getSegmentById(id))!;
  }

  async deactivateSegment(id: string, actor: { uid: string; email: string }, actorRole: string): Promise<CustomerSegment> {
    const segment = await this.getSegmentById(id);
    if (!segment) throw new Error(`Segmen dengan ID ${id} tidak ditemukan.`);

    const now = new Date().toISOString();
    await adminDb.collection("customerSegments").doc(id).update({
      status: "INACTIVE",
      updatedBy: actor.email,
      updatedAt: now
    });

    await logCoreAudit(actor, actorRole, "SEGMENT_DEACTIVATED", `customerSegments/${id}`, { status: segment.status }, { status: "INACTIVE" });
    return (await this.getSegmentById(id))!;
  }

  async deleteSegment(id: string, actor: { uid: string; email: string }, actorRole: string): Promise<{ success: boolean; message: string }> {
    const segment = await this.getSegmentById(id);
    if (!segment) throw new Error(`Segmen dengan ID ${id} tidak ditemukan.`);

    // Check active campaign dependencies
    const activeCampaigns = await adminDb.collection("campaigns")
      .where("enabled", "==", true)
      .where("isArchived", "==", false)
      .get();
    
    const dependentCampaign = activeCampaigns.docs.find(d => {
      const c = d.data();
      return Array.isArray(c.targetSegmentIds) && c.targetSegmentIds.includes(id);
    });

    if (dependentCampaign) {
      throw new Error(`Tidak dapat menghapus segmen: Masih digunakan oleh kampanye aktif '${dependentCampaign.data().title || dependentCampaign.id}'. Silakan nonaktifkan atau arsipkan segmen.`);
    }

    // Delete memberships in batches
    const membershipsSnap = await adminDb.collection("customerSegmentMemberships")
      .where("segmentId", "==", id)
      .get();

    const batch = adminDb.batch();
    membershipsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(adminDb.collection("customerSegments").doc(id));
    await batch.commit();

    await logCoreAudit(actor, actorRole, "SEGMENT_DELETED", `customerSegments/${id}`, { name: segment.name, type: segment.type }, null);

    return { success: true, message: `Segmen '${segment.name}' berhasil dihapus beserta record keanggotaannya.` };
  }

  // ============================================================================
  // MEMBERSHIP MANAGEMENT (STATIC & QUERY)
  // ============================================================================

  async addStaticMember(
    segmentId: string,
    customerUid: string,
    actor: { uid: string; email: string },
    actorRole: string,
    shouldAudit: boolean = true
  ): Promise<CustomerSegmentMembership> {
    const segment = await this.getSegmentById(segmentId);
    if (!segment) throw new Error(`Segmen ${segmentId} tidak ditemukan.`);
    if (segment.type !== "STATIC") {
      throw new Error("Penambahan anggota manual hanya diizinkan untuk segmen bertipe STATIC.");
    }

    // Verify user exists in users collection
    const userDoc = await adminDb.collection("users").doc(customerUid).get();
    if (!userDoc.exists) {
      throw new Error(`Pengguna dengan UID '${customerUid}' tidak ditemukan dalam database.`);
    }

    const membershipId = `${segmentId}_${customerUid}`;
    const memRef = adminDb.collection("customerSegmentMemberships").doc(membershipId);
    const now = new Date().toISOString();

    const membershipData: CustomerSegmentMembership = {
      id: membershipId,
      segmentId,
      customerUid,
      source: "MANUAL",
      status: "ACTIVE",
      evaluatedAt: now,
      createdAt: now,
      updatedAt: now,
      addedBy: actor.email
    };

    await memRef.set(membershipData, { merge: true });
    await this.reconcileSegmentMemberCount(segmentId);

    if (shouldAudit) {
      await logCoreAudit(
        actor,
        actorRole,
        "SEGMENT_MEMBER_ADDED",
        `customerSegmentMemberships/${membershipId}`,
        null,
        { segmentId, customerUid }
      );
    }

    return membershipData;
  }

  async removeStaticMember(
    segmentId: string,
    customerUid: string,
    actor: { uid: string; email: string },
    actorRole: string
  ): Promise<{ success: boolean; message: string }> {
    const segment = await this.getSegmentById(segmentId);
    if (!segment) throw new Error(`Segmen ${segmentId} tidak ditemukan.`);
    if (segment.type !== "STATIC") {
      throw new Error("Penghapusan anggota manual hanya diizinkan untuk segmen bertipe STATIC.");
    }

    const membershipId = `${segmentId}_${customerUid}`;
    const memRef = adminDb.collection("customerSegmentMemberships").doc(membershipId);
    const snap = await memRef.get();

    if (!snap.exists) {
      throw new Error("Anggota tidak ditemukan dalam segmen ini.");
    }

    // Non-destructive update: Set status INACTIVE
    const now = new Date().toISOString();
    await memRef.update({
      status: "INACTIVE",
      updatedAt: now
    });

    await this.reconcileSegmentMemberCount(segmentId);

    await logCoreAudit(
      actor,
      actorRole,
      "SEGMENT_MEMBER_REMOVED",
      `customerSegmentMemberships/${membershipId}`,
      { status: "ACTIVE" },
      { status: "INACTIVE" }
    );

    return { success: true, message: `Pelanggan '${customerUid}' berhasil dikeluarkan dari segmen.` };
  }

  async getSegmentMembers(
    segmentId: string,
    query: { search?: string; status?: 'ACTIVE' | 'INACTIVE' | 'ALL'; page?: number; limit?: number } = {},
    maskPii: boolean = true
  ): Promise<{ items: SegmentMemberView[]; total: number; page: number; limit: number; totalPages: number }> {
    const segment = await this.getSegmentById(segmentId);
    if (!segment) throw new Error(`Segmen ${segmentId} tidak ditemukan.`);

    const { search = "", status = "ACTIVE", page = 1, limit = 20 } = query;

    let dbQuery: FirebaseFirestore.Query = adminDb.collection("customerSegmentMemberships")
      .where("segmentId", "==", segmentId);

    if (status !== "ALL") {
      dbQuery = dbQuery.where("status", "==", status);
    }

    const memSnap = await dbQuery.get();
    const memberships: CustomerSegmentMembership[] = memSnap.docs.map(d => d.data() as CustomerSegmentMembership);

    // Fetch user details for all members
    const userIds = memberships.map(m => m.customerUid);
    const userMap = new Map<string, any>();

    // Batch read users in chunks of 30
    for (let i = 0; i < userIds.length; i += 30) {
      const chunk = userIds.slice(i, i + 30);
      if (chunk.length === 0) continue;
      const uSnap = await adminDb.collection("users").where(FirebaseFirestore.FieldPath.documentId(), "in", chunk).get();
      uSnap.docs.forEach(d => userMap.set(d.id, d.data()));
    }

    // Also get commerce metrics
    const ordersSnap = await adminDb.collection("orders").get();
    const commerceMap = new Map<string, { totalSpentIdr: number; orderCount: number }>();
    for (const d of ordersSnap.docs) {
      const ord = d.data();
      const uid = ord.userId;
      if (!uid) continue;
      let c = commerceMap.get(uid) || { totalSpentIdr: 0, orderCount: 0 };
      c.orderCount += 1;
      if (ord.paymentStatus === "paid" || ord.transactionStatus === "success") {
        c.totalSpentIdr += Number(ord.totalAmount || 0);
      }
      commerceMap.set(uid, c);
    }

    // Assemble views
    let views: SegmentMemberView[] = memberships.map(m => {
      const u = userMap.get(m.customerUid) || {};
      const c = commerceMap.get(m.customerUid) || { totalSpentIdr: 0, orderCount: 0 };
      const rawEmail = u.email || "-";
      const rawPhone = u.phone || u.whatsapp || "-";

      return {
        membership: m,
        customer: {
          uid: m.customerUid,
          name: u.name || u.displayName || rawEmail.split("@")[0] || "Pelanggan",
          email: maskPii ? maskEmail(rawEmail) : rawEmail,
          phone: maskPii ? maskPhone(rawPhone) : rawPhone,
          status: (u.status || "ACTIVE").toString().toUpperCase(),
          role: u.role || "customer",
          tags: Array.isArray(u.tags) ? u.tags : [],
          totalSpentIdr: c.totalSpentIdr,
          orderCount: c.orderCount
        }
      };
    });

    // Filter by search
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      views = views.filter(v => 
        v.customer.uid.toLowerCase().includes(term) ||
        v.customer.name.toLowerCase().includes(term) ||
        v.customer.email.toLowerCase().includes(term) ||
        v.customer.phone.toLowerCase().includes(term)
      );
    }

    // Sort by evaluatedAt desc
    views.sort((a, b) => new Date(b.membership.evaluatedAt).getTime() - new Date(a.membership.evaluatedAt).getTime());

    const total = views.length;
    const startIndex = (page - 1) * limit;
    const items = views.slice(startIndex, startIndex + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  // ============================================================================
  // EVALUATION ENGINE (DYNAMIC SEGMENTS)
  // ============================================================================

  async evaluateSegment(
    segmentId: string,
    actor: { uid: string; email: string },
    actorRole: string,
    _isBackground: boolean = false
  ): Promise<{ qualifiedCount: number; disqualifiedCount: number }> {
    const segRef = adminDb.collection("customerSegments").doc(segmentId);
    
    // Concurrency Lock Check
    const segmentDoc = await segRef.get();
    if (!segmentDoc.exists) throw new Error(`Segmen ${segmentId} tidak ditemukan.`);
    const segment = segmentDoc.data() as CustomerSegment;

    if (segment.type !== "DYNAMIC") {
      throw new Error("Hanya segmen bertipe DYNAMIC yang dapat dievaluasi secara otomatis.");
    }
    if (!segment.ruleGroup) {
      throw new Error("Segmen tidak memiliki ruleGroup.");
    }

    // Check if evaluation already running within last 3 minutes
    if (segment.evaluationStatus === "RUNNING" && segment.lastEvaluatedAt) {
      const leaseAge = Date.now() - new Date(segment.lastEvaluatedAt).getTime();
      if (leaseAge < 3 * 60 * 1000) {
        throw new Error("Evaluasi segmen ini sedang berjalan. Silakan tunggu hingga proses selesai.");
      }
    }

    const startTimestamp = new Date().toISOString();
    await segRef.update({
      evaluationStatus: "RUNNING",
      lastEvaluatedAt: startTimestamp,
      evaluationError: null
    });

    try {
      // 1. Build all customer contexts
      const contexts = await this.buildCustomerContexts();

      // 2. Fetch existing memberships for this segment
      const existingMemSnap = await adminDb.collection("customerSegmentMemberships")
        .where("segmentId", "==", segmentId)
        .get();

      const existingMemMap = new Map<string, CustomerSegmentMembership>();
      existingMemSnap.docs.forEach(d => {
        const data = d.data() as CustomerSegmentMembership;
        existingMemMap.set(data.customerUid, data);
      });

      let qualifiedCount = 0;
      let disqualifiedCount = 0;
      const now = new Date().toISOString();

      // 3. Evaluate each customer and prepare batch writes
      const batch = adminDb.batch();
      let writeCount = 0;

      for (const ctx of contexts) {
        const isQualified = this.evaluateRuleGroup(ctx, segment.ruleGroup);
        const memId = `${segmentId}_${ctx.uid}`;
        const memRef = adminDb.collection("customerSegmentMemberships").doc(memId);
        const existing = existingMemMap.get(ctx.uid);

        if (isQualified) {
          qualifiedCount++;
          if (!existing || existing.status !== "ACTIVE") {
            batch.set(memRef, {
              id: memId,
              segmentId,
              customerUid: ctx.uid,
              source: "DYNAMIC",
              status: "ACTIVE",
              evaluatedAt: now,
              createdAt: existing ? existing.createdAt : now,
              updatedAt: now
            }, { merge: true });
            writeCount++;
          } else {
            // Already active, refresh evaluatedAt
            batch.update(memRef, { evaluatedAt: now, updatedAt: now });
            writeCount++;
          }
        } else {
          if (existing && existing.status === "ACTIVE") {
            disqualifiedCount++;
            batch.update(memRef, {
              status: "INACTIVE",
              evaluatedAt: now,
              updatedAt: now
            });
            writeCount++;
          }
        }
      }

      if (writeCount > 0) {
        await batch.commit();
      }

      // Update segment status to COMPLETED and accurate memberCount
      await segRef.update({
        memberCount: qualifiedCount,
        evaluationStatus: "COMPLETED",
        evaluationError: null,
        lastEvaluatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await logCoreAudit(
        actor,
        actorRole,
        "SEGMENT_EVALUATED",
        `customerSegments/${segmentId}`,
        null,
        { segmentId, qualifiedCount, disqualifiedCount }
      );

      return { qualifiedCount, disqualifiedCount };
    } catch (err: any) {
      console.error(`[Segment Evaluation Failed] Segment ID: ${segmentId}`, err);

      // On failure: DO NOT mass-delete memberships. Keep existing active state and set FAILED
      await segRef.update({
        evaluationStatus: "FAILED",
        evaluationError: err.message || "Gagal melakukan evaluasi aturan segmen.",
        updatedAt: new Date().toISOString()
      });

      await logCoreAudit(
        actor,
        actorRole,
        "SEGMENT_EVALUATION_FAILED",
        `customerSegments/${segmentId}`,
        null,
        { segmentId, error: err.message }
      );

      throw err;
    }
  }

  /**
   * Recalculate and update active member count
   */
  private async reconcileSegmentMemberCount(segmentId: string): Promise<number> {
    const snap = await adminDb.collection("customerSegmentMemberships")
      .where("segmentId", "==", segmentId)
      .where("status", "==", "ACTIVE")
      .get();

    const count = snap.size;
    await adminDb.collection("customerSegments").doc(segmentId).update({
      memberCount: count,
      updatedAt: new Date().toISOString()
    });

    return count;
  }

  // ============================================================================
  // MARKETING CONSUMER API
  // ============================================================================

  /**
   * Check if a customer is currently an ACTIVE member of a segment
   */
  async isCustomerInSegment(customerUid: string, segmentId: string): Promise<boolean> {
    const memId = `${segmentId}_${customerUid}`;
    const snap = await adminDb.collection("customerSegmentMemberships").doc(memId).get();
    if (!snap.exists) return false;
    const mem = snap.data() as CustomerSegmentMembership;
    return mem.status === "ACTIVE";
  }

  /**
   * Get all active segment IDs for a customer
   */
  async getCustomerSegmentIds(customerUid: string): Promise<string[]> {
    const snap = await adminDb.collection("customerSegmentMemberships")
      .where("customerUid", "==", customerUid)
      .where("status", "==", "ACTIVE")
      .get();

    return snap.docs.map(d => (d.data() as CustomerSegmentMembership).segmentId);
  }

  // ============================================================================
  // EXPORT CSV
  // ============================================================================

  async exportSegmentMembersCsv(
    segmentId: string,
    actor: { uid: string; email: string },
    actorRole: string
  ): Promise<string> {
    const segment = await this.getSegmentById(segmentId);
    if (!segment) throw new Error(`Segmen ${segmentId} tidak ditemukan.`);

    const { items } = await this.getSegmentMembers(segmentId, { status: "ACTIVE", limit: 5000 }, false);

    const headers = [
      "User ID",
      "Nama Pelanggan",
      "Email",
      "Nomor Telepon",
      "Status Akun",
      "Peran (Role)",
      "Tags",
      "Total Belanja (IDR)",
      "Total Pesanan",
      "Waktu Bergabung / Evaluasi"
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = items.map(item => [
      escapeCsv(item.customer.uid),
      escapeCsv(item.customer.name),
      escapeCsv(item.customer.email),
      escapeCsv(item.customer.phone),
      escapeCsv(item.customer.status),
      escapeCsv(item.customer.role),
      escapeCsv(item.customer.tags.join(", ")),
      escapeCsv(item.customer.totalSpentIdr),
      escapeCsv(item.customer.orderCount),
      escapeCsv(item.membership.evaluatedAt)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    await logCoreAudit(
      actor,
      actorRole,
      "SEGMENT_MEMBERS_EXPORTED",
      `customerSegments/${segmentId}`,
      null,
      { segmentId, memberCount: items.length }
    );

    return csvContent;
  }
}
