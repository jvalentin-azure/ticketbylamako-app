import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "@/lib/auth-provider";

const STORAGE_KEY = "lamako_rewards_popup_v2";
const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
const EXCLUDED_ROUTES = [
  "/login",
  "/register",
  "/checkout",
  "/cart",
  "/panier",
  "/payment",
  "/paiement",
  "/order",
  "/commande",
  "/rewards",
];

type PopupConfig = {
  enabled: boolean;
  delayMs: number;
  frequencyMs: number;
  maxImpressions: number;
  ctaRoute: string;
  signupBonus: number;
  firstOpenBonus: number;
  earnAmount: number;
  minimumRedeem: number;
  priorityLaneMinimum: number;
};

type PopupHistory = {
  impressions: number;
  lastShownAt: number;
};

let rewardsPopupShownThisSession = false;

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeConfig(payload: any): PopupConfig | null {
  const program = payload?.program || {};
  const popup = payload?.popup?.mobile || payload?.popup || {};
  const priorityLane = payload?.priority_lane || program?.priority_lane || {};

  if (program?.enabled === false || popup?.enabled === false) return null;

  return {
    enabled: true,
    delayMs: numberValue(popup?.delay_seconds, 12) * 1000,
    frequencyMs:
      numberValue(popup?.frequency_days, 7) * 24 * 60 * 60 * 1000,
    maxImpressions: numberValue(popup?.max_impressions_per_user, 3),
    ctaRoute:
      typeof popup?.cta_route === "string" ? popup.cta_route : "/rewards",
    signupBonus: numberValue(program?.signup_bonus_points, 100),
    firstOpenBonus: numberValue(program?.first_app_open_bonus_points, 50),
    earnAmount: numberValue(program?.earn_rate?.amount_ariary, 1000),
    minimumRedeem: numberValue(program?.minimum_redeem_points, 500),
    priorityLaneMinimum: numberValue(
      priorityLane?.minimum_lifetime_points,
      500,
    ),
  };
}

function isExcludedRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return EXCLUDED_ROUTES.some((route) => normalized.includes(route));
}

export function RewardsPopup() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { isAuthenticated, isLoading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (isLoading || isAuthenticated || isExcludedRoute(pathname)) {
      setVisible(false);
      return;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const preparePopup = async () => {
      try {
        const response = await fetch(
          `${SITE_URL}/wp-json/lamako-mobile/v2/rewards/config`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok) return;

        const remoteConfig = normalizeConfig(await response.json());
        if (!remoteConfig?.enabled || remoteConfig.maxImpressions === 0) return;

        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const history: PopupHistory = stored
          ? JSON.parse(stored)
          : { impressions: 0, lastShownAt: 0 };
        const now = Date.now();

        if (
          rewardsPopupShownThisSession ||
          history.impressions >= remoteConfig.maxImpressions ||
          now - history.lastShownAt < remoteConfig.frequencyMs
        ) {
          return;
        }

        setConfig(remoteConfig);
        timer = setTimeout(async () => {
          if (rewardsPopupShownThisSession) return;
          rewardsPopupShownThisSession = true;
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              impressions: history.impressions + 1,
              lastShownAt: Date.now(),
            } satisfies PopupHistory),
          );
          setVisible(true);
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 240,
              useNativeDriver: Platform.OS !== "web",
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              tension: 70,
              friction: 9,
              useNativeDriver: Platform.OS !== "web",
            }),
          ]).start();
        }, remoteConfig.delayMs);
      } catch {
        // A promotion must never block navigation when config is unavailable.
      }
    };

    void preparePopup();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [fadeAnim, isAuthenticated, isLoading, pathname, scaleAnim]);

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => setVisible(false));
  };

  const navigateAfterClose = (destination: string) => {
    handleClose();
    setTimeout(() => router.push(destination as never), 180);
  };

  if (!visible || !config) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel="Découvrir le programme LamakoRewards"
          style={[
            styles.card,
            {
              maxWidth: Math.min(width - 32, 430),
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={require("@/assets/images/rewards-bg.jpg")}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
          <View style={styles.overlay} />

          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <Text style={styles.closeText}>x</Text>
          </TouchableOpacity>

          <View style={styles.content}>
            <Image
              source={require("@/assets/images/lamako-rewards-white.png")}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="LamakoRewards"
            />
            <Text style={styles.eyebrow}>VOS SORTIES. VOTRE VALEUR.</Text>
            <Text style={styles.title}>Des points qui servent vraiment.</Text>
            <Text style={styles.description}>
              Activez gratuitement LamakoRewards et cumulez 1 point par tranche
              de {config.earnAmount.toLocaleString("fr-FR")} Ar sur vos achats
              éligibles.
            </Text>

            <View style={styles.benefits}>
              <View style={styles.benefit}>
                <Text style={styles.benefitValue}>+{config.signupBonus}</Text>
                <Text style={styles.benefitLabel}>à l'adhésion</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.benefit}>
                <Text style={styles.benefitValue}>+{config.firstOpenBonus}</Text>
                <Text style={styles.benefitLabel}>première ouverture</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.benefit}>
                <Text style={styles.benefitValue}>
                  {config.minimumRedeem} pts
                </Text>
                <Text style={styles.benefitLabel}>première réduction</Text>
              </View>
            </View>

            <Text style={styles.priorityText}>
              Priority Lane possible dès {config.priorityLaneMinimum} points sur
              les événements participants.
            </Text>

            <TouchableOpacity
              onPress={() => navigateAfterClose(config.ctaRoute)}
              style={styles.primaryButton}
              activeOpacity={0.86}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>
                Découvrir LamakoRewards
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigateAfterClose("/(auth)/login")}
              style={styles.loginButton}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Text style={styles.loginText}>
                Déjà membre ? Se connecter
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
    backgroundColor: "rgba(11, 9, 8, 0.76)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#17120e",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18, 12, 8, 0.84)",
  },
  closeButton: {
    position: "absolute",
    zIndex: 3,
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  closeText: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  content: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 24 },
  logo: { width: 142, height: 48, marginBottom: 18 },
  eyebrow: {
    color: "#D8FF36",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "800",
    maxWidth: 330,
  },
  description: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  benefits: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  benefit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  benefitValue: { color: "#D8FF36", fontSize: 15, fontWeight: "800" },
  benefitLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 9,
    lineHeight: 12,
    textAlign: "center",
    marginTop: 3,
  },
  divider: { width: 1, backgroundColor: "rgba(255,255,255,0.13)" },
  priorityText: {
    color: "#FFD4A2",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
  },
  primaryButton: {
    backgroundColor: "#D8FF36",
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#17120e",
    fontSize: 14,
    fontWeight: "800",
  },
  loginButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  loginText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "600",
  },
});
