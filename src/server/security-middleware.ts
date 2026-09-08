import { Request, Response, NextFunction } from "express";
import { getSecuritySettings, checkRateLimit } from "./security-service";
import { logSystem } from "./system-log-service";

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
}

export async function ipFirewallMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await getSecuritySettings();
    const clientIp = getClientIp(req);

    // 1. IP Blacklist check
    if (settings.network.ipBlacklistEnabled && settings.network.ipBlacklist.length > 0) {
      if (settings.network.ipBlacklist.includes(clientIp)) {
        logSystem("CRITICAL", "SECURITY", "IP_FIREWALL_BLOCKED", `Akses diblokir: IP terdaftar di blacklist (${clientIp})`, "ip-firewall", {
          httpStatus: 403,
          outcome: "BLOCKED",
          metadata: { ip: clientIp, path: req.path, method: req.method }
        });
        return res.status(403).json({
          success: false,
          message: "Akses ditolak: Alamat IP Anda terdaftar dalam daftar blokir keamanan."
        });
      }
    }

    // 2. Admin IP Whitelist check for /api/admin routes
    if (req.path.startsWith("/api/admin") && settings.network.ipWhitelistEnabled && settings.network.ipWhitelist.length > 0) {
      if (!settings.network.ipWhitelist.includes(clientIp)) {
        logSystem("WARN", "SECURITY", "ADMIN_IP_WHITELIST_BLOCKED", `Akses admin ditolak: IP tidak ada di whitelist (${clientIp})`, "ip-firewall", {
          httpStatus: 403,
          outcome: "BLOCKED",
          metadata: { ip: clientIp, path: req.path, method: req.method }
        });
        return res.status(403).json({
          success: false,
          message: "Akses ditolak: Alamat IP Anda tidak berada dalam daftar putih administrasi."
        });
      }
    }

    next();
  } catch (e) {
    next();
  }
}

export function rateLimitMiddleware(category: "public" | "checkout" | "admin") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await getSecuritySettings();
      let enabled = false;
      let maxReq = 60;

      if (category === "public") {
        enabled = settings.rateLimiting.enablePublicRateLimit;
        maxReq = settings.rateLimiting.publicApiMaxRequestsPerMinute;
      } else if (category === "checkout") {
        enabled = settings.rateLimiting.enableCheckoutRateLimit;
        maxReq = settings.rateLimiting.checkoutMaxRequestsPerMinute;
      } else if (category === "admin") {
        enabled = settings.rateLimiting.enableAdminRateLimit;
        maxReq = settings.rateLimiting.adminMaxRequestsPerMinute;
      }

      if (!enabled) {
        return next();
      }

      const clientIp = getClientIp(req);
      const result = checkRateLimit(clientIp, category, maxReq);

      res.setHeader("X-RateLimit-Limit", maxReq.toString());
      res.setHeader("X-RateLimit-Remaining", result.remaining.toString());

      if (!result.allowed) {
        res.setHeader("Retry-After", result.resetInSeconds.toString());
        logSystem("WARN", "SECURITY", "RATE_LIMIT_EXCEEDED", `Rate limit terlampaui untuk kategori ${category} oleh IP ${clientIp}`, "rate-limiter", {
          httpStatus: 429,
          outcome: "BLOCKED",
          metadata: { ip: clientIp, category, limit: maxReq, resetInSeconds: result.resetInSeconds, path: req.path }
        });
        return res.status(429).json({
          success: false,
          message: `Batas frekuensi permintaan terlampaui (${category} rate limit). Coba lagi dalam ${result.resetInSeconds} detik.`
        });
      }

      next();
    } catch (e) {
      next();
    }
  };
}

export async function emergencyLockdownMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await getSecuritySettings();
    if (settings.emergency.lockdownMode) {
      const clientIp = getClientIp(req);
      logSystem("WARN", "SECURITY", "EMERGENCY_LOCKDOWN_REJECTION", `Permintaan pesanan ditolak karena Mode Lockdown aktif (${clientIp})`, "lockdown-engine", {
        httpStatus: 503,
        outcome: "BLOCKED",
        metadata: { ip: clientIp, path: req.path, reason: settings.emergency.lockdownReason }
      });
      return res.status(503).json({
        success: false,
        message: "Sistem sedang dalam Mode Isolasi Keamanan (Security Lockdown). Pembuatan pesanan baru ditangguhkan sementara demi keamanan.",
        reason: settings.emergency.lockdownReason || "Insiden keamanan aktif"
      });
    }
    next();
  } catch (e) {
    next();
  }
}
