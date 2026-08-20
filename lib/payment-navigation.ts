import type { Href, Router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { InteractionManager } from "react-native";

export function replacePaymentFlowRoot(router: Router, destination: Href) {
  WebBrowser.dismissBrowser();

  if (!router.canDismiss()) {
    router.replace(destination);
    return;
  }

  router.dismissAll();
  InteractionManager.runAfterInteractions(() => {
    router.replace(destination);
  });
}

