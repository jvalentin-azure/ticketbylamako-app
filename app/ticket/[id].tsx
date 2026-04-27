import { useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getOrder, type WCOrder } from "@/lib/api/woocommerce";
import { formatAriary, formatDateTime } from "@/lib/format";
import Svg, { Rect } from "react-native-svg";

// Simple QR-like visual (actual QR would need a library)
function QRPlaceholder({ value, size = 200, color }: { value: string; size?: number; color: string }) {
  // Generate a deterministic pattern from the ticket code
  const cells = 15;
  const cellSize = size / cells;
  const hash = value.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const rects: { x: number; y: number }[] = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const seed = (hash + r * 31 + c * 17) & 0xffffffff;
      if (seed % 3 !== 0 || r < 3 && c < 3 || r < 3 && c > cells - 4 || r > cells - 4 && c < 3) {
        rects.push({ x: c * cellSize, y: r * cellSize });
      }
    }
  }
  return (
    <View style={{ width: size, height: size, backgroundColor: "#fff", padding: 8, borderRadius: 12 }}>
      <Svg width={size - 16} height={size - 16} viewBox={`0 0 ${size} ${size}`}>
        {rects.map((r, i) => (
          <Rect key={i} x={r.x} y={r.y} width={cellSize - 1} height={cellSize - 1} fill={color} />
        ))}
      </Svg>
    </View>
  );
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const [order, setOrder] = useState<WCOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getOrder(Number(id)).then(o => { setOrder(o); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  if (!order) return <ScreenContainer className="flex-1 items-center justify-center"><Text style={{ color: colors.muted }}>Commande introuvable</Text></ScreenContainer>;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginLeft: 12 }}>Billet #{order.id}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {order.line_items.map((item, idx) => {
          const code = item.meta_data?.find((m: any) => m.key === "Ticket Code" || m.key === "_tc_ticket_code")?.value || `TKT-${order.id}-${item.id}`;
          const ticketType = item.meta_data?.find((m: any) => m.key === "Ticket Type" || m.key === "_tc_ticket_type_name")?.value || "Standard";
          const seat = item.meta_data?.find((m: any) => m.key === "Seat" || m.key === "_tc_seat_label")?.value;

          return (
            <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: "hidden" }}>
              {/* Ticket Header */}
              <View style={{ backgroundColor: colors.primary, padding: 16 }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }} numberOfLines={2}>{item.name}</Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>{ticketType}{seat ? ` - Siège ${seat}` : ""}</Text>
              </View>

              {/* QR Code */}
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <QRPlaceholder value={code} size={200} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginTop: 12, letterSpacing: 2 }}>{code}</Text>
              </View>

              {/* Ticket Info */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, borderStyle: "dashed", paddingTop: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Date d'achat</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{formatDateTime(order.date_created)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Montant</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{formatAriary(item.total)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Statut</Text>
                    <View style={{ backgroundColor: order.status === "completed" ? colors.success + "20" : colors.warning + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: order.status === "completed" ? colors.success : colors.warning, fontSize: 12, fontWeight: "600" }}>
                        {order.status === "completed" ? "Validé" : order.status === "processing" ? "Actif" : order.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}
