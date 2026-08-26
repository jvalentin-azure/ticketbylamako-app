import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { useThemeContext } from "@/lib/theme-provider";
import { useRewards } from "@/lib/rewards-provider";
import { getAppReleaseLabel, getAppVersionLabel } from "@/lib/app-version";

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { colorScheme, setColorScheme } = useThemeContext();
  const {
    state: rewards,
    currentTier,
    progressToNextTier,
    pointsToNextTier,
    nextTier,
  } = useRewards();
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.displayName ||
    "Client TicketByLamako";

  const accountItems = [
    {
      icon: "person.fill" as const,
      label: "Informations personnelles",
      detail: "Coordonnées et facturation",
      onPress: () => router.push("/edit-profile" as any),
    },
    {
      icon: "gearshape.fill" as const,
      label: "Notifications",
      detail: "Alertes importantes et préférences",
      onPress: () => router.push("/notification-settings" as any),
    },
    {
      icon: "hand.raised.fill" as const,
      label: "Centre légal et données",
      detail: "Confidentialité, documents et droits",
      onPress: () => router.push("/privacy-data" as any),
    },
    {
      icon:
        colorScheme === "dark"
          ? ("sun.max.fill" as const)
          : ("moon.fill" as const),
      label:
        colorScheme === "dark"
          ? "Passer en mode clair"
          : "Passer en mode sombre",
      detail: "Adapter l'application à votre confort",
      onPress: () => setColorScheme(colorScheme === "dark" ? "light" : "dark"),
    },
  ];

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          Mon espace
        </Text>
        {isAuthenticated && user ? (
          <LinearGradient
            colors={["#171323", "#704016"]}
            style={styles.identityHero}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
              <Text style={styles.memberLabel}>Compte client vérifié</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Modifier le profil"
              onPress={() => router.push("/edit-profile" as any)}
              style={styles.editButton}
            >
              <IconSymbol name="pencil" size={17} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <View style={[styles.signedOut, { borderColor: colors.border }]}>
            <IconSymbol name="person.fill" size={36} color={colors.muted} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Retrouvez vos billets et avantages
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/login" as any)}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.primaryButtonText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAuthenticated ? (
          <TouchableOpacity
            onPress={() => router.push("/rewards" as any)}
            activeOpacity={0.82}
            style={[
              styles.rewardsPanel,
              {
                borderColor: currentTier.color + "70",
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View style={styles.rewardsHeader}>
              <View>
                <Text style={[styles.eyebrow, { color: currentTier.color }]}>
                  LAMAKOREWARDS · {currentTier.name.toUpperCase()}
                </Text>
                <Text style={[styles.points, { color: colors.foreground }]}>
                  {rewards.availablePoints.toLocaleString("fr-FR")} pts
                </Text>
              </View>
              <View
                style={[
                  styles.tierMark,
                  { backgroundColor: currentTier.color + "20" },
                ]}
              >
                <Text style={styles.tierIcon}>{currentTier.icon}</Text>
              </View>
            </View>
            {nextTier ? (
              <>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(progressToNextTier * 100, 100)}%`,
                        backgroundColor: currentTier.color,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.muted }]}>
                  {pointsToNextTier.toLocaleString("fr-FR")} points avant{" "}
                  {nextTier.name}
                </Text>
              </>
            ) : null}
            <View style={styles.rewardsLink}>
              <Text style={[styles.rewardsLinkText, { color: colors.primary }]}>
                Voir mon activité Rewards
              </Text>
              <IconSymbol
                name="chevron.right"
                size={15}
                color={colors.primary}
              />
            </View>
          </TouchableOpacity>
        ) : null}

        <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
          Compte et préférences
        </Text>
        <View
          style={[
            styles.settingsList,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          {accountItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              style={[
                styles.settingRow,
                index > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.settingIcon,
                  { backgroundColor: colors.primary + "12" },
                ]}
              >
                <IconSymbol name={item.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.settingCopy}>
                <Text
                  style={[styles.settingLabel, { color: colors.foreground }]}
                >
                  {item.label}
                </Text>
                <Text style={[styles.settingDetail, { color: colors.muted }]}>
                  {item.detail}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {isAuthenticated ? (
          <TouchableOpacity
            onPress={handleLogout}
            style={[styles.logout, { borderColor: colors.error + "50" }]}
          >
            <IconSymbol name="power" size={18} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>
              Se déconnecter
            </Text>
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.version, { color: colors.muted }]}>
          {getAppVersionLabel()}
          {"\n"}
          {getAppReleaseLabel()}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 36 },
  pageTitle: { fontSize: 24, fontWeight: "800", marginBottom: 14 },
  identityHero: {
    minHeight: 112,
    borderRadius: 8,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  identityCopy: { flex: 1, marginLeft: 13 },
  name: { color: "#fff", fontSize: 19, fontWeight: "800" },
  email: { color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 3 },
  memberLabel: {
    color: "#F6C85F",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 7,
  },
  editButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  signedOut: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 24,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 8,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  rewardsPanel: { marginTop: 14, borderWidth: 1, borderRadius: 8, padding: 16 },
  rewardsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: { fontSize: 10, fontWeight: "800" },
  points: { fontSize: 25, fontWeight: "800", marginTop: 4 },
  tierMark: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tierIcon: { fontSize: 24 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 14,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 11, marginTop: 6 },
  rewardsLink: { flexDirection: "row", alignItems: "center", marginTop: 13 },
  rewardsLinkText: { fontSize: 12, fontWeight: "700", flex: 1 },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 22,
    marginBottom: 10,
  },
  settingsList: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  settingRow: {
    minHeight: 70,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  settingCopy: { flex: 1, marginHorizontal: 11 },
  settingLabel: { fontSize: 14, fontWeight: "700" },
  settingDetail: { fontSize: 11, marginTop: 2 },
  logout: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { fontSize: 14, fontWeight: "700" },
  version: { textAlign: "center", fontSize: 11, marginTop: 18 },
});
