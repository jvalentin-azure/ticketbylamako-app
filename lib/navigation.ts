import type { Href, Router } from "expo-router";

export const DRAWER_HOME_ORIGIN_PARAM = "fromDrawer";

/**
 * Preserve normal history, but keep app-style back navigation working when a
 * mobile web screen was opened directly and has no router history.
 */
export function goBackOrFallback(
  router: Router,
  fallback: Href,
  isWeb = typeof document !== "undefined",
  locationSearch =
    isWeb && typeof window !== "undefined" ? window.location.search : "",
): void {
  // Expo Router can expose a synthetic root entry on a directly opened web
  // deep link. Treating it as real history sends users to `/mobile/?id=...`.
  // A deterministic parent route matches native-app back behavior on web.
  if (!isWeb && router.canGoBack()) {
    router.back();
    return;
  }

  const openedFromDrawer =
    isWeb &&
    new URLSearchParams(locationSearch).get(DRAWER_HOME_ORIGIN_PARAM) === "1";
  router.replace(openedFromDrawer ? "/(tabs)/" : fallback);
}
