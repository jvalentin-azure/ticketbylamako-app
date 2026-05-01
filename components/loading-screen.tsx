import { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Text,
} from "react-native";
import { Image } from "expo-image";

/**
 * Branded loading screen shown during app startup while:
 * - Fonts are loading
 * - Token is being verified
 *
 * Dark background with centered logo, subtle pulse animation, and a small spinner.
 * Replaces the blank white screen for a polished first impression.
 */
export function LoadingScreen() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in the content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Subtle pulse on the logo
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.92,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Image
          source={require("@/assets/images/logo-white.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.bottomSection, { opacity: fadeAnim }]}>
        <ActivityIndicator size="small" color="#c79f6c" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0500",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 220,
    height: 80,
  },
  bottomSection: {
    position: "absolute",
    bottom: 80,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontFamily: "Raleway-Regular",
    letterSpacing: 1,
  },
});
