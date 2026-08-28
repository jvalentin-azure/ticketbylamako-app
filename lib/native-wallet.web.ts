import { SITE_URL } from "@/lib/site-url";

export type NativeWalletResult = "added" | "cancelled";

export async function addTicketToNativeWallet(
  signedWalletUrl: string,
): Promise<NativeWalletResult> {
  const url = new URL(signedWalletUrl, window.location.origin);
  const siteHost = new URL(SITE_URL).hostname.toLowerCase();
  const allowedHosts = new Set([siteHost, "pay.google.com"]);
  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new Error("Lien Wallet non sécurisé.");
  }
  window.location.assign(url.toString());
  return "added";
}
