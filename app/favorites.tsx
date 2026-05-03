import { useState } from "react";
import { Text, View, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFavorites, type FavoriteItem } from "@/lib/favorites-provider";
import { timeAgo } from "@/lib/format";

type TabType = "all" | "events" | "products";

export default function FavoritesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { favorites, favoriteEvents, favoriteProducts, removeFavorite } = useFavorites();
  const [tab, setTab] = useState<TabType>("all");

  const data = tab === "events" ? favoriteEvents : tab === "products" ? favoriteProducts : favorites;

  const renderItem = ({ item }: { item: FavoriteItem }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        if (item.type === "event") {
          router.push(`/event/${item.id}` as any);
        } else {
          router.push(`/product/${item.id}` as any);
        }
      }}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: item.type === "event" ? colors.primary + "20" : "#c79f6c20" }]}>
            <Text style={[styles.typeBadgeText, { color: item.type === "event" ? colors.primary : "#c79f6c" }]}>
              {item.type === "event" ? "Événement" : "Produit"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => removeFavorite(item.id, item.type)}
            style={styles.removeBtn}
          >
            <IconSymbol name="heart.fill" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.cardDate, { color: colors.muted }]}>Ajouté {timeAgo(item.addedAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Mes Favoris</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {([
          { key: "all" as TabType, label: "Tous", count: favorites.length },
          { key: "events" as TabType, label: "Événements", count: favoriteEvents.length },
          { key: "products" as TabType, label: "Produits", count: favoriteProducts.length },
        ]).map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Text style={[styles.tabText, {
              color: tab === t.key ? colors.primary : colors.muted,
              fontWeight: tab === t.key ? "700" : "400",
            }]}>
              {t.label} ({t.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="heart" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>Aucun favori</Text>
            <Text style={[styles.emptySubText, { color: colors.muted }]}>
              Appuyez sur le coeur pour sauvegarder vos événements et produits préférés
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontSize: 13 },
  listContent: { padding: 16 },
  card: { flexDirection: "row", borderRadius: 14, overflow: "hidden", borderWidth: 1, marginBottom: 12 },
  cardImage: { width: 100, height: 100 },
  cardBody: { flex: 1, padding: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: "600" },
  removeBtn: { padding: 4 },
  cardTitle: { fontSize: 14, fontWeight: "600", marginTop: 6 },
  cardDate: { fontSize: 11, marginTop: 4 },
  emptyContainer: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
  emptyText: { fontSize: 16, marginTop: 16 },
  emptySubText: { fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 20 },
});
