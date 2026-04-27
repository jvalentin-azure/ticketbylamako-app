import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getProducts, getAllOrders, type WCProduct, type WCOrder } from "@/lib/api/woocommerce";
import { formatAriary } from "@/lib/format";

interface DashStats {
  totalEvents: number;
  totalTicketsSold: number;
  totalRevenue: number;
  todayCheckins: number;
  recentOrders: WCOrder[];
}

export default function OrgDashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [products, orders] = await Promise.all([
        getProducts({ per_page: "50" }),
        getAllOrders({ per_page: "20" }),
      ]);

      // Filter events (products with tc_is_event meta or specific category)
      const events = products.filter(p => 
        p.categories?.some((c: any) => c.slug?.includes("event") || c.slug?.includes("billet")) ||
        p.meta_data?.some((m: any) => m.key === "_tc_is_event")
      );

      const totalRevenue = orders
        .filter(o => o.status === "completed" || o.status === "processing")
        .reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);

      const totalTicketsSold = orders
        .filter(o => o.status === "completed" || o.status === "processing")
        .reduce((sum, o) => sum + o.line_items.reduce((s, li) => s + li.quantity, 0), 0);

      setStats({
        totalEvents: events.length,
        totalTicketsSold,
        totalRevenue,
        todayCheckins: 0, // Will come from Tickera API
        recentOrders: orders.slice(0, 5),
      });
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const StatCard = ({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) => (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + "15", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <IconSymbol name={icon} size={18} color={color} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}>{value}</Text>
    </View>
  );

  if (loading) {
    return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.muted, fontSize: 14 }}>Bonjour,</Text>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800" }}>{user?.firstName || "Organisateur"}</Text>
        </View>

        {/* Quick Actions */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/scanner" as any)}
            style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <IconSymbol name="qrcode.viewfinder" size={22} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Scanner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/participants" as any)}
            style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.border }}
          >
            <IconSymbol name="person.2.fill" size={22} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>Participants</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <StatCard icon="calendar.badge.clock" label="Événements" value={String(stats?.totalEvents || 0)} color="#6366F1" />
          <StatCard icon="ticket.fill" label="Billets vendus" value={String(stats?.totalTicketsSold || 0)} color={colors.primary} />
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          <StatCard icon="banknote.fill" label="Revenus" value={formatAriary(stats?.totalRevenue || 0)} color="#22C55E" />
          <StatCard icon="checkmark.circle.fill" label="Check-ins" value={String(stats?.todayCheckins || 0)} color="#F59E0B" />
        </View>

        {/* Recent Orders */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Commandes récentes</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/admin-orders" as any)}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {stats?.recentOrders.map(order => (
            <View key={order.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>#{order.id} - {order.billing?.first_name} {order.billing?.last_name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{order.line_items.length} article(s)</Text>
                </View>
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>{formatAriary(order.total)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
