import { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

interface WelcomeScreenProps {
  onExplore: () => void;
}

/**
 * Welcome/Main Screen - shown after onboarding slides.
 * Full-screen concert background with logo, tagline, and 3 actions:
 * - S'inscrire (gold button)
 * - Se connecter (white outlined button)
 * - Explorer l'application (text link at bottom)
 */
export function WelcomeScreen({ onExplore }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Animate in on mount
  useState(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  });

  const handleSignUp = () => {
    onExplore();
    setTimeout(() => router.push("/(auth)/register" as any), 100);
  };

  const handleLogin = () => {
    onExplore();
    setTimeout(() => router.push("/(auth)/login" as any), 100);
  };

  const handleExplore = () => {
    AsyncStorage.setItem("@lamako_explore_mode", "true");
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

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 20) + 20,
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
            <Text style={styles.taglineAccent}>#1 BILLETTERIE</Text>
            {"  "}À MADAGASCAR
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

          {/* Explorer l'application - text link */}
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

// Need useState for the animation init trick
import { useState } from "react";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0500",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    marginTop: 40,
  },
  logo: {
    width: 240,
    height: 85,
  },
  tagline: {
    fontSize: 13,
    color: "#fff",
    fontFamily: "Raleway-SemiBold",
    letterSpacing: 2,
    marginTop: 10,
    textAlign: "center",
  },
  taglineAccent: {
    color: "#c79f6c",
    fontFamily: "Raleway-Bold",
  },
  headlineSection: {
    alignItems: "center",
  },
  headline: {
    fontSize: 22,
    color: "#fff",
    fontFamily: "Raleway-Bold",
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
    fontFamily: "Raleway-Bold",
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
    fontFamily: "Raleway-Bold",
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
    fontFamily: "Raleway-Medium",
  },
});
