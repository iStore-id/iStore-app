import { SystemConfiguration, StoreConfiguration, AuditLog } from "../types/core.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";
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
      primaryColor: "#EE4D2D",
      secondaryColor: "#212121",
      brandTextColor: "#212121",
      backgroundColor: "#F5F5F5",
      surfaceColor: "#FFFFFF",
      textColor: "#212121",
      textSecondaryColor: "#757575",
      borderColor: "#E5E5E5",
      accentColor: "#FFB800",
      hoverColor: "#D93F22",
      headerBackgroundColor: "#FFFFFF",
      headerTextColor: "#212121",
      borderRadius: "xl",
      buttonStyle: "solid",
      themePreference: "system",
      showGlobalBorders: true,
      homepageLayout: {
        items: [
          { id: "hero", order: 0, visible: true },
          { id: "ticker", order: 1, visible: true },
          { id: "flashSale", order: 2, visible: true },
          { id: "campaign", order: 3, visible: true },
          { id: "landing", order: 4, visible: true },
          { id: "navigation", order: 5, visible: true },
          { id: "catalog", order: 6, visible: true },
          { id: "blog", order: 7, visible: true },
          { id: "faq", order: 8, visible: true }
        ]
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
