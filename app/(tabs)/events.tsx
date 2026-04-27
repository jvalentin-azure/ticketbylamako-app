import { useEffect, useState, useCallback } from "react";
import { Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getEventsWithTickets, type TCEvent } from "@/lib/api/woocommerce";
import { formatAriary, formatDateShort, decodeHtmlEntities } from "@/lib/format";

export default function EventsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [events, setEvents] = useState<TCEvent[]>([]);
  const [filtered, setFiltered] = useState<TCEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const ev = await getEventsWithTickets();
      setEvents(ev);
      setFiltered(ev);
    } catch (e) {
      console.warn("Events load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(events); return; }
    const q = search.toLowerCase();
    setFiltered(events.filter(e => decodeHtmlEntities(e.title.rendered).toLowerCase().includes(q)));
  }, [search, events]);

  const renderEvent = ({ item }: { item: TCEvent }) => {
    const name = decodeHtmlEntities(item.title.rendered);
    const cats = item.categoryNames?.join(", ") || "";
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push(`/event/${item.id}` as any)}
        style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Image source={{ uri: item.featuredImage }} style={styles.eventImage} contentFit="cover" />
        {item.hasSeatingChart && (
          <View style={styles.seatingBadge}>
            <IconSymbol name="mappin" size={10} color="#fff" />
            <Text style={styles.seatingBadgeText}>Plan de salle</Text>
          </View>
        )}
        <View style={styles.eventBody}>
          <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={2}>{name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <IconSymbol name="clock" size={14} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>{formatDateShort(item.date)}</Text>
            </View>
            {cats ? (
              <View style={styles.metaItem}>
                <IconSymbol name="tag.fill" size={14} color={colors.muted} />
                <Text style={[styles.metaText, { color: colors.muted }]} numberOfLines={1}>{cats}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.priceRow}>
            {item.minPrice != null ? (
              <Text style={[styles.price, { color: colors.primary }]}>
                {item.minPrice === item.maxPrice
                  ? formatAriary(item.minPrice)
                  : `${formatAriary(item.minPrice)} – ${formatAriary(item.maxPrice!)}`}
              </Text>
            ) : (
              <Text style={[styles.price, { color: colors.muted }]}>Prix non défini</Text>
            )}
            <View style={[styles.buyButton, { backgroundColor: colors.primary }]}>
              <Text style={styles.buyButtonText}>Voir</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Événements</Text>
      </View>
      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          placeholder="Rechercher un événement..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderEvent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="calendar" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucun événement trouvé</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Raleway-Bold" },
  searchBar: { marginHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 15, fontFamily: "Raleway-Regular" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  eventCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  eventImage: { width: "100%", height: 160 },
  seatingBadge: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  seatingBadgeText: { color: "#fff", fontSize: 10, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  eventBody: { padding: 14 },
  eventTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center" },
  metaText: { fontSize: 12, marginLeft: 4, fontFamily: "Raleway-Regular" },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  price: { fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold" },
  buyButton: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  buyButtonText: { color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  emptyContainer: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, marginTop: 12, fontFamily: "Raleway-Medium" },
});
