import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getCustomerOrders, type WCOrder } from "@/lib/api/woocommerce";
import { formatAriary, formatDate } from "@/lib/format";

const statusMap: Record<string, { label: string; color: string }> = {
  completed: { label: "Terminée", color: "#22C55E" },
  processing: { label: "En cours", color: "#F59E0B" },
  "on-hold": { label: "En attente", color: "#6366F1" },
  pending: { label: "En attente", color: "#6366F1" },
  cancelled: { label: "Annulée", color: "#EF4444" },
  refunded: { label: "Remboursée", color: "#8B5CF6" },
  failed: { label: "Échouée", color: "#EF4444" },
};

export default function OrdersScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<WCOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    getCustomerOrders(user.id).then(o => { setOrders(o); setLoading(false); }).catch(() => setLoading(false));
  }, [user?.id]);

  if (!isAuthenticated) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600" }}>Connectez-vous pour voir vos commandes</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login" as any)} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 16 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700", marginLeft: 12 }}>Mes Commandes</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <IconSymbol name="clipboard.fill" size={48} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 16, marginTop: 12 }}>Aucune commande</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: order }) => {
            const st = statusMap[order.status] || { label: order.status, color: colors.muted };
            return (
              <TouchableOpacity
                onPress={() => router.push(`/ticket/${order.id}` as any)}
                style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>#{order.id}</Text>
                  <View style={{ backgroundColor: st.color + "20", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ color: st.color, fontSize: 12, fontWeight: "600" }}>{st.label}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{formatDate(order.date_created)}</Text>
                {order.line_items.map((li, i) => (
                  <Text key={i} style={{ color: colors.foreground, fontSize: 13, marginTop: 4 }} numberOfLines={1}>
                    {li.quantity}x {li.name}
                  </Text>
                ))}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{order.line_items.length} article(s)</Text>
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700" }}>{formatAriary(order.total)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}
