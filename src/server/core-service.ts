import { adminDb } from "./firebase-admin";
import { SystemConfiguration, StoreConfiguration, AuditLog } from "../types/core";

export async function logCoreAudit(actor: {uid: string; email: string}, role: string, action: string, target: string, before: any, after: any, reason?: string) {
  const auditRef = adminDb.collection("auditLogs").doc();
  const log: AuditLog = {
    id: auditRef.id,
    actor,
    role,
    action,
    target,
    before,
    after,
    reason,
    timestamp: new Date().toISOString()
  };
  await auditRef.set(log);
}

export async function initStoreConfiguration(ownerActor: {uid: string, email: string}) {
  const storeRef = adminDb.collection("storeConfigs").doc("primary");
  const docSnap = await storeRef.get();
  if (!docSnap.exists) {
    const config: StoreConfiguration = {
      id: "primary",
      name: "iStore.id",
      logo: "",
      favicon: "",
      description: "Platform Top Up Game Terpercaya",
      contactInformation: {
        email: "admin@istore.co.id",
        phone: "",
        whatsapp: "",
        address: ""
      },
      currency: "IDR",
      currencySymbol: "Rp",
      currencyPosition: "prefix",
      decimalSeparator: ",",
      thousandSeparator: ".",
      decimalPlaces: 0,
      timezone: "Asia/Jakarta",
      locale: "id-ID",
      defaultLanguage: "id",
      supportedLanguages: ["id", "en"],
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      operationalStatus: "open",
      basicInformation: {
        tagline: "Top up game cepat dan aman",
        socialMedia: {}
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await storeRef.set(config);
    await logCoreAudit(ownerActor, "pemilik", "INIT_STORE_CONFIG", "storeConfigs/primary", null, config, "Initial setup");
    return config;
  }
  return docSnap.data() as StoreConfiguration;
}

export async function getStoreConfiguration() {
  const storeRef = adminDb.collection("storeConfigs").doc("primary");
  const docSnap = await storeRef.get();
  return docSnap.data() as StoreConfiguration | undefined;
}

export async function updateStoreConfiguration(actor: {uid: string, email: string}, role: string, updates: Partial<StoreConfiguration>, reason?: string) {
  const storeRef = adminDb.collection("storeConfigs").doc("primary");
  const docSnap = await storeRef.get();
  const before = docSnap.exists ? docSnap.data() : null;
  
  const finalUpdates = {
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await storeRef.set(finalUpdates, { merge: true });
  const afterSnap = await storeRef.get();
  
  await logCoreAudit(actor, role, "UPDATE_STORE_CONFIG", "storeConfigs/primary", before, afterSnap.data(), reason);
  return afterSnap.data() as StoreConfiguration;
}

export async function getSystemConfiguration(key: string) {
  const snapshot = await adminDb.collection("systemConfigs").where("key", "==", key).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as SystemConfiguration;
}

export async function setSystemConfiguration(actor: {uid: string, email: string}, role: string, configData: Omit<SystemConfiguration, "id" | "updatedBy" | "updatedAt" | "createdAt" | "version">) {
  const existingSnap = await adminDb.collection("systemConfigs").where("key", "==", configData.key).limit(1).get();
  const now = new Date().toISOString();
  
  if (existingSnap.empty) {
    const docRef = adminDb.collection("systemConfigs").doc();
    const newConfig: SystemConfiguration = {
      ...configData,
      id: docRef.id,
      version: 1,
      updatedBy: actor.uid,
      createdAt: now,
      updatedAt: now
    };
    await docRef.set(newConfig);
    await logCoreAudit(actor, role, "CREATE_SYSTEM_CONFIG", `systemConfigs/${docRef.id}`, null, newConfig, "Initial creation");
    return newConfig;
  } else {
    const docRef = existingSnap.docs[0].ref;
    const existing = existingSnap.docs[0].data() as SystemConfiguration;
    const newConfig: SystemConfiguration = {
      ...existing,
      ...configData,
      version: existing.version + 1,
      updatedBy: actor.uid,
      updatedAt: now
    };
    await docRef.set(newConfig);
    await logCoreAudit(actor, role, "UPDATE_SYSTEM_CONFIG", `systemConfigs/${docRef.id}`, existing, newConfig, "Update");
    return newConfig;
  }
}
