import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { portal } = useAuth();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      {/* CLIENT TABS */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Événements",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar" color={color} />,
          href: portal === "client" || portal === "organisateur" ? undefined : null,
        }}
      />

      <Tabs.Screen
        name="shop"
        options={{
          title: "Boutique",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="bag.fill" color={color} />,
          href: portal === "client" ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Panier",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="cart.fill" color={color} />,
          href: portal === "client" ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Mes Billets",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="ticket.fill" color={color} />,
          href: portal === "client" ? undefined : null,
        }}
      />
      {/* ORGANISATEUR TABS */}
      <Tabs.Screen
        name="org-dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.bar.fill" color={color} />,
          href: portal === "organisateur" ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="qrcode.viewfinder" color={color} />,
          href: portal === "organisateur" || portal === "admin" ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="participants"
        options={{
          title: "Participants",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.2.fill" color={color} />,
          href: portal === "organisateur" ? undefined : null,
        }}
      />
      {/* ADMIN TABS */}
      <Tabs.Screen
        name="admin-dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.bar.fill" color={color} />,
          href: portal === "admin" ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="admin-orders"
        options={{
          title: "Commandes",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="clipboard.fill" color={color} />,
          href: portal === "admin" ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="admin-analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.line.uptrend.xyaxis" color={color} />,
          href: portal === "admin" ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Rapports",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="doc.text.fill" color={color} />,
          href: portal === "organisateur" ? undefined : null,
        }}
      />
      {/* SHARED */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
