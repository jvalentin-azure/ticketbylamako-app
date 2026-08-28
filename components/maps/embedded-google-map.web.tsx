import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function EmbeddedGoogleMap({
  location,
  mapQuery,
  height = 210,
}: {
  location: string;
  mapQuery?: string;
  height?: number;
}) {
  const colors = useColors();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const normalizedLocation = location.trim();
  const normalizedMapQuery = mapQuery?.trim() || normalizedLocation;
  const encodedLocation = encodeURIComponent(normalizedMapQuery);
  const embedUrl = useMemo(
    () => `https://www.google.com/maps?q=${encodedLocation}&output=embed`,
    [encodedLocation],
  );
  const directionsUrl = useMemo(
    () =>
      `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`,
    [encodedLocation],
  );

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
        {!failed ? (
          <iframe
            src={embedUrl}
            title={`Carte Google Maps de ${normalizedLocation}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={styles.iframe}
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
        {!loaded && !failed ? (
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
        onPress={() => void Linking.openURL(directionsUrl)}
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
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  iframe: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { fontSize: 12, marginTop: 8, fontFamily: "Raleway_500Medium" },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  fallbackTitle: {
    fontSize: 14,
    fontFamily: "Raleway_700Bold",
    marginTop: 10,
  },
  fallbackCopy: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
    fontFamily: "Raleway_500Medium",
  },
  directionsButton: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  directionsCopy: { flex: 1, marginHorizontal: 11 },
  directionsTitle: { fontSize: 14, fontFamily: "Raleway_700Bold" },
  directionsHint: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: "Raleway_500Medium",
  },
});
