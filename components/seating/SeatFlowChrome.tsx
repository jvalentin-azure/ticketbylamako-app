import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import type { SelectedSeat } from "@/lib/seating-webview";

interface SeatFlowHeaderProps {
  title: string;
  onClose: () => void;
  selectedCount?: number;
  onSeatSummary?: () => void;
}

export function SeatFlowHeader({
  title,
  onClose,
  selectedCount = 0,
  onSeatSummary,
}: SeatFlowHeaderProps) {
  const colors = useColors();
  const showSeatBadge = selectedCount > 0 && !!onSeatSummary;

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <TouchableOpacity onPress={onClose} style={styles.headerBack}>
        <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        <Text style={[styles.headerBackText, { color: colors.foreground }]}>Retour</Text>
      </TouchableOpacity>
      <Text
        style={[styles.headerTitle, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {showSeatBadge ? (
        <TouchableOpacity
          onPress={onSeatSummary}
          style={[
            styles.badge,
            styles.headerBadge,
            { backgroundColor: colors.primary },
          ]}
          activeOpacity={0.8}
        >
          <Text style={styles.badgeText}>{selectedCount}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface SeatSummaryModalProps {
  visible: boolean;
  seats: SelectedSeat[];
  onClose: () => void;
  onContinue: () => void;
}

export function SeatSummaryModal({
  visible,
  seats,
  onClose,
  onContinue,
}: SeatSummaryModalProps) {
  const colors = useColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.seatModal,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.seatModalHeader}>
            <Text style={[styles.seatModalTitle, { color: colors.foreground }]}>Places sélectionnées</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <IconSymbol name="xmark" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={styles.seatList}>
            {seats.map((seat, index) => (
              <View
                key={`${seat.id || "seat"}-${index}`}
                style={[
                  styles.seatChip,
                  {
                    backgroundColor: colors.primary + "12",
                    borderColor: colors.primary + "30",
                  },
                ]}
              >
                <IconSymbol name="mappin" size={14} color={colors.primary} />
                <Text style={[styles.seatChipText, { color: colors.primary }]}>
                  {seat.label || `Place ${index + 1}`}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={onContinue}
            style={[
              styles.modalPayButton,
              { backgroundColor: colors.success || "#16a34a" },
            ]}
          >
            <Text style={styles.modalPayButtonText}>Continuer vers le paiement</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerBack: {
    position: "absolute",
    left: 12,
    width: 86,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  headerBackText: { fontSize: 14, fontWeight: "600" },
  headerTitle: {
    width: "100%",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 96,
  },
  headerBadge: { position: "absolute", right: 12, zIndex: 2 },
  badge: {
    minWidth: 32,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "center",
    padding: 20,
  },
  seatModal: { borderWidth: 1, borderRadius: 14, padding: 16 },
  seatModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  seatModalTitle: { fontSize: 17, fontWeight: "800" },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  seatList: { gap: 8, marginBottom: 16 },
  seatChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  seatChipText: { fontSize: 14, fontWeight: "800" },
  modalPayButton: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  modalPayButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
