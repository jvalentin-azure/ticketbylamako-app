import { useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { requestAccountDeletion } from "@/lib/api/auth";

const WEB_BASE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com").replace(/\/$/, "");
const PRIVACY_EMAIL = "info@lamakoevents.mg";

export default function PrivacyDataScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [deletionLoading, setDeletionLoading] = useState(false);

  const openExternal = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert("Lien indisponible", "Impossible d'ouvrir ce lien pour le moment.");
    });
  };

  const handleAccountDeletion = () => {
    if (!isAuthenticated) {
      openExternal(`${WEB_BASE_URL}/suppression-compte/`);
      return;
    }

    Alert.alert(
      "Supprimer mon compte",
      "Cette demande concerne la suppression totale de votre compte. Certaines données peuvent être conservées lorsque la loi, la facturation, la prévention de la fraude ou un litige l’exigent.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Envoyer la demande",
          style: "destructive",
          onPress: async () => {
            setDeletionLoading(true);
            try {
              const requestId = await requestAccountDeletion();
              Alert.alert("Demande reçue", `Votre demande #${requestId} a été enregistrée. Aucune autre action n’est nécessaire pour l’initier.`);
            } catch (error: any) {
              Alert.alert("Demande non envoyée", error?.message || "Veuillez réessayer plus tard.");
            } finally {
              setDeletionLoading(false);
            }
          },
        },
      ],
    );
  };

  const actions = [
    { icon: "hand.raised.fill" as const, label: "Politique de confidentialité", onPress: () => router.push("/privacy" as any) },
    { icon: "clipboard.fill" as const, label: "Conditions générales d’utilisation", onPress: () => openExternal(`${WEB_BASE_URL}/conditions-generales-utilisation/`) },
    { icon: "cart.fill" as const, label: "Conditions générales de vente", onPress: () => router.push("/terms" as any) },
    { icon: "gearshape.fill" as const, label: "Politique cookies", onPress: () => openExternal(`${WEB_BASE_URL}/politique-cookies/`) },
    { icon: "shield.fill" as const, label: "Gérer mes cookies", onPress: () => openExternal(`${WEB_BASE_URL}/politique-cookies/#gerer-mes-cookies`) },
    { icon: "trash.fill" as const, label: "Supprimer mon compte", onPress: handleAccountDeletion, danger: true, loading: deletionLoading },
    { icon: "envelope.fill" as const, label: "Contacter le support privacy", onPress: () => openExternal(`mailto:${PRIVACY_EMAIL}`) },
  ];

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 14, marginLeft: 4 }}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          Confidentialite et donnees
        </Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {actions.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              disabled={item.loading}
              style={[
                styles.row,
                { borderBottomColor: colors.border, borderBottomWidth: index < actions.length - 1 ? 1 : 0 },
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: item.danger ? colors.error + "12" : colors.primary + "12" }]}>
                {item.loading ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <IconSymbol name={item.icon} size={18} color={item.danger ? colors.error : colors.primary} />
                )}
              </View>
              <Text style={[styles.rowLabel, { color: item.danger ? colors.error : colors.foreground }]} numberOfLines={2}>
                {item.label}
              </Text>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 8,
    textAlign: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "600",
  },
});
