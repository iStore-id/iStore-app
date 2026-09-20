import { logCoreAudit } from "./core-service.js";
import { SecuritySettings } from "../types/core.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  auth: {
    allowPasswordAuth: true,
    allowGoogleAuth: true,
    sessionTimeoutMinutes: 120,
    minPasswordLength: 8,
    requirePasswordNumbers: true,
    requirePasswordSymbols: false,
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    requireReauthForSensitiveOps: true,
    mfaPolicy: "optional"
  },
  rateLimiting: {
    enablePublicRateLimit: true,
    publicApiMaxRequestsPerMinute: 60,
    enableCheckoutRateLimit: true,
    checkoutMaxRequestsPerMinute: 15,
    enableAdminRateLimit: true,
    adminMaxRequestsPerMinute: 120,
    enableBotProtection: true
  },
  network: {
    ipWhitelistEnabled: false,
    ipWhitelist: [],
    ipBlacklistEnabled: false,
    ipBlacklist: [],
    enforceMidtransIpWhitelist: true,
    enforceTokoVoucherIpWhitelist: true
  },
  dataProtection: {
    maskCustomerDataInLogs: true,
    logAllAdminMutations: true,
    requireReasonForRefunds: true,
    requireReasonForConfigChanges: true,
    allowExportSensitiveData: false,
    secretMaskingStrict: true
  },
  emergency: {
    lockdownMode: false,
    lockdownReason: ""
  }
};

// Cached settings for low-latency middleware checks
let cachedSecuritySettings: SecuritySettings = { ...DEFAULT_SECURITY_SETTINGS };
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 10000; // 10s TTL

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL_MS) {
    return cachedSecuritySettings;
  }

  try {
    const rawVal = await SystemConfigRepository.getInstance().getConfig("security_settings");
    if (!rawVal) {
      cachedSecuritySettings = { ...DEFAULT_SECURITY_SETTINGS };
    } else {
      const data = rawVal;
      cachedSecuritySettings = {
        auth: { ...DEFAULT_SECURITY_SETTINGS.auth, ...(data.value?.auth || data.auth || {}) },
        rateLimiting: { ...DEFAULT_SECURITY_SETTINGS.rateLimiting, ...(data.value?.rateLimiting || data.rateLimiting || {}) },
        network: { ...DEFAULT_SECURITY_SETTINGS.network, ...(data.value?.network || data.network || {}) },
        dataProtection: { ...DEFAULT_SECURITY_SETTINGS.dataProtection, ...(data.value?.dataProtection || data.dataProtection || {}) },
        emergency: { ...DEFAULT_SECURITY_SETTINGS.emergency, ...(data.value?.emergency || data.emergency || {}) }
      };
    }
    lastCacheRefresh = now;
  } catch (err) {
    console.error("[Security Service Error] getSecuritySettings:", err);
  }

  return cachedSecuritySettings;
}

export async function updateSecuritySettings(
  actor: { uid: string; email: string },
  role: string,
  newSettings: Partial<SecuritySettings>,
  reason?: string
): Promise<SecuritySettings> {
  const currentSettings = await getSecuritySettings();
  const mergedSettings: SecuritySettings = {
    auth: { ...currentSettings.auth, ...(newSettings.auth || {}) },
    rateLimiting: { ...currentSettings.rateLimiting, ...(newSettings.rateLimiting || {}) },
    network: { ...currentSettings.network, ...(newSettings.network || {}) },
    dataProtection: { ...currentSettings.dataProtection, ...(newSettings.dataProtection || {}) },
    emergency: { ...currentSettings.emergency, ...(newSettings.emergency || {}) }
  };

  const existingRaw = await SystemConfigRepository.getInstance().getConfig("security_settings");
  const nowIso = new Date().toISOString();

  const configDoc = {
    key: "security_settings",
    name: "Security & Access Policies",
    description: "Pengaturan keamanan otentikasi, rate limit, IP filter, dan data protection",
    value: mergedSettings,
    valueType: "structured",
    scope: "global",
    status: "active",
    version: existingRaw ? ((existingRaw.version || 1) + 1) : 1,
    updatedBy: actor.uid,
    createdAt: existingRaw?.createdAt || nowIso,
    updatedAt: nowIso
  };

  await SystemConfigRepository.getInstance().upsertConfig("security_settings", configDoc);

  if (!existingRaw) {
    await logCoreAudit(actor, role, "INIT_SECURITY_SETTINGS", "systemConfigs/security_settings", null, mergedSettings, reason || "Initial setup");
  } else {
    await logCoreAudit(actor, role, "UPDATE_SECURITY_SETTINGS", "systemConfigs/security_settings", existingRaw.value || existingRaw, mergedSettings, reason || "Update via Admin Security Panel");
  }

  // Invalidate cache immediately
  cachedSecuritySettings = mergedSettings;
  lastCacheRefresh = Date.now();

  return mergedSettings;
}

// In-memory rate limiting structures
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const ipBuckets = new Map<string, RateLimitBucket>();

// Cleanup stale buckets periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of ipBuckets.entries()) {
    if (now > bucket.resetAt) {
      ipBuckets.delete(key);
    }
  }
}, 60000);

export function checkRateLimit(ip: string, category: "public" | "checkout" | "admin", maxRequests: number): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const now = Date.now();
  const bucketKey = `${category}:${ip}`;
  let bucket = ipBuckets.get(bucketKey);

  if (!bucket || now > bucket.resetAt) {
    bucket = {
      count: 1,
      resetAt: now + 60000 // 1 minute window
    };
    ipBuckets.set(bucketKey, bucket);
    return { allowed: true, remaining: maxRequests - 1, resetInSeconds: 60 };
  }

  bucket.count++;
  const remaining = Math.max(0, maxRequests - bucket.count);
  const resetInSeconds = Math.ceil((bucket.resetAt - now) / 1000);

  if (bucket.count > maxRequests) {
    return { allowed: false, remaining: 0, resetInSeconds };
  }

  return { allowed: true, remaining, resetInSeconds };
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export async function validatePasswordPolicy(password: string): Promise<PasswordValidationResult> {
  const settings = await getSecuritySettings();
  const authSettings = settings.auth;
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ["Password tidak boleh kosong"] };
  }

  const minLen = authSettings.minPasswordLength || 8;
  if (password.length < minLen) {
    errors.push(`Password minimal harus terdiri dari ${minLen} karakter`);
  }

  if (authSettings.requirePasswordNumbers) {
    const hasNumber = /[0-9]/.test(password);
    if (!hasNumber) {
      errors.push("Password harus mengandung minimal satu angka (0-9)");
    }
  }

  if (authSettings.requirePasswordSymbols) {
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    if (!hasSymbol) {
      errors.push("Password harus mengandung minimal satu karakter simbol");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

