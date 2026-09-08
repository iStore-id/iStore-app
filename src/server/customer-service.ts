import { adminDb } from "./firebase-admin";
import { 
  CustomerUser, 
  CustomerStatus, 
  CustomerDirectoryQuery, 
  CustomerDirectoryResponse, 
  Customer360Profile, 
  CustomerCommerceSummary, 
  CustomerLoyaltySummary,
  CustomerNote 
} from "../types/customer";
import { logCoreAudit } from "./core-service";
import { LoyaltyService } from "./loyalty-service";

export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "-";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  if (name.length <= 2) {
    return `${name.charAt(0)}***@${domain}`;
  }
  return `${name.substring(0, 2)}***${name.charAt(name.length - 1)}@${domain}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== "string") return "-";
  const cleaned = phone.replace(/\s+/g, "");
  if (cleaned.length <= 6) return cleaned;
  const start = cleaned.substring(0, 4);
  const end = cleaned.substring(cleaned.length - 3);
  return `${start}****${end}`;
}

export class CustomerService {
  private static instance: CustomerService;
  private loyaltyService: LoyaltyService;
  private metricsCache: {
    data: any;
    timestamp: number;
  } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.loyaltyService = LoyaltyService.getInstance();
  }

  public static getInstance(): CustomerService {
    if (!CustomerService.instance) {
      CustomerService.instance = new CustomerService();
    }
    return CustomerService.instance;
  }

  /**
   * Helper to fetch orders for multiple user IDs in chunks of 30 (Firestore limit for 'in' query is 30)
   */
  private async fetchOrdersForUserIds(uids: string[]): Promise<any[]> {
    if (!uids || uids.length === 0) return [];
    
    // Chunk array into max 30 elements
    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += 30) {
      chunks.push(uids.slice(i, i + 30));
    }

    // Fetch chunks in parallel
    const queryPromises = chunks.map(chunk => 
      adminDb.collection("orders")
        .where("userId", "in", chunk)
        .get()
    );

    const snapshots = await Promise.all(queryPromises);
    const allOrders: any[] = [];
    const seenOrderIds = new Set<string>();

    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        if (!seenOrderIds.has(doc.id)) {
          seenOrderIds.add(doc.id);
          allOrders.push(doc.data());
        }
      }
    }

    return allOrders;
  }

  /**
   * Helper to normalize user document from Firestore
   */
  public normalizeUser(docId: string, data: any): CustomerUser {
    const rawStatus = (data.status || "ACTIVE").toString().toUpperCase();
    const status: CustomerStatus = 
      rawStatus === "SUSPENDED" ? "SUSPENDED" :
      rawStatus === "DISABLED" || rawStatus === "INACTIVE" ? "DISABLED" : "ACTIVE";

    return {
      uid: docId,
      email: data.email || "",
      name: data.name || data.displayName || data.email?.split("@")[0] || "Pelanggan",
      displayName: data.displayName || data.name || data.email?.split("@")[0] || "Pelanggan",
      phone: data.phone || data.whatsapp || "",
      role: data.role || "customer",
      status: status,
      suspendReason: data.suspendReason || "",
      suspendedAt: data.suspendedAt || null,
      suspendedBy: data.suspendedBy || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      notes: Array.isArray(data.notes) ? data.notes : [],
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
      lastLogin: data.lastLogin || null,
      metadata: data.metadata || {}
    };
  }

  async getCustomerById(uid: string): Promise<CustomerUser | null> {
    const doc = await adminDb.collection("users").doc(uid).get();
    if (!doc.exists) return null;
    return this.normalizeUser(doc.id, doc.data());
  }

  /**
   * Get Customer Directory with searching, filtering, sorting and commerce aggregations
   */
  async getCustomerDirectory(query: CustomerDirectoryQuery, maskPii: boolean = true): Promise<CustomerDirectoryResponse> {
    const {
      search = "",
      status = "ALL",
      role = "ALL",
      tag = "ALL",
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      cursor = ""
    } = query;

    const safeLimit = Math.max(1, Math.min(5000, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);

    const hasSearch = !!search.trim();
    const activeFilterCount = (status !== "ALL" ? 1 : 0) + (role !== "ALL" ? 1 : 0) + (tag !== "ALL" ? 1 : 0);
    const isNativeQuery = !hasSearch && sortBy !== "totalSpent" && (
      activeFilterCount === 0 || (activeFilterCount === 1 && sortBy === "createdAt")
    );

    let paginatedItems: any[] = [];
    let total = 0;
    let allUsersCountForMetrics = 0;
    let activeCount = 0;
    let suspendedCount = 0;
    let disabledCount = 0;
    let totalCustomerLtvIdr = 0;
    let nextCursor: string | undefined = undefined;

    let activePage = safePage;
    let activeCursor = cursor;

    if (isNativeQuery && activePage > 1 && !activeCursor) {
      activePage = 1;
    }

    // Load global metrics using 5-minute TTL cache
    const now = Date.now();
    if (this.metricsCache && (now - this.metricsCache.timestamp < this.CACHE_TTL_MS)) {
      const cache = this.metricsCache.data;
      allUsersCountForMetrics = cache.totalCustomers;
      activeCount = cache.activeCount;
      suspendedCount = cache.suspendedCount;
      disabledCount = cache.disabledCount;
      totalCustomerLtvIdr = cache.totalCustomerLtvIdr;
    } else {
      const [
        totalCustSnap,
        activeSnap,
        suspendedSnap,
        disabledSnap
      ] = await Promise.all([
        adminDb.collection("users").count().get(),
        adminDb.collection("users").where("status", "==", "ACTIVE").count().get(),
        adminDb.collection("users").where("status", "==", "SUSPENDED").count().get(),
        adminDb.collection("users").where("status", "in", ["DISABLED", "INACTIVE"]).count().get(),
      ]);

      allUsersCountForMetrics = totalCustSnap.data().count;
      activeCount = activeSnap.data().count;
      suspendedCount = suspendedSnap.data().count;
      disabledCount = disabledSnap.data().count;

      // Sum paid orders in background or light query
      const paidOrdersSnap = await adminDb.collection("orders")
        .where("paymentStatus", "==", "paid")
        .select("totalAmount")
        .get();
      
      totalCustomerLtvIdr = 0;
      for (const doc of paidOrdersSnap.docs) {
        totalCustomerLtvIdr += Number(doc.data().totalAmount || 0);
      }

      this.metricsCache = {
        timestamp: now,
        data: {
          totalCustomers: allUsersCountForMetrics,
          activeCount,
          suspendedCount,
          disabledCount,
          totalCustomerLtvIdr
        }
      };
    }

    if (isNativeQuery) {
      // 1. Construct base query with optional single filter
      let usersQuery: FirebaseFirestore.Query = adminDb.collection("users");
      if (status !== "ALL") {
        usersQuery = usersQuery.where("status", "==", status);
      } else if (role !== "ALL") {
        usersQuery = usersQuery.where("role", "==", role);
      } else if (tag !== "ALL") {
        usersQuery = usersQuery.where("tags", "array-contains", tag);
      }

      // Get total users matching query natively
      const countSnap = await usersQuery.count().get();
      total = countSnap.data().count;

      // 2. Apply ordering
      if (sortBy === "name") {
        usersQuery = usersQuery.orderBy("name", sortOrder);
      } else if (sortBy === "lastLogin") {
        usersQuery = usersQuery.orderBy("lastLogin", sortOrder);
      } else {
        usersQuery = usersQuery.orderBy("createdAt", sortOrder);
      }

      if (activePage > 1 && activeCursor) {
        const cursorDocSnap = await adminDb.collection("users").doc(activeCursor).get();
        if (cursorDocSnap.exists) {
          usersQuery = usersQuery.startAfter(cursorDocSnap);
        } else {
          activePage = 1;
        }
      }

      const usersSnap = await usersQuery.limit(safeLimit).get();
      const paginatedUsers = usersSnap.docs.map(doc => this.normalizeUser(doc.id, doc.data()));

      if (paginatedUsers.length > 0) {
        nextCursor = paginatedUsers[paginatedUsers.length - 1].uid;
      }

      // 3. Query orders only for these specific users in chunks of 30
      const userCommerceMap = new Map<string, { orderCount: number; totalSpentIdr: number }>();
      const uids = paginatedUsers.map(u => u.uid);

      if (uids.length > 0) {
        const ordersList = await this.fetchOrdersForUserIds(uids);

        for (const order of ordersList) {
          const userId = order.userId;
          if (!userId) continue;

          const isPaid = order.paymentStatus === "paid" || order.transactionStatus === "success";
          const amount = Number(order.totalAmount || 0);

          const current = userCommerceMap.get(userId) || { orderCount: 0, totalSpentIdr: 0 };
          current.orderCount += 1;
          if (isPaid) {
            current.totalSpentIdr += amount;
          }
          userCommerceMap.set(userId, current);
        }
      }

      paginatedItems = paginatedUsers.map(u => {
        const commerce = userCommerceMap.get(u.uid) || { orderCount: 0, totalSpentIdr: 0 };
        return {
          ...u,
          email: maskPii ? maskEmail(u.email) : u.email,
          phone: maskPii ? maskPhone(u.phone) : u.phone,
          orderCount: commerce.orderCount,
          totalSpentIdr: commerce.totalSpentIdr
        };
      });
    } else {
      // Fallback: Full scan of users (identik dengan implementasi lama agar aman dari index mismatch/search), tapi ORDERS TETAP OPTIMAL!
      const usersSnap = await adminDb.collection("users").get();
      let allUsers: CustomerUser[] = usersSnap.docs.map(doc => this.normalizeUser(doc.id, doc.data()));

      // Filter users
      let filtered = allUsers.filter(u => {
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          const matchesUid = u.uid.toLowerCase().includes(term);
          const matchesEmail = u.email.toLowerCase().includes(term);
          const matchesName = (u.name || "").toLowerCase().includes(term);
          const matchesPhone = (u.phone || "").toLowerCase().includes(term);
          if (!matchesUid && !matchesEmail && !matchesName && !matchesPhone) {
            return false;
          }
        }

        if (status && status !== "ALL") {
          if (u.status !== status.toUpperCase()) return false;
        }

        if (role && role !== "ALL") {
          if (u.role !== role.toLowerCase()) return false;
        }

        if (tag && tag !== "ALL") {
          if (!u.tags || !u.tags.includes(tag.toUpperCase())) return false;
        }

        return true;
      });

      const userCommerceMap = new Map<string, { orderCount: number; totalSpentIdr: number }>();

      // Jika sorting by "totalSpent" diaktifkan:
      // Karena kita memerlukan totalSpent global dari users ter-filter untuk diurutkan secara presisi,
      // kita harus mengambil orders untuk SELURUH filtered users ini (tetap menggunakan chunked query ID untuk mencegah full scan seluruh isi database orders).
      if (sortBy === "totalSpent") {
        const filteredUids = filtered.map(u => u.uid);
        if (filteredUids.length > 0) {
          const ordersList = await this.fetchOrdersForUserIds(filteredUids);
          for (const order of ordersList) {
            const userId = order.userId;
            if (!userId) continue;

            const isPaid = order.paymentStatus === "paid" || order.transactionStatus === "success";
            const amount = Number(order.totalAmount || 0);

            const current = userCommerceMap.get(userId) || { orderCount: 0, totalSpentIdr: 0 };
            current.orderCount += 1;
            if (isPaid) {
              current.totalSpentIdr += amount;
            }
            userCommerceMap.set(userId, current);
          }
        }

        // Attach commerce metrics
        const enriched = filtered.map(u => {
          const commerce = userCommerceMap.get(u.uid) || { orderCount: 0, totalSpentIdr: 0 };
          return {
            ...u,
            email: maskPii ? maskEmail(u.email) : u.email,
            phone: maskPii ? maskPhone(u.phone) : u.phone,
            orderCount: commerce.orderCount,
            totalSpentIdr: commerce.totalSpentIdr
          };
        });

        // Urutkan berdasarkan totalSpent
        enriched.sort((a, b) => {
          const valA = a.totalSpentIdr || 0;
          const valB = b.totalSpentIdr || 0;
          return sortOrder === "asc" ? valA - valB : valB - valA;
        });

        total = enriched.length;
        const startIndex = (safePage - 1) * safeLimit;
        paginatedItems = enriched.slice(startIndex, startIndex + safeLimit);
      } else {
        // Jika sorting BUKAN by "totalSpent" (misal: createdAt, name, lastLogin):
        // Kita bisa melakukan sorting dan pagination TERLEBIH DAHULU pada data users, baru mengambil orders hanya untuk users yang masuk halaman aktif tersebut!
        filtered.sort((a, b) => {
          let valA: any;
          let valB: any;

          if (sortBy === "name") {
            valA = (a.name || "").toLowerCase();
            valB = (b.name || "").toLowerCase();
          } else if (sortBy === "lastLogin") {
            valA = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
            valB = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
          } else {
            valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          }

          if (sortOrder === "asc") {
            return valA > valB ? 1 : valA < valB ? -1 : 0;
          } else {
            return valA < valB ? 1 : valA > valB ? -1 : 0;
          }
        });

        total = filtered.length;
        const startIndex = (safePage - 1) * safeLimit;
        const paginatedUsersCandidates = filtered.slice(startIndex, startIndex + safeLimit);

        // Ambil orders HANYA untuk users halaman ini menggunakan chunked ID helper
        const candidateUids = paginatedUsersCandidates.map(u => u.uid);
        if (candidateUids.length > 0) {
          const ordersList = await this.fetchOrdersForUserIds(candidateUids);
          for (const order of ordersList) {
            const userId = order.userId;
            if (!userId) continue;

            const isPaid = order.paymentStatus === "paid" || order.transactionStatus === "success";
            const amount = Number(order.totalAmount || 0);

            const current = userCommerceMap.get(userId) || { orderCount: 0, totalSpentIdr: 0 };
            current.orderCount += 1;
            if (isPaid) {
              current.totalSpentIdr += amount;
            }
            userCommerceMap.set(userId, current);
          }
        }

        paginatedItems = paginatedUsersCandidates.map(u => {
          const commerce = userCommerceMap.get(u.uid) || { orderCount: 0, totalSpentIdr: 0 };
          return {
            ...u,
            email: maskPii ? maskEmail(u.email) : u.email,
            phone: maskPii ? maskPhone(u.phone) : u.phone,
            orderCount: commerce.orderCount,
            totalSpentIdr: commerce.totalSpentIdr
          };
        });
      }
    }

    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      items: paginatedItems,
      total,
      page: activePage,
      limit: safeLimit,
      totalPages,
      metrics: {
        totalCustomers: allUsersCountForMetrics,
        activeCount,
        suspendedCount,
        disabledCount,
        totalCustomerLtvIdr
      },
      nextCursor
    };
  }

  /**
   * Get Customer 360° Profile Detail (Identity, Commerce, Loyalty, Audit Trail)
   */
  async getCustomer360Profile(
    customerId: string, 
    actor: { uid: string; email: string }, 
    actorRole: string,
    maskPii: boolean = true
  ): Promise<Customer360Profile> {
    const userDoc = await adminDb.collection("users").doc(customerId).get();
    if (!userDoc.exists) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    const customer = this.normalizeUser(userDoc.id, userDoc.data());

    // 1. Fetch Orders for this Customer
    const ordersSnap = await adminDb.collection("orders")
      .where("userId", "==", customerId)
      .get();

    let totalOrders = ordersSnap.size;
    let paidOrdersCount = 0;
    let pendingOrdersCount = 0;
    let failedOrdersCount = 0;
    let totalSpentIdr = 0;
    let totalRefundedIdr = 0;
    let firstOrderDate: string | null = null;
    let lastOrderDate: string | null = null;

    const allOrdersList: any[] = [];

    for (const doc of ordersSnap.docs) {
      const o = doc.data();
      const createdAt = o.createdAt || "";
      const isPaid = o.paymentStatus === "paid" || o.transactionStatus === "success";
      const isRefunded = o.paymentStatus === "refunded" || o.transactionStatus === "refunded";
      const isPending = o.paymentStatus === "pending" || o.transactionStatus === "pending";
      const isFailed = o.paymentStatus === "failed" || o.paymentStatus === "expired" || o.transactionStatus === "failed";

      const amount = Number(o.totalAmount || 0);

      if (isPaid) {
        paidOrdersCount++;
        totalSpentIdr += amount;
      } else if (isPending) {
        pendingOrdersCount++;
      } else if (isFailed) {
        failedOrdersCount++;
      }

      if (isRefunded) {
        totalRefundedIdr += amount;
      }

      if (createdAt) {
        if (!firstOrderDate || createdAt < firstOrderDate) {
          firstOrderDate = createdAt;
        }
        if (!lastOrderDate || createdAt > lastOrderDate) {
          lastOrderDate = createdAt;
        }
      }

      allOrdersList.push({
        id: doc.id,
        invoice: o.invoice || doc.id,
        productName: o.productName || "Digital Product",
        variantName: o.variantName || "",
        totalAmount: amount,
        paymentStatus: o.paymentStatus || "pending",
        transactionStatus: o.transactionStatus || "pending",
        createdAt: createdAt
      });
    }

    // Sort recent orders descending
    allOrdersList.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    const recentOrders = allOrdersList.slice(0, 10);
    const averageOrderValueIdr = paidOrdersCount > 0 ? Math.round(totalSpentIdr / paidOrdersCount) : 0;

    const commerce: CustomerCommerceSummary = {
      totalOrders,
      paidOrdersCount,
      pendingOrdersCount,
      failedOrdersCount,
      totalSpentIdr,
      totalRefundedIdr,
      averageOrderValueIdr,
      firstOrderDate,
      lastOrderDate,
      recentOrders
    };

    // 2. Fetch Loyalty Data
    let pointsBalance = 0;
    let totalEarnedPoints = 0;
    let totalRedeemedPoints = 0;
    const recentTransactions: any[] = [];

    try {
      pointsBalance = await this.loyaltyService.getCustomerBalance(customerId);
      const pointsSnap = await adminDb.collection("pointTransactions")
        .where("customerId", "==", customerId)
        .get();

      for (const doc of pointsSnap.docs) {
        const tx = doc.data();
        const pts = Number(tx.points || 0);
        if (pts > 0) totalEarnedPoints += pts;
        else if (pts < 0) totalRedeemedPoints += Math.abs(pts);

        recentTransactions.push({
          id: doc.id,
          type: tx.type || "EARN",
          points: pts,
          reference: tx.reference || "",
          createdAt: tx.createdAt || new Date().toISOString(),
          reason: tx.reason || ""
        });
      }
      recentTransactions.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    } catch (err) {
      console.warn(`[CustomerService] Loyalty fetch error for ${customerId}:`, err);
    }

    const loyalty: CustomerLoyaltySummary = {
      pointsBalance,
      totalEarnedPoints,
      totalRedeemedPoints,
      recentTransactions: recentTransactions.slice(0, 10)
    };

    // 3. Fetch Audit Trail logs for this customer
    const auditLogsSnap = await adminDb.collection("auditLogs")
      .where("target", "==", `users/${customerId}`)
      .limit(20)
      .get();

    const auditTrail = auditLogsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        action: d.action || "UPDATE",
        role: d.role || "admin",
        actorEmail: d.actor?.email || d.actorEmail || "system",
        timestamp: d.timestamp || d.createdAt || new Date().toISOString(),
        reason: d.reason || "",
        before: d.before || null,
        after: d.after || null
      };
    });

    auditTrail.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

    return {
      customer: {
        ...customer,
        email: maskPii ? maskEmail(customer.email) : customer.email,
        phone: maskPii ? maskPhone(customer.phone) : customer.phone
      },
      commerce,
      loyalty,
      auditTrail
    };
  }

  /**
   * Update Customer Account Lifecycle Status (ACTIVE, SUSPENDED, DISABLED)
   */
  async updateCustomerStatus(
    customerId: string, 
    newStatus: CustomerStatus, 
    reason: string, 
    actor: { uid: string; email: string }, 
    actorRole: string
  ): Promise<CustomerUser> {
    const userRef = adminDb.collection("users").doc(customerId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    const currentData = userDoc.data()!;
    const currentEmail = (currentData.email || "").toLowerCase();
    const currentRole = currentData.role || "customer";

    // Owner protection guard
    if (currentEmail === "chokerbayu@gmail.com" || currentRole === "pemilik") {
      throw new Error("Cannot change or suspend the Owner account");
    }

    if (!reason || !reason.trim()) {
      throw new Error("Reason for status change is mandatory");
    }

    const validStatuses: CustomerStatus[] = ["ACTIVE", "SUSPENDED", "DISABLED"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid customer status: ${newStatus}`);
    }

    const now = new Date().toISOString();
    const updates: Partial<any> = {
      status: newStatus,
      updatedAt: now
    };

    if (newStatus === "SUSPENDED" || newStatus === "DISABLED") {
      updates.suspendReason = reason.trim();
      updates.suspendedAt = now;
      updates.suspendedBy = actor.email;
    } else if (newStatus === "ACTIVE") {
      updates.suspendReason = "";
      updates.suspendedAt = null;
      updates.suspendedBy = null;
    }

    await userRef.update(updates);

    const oldStatus = currentData.status || "ACTIVE";
    await logCoreAudit(
      actor,
      actorRole,
      "CUSTOMER_STATUS_CHANGED",
      `users/${customerId}`,
      { status: oldStatus, suspendReason: currentData.suspendReason || null },
      { status: newStatus, suspendReason: updates.suspendReason || null },
      reason.trim()
    );

    const updatedDoc = await userRef.get();
    return this.normalizeUser(updatedDoc.id, updatedDoc.data());
  }

  /**
   * Add an internal note to customer account
   */
  async addCustomerNote(
    customerId: string, 
    noteText: string, 
    actor: { uid: string; email: string }, 
    actorRole: string
  ): Promise<CustomerNote> {
    const userRef = adminDb.collection("users").doc(customerId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    if (!noteText || !noteText.trim()) {
      throw new Error("Note content cannot be empty");
    }

    const existingNotes: CustomerNote[] = Array.isArray(userDoc.data()?.notes) ? userDoc.data()?.notes : [];
    const newNote: CustomerNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      note: noteText.trim(),
      authorUid: actor.uid,
      authorEmail: actor.email,
      createdAt: new Date().toISOString()
    };

    const updatedNotes = [newNote, ...existingNotes];
    await userRef.update({
      notes: updatedNotes,
      updatedAt: new Date().toISOString()
    });

    await logCoreAudit(
      actor,
      actorRole,
      "CUSTOMER_NOTE_ADDED",
      `users/${customerId}`,
      null,
      newNote,
      `Added internal customer note`
    );

    return newNote;
  }

  /**
   * Update Customer Tags
   */
  async updateCustomerTags(
    customerId: string, 
    tags: string[], 
    actor: { uid: string; email: string }, 
    actorRole: string
  ): Promise<string[]> {
    const userRef = adminDb.collection("users").doc(customerId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    const currentTags = Array.isArray(userDoc.data()?.tags) ? userDoc.data()?.tags : [];
    const normalizedTags = Array.from(new Set(tags.map(t => t.trim().toUpperCase()).filter(Boolean)));

    await userRef.update({
      tags: normalizedTags,
      updatedAt: new Date().toISOString()
    });

    await logCoreAudit(
      actor,
      actorRole,
      "CUSTOMER_TAGS_UPDATED",
      `users/${customerId}`,
      { tags: currentTags },
      { tags: normalizedTags },
      "Updated customer tags"
    );

    return normalizedTags;
  }

  /**
   * Unmask Customer PII (Audit Logged)
   */
  async unmaskCustomerPii(
    customerId: string, 
    actor: { uid: string; email: string }, 
    actorRole: string
  ): Promise<{ uid: string; email: string; phone: string; name: string }> {
    const userDoc = await adminDb.collection("users").doc(customerId).get();
    if (!userDoc.exists) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    const data = userDoc.data()!;
    
    // Log audit for PII unmasking
    await logCoreAudit(
      actor,
      actorRole,
      "CUSTOMER_PII_UNMASKED",
      `users/${customerId}`,
      null,
      { unmaskedUid: customerId },
      "Admin requested unmasked customer PII data"
    );

    return {
      uid: userDoc.id,
      email: data.email || "",
      phone: data.phone || data.whatsapp || "",
      name: data.name || data.displayName || ""
    };
  }

  /**
   * Export Customer Directory to CSV
   */
  async exportCustomersCsv(
    query: CustomerDirectoryQuery, 
    actor: { uid: string; email: string }, 
    actorRole: string
  ): Promise<string> {
    const directory = await this.getCustomerDirectory({ ...query, limit: 5000, page: 1 }, false);
    
    // Headers
    const headers = [
      "User ID",
      "Nama",
      "Email",
      "Nomor Telepon",
      "Peran (Role)",
      "Status",
      "Total Pesanan",
      "Total Belanja (IDR)",
      "Tags",
      "Tanggal Daftar",
      "Login Terakhir"
    ];

    const rows = directory.items.map(u => [
      `"${u.uid}"`,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      `"${(u.phone || '').replace(/"/g, '""')}"`,
      `"${u.role}"`,
      `"${u.status}"`,
      u.orderCount || 0,
      u.totalSpentIdr || 0,
      `"${(u.tags || []).join(', ')}"`,
      `"${u.createdAt || ''}"`,
      `"${u.lastLogin || ''}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    await logCoreAudit(
      actor,
      actorRole,
      "CUSTOMER_DIRECTORY_EXPORTED",
      "users",
      null,
      { filterQuery: query, recordCount: directory.items.length },
      "Exported customer directory to CSV"
    );

    return csvContent;
  }
}
