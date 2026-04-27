import { useEffect, useState } from "react";
import { Text, View, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getAllOrders, getProducts, type WCOrder } from "@/lib/api/woocommerce";
import { formatAriary } from "@/lib/format";

interface EventReport {
  name: string;
  ticketsSold: number;
  revenue: number;
  checkedIn: number;
  checkInRate: number;
}

export default function ReportsScreen() {
  const colors = useColors();
  const [reports, setReports] = useState<EventReport[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const orders = await getAllOrders({ per_page: "100", status: "completed,processing" });

      // Group by event/product
      const eventMap: Record<string, { name: string; tickets: number; revenue: number; checkedIn: number }> = {};

      orders.forEach(order => {
        order.line_items.forEach(item => {
          const key = String(item.product_id);
          if (!eventMap[key]) {
            eventMap[key] = { name: item.name, tickets: 0, revenue: 0, checkedIn: 0 };
          }
          eventMap[key].tickets += item.quantity;
          eventMap[key].revenue += parseFloat(item.total || "0");

          const checkedIn = item.meta_data?.find(m => m.key === "_tc_checked_in")?.value;
          if (checkedIn) eventMap[key].checkedIn += item.quantity;
        });
      });

      const eventReports = Object.values(eventMap)
        .map(e => ({
          name: e.name,
          ticketsSold: e.tickets,
          revenue: e.revenue,
          checkedIn: e.checkedIn,
          checkInRate: e.tickets > 0 ? Math.round((e.checkedIn / e.tickets) * 100) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      setReports(eventReports);
      setTotalRevenue(eventReports.reduce((s, r) => s + r.revenue, 0));
      setTotalTickets(eventReports.reduce((s, r) => s + r.ticketsSold, 0));
    } catch (e) {
      console.error("Reports load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700", marginBottom: 20 }}>Rapports</Text>

        {/* Summary Cards */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="banknote.fill" size={20} color="#22C55E" />
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Revenus totaux</Text>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800", marginTop: 4 }}>{formatAriary(totalRevenue)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="ticket.fill" size={20} color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Billets vendus</Text>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800", marginTop: 4 }}>{totalTickets}</Text>
          </View>
        </View>

        {/* Event Reports */}
        <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Par événement</Text>
        {reports.map((report, idx) => (
          <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", marginBottom: 10 }} numberOfLines={2}>{report.name}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "800" }}>{report.ticketsSold}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Vendus</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#22C55E", fontSize: 16, fontWeight: "800" }}>{formatAriary(report.revenue)}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Revenus</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#F59E0B", fontSize: 16, fontWeight: "800" }}>{report.checkInRate}%</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Check-in</Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 12 }}>
              <View style={{ height: 4, backgroundColor: "#22C55E", borderRadius: 2, width: `${report.checkInRate}%` }} />
            </View>
          </View>
        ))}

        {reports.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <IconSymbol name="chart.bar.fill" size={40} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>Aucune donnée disponible</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
