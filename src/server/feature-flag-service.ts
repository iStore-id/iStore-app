import { supabaseAdmin, isSupabaseAdminConfigured } from "./supabase-admin.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";
import { logCoreAudit } from "./core-service.js";

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  name: string;
  description: string;
  updatedAt?: string;
  updatedBy?: string;
}

const FEATURE_FLAGS_KEY = "feature_flags";

// In-memory cache for fast evaluation
let featureFlagsCache: Record<string, boolean> | null = null;
let lastCacheUpdate: number = 0;
const CACHE_TTL_MS = 1000 * 60; // 1 minute cache

/**
 * Validated fetch for backend evaluation and public exposure
 */
export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  try {
    const raw = await SystemConfigRepository.getInstance().getConfig(FEATURE_FLAGS_KEY);
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as FeatureFlag[];
    if (Array.isArray(raw.flags)) return raw.flags as FeatureFlag[];
    if (raw.value && Array.isArray(raw.value.flags)) return raw.value.flags as FeatureFlag[];
    return [];
  } catch (error) {
    console.error("[FeatureFlagService] Error fetching feature flags:", error);
    return [];
  }
}

/**
 * Fast authoritative evaluation for backend use. 
 * Includes fail-safe (defaults to false).
 */
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  try {
    const now = Date.now();
    if (!featureFlagsCache || now - lastCacheUpdate > CACHE_TTL_MS) {
      const flags = await getFeatureFlags();
      const newCache: Record<string, boolean> = {};
      for (const flag of flags) {
        newCache[flag.key] = flag.enabled;
      }
      featureFlagsCache = newCache;
      lastCacheUpdate = now;
    }
    
    return featureFlagsCache[flagKey] === true;
  } catch (error) {
    console.error(`[FeatureFlagService] Error evaluating flag ${flagKey}:`, error);
    return false; // Fail-safe
  }
}

/**
 * Authoritative mutation for admin
 */
export async function updateFeatureFlags(actor: {uid: string, email: string}, role: string, updatedFlags: FeatureFlag[]): Promise<FeatureFlag[]> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    throw new Error("Supabase Admin client is not configured.");
  }

  const now = new Date().toISOString();
  
  // Format the flags before saving
  const flagsToSave = updatedFlags.map(f => ({
    ...f,
    updatedAt: now,
    updatedBy: actor.uid
  }));

  const existingVal = await SystemConfigRepository.getInstance().getConfig(FEATURE_FLAGS_KEY);

  if (!existingVal) {
    const valuePayload = { flags: flagsToSave, version: 1 };
    try {
      await SystemConfigRepository.getInstance().upsertConfig(FEATURE_FLAGS_KEY, valuePayload);
    } catch (insertErr: any) {
      throw new Error(`Failed to save feature flags: ${insertErr.message}`);
    }

    await logCoreAudit(actor, role, "UPDATE_FEATURE_FLAGS", `systemConfigs/feature_flags`, null, flagsToSave, "Initial feature flags creation");
  } else {
    const existingFlags = Array.isArray(existingVal.flags) ? existingVal.flags : (Array.isArray(existingVal) ? existingVal : []);
    const currentVersion = (existingVal && typeof existingVal.version === "number") ? existingVal.version : 1;
    const nextVersion = currentVersion + 1;

    const valuePayload = { flags: flagsToSave, version: nextVersion };
    try {
      await SystemConfigRepository.getInstance().upsertConfig(FEATURE_FLAGS_KEY, valuePayload);
    } catch (updateErr: any) {
      throw new Error(`Failed to update feature flags: ${updateErr.message}`);
    }

    await logCoreAudit(actor, role, "UPDATE_FEATURE_FLAGS", `systemConfigs/feature_flags`, existingFlags, flagsToSave, "Update feature flags");
  }

  // Invalidate cache
  featureFlagsCache = null;
  
  return flagsToSave;
}
