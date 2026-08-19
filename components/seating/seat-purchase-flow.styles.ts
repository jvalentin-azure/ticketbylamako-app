import { StyleSheet } from "react-native";

export const seatPurchaseFlowStyles = StyleSheet.create({
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
});
