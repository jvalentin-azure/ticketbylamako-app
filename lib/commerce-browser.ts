import * as WebBrowser from "expo-web-browser";
import { isAllowedWebViewUrl } from "@/lib/webview-policy";

export type CommerceBrowserResult = Awaited<
  ReturnType<typeof WebBrowser.openBrowserAsync>
>;

export async function openCommerceSession(
  url: string,
  _flowToken?: string,
): Promise<CommerceBrowserResult> {
  if (!isAllowedWebViewUrl(url, "payment")) {
    throw new Error("Adresse de paiement non securisee ou non autorisee.");
  }

  return WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    dismissButtonStyle: "close",
    controlsColor: "#7A4315",
    toolbarColor: "#FFFFFF",
    secondaryToolbarColor: "#FFFFFF",
    enableBarCollapsing: false,
    enableDefaultShareMenuItem: false,
    showInRecents: false,
    showTitle: false,
  });
}
