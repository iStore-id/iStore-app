import { adminDb } from "./firebase-admin";
import { logCoreAudit } from "./core-service";
import { SystemConfiguration } from "../types/core";

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
    const snapshot = await adminDb.collection("systemConfigs").where("key", "==", FEATURE_FLAGS_KEY).limit(1).get();
    if (snapshot.empty) return [];
    
    const config = snapshot.docs[0].data() as SystemConfiguration;
    return (config.value?.flags || []) as FeatureFlag[];
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
  const existingSnap = await adminDb.collection("systemConfigs").where("key", "==", FEATURE_FLAGS_KEY).limit(1).get();
  const now = new Date().toISOString();
  
  // Format the flags before saving
  const flagsToSave = updatedFlags.map(f => ({
    ...f,
    updatedAt: now,
    updatedBy: actor.uid
  }));

  if (existingSnap.empty) {
    const docRef = adminDb.collection("systemConfigs").doc();
    const newConfig: SystemConfiguration = {
      id: docRef.id,
      key: FEATURE_FLAGS_KEY,
      name: "Feature Flags",
      description: "Global system feature flags",
      value: { flags: flagsToSave },
      valueType: "structured",
      scope: "global",
      status: "active",
      version: 1,
      updatedBy: actor.uid,
      createdAt: now,
      updatedAt: now
    };
    await docRef.set(newConfig);
    await logCoreAudit(actor, role, "UPDATE_FEATURE_FLAGS", `systemConfigs/${docRef.id}`, null, newConfig, "Initial feature flags creation");
  } else {
    const docRef = existingSnap.docs[0].ref;
    const existing = existingSnap.docs[0].data() as SystemConfiguration;
    const newConfig: SystemConfiguration = {
      ...existing,
      value: { flags: flagsToSave },
      version: (existing.version || 1) + 1,
      updatedBy: actor.uid,
      updatedAt: now
    };
    await docRef.set(newConfig);
    await logCoreAudit(actor, role, "UPDATE_FEATURE_FLAGS", `systemConfigs/${docRef.id}`, existing.value?.flags, newConfig.value?.flags, "Update feature flags");
  }

  // Invalidate cache
  featureFlagsCache = null;
  
  return flagsToSave;
}
