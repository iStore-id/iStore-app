import { adminDb } from "./firebase-admin";
import { logCoreAudit } from "./core-service";
import { AuditLog } from "../types/core";

export interface AuditQueryFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  actorEmail?: string;
  role?: string;
  action?: string;
  module?: string;
  search?: string;
}

export interface AuditQueryResult {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditMetrics {
  totalAudits: number;
  todayCount: number;
  topActors: { email: string; count: number; role: string }[];
  actionCategories: { category: string; count: number }[];
  recentCriticalEvents: AuditLog[];
}

// Deep sanitize any object to ensure secrets are never leaked in audit UI or exports
export function sanitizeAuditData(data: any): any {
  if (!data) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeAuditData(item));
  }

  const sanitized: Record<string, any> = {};
  const sensitiveKeyPatterns = [
    /password/i,
    /secret/i,
    /api_?key/i,
    /server_?key/i,
    /client_?secret/i,
    /access_?token/i,
    /id_?token/i,
    /auth_?token/i,
    /signature_?key/i,
    /pin/i,
    /otp/i,
    /private_?key/i
  ];

  for (const [key, value] of Object.entries(data)) {
    const isSensitive = sensitiveKeyPatterns.some(pattern => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = "[PROTECTED_SECRET]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function queryAuditLogs(filters: AuditQueryFilters): Promise<AuditQueryResult> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(5, filters.limit || 25));

  try {
    // We retrieve auditLogs ordered by timestamp descending
    // Apply bounded memory filtering for high flexibility with multi-field search and string matches
    const snapshot = await adminDb.collection("auditLogs")
      .orderBy("timestamp", "desc")
      .limit(1000) // bounded limit for safety
      .get();

    let allLogs: AuditLog[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        actor: data.actor || { uid: "unknown", email: "system" },
        role: data.role || "system",
        action: data.action || "UNKNOWN_ACTION",
        target: data.target || "-",
        before: sanitizeAuditData(data.before),
        after: sanitizeAuditData(data.after),
        reason: data.reason || "-",
        timestamp: data.timestamp || new Date().toISOString()
      };
    });

    // 1. Filter by startDate
    if (filters.startDate) {
      const startMs = new Date(filters.startDate).getTime();
      allLogs = allLogs.filter(l => new Date(l.timestamp).getTime() >= startMs);
    }

    // 2. Filter by endDate
    if (filters.endDate) {
      const endMs = new Date(filters.endDate).getTime();
      allLogs = allLogs.filter(l => new Date(l.timestamp).getTime() <= endMs);
    }

    // 3. Filter by actorEmail
    if (filters.actorEmail) {
      const targetEmail = filters.actorEmail.toLowerCase().trim();
      allLogs = allLogs.filter(l => (l.actor?.email || "").toLowerCase().includes(targetEmail));
    }

    // 4. Filter by role
    if (filters.role && filters.role !== "ALL") {
      allLogs = allLogs.filter(l => l.role === filters.role);
    }

    // 5. Filter by action
    if (filters.action && filters.action !== "ALL") {
      allLogs = allLogs.filter(l => l.action.toLowerCase().includes(filters.action!.toLowerCase()));
    }

    // 6. Filter by module / resource
    if (filters.module && filters.module !== "ALL") {
      const mod = filters.module.toLowerCase();
      allLogs = allLogs.filter(l => {
        const targetLower = (l.target || "").toLowerCase();
        const actionLower = l.action.toLowerCase();
        if (mod === "system") return targetLower.includes("systemconfig") || targetLower.includes("role") || targetLower.includes("user") || actionLower.includes("role") || actionLower.includes("security");
        if (mod === "finance") return targetLower.includes("settlement") || targetLower.includes("refund") || targetLower.includes("payment") || targetLower.includes("ledger") || actionLower.includes("refund") || actionLower.includes("settlement");
        if (mod === "commerce") return targetLower.includes("order") || targetLower.includes("product") || targetLower.includes("game") || targetLower.includes("pricing") || targetLower.includes("voucher") || actionLower.includes("product");
        if (mod === "marketing") return targetLower.includes("banner") || targetLower.includes("campaign") || targetLower.includes("popup") || targetLower.includes("seo") || targetLower.includes("blog") || targetLower.includes("landing");
        if (mod === "settings") return targetLower.includes("storeconfig") || targetLower.includes("setting") || targetLower.includes("regional") || targetLower.includes("privacy");
        return targetLower.includes(mod);
      });
    }

    // 7. General search term
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      allLogs = allLogs.filter(l =>
        (l.id || "").toLowerCase().includes(q) ||
        (l.action || "").toLowerCase().includes(q) ||
        (l.target || "").toLowerCase().includes(q) ||
        (l.reason || "").toLowerCase().includes(q) ||
        (l.actor?.email || "").toLowerCase().includes(q) ||
        (l.role || "").toLowerCase().includes(q)
      );
    }

    const total = allLogs.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedLogs = allLogs.slice(startIndex, startIndex + limit);

    return {
      logs: paginatedLogs,
      total,
      page,
      limit,
      totalPages
    };
  } catch (error) {
    console.error("[Audit Service Error] queryAuditLogs:", error);
    throw error;
  }
}

