import { useState, useCallback, useRef } from "react";
import { View, StyleSheet, Animated as RNAnimated } from "react-native";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { WelcomeScreen } from "@/components/welcome-screen";

interface CustomSplashProps {
  onFinish: () => void;
}

/**
 * CustomSplash - Two-step intro flow with crossfade transition:
 * 1. OnboardingScreen: 4 swipeable slides with Skip/Suivant
 * 2. WelcomeScreen: Main screen with logo, S'inscrire, Se connecter, Explorer
 *
 * Features:
 * - Crossfade animation between onboarding → welcome (and back)
 * - "Retour" button on welcome screen to go back to onboarding
 */
export function CustomSplash({ onFinish }: CustomSplashProps) {
  const [step, setStep] = useState<"onboarding" | "welcome">("onboarding");
  // Keep both screens mounted during transition for smooth crossfade
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  const onboardingOpacity = useRef(new RNAnimated.Value(1)).current;
  const welcomeOpacity = useRef(new RNAnimated.Value(0)).current;

  const CROSSFADE_DURATION = 400;

  const handleOnboardingFinish = useCallback(() => {
    // Show welcome screen underneath
    setShowWelcome(true);

    // Crossfade: fade out onboarding, fade in welcome
    RNAnimated.parallel([
      RNAnimated.timing(onboardingOpacity, {
        toValue: 0,
        duration: CROSSFADE_DURATION,
        useNativeDriver: true,
      }),
      RNAnimated.timing(welcomeOpacity, {
        toValue: 1,
        duration: CROSSFADE_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After animation, unmount onboarding for performance
      setShowOnboarding(false);
      setStep("welcome");
    });
  }, [onboardingOpacity, welcomeOpacity]);

  const handleBackToOnboarding = useCallback(() => {
    // Show onboarding screen underneath
    setShowOnboarding(true);
    onboardingOpacity.setValue(0);

    // Crossfade: fade out welcome, fade in onboarding
    RNAnimated.parallel([
      RNAnimated.timing(welcomeOpacity, {
        toValue: 0,
        duration: CROSSFADE_DURATION,
        useNativeDriver: true,
      }),
      RNAnimated.timing(onboardingOpacity, {
        toValue: 1,
        duration: CROSSFADE_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After animation, unmount welcome for performance
      setShowWelcome(false);
      setStep("onboarding");
    });
  }, [onboardingOpacity, welcomeOpacity]);

  const handleExplore = useCallback(() => {
    onFinish();
  }, [onFinish]);

  return (
    <View style={styles.container}>
      {/* Onboarding layer */}
      {showOnboarding && (
        <RNAnimated.View
          style={[StyleSheet.absoluteFillObject, { opacity: onboardingOpacity }]}
          pointerEvents={step === "onboarding" ? "auto" : "none"}
        >
          <OnboardingScreen onFinish={handleOnboardingFinish} />
        </RNAnimated.View>
      )}

      {/* Welcome layer */}
      {showWelcome && (
        <RNAnimated.View
          style={[StyleSheet.absoluteFillObject, { opacity: welcomeOpacity }]}
          pointerEvents={step === "welcome" ? "auto" : "none"}
        >
          <WelcomeScreen
            onExplore={handleExplore}
            onBack={handleBackToOnboarding}
          />
        </RNAnimated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
