import { ScrollView, Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function PrivacyScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 14, marginLeft: 4 }}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Confidentialité
        </Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.lastUpdated, { color: colors.muted }]}>
          Dernière mise à jour : Avril 2026
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          1. Collecte des données
        </Text>
        <Text style={[styles.paragraph, { color: colors.foreground }]}>
          TicketByLamako collecte les informations que vous fournissez lors de la création de votre
          compte, de l'achat de billets et de l'utilisation de nos services. Ces informations
          comprennent votre nom, adresse e-mail, numéro de téléphone et informations de paiement.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          2. Utilisation des données
        </Text>
        <Text style={[styles.paragraph, { color: colors.foreground }]}>
          Nous utilisons vos données personnelles pour traiter vos commandes, gérer votre compte,
          vous envoyer des confirmations de billets et des mises à jour sur les événements, et
          améliorer nos services.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          3. Partage des données
        </Text>
        <Text style={[styles.paragraph, { color: colors.foreground }]}>
          Vos données personnelles ne sont jamais vendues à des tiers. Elles peuvent être partagées
          avec les organisateurs d'événements pour la validation des billets et avec nos prestataires
          de paiement pour le traitement des transactions.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          4. Sécurité
        </Text>
        <Text style={[styles.paragraph, { color: colors.foreground }]}>
          Nous mettons en oeuvre des mesures de sécurité techniques et organisationnelles pour
          protéger vos données personnelles contre l'accès non autorisé, la modification, la
          divulgation ou la destruction.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          5. Vos droits
        </Text>
        <Text style={[styles.paragraph, { color: colors.foreground }]}>
          Vous avez le droit d'accéder à vos données personnelles, de les rectifier, de les
          supprimer ou de limiter leur traitement. Pour exercer ces droits, contactez-nous à
          info@lamakoevents.mg.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          6. Cookies
        </Text>
        <Text style={[styles.paragraph, { color: colors.foreground }]}>
          Notre application utilise des cookies et des technologies similaires pour améliorer votre
          expérience, analyser l'utilisation et personnaliser le contenu.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          7. Contact
        </Text>
        <Text style={[styles.paragraph, { color: colors.foreground }]}>
          Pour toute question concernant cette politique de confidentialité, veuillez nous contacter
          à info@lamakoevents.mg ou via WhatsApp au +261 38 73 57 728.
        </Text>

        <View style={{ height: 40 }} />
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
    fontSize: 17,
    fontWeight: "700",
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
  },
});
