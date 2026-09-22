/**
 * Normalizes Indonesian phone numbers to E.164 format.
 * Example: 081234567890 -> +6281234567890
 * Example: +6281234567890 -> +6281234567890
 * Example: 6281234567890 -> +6281234567890
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  
  // If starts with 0, replace with +62
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  }
  
  // If it doesn't start with 62 but looks like a local number (e.g. 812...), prepend 62
  if (!cleaned.startsWith("62") && (cleaned.startsWith("8") || cleaned.startsWith("9"))) {
    cleaned = "62" + cleaned;
  }
  
  // Final E.164 check: must start with +
  return "+" + cleaned;
}

/**
 * Basic validation for Indonesian phone numbers.
 * Minimum length check after normalization.
 */
export function isValidIndonesianPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // E.164 for ID is usually +62 followed by 9-13 digits
  // Total length 12-15 characters including +
  return normalized.startsWith("+62") && normalized.length >= 11 && normalized.length <= 15;
}
