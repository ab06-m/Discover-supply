function extractWhatsAppPhone(raw: string) {
  const lower = raw.toLowerCase();

  if (lower.includes("wa.me/")) {
    const parts = raw.split("wa.me/");
    return parts[parts.length - 1] ?? raw;
  }

  if (lower.includes("whatsapp.com")) {
    try {
      const parsed = new URL(raw);
      const fromQuery = parsed.searchParams.get("phone");
      if (fromQuery) return fromQuery;
      return parsed.pathname;
    } catch {
      return raw;
    }
  }

  return raw;
}

export function normalizePhoneDigits(value: string | null | undefined) {
  const phone = value?.trim() ?? "";
  if (!phone) return "";

  const extracted = extractWhatsAppPhone(phone);
  return extracted.replace(/\D/g, "");
}
