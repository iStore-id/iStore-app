import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { adminDb } from "./firebase-admin";
import { initStoreConfiguration, getStoreConfiguration, updateStoreConfiguration, getSystemConfiguration, setSystemConfiguration } from "./core-service";
import { StoreConfiguration } from "../types/core";

export async function getSystemConfigOverview(req: AuthenticatedRequest, res: Response) {
  try {
    const storeConfig = await getStoreConfiguration();
    const snapshot = await adminDb.collection("systemConfigs").get();
    
    // Convert systemConfigs to a set of keys for fast lookup
    const sysKeys = new Set(snapshot.docs.map(doc => doc.data().key));

    // Status Evaluators
    const isStoreConfigured = !!storeConfig && storeConfig.name !== "iStore.id" && storeConfig.name.trim() !== "";
    const isRegionalConfigured = !!storeConfig && !!storeConfig.currency && !!storeConfig.timezone;
    const isSecurityConfigured = sysKeys.has("security_settings");
    const isFeatureFlagsConfigured = sysKeys.has("feature_flags");
    const isNotificationConfigured = sysKeys.has("notification_settings");
    const isPrivacyConfigured = sysKeys.has("privacy_settings");
    
    // Payment & Providers
    const isMidtransConfigured = sysKeys.has("midtrans_integration");
    const isTokovoucherConfigured = sysKeys.has("tokovoucher_integration");
    const isApigamesConfigured = sysKeys.has("apigames_integration");
    const hasAnyPayment = isMidtransConfigured;
    const hasAnyProvider = isTokovoucherConfigured || isApigamesConfigured;

    return res.status(200).json({
      success: true,
      data: {
        store: isStoreConfigured ? "configured" : "incomplete",
        security: isSecurityConfigured ? "configured" : "incomplete",
        featureFlags: isFeatureFlagsConfigured ? "configured" : "incomplete",
        payment: hasAnyPayment ? "configured" : "incomplete",
        provider: hasAnyProvider ? "configured" : "incomplete",
        regional: isRegionalConfigured ? "configured" : "incomplete",
        notification: isNotificationConfigured ? "configured" : "incomplete",
        privacy: isPrivacyConfigured ? "configured" : "incomplete",
        
        details: {
          midtrans: isMidtransConfigured,
          tokovoucher: isTokovoucherConfigured,
          apigames: isApigamesConfigured
        }
      }
    });
  } catch (error: any) {
    console.error("[Config API Error] getSystemConfigOverview:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}

import { getMidtransServerConfig, encryptSecret, decryptSecret, testMidtransConnection } from "./midtrans";

export async function getPublicMidtransConfig(req: Request, res: Response) {
  try {
    const config = await getMidtransServerConfig();
    return res.status(200).json({
      success: true,
      data: {
        clientKey: config.clientKey || "",
        isProduction: config.isProduction,
        configured: config.configured
      }
    });
  } catch (error: any) {
    console.error("[Config API Error] getPublicMidtransConfig:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}

export async function getPublicStoreConfig(req: Request, res: Response) {
  try {
    const config = await getStoreConfiguration();
    if (!config) {
      return res.status(200).json({
        success: true,
        data: {
          name: "iStore.id",
          logo: "",
          favicon: "",
          description: "Platform Top Up Game Terpercaya",
          tagline: "Top up game cepat dan aman",
          primaryColor: "#3b82f6",
          secondaryColor: "#1d4ed8",
          brandTextColor: "#1e3a8a",
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
          contactInformation: {
            email: "admin@istore.co.id",
            phone: "",
            whatsapp: "",
            address: ""
          },
          socialMedia: {}
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        name: config.name || "iStore.id",
        logo: config.logo || "",
        favicon: config.favicon || "",
        description: config.description || "",
        tagline: config.basicInformation?.tagline || "",
        primaryColor: config.primaryColor || "#3b82f6",
        secondaryColor: config.secondaryColor || "#1d4ed8",
        brandTextColor: config.brandTextColor || config.primaryColor || "#1e3a8a",
        currency: config.currency || "IDR",
        currencySymbol: config.currencySymbol || "Rp",
        currencyPosition: config.currencyPosition || "prefix",
        decimalSeparator: config.decimalSeparator || ",",
        thousandSeparator: config.thousandSeparator || ".",
        decimalPlaces: config.decimalPlaces ?? 0,
        timezone: config.timezone || "Asia/Jakarta",
        locale: config.locale || "id-ID",
        defaultLanguage: config.defaultLanguage || "id",
        supportedLanguages: config.supportedLanguages || ["id", "en"],
        dateFormat: config.dateFormat || "DD/MM/YYYY",
        timeFormat: config.timeFormat || "24h",
        operationalStatus: config.operationalStatus || "open",
        closedMessage: config.closedMessage || "",
        maintenanceMessage: config.maintenanceMessage || "",
        contactInformation: {
          email: config.contactInformation?.email || "",
          phone: config.contactInformation?.phone || "",
          whatsapp: config.contactInformation?.whatsapp || "",
          address: config.contactInformation?.address || ""
        },
        socialMedia: config.basicInformation?.socialMedia || {}
      }
    });
  } catch (error: any) {
    console.error("[Config API Error] getPublicStoreConfig:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}

export async function getStoreConfig(req: AuthenticatedRequest, res: Response) {
  try {
    let config = await getStoreConfiguration();
    if (!config) {
      config = await initStoreConfiguration({uid: req.user.uid, email: req.user.email || ""});
    }
    return res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    console.error("[Config API Error] getStoreConfig:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}

export async function updateStoreConfig(req: AuthenticatedRequest, res: Response) {
  try {
    const updates = req.body;

    // Server-side URL validation for socialMedia
    if (updates.basicInformation?.socialMedia) {
      const social = updates.basicInformation.socialMedia;
      for (const [platform, url] of Object.entries(social)) {
        if (url && typeof url === "string" && url.trim() !== "") {
          const trimmedUrl = url.trim();
          try {
            const parsed = new URL(trimmedUrl);
            const protocol = parsed.protocol.toLowerCase();
            if (protocol !== "https:") {
              return res.status(400).json({ 
                success: false, 
                message: `URL untuk platform ${platform} harus menggunakan protokol aman HTTPS (https://).` 
              });
            }
          } catch (e) {
            return res.status(400).json({ 
              success: false, 
              message: `Format URL untuk platform ${platform} tidak valid.` 
            });
          }
        }
      }
    }

    // Regional & Timezone validation
    if (updates.timezone) {
      const validTimezones = [
        "Asia/Jakarta", // WIB (UTC+7)
        "Asia/Makassar", // WITA (UTC+8)
        "Asia/Jayapura", // WIT (UTC+9)
        "Asia/Singapore",
        "Asia/Bangkok",
        "Asia/Kuala_Lumpur",
        "UTC"
      ];
      if (typeof updates.timezone !== "string" || !validTimezones.includes(updates.timezone)) {
        return res.status(400).json({
          success: false,
          message: `Zona waktu tidak valid. Gunakan salah satu dari: ${validTimezones.join(", ")}`
        });
      }
    }

    if (updates.closedMessage !== undefined) {
      if (updates.closedMessage !== null && typeof updates.closedMessage !== "string") {
        return res.status(400).json({ success: false, message: "Format closedMessage tidak valid." });
      }
      if (typeof updates.closedMessage === "string" && updates.closedMessage.trim().length > 500) {
        return res.status(400).json({ success: false, message: "Pesan tutup sementara maksimal 500 karakter." });
      }
      updates.closedMessage = updates.closedMessage ? updates.closedMessage.trim() : "";
    }

    if (updates.maintenanceMessage !== undefined) {
      if (updates.maintenanceMessage !== null && typeof updates.maintenanceMessage !== "string") {
        return res.status(400).json({ success: false, message: "Format maintenanceMessage tidak valid." });
      }
      if (typeof updates.maintenanceMessage === "string" && updates.maintenanceMessage.trim().length > 500) {
        return res.status(400).json({ success: false, message: "Pesan maintenance maksimal 500 karakter." });
      }
      updates.maintenanceMessage = updates.maintenanceMessage ? updates.maintenanceMessage.trim() : "";
    }

    if (updates.currency) {
      if (typeof updates.currency !== "string" || updates.currency.length !== 3) {
        return res.status(400).json({
          success: false,
          message: "Kode mata uang harus 3 karakter standar ISO (misal: IDR)."
        });
      }
    }

    const userDoc = await adminDb.collection("users").doc(req.user.uid).get();
    const role = userDoc.exists ? userDoc.data()?.role : "admin";
    const config = await updateStoreConfiguration({uid: req.user.uid, email: req.user.email || ""}, role, updates, "Admin UI Update");
    return res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getSystemConfigs(req: AuthenticatedRequest, res: Response) {
  try {
    const snapshot = await adminDb.collection("systemConfigs").get();
    const configs = snapshot.docs.map(doc => doc.data());
    return res.status(200).json({ success: true, data: configs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateSystemConfig(req: AuthenticatedRequest, res: Response) {
  try {
    const { key } = req.params;
    const configData = req.body;
    
    // Ensure key matches
    if (configData.key && configData.key !== key) {
      return res.status(400).json({ success: false, message: "Key mismatch" });
    }
    configData.key = key;

    const userDoc = await adminDb.collection("users").doc(req.user.uid).get();
    const role = userDoc.exists ? userDoc.data()?.role : "admin";
    const config = await setSystemConfiguration({uid: req.user.uid, email: req.user.email || ""}, role, configData);
    return res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
