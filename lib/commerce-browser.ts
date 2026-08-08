import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { isAllowedWebViewUrl } from "@/lib/webview-policy";

export type CommerceBrowserResult = Awaited<
  ReturnType<typeof WebBrowser.openAuthSessionAsync>
>;

export function getCommerceReturnUrl() {
  return Linking.createURL("payment-return");
}

export async function openCommerceSession(
  url: string,
): Promise<CommerceBrowserResult> {
  if (!isAllowedWebViewUrl(url, "first-party")) {
    throw new Error("Adresse de paiement non securisee ou non autorisee.");
  }

  return WebBrowser.openAuthSessionAsync(url, getCommerceReturnUrl(), {
    preferEphemeralSession: false,
  });
}