export async function getAuditMetrics(): Promise<AuditMetrics> {
  try {
    const snapshot = await adminDb.collection("auditLogs")
      .orderBy("timestamp", "desc")
      .limit(500)
      .get();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let todayCount = 0;
    const actorCountMap = new Map<string, { email: string; count: number; role: string }>();
    const categoryCountMap = new Map<string, number>();

    const logs: AuditLog[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        actor: data.actor || { uid: "unknown", email: "system" },
        role: data.role || "system",
        action: data.action || "UNKNOWN",
        target: data.target || "-",
        before: sanitizeAuditData(data.before),
        after: sanitizeAuditData(data.after),
        reason: data.reason || "-",
        timestamp: data.timestamp || new Date().toISOString()
      };
    });

    logs.forEach(l => {
      const logTime = new Date(l.timestamp).getTime();
      if (logTime >= startOfToday) {
        todayCount++;
      }

      // Actor aggregation
      const email = l.actor?.email || "system";
      const existing = actorCountMap.get(email) || { email, count: 0, role: l.role };
      existing.count++;
      actorCountMap.set(email, existing);

      // Category breakdown
      const act = l.action.toUpperCase();
      let cat = "GENERAL";
      if (act.includes("ROLE") || act.includes("SECURITY") || act.includes("CONFIG") || act.includes("USER")) cat = "SYSTEM";
      else if (act.includes("REFUND") || act.includes("SETTLEMENT") || act.includes("PAYMENT") || act.includes("LEDGER")) cat = "FINANCE";
      else if (act.includes("ORDER") || act.includes("PRODUCT") || act.includes("GAME") || act.includes("PRICING")) cat = "COMMERCE";
      else if (act.includes("BANNER") || act.includes("BLOG") || act.includes("SEO") || act.includes("CAMPAIGN")) cat = "MARKETING";
      else if (act.includes("STORE") || act.includes("REGIONAL") || act.includes("PRIVACY")) cat = "SETTINGS";

      categoryCountMap.set(cat, (categoryCountMap.get(cat) || 0) + 1);
    });

    const topActors = Array.from(actorCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const actionCategories = Array.from(categoryCountMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const recentCriticalEvents = logs
      .filter(l => 
        l.action.includes("ROLE") || 
        l.action.includes("SECURITY") || 
        l.action.includes("REFUND") || 
        l.action.includes("CONFIG") ||
        l.action.includes("DELETE")
      )
      .slice(0, 5);

    return {
      totalAudits: logs.length,
      todayCount,
      topActors,
      actionCategories,
      recentCriticalEvents
    };
  } catch (error) {
    console.error("[Audit Service Error] getAuditMetrics:", error);
    return {
      totalAudits: 0,
      todayCount: 0,
      topActors: [],
      actionCategories: [],
      recentCriticalEvents: []
    };
  }
}
