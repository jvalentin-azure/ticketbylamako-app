import { useRef, useCallback, useState } from "react";
import { View, StyleSheet, Platform, Dimensions, Animated, TouchableOpacity, Text } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { AppHeader } from "@/components/app-header";
import { DrawerContent } from "@/components/drawer-content";

const DRAWER_WIDTH = Math.min(Dimensions.get("window").width * 0.82, 320);

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 60 + bottomPadding;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.spring(drawerAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [drawerAnim]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setDrawerOpen(false);
    });
  }, [drawerAnim]);

  const drawerTranslateX = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });

  const overlayOpacity = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <View style={styles.root}>
      {/* Main Content */}
      <View style={styles.mainContent}>
        <AppHeader onMenuPress={openDrawer} />
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.muted,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: {
              paddingTop: 6,
              paddingBottom: bottomPadding,
              height: tabBarHeight,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              borderTopWidth: 0.5,
              elevation: 0,
              shadowOpacity: 0,
            },
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "600",
              marginTop: 2,
            },
          }}
        >
          {/* 5 CLIENT TABS - Always visible */}
          <Tabs.Screen
            name="index"
            options={{
              title: "Accueil",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={24} name="house.fill" color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="events"
            options={{
              title: "Événement",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={24} name="calendar" color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="shop"
            options={{
              title: "Boutique",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={24} name="bag.fill" color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="tickets"
            options={{
              title: "Mes billets",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={24} name="ticket.fill" color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="cart"
            options={{
              title: "Panier",
              tabBarIcon: ({ color }) => (
                <View>
                  <IconSymbol size={24} name="cart.fill" color={color} />
                  {itemCount > 0 && (
                    <View style={[styles.cartBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.cartBadgeText}>
                        {itemCount > 99 ? "99+" : String(itemCount)}
                      </Text>
                    </View>
                  )}
                </View>
              ),
            }}
          />

          {/* HIDDEN TABS - Accessible via drawer only */}
          <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
      </View>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <>
          <Animated.View
            style={[
              styles.overlay,
              { opacity: overlayOpacity },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeDrawer}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.drawer,
              {
                width: DRAWER_WIDTH,
                transform: [{ translateX: drawerTranslateX }],
              },
            ]}
          >
            <DrawerContent onClose={closeDrawer} />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 10,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 11,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 16,
  },
});
