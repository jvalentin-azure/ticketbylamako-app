import { Text, View, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeContext } from "@/lib/theme-provider";

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, user, portal, logout } = useAuth();
  const { colorScheme: scheme, setColorScheme: setScheme } = useThemeContext();

  const menuItems = [
    ...(isAuthenticated ? [
      { icon: "clipboard.fill" as const, label: "Mes Commandes", onPress: () => router.push("/orders" as any) },
      { icon: "ticket.fill" as const, label: "Mes Billets", onPress: () => router.push("/(tabs)/tickets" as any) },
    ] : []),
    { icon: scheme === "dark" ? "sun.max.fill" as const : "moon.fill" as const, label: scheme === "dark" ? "Mode Clair" : "Mode Sombre", onPress: () => setScheme(scheme === "dark" ? "light" : "dark") },
    { icon: "globe" as const, label: "Langue", onPress: () => {} },
    { icon: "info.circle.fill" as const, label: "À propos", onPress: () => {} },
  ];

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnexion", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>Profil</Text>
        </View>

        {/* User Card */}
        <View style={{ marginHorizontal: 16, padding: 20, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}>
          {isAuthenticated && user ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>{(user.firstName || user.displayName || "U")[0].toUpperCase()}</Text>
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>{user.firstName} {user.lastName}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{user.email}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                  <View style={{ backgroundColor: colors.primary + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>
                      {portal === "admin" ? "Administrateur" : portal === "organisateur" ? "Organisateur" : "Client"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 10 }}>
              <IconSymbol name="person.fill" size={48} color={colors.muted} />
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", marginTop: 10 }}>Non connecté</Text>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/login" as any)}
                style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 28, marginTop: 14 }}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Menu Items */}
        <View style={{ marginHorizontal: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: i < menuItems.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "12", alignItems: "center", justifyContent: "center" }}>
                <IconSymbol name={item.icon} size={18} color={colors.primary} />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "500", marginLeft: 12, flex: 1 }}>{item.label}</Text>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        {isAuthenticated && (
          <TouchableOpacity
            onPress={handleLogout}
            style={{ marginHorizontal: 16, marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: colors.error + "10", borderWidth: 1, borderColor: colors.error + "30", alignItems: "center" }}
          >
            <Text style={{ color: colors.error, fontSize: 15, fontWeight: "600" }}>Se déconnecter</Text>
          </TouchableOpacity>
        )}

        {/* Version */}
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 24, marginBottom: 40 }}>TicketByLamako v1.0.0</Text>
      </ScrollView>
    </ScreenContainer>
  );
}
