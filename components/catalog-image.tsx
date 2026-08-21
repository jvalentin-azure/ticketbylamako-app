import { useEffect, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

interface CatalogImageProps {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: "cover" | "contain";
  accessibilityLabel: string;
  recyclingKey?: string;
}

export function CatalogImage({
  uri,
  style,
  contentFit = "cover",
  accessibilityLabel,
  recyclingKey,
}: CatalogImageProps) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  return (
    <View
      style={[styles.frame, { backgroundColor: colors.border }, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          transition={180}
          recyclingKey={recyclingKey || uri}
          onError={() => setFailed(true)}
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
