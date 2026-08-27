import type { AlertButton, AlertOptions } from "react-native";

type WebAlertOptions = AlertOptions & {
  onDismiss?: () => void;
};

let closeActiveAlert: (() => void) | null = null;

function appendText(
  parent: HTMLElement,
  tag: "h2" | "p",
  text: string,
  id: string,
): HTMLElement {
  const element = document.createElement(tag);
  element.id = id;
  element.textContent = text;
  element.style.margin = "0";
  element.style.color = tag === "h2" ? "#171323" : "#5F5968";
  element.style.fontFamily =
    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  element.style.fontSize = tag === "h2" ? "18px" : "14px";
  element.style.fontWeight = tag === "h2" ? "750" : "450";
  element.style.lineHeight = tag === "h2" ? "1.3" : "1.5";
  parent.appendChild(element);
  return element;
}

function showWebAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options: WebAlertOptions = {},
): void {
  if (typeof document === "undefined" || !document.body) return;

  closeActiveAlert?.();

  const actions = buttons?.length ? buttons : [{ text: "OK" }];
  const alertId = `ticketbylamako-alert-${Date.now()}`;
  const backdrop = document.createElement("div");
  const dialog = document.createElement("div");
  const actionRow = document.createElement("div");
  const previousOverflow = document.body.style.overflow;

  backdrop.style.position = "fixed";
  backdrop.style.inset = "0";
  backdrop.style.zIndex = "2147483647";
  backdrop.style.display = "flex";
  backdrop.style.alignItems = "center";
  backdrop.style.justifyContent = "center";
  backdrop.style.padding = "20px";
  backdrop.style.background = "rgba(23, 19, 35, 0.58)";
  backdrop.style.boxSizing = "border-box";

  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", `${alertId}-title`);
  if (message) dialog.setAttribute("aria-describedby", `${alertId}-message`);
  dialog.tabIndex = -1;
  dialog.style.width = "min(100%, 360px)";
  dialog.style.maxHeight = "calc(100dvh - 40px)";
  dialog.style.overflow = "auto";
  dialog.style.boxSizing = "border-box";
  dialog.style.padding = "22px";
  dialog.style.border = "1px solid rgba(23, 19, 35, 0.10)";
  dialog.style.borderRadius = "14px";
  dialog.style.background = "#FFFFFF";
  dialog.style.boxShadow = "0 24px 64px rgba(23, 19, 35, 0.28)";

  appendText(dialog, "h2", title || "TicketByLamako", `${alertId}-title`);
  if (message) {
    const messageElement = appendText(
      dialog,
      "p",
      message,
      `${alertId}-message`,
    );
    messageElement.style.marginTop = "10px";
  }

  actionRow.style.display = "flex";
  actionRow.style.flexWrap = "wrap";
  actionRow.style.justifyContent = "flex-end";
  actionRow.style.gap = "10px";
  actionRow.style.marginTop = "22px";

  let closed = false;
  const close = (dismissed = false) => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.body.style.overflow = previousOverflow;
    if (closeActiveAlert === close) closeActiveAlert = null;
    if (dismissed) options.onDismiss?.();
  };
  closeActiveAlert = close;

  const buttonElements = actions.map((action, index) => {
    const button = document.createElement("button");
    const isDestructive = action.style === "destructive";
    const isCancel = action.style === "cancel";

    button.type = "button";
    button.textContent = action.text || "OK";
    button.dataset.alertAction = isCancel
      ? "cancel"
      : isDestructive
        ? "destructive"
        : "default";
    button.style.minHeight = "44px";
    button.style.padding = "10px 16px";
    button.style.borderRadius = "10px";
    button.style.border = isCancel
      ? "1px solid rgba(23, 19, 35, 0.16)"
      : "1px solid transparent";
    button.style.background = isCancel
      ? "#F5F3F7"
      : isDestructive
        ? "#C93636"
        : "#D88328";
    button.style.color = isCancel ? "#171323" : "#FFFFFF";
    button.style.font =
      "700 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    button.style.cursor = "pointer";
    button.addEventListener("click", () => {
      close();
      action.onPress?.();
    });
    button.addEventListener("focus", () => {
      button.style.outline = "3px solid rgba(216, 131, 40, 0.32)";
      button.style.outlineOffset = "2px";
    });
    button.addEventListener("blur", () => {
      button.style.outline = "none";
    });
    actionRow.appendChild(button);
    if (index === actions.length - 1) button.dataset.preferred = "true";
    return button;
  });
  dialog.appendChild(actionRow);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  const cancelAction = actions.findIndex((action) => action.style === "cancel");
  const dismiss = () => {
    close(true);
    if (cancelAction >= 0) actions[cancelAction].onPress?.();
  };

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop && options.cancelable !== false) dismiss();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && options.cancelable !== false) {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key !== "Tab" || buttonElements.length < 2) return;
    const first = buttonElements[0];
    const last = buttonElements[buttonElements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const preferred =
    buttonElements.find((button) => button.dataset.alertAction === "default") ??
    buttonElements[buttonElements.length - 1];
  preferred?.focus();
}

export const Alert = {
  alert: showWebAlert,
};
