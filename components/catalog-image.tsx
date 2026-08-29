import { useEffect, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  CATALOG_IMAGE_PLACEHOLDER,
  resolveCatalogImageSources,
} from "@/lib/catalog-image-state";

interface CatalogImageProps {
  uri?: string | null;
  optimizedUri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: "cover" | "contain";
  accessibilityLabel: string;
  recyclingKey?: string;
}

export function CatalogImage({
  uri,
  optimizedUri,
  style,
  contentFit = "cover",
  accessibilityLabel,
  recyclingKey,
}: CatalogImageProps) {
  const colors = useColors();
  const { preferredUri, fallbackUri } = resolveCatalogImageSources(
    optimizedUri,
    uri,
  );
  const [activeUri, setActiveUri] = useState(preferredUri);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setActiveUri(preferredUri);
    setFailed(false);
  }, [fallbackUri, preferredUri]);

  return (
    <View
      style={[styles.frame, { backgroundColor: colors.border }, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {activeUri && !failed ? (
        <Image
          source={{ uri: activeUri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          placeholder={CATALOG_IMAGE_PLACEHOLDER}
          placeholderContentFit={contentFit}
          transition={{ duration: 160, effect: "cross-dissolve" }}
          recyclingKey={recyclingKey || activeUri}
          onError={() => {
            if (fallbackUri && activeUri !== fallbackUri) {
              setActiveUri(fallbackUri);
              return;
            }
            setFailed(true);
          }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <IconSymbol name="photo" size={28} color={colors.muted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
