import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { getSecuritySettings, updateSecuritySettings, DEFAULT_SECURITY_SETTINGS, validatePasswordPolicy } from "./security-service.js";
import { logCoreAudit } from "./core-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";

export async function getSecuritySettingsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const settings = await getSecuritySettings();
    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error: any) {
    console.error("[Security API Error] getSecuritySettingsApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to get security settings" });
  }
}

export async function updateSecuritySettingsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actorEmail = (req.user?.email || "").toLowerCase();
    const actorRole = req.user?.role || "admin";

    // Owner protection: Only the verified Owner can update platform security settings
    if (actorEmail !== "chokerbayu@gmail.com") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Hanya Pemilik Sistem (Owner) yang berwenang mengubah konfigurasi keamanan platform."
      });
    }

    const { settings, reason } = req.body;
    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ success: false, message: "Payload settings tidak valid" });
    }

    // Validation checks
    if (settings.auth) {
      if (settings.auth.minPasswordLength < 6 || settings.auth.minPasswordLength > 32) {
        return res.status(400).json({ success: false, message: "Panjang minimum password harus antara 6 dan 32 karakter" });
      }
      if (settings.auth.sessionTimeoutMinutes < 5 || settings.auth.sessionTimeoutMinutes > 10080) {
        return res.status(400).json({ success: false, message: "Durasi session timeout harus antara 5 menit dan 7 hari" });
      }
    }

    if (settings.rateLimiting) {
      if (settings.rateLimiting.publicApiMaxRequestsPerMinute < 10) {
        return res.status(400).json({ success: false, message: "Public API rate limit minimal 10 req/menit" });
      }
      if (settings.rateLimiting.checkoutMaxRequestsPerMinute < 2) {
        return res.status(400).json({ success: false, message: "Checkout rate limit minimal 2 req/menit" });
      }
    }

    const updated = await updateSecuritySettings(
      { uid: req.user.uid, email: actorEmail },
      actorRole,
      settings,
      reason || "Pembaruan Kebijakan Keamanan via Admin Panel"
    );

    return res.status(200).json({
      success: true,
      message: "Konfigurasi keamanan berhasil disimpan",
      data: updated
    });
  } catch (error: any) {
    console.error("[Security API Error] updateSecuritySettingsApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update security settings" });
  }
}

export async function testIpSecurityApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { ip } = req.body;
    if (!ip || typeof ip !== "string") {
      return res.status(400).json({ success: false, message: "IP address wajib diisi" });
    }

    const settings = await getSecuritySettings();
    const cleanIp = ip.trim();

    const isBlacklisted = settings.network.ipBlacklistEnabled && settings.network.ipBlacklist.includes(cleanIp);
    const isWhitelisted = settings.network.ipWhitelistEnabled && (
      settings.network.ipWhitelist.length === 0 || settings.network.ipWhitelist.includes(cleanIp)
    );

    let verdict: "ALLOW" | "BLOCK_BLACKLIST" | "BLOCK_NOT_IN_WHITELIST" = "ALLOW";
    if (isBlacklisted) {
      verdict = "BLOCK_BLACKLIST";
    } else if (settings.network.ipWhitelistEnabled && !isWhitelisted) {
      verdict = "BLOCK_NOT_IN_WHITELIST";
    }

    return res.status(200).json({
      success: true,
      data: {
        ip: cleanIp,
        verdict,
        isBlacklisted,
        isWhitelisted,
        networkPolicies: {
          blacklistEnabled: settings.network.ipBlacklistEnabled,
          whitelistEnabled: settings.network.ipWhitelistEnabled
        }
      }
    });
  } catch (error: any) {
    console.error("[Security API Error] testIpSecurityApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}

export async function getSecurityOverviewApi(req: AuthenticatedRequest, res: Response) {
  try {
    const settings = await getSecuritySettings();
    
    // Fetch recent security audits
    let recentAudits: any[] = [];
    try {
      const logs = await AuditLogRepository.getInstance().queryLogs(10);
      recentAudits = logs.map(item => ({
        id: item.id,
        action: item.action,
        target: item.target,
        actorEmail: item.actor?.email || "system",
        timestamp: item.timestamp,
        reason: item.reason || "-"
      }));
    } catch (e) {
      console.warn("Audits fetch notice:", e);
    }

    return res.status(200).json({
      success: true,
      data: {
        settings,
        ownerSafeguard: {
          ownerEmail: "chokerbayu@gmail.com",
          status: "PROTECTED_PERMANENT",
          immutableFullAccess: true,
          antiDemotionLock: true
        },
        activeShields: {
          rateLimiting: settings.rateLimiting.enablePublicRateLimit,
          botProtection: settings.rateLimiting.enableBotProtection,
          secretMasking: settings.dataProtection.secretMaskingStrict,
          auditLogging: settings.dataProtection.logAllAdminMutations,
          lockdownMode: settings.emergency.lockdownMode
        },
        recentAudits
      }
    });
  } catch (error: any) {
    console.error("[Security API Error] getSecurityOverviewApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to get security overview" });
  }
}

export async function validatePasswordApi(req: Request, res: Response) {
  try {
    const { password } = req.body;
    if (password === undefined) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }
    const result = await validatePasswordPolicy(password);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error("[Security API Error] validatePasswordApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to validate password" });
  }
}

