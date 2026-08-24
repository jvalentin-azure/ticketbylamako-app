import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { useThemeContext } from "@/lib/theme-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LinearGradient } from "expo-linear-gradient";
import { buildLamakoWhatsAppUrl } from "@/lib/contact";
import { getAppVersionLabel } from "@/lib/app-version";
import { useRewards } from "@/lib/rewards-provider";

interface DrawerContentProps {
  onClose?: () => void;
}

export function DrawerContent({ onClose }: DrawerContentProps) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isAuthenticated, user, logout } = useAuth();
  const { colorScheme, setColorScheme } = useThemeContext();
  const { state: rewards } = useRewards();
  const userDisplayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.displayName ||
      user.email
    : "";

  const navigate = (path: string) => {
    onClose?.();
    setTimeout(() => {
      // Drawer destinations must not inherit the hidden Profile tab stack.
      // Resetting the tab first makes the native back action return Home.
      router.replace("/(tabs)/" as any);
      if (path !== "/(tabs)/") {
        setTimeout(() => router.push(path as any), 0);
      }
    }, 200);
  };

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion",
        style: "destructive",
        onPress: async () => {
          await logout();
          onClose?.();
        },
      },
    ]);
  };

  const openWhatsApp = () => {
    const url = buildLamakoWhatsAppUrl(
      "Bonjour, je vous contacte depuis l'application TicketByLamako.",
    );
    Linking.openURL(url).catch(() => {
      Alert.alert(
        "WhatsApp indisponible",
        "Impossible d'ouvrir WhatsApp pour le moment.",
      );
    });
  };

  const menuSections = [
    {
      title: "Mon espace",
      items: isAuthenticated
        ? [
            {
              icon: "person.fill" as const,
              label: "Mon profil",
              onPress: () => navigate("/(tabs)/profile"),
            },
            {
              icon: "clipboard.fill" as const,
              label: "Mes commandes",
              onPress: () => navigate("/orders"),
            },
            {
              icon: "star.fill" as const,
              label: `LamakoRewards · ${rewards.availablePoints.toLocaleString("fr-FR")} pts`,
              onPress: () => navigate("/rewards"),
            },
            {
              icon: "heart.fill" as const,
              label: "Mes favoris",
              onPress: () => navigate("/favorites"),
            },
            {
              icon: "bell.fill" as const,
              label: "Notifications",
              onPress: () => navigate("/notifications"),
            },
          ]
        : [],
    },
    {
      title: "Préférences",
      items: [
        {
          icon: (colorScheme === "dark" ? "sun.max.fill" : "moon.fill") as any,
          label: colorScheme === "dark" ? "Mode clair" : "Mode sombre",
          onPress: () =>
            setColorScheme(colorScheme === "dark" ? "light" : "dark"),
        },
        {
          icon: "gearshape.fill" as const,
          label: "Préférences de notifications",
          onPress: () => navigate("/notification-settings"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: "text.bubble.fill" as const,
          label: "WhatsApp",
          onPress: openWhatsApp,
        },
        {
          icon: "questionmark.circle.fill" as const,
          label: "Aide & Support",
          onPress: () => navigate("/help"),
        },
        {
          icon: "shield.fill" as const,
          label: "Centre légal et données",
          onPress: () => navigate("/privacy-data"),
        },
        {
          icon: "info.circle.fill" as const,
          label: "À propos",
          onPress: () => navigate("/about"),
        },
      ],
    },
  ];

  // Admin/Organisateur modules have been moved to TicketByLamako Backend app

  return (
    <View
      accessibilityViewIsModal
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          width: Math.min(width * 0.86, 360),
        },
      ]}
    >
      {/* Header with gradient */}
      <LinearGradient
        colors={["#663d17", "#8B5E34"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer le menu"
          style={styles.closeButton}
          activeOpacity={0.7}
        >
          <IconSymbol name="xmark" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Logo */}
        <Image
          source={require("@/assets/images/logo-white.png")}
          style={styles.drawerLogo}
          contentFit="contain"
        />

        {/* User Info */}
        {isAuthenticated && user ? (
          <View style={styles.userSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {(user.firstName || user.displayName || "U")[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {userDisplayName}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user.email}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>Client</Text>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => {
              onClose?.();
              router.push("/(auth)/login" as any);
            }}
            style={styles.loginButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Se connecter à TicketByLamako"
          >
            <IconSymbol name="person.fill" size={18} color="#663d17" />
            <Text style={styles.loginText}>Se connecter</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Menu Items */}
      <ScrollView
        style={styles.menuScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {menuSections
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.muted }]}>
                {section.title}
              </Text>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: colors.border },
                  ]}
                  activeOpacity={0.6}
                >
                  <View
                    style={[
                      styles.menuIconBg,
                      { backgroundColor: colors.primary + "12" },
                    ]}
                  >
                    <IconSymbol
                      name={item.icon}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <Text
                    style={[styles.menuLabel, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                  <IconSymbol
                    name="chevron.right"
                    size={14}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ))}

        {/* Logout */}
        {isAuthenticated && (
          <TouchableOpacity
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
            style={[
              styles.logoutButton,
              {
                backgroundColor: colors.error + "10",
                borderColor: colors.error + "30",
              },
            ]}
            activeOpacity={0.7}
          >
            <IconSymbol name="power" size={18} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>
              Se déconnecter
            </Text>
          </TouchableOpacity>
        )}

        {/* Version */}
        <Text style={[styles.version, { color: colors.muted }]}>
          {getAppVersionLabel()}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  drawerLogo: {
    width: 168,
    height: 48,
    alignSelf: "center",
    marginBottom: 14,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#c79f6c",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  userEmail: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: "rgba(199,159,108,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  roleText: {
    color: "#c79f6c",
    fontSize: 11,
    fontWeight: "600",
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#c79f6c",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: "center",
    gap: 8,
  },
  loginText: {
    color: "#663d17",
    fontSize: 14,
    fontWeight: "700",
  },
  menuScroll: {
    flex: 1,
    paddingTop: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
  },
  menuIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "600",
  },
  version: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 20,
  },
});
