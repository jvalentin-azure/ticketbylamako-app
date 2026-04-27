import { useEffect, useState, useMemo } from "react";
import { Text, View, TouchableOpacity, FlatList, ActivityIndicator, TextInput, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getAllOrders, type WCOrder } from "@/lib/api/woocommerce";
import { formatDate } from "@/lib/format";

interface Participant {
  id: string;
  name: string;
  email: string;
  phone: string;
  ticketType: string;
  eventName: string;
  orderDate: string;
  status: "checked_in" | "not_checked" | "cancelled";
  seatLabel?: string;
}

export default function ParticipantsScreen() {
  const colors = useColors();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "checked_in" | "not_checked">("all");

  const loadData = async () => {
    try {
      const orders = await getAllOrders({ per_page: "100", status: "completed,processing" });
      const parts: Participant[] = [];

      orders.forEach(order => {
        order.line_items.forEach(item => {
          const ticketCode = item.meta_data?.find(m => m.key === "Ticket Code" || m.key === "_tc_ticket_code")?.value;
          const ticketType = item.meta_data?.find(m => m.key === "Ticket Type" || m.key === "_tc_ticket_type_name")?.value;
          const seat = item.meta_data?.find(m => m.key === "Seat" || m.key === "_tc_seat_label")?.value;
          const checkedIn = item.meta_data?.find(m => m.key === "_tc_checked_in")?.value;

          parts.push({
            id: ticketCode || `${order.id}-${item.id}`,
            name: `${order.billing.first_name} ${order.billing.last_name}`,
            email: order.billing.email,
            phone: order.billing.phone || "",
            ticketType: ticketType || item.name,
            eventName: item.name,
            orderDate: order.date_created,
            status: order.status === "cancelled" ? "cancelled" : checkedIn ? "checked_in" : "not_checked",
            seatLabel: seat,
          });
        });
      });

      setParticipants(parts);
    } catch (e) {
      console.error("Load participants error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const filtered = useMemo(() => {
    let list = participants;
    if (filter !== "all") list = list.filter(p => p.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    return list;
  }, [participants, filter, search]);

  const stats = useMemo(() => ({
    total: participants.length,
    checkedIn: participants.filter(p => p.status === "checked_in").length,
    notChecked: participants.filter(p => p.status === "not_checked").length,
  }), [participants]);

  if (loading) return <ScreenContainer edges={["left", "right"]} className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;

  return (
    <ScreenContainer edges={["left", "right"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>Participants</Text>
        <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Total: <Text style={{ color: colors.foreground, fontWeight: "700" }}>{stats.total}</Text></Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Scannés: <Text style={{ color: "#22C55E", fontWeight: "700" }}>{stats.checkedIn}</Text></Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>En attente: <Text style={{ color: "#F59E0B", fontWeight: "700" }}>{stats.notChecked}</Text></Text>
        </View>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 44 }}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher par nom, email, code..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, marginLeft: 8, color: colors.foreground, fontSize: 14 }}
          />
        </View>
      </View>

      {/* Filters */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 12, gap: 8 }}>
        {(["all", "checked_in", "not_checked"] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
              backgroundColor: filter === f ? colors.primary : colors.surface,
              borderWidth: 1, borderColor: filter === f ? colors.primary : colors.border,
            }}
          >
            <Text style={{ color: filter === f ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
              {f === "all" ? "Tous" : f === "checked_in" ? "Scannés" : "En attente"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }}>
            {/* Status indicator */}
            <View style={{
              width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 12,
              backgroundColor: item.status === "checked_in" ? "#22C55E15" : item.status === "cancelled" ? "#EF444415" : "#F59E0B15",
            }}>
              <IconSymbol
                name={item.status === "checked_in" ? "checkmark.circle.fill" : item.status === "cancelled" ? "xmark.circle.fill" : "clock.fill"}
                size={18}
                color={item.status === "checked_in" ? "#22C55E" : item.status === "cancelled" ? "#EF4444" : "#F59E0B"}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" }}>{item.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.ticketType}{item.seatLabel ? ` - ${item.seatLabel}` : ""}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{item.email}</Text>
            </View>

            <Text style={{ color: colors.muted, fontSize: 11 }}>{formatDate(item.orderDate)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <IconSymbol name="person.2.fill" size={40} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>Aucun participant trouvé</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
