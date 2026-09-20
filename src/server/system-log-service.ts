import { SystemLog, SystemLogLevel, SystemLogCategory } from "../types/core";
import { logCoreAudit } from "./core-service";
import { SystemLogRepository } from "./supabase/system-log-repository";

export interface SystemLogQueryFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  level?: SystemLogLevel | "ALL";
  category?: SystemLogCategory | "ALL";
  service?: string;
  event?: string;
  provider?: string;
  outcome?: string;
  search?: string;
  orderId?: string;
  jobId?: string;
  correlationId?: string;
  requestId?: string;
}

export interface SystemLogQueryResult {
  logs: SystemLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SystemLogMetrics {
  totalLogs: number;
  todayCount: number;
  errorCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  errorRatePercentage: number;
  categoryDistribution: { category: string; count: number }[];
  levelDistribution: { level: string; count: number }[];
  topFailingServices: { service: string; count: number }[];
  recentCriticalEvents: SystemLog[];
}

// Deep sanitize any metadata to ensure secrets or sensitive PII are never leaked
export function sanitizeSystemLogMetadata(data: any): any {
  if (!data) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeSystemLogMetadata(item));
  }

  const sanitized: Record<string, any> = {};
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /api_?key/i,
    /server_?key/i,
    /client_?secret/i,
    /access_?token/i,
    /id_?token/i,
    /auth_?token/i,
    /signature_?key/i,
    /bearer/i,
    /pin/i,
    /otp/i,
    /private_?key/i,
    /card_?number/i,
    /cvv/i
  ];

  for (const [key, value] of Object.entries(data)) {
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = "[PROTECTED_SECRET]";
    } else if (typeof value === "string") {
      // Mask full authorization headers if present
      if (value.toLowerCase().startsWith("bearer ")) {
        sanitized[key] = "Bearer [PROTECTED_TOKEN]";
      } else {
        sanitized[key] = value;
      }
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeSystemLogMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// In-memory circular buffer for fast access and fallback
const RECENT_BUFFER_SIZE = 500;
const memoryLogBuffer: SystemLog[] = [];

export async function logSystem(
  level: SystemLogLevel,
  category: SystemLogCategory,
  event: string,
  message: string,
  service: string,
  options: {
    requestId?: string;
    correlationId?: string;
    orderId?: string;
    jobId?: string;
    provider?: string;
    httpStatus?: number;
    durationMs?: number;
    retryCount?: number;
    outcome?: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'BLOCKED' | 'WARNING';
    stackTrace?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<string> {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = options.metadata ? sanitizeSystemLogMetadata(options.metadata) : undefined;
  
  // Sanitize stack trace if present
  let safeStack = options.stackTrace;
  if (safeStack && typeof safeStack === "string") {
    // Remove environment variable lines or bearer strings from stack traces
    safeStack = safeStack.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [PROTECTED]");
  }

  const logEntry: SystemLog = {
    timestamp,
    level,
    category,
    event: event.toUpperCase(),
    message,
    service,
    requestId: options.requestId,
    correlationId: options.correlationId,
    orderId: options.orderId,
    jobId: options.jobId,
    provider: options.provider,
    httpStatus: options.httpStatus,
    durationMs: options.durationMs,
    retryCount: options.retryCount,
    outcome: options.outcome || (level === "ERROR" || level === "CRITICAL" ? "FAILURE" : "SUCCESS"),
    stackTrace: safeStack,
    metadata: sanitizedMeta
  };

  // Push to memory buffer
  memoryLogBuffer.unshift(logEntry);
  if (memoryLogBuffer.length > RECENT_BUFFER_SIZE) {
    memoryLogBuffer.pop();
  }

  try {
    const id = await SystemLogRepository.getInstance().createLog(logEntry);
    logEntry.id = id;
    return id;
  } catch (err) {
    return "mem_" + Date.now();
  }
}

export async function querySystemLogs(filters: SystemLogQueryFilters): Promise<SystemLogQueryResult> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(5, filters.limit || 25));

  try {
    let logs: SystemLog[] = await SystemLogRepository.getInstance().queryLogs(1000);

    if (!logs || logs.length === 0) {
      logs = [...memoryLogBuffer];
    }

    // 1. Level Filter
    if (filters.level && filters.level !== "ALL") {
      logs = logs.filter(l => l.level === filters.level);
    }

    // 2. Category Filter
    if (filters.category && filters.category !== "ALL") {
      logs = logs.filter(l => l.category === filters.category);
    }

    // 3. Service Filter
    if (filters.service && filters.service !== "ALL") {
      const s = filters.service.toLowerCase();
      logs = logs.filter(l => (l.service || "").toLowerCase().includes(s));
    }

    // 4. Provider Filter
    if (filters.provider && filters.provider !== "ALL") {
      const p = filters.provider.toLowerCase();
      logs = logs.filter(l => (l.provider || "").toLowerCase() === p);
    }

    // 5. Event Filter
    if (filters.event && filters.event !== "ALL") {
      const ev = filters.event.toLowerCase();
      logs = logs.filter(l => (l.event || "").toLowerCase().includes(ev));
    }

    // 6. Outcome Filter
    if (filters.outcome && filters.outcome !== "ALL") {
      logs = logs.filter(l => l.outcome === filters.outcome);
    }

    // 7. Date Range Filter
    if (filters.startDate) {
      const startMs = new Date(filters.startDate).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() >= startMs);
    }

    if (filters.endDate) {
      const endMs = new Date(filters.endDate).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() <= endMs);
    }

    // 8. Correlation / Order / Job Filter
    if (filters.orderId) {
      const oId = filters.orderId.toLowerCase().trim();
      logs = logs.filter(l => (l.orderId || "").toLowerCase().includes(oId));
    }

    if (filters.jobId) {
      const jId = filters.jobId.toLowerCase().trim();
      logs = logs.filter(l => (l.jobId || "").toLowerCase().includes(jId));
    }

    if (filters.correlationId) {
      const cId = filters.correlationId.toLowerCase().trim();
      logs = logs.filter(l => (l.correlationId || "").toLowerCase().includes(cId) || (l.requestId || "").toLowerCase().includes(cId));
    }

    // 9. Free-text Search
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      logs = logs.filter(l =>
        (l.id || "").toLowerCase().includes(q) ||
        (l.message || "").toLowerCase().includes(q) ||
        (l.event || "").toLowerCase().includes(q) ||
        (l.service || "").toLowerCase().includes(q) ||
        (l.provider || "").toLowerCase().includes(q) ||
        (l.orderId || "").toLowerCase().includes(q) ||
        (l.jobId || "").toLowerCase().includes(q) ||
        (l.correlationId || "").toLowerCase().includes(q) ||
        (l.requestId || "").toLowerCase().includes(q)
      );
    }

    const total = logs.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedLogs = logs.slice(startIndex, startIndex + limit);

    return {
      logs: paginatedLogs,
      total,
      page,
      limit,
      totalPages
    };
  } catch (error) {
    console.error("[SystemLog Engine] querySystemLogs error:", error);
    throw error;
  }
}

