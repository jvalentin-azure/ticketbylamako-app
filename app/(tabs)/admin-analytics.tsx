import { useEffect, useState } from "react";
import { Text, View, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getAllOrders, type WCOrder } from "@/lib/api/woocommerce";
import { formatAriary } from "@/lib/format";

interface AnalyticsData {
  revenueByMonth: { month: string; amount: number }[];
  ordersByStatus: { status: string; count: number; color: string }[];
  avgOrderValue: number;
  conversionMetrics: { label: string; value: string; icon: any; color: string }[];
}

export default function AdminAnalyticsScreen() {
  const colors = useColors();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const orders = await getAllOrders({ per_page: "100" });

      // Revenue by month (last 6 months)
      const monthMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString("fr", { month: "short", year: "2-digit" });
        monthMap[key] = 0;
      }
      orders.forEach(o => {
        if (o.status === "completed" || o.status === "processing") {
          const d = new Date(o.date_created);
          const key = d.toLocaleDateString("fr", { month: "short", year: "2-digit" });
          if (monthMap[key] !== undefined) monthMap[key] += parseFloat(o.total || "0");
        }
      });
      const revenueByMonth = Object.entries(monthMap).map(([month, amount]) => ({ month, amount }));

      // Orders by status
      const statusCounts: Record<string, number> = {};
      orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
      const statusColors: Record<string, string> = { completed: "#22C55E", processing: "#F59E0B", "on-hold": "#6366F1", cancelled: "#EF4444", refunded: "#8B5CF6", pending: "#94A3B8", failed: "#DC2626" };
      const statusLabels: Record<string, string> = { completed: "Terminées", processing: "En cours", "on-hold": "En attente", cancelled: "Annulées", refunded: "Remboursées", pending: "En attente paiement", failed: "Échouées" };
      const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status: statusLabels[status] || status,
        count,
        color: statusColors[status] || "#94A3B8",
      })).sort((a, b) => b.count - a.count);

      // Average order value
      const validOrders = orders.filter(o => o.status === "completed" || o.status === "processing");
      const avgOrderValue = validOrders.length > 0 ? validOrders.reduce((s, o) => s + parseFloat(o.total || "0"), 0) / validOrders.length : 0;

      // Conversion metrics
      const totalOrders = orders.length;
      const completedOrders = orders.filter(o => o.status === "completed").length;
      const cancelledOrders = orders.filter(o => o.status === "cancelled").length;
      const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
      const cancelRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;

      setData({
        revenueByMonth,
        ordersByStatus,
        avgOrderValue,
        conversionMetrics: [
          { label: "Taux de complétion", value: `${completionRate}%`, icon: "checkmark.circle.fill", color: "#22C55E" },
          { label: "Taux d'annulation", value: `${cancelRate}%`, icon: "xmark.circle.fill", color: "#EF4444" },
          { label: "Panier moyen", value: formatAriary(avgOrderValue), icon: "cart.fill", color: colors.primary },
          { label: "Total commandes", value: String(totalOrders), icon: "clipboard.fill", color: "#6366F1" },
        ],
      });
    } catch (e) {
      console.error("Analytics error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) return <ScreenContainer edges={["left", "right"]} className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;

  const maxMonthRevenue = Math.max(...(data?.revenueByMonth.map(m => m.amount) || [1]));

  return (
    <ScreenContainer edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700", marginBottom: 20 }}>Analytics</Text>

        {/* Conversion Metrics */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {data?.conversionMetrics.map((metric, idx) => (
            <View key={idx} style={{ width: "48%", backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <IconSymbol name={metric.icon} size={18} color={metric.color} />
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>{metric.label}</Text>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800", marginTop: 2 }}>{metric.value}</Text>
            </View>
          ))}
        </View>

        {/* Revenue Chart */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold", marginBottom: 16 }}>Revenus (6 mois)</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 8 }}>
            {data?.revenueByMonth.map((month, idx) => {
              const height = maxMonthRevenue > 0 ? (month.amount / maxMonthRevenue) * 100 + 4 : 4;
              return (
                <View key={idx} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: colors.muted, fontSize: 9, marginBottom: 4 }}>{formatAriary(month.amount)}</Text>
                  <View style={{ width: "100%", height, backgroundColor: colors.primary, borderRadius: 4 }} />
                  <Text style={{ color: colors.muted, fontSize: 9, marginTop: 4 }}>{month.month}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Orders by Status */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold", marginBottom: 16 }}>Répartition des commandes</Text>
          {data?.ordersByStatus.map((item, idx) => {
            const totalOrders = data.ordersByStatus.reduce((s, i) => s + i.count, 0);
            const pct = totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0;
            return (
              <View key={idx} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "500" }}>{item.status}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.count} ({pct}%)</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3 }}>
                  <View style={{ height: 6, backgroundColor: item.color, borderRadius: 3, width: `${pct}%` }} />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
