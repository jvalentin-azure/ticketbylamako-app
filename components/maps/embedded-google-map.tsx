import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

let WebViewComponent: any = null;
if (Platform.OS !== "web") {
  try {
    WebViewComponent = require("react-native-webview").default;
  } catch {
    WebViewComponent = null;
  }
}

function isGoogleMapsNavigation(rawUrl: string): boolean {
  if (rawUrl === "about:blank") return true;

  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === "google.com" || hostname.endsWith(".google.com"))
    );
  } catch {
    return false;
  }
}

function buildMapHtml(embedUrl: string): string {
  const safeEmbedUrl = embedUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src https://www.google.com https://maps.google.com; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
    <style>
      html, body, iframe { width: 100%; height: 100%; margin: 0; padding: 0; border: 0; overflow: hidden; background: #f5f3f0; }
    </style>
  </head>
  <body>
    <iframe
      title="Carte Google Maps"
      src="${safeEmbedUrl}"
      loading="eager"
      referrerpolicy="no-referrer-when-downgrade"
      allowfullscreen
      onload="window.ReactNativeWebView && window.ReactNativeWebView.postMessage('map-loaded')"
      onerror="window.ReactNativeWebView && window.ReactNativeWebView.postMessage('map-error')"
    ></iframe>
  </body>
</html>`;
}

export function EmbeddedGoogleMap({
  location,
  height = 210,
}: {
  location: string;
  height?: number;
}) {
  const colors = useColors();
  const [sourceMode, setSourceMode] = useState<
    "public" | "public-alternate" | "failed"
  >("public");
  const [loaded, setLoaded] = useState(false);
  const normalizedLocation = location.trim();
  const encodedLocation = encodeURIComponent(normalizedLocation);
  const publicEmbedUrl = useMemo(
    () => `https://www.google.com/maps?q=${encodedLocation}&output=embed`,
    [encodedLocation],
  );
  const alternateEmbedUrl = useMemo(
    () =>
      `https://maps.google.com/maps?q=${encodedLocation}&z=15&output=embed`,
    [encodedLocation],
  );
  const embedUrl =
    sourceMode === "public"
      ? publicEmbedUrl
      : sourceMode === "public-alternate"
        ? alternateEmbedUrl
        : "";
  const mapHtml = useMemo(
    () => (embedUrl ? buildMapHtml(embedUrl) : ""),
    [embedUrl],
  );
  const directionsUrl = useMemo(
    () =>
      `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`,
    [encodedLocation],
  );

  useEffect(() => {
    setSourceMode("public");
    setLoaded(false);
  }, [normalizedLocation]);

  const handleMapFailure = () => {
    setLoaded(false);
    setSourceMode((current) =>
      current === "public" ? "public-alternate" : "failed",
    );
  };

  const openDirections = () => {
    void Linking.openURL(directionsUrl);
  };

  return (
    <View style={styles.wrapper}>
      <View
        accessibilityLabel={`Carte Google Maps de ${normalizedLocation}`}
        style={[
          styles.mapFrame,
          {
            height,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {WebViewComponent && mapHtml ? (
          <WebViewComponent
            source={{ html: mapHtml, baseUrl: "https://www.google.com" }}
            style={styles.webView}
            originWhitelist={["https://*"]}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            setSupportMultipleWindows={false}
            onLoadStart={() => setLoaded(false)}
            onError={handleMapFailure}
            onHttpError={handleMapFailure}
            onMessage={(event: { nativeEvent: { data: string } }) => {
              if (event.nativeEvent.data === "map-loaded") {
                setLoaded(true);
              } else if (event.nativeEvent.data === "map-error") {
                handleMapFailure();
              }
            }}
            onShouldStartLoadWithRequest={(request: { url: string }) =>
              isGoogleMapsNavigation(request.url)
            }
          />
        ) : (
          <View style={styles.fallback}>
            <IconSymbol name="map.fill" size={30} color={colors.primary} />
            <Text style={[styles.fallbackTitle, { color: colors.foreground }]}>
              Carte indisponible
            </Text>
            <Text style={[styles.fallbackCopy, { color: colors.muted }]}>
              Ouvrez l’itinéraire pour localiser ce lieu.
            </Text>
          </View>
        )}
        {WebViewComponent && mapHtml && !loaded ? (
          <View style={[styles.loading, { backgroundColor: colors.surface }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>
              Chargement de la carte…
            </Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel={`Afficher l'itinéraire Google Maps vers ${normalizedLocation}`}
        onPress={openDirections}
        style={[
          styles.directionsButton,
          {
            backgroundColor: colors.primary + "10",
            borderColor: colors.primary + "35",
          },
        ]}
      >
        <IconSymbol name="location.fill" size={20} color={colors.primary} />
        <View style={styles.directionsCopy}>
          <Text style={[styles.directionsTitle, { color: colors.foreground }]}>
            Itinéraire vers le lieu
          </Text>
          <Text style={[styles.directionsHint, { color: colors.muted }]}>
            Ouvrir le trajet dans Google Maps
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 14 },
  mapFrame: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  webView: { width: "100%", height: "100%" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { fontSize: 12, marginTop: 8 },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  fallbackTitle: { fontSize: 14, fontWeight: "700", marginTop: 10 },
  fallbackCopy: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
  },
  directionsButton: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  directionsCopy: { flex: 1, marginHorizontal: 11 },
  directionsTitle: { fontSize: 14, fontWeight: "700" },
  directionsHint: { fontSize: 11, marginTop: 2 },
});