export async function getSystemLogMetrics(): Promise<SystemLogMetrics> {
  try {
    const logs = await SystemLogRepository.getInstance().queryLogs(1000);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let todayCount = 0;
    let errorCount = 0;
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let debugCount = 0;

    const categoryMap = new Map<string, number>();
    const levelMap = new Map<string, number>();
    const failingServiceMap = new Map<string, number>();

    logs.forEach(l => {
      const t = new Date(l.timestamp).getTime();
      if (t >= startOfToday) {
        todayCount++;
      }

      if (l.level === "CRITICAL") criticalCount++;
      else if (l.level === "ERROR") errorCount++;
      else if (l.level === "WARN") warningCount++;
      else if (l.level === "INFO") infoCount++;
      else if (l.level === "DEBUG") debugCount++;

      // Count levels
      levelMap.set(l.level, (levelMap.get(l.level) || 0) + 1);

      // Count categories
      categoryMap.set(l.category, (categoryMap.get(l.category) || 0) + 1);

      // Count failing services
      if (l.level === "ERROR" || l.level === "CRITICAL" || l.outcome === "FAILURE") {
        failingServiceMap.set(l.service, (failingServiceMap.get(l.service) || 0) + 1);
      }
    });

    const totalLogs = logs.length;
    const totalFailures = errorCount + criticalCount;
    const errorRatePercentage = totalLogs > 0 ? Math.round((totalFailures / totalLogs) * 1000) / 10 : 0;

    const categoryDistribution = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const levelDistribution = Array.from(levelMap.entries())
      .map(([level, count]) => ({ level, count }));

    const topFailingServices = Array.from(failingServiceMap.entries())
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentCriticalEvents = logs
      .filter(l => l.level === "CRITICAL" || l.level === "ERROR")
      .slice(0, 5);

    return {
      totalLogs,
      todayCount,
      errorCount,
      criticalCount,
      warningCount,
      infoCount,
      debugCount,
      errorRatePercentage,
      categoryDistribution,
      levelDistribution,
      topFailingServices,
      recentCriticalEvents
    };
  } catch (error) {
    console.error("[SystemLog Engine] getSystemLogMetrics error:", error);
    return {
      totalLogs: 0,
      todayCount: 0,
      errorCount: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      debugCount: 0,
      errorRatePercentage: 0,
      categoryDistribution: [],
      levelDistribution: [],
      topFailingServices: [],
      recentCriticalEvents: []
    };
  }
}