export async function getPasswordPolicyApi(_req: Request, res: Response) {
  try {
    const settings = await getSecuritySettings();
    return res.status(200).json({
      success: true,
      policy: {
        minPasswordLength: settings.auth?.minPasswordLength || 8,
        requirePasswordNumbers: !!settings.auth?.requirePasswordNumbers,
        requirePasswordSymbols: !!settings.auth?.requirePasswordSymbols
      }
    });
  } catch (error: any) {
    console.error("[Security API Error] getPasswordPolicyApi:", error);
    return res.status(500).json({ success: false, message: "Failed to get password policy" });
  }
}

export async function auditPasswordChangeApi(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ success: false, message: "Unauthorized. Token required." });
    }

    const { result, reason } = req.body || {};
    const safeResult = result === "SUCCESS" ? "SUCCESS" : "FAILED";
    const safeReason = typeof reason === "string" 
      ? reason.substring(0, 100) 
      : (safeResult === "SUCCESS" ? "User initiated password update" : "Password update failed");

    await logCoreAudit(
      { uid: req.user.uid, email: req.user.email || "user" },
      req.user.role || "customer",
      "PASSWORD_CHANGE",
      `users/${req.user.uid}`,
      null,
      { status: safeResult },
      safeReason
    );

    return res.status(200).json({ success: true, message: "Audit recorded" });
  } catch (error: any) {
    console.error("[Security API Error] auditPasswordChangeApi:", error);
    return res.status(500).json({ success: false, message: "Failed to record audit" });
  }
}

export async function auditPasswordResetApi(req: Request, res: Response) {
  try {
    const { email, result, reason } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const safeResult = result === "SUCCESS" ? "SUCCESS" : "FAILED";
    const safeReason = typeof reason === "string" 
      ? reason.substring(0, 100) 
      : (safeResult === "SUCCESS" ? "User completed password reset" : "Password reset failed");
    const sanitizedEmail = email.toLowerCase().trim().substring(0, 100);

    await logCoreAudit(
      { uid: "unauthenticated_reset", email: sanitizedEmail },
      "customer",
      "PASSWORD_RESET",
      `users/${sanitizedEmail}`,
      null,
      { status: safeResult },
      safeReason
    );

    return res.status(200).json({ success: true, message: "Audit recorded" });
  } catch (error: any) {
    console.error("[Security API Error] auditPasswordResetApi:", error);
    return res.status(500).json({ success: false, message: "Failed to record audit" });
  }
}

export async function auditMfaChangeApi(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ success: false, message: "Unauthorized. Token required." });
    }

    const { action, result, reason } = req.body || {};
    const safeAction = action === "MFA_UNENROLL" ? "MFA_UNENROLL" : "MFA_ENROLL";
    const safeResult = result === "SUCCESS" ? "SUCCESS" : "FAILED";
    const safeReason = typeof reason === "string" 
      ? reason.substring(0, 100) 
      : (safeResult === "SUCCESS" ? "MFA state updated" : "MFA operation failed");

    await logCoreAudit(
      { uid: req.user.uid, email: req.user.email || "user" },
      req.user.role || "customer",
      safeAction,
      `users/${req.user.uid}`,
      null,
      { status: safeResult },
      safeReason
    );

    return res.status(200).json({ success: true, message: "MFA audit recorded" });
  } catch (error: any) {
    console.error("[Security API Error] auditMfaChangeApi:", error);
    return res.status(500).json({ success: false, message: "Failed to record audit" });
  }
}



