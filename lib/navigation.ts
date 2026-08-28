import type { Href, Router } from "expo-router";

/**
 * Preserve normal history, but keep app-style back navigation working when a
 * mobile web screen was opened directly and has no router history.
 */
export function goBackOrFallback(
  router: Router,
  fallback: Href,
  isWeb = typeof document !== "undefined",
): void {
  // Expo Router can expose a synthetic root entry on a directly opened web
  // deep link. Treating it as real history sends users to `/mobile/?id=...`.
  // A deterministic parent route matches native-app back behavior on web.
  if (!isWeb && router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
