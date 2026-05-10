import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

export function SocialOAuthCallback() {
  const colors = useColors();
  const router = useRouter();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    const timer = setTimeout(() => {
      router.replace("/(tabs)" as any);
    }, 1800);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>Connexion en cours</Text>
        <Text style={[styles.text, { color: colors.muted }]}>
          Retour automatique vers TicketByLamako.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: "800",
  },
  text: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
