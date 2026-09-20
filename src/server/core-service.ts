import { SystemConfiguration, StoreConfiguration, AuditLog } from "../types/core";
import { AuditLogRepository } from "./supabase/audit-log-repository";
import { SystemConfigRepository } from "./supabase/system-config-repository";
import * as crypto from "crypto";

export async function logCoreAudit(actor: {uid: string; email: string}, role: string, action: string, target: string, before: any, after: any, reason?: string) {
  const log: AuditLog = {
    actor,
    role,
    action,
    target,
    before,
    after,
    reason,
    timestamp: new Date().toISOString()
  };
  await AuditLogRepository.getInstance().createLog(log);
}

export async function initStoreConfiguration(ownerActor: {uid: string, email: string}) {
  const existingConfig = await SystemConfigRepository.getInstance().getConfig("primary_store_config");
  if (!existingConfig) {
    const config: StoreConfiguration = {
      id: "primary",
      name: "",
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
    await SystemConfigRepository.getInstance().upsertConfig("primary_store_config", config);
    await logCoreAudit(ownerActor, "pemilik", "INIT_STORE_CONFIG", "storeConfigs/primary", null, config, "Initial setup");
    return config;
  }
  return existingConfig as StoreConfiguration;
}

export async function getStoreConfiguration() {
  const config = await SystemConfigRepository.getInstance().getConfig("primary_store_config");
  return config ? (config as StoreConfiguration) : undefined;
}

export async function updateStoreConfiguration(actor: {uid: string, email: string}, role: string, updates: Partial<StoreConfiguration>, reason?: string) {
  const before = await SystemConfigRepository.getInstance().getConfig("primary_store_config");
  
  const finalUpdates = {
    ...before,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await SystemConfigRepository.getInstance().upsertConfig("primary_store_config", finalUpdates);
  const after = await SystemConfigRepository.getInstance().getConfig("primary_store_config");
  
  await logCoreAudit(actor, role, "UPDATE_STORE_CONFIG", "storeConfigs/primary", before, after, reason);
  return after as StoreConfiguration;
}

export async function getSystemConfiguration(key: string): Promise<SystemConfiguration | null> {
  const data = await SystemConfigRepository.getInstance().getConfig(key);
  if (!data) return null;
  return data as SystemConfiguration;
}

export async function setSystemConfiguration(actor: {uid: string, email: string}, role: string, configData: Omit<SystemConfiguration, "id" | "updatedBy" | "updatedAt" | "createdAt" | "version">) {
  const existing = await SystemConfigRepository.getInstance().getConfig(configData.key);
  const now = new Date().toISOString();
  const currentVersion = existing && typeof existing.version === "number" ? existing.version : 0;
  const configId = existing?.id || crypto.randomUUID();
  
  const newConfig: SystemConfiguration = {
    ...configData,
    id: configId,
    version: currentVersion + 1,
    updatedBy: actor.uid,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  await SystemConfigRepository.getInstance().upsertConfig(configData.key, newConfig);
  await logCoreAudit(actor, role, existing ? "UPDATE_SYSTEM_CONFIG" : "CREATE_SYSTEM_CONFIG", `systemConfigs/${configId}`, existing, newConfig, existing ? "Update" : "Initial creation");
  return newConfig;
}
