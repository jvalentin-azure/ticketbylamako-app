import { StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

export function EventDetailSkeleton() {
  const colors = useColors();
  const block = { backgroundColor: colors.border };

  return (
    <View
      accessibilityLabel="Chargement de l'événement"
      style={styles.container}
    >
      <View style={[styles.hero, block]} />
      <View style={styles.body}>
        <View style={[styles.eyebrow, block]} />
        <View style={[styles.title, block]} />
        <View style={[styles.titleShort, block]} />
        <View style={[styles.meta, block]} />
        <View style={[styles.ticket, block]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { width: "100%", height: 280 },
  body: { padding: 20 },
  eyebrow: { width: 112, height: 14, borderRadius: 4 },
  title: { width: "92%", height: 25, borderRadius: 4, marginTop: 14 },
  titleShort: { width: "64%", height: 25, borderRadius: 4, marginTop: 8 },
  meta: { width: "78%", height: 18, borderRadius: 4, marginTop: 18 },
  ticket: { width: "100%", height: 142, borderRadius: 8, marginTop: 28 },
});
