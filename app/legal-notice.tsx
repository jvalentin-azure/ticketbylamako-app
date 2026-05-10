import { LegalDocumentScreen } from "@/components/legal-document-screen";

export default function LegalNoticeScreen() {
  return (
    <LegalDocumentScreen
      title="Mentions légales"
      updatedAt="Dernière mise à jour : Avril 2026"
      sections={[
        {
          title: "Éditeur",
          body: "TicketByLamako est édité par Lamako Events, Lot II T 4 C Betongolo, Antananarivo 101, Madagascar. NIF : 5000 539 678. STAT : 70203 11 2011 0 05174.",
        },
        {
          title: "Directeur de la publication",
          body: "Le directeur de la publication est Santatriana Fanou.",
        },
        {
          title: "Contact",
          body: "Email : info@ticketbylamako.com. Téléphone / WhatsApp : +261 38 73 57 728.",
        },
        {
          title: "Hébergement",
          body: "Le service est hébergé par Cloudways Ltd., Junction Business Centre, 1st Floor, Sqaq Lourdes, St. Julian's, STJ 3334, Malte.",
        },
        {
          title: "Propriété intellectuelle",
          body: "Les marques, textes, visuels, logos, interfaces et contenus de TicketByLamako sont protégés. Toute reproduction ou utilisation non autorisée est interdite.",
        },
        {
          title: "Responsabilité",
          body: "TicketByLamako met tout en œuvre pour assurer l'exactitude des informations affichées. Les informations propres aux événements restent fournies ou validées par les organisateurs concernés.",
        },
      ]}
    />
  );
}
