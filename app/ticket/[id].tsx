import { useEffect, useState, useRef } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, Platform, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getMobileOrder, getMobileOrderTickets } from "@/lib/api/mobile";
import { mobileOrderToWCOrder, mobileTicketToTicketInstance } from "@/lib/order-adapters";
import type { WCOrder, TicketInstance } from "@/lib/types/commerce";
import { formatAriary, formatDate, formatDateTime, decodeHtmlEntities } from "@/lib/format";
import QRCode from "react-native-qrcode-svg";

const { width: SCREEN_W } = Dimensions.get("window");

const statusMap: Record<string, { label: string; color: string }> = {
  completed: { label: "Validé", color: "#22C55E" },
  processing: { label: "Actif", color: "#F59E0B" },
  "on-hold": { label: "En attente", color: "#6366F1" },
  pending: { label: "En attente", color: "#6366F1" },
  cancelled: { label: "Annulé", color: "#EF4444" },
  refunded: { label: "Remboursé", color: "#8B5CF6" },
  failed: { label: "Échoué", color: "#EF4444" },
};

const ticketVisibleStatuses = new Set(["completed", "processing", "cs-complete"]);

function TicketCard({ ticket, order, index, total, colors }: { ticket: TicketInstance; order: WCOrder; index: number; total: number; colors: any }) {
  const st = statusMap[order.status] || { label: order.status, color: colors.muted };
  const isValid = order.status === "completed" || order.status === "processing";
  const qrValue = ticket.ticket_code;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Billet ${decodeHtmlEntities(ticket.product_name)}${ticket.seat_label ? ` - Siège ${ticket.seat_label}` : ""}\nCode: ${ticket.ticket_code}\nCommande #${order.id}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Ticket Header */}
      <View style={[styles.ticketHeader, { backgroundColor: isValid ? colors.primary : colors.muted }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ticketHeaderTitle} numberOfLines={2}>{decodeHtmlEntities(ticket.product_name)}</Text>
          {ticket.event_name ? (
            <Text style={styles.ticketHeaderSub}>{decodeHtmlEntities(ticket.event_name)}</Text>
          ) : null}
        </View>
        {total > 1 && (
          <View style={styles.ticketBadge}>
            <Text style={styles.ticketBadgeText}>{index + 1}/{total}</Text>
          </View>
        )}
      </View>

      {/* QR Code Section */}
      <View style={styles.qrSection}>
        {isValid ? (
          <>
            <View style={styles.qrContainer}>
              <QRCode
                value={qrValue}
                size={180}
                backgroundColor="#fff"
                color="#000"
              />
            </View>
            <Text style={[styles.ticketCode, { color: colors.foreground }]}>{ticket.ticket_code}</Text>
            <Text style={[styles.qrHint, { color: colors.muted }]}>Présentez ce QR code à l'entrée</Text>
          </>
        ) : (
          <View style={styles.invalidQr}>
            <IconSymbol name="xmark.circle.fill" size={48} color={colors.muted} />
            <Text style={[styles.invalidText, { color: colors.muted }]}>Billet non valide</Text>
            <Text style={[styles.invalidSub, { color: colors.muted }]}>Statut: {st.label}</Text>
          </View>
        )}
      </View>

      {/* Dashed separator */}
      <View style={[styles.dashedSep, { borderColor: colors.border }]} />

      {/* Ticket Details */}
      <View style={styles.detailsSection}>
        {/* Seat info */}
        {ticket.seat_label ? (
          <View style={[styles.seatRow, { backgroundColor: "#663d17" + "12" }]}>
            <IconSymbol name="mappin" size={16} color="#663d17" />
            <Text style={[styles.seatLabel, { color: "#663d17" }]}>Siège {ticket.seat_label}</Text>
          </View>
        ) : null}

        {/* Info grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Commande</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>#{order.number || order.id}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Prix</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatAriary(String(ticket.price))}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Date d'achat</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatDate(order.date_created)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Statut</Text>
            <View style={[styles.statusPill, { backgroundColor: st.color + "15" }]}>
              <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>
          {ticket.event_date ? (
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Date événement</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{ticket.event_date}</Text>
            </View>
          ) : null}
          {ticket.event_location ? (
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Lieu</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{decodeHtmlEntities(ticket.event_location)}</Text>
            </View>
          ) : null}
        </View>

        {/* Attendee info */}
        <View style={[styles.attendeeRow, { borderTopColor: colors.border }]}>
          <IconSymbol name="person.fill" size={14} color={colors.muted} />
          <Text style={[styles.attendeeName, { color: colors.foreground }]}>
            {order.billing.first_name} {order.billing.last_name}
          </Text>
          <Text style={[styles.attendeeEmail, { color: colors.muted }]}>{order.billing.email}</Text>
        </View>
      </View>

      {/* Share button */}
      <TouchableOpacity onPress={handleShare} style={[styles.shareBtn, { borderTopColor: colors.border }]} activeOpacity={0.7}>
        <IconSymbol name="square.and.arrow.up" size={16} color={colors.primary} />
        <Text style={[styles.shareBtnText, { color: colors.primary }]}>Partager ce billet</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TicketDetailScreen() {
  const { id, ticketCode } = useLocalSearchParams<{ id: string; ticketCode?: string }>();
  const colors = useColors();
  const router = useRouter();
  const [order, setOrder] = useState<WCOrder | null>(null);
  const [tickets, setTickets] = useState<TicketInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    
    async function loadData() {
      try {
        const orderData = mobileOrderToWCOrder(await getMobileOrder(Number(id)));
        setOrder(orderData);

        if (ticketVisibleStatuses.has(orderData.status)) {
          const apiTickets = await getMobileOrderTickets(Number(id));
          if (apiTickets && apiTickets.tickets.length > 0) {
            setTickets(apiTickets.tickets.map(mobileTicketToTicketInstance));
          }
        }
      } catch {
        // Minimal fallback
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [id]);

  // If a specific ticket code was requested, scroll to it
  useEffect(() => {
    if (ticketCode && tickets.length > 0) {
      const idx = tickets.findIndex(t => t.ticket_code === ticketCode);
      if (idx >= 0) {
        setActiveIndex(idx);
        setTimeout(() => {
          scrollRef.current?.scrollTo({ x: idx * (SCREEN_W - 32), animated: true });
        }, 300);
      }
    }
  }, [ticketCode, tickets]);

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.muted, marginTop: 12 }}>Chargement des billets...</Text>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <IconSymbol name="ticket.fill" size={48} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 16, marginTop: 12 }}>Commande introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary }}>Retour</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (tickets.length === 0) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Billets</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <IconSymbol name="ticket.fill" size={48} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 16, marginTop: 12, textAlign: "center" }}>
            Aucun billet trouvé pour cette commande
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {tickets.length === 1 ? "Mon Billet" : `Mes Billets (${tickets.length})`}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Ticket pagination dots */}
      {tickets.length > 1 && (
        <View style={styles.dotsRow}>
          {tickets.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === activeIndex ? colors.primary : colors.border }]} />
          ))}
        </View>
      )}

      {/* Tickets horizontal scroll */}
      {tickets.length === 1 ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <TicketCard ticket={tickets[0]} order={order} index={0} total={1} colors={colors} />
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 32));
            setActiveIndex(Math.max(0, Math.min(idx, tickets.length - 1)));
          }}
          contentContainerStyle={{ paddingVertical: 16 }}
        >
          {tickets.map((ticket, i) => (
            <ScrollView key={i} style={{ width: SCREEN_W - 32, marginHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              <TicketCard ticket={ticket} order={order} index={i} total={tickets.length} colors={colors} />
            </ScrollView>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  dotsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  ticketCard: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  ticketHeader: { padding: 20, paddingBottom: 16, flexDirection: "row", alignItems: "flex-start" },
  ticketHeaderTitle: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1 },
  ticketHeaderSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 },
  ticketBadge: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  ticketBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  qrSection: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16 },
  qrContainer: { padding: 12, backgroundColor: "#fff", borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  ticketCode: { fontSize: 16, fontWeight: "700", marginTop: 14, letterSpacing: 1.5 },
  qrHint: { fontSize: 12, marginTop: 6 },
  invalidQr: { alignItems: "center", paddingVertical: 20 },
  invalidText: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  invalidSub: { fontSize: 13, marginTop: 4 },
  dashedSep: { borderTopWidth: 1, borderStyle: "dashed", marginHorizontal: 16 },
  detailsSection: { padding: 16 },
  seatRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginBottom: 14 },
  seatLabel: { fontSize: 15, fontWeight: "700" },
  infoGrid: { gap: 10 },
  infoItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: "600", textAlign: "right", flex: 1, marginLeft: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 12, fontWeight: "600" },
  attendeeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, flexWrap: "wrap" },
  attendeeName: { fontSize: 14, fontWeight: "600" },
  attendeeEmail: { fontSize: 12 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderTopWidth: 1 },
  shareBtnText: { fontSize: 14, fontWeight: "600" },
});
