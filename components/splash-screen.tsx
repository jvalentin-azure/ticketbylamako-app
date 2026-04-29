import { useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, Dimensions, TouchableOpacity, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const { width, height } = Dimensions.get("window");

interface CustomSplashProps {
  onFinish: () => void;
}

/**
 * CustomSplash - ALWAYS shows the onboarding screen on every app launch.
 * This is the intro/landing page of the app with Sign Up / Login / Explorer buttons.
 */
export function CustomSplash({ onFinish }: CustomSplashProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Start animation immediately on mount
  useState(() => {
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
  });

  const handleSignUp = () => {
    onFinish();
    setTimeout(() => router.push("/(auth)/register" as any), 100);
  };

  const handleLogin = () => {
    onFinish();
    setTimeout(() => router.push("/(auth)/login" as any), 100);
  };

  const handleExplore = () => {
    AsyncStorage.setItem("@lamako_explore_mode", "true");
    onFinish();
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/concert-bg.jpg")}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.9)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require("@/assets/images/logo-white.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.tagline}>
            <Text style={styles.taglineAccent}>#1 BILLETTERIE</Text>
            {" "}À MADAGASCAR
          </Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Trouvez et réservez vos événements{"\n"}et concerts à Madagascar
        </Text>

        {/* Buttons */}
        <View style={styles.buttonsSection}>
          <TouchableOpacity
            onPress={handleSignUp}
            style={styles.signUpBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.signUpBtnText}>S'inscrire</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogin}
            style={styles.loginBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </TouchableOpacity>

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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a0a00",
    zIndex: 999,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  logoSection: {
    alignItems: "center",
    marginTop: "auto",
    marginBottom: 24,
  },
  logo: {
    width: 220,
    height: 80,
  },
  tagline: {
    fontSize: 14,
    color: "#fff",
    fontFamily: "Raleway-SemiBold",
    letterSpacing: 2,
    marginTop: 8,
    textAlign: "center",
  },
  taglineAccent: {
    color: "#c79f6c",
    fontFamily: "Raleway-Bold",
  },
  subtitle: {
    fontSize: 22,
    color: "#fff",
    fontFamily: "Raleway-Bold",
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 40,
  },
  buttonsSection: {
    width: "100%",
    marginTop: "auto",
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
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Raleway-Medium",
  },
});
