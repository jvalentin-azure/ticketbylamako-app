import { isAllowedWebViewUrl } from "@/lib/webview-policy";

export interface CommerceBrowserResult {
  type: "dismiss" | "opened";
}

const WEB_PAYMENT_STORAGE_KEY = "ticketbylamako_web_payment";
const WEB_PAYMENT_COMPLETED_KEY = "ticketbylamako_web_payment_completed";

export async function openCommerceSession(
  url: string,
  flowToken?: string,
): Promise<CommerceBrowserResult> {
  if (!isAllowedWebViewUrl(url, "payment")) {
    throw new Error("Adresse de paiement non securisee ou non autorisee.");
  }

  const startedAt = Date.now();
  if (flowToken) {
    // Store only a short-lived browser-flow marker. The payment token remains
    // out of localStorage and is correlated through the authenticated API.
    try {
      localStorage.setItem(WEB_PAYMENT_STORAGE_KEY, String(startedAt));
      localStorage.removeItem(WEB_PAYMENT_COMPLETED_KEY);
    } catch {}
  }

  const popup = window.open(
    "",
    "ticketbylamako-payment",
    "popup=yes,width=520,height=760",
  );
  if (!popup) {
    window.location.assign(url);
    return { type: "opened" };
  }

  try {
    // Break the opener relationship before navigating to a third-party
    // payment provider. Completion is relayed by same-origin storage instead.
    popup.opener = null;
    popup.location.replace(url);
  } catch {
    try {
      popup.close();
    } catch {}
    window.location.assign(url);
    return { type: "opened" };
  }

  return new Promise((resolve) => {
    let settled = false;
    let closedPoll = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(closedPoll);
      try {
        localStorage.removeItem(WEB_PAYMENT_STORAGE_KEY);
        localStorage.removeItem(WEB_PAYMENT_COMPLETED_KEY);
      } catch {}
      resolve({ type: "dismiss" });
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== "lamako-mobile-web") return;
      if (flowToken && data.payload?.token !== flowToken) return;
      try {
        localStorage.removeItem(WEB_PAYMENT_STORAGE_KEY);
      } catch {}
      try {
        popup.close();
      } catch {}
      finish();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== WEB_PAYMENT_COMPLETED_KEY) return;
      const completedAt = Number(event.newValue || 0);
      if (!Number.isFinite(completedAt) || completedAt < startedAt) return;
      try {
        localStorage.removeItem(WEB_PAYMENT_STORAGE_KEY);
        localStorage.removeItem(WEB_PAYMENT_COMPLETED_KEY);
        popup.close();
      } catch {}
      finish();
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    closedPoll = window.setInterval(() => {
      if (popup.closed) finish();
    }, 500);
  });
}
