import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { buildLamakoWhatsAppUrl } from "@/lib/contact";

const ORGANIZER_MESSAGE = "Bonjour, je suis organisateur et je souhaite que mon événement apparaisse sur TicketByLamako.";

export function OrganizerEventCta({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();

  const openWhatsApp = () => {
    const url = buildLamakoWhatsAppUrl(ORGANIZER_MESSAGE);
    Linking.openURL(url).catch(() => {
      Alert.alert("Erreur", "Impossible d'ouvrir WhatsApp.");
    });
  };

  return (
    <TouchableOpacity
      onPress={openWhatsApp}
      activeOpacity={0.86}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primary + "15" }]}>
        <MaterialIcons name="event-available" size={24} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>Vous êtes organisateur ?</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Vous souhaitez que votre événement apparaisse ici ?</Text>
      </View>
      <IconSymbol name="chevron.right" size={20} color={colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: "800" },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
});
