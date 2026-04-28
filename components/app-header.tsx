import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/lib/auth-provider";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Text } from "react-native";

interface AppHeaderProps {
  onMenuPress?: () => void;
}

export function AppHeader({ onMenuPress }: AppHeaderProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const { itemCount } = useCart();

  const topPadding = Platform.OS === "web" ? 8 : Math.max(insets.top, 8);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPadding,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.content}>
        {/* Left: Burger Menu */}
        <TouchableOpacity
          onPress={onMenuPress}
          style={[styles.iconButton, { backgroundColor: colors.surface }]}
          activeOpacity={0.7}
        >
          <IconSymbol name="line.3.horizontal" size={22} color={colors.foreground} />
        </TouchableOpacity>

        {/* Center: Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={
              scheme === "dark"
                ? require("@/assets/images/logo-white.png")
                : require("@/assets/images/logo-dark.png")
            }
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        {/* Right: Notifications + Profile */}
        <View style={styles.rightSection}>
          {/* Search */}
          <TouchableOpacity
            onPress={() => router.push("/search" as any)}
            style={[styles.iconButton, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="magnifyingglass" size={20} color={colors.foreground} />
          </TouchableOpacity>

          {/* Notification Bell */}
          <TouchableOpacity
            onPress={() => router.push("/notification-settings" as any)}
            style={[styles.iconButton, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="bell.fill" size={20} color={colors.foreground} />
            {/* Notification dot */}
            <View style={[styles.notifDot, { backgroundColor: colors.primary }]} />
          </TouchableOpacity>

          {/* Profile Avatar */}
          <TouchableOpacity
            onPress={() => {
              if (isAuthenticated) {
                // Navigate to profile screen
                router.push("/(tabs)/profile" as any);
              } else {
                router.push("/(auth)/login" as any);
              }
            }}
            style={[styles.avatarButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
          >
            {isAuthenticated && user ? (
              <Text style={styles.avatarText}>
                {(user.firstName || user.displayName || "U")[0].toUpperCase()}
              </Text>
            ) : (
              <IconSymbol name="person.fill" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 0.5,
    paddingBottom: 10,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 44,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
  logo: {
    width: 140,
    height: 36,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notifDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Raleway-Bold",
  },
});
