import { useEffect, useState, useRef, useCallback } from "react";
import {
  ScrollView, Text, View, FlatList, Dimensions,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getEvents, getShopProducts, getEventMeta, type WCProduct } from "@/lib/api/woocommerce";
import { formatAriary, formatDateShort } from "@/lib/format";

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_H = 220;

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { itemCount } = useCart();
  const [events, setEvents] = useState<WCProduct[]>([]);
  const [products, setProducts] = useState<WCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const [ev, pr] = await Promise.all([getEvents(), getShopProducts({ per_page: "6" })]);
      setEvents(ev);
      setProducts(pr);
    } catch (e) {
      console.warn("Load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (events.length < 2) return;
    const timer = setInterval(() => {
      setHeroIndex(i => {
        const next = (i + 1) % Math.min(events.length, 5);
        heroRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [events.length]);

  const heroEvents = events.slice(0, 5);

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-3 text-sm">Chargement...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* HEADER */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>TicketByLamako</Text>
            {isAuthenticated && user && (
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>Bonjour, {user.firstName || user.displayName}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/shop" as any)} style={{ position: "relative" }}>
            <IconSymbol name="cart.fill" size={26} color={colors.foreground} />
            {itemCount > 0 && (
              <View style={{ position: "absolute", top: -6, right: -8, backgroundColor: colors.primary, borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{itemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* HERO CAROUSEL */}
        {heroEvents.length > 0 && (
          <View style={{ height: HERO_H, marginBottom: 8 }}>
            <FlatList
              ref={heroRef}
              data={heroEvents}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => String(item.id)}
              getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
              onMomentumScrollEnd={e => setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push(`/event/${item.id}` as any)}
                  style={{ width: SCREEN_W, height: HERO_H, paddingHorizontal: 16 }}
                >
                  <View style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}>
                    <Image source={{ uri: item.images?.[0]?.src }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "rgba(0,0,0,0.5)" }}>
                      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }} numberOfLines={1}>{item.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <IconSymbol name="clock" size={14} color="#C8A951" />
                        <Text style={{ color: "#C8A951", fontSize: 13, marginLeft: 4, fontWeight: "600" }}>
                          {getEventMeta(item, "event_date_time") ? formatDateShort(getEventMeta(item, "event_date_time")) : "Bientôt"}
                        </Text>
                        <Text style={{ color: "#fff", fontSize: 13, marginLeft: "auto", fontWeight: "600" }}>{formatAriary(item.price)}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 8 }}>
              {heroEvents.map((_, i) => (
                <View key={i} style={{ width: heroIndex === i ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: heroIndex === i ? colors.primary : colors.border, marginHorizontal: 3 }} />
              ))}
            </View>
          </View>
        )}

        {/* CATEGORY CHIPS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
          {["Tous", "Concert", "Théâtre", "Festival", "Formation", "Sport"].map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => router.push("/(tabs)/events" as any)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: cat === "Tous" ? colors.primary : colors.surface, borderWidth: 1, borderColor: cat === "Tous" ? colors.primary : colors.border }}
            >
              <Text style={{ color: cat === "Tous" ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* UPCOMING EVENTS */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Événements à venir</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/events" as any)}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Voir tout</Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={events.slice(0, 10)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/event/${item.id}` as any)}
              style={{ width: 180, borderRadius: 14, backgroundColor: colors.surface, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}
            >
              <Image source={{ uri: item.images?.[0]?.src }} style={{ width: 180, height: 120 }} contentFit="cover" />
              <View style={{ padding: 10 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }} numberOfLines={2}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {getEventMeta(item, "event_date_time") ? formatDateShort(getEventMeta(item, "event_date_time")) : ""}
                </Text>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", marginTop: 4 }}>{formatAriary(item.price)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />

        {/* SHOP HIGHLIGHTS */}
        {products.length > 0 && (
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Boutique</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/shop" as any)}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {products.slice(0, 4).map(p => (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/product/${p.id}` as any)}
                  style={{ width: (SCREEN_W - 44) / 2, borderRadius: 14, backgroundColor: colors.surface, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}
                >
                  <Image source={{ uri: p.images?.[0]?.src }} style={{ width: "100%", height: 120 }} contentFit="cover" />
                  <View style={{ padding: 10 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }} numberOfLines={2}>{p.name}</Text>
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", marginTop: 4 }}>{formatAriary(p.price)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* LOGIN CTA */}
        {!isAuthenticated && (
          <View style={{ marginHorizontal: 16, marginTop: 24, padding: 20, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>Connectez-vous pour accéder à vos billets</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Gérez vos commandes et billets QR depuis l'app</Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/login" as any)}
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, marginTop: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}
