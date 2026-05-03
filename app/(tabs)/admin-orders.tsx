import { useEffect, useState, useMemo } from "react";
import { Text, View, TouchableOpacity, FlatList, ActivityIndicator, TextInput, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getAllOrders, type WCOrder } from "@/lib/api/woocommerce";
import { formatAriary, formatDateTime } from "@/lib/format";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  completed: { label: "Terminée", color: "#22C55E", icon: "checkmark.circle.fill" },
  processing: { label: "En cours", color: "#F59E0B", icon: "clock.fill" },
  "on-hold": { label: "En attente", color: "#6366F1", icon: "pause.circle.fill" },
  pending: { label: "En attente", color: "#6366F1", icon: "pause.circle.fill" },
  cancelled: { label: "Annulée", color: "#EF4444", icon: "xmark.circle.fill" },
  refunded: { label: "Remboursée", color: "#8B5CF6", icon: "arrow.uturn.left.circle.fill" },
  failed: { label: "Échouée", color: "#EF4444", icon: "xmark.circle.fill" },
};

type FilterStatus = "all" | "completed" | "processing" | "on-hold" | "cancelled";

export default function AdminOrdersScreen() {
  const colors = useColors();
  const [orders, setOrders] = useState<WCOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");

  const loadData = async () => {
    try {
      const data = await getAllOrders({ per_page: "100" });
      setOrders(data);
    } catch (e) {
      console.error("Load orders error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const filtered = useMemo(() => {
    let list = orders;
    if (filter !== "all") list = list.filter(o => o.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        String(o.id).includes(q) ||
        `${o.billing.first_name} ${o.billing.last_name}`.toLowerCase().includes(q) ||
        o.billing.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, filter, search]);

  if (loading) return <ScreenContainer edges={["left", "right"]} className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;

  return (
    <ScreenContainer edges={["left", "right"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>Commandes</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{orders.length} commande(s) au total</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 44 }}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher par #, nom, email..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, marginLeft: 8, color: colors.foreground, fontSize: 14 }}
          />
        </View>
      </View>

      {/* Status Filters */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: "all", label: "Toutes" },
            { key: "processing", label: "En cours" },
            { key: "completed", label: "Terminées" },
            { key: "on-hold", label: "En attente" },
            { key: "cancelled", label: "Annulées" },
          ]}
          keyExtractor={i => i.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setFilter(item.key as FilterStatus)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8,
                backgroundColor: filter === item.key ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: filter === item.key ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: filter === item.key ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={filtered}
        keyExtractor={o => String(o.id)}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item: order }) => {
          const st = statusConfig[order.status] || { label: order.status, color: colors.muted, icon: "questionmark.circle.fill" };
          return (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <IconSymbol name={st.icon} size={18} color={st.color} />
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>#{order.id}</Text>
                </View>
                <View style={{ backgroundColor: st.color + "15", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ color: st.color, fontSize: 11, fontWeight: "600" }}>{st.label}</Text>
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "500" }}>
                  {order.billing.first_name} {order.billing.last_name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{order.billing.email}</Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{formatDateTime(order.date_created)}</Text>
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>{formatAriary(order.total)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <IconSymbol name="clipboard.fill" size={40} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>Aucune commande trouvée</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
