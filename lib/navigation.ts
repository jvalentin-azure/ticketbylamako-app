import type { Href, Router } from "expo-router";

/**
 * Preserve normal history, but keep app-style back navigation working when a
 * mobile web screen was opened directly and has no router history.
 */
export function goBackOrFallback(router: Router, fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
