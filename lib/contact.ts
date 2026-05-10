export const LAMAKO_WHATSAPP_NUMBER = "+261387357728";
export const LAMAKO_WHATSAPP_DISPLAY = "+261 38 73 57 728";
export const LAMAKO_PHONE_NUMBER = "+261341392292";
export const LAMAKO_PHONE_DISPLAY = "+261 34 13 922 92";
export const LAMAKO_EMAIL = "info@lamakoevents.mg";

export function buildLamakoWhatsAppUrl(message?: string): string {
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${LAMAKO_WHATSAPP_NUMBER.replace("+", "")}${text}`;
}
