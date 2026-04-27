import { useEffect, useState, useCallback } from "react";
import { Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getEvents, getEventMeta, type WCProduct } from "@/lib/api/woocommerce";
import { formatAriary, formatDateShort, stripHtml } from "@/lib/format";

export default function EventsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [events, setEvents] = useState<WCProduct[]>([]);
  const [filtered, setFiltered] = useState<WCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const ev = await getEvents();
      setEvents(ev);
      setFiltered(ev);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(events); return; }
    const q = search.toLowerCase();
    setFiltered(events.filter(e => e.name.toLowerCase().includes(q)));
  }, [search, events]);

  const renderEvent = ({ item }: { item: WCProduct }) => {
    const date = getEventMeta(item, "event_date_time");
    const location = getEventMeta(item, "event_location");
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push(`/event/${item.id}` as any)}
        style={{ marginHorizontal: 16, marginBottom: 14, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}
      >
        <Image source={{ uri: item.images?.[0]?.src }} style={{ width: "100%", height: 160 }} contentFit="cover" />
        <View style={{ padding: 14 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }} numberOfLines={2}>{item.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 12 }}>
            {date && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <IconSymbol name="clock" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>{formatDateShort(date)}</Text>
              </View>
            )}
            {location && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <IconSymbol name="mappin" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }} numberOfLines={1}>{location}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700" }}>{formatAriary(item.price)}</Text>
            <View style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Acheter</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>Événements</Text>
      </View>
      {/* Search */}
      <View style={{ marginHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border }}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          placeholder="Rechercher un événement..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: colors.foreground, fontSize: 15 }}
        />
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderEvent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <IconSymbol name="calendar" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 15, marginTop: 12 }}>Aucun événement trouvé</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
