import { useEffect, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const CATALOG_IMAGE_PLACEHOLDER = "|rF?hV%2WCj[ayj[a|j[azj[ayj[";

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
  const preferredUri = optimizedUri || uri || null;
  const [activeUri, setActiveUri] = useState(preferredUri);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setActiveUri(preferredUri);
    setFailed(false);
  }, [preferredUri, uri]);

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
            if (uri && activeUri !== uri) {
              setActiveUri(uri);
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
