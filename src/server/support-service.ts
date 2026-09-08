import { adminDb } from "./firebase-admin";
import { SupportCase, Support360 } from "../types/support";
import { CustomerService } from "./customer-service";
import { processCheckout } from "./order-engine"; // We don't need OrderEngine class, we'll fetch from adminDb
import { MembershipService } from "./membership-service";
import { LoyaltyService } from "./loyalty-service";
import { ReferralService } from "./referral-service";
import { SLAService } from "./sla-service";

export class SupportService {
  private static instance: SupportService;
  private customerService = CustomerService.getInstance();
  // OrderEngine is functions, so we just use adminDb here for details
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

  async getSupport360(caseId: string): Promise<any> {
    const caseSnap = await adminDb.collection("supportCases").doc(caseId).get();
    if (!caseSnap.exists) throw new Error("Support case not found");
    const caseData = { id: caseSnap.id, ...caseSnap.data() } as SupportCase;

    // Fetch context in parallel
    const [customer, orderSnap, membership, loyalty, referral, previousCases, slaPolicies, messagesSnap] = await Promise.all([
      this.customerService.getCustomerById(caseData.customerUid),
      caseData.orderId ? adminDb.collection("orders").doc(caseData.orderId).get() : Promise.resolve(null),
      this.membershipService.getCustomerMembership(caseData.customerUid),
      this.loyaltyService.getBalance(caseData.customerUid),
      this.referralService.getReferralStatus(caseData.customerUid),
      this.getPreviousCases(caseData.customerUid, caseData.id),
      this.slaService.getPolicies(),
      adminDb.collection("messages").where("caseId", "==", caseId).orderBy("createdAt", "asc").get()
    ]);

    const order = orderSnap && orderSnap.exists ? { id: orderSnap.id, ...orderSnap.data() } : null;
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
    const snap = await adminDb.collection("supportCases")
      .where("customerUid", "==", customerUid)
      .limit(10)
      .get();
    
    return snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as SupportCase))
      .filter(c => c.id !== currentCaseId);
  }

  async getAdminQueue(filters: { status?: string, priority?: string, category?: string, assignedTo?: string } = {}): Promise<SupportCase[]> {
    let query: any = adminDb.collection("supportCases").orderBy("updatedAt", "desc");

    if (filters.status) query = query.where("status", "==", filters.status);
    if (filters.priority) query = query.where("priority", "==", filters.priority);
    if (filters.category) query = query.where("category", "==", filters.category);
    if (filters.assignedTo) query = query.where("assignedTo", "==", filters.assignedTo);

    const snap = await query.limit(100).get();
    return snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as SupportCase));
  }

  async getCustomerCases(customerUid: string): Promise<SupportCase[]> {
    const snap = await adminDb.collection("supportCases")
      .where("customerUid", "==", customerUid)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportCase));
  }
}
