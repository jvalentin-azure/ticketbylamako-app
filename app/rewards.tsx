import { Text, View, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRewards, TIERS, type TierInfo } from "@/lib/rewards-provider";
import { useAuth } from "@/lib/auth-provider";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_W } = Dimensions.get("window");

export default function RewardsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { state, currentTier, nextTier, progressToNextTier, pointsToNextTier, getDiscountValue, syncRewards, isSyncing } = useRewards();

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Raleway-Medium", marginLeft: 4 }}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>LamakoRewards</Text>
        <TouchableOpacity onPress={syncRewards} style={[styles.backButton, { backgroundColor: colors.surface, opacity: isSyncing ? 0.5 : 1 }]} disabled={isSyncing}>
          <IconSymbol name="arrow.clockwise" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Points Card */}
        <LinearGradient
          colors={["#663d17", "#8B5E34", "#c79f6c"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pointsCard}
        >
          <View style={styles.pointsHeader}>
            <Text style={styles.pointsLabel}>Points disponibles</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{currentTier.icon} {currentTier.name}</Text>
            </View>
          </View>
          <Text style={styles.pointsValue}>{state.availablePoints.toLocaleString("fr-FR")}</Text>
          <Text style={styles.pointsSub}>
            = {getDiscountValue(state.availablePoints).toLocaleString("fr-FR")} Ar de réduction
          </Text>
          {state.lastSynced && (
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "Raleway-Regular", marginTop: 4 }}>
              Dernière sync: {new Date(state.lastSynced).toLocaleString("fr-FR")}
            </Text>
          )}

          {/* Progress to next tier */}
          {nextTier && (
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressToNextTier * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {pointsToNextTier} pts pour atteindre {nextTier.name}
              </Text>
            </View>
          )}

          {/* Lifetime stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{state.lifetimePoints.toLocaleString("fr-FR")}</Text>
              <Text style={styles.statLabel}>Total gagné</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{state.history.filter(h => h.type === "redeem").length}</Text>
              <Text style={styles.statLabel}>Échanges</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{state.history.filter(h => h.type === "earn").length}</Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>
          </View>
        </LinearGradient>

        {/* How it works */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Comment ça marche</Text>
          <View style={styles.howItWorksGrid}>
            <View style={styles.howItem}>
              <View style={[styles.howIcon, { backgroundColor: colors.primary + "15" }]}>
                <IconSymbol name="cart.fill" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.howTitle, { color: colors.foreground }]}>Achetez</Text>
              <Text style={[styles.howDesc, { color: colors.muted }]}>1 pt / 1000 Ar</Text>
            </View>
            <View style={styles.howItem}>
              <View style={[styles.howIcon, { backgroundColor: "#FFD700" + "20" }]}>
                <IconSymbol name="star.fill" size={20} color="#FFD700" />
              </View>
              <Text style={[styles.howTitle, { color: colors.foreground }]}>Cumulez</Text>
              <Text style={[styles.howDesc, { color: colors.muted }]}>Montez en niveau</Text>
            </View>
            <View style={styles.howItem}>
              <View style={[styles.howIcon, { backgroundColor: colors.success + "15" }]}>
                <IconSymbol name="gift.fill" size={20} color={colors.success} />
              </View>
              <Text style={[styles.howTitle, { color: colors.foreground }]}>Échangez</Text>
              <Text style={[styles.howDesc, { color: colors.muted }]}>100 pts = 5000 Ar</Text>
            </View>
          </View>
        </View>

        {/* Tiers */}
        <View style={styles.tiersSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Niveaux</Text>
          {TIERS.map((tier, idx) => (
            <View
              key={tier.id}
              style={[
                styles.tierCard,
                {
                  backgroundColor: tier.id === state.tier ? tier.color + "15" : colors.surface,
                  borderColor: tier.id === state.tier ? tier.color : colors.border,
                },
              ]}
            >
              <View style={styles.tierCardHeader}>
                <Text style={styles.tierIcon}>{tier.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierName, { color: colors.foreground }]}>{tier.name}</Text>
                  <Text style={[styles.tierMin, { color: colors.muted }]}>
                    {tier.minPoints === 0 ? "Niveau de départ" : `${tier.minPoints.toLocaleString("fr-FR")} pts requis`}
                  </Text>
                </View>
                {tier.id === state.tier && (
                  <View style={[styles.currentBadge, { backgroundColor: tier.color }]}>
                    <Text style={styles.currentBadgeText}>Actuel</Text>
                  </View>
                )}
              </View>
              <View style={styles.benefitsList}>
                {tier.benefits.map((b, i) => (
                  <View key={i} style={styles.benefitRow}>
                    <IconSymbol name="checkmark.circle.fill" size={14} color={tier.color} />
                    <Text style={[styles.benefitText, { color: colors.foreground }]}>{b}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Referral Code */}
        {isAuthenticated && state.referralCode && (
          <View style={[styles.referralCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Parrainage</Text>
            <Text style={[styles.referralDesc, { color: colors.muted }]}>
              Partagez votre code et gagnez {100} pts quand un ami fait son premier achat !
            </Text>
            <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.codeText, { color: colors.primary }]}>{state.referralCode}</Text>
            </View>
          </View>
        )}

        {/* Transaction History */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Historique</Text>
          {state.history.length === 0 ? (
            <View style={[styles.emptyHistory, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="clock.fill" size={32} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucune transaction pour le moment</Text>
              <Text style={[styles.emptySubText, { color: colors.muted }]}>Vos points apparaîtront ici après votre premier achat</Text>
            </View>
          ) : (
            state.history.slice(0, 20).map((tx) => (
              <View key={tx.id} style={[styles.txRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.txIcon, { backgroundColor: tx.type === "earn" ? colors.success + "15" : colors.error + "15" }]}>
                  <IconSymbol
                    name={tx.type === "earn" ? "plus.circle.fill" : "minus.circle.fill"}
                    size={18}
                    color={tx.type === "earn" ? colors.success : colors.error}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
                  <Text style={[styles.txDate, { color: colors.muted }]}>{formatDate(tx.date)}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.type === "earn" ? colors.success : colors.error }]}>
                  {tx.type === "earn" ? "+" : "-"}{tx.amount} pts
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  backButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  headerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Raleway-Bold" },
  content: { padding: 16, paddingBottom: 40 },

  // Points card
  pointsCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
  pointsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  pointsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Raleway-Medium" },
  tierBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tierBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Raleway-SemiBold" },
  pointsValue: { color: "#fff", fontSize: 42, fontWeight: "800", fontFamily: "Raleway-ExtraBold" },
  pointsSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Raleway-Regular", marginTop: 4 },
  progressSection: { marginTop: 16 },
  progressBar: { height: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#c79f6c", borderRadius: 3 },
  progressText: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 6, fontFamily: "Raleway-Regular" },
  statsRow: { flexDirection: "row", marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 18, fontWeight: "700", fontFamily: "Raleway-Bold" },
  statLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2, fontFamily: "Raleway-Regular" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 4 },

  // How it works
  section: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold", marginBottom: 4 },
  howItWorksGrid: { flexDirection: "row", justifyContent: "space-around", marginTop: 12 },
  howItem: { alignItems: "center", flex: 1 },
  howIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  howTitle: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  howDesc: { fontSize: 11, marginTop: 2, fontFamily: "Raleway-Regular" },

  // Tiers
  tiersSection: { marginBottom: 16 },
  tierCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  tierCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  tierIcon: { fontSize: 28 },
  tierName: { fontSize: 15, fontWeight: "700", fontFamily: "Raleway-Bold" },
  tierMin: { fontSize: 12, fontFamily: "Raleway-Regular", marginTop: 1 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  currentBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  benefitsList: { marginTop: 10, gap: 6 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefitText: { fontSize: 12, fontFamily: "Raleway-Regular" },

  // Referral
  referralCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  referralDesc: { fontSize: 13, fontFamily: "Raleway-Regular", marginTop: 4, marginBottom: 12 },
  codeBox: { alignItems: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  codeText: { fontSize: 22, fontWeight: "800", letterSpacing: 2, fontFamily: "Raleway-ExtraBold" },

  // History
  historySection: { marginBottom: 20 },
  emptyHistory: { alignItems: "center", padding: 24, borderRadius: 14, borderWidth: 1 },
  emptyText: { fontSize: 14, fontFamily: "Raleway-Medium", marginTop: 10 },
  emptySubText: { fontSize: 12, fontFamily: "Raleway-Regular", marginTop: 4, textAlign: "center" },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5, gap: 10 },
  txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  txDesc: { fontSize: 13, fontFamily: "Raleway-Medium" },
  txDate: { fontSize: 11, fontFamily: "Raleway-Regular", marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "700", fontFamily: "Raleway-Bold" },
});
