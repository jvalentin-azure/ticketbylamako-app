import { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, TouchableOpacity, Dimensions, Modal } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-provider";
import { useRewards } from "@/lib/rewards-provider";

const { width } = Dimensions.get("window");
const POPUP_STORAGE_KEY = "@lamako_rewards_popup_state";
let rewardsPopupShownThisSession = false;

interface RewardsPopupProps {
  delay?: number;
}

export function RewardsPopup({ delay = 30000 }: RewardsPopupProps) {
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const { isAuthenticated } = useAuth();
  const { config, canRedeem, pointsUntilRedemption, isConfigReady } = useRewards();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const popupConfig = config.popup;
    if (!isConfigReady) return;
    if (!config.enabled) return;
    if (!popupConfig.mobileEnabled) return;
    if (popupConfig.mobileAudience === "guests" && isAuthenticated) return;
    if (popupConfig.mobileAudience === "authenticated" && !isAuthenticated) return;

    timerRef.current = setTimeout(async () => {
      if (rewardsPopupShownThisSession) return;

      const stored = await AsyncStorage.getItem(POPUP_STORAGE_KEY);
      const popupState = stored ? (JSON.parse(stored) as { lastClosedAt?: string; impressions?: number }) : {};
      const lastClosedAt = popupState.lastClosedAt ? new Date(popupState.lastClosedAt).getTime() : 0;
      const frequencyMs = popupConfig.mobileFrequencyDays * 24 * 60 * 60 * 1000;
      const impressions = popupState.impressions || 0;

      if (lastClosedAt && Date.now() - lastClosedAt < frequencyMs) return;
      if (popupConfig.mobileMaxImpressions > 0 && impressions >= popupConfig.mobileMaxImpressions) return;

      rewardsPopupShownThisSession = true;
      await AsyncStorage.setItem(
        POPUP_STORAGE_KEY,
        JSON.stringify({
          ...popupState,
          impressions: impressions + 1,
          lastShownAt: new Date().toISOString(),
        })
      );

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
    }, config.popup.mobileDelayMs || delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [config.enabled, config.popup, isAuthenticated, isConfigReady, delay, fadeAnim, scaleAnim]);

  const handleClose = () => {
    AsyncStorage.mergeItem(POPUP_STORAGE_KEY, JSON.stringify({ lastClosedAt: new Date().toISOString() })).catch(() => {});
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const handleJoin = () => {
    handleClose();
    const destination = isAuthenticated ? config.popup.mobileCtaRoute || "/rewards" : "/(auth)/register";
    setTimeout(() => router.push(destination as any), 200);
  };

  const handleLogin = () => {
    handleClose();
    setTimeout(() => router.push("/(auth)/login" as any), 200);
  };

  if (!visible) return null;

  const title = isAuthenticated && !canRedeem
    ? `Plus que ${pointsUntilRedemption.toLocaleString("fr-FR")} points pour debloquer vos reductions Rewards.`
    : config.copy.earnMessage;
  const subtitle = isAuthenticated
    ? (canRedeem
      ? config.copy.redeemMessage
      : `Vos reductions sont debloquees a partir de ${config.minimumRedeemPoints} points et utilisables sur les offres participantes.`)
    : `Recevez ${config.earnRules.registrationBonus} points de bienvenue. Reductions disponibles a partir de ${config.minimumRedeemPoints} points sur les offres participantes.`;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <View style={styles.closeBtnInner}>
              <Text style={styles.closeBtnText}>x</Text>
            </View>
          </TouchableOpacity>

          <Image
            source={require("@/assets/images/rewards-bg.jpg")}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
          <View style={styles.cardOverlay} />

          <View style={styles.content}>
            <Image
              source={require("@/assets/images/lamako-rewards-white.png")}
              style={styles.rewardsLogo}
              contentFit="contain"
            />
            <Text style={styles.rewardsLabel}>Rewards</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.features}>{subtitle}</Text>

            <TouchableOpacity onPress={handleJoin} style={styles.joinBtn} activeOpacity={0.85}>
              <Text style={styles.joinBtnText}>{isAuthenticated ? "Voir mes Rewards" : "Rejoindre maintenant"}</Text>
            </TouchableOpacity>

            {!isAuthenticated && (
              <TouchableOpacity onPress={handleLogin} style={styles.loginLink} activeOpacity={0.7}>
                <Text style={styles.loginLinkText}>
                  Deja un compte ? <Text style={styles.loginLinkAccent}>Se connecter</Text>
                </Text>
              </TouchableOpacity>
            )}
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
    marginTop: 4,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 12,
  },
  features: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
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
    fontWeight: "700",
  },
  loginLink: {
    marginTop: 16,
  },
  loginLinkText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  loginLinkAccent: {
    color: "#c79f6c",
  },
});
