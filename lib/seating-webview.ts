export interface SeatingWebMessage {
  source?: string;
  version?: number;
  flowId?: string;
  type?: string;
  payload?: Record<string, unknown>;
}

export interface SelectedSeat {
  id?: string;
  label?: string;
}

export function parseSeatingWebMessage(
  raw: string,
  expectedFlowId?: string,
): SeatingWebMessage | null {
  try {
    const message = JSON.parse(raw) as SeatingWebMessage;
    if (!message || typeof message !== "object") return null;
    if (message.source !== "lamako-mobile-web") return null;
    if (message.version !== 1) return null;
    if (!message.type) return null;
    if (expectedFlowId && message.flowId !== expectedFlowId) return null;
    return message;
  } catch {
    return null;
  }
}

export function isSeatingCheckoutUrl(url: string): boolean {
  return (
    url.includes("/checkout") ||
    url.includes("/commande") ||
    url.includes("order-pay")
  );
}

export function isSeatingSuccessUrl(url: string): boolean {
  return (
    url.includes("order-received") ||
    url.includes("commande-recue") ||
    url.includes("thankyou")
  );
}

export function isSeatingSessionUrl(url: string): boolean {
  return (
    url.includes("lamako_seating_token=") ||
    url.includes("/lamako-mobile/seat/")
  );
}

export function buildSeatingInjectedJavaScript(flowId = ""): string {
  return `
    (function() {
      if (window.__LAMAKO_MOBILE_WEBVIEW_INJECTED__) return true;
      window.__LAMAKO_MOBILE_WEBVIEW_INJECTED__ = true;
      var style = document.createElement('style');
      style.textContent =
        '#wpadminbar, header, footer, nav, aside, .site-header, .site-footer, #masthead, #colophon, .woocommerce-breadcrumb, .gt-breadcrumb, .gt-page-title-bar, .sidebar,' +
        '[class*="whatsapp"], [id*="whatsapp"], [class*="qlwapp"], [id*="qlwapp"], [class*="cookie"], [class*="consent"], #fkcart-floating-toggler, .fkcart-main-wrapper,' +
        '[class*="tidio"], [id*="tidio"], [class*="tawk"], [id*="tawk"], [class*="crisp"], [id*="crisp"] { display: none !important; visibility: hidden !important; }' +
        'body { margin: 0 !important; padding: 0 !important; font-family: -apple-system, BlinkMacSystemFont, sans-serif !important; background: #f7f3ed !important; }' +
        '.woocommerce, .woocommerce-cart, .woocommerce-checkout { max-width: 100% !important; padding: 10px !important; box-sizing: border-box !important; }' +
        '.wc-proceed-to-checkout a, .checkout-button, #place_order { display: block !important; width: 100% !important; border-radius: 12px !important; padding: 14px !important; font-size: 16px !important; font-weight: 800 !important; }';
      document.head.appendChild(style);
      function post(type, payload) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          source: 'lamako-mobile-web',
          version: 1,
          flowId: '${flowId}',
          type: type,
          payload: payload || {},
          ts: Date.now(),
          signature: ''
        }));
      }
      var url = window.location.href;
      if (url.indexOf('/checkout') !== -1 || url.indexOf('/commande') !== -1 || url.indexOf('order-pay') !== -1) post('CHECKOUT_READY', { url: url });
      if (url.indexOf('order-received') !== -1 || url.indexOf('commande-recue') !== -1 || url.indexOf('thankyou') !== -1) post('PAYMENT_RESULT', { status: 'success', url: url });
      true;
    })();
  `;
}
