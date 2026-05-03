import { useEffect, useState } from "react";
import { Text, View, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getAllOrders, getProducts, type WCOrder, type WCProduct } from "@/lib/api/woocommerce";
import { formatAriary } from "@/lib/format";

interface AdminStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  todayRevenue: number;
  todayOrders: number;
  revenueByDay: { date: string; amount: number }[];
  topProducts: { name: string; sold: number; revenue: number }[];
}

export default function AdminDashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [orders, products] = await Promise.all([
        getAllOrders({ per_page: "100" }),
        getProducts({ per_page: "100" }),
      ]);

      const validOrders = orders.filter(o => o.status === "completed" || o.status === "processing");
      const totalRevenue = validOrders.reduce((s, o) => s + parseFloat(o.total || "0"), 0);

      // Today's stats
      const today = new Date().toISOString().split("T")[0];
      const todayOrders = validOrders.filter(o => o.date_created.startsWith(today));
      const todayRevenue = todayOrders.reduce((s, o) => s + parseFloat(o.total || "0"), 0);

      // Unique customers
      const customers = new Set(validOrders.map(o => o.billing.email));

      // Revenue by day (last 7 days)
      const days: { date: string; amount: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayRevenue = validOrders
          .filter(o => o.date_created.startsWith(dateStr))
          .reduce((s, o) => s + parseFloat(o.total || "0"), 0);
        days.push({ date: dateStr, amount: dayRevenue });
      }

      // Top products
      const productMap: Record<string, { name: string; sold: number; revenue: number }> = {};
      validOrders.forEach(o => {
        o.line_items.forEach(li => {
          const key = String(li.product_id);
          if (!productMap[key]) productMap[key] = { name: li.name, sold: 0, revenue: 0 };
          productMap[key].sold += li.quantity;
          productMap[key].revenue += parseFloat(li.total || "0");
        });
      });
      const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      setStats({
        totalRevenue,
        totalOrders: validOrders.length,
        totalProducts: products.length,
        totalCustomers: customers.size,
        todayRevenue,
        todayOrders: todayOrders.length,
        revenueByDay: days,
        topProducts,
      });
    } catch (e) {
      console.error("Admin dashboard error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) return <ScreenContainer edges={["left", "right"]} className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;

  const maxRevenue = Math.max(...(stats?.revenueByDay.map(d => d.amount) || [1]));

  return (
    <ScreenContainer edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.muted, fontSize: 14 }}>Administration</Text>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800" }}>Dashboard</Text>
        </View>

        {/* Today's highlight */}
        <View style={{ backgroundColor: colors.primary, borderRadius: 18, padding: 20, marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Revenus aujourd'hui</Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 4 }}>{formatAriary(stats?.todayRevenue || 0)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 }}>{stats?.todayOrders || 0} commande(s)</Text>
        </View>

        {/* Stats Grid */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="banknote.fill" size={18} color="#22C55E" />
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>Revenus totaux</Text>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>{formatAriary(stats?.totalRevenue || 0)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="clipboard.fill" size={18} color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>Commandes</Text>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>{stats?.totalOrders || 0}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="tag.fill" size={18} color="#6366F1" />
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>Produits</Text>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>{stats?.totalProducts || 0}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="person.2.fill" size={18} color="#F59E0B" />
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>Clients</Text>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>{stats?.totalCustomers || 0}</Text>
          </View>
        </View>

        {/* Revenue Chart (simple bar chart) */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 16 }}>Revenus (7 jours)</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 100, gap: 6 }}>
            {stats?.revenueByDay.map((day, idx) => {
              const height = maxRevenue > 0 ? (day.amount / maxRevenue) * 80 + 4 : 4;
              const isToday = idx === (stats?.revenueByDay.length || 0) - 1;
              return (
                <View key={idx} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ width: "100%", height, backgroundColor: isToday ? colors.primary : colors.primary + "40", borderRadius: 4 }} />
                  <Text style={{ color: colors.muted, fontSize: 9, marginTop: 4 }}>
                    {new Date(day.date).toLocaleDateString("fr", { weekday: "short" }).slice(0, 3)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Top Products */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Top Produits</Text>
          {stats?.topProducts.map((product, idx) => (
            <View key={idx} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{product.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{product.sold} vendus</Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>{formatAriary(product.revenue)}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/admin-orders" as any)}
            style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
          >
            <IconSymbol name="clipboard.fill" size={24} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginTop: 6 }}>Commandes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/scanner" as any)}
            style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
          >
            <IconSymbol name="qrcode.viewfinder" size={24} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginTop: 6 }}>Scanner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/participants" as any)}
            style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
          >
            <IconSymbol name="person.2.fill" size={24} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginTop: 6 }}>Participants</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
