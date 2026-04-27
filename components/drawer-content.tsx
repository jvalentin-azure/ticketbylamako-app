import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking, Platform } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/lib/auth-provider";
import { useThemeContext } from "@/lib/theme-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LinearGradient } from "expo-linear-gradient";

interface DrawerContentProps {
  onClose?: () => void;
}

export function DrawerContent({ onClose }: DrawerContentProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, portal, logout } = useAuth();
  const { colorScheme, setColorScheme } = useThemeContext();

  const navigate = (path: string) => {
    onClose?.();
    setTimeout(() => {
      router.push(path as any);
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
    const url = "https://wa.me/261340559099";
    Linking.openURL(url).catch(() => {});
  };

  const menuSections = [
    {
      title: "Navigation",
      items: [
        { icon: "house.fill" as const, label: "Accueil", onPress: () => { onClose?.(); router.push("/(tabs)/" as any); } },
        { icon: "calendar" as const, label: "Événements", onPress: () => { onClose?.(); router.push("/(tabs)/events" as any); } },
        { icon: "storefront.fill" as const, label: "Boutique", onPress: () => { onClose?.(); router.push("/(tabs)/shop" as any); } },
        { icon: "ticket.fill" as const, label: "Mes Billets", onPress: () => { onClose?.(); router.push("/(tabs)/tickets" as any); } },
        { icon: "cart.fill" as const, label: "Panier", onPress: () => { onClose?.(); router.push("/(tabs)/cart" as any); } },
      ],
    },
    {
      title: "Mon Compte",
      items: [
        ...(isAuthenticated
          ? [
              { icon: "star.fill" as const, label: "LamakoRewards", onPress: () => navigate("/rewards") },
              { icon: "heart.fill" as const, label: "Mes Favoris", onPress: () => navigate("/favorites") },
              { icon: "clipboard.fill" as const, label: "Mes Commandes", onPress: () => navigate("/orders") },
            ]
          : []),
        {
          icon: (colorScheme === "dark" ? "sun.max.fill" : "moon.fill") as any,
          label: colorScheme === "dark" ? "Mode Clair" : "Mode Sombre",
          onPress: () => setColorScheme(colorScheme === "dark" ? "light" : "dark"),
        },
        { icon: "gearshape.fill" as const, label: "Paramètres", onPress: () => {} },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: "text.bubble.fill" as const, label: "WhatsApp", onPress: openWhatsApp },
        { icon: "questionmark.circle.fill" as const, label: "Aide & Support", onPress: () => navigate("/help") },
        { icon: "hand.raised.fill" as const, label: "Politique de confidentialité", onPress: () => navigate("/privacy") },
        { icon: "info.circle.fill" as const, label: "À propos", onPress: () => {} },
      ],
    },
  ];

  // Add organisateur/admin items if applicable
  if (portal === "organisateur" || portal === "admin") {
    menuSections.splice(1, 0, {
      title: "Organisateur",
      items: [
        { icon: "chart.bar.fill" as const, label: "Dashboard", onPress: () => { onClose?.(); router.push("/(tabs)/org-dashboard" as any); } },
        { icon: "qrcode.viewfinder" as const, label: "Scanner", onPress: () => { onClose?.(); router.push("/(tabs)/scanner" as any); } },
        { icon: "person.2.fill" as const, label: "Participants", onPress: () => { onClose?.(); router.push("/(tabs)/participants" as any); } },
        { icon: "doc.text.fill" as const, label: "Rapports", onPress: () => { onClose?.(); router.push("/(tabs)/reports" as any); } },
      ],
    });
  }

  if (portal === "admin") {
    menuSections.splice(2, 0, {
      title: "Administration",
      items: [
        { icon: "chart.bar.fill" as const, label: "Admin Dashboard", onPress: () => { onClose?.(); router.push("/(tabs)/admin-dashboard" as any); } },
        { icon: "clipboard.fill" as const, label: "Commandes", onPress: () => { onClose?.(); router.push("/(tabs)/admin-orders" as any); } },
        { icon: "chart.line.uptrend.xyaxis" as const, label: "Analytics", onPress: () => { onClose?.(); router.push("/(tabs)/admin-analytics" as any); } },
      ],
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                {user.firstName} {user.lastName}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user.email}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {portal === "admin"
                    ? "Administrateur"
                    : portal === "organisateur"
                    ? "Organisateur"
                    : "Client"}
                </Text>
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
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>
              {section.title}
            </Text>
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.6}
              >
                <View style={[styles.menuIconBg, { backgroundColor: colors.primary + "12" }]}>
                  <IconSymbol name={item.icon} size={18} color={colors.primary} />
                </View>
                <Text
                  style={[styles.menuLabel, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <IconSymbol name="chevron.right" size={14} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Logout */}
        {isAuthenticated && (
          <TouchableOpacity
            onPress={handleLogout}
            style={[
              styles.logoutButton,
              { backgroundColor: colors.error + "10", borderColor: colors.error + "30" },
            ]}
            activeOpacity={0.7}
          >
            <IconSymbol name="power" size={18} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Se déconnecter</Text>
          </TouchableOpacity>
        )}

        {/* Version */}
        <Text style={[styles.version, { color: colors.muted }]}>
          TicketByLamako v2.4.0
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
    paddingBottom: 24,
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  drawerLogo: {
    width: 240,
    height: 70,
    alignSelf: "center",
    marginBottom: 20,
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
    fontFamily: "Raleway-Bold",
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Raleway-Bold",
  },
  userEmail: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Raleway-Regular",
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
    fontFamily: "Raleway-SemiBold",
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
    fontFamily: "Raleway-Bold",
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
    fontFamily: "Raleway-SemiBold",
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
    marginLeft: 12,
    flex: 1,
    fontFamily: "Raleway-Medium",
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
    fontFamily: "Raleway-SemiBold",
  },
  version: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 20,
    fontFamily: "Raleway-Regular",
  },
});
