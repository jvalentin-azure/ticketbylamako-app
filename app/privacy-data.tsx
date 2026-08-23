import { useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { requestAccountDeletion } from "@/lib/api/auth";

const WEB_BASE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com"
).replace(/\/$/, "");
const PRIVACY_EMAIL = "info@lamakoevents.mg";

type LegalAction = {
  icon: ComponentProps<typeof IconSymbol>["name"];
  label: string;
  onPress: () => void;
  danger?: boolean;
  loading?: boolean;
};

type LegalSection = {
  title: string;
  items: LegalAction[];
};

export default function PrivacyDataScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [deletionLoading, setDeletionLoading] = useState(false);

  const openExternal = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert(
        "Lien indisponible",
        "Impossible d'ouvrir ce lien pour le moment.",
      );
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
              Alert.alert(
                "Demande reçue",
                `Votre demande #${requestId} a été enregistrée. Aucune autre action n’est nécessaire pour l’initier.`,
              );
            } catch (error: any) {
              Alert.alert(
                "Demande non envoyée",
                error?.message || "Veuillez réessayer plus tard.",
              );
            } finally {
              setDeletionLoading(false);
            }
          },
        },
      ],
    );
  };

  const sections: LegalSection[] = [
    {
      title: "Documents",
      items: [
        {
          icon: "hand.raised.fill" as const,
          label: "Politique de confidentialité",
          onPress: () => router.push("/privacy" as any),
        },
        {
          icon: "clipboard.fill" as const,
          label: "Conditions générales d’utilisation",
          onPress: () =>
            openExternal(`${WEB_BASE_URL}/conditions-generales-utilisation/`),
        },
        {
          icon: "cart.fill" as const,
          label: "Conditions générales de vente",
          onPress: () => router.push("/terms" as any),
        },
        {
          icon: "doc.text.fill" as const,
          label: "Mentions légales",
          onPress: () => router.push("/legal-notice" as any),
        },
        {
          icon: "gearshape.fill" as const,
          label: "Politique et gestion des cookies",
          onPress: () => openExternal(`${WEB_BASE_URL}/politique-cookies/`),
        },
      ],
    },
    {
      title: "Vos données",
      items: [
        {
          icon: "trash.fill" as const,
          label: "Supprimer mon compte",
          onPress: handleAccountDeletion,
          danger: true,
          loading: deletionLoading,
        },
        {
          icon: "envelope.fill" as const,
          label: "Contacter le support confidentialité",
          onPress: () => openExternal(`mailto:${PRIVACY_EMAIL}`),
        },
      ],
    },
  ];

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Revenir à l'écran précédent"
          style={[styles.backButton, { backgroundColor: colors.surface }]}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          <Text
            style={{ color: colors.foreground, fontSize: 14, marginLeft: 4 }}
          >
            Retour
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.foreground }]}
          numberOfLines={1}
        >
          Centre légal et données
        </Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.intro, { color: colors.muted }]}>
          Retrouvez les documents TicketByLamako et gérez vos données depuis un
          seul endroit.
        </Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {section.title}
            </Text>
            <View
              style={[
                styles.panel,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.onPress}
                  disabled={item.loading}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{
                    disabled: Boolean(item.loading),
                    busy: Boolean(item.loading),
                  }}
                  style={[
                    styles.row,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth:
                        index < section.items.length - 1 ? 1 : 0,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: item.danger
                          ? colors.error + "12"
                          : colors.primary + "12",
                      },
                    ]}
                  >
                    {item.loading ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <IconSymbol
                        name={item.icon}
                        size={18}
                        color={item.danger ? colors.error : colors.primary}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: item.danger ? colors.error : colors.foreground },
                    ]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                  <IconSymbol
                    name="chevron.right"
                    size={16}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
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
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
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
