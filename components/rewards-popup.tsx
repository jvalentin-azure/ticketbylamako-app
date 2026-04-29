import { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, TouchableOpacity, Dimensions, Modal } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-provider";

const { width } = Dimensions.get("window");
// In-memory flag - resets every app launch (no AsyncStorage persistence)
let rewardsPopupShownThisSession = false;

interface RewardsPopupProps {
  delay?: number; // ms before showing (default 30000 = 30s)
}

/**
 * LamakoRewards popup - shows 30s after the user enters the app
 * if they are NOT logged in (i.e. they chose "Explorer").
 * Only shows once per app session.
 */
export function RewardsPopup({ delay = 30000 }: RewardsPopupProps) {
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const { isAuthenticated } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Don't show if user is already logged in
    if (isAuthenticated) return;

    // Start the 30s timer
    timerRef.current = setTimeout(async () => {
      // Check if already shown this session (in-memory only)
      if (rewardsPopupShownThisSession) return;

      // Mark as shown for this session
      rewardsPopupShownThisSession = true;

      // Show popup
      setVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isAuthenticated, delay]);

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const handleJoin = () => {
    handleClose();
    setTimeout(() => router.push("/(auth)/register" as any), 200);
  };

  const handleLogin = () => {
    handleClose();
    setTimeout(() => router.push("/(auth)/login" as any), 200);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          {/* Close button */}
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <View style={styles.closeBtnInner}>
              <Text style={styles.closeBtnText}>✕</Text>
            </View>
          </TouchableOpacity>

          {/* Background image */}
          <Image
            source={require("@/assets/images/rewards-bg.jpg")}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
          <View style={styles.cardOverlay} />

          {/* Content */}
          <View style={styles.content}>
            <Image
              source={require("@/assets/images/lamako-rewards-white.png")}
              style={styles.rewardsLogo}
              contentFit="contain"
            />
            <Text style={styles.rewardsLabel}>Rewards</Text>

            <Text style={styles.title}>
              Profitez de réductions et récompenses{"\n"}en gagnant des points !
            </Text>

            <Text style={styles.features}>
              Billets gratuits • Cashback • Événements exclusifs
            </Text>

            <TouchableOpacity onPress={handleJoin} style={styles.joinBtn} activeOpacity={0.85}>
              <Text style={styles.joinBtnText}>Rejoindre maintenant !</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogin} style={styles.loginLink} activeOpacity={0.7}>
              <Text style={styles.loginLinkText}>
                Déjà un compte ? <Text style={styles.loginLinkAccent}>Se connecter</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: width - 48,
    borderRadius: 20,
    overflow: "hidden",
    minHeight: 380,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
  },
  closeBtnInner: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    paddingTop: 40,
  },
  rewardsLogo: {
    width: 120,
    height: 50,
  },
  rewardsLabel: {
    fontSize: 14,
    color: "#c79f6c",
    fontFamily: "Raleway-SemiBold",
    marginTop: 4,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    color: "#fff",
    fontFamily: "Raleway-Bold",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 12,
  },
  features: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Raleway-Medium",
    textAlign: "center",
    marginBottom: 24,
  },
  joinBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    backgroundColor: "#c79f6c",
  },
  joinBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Raleway-Bold",
    fontWeight: "700",
  },
  loginLink: {
    marginTop: 16,
  },
  loginLinkText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Raleway-Regular",
  },
  loginLinkAccent: {
    color: "#c79f6c",
    fontFamily: "Raleway-SemiBold",
  },
});
