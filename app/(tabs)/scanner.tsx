import { useEffect, useState, useRef } from "react";
import { Text, View, TouchableOpacity, Platform, Vibration, Animated } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { checkInTicket, type CheckInResult } from "@/lib/api/tickera";

const TICKERA_API_KEY = process.env.EXPO_PUBLIC_TICKERA_API_KEY || "";

// Camera/barcode scanner - will use expo-camera on native
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  const cam = require("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {}

type ScanStatus = "idle" | "scanning" | "success" | "error" | "already";

export default function ScannerScreen() {
  const colors = useColors();
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [lastScanned, setLastScanned] = useState<string>("");
  const [scanCount, setScanCount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [permission, requestPermission] = useCameraPermissions?.() || [null, () => {}];

  useEffect(() => {
    if (status === "success" || status === "error" || status === "already") {
      // Pulse animation on result
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();

      // Reset after 3 seconds
      const timer = setTimeout(() => {
        setStatus("scanning");
        setResult(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (status !== "scanning" || data === lastScanned) return;
    setLastScanned(data);

    try {
      const res = await checkInTicket(data, TICKERA_API_KEY);
      setResult(res);

      if (res.status === "valid") {
        setStatus("success");
        setScanCount(c => c + 1);
        if (Platform.OS !== "web") Vibration.vibrate(100);
      } else if (res.status === "already_checked") {
        setStatus("already");
        if (Platform.OS !== "web") Vibration.vibrate([0, 50, 50, 50]);
      } else {
        setStatus("error");
        if (Platform.OS !== "web") Vibration.vibrate([0, 100, 50, 100]);
      }
    } catch (e: any) {
      setResult({ status: "error", success: false, message: e.message || "Erreur de connexion" });
      setStatus("error");
      if (Platform.OS !== "web") Vibration.vibrate([0, 100, 50, 100]);
    }

    // Allow re-scan of same code after 5s
    setTimeout(() => setLastScanned(""), 5000);
  };

  // Web fallback or no camera
  if (Platform.OS === "web" || !CameraView) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ width: 100, height: 100, borderRadius: 24, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <IconSymbol name="qrcode.viewfinder" size={48} color={colors.primary} />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginBottom: 8 }}>Scanner QR</Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
            Le scanner de billets nécessite l'application native.{"\n"}Ouvrez l'app sur votre téléphone pour scanner les QR codes.
          </Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginTop: 24, width: "100%", borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 }}>Statistiques de session</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Billets scannés</Text>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>{scanCount}</Text>
            </View>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (!permission?.granted) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <IconSymbol name="camera.fill" size={48} color={colors.muted} />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 16 }}>Accès caméra requis</Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
            Pour scanner les QR codes des billets, autorisez l'accès à la caméra.
          </Text>
          <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 20 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Autoriser la caméra</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const statusColors = {
    idle: colors.muted,
    scanning: colors.primary,
    success: "#22C55E",
    error: "#EF4444",
    already: "#F59E0B",
  };

  const statusMessages = {
    idle: "Prêt à scanner",
    scanning: "Pointez vers un QR code",
    success: "Check-in réussi !",
    error: result?.message || "Billet invalide",
    already: "Déjà scanné",
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-black">
      <View style={{ flex: 1, position: "relative" }}>
        {/* Camera */}
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={status === "scanning" ? handleBarCodeScanned : undefined}
        />

        {/* Overlay */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* Top bar */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Scannés: {scanCount}</Text>
            </View>
          </View>

          {/* Center frame */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={{ width: 250, height: 250, borderRadius: 20, borderWidth: 3, borderColor: statusColors[status], position: "relative" }}>
                {/* Corner markers */}
                <View style={{ position: "absolute", top: -3, left: -3, width: 30, height: 30, borderTopWidth: 5, borderLeftWidth: 5, borderColor: statusColors[status], borderTopLeftRadius: 12 }} />
                <View style={{ position: "absolute", top: -3, right: -3, width: 30, height: 30, borderTopWidth: 5, borderRightWidth: 5, borderColor: statusColors[status], borderTopRightRadius: 12 }} />
                <View style={{ position: "absolute", bottom: -3, left: -3, width: 30, height: 30, borderBottomWidth: 5, borderLeftWidth: 5, borderColor: statusColors[status], borderBottomLeftRadius: 12 }} />
                <View style={{ position: "absolute", bottom: -3, right: -3, width: 30, height: 30, borderBottomWidth: 5, borderRightWidth: 5, borderColor: statusColors[status], borderBottomRightRadius: 12 }} />
              </View>
            </Animated.View>
          </View>

          {/* Bottom result */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 40, alignItems: "center" }}>
            <View style={{ backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, width: "100%", alignItems: "center" }}>
              {status === "success" && result && (
                <>
                  <IconSymbol name="checkmark.circle.fill" size={28} color="#22C55E" />
                  <Text style={{ color: "#22C55E", fontSize: 16, fontWeight: "700", marginTop: 6 }}>Check-in réussi !</Text>
                  {result.ticket?.buyer_name && <Text style={{ color: "#fff", fontSize: 14, marginTop: 4 }}>{result.ticket.buyer_name}</Text>}
                  {result.ticket?.ticket_type && <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>{result.ticket.ticket_type}</Text>}
                </>
              )}
              {status === "already" && (
                <>
                  <IconSymbol name="exclamationmark.triangle.fill" size={28} color="#F59E0B" />
                  <Text style={{ color: "#F59E0B", fontSize: 16, fontWeight: "700", marginTop: 6 }}>Déjà scanné</Text>
                  {result?.ticket?.buyer_name && <Text style={{ color: "#fff", fontSize: 14, marginTop: 4 }}>{result.ticket.buyer_name}</Text>}
                </>
              )}
              {status === "error" && (
                <>
                  <IconSymbol name="xmark.circle.fill" size={28} color="#EF4444" />
                  <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "700", marginTop: 6 }}>{result?.message || "Billet invalide"}</Text>
                </>
              )}
              {(status === "idle" || status === "scanning") && (
                <>
                  <IconSymbol name="qrcode.viewfinder" size={28} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600", marginTop: 6 }}>{statusMessages[status]}</Text>
                </>
              )}
            </View>

            {status === "idle" && (
              <TouchableOpacity
                onPress={() => setStatus("scanning")}
                style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginTop: 16 }}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Commencer le scan</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
