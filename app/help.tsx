import { Text, View, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const WHATSAPP_NUMBER = "+261340559099";
const WHATSAPP_MESSAGE = "Bonjour, j'ai besoin d'aide avec l'application TicketByLamako.";

export default function HelpScreen() {
  const colors = useColors();
  const router = useRouter();

  const openWhatsApp = () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER.replace(/\s/g, "")}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert("Erreur", "WhatsApp n'est pas installé sur cet appareil.");
        }
      })
      .catch(() => Alert.alert("Erreur", "Impossible d'ouvrir WhatsApp."));
  };

  const openEmail = () => {
    Linking.openURL("mailto:info@lamakoevents.mg?subject=Support TicketByLamako");
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Aide & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "15" }]}>
            <IconSymbol name="questionmark.circle.fill" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Comment pouvons-nous vous aider ?</Text>
          <Text style={[styles.heroSub, { color: colors.muted }]}>Notre équipe est disponible pour répondre à toutes vos questions</Text>
        </View>

        {/* WhatsApp CTA */}
        <TouchableOpacity onPress={openWhatsApp} style={styles.whatsappButton} activeOpacity={0.8}>
          <MaterialIcons name="chat" size={24} color="#fff" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.whatsappTitle}>Contactez-nous sur WhatsApp</Text>
            <Text style={styles.whatsappSub}>Réponse rapide garantie</Text>
          </View>
          <IconSymbol name="chevron.right" size={20} color="#fff" />
        </TouchableOpacity>

        {/* FAQ Section */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Questions fréquentes</Text>

        {[
          { q: "Comment acheter un billet ?", a: "Parcourez les événements, sélectionnez votre billet, ajoutez-le au panier et procédez au paiement." },
          { q: "Comment accéder à mon billet ?", a: "Après achat, vos billets sont disponibles dans l'onglet 'Mes billets'. Présentez le QR code à l'entrée." },
          { q: "Puis-je annuler ma commande ?", a: "Les conditions d'annulation dépendent de chaque événement. Contactez-nous pour plus d'informations." },
          { q: "Comment fonctionne le plan de salle ?", a: "Pour les événements avec plan de salle, vous pouvez choisir votre siège lors de l'achat." },
          { q: "Comment contacter un organisateur ?", a: "Les informations de contact de l'organisateur sont disponibles sur la page de l'événement." },
        ].map((faq, i) => (
          <View key={i} style={[styles.faqItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.faqQuestion, { color: colors.foreground }]}>{faq.q}</Text>
            <Text style={[styles.faqAnswer, { color: colors.muted }]}>{faq.a}</Text>
          </View>
        ))}

        {/* Other Contact Options */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Autres moyens de contact</Text>

        <TouchableOpacity onPress={openEmail} style={[styles.contactOption, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="email" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactTitle, { color: colors.foreground }]}>Email</Text>
            <Text style={[styles.contactSub, { color: colors.muted }]}>info@lamakoevents.mg</Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${WHATSAPP_NUMBER.replace(/\s/g, "")}`)}
          style={[styles.contactOption, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="phone" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactTitle, { color: colors.foreground }]}>Téléphone</Text>
            <Text style={[styles.contactSub, { color: colors.muted }]}>{WHATSAPP_NUMBER}</Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Raleway-Bold" },
  content: { padding: 20 },
  heroSection: { alignItems: "center", marginBottom: 28 },
  heroIcon: { width: 80, height: 80, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", fontFamily: "Raleway-Bold" },
  heroSub: { fontSize: 14, textAlign: "center", marginTop: 6, fontFamily: "Raleway-Regular" },
  whatsappButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#25D366", borderRadius: 16, padding: 18, marginBottom: 28 },
  whatsappTitle: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold" },
  whatsappSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2, fontFamily: "Raleway-Regular" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12, fontFamily: "Raleway-Bold" },
  faqItem: { borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
  faqQuestion: { fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  faqAnswer: { fontSize: 13, lineHeight: 20, marginTop: 6, fontFamily: "Raleway-Regular" },
  contactOption: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
  contactIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  contactTitle: { fontSize: 15, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  contactSub: { fontSize: 13, marginTop: 2, fontFamily: "Raleway-Regular" },
});
