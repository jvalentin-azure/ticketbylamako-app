import { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const { width, height } = Dimensions.get("window");

interface WelcomeScreenProps {
  onExplore: () => void;
  onBack?: () => void;
}

/**
 * Welcome/Main Screen - shown after onboarding slides.
 * Full-screen concert background with logo, tagline, and 3 actions:
 * - S'inscrire (gold button)
 * - Se connecter (white outlined button)
 * - Explorer l'application (text link at bottom → navigates to home)
 * - Retour (top-left back arrow → goes back to onboarding)
 */
export function WelcomeScreen({ onExplore, onBack }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Animate in on mount
  useEffect(() => {
    // Reset values in case component remounts
    fadeAnim.setValue(0);
    slideAnim.setValue(30);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignUp = () => {
    onExplore();
    setTimeout(() => router.push("/(auth)/register" as any), 100);
  };

  const handleLogin = () => {
    onExplore();
    setTimeout(() => router.push("/(auth)/login" as any), 100);
  };

  const handleExplore = () => {
    // Navigate directly to the main app (home screen with events list)
    onExplore();
  };

  return (
    <View style={styles.container}>
      {/* Background image */}
      <Image
        source={require("@/assets/images/welcome-bg.jpg")}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />

      {/* Dark gradient overlay */}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.25)",
          "rgba(0,0,0,0.45)",
          "rgba(0,0,0,0.75)",
          "rgba(0,0,0,0.92)",
        ]}
        locations={[0, 0.35, 0.6, 0.85]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Back button - top left */}
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.backBtn,
            { top: Math.max(insets.top, 20) + 8 },
          ]}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="arrow-back-ios" size={18} color="rgba(255,255,255,0.8)" />
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      )}

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 20) + 56,
            paddingBottom: Math.max(insets.bottom, 20) + 8,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo section - centered in upper area */}
        <View style={styles.logoSection}>
          <Image
            source={require("@/assets/images/logo-white.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.tagline}>
            Une expérience fluide, du premier clic{"\n"}jusqu'à l'entrée dans la salle
          </Text>
        </View>

        {/* Middle: headline text */}
        <View style={styles.headlineSection}>
          <Text style={styles.headline}>
            Trouvez et réservez vos événements{"\n"}et concerts à Madagascar
          </Text>
        </View>

        {/* Bottom: buttons */}
        <View style={styles.buttonsSection}>
          {/* S'inscrire - gold filled */}
          <TouchableOpacity
            onPress={handleSignUp}
            style={styles.signUpBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.signUpBtnText}>S'inscrire</Text>
          </TouchableOpacity>

          {/* Se connecter - white outlined */}
          <TouchableOpacity
            onPress={handleLogin}
            style={styles.loginBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </TouchableOpacity>

          {/* Explorer l'application - navigates to main home screen */}
          <TouchableOpacity
            onPress={handleExplore}
            style={styles.exploreBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.exploreBtnText}>Explorer l'application</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0500",
  },
  backBtn: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backBtnText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    marginLeft: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    marginTop: 20,
  },
  logo: {
    width: 240,
    height: 85,
  },
  tagline: {
    fontSize: 13,
    color: "#fff",
    letterSpacing: 0.5,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 10,
  },
  taglineAccent: {
    color: "#c79f6c",
  },
  headlineSection: {
    alignItems: "center",
  },
  headline: {
    fontSize: 22,
    color: "#fff",
    textAlign: "center",
    lineHeight: 30,
  },
  buttonsSection: {
    width: "100%",
    gap: 14,
  },
  signUpBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: "#c79f6c",
    alignItems: "center",
    justifyContent: "center",
  },
  signUpBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  loginBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnText: {
    color: "#1a0a00",
    fontSize: 16,
    fontWeight: "700",
  },
  exploreBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreBtnText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
  },
});
