import { ApiGamesProvider } from "./providers.js";

export interface InquiryResult {
  isValid: boolean;
  username: string | null;
  message?: string;
  provider?: "isan" | "apigames" | "none";
}

const ISAN_BASE_URL = "https://api.isan.eu.org/nickname";
const TIMEOUT_MS = 3000;

/**
 * Primary validator using api.isan.eu.org with fallback to APIGames.
 * Preserves the exact existing contract: { isValid: boolean, username: string | null, message?: string }
 */
export async function performGameAccountInquiry(
  gameCode: string,
  userId: string,
  zoneId?: string
): Promise<InquiryResult> {
  const normalizedGameCode = String(gameCode || "").toLowerCase().trim();
  const trimmedUserId = String(userId || "").trim();
  const trimmedZoneId = zoneId ? String(zoneId).trim() : undefined;

  const supportedGames = ["freefire", "mobilelegend", "zzz", "valo", "aov", "pb", "sm", "sus", "pgr", "mcgg"];
  if (!supportedGames.includes(normalizedGameCode)) {
    return {
      isValid: false,
      username: null,
      message: "Pengecekan akun belum tersedia untuk game ini."
    };
  }

  if (normalizedGameCode === "mobilelegend" && !trimmedZoneId) {
    return {
      isValid: false,
      username: null,
      message: "Zone ID / Server ID diperlukan untuk Mobile Legends."
    };
  }
  if (normalizedGameCode === "pgr" && !trimmedZoneId) {
    return {
      isValid: false,
      username: null,
      message: "Server / Region diperlukan untuk Punishing Gray Raven."
    };
  }
  if (normalizedGameCode === "mcgg" && !trimmedZoneId) {
    return {
      isValid: false,
      username: null,
      message: "Zone ID diperlukan untuk Magic Chess: Go Go."
    };
  }

  // Step 1: Primary check via api.isan.eu.org
  try {
    const isanResult = await checkWithIsan(normalizedGameCode, trimmedUserId, trimmedZoneId);
    if (isanResult.isValid && isanResult.username) {
      return {
        isValid: true,
        username: isanResult.username,
        message: "Akun ditemukan",
        provider: "isan"
      };
    }
  } catch (error: any) {
    console.warn(`[Inquiry Adapter] Primary provider (Isan) error/timeout: ${error?.message || error}. Falling back to APIGames.`);
  }

  // Step 2: Secondary fallback to APIGames
  try {
    const apiGames = new ApiGamesProvider();
    const fallbackResult = await apiGames.checkUsername(normalizedGameCode, trimmedUserId, trimmedZoneId);
    if (fallbackResult.isValid && fallbackResult.username) {
      return {
        isValid: true,
        username: fallbackResult.username,
        message: fallbackResult.message || "Akun ditemukan",
        provider: "apigames"
      };
    }
    if (fallbackResult.message) {
      const lowerMsg = fallbackResult.message.toLowerCase();
      const isInternalVendorError = 
        lowerMsg.includes("saldo") ||
        lowerMsg.includes("merchant") ||
        lowerMsg.includes("signature") ||
        lowerMsg.includes("credential") ||
        lowerMsg.includes("configured") ||
        lowerMsg.includes("tidak cukup");

      if (!isInternalVendorError && (lowerMsg.includes("tidak ditemukan") || lowerMsg.includes("tidak valid"))) {
        return {
          isValid: false,
          username: null,
          message: fallbackResult.message
        };
      }
    }
  } catch (fallbackError: any) {
    console.warn(`[Inquiry Adapter] Fallback provider (APIGames) error:`, fallbackError?.message || fallbackError);
  }

  // Step 3: Safe default if unverified or both unavailable
  return {
    isValid: false,
    username: null,
    message: "ID akun tidak ditemukan atau validasi sedang tidak tersedia. Silakan coba lagi."
  };
}

async function checkWithIsan(
  gameCode: string,
  userId: string,
  zoneId?: string
): Promise<{ isValid: boolean; username: string | null }> {
  let url = "";
  if (gameCode === "mobilelegend") {
    url = `${ISAN_BASE_URL}/ml?id=${encodeURIComponent(userId)}&server=${encodeURIComponent(zoneId || "")}`;
  } else if (gameCode === "freefire") {
    url = `${ISAN_BASE_URL}/ff?id=${encodeURIComponent(userId)}`;
  } else if (gameCode === "zzz") {
    url = `${ISAN_BASE_URL}/zzz?id=${encodeURIComponent(userId)}`;
  } else if (gameCode === "valo") {
    url = `${ISAN_BASE_URL}/valo?id=${encodeURIComponent(userId)}`;
  } else if (gameCode === "aov") {
    url = `${ISAN_BASE_URL}/aov?id=${encodeURIComponent(userId)}`;
  } else if (gameCode === "pb") {
    url = `${ISAN_BASE_URL}/pb?id=${encodeURIComponent(userId)}`;
  } else if (gameCode === "sm") {
    url = `${ISAN_BASE_URL}/sm?id=${encodeURIComponent(userId)}`;
  } else if (gameCode === "sus") {
    url = `${ISAN_BASE_URL}/sus?id=${encodeURIComponent(userId)}`;
  } else if (gameCode === "pgr") {
    url = `${ISAN_BASE_URL}/pgr?id=${encodeURIComponent(userId)}&server=${encodeURIComponent(zoneId || "")}`;
  } else if (gameCode === "mcgg") {
    url = `${ISAN_BASE_URL}/mcgg?id=${encodeURIComponent(userId)}&server=${encodeURIComponent(zoneId || "")}`;
  } else {
    return { isValid: false, username: null };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 iStore/1.0"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      // Upstream error (e.g. HTTP 500 / 1101 on invalid account) -> consider invalid
      return { isValid: false, username: null };
    }

    const data = await response.json();
    if (!data || typeof data !== "object") {
      return { isValid: false, username: null };
    }

    // Valid only if data.success === true AND data.name is a non-empty string
    if (data.success === true && typeof data.name === "string" && data.name.trim().length > 0) {
      return {
        isValid: true,
        username: data.name.trim()
      };
    }

    // If success is true but name is absent or empty (e.g. Free Fire ID 1) -> invalid
    return { isValid: false, username: null };
  } finally {
    clearTimeout(timeoutId);
  }
}
