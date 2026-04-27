import { useState, useRef, useEffect } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { useAuth } from "@/lib/auth-provider";
import { getStoredToken } from "@/lib/api/auth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SITE_URL } from "@/lib/api/woocommerce";

// WebView for checkout - loads WooCommerce checkout page
let WebViewComponent: any = null;
try {
  WebViewComponent = require("react-native-webview").WebView;
} catch {}

export default function CheckoutScreen() {
  const colors = useColors();
  const router = useRouter();
  const { clearCart } = useCart();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<any>(null);

  useEffect(() => { getStoredToken().then(t => setAuthToken(t)); }, []);

  const checkoutUrl = `${SITE_URL}/checkout/`;

  const handleNavChange = (navState: any) => {
    const url = navState.url || "";
    // Detect order confirmation page
    if (url.includes("order-received") || url.includes("commande-recue")) {
      clearCart();
      // Stay on the confirmation page briefly, then navigate back
    }
  };

  if (Platform.OS === "web" || !WebViewComponent) {
    // Fallback for web: open in browser
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginLeft: 12 }}>Paiement</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <IconSymbol name="lock.fill" size={48} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 16, textAlign: "center" }}>Paiement sécurisé</Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
            Le paiement sera effectué sur le site sécurisé ticketbylamako.com avec MVola, Orange Money, Airtel Money ou carte bancaire.
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (typeof window !== "undefined") window.open(checkoutUrl, "_blank");
            }}
            style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 20 }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Ouvrir le paiement</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginLeft: 12, flex: 1 }}>Paiement sécurisé</Text>
        <IconSymbol name="lock.fill" size={16} color={colors.success} />
      </View>
      {loading && (
        <View style={{ position: "absolute", top: 60, left: 0, right: 0, zIndex: 10, alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      <WebViewComponent
        ref={webviewRef}
        source={{ uri: checkoutUrl, headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined }}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavChange}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        sharedCookiesEnabled
      />
    </ScreenContainer>
  );
}
