import { StyleSheet } from "react-native";

export const seatPurchaseFlowStyles = StyleSheet.create({
  webViewFrame: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  centerText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  errorTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  successTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 22,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryButton: { marginTop: 12, paddingVertical: 10 },
  secondaryButtonText: { fontSize: 14, fontWeight: "700" },
  loader: { position: "absolute", top: 52, left: 0, right: 0, bottom: 0 },
  seatingFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  seatingStatus: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Raleway_600SemiBold",
    textAlign: "center",
  },
  confirmSeatsButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  confirmSeatsText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Raleway_800ExtraBold",
  },
});
