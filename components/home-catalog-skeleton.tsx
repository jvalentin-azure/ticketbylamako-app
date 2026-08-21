import { StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

export function HomeCatalogSkeleton() {
  const colors = useColors();
  const block = { backgroundColor: colors.border };

  return (
    <View
      accessibilityLabel="Chargement des événements"
      style={styles.container}
    >
      <View style={[styles.hero, block]} />
      <View style={[styles.heading, block]} />
      <View style={styles.row}>
        <View style={[styles.poster, block]} />
        <View style={[styles.poster, block]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  hero: { height: 220, borderRadius: 8 },
  heading: { width: 180, height: 20, borderRadius: 4, marginTop: 24 },
  row: { flexDirection: "row", gap: 12, marginTop: 16 },
  poster: { flex: 1, aspectRatio: 4 / 5, borderRadius: 8 },
});
