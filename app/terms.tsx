import { LegalDocumentScreen } from "@/components/legal-document-screen";

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      title="Conditions générales de vente"
      updatedAt="Dernière mise à jour : Avril 2026"
      sections={[
        {
          title: "Objet",
          body: "Les présentes conditions encadrent l'achat de billets, produits et services proposés par TicketByLamako dans l'application mobile. Toute commande validée implique l'acceptation des présentes conditions.",
        },
        {
          title: "Commandes et disponibilité",
          body: "Les billets et produits sont proposés dans la limite des stocks disponibles. Pour les événements avec plan de salle, la place est réservée uniquement après confirmation du paiement par le système.",
        },
        {
          title: "Prix et paiement",
          body: "Les prix sont affichés en Ariary. Le paiement est effectué via les moyens proposés au moment de la commande, notamment carte bancaire ou Mobile Money selon disponibilité. Une commande non payée peut être annulée automatiquement.",
        },
        {
          title: "Billets électroniques",
          body: "Après paiement confirmé, les billets électroniques sont disponibles dans l'application. Le QR code doit être présenté à l'entrée de l'événement. Un billet peut être contrôlé selon les règles de l'organisateur.",
        },
        {
          title: "Annulation et remboursement",
          body: "Les conditions d'annulation, d'échange ou de remboursement dépendent de l'événement, de l'organisateur et de la réglementation applicable. En cas d'événement annulé ou reporté, les modalités seront communiquées aux clients concernés.",
        },
        {
          title: "Programme LamakoRewards",
          body: "Les points LamakoRewards sont attribués selon les règles du programme en vigueur. Les points ne constituent pas une monnaie électronique et peuvent être soumis à des conditions d'utilisation, de disponibilité et d'expiration.",
        },
        {
          title: "Contact",
          body: "Pour toute question liée à une commande, contactez TicketByLamako à info@ticketbylamako.com ou via WhatsApp au +261 38 73 57 728.",
        },
      ]}
    />
  );
}
