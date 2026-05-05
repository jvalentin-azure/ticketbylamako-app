import { Text, View, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const SOCIAL_LINKS = [
  { name: "Facebook", icon: "facebook" as const, url: "https://www.facebook.com/Ticketbylamako", color: "#1877F2" },
  { name: "Instagram", icon: "camera-alt" as const, url: "https://www.instagram.com/ticketbylamako", color: "#E4405F" },
  { name: "TikTok", icon: "music-note" as const, url: "https://www.tiktok.com/@lamakoevents_mdg", color: "#000000" },
  { name: "LinkedIn", icon: "business-center" as const, url: "https://www.linkedin.com/company/lamako-events", color: "#0A66C2" },
];

const CONTACT_INFO = {
  phone: "+261 34 13 922 92",
  email: "info@ticketbylamako.com",
  address: "Lot II T 4 C Betongolo, Antananarivo 101, Madagascar",
  website: "https://www.ticketbylamako.com",
};

export default function AboutScreen() {
  const colors = useColors();
  const router = useRouter();

  const openLink = (url: string) => {
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) Linking.openURL(url);
        else Alert.alert("Erreur", "Impossible d'ouvrir ce lien.");
      })
      .catch(() => Alert.alert("Erreur", "Impossible d'ouvrir ce lien."));
  };

  const openLegalPage = (url: string) => {
    WebBrowser.openBrowserAsync(url).catch(() => openLink(url));
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 14, marginLeft: 4 }}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>À propos</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Logo & Brand */}
        <View style={styles.brandSection}>
          <View style={[styles.logoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Image source={require("@/assets/images/icon.png")} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={[styles.brandName, { color: colors.foreground }]}>Ticket by Lamako</Text>
          <Text style={[styles.brandTagline, { color: colors.muted }]}>
            La plateforme 100% malagasy qui simplifie vos événements
          </Text>
        </View>

        {/* About Description */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Notre histoire</Text>
          <Text style={[styles.cardText, { color: colors.muted }]}>
            Ticket by Lamako est une plateforme de billetterie en ligne lancée le 15 novembre 2023, développée par Lamako Events.
            {"\n\n"}
            Avec plus de 13 ans d'expérience dans l'organisation d'événements à Madagascar et dans l'océan Indien, Lamako Events a créé cette solution pour rendre l'achat et la gestion des billets plus accessibles, modernes et sécurisés.
          </Text>
        </View>

        {/* Vision */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Notre vision</Text>
          <Text style={[styles.cardText, { color: colors.muted }]}>
            Rendre la culture, le divertissement et les rencontres accessibles à tous, en simplifiant l'accès aux événements grâce à des solutions modernes, fiables et adaptées aux réalités locales.
          </Text>
        </View>

        {/* Values */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ce qui fait la différence</Text>
        <View style={styles.valuesRow}>
          {[
            { icon: "touch-app" as const, title: "Simplicité", desc: "Configuration sans contrainte technique" },
            { icon: "verified-user" as const, title: "Fiabilité", desc: "Paiements sécurisés et anti-fraude" },
            { icon: "visibility" as const, title: "Vision", desc: "Outils adaptés à tous les événements" },
          ].map((v, i) => (
            <View key={i} style={[styles.valueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.valueIcon, { backgroundColor: colors.primary + "15" }]}>
                <MaterialIcons name={v.icon} size={24} color={colors.primary} />
              </View>
              <Text style={[styles.valueTitle, { color: colors.foreground }]}>{v.title}</Text>
              <Text style={[styles.valueDesc, { color: colors.muted }]}>{v.desc}</Text>
            </View>
          ))}
        </View>

        {/* Contact Info */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Nous contacter</Text>

        <TouchableOpacity
          onPress={() => openLink(`tel:${CONTACT_INFO.phone.replace(/\s/g, "")}`)}
          style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="phone" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactLabel, { color: colors.foreground }]}>Téléphone / WhatsApp</Text>
            <Text style={[styles.contactValue, { color: colors.muted }]}>{CONTACT_INFO.phone}</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openLink(`mailto:${CONTACT_INFO.email}`)}
          style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="email" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactLabel, { color: colors.foreground }]}>Email</Text>
            <Text style={[styles.contactValue, { color: colors.muted }]}>{CONTACT_INFO.email}</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openLink(CONTACT_INFO.website)}
          style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="language" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactLabel, { color: colors.foreground }]}>Site web</Text>
            <Text style={[styles.contactValue, { color: colors.muted }]}>{CONTACT_INFO.website.replace("https://www.", "")}</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="location-on" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactLabel, { color: colors.foreground }]}>Adresse</Text>
            <Text style={[styles.contactValue, { color: colors.muted }]}>{CONTACT_INFO.address}</Text>
          </View>
        </View>

        {/* Social Media */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Suivez-nous</Text>
        <View style={styles.socialRow}>
          {SOCIAL_LINKS.map((s, i) => (
            <TouchableOpacity key={i} onPress={() => openLink(s.url)} style={[styles.socialButton, { backgroundColor: s.color }]} activeOpacity={0.8}>
              <MaterialIcons name={s.icon} size={22} color="#fff" />
              <Text style={styles.socialLabel}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Legal Section */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Informations légales</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.legalText, { color: colors.muted }]}>
            <Text style={{ fontWeight: "600", color: colors.foreground }}>Éditeur : </Text>
            Lamako Events{"\n"}
            Lot II T 4 C Betongolo, Antananarivo 101, Madagascar{"\n"}
            NIF : 5000 539 678{"\n"}
            STAT : 70203 11 2011 0 05174
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.legalText, { color: colors.muted }]}>
            <Text style={{ fontWeight: "600", color: colors.foreground }}>Directeur de la publication : </Text>
            Santatriana Fanou
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.legalText, { color: colors.muted }]}>
            <Text style={{ fontWeight: "600", color: colors.foreground }}>Hébergeur : </Text>
            Cloudways Ltd., Junction Business Centre, 1st Floor, Sqaq Lourdes, St. Julian's, STJ 3334, Malte
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => openLegalPage("https://www.ticketbylamako.com/conditions-generales-de-vente/")}
          style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="gavel" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactLabel, { color: colors.foreground }]}>Conditions Générales de Vente (CGV)</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openLegalPage("https://www.ticketbylamako.com/mentions-legales/")}
          style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="article" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactLabel, { color: colors.foreground }]}>Mentions Légales</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openLegalPage("https://www.ticketbylamako.com/politique-de-confidentialite/")}
          style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
            <MaterialIcons name="privacy-tip" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactLabel, { color: colors.foreground }]}>Politique de Confidentialité</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </TouchableOpacity>

        {/* Payment Security */}
        <View style={[styles.securityBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="lock" size={18} color={colors.success} />
          <Text style={[styles.securityText, { color: colors.muted }]}>
            Paiement 100% sécurisé via SSL — Visa, Mastercard, MVola
          </Text>
        </View>

        {/* Version */}
        <Text style={[styles.versionText, { color: colors.muted }]}>
          TicketByLamako v1.0.0{"\n"}© 2025 Lamako Events. Tous droits réservés.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  backButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20 },

  // Brand
  brandSection: { alignItems: "center", marginBottom: 24 },
  logoContainer: { width: 88, height: 88, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  logo: { width: 72, height: 72 },
  brandName: { fontSize: 22, fontWeight: "800" },
  brandTagline: { fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20, paddingHorizontal: 20 },

  // Cards
  card: { borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  cardText: { fontSize: 13, lineHeight: 21 },

  // Section
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14, marginTop: 10 },

  // Values
  valuesRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  valueCard: { flex: 1, borderRadius: 14, padding: 14, borderWidth: 1, alignItems: "center" },
  valueIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  valueTitle: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  valueDesc: { fontSize: 11, textAlign: "center", marginTop: 4, lineHeight: 16 },

  // Contact
  contactRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
  contactIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  contactLabel: { fontSize: 14, fontWeight: "600" },
  contactValue: { fontSize: 13, marginTop: 2 },

  // Social
  socialRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  socialButton: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  socialLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Legal
  legalText: { fontSize: 12, lineHeight: 19 },
  divider: { height: 1, marginVertical: 10 },

  // Security
  securityBadge: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 14, marginTop: 10, marginBottom: 10, borderWidth: 1, gap: 8 },
  securityText: { fontSize: 12, flex: 1 },

  // Version
  versionText: { textAlign: "center", fontSize: 12, marginTop: 16, lineHeight: 18 },
});
